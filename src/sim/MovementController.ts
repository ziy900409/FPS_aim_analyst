import type { SharedState } from '../state/SharedState.ts';

/**
 * MovementController — WP-14 / T1（FR-B11）
 *
 * A/D 橫移的**唯一**推進點：每 sim tick 依 `state.held`（A/D 按住狀態）用 Source-like
 * friction → accelerate 積分 velocity，再以固定 `dtSec` 推進位置。決定性根源（CLAUDE.md §4 / WP-2）：
 * **只**用傳入的固定 `dtSec`（sim tick），
 * 絕不碰 frame delta；同一輸入序列在不同 render FPS 下逐 tick 位移一致。
 *
 * `stopped` 是連續速度 gate 的相容欄位：每 tick 末 `|vx| < profile.accuracyThreshold` 時為 true。
 * 反向鍵不再瞬停，而是由 friction/accelerate 自然減速並穿越門檻。
 */
export interface MovementController {
  /** 推進一個固定 tick：先 friction 後 accelerate，再 `player.x += vx*dtSec`。 */
  step(state: SharedState, dtSec: number): void;
}

export interface MovementProfile {
  /** Ground friction coefficient. */
  friction: number;
  /** Ground accelerate coefficient. */
  accelerate: number;
  /** Minimum control speed used by friction while grounded. */
  stopSpeed: number;
  /** 1D strafe wishspeed cap, in Source units per second. */
  maxSpeed: number;
  /** `stopped` compatibility threshold, in Source units per second. */
  accuracyThreshold: number;
}

export const CS2_PROFILE: MovementProfile = {
  friction: 5.2,
  accelerate: 5.5,
  stopSpeed: 80,
  maxSpeed: 250,
  accuracyThreshold: 88,
};

/**
 * 建 Source-like 1D ground movement controller。新 movement model 透過 profile 注入；公開 step 介面不變。
 * 實例無內部狀態，可安全共用。
 */
export function createMovementController(profile: MovementProfile = CS2_PROFILE): MovementController {
  return {
    step(state: SharedState, dtSec: number): void {
      const { left, right } = state.held;
      let vx = state.player.vx;
      const speed = Math.abs(vx);

      if (speed < 0.1) {
        vx = 0;
      } else {
        const control = Math.max(speed, profile.stopSpeed);
        const drop = control * profile.friction * dtSec;
        vx *= Math.max(speed - drop, 0) / speed;
      }

      const wishdir = left === right ? 0 : right ? 1 : -1;
      if (wishdir !== 0) {
        const currentspeed = vx * wishdir;
        const addspeed = profile.maxSpeed - currentspeed;
        if (addspeed > 0) {
          const accelspeed = Math.min(profile.accelerate * profile.maxSpeed * dtSec, addspeed);
          vx += wishdir * accelspeed;
        }
      }

      state.player.vx = vx;
      state.player.stopped = Math.abs(vx) < profile.accuracyThreshold;
      state.player.x += state.player.vx * dtSec;
    },
  };
}
