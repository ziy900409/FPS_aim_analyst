import type * as THREE from 'three/webgpu';
import { consume } from '../input/consume.ts';
import type { SharedState } from '../state/SharedState.ts';
import type { TargetManager } from '../sim/TargetManager.ts';
import { raycastFromCenter } from '../sim/HitDetector.ts';
import { currentPeekId, firstShotGate } from '../sim/firstShot.ts';
import type { InputEvent } from '../state/types.ts';
import type { Clock } from './clock.ts';

/**
 * SimLoop — WP-2 / T2（FR-2.2，§4.3 accumulator）
 *
 * 固定步長 accumulator：以注入式 clock 取時間基準，`pump(nowMs)` 累加 frame delta、每滿一個
 * TICK 跑一次 `simStep`，餘量夾住 0.25s 避免 spiral of death。與 render 解耦（render 在 T3 用
 * 回傳的 `alpha` 內插）。
 *
 * 決定性根源（ADR-3 / §6）：`simStep` **只**用固定 TICK 推進、**絕不**用 frame delta；一段
 * 邏輯時間內的 tick 數只由累積時間決定，與 render FPS 無關（T4 驗證）。
 */

/**
 * 佔位橫移速度（u/s，canonical unit）。真 `MovementController`（friction/accel + 急停）在 WP-5；
 * 此處僅為 T4 決定性驗證提供「可由輸入切換的 velocity」（OQ-2.1）。
 */
const PLACEHOLDER_STRAFE_SPEED = 250;

/**
 * 輸入套用（handle）：鍵事件更新 A/D 橫移瞬間 snap velocity（佔位；WP-5 T3/T4 換真
 * `MovementController` + 急停）。**fire 事件在串流該點 inline raycast**（sub-tick 忠實、零內插）：
 * 有注入 `camera` + `targetManager` 時，從 camera 中心射線判命中，**第一次命中即擊殺**（OQ-5.4）→
 * `markKilled` → WP-4 生成對側。mouse 事件（準心）仍在佔位階段忽略。
 *
 * 依時序、無遺漏的排序消費與排空責任已抽到 [`consume`](../input/consume.ts)（T4）；本函式只負責
 * 「每個到期事件如何改狀態」，不管排序/分桶/排空。
 */
function applyInput(
  state: SharedState,
  ev: InputEvent,
  camera?: THREE.Camera,
  targetManager?: TargetManager,
): void {
  if (ev.type === 'key') {
    if (ev.code === 'KeyD') state.player.vx = ev.down ? PLACEHOLDER_STRAFE_SPEED : 0;
    else if (ev.code === 'KeyA') state.player.vx = ev.down ? -PLACEHOLDER_STRAFE_SPEED : 0;
  } else if (ev.type === 'fire' && camera !== undefined && targetManager !== undefined) {
    // 開火：首發旗標**先於命中判定**——peek 錨為 fire 當下的 active 目標；命中即擊殺會撤除該目標、
    // 換 peek，故 firstShot 須在 markKilled 之前對「當前 peek」判定（FR-5.2，OQ-5.3）。未命中亦計首發
    // （P2：未命中可補槍，首發＝peek 內第一個 fire，無論中否）。
    const peekId = currentPeekId(state);
    const firstShot = peekId !== undefined ? firstShotGate(state, peekId) : false;

    // camera 中心射線 → 命中 → 第一次命中即擊殺（FR-5.1，OQ-5.4）。精準 gate（stopped）屬 T4。
    const { hit, targetId } = raycastFromCenter(camera, state.targets);
    if (hit && targetId !== undefined) targetManager.markKilled(state, targetId);

    // fire 結果事件（含 firstShot / accurate / residualSpeed）產出 → WP-7 記錄 / WP-8 統計；
    // 本 WP 只判定旗標（旗標記憶已寫入 state.firstShotPeekId，供整合測試觀察）。
    void firstShot;
  }
}

/**
 * 推進一個固定 tick（純函式邊界，OQ-2.4：只讀寫傳入 state、不讀 `performance.now()`、不碰 DOM；
 * 預留階段 B Worker 搬遷）。`tickEndMs` = 本 tick 邏輯窗結束時間（量測時鐘域 ms），供輸入分桶。
 *
 * 順序（對齊 CONTEXT「simStep 順序」雛形）：① prev←curr（內插基準，T3）；② 目標系統
 * （spawn/可見性/蓋 t_visible，**命中判定之前**，F5 seam / WP-5，WP-4）；③ 依時序消費本 tick
 * 輸入（`consume` 排序 + 排空，T4）；④ 等速推進位置（**只用 dtSec**）；⑤ curr←新位置。
 *
 * `targetManager` 選填：注入即在 tick 內推進目標（WP-4）；省略則維持純位移（WP-2 決定性測試路徑）。
 * `camera` 選填：注入即在 fire 事件處理命中判定（WP-5 T1）；省略則 fire 為 no-op（決定性測試路徑）。
 */
export function simStep(
  state: SharedState,
  dtSec: number,
  tickEndMs: number,
  targetManager?: TargetManager,
  camera?: THREE.Camera,
  handle: (ev: InputEvent) => void = (ev) => applyInput(state, ev, camera, targetManager),
): void {
  state.prev.x = state.curr.x;
  state.prev.z = state.curr.z;

  // 目標 spawn/可見性/蓋 t_visible：在命中判定（WP-5 fire raycast）之前，且時間源為 sim tick
  // 的 `tickEndMs`（量測時鐘域，非 rAF/Date.now）——反應時間效度關鍵（README failure-mode）。
  targetManager?.tick(state, tickEndMs);

  // 半開窗 [tickStart, tickEndMs)、嚴格 `<`（GD-3）；handle 每個到期事件套用佔位狀態變更。
  // handle 由 createSimLoop **綁定一次**傳入(熱路徑零配置,GC 紀律 §4);直接呼叫(測試)走預設閉包。
  consume(state, tickEndMs, handle);

  state.player.x += state.player.vx * dtSec;
  state.player.z += state.player.vz * dtSec;

  state.curr.x = state.player.x;
  state.curr.z = state.player.z;
}

export interface SimLoop {
  /** 餵入當前時間（ms，量測時鐘域）；推進 0+ 個固定 tick，回傳本幀 tick 數與 alpha 內插係數 [0,1)。 */
  pump(nowMs: number): { ticks: number; alpha: number };
}

/**
 * 建 accumulator sim loop。`clock` 僅用於取時間基準（`pump` 的 nowMs 才是每幀驅動源），
 * `simHz` 注入使 tick rate 可調（ADR-3）。
 */
export function createSimLoop(
  state: SharedState,
  clock: Clock,
  simHz: number,
  targetManager?: TargetManager,
  camera?: THREE.Camera,
): SimLoop {
  const tickSec = 1 / simHz;
  const tickMs = 1000 / simHz;
  let accSec = 0;
  let lastMs = clock.now();
  let simTimeMs = lastMs; // 邏輯 sim 時鐘（量測時鐘域 ms），每 tick 推進 tickMs；決定 tick 窗

  // 綁定一次的輸入 handle：閉包 over state/camera/targetManager，避免每 tick 配置新 arrow
  // （熱路徑零配置，GC 紀律 §4）。camera/targetManager 省略時 fire 事件 no-op。
  const handleInput = (ev: InputEvent): void => applyInput(state, ev, camera, targetManager);

  return {
    pump(nowMs: number): { ticks: number; alpha: number } {
      accSec += Math.min((nowMs - lastMs) / 1000, 0.25); // 夾住避免 spiral of death
      lastMs = nowMs;

      let ticks = 0;
      while (accSec >= tickSec) {
        simTimeMs += tickMs;
        simStep(state, tickSec, simTimeMs, targetManager, camera, handleInput);
        accSec -= tickSec;
        ticks++;
      }

      return { ticks, alpha: accSec / tickSec };
    },
  };
}
