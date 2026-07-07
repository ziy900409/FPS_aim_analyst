import { describe, expect, it } from 'vitest';
import { createSharedState } from '../state/SharedState.ts';
import { CS2_PROFILE, createMovementController, type MovementProfile } from './MovementController.ts';

/**
 * MovementController — WP-14 / T1（FR-B11）
 *
 * 驗 Source-like 1D ground movement：每 tick 先 friction 後 accelerate，公開 `step(state, dtSec)`
 * 介面不變。數值對照取自 T1 指定公式與 `CS2_PROFILE`。
 */
describe('MovementController — Source friction/accelerate integrator', () => {
  const dt = 1 / 128;

  it('held D 起步為加速 ramp，不再首 tick snap 到滿速', () => {
    const mc = createMovementController();
    const s = createSharedState();

    s.held.right = true;
    mc.step(s, dt);
    expect(s.player.vx).toBeCloseTo(10.7421875, 12);
    expect(s.player.vx).toBeLessThan(CS2_PROFILE.maxSpeed);
    expect(s.player.stopped).toBe(true);

    mc.step(s, dt);
    expect(s.player.vx).toBeCloseTo(18.234375, 12);
    expect(s.player.stopped).toBe(true);
  });

  it('held D 約一秒後收斂到 maxSpeed，位移為加速曲線積分', () => {
    const mc = createMovementController();
    const s = createSharedState();

    s.held.right = true;
    for (let i = 0; i < 128; i++) mc.step(s, dt);

    expect(s.player.vx).toBe(CS2_PROFILE.maxSpeed);
    expect(s.player.x).toBeCloseTo(209.1774976441331, 12);
  });

  it('A/D 方向對稱，A+D 同按只套 friction 不套 accelerate', () => {
    const mc = createMovementController();
    const s = createSharedState();

    s.held.left = true;
    mc.step(s, dt);
    expect(s.player.vx).toBeCloseTo(-10.7421875, 12);

    s.player.vx = CS2_PROFILE.maxSpeed;
    s.held.left = true;
    s.held.right = true;
    mc.step(s, dt);
    expect(s.player.vx).toBeCloseTo(239.84375, 12);
  });

  it('放開移動鍵後自然 friction 減速，穿越 accuracyThreshold 才 stopped=true', () => {
    const mc = createMovementController();
    const s = createSharedState();

    s.player.vx = CS2_PROFILE.maxSpeed;
    mc.step(s, dt);
    expect(s.player.vx).toBeCloseTo(239.84375, 12);
    expect(s.player.stopped).toBe(false);

    for (let i = 1; i < 30; i++) mc.step(s, dt);
    expect(s.player.vx).toBeCloseTo(71.77356764836614, 12);
    expect(s.player.stopped).toBe(true);
  });

  it('反向鍵不再瞬停：maxSpeed 反向加速第 10 tick 穿越 accuracyThreshold', () => {
    const mc = createMovementController();
    const s = createSharedState();

    s.player.vx = CS2_PROFILE.maxSpeed;
    s.held.left = true;

    for (let i = 0; i < 9; i++) mc.step(s, dt);
    expect(s.player.vx).toBeGreaterThan(CS2_PROFILE.accuracyThreshold);
    expect(s.player.stopped).toBe(false);

    mc.step(s, dt);
    expect(s.player.vx).toBeCloseTo(75.36208856156556, 12);
    expect(s.player.stopped).toBe(true);
  });

  it('MovementProfile 可注入，profile.maxSpeed 作為 wishspeed cap', () => {
    const profile: MovementProfile = { ...CS2_PROFILE, maxSpeed: 400 };
    const mc = createMovementController(profile);
    const s = createSharedState();

    s.held.right = true;
    mc.step(s, dt);
    expect(s.player.vx).toBeCloseTo(profile.accelerate * profile.maxSpeed * dt, 12);
  });
});

describe('MovementController — fixed-step determinism contract', () => {
  it('同一 tick 序列在不同 render FPS 切分下仍由固定 dtSec 決定', () => {
    const runBatches = (batches: number[]): { x: number; vx: number } => {
      const mc = createMovementController();
      const s = createSharedState();
      s.held.right = true;
      for (const batch of batches) {
        for (let i = 0; i < batch; i++) mc.step(s, 1 / 128);
      }
      return { x: s.player.x, vx: s.player.vx };
    };

    expect(runBatches(Array.from({ length: 64 }, () => 1))).toEqual(runBatches(Array.from({ length: 32 }, () => 2)));
  });
});
