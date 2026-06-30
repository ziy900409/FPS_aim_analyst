import type { SharedState } from '../state/SharedState.ts';
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
 * 消費落在本 tick 邏輯窗的輸入事件（`timeStamp < tickEndMs`），依序套用（佔位：A/D 切換 vx）。
 * 這是「輸入分桶」的最小機制（CONTEXT），也是決定性前提：事件落在哪個 tick 由 timeStamp 決定、
 * 與 render frame 邊界無關。
 *
 * 假設 `state.input` 已依 timeStamp 排序（T4 合成事件保證；WP-3 真 `InputSampler` 負責排序、
 * ring buffer 與遲到/溢位處理）。佔位用陣列前端 `splice`；WP-3 換 ring buffer 槽位重用。
 */
function consumeInput(state: SharedState, tickEndMs: number): void {
  const buf = state.input;
  let consumed = 0;
  while (consumed < buf.length && buf[consumed].t < tickEndMs) {
    const ev = buf[consumed];
    if (ev.type === 'key') {
      // 佔位 movement：A/D 橫移瞬間 snap velocity（CONTEXT MovementController 狀態機雛形；WP-5 換真 physics）。
      if (ev.code === 'KeyD') state.player.vx = ev.down ? PLACEHOLDER_STRAFE_SPEED : 0;
      else if (ev.code === 'KeyA') state.player.vx = ev.down ? -PLACEHOLDER_STRAFE_SPEED : 0;
    }
    // mouse / fire 事件在佔位階段忽略（→ WP-3 準心 / WP-5 raycast）。
    consumed++;
  }
  if (consumed > 0) buf.splice(0, consumed);
}

/**
 * 推進一個固定 tick（純函式邊界，OQ-2.4：只讀寫傳入 state、不讀 `performance.now()`、不碰 DOM；
 * 預留階段 B Worker 搬遷）。`tickEndMs` = 本 tick 邏輯窗結束時間（量測時鐘域 ms），供輸入分桶。
 *
 * 順序（對齊 CONTEXT「simStep 順序」雛形）：① prev←curr（內插基準，T3）；② 消費本 tick 輸入；
 * ③ 等速推進位置（**只用 dtSec**）；④ curr←新位置。
 */
export function simStep(state: SharedState, dtSec: number, tickEndMs: number): void {
  state.prev.x = state.curr.x;
  state.prev.z = state.curr.z;

  consumeInput(state, tickEndMs);

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
export function createSimLoop(state: SharedState, clock: Clock, simHz: number): SimLoop {
  const tickSec = 1 / simHz;
  const tickMs = 1000 / simHz;
  let accSec = 0;
  let lastMs = clock.now();
  let simTimeMs = lastMs; // 邏輯 sim 時鐘（量測時鐘域 ms），每 tick 推進 tickMs；決定 tick 窗

  return {
    pump(nowMs: number): { ticks: number; alpha: number } {
      accSec += Math.min((nowMs - lastMs) / 1000, 0.25); // 夾住避免 spiral of death
      lastMs = nowMs;

      let ticks = 0;
      while (accSec >= tickSec) {
        simTimeMs += tickMs;
        simStep(state, tickSec, simTimeMs);
        accSec -= tickSec;
        ticks++;
      }

      return { ticks, alpha: accSec / tickSec };
    },
  };
}
