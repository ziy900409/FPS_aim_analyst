import type { SharedState } from '../state/SharedState.ts';

/**
 * MovementController — WP-5 / T3（FR-5.3）
 *
 * A/D 橫移的**唯一**推進點：每 sim tick 依 `state.held`（A/D 按住狀態）定 velocity 並以固定
 * `dtSec` 推進位置。決定性根源（CLAUDE.md §4 / WP-2）：**只**用傳入的固定 `dtSec`（sim tick），
 * 絕不碰 frame delta；同一輸入序列在不同 render FPS 下逐 tick 位移一致。
 *
 * 階段 A = M1 狀態機（CONTEXT `MovementController`）：橫移為**瞬間 snap**（按 A/D → velocity 瞬間
 * ±`vStrafe`、放開 → 0；無 accel ramp，velocity 為純階梯函數）。
 *
 * 簡化 counter-strafe 急停（WP-5 / T4，FR-5.4，OQ-5.1/5.2）：**反向鍵**（與當前移動方向相反者）
 * 於**穿越那一 tick** 觸發立即歸零——`vx→0` 且 `player.stopped=true`。續按反向鍵 → 次 tick 因 `prevVx`
 * 已為 0（非移動中）不再判急停 → `vx=∓vStrafe`（反向/過衝）、`stopped=false`。**單純放開**（target=0
 * 但非反向）不算急停（`stopped=false`）——急停是「按反向鍵」的技巧，非「放手」。開火精準 gate 讀
 * `stopped`（OQ-5.1）。此為抽象欄位，階段 B friction integrator 改以 v<門檻 寫入（附錄 D，介面不變）。
 *
 * 介面跨階段不變（README §2 / 附錄 D）：公開點只有 `step`；階段 B 把內部換成 friction + acceleration
 * integrator（讀同樣的 `state.held`、寫同樣的 `state.player.vx/x`），此介面與呼叫端不動。
 */
export interface MovementController {
  /** 推進一個固定 tick：依 `state.held` 定 `player.vx`（snap），再 `player.x += vx*dtSec`。 */
  step(state: SharedState, dtSec: number): void;
}

/** 預設橫移速度（u/s，source unit；OQ-5.2 grill 定 ~250）。 */
const DEFAULT_V_STRAFE = 250;

/**
 * 建 M1 橫移 controller。`vStrafe` 可注入（WP-6 drill config 之後接管），預設 ~250 u/s。
 * 階段 A 無內部狀態（velocity 純由 `state.held` 決定），故實例可安全共用。
 */
export function createMovementController(opts?: { vStrafe?: number }): MovementController {
  const vStrafe = opts?.vStrafe ?? DEFAULT_V_STRAFE;
  return {
    step(state: SharedState, dtSec: number): void {
      const { left, right } = state.held;
      const prevVx = state.player.vx; // 上一 tick 末的 velocity = 「當前移動方向」判定源

      // 反向鍵急停：移動中（prevVx≠0）且**與移動方向相反**的鍵此刻按住 → 穿越 tick 立即歸零。
      // 用 held（非 target）判定，故「A+D 同按」（net target=0）仍算急停（反向鍵已壓）。
      const counterStrafe = (prevVx > 0 && left) || (prevVx < 0 && right);
      if (counterStrafe) {
        state.player.vx = 0;
        state.player.stopped = true; // 急停窗（一 tick）：開火精準 gate 讀此（OQ-5.1）
      } else {
        // 瞬間 snap（無 accel）：僅 D → +v、僅 A → −v；皆按或皆放 → 0（互斥抵消）。
        state.player.vx = left === right ? 0 : right ? vStrafe : -vStrafe;
        state.player.stopped = false; // 移動 / 純放開皆非急停
      }
      state.player.x += state.player.vx * dtSec;
    },
  };
}
