import type { SharedState } from '../state/SharedState.ts';

/**
 * MovementController — WP-5 / T3（FR-5.3）
 *
 * A/D 橫移的**唯一**推進點：每 sim tick 依 `state.held`（A/D 按住狀態）定 velocity 並以固定
 * `dtSec` 推進位置。決定性根源（CLAUDE.md §4 / WP-2）：**只**用傳入的固定 `dtSec`（sim tick），
 * 絕不碰 frame delta；同一輸入序列在不同 render FPS 下逐 tick 位移一致。
 *
 * 階段 A = M1 狀態機（CONTEXT `MovementController`）：橫移為**瞬間 snap**（按 A/D → velocity 瞬間
 * ±`vStrafe`、放開 → 0；無 accel ramp，velocity 為純階梯函數）。**急停 flag（stopped）與精準 gate 屬
 * T4**，本 controller 尚不處理反向鍵語意。
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
      // 瞬間 snap（無 accel）：僅 D → +v、僅 A → −v；皆按或皆放 → 0（互斥抵消）。
      // 反向鍵急停（穿越 tick snap 0 + stopped）留 T4，本 task 只有純橫移。
      const { left, right } = state.held;
      state.player.vx = left === right ? 0 : right ? vStrafe : -vStrafe;
      state.player.x += state.player.vx * dtSec;
    },
  };
}
