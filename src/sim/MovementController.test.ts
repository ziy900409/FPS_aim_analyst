import { describe, expect, it } from 'vitest';
import { createSharedState } from '../state/SharedState.ts';
import { createMovementController } from './MovementController.ts';

/**
 * MovementController — WP-5 / T3（FR-5.3）單元測試
 *
 * 驗 M1 橫移狀態機：依 held(A/D) **瞬間 snap** velocity（無 accel）、以固定 `dtSec` 等速推進 x，
 * 且位移只由「總模擬時間」決定（與 tick 切分數 / render FPS 無關 → 決定性，CLAUDE.md §4）。
 */
describe('MovementController — A/D 橫移（M1 snap，固定步長）', () => {
  it('held D → +v_strafe、held A → −v_strafe（瞬間 snap，無 accel ramp）', () => {
    const mc = createMovementController();
    const s = createSharedState();

    s.held.right = true;
    mc.step(s, 1 / 128);
    expect(s.player.vx).toBe(250); // 首個 tick 即滿速（純階梯函數，無 ramp）

    s.held.right = false;
    s.held.left = true;
    mc.step(s, 1 / 128);
    expect(s.player.vx).toBe(-250);
  });

  it('皆放開 → vx=0；A+D 同按 → vx=0（互斥抵消）', () => {
    const mc = createMovementController();
    const s = createSharedState();

    // 先給個非零 vx，確認 step 會歸零（不殘留）。
    s.player.vx = 250;
    mc.step(s, 1 / 128);
    expect(s.player.vx).toBe(0); // 皆未按 → 0

    s.held.left = true;
    s.held.right = true;
    mc.step(s, 1 / 128);
    expect(s.player.vx).toBe(0); // 同按抵消 → 0
  });

  it('held D 一段時間 → x 線性增加（x = v·t）', () => {
    const mc = createMovementController();
    const s = createSharedState();
    s.held.right = true;
    const dt = 1 / 128;
    for (let i = 0; i < 128; i++) mc.step(s, dt); // 累積 1 秒
    expect(s.player.x).toBeCloseTo(250, 10); // 250 u/s × 1 s = 250 u
  });

  it('位移與 tick 切分無關：同總時間、不同步數 → 同 x（決定性核心，FR-5.3）', () => {
    const run = (nTicks: number): number => {
      const mc = createMovementController();
      const s = createSharedState();
      s.held.right = true;
      const dt = 1 / nTicks; // 總時間恆 = nTicks·dt = 1 s
      for (let i = 0; i < nTicks; i++) mc.step(s, dt);
      return s.player.x;
    };
    // 2 的冪步數 → dt 與乘積 float 精確，可 bit-exact 相等。
    expect(run(64)).toBe(run(128));
    expect(run(128)).toBe(run(256));
    expect(run(128)).toBe(250);
  });

  it('放開移動鍵 → vx 歸零、x 不再前進', () => {
    const mc = createMovementController();
    const s = createSharedState();
    const dt = 1 / 128;

    s.held.right = true;
    mc.step(s, dt);
    const xAfterMove = s.player.x;
    expect(xAfterMove).toBeGreaterThan(0);

    s.held.right = false;
    mc.step(s, dt);
    expect(s.player.vx).toBe(0);
    expect(s.player.x).toBe(xAfterMove); // 停止後 x 不變
  });

  it('vStrafe 可注入（WP-6 drill config seam）', () => {
    const mc = createMovementController({ vStrafe: 400 });
    const s = createSharedState();
    s.held.right = true;
    mc.step(s, 1 / 128);
    expect(s.player.vx).toBe(400);
  });
});
