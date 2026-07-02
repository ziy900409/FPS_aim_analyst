import type * as THREE from 'three/webgpu';
import { consume } from '../input/consume.ts';
import type { SharedState } from '../state/SharedState.ts';
import type { TargetManager } from '../sim/TargetManager.ts';
import { raycastFromCenter } from '../sim/HitDetector.ts';
import { currentPeekId, firstShotGate } from '../sim/firstShot.ts';
import { createMovementController, type MovementController } from '../sim/MovementController.ts';
import type { DrillRunner } from '../drill/DrillRunner.ts';
import type { InputEvent } from '../state/types.ts';
import type { DataRecorder } from '../data/DataRecorder.ts';
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

/** app / 測試直呼 `simStep` 的預設 movement controller（階段 A 無內部狀態，可安全共用）。 */
const defaultMovement = createMovementController();

/**
 * 輸入套用（handle）：鍵事件更新 A/D **held 狀態**（`MovementController.step` 每 tick 讀 held 定
 * velocity + 急停 flag，T3/T4）。**fire 事件在串流該點 inline raycast**（sub-tick 忠實、零內插）：
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
  recorder?: DataRecorder,
): void {
  if (ev.type === 'key') {
    if (ev.code === 'KeyD') {
      if (ev.down && !state.held.right && state.player.vx < 0) recorder?.recordEvent({ type: 'counter', key: 'D', t: ev.t });
      state.held.right = ev.down;
    } else if (ev.code === 'KeyA') {
      if (ev.down && !state.held.left && state.player.vx > 0) recorder?.recordEvent({ type: 'counter', key: 'A', t: ev.t });
      state.held.left = ev.down;
    }
  } else if (ev.type === 'fire') {
    // 開火：首發旗標**先於命中判定**——peek 錨為 fire 當下的 active 目標；命中即擊殺會撤除該目標、
    // 換 peek，故 firstShot 須在 markKilled 之前對「當前 peek」判定（FR-5.2，OQ-5.3）。未命中亦計首發
    // （P2：未命中可補槍，首發＝peek 內第一個 fire，無論中否）。
    let firstShot = false;
    let hit = false;
    let part: 'head' | 'body' | undefined;

    // 精準 gate（FR-5.4，OQ-5.1）：**在命中判定與 markKilled 之前**讀 velocity——反映 fire 當下
    // （＝上一 tick movement.step 所定，本 tick movement.step 尚未跑）的移動狀態。停止態（急停穿越
    // tick）開火 → accurate；殘速二元 {0,±v}（階段 A），結果頁分類呈現。
    const accurate = state.player.stopped;
    const residualSpeed = Math.abs(state.player.vx);

    // camera 中心射線 → 命中 → 第一次命中即擊殺（FR-5.1，OQ-5.4）。
    if (camera !== undefined && targetManager !== undefined) {
      const peekId = currentPeekId(state);
      firstShot = peekId !== undefined ? firstShotGate(state, peekId) : false;
      const result = raycastFromCenter(camera, state.targets);
      hit = result.hit;
      part = result.part;
      if (hit && result.targetId !== undefined) targetManager.markKilled(state, result.targetId);
    }

    // fire 結果事件（含 firstShot / accurate / residualSpeed）產出 → WP-7 記錄 / WP-8 統計；
    // 本 WP 只判定旗標（旗標記憶已寫入 state.firstShotPeekId，供整合測試觀察）。
    void accurate;
    if (part !== undefined) recorder?.recordEvent({ type: 'fire', t: ev.t, hit, firstShot, residualSpeed, part });
    else recorder?.recordEvent({ type: 'fire', t: ev.t, hit, firstShot, residualSpeed });
  }
}

function recordVisibleEvents(state: SharedState, t: number, recorder?: DataRecorder): void {
  if (recorder === undefined) return;
  for (let i = 0; i < state.targets.length; i++) {
    const target = state.targets[i];
    if (target.visible && state.tVisible.get(target.id) === t) {
      recorder.recordEvent({ type: 'visible', targetId: target.id, t });
    }
  }
}

/**
 * 推進一個固定 tick（純函式邊界，OQ-2.4：只讀寫傳入 state、不讀 `performance.now()`、不碰 DOM；
 * 預留階段 B Worker 搬遷）。`tickEndMs` = 本 tick 邏輯窗結束時間（量測時鐘域 ms），供輸入分桶。
 *
 * 順序（對齊 CONTEXT「simStep 順序」雛形）：① prev←curr（內插基準，T3）；② 目標系統
 * （spawn/可見性/蓋 t_visible，**命中判定之前**，F5 seam / WP-5，WP-4）；③ 依時序消費本 tick
 * 輸入（`consume` 排序 + 排空，T4；鍵事件更新 held、fire 就地 raycast）；④ `MovementController.step`
 * 依 held 定 velocity（snap）並推進位置（**只用 dtSec**，WP-5 T3）；⑤ curr←新位置。
 *
 * `targetManager` 選填：注入即在 tick 內推進目標（WP-4）；省略則維持純位移（WP-2 決定性測試路徑）。
 * `camera` 選填：注入即在 fire 事件處理命中判定（WP-5 T1）；省略則 fire 為 no-op（決定性測試路徑）。
 * `movement` 預設共用 `defaultMovement`；`createSimLoop` 綁定自己的實例（WP-6 vStrafe config seam）。
 * `drillRunner` 選填（WP-6 / T4）：注入即由 runner 在 running 相位驅動目標（countdown/idle/ended
 * 不 spawn）——**取代**本函式直呼 `targetManager.tick`（避免雙重 tick）；省略則沿用 WP-4 直驅路徑。
 * 注意：fire→markKilled 仍走 `targetManager`（同一實例），故 `targetManager` 與 `drillRunner` 併傳。
 */
export function simStep(
  state: SharedState,
  dtSec: number,
  tickEndMs: number,
  targetManager?: TargetManager,
  camera?: THREE.Camera,
  movement: MovementController = defaultMovement,
  handle?: (ev: InputEvent) => void,
  drillRunner?: DrillRunner,
  recorder?: DataRecorder,
): void {
  state.prev.x = state.curr.x;
  state.prev.z = state.curr.z;

  // 目標 spawn/可見性/蓋 t_visible：在命中判定（WP-5 fire raycast）之前，且時間源為 sim tick
  // 的 `tickEndMs`（量測時鐘域，非 rAF/Date.now）——反應時間效度關鍵（README failure-mode）。
  // WP-6 / T4：有 drillRunner 則由其相位機驅動目標（running 才 spawn）；否則 WP-4 直驅（向後相容）。
  if (drillRunner !== undefined) drillRunner.tick(state, tickEndMs);
  else targetManager?.tick(state, tickEndMs);
  recordVisibleEvents(state, tickEndMs, recorder);

  // 半開窗 [tickStart, tickEndMs)、嚴格 `<`（GD-3）；handle 每個到期事件套用佔位狀態變更。
  // handle 由 createSimLoop **綁定一次**傳入(熱路徑零配置,GC 紀律 §4);直接呼叫(測試)走預設閉包。
  consume(state, tickEndMs, handle ?? ((ev) => applyInput(state, ev, camera, targetManager, recorder)));

  // MovementController：依 held 定 vx（M1 snap）並以固定 dtSec 推進 x（WP-5 T3，FR-5.3）。
  movement.step(state, dtSec);
  state.player.z += state.player.vz * dtSec; // z 軸階段 A 無前後移動（vz 恆 0）；沿用 WP-2 位移

  state.curr.x = state.player.x;
  state.curr.z = state.player.z;

  recorder?.recordTickFromState(tickEndMs, state);
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
  drillRunner?: DrillRunner,
  recorder?: DataRecorder,
): SimLoop {
  const tickSec = 1 / simHz;
  const tickMs = 1000 / simHz;
  let accSec = 0;
  let lastMs = clock.now();
  let simTimeMs = lastMs; // 邏輯 sim 時鐘（量測時鐘域 ms），每 tick 推進 tickMs；決定 tick 窗

  // 綁定一次的輸入 handle：閉包 over state/camera/targetManager，避免每 tick 配置新 arrow
  // （熱路徑零配置，GC 紀律 §4）。camera/targetManager 省略時 fire 不做 hit/firstShot gameplay 判定。
  const handleInput = (ev: InputEvent): void => applyInput(state, ev, camera, targetManager, recorder);

  // 綁定一次的 MovementController（WP-5 T3）：預設 vStrafe，WP-6 drill config 之後由此注入。
  const movement = createMovementController();

  return {
    pump(nowMs: number): { ticks: number; alpha: number } {
      accSec += Math.min((nowMs - lastMs) / 1000, 0.25); // 夾住避免 spiral of death
      lastMs = nowMs;

      let ticks = 0;
      while (accSec >= tickSec) {
        simTimeMs += tickMs;
        simStep(state, tickSec, simTimeMs, targetManager, camera, movement, handleInput, drillRunner, recorder);
        accSec -= tickSec;
        ticks++;
      }

      return { ticks, alpha: accSec / tickSec };
    },
  };
}
