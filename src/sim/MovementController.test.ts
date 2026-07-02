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

    // 先放開回靜止（避免觸發 T4 急停：移動中直接按反向鍵會判急停 → 見急停測試組），
    // 再從靜止按 A 測純 −v snap。
    s.held.right = false;
    mc.step(s, 1 / 128);
    expect(s.player.vx).toBe(0);

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

/**
 * 簡化 counter-strafe 急停 — WP-5 / T4（FR-5.4，OQ-5.1）單元測試
 *
 * 驗「反向鍵穿越 tick」立即歸零 + `stopped` flag：移動中按與移動方向相反的鍵 → 該 tick vx=0、
 * stopped=true（急停窗）；續按 → 次 tick 反向/過衝、stopped=false。純放開（非反向）不算急停。
 * `stopped` 為開火精準 gate 的來源（`accurate = stopped`）。
 */
describe('MovementController — 簡化急停（反向鍵立即停止 + stopped gate，T4）', () => {
  const dt = 1 / 128;

  it('移動中按反向鍵（釋放同向）→ 穿越 tick vx=0、stopped=true', () => {
    const mc = createMovementController();
    const s = createSharedState();

    s.held.right = true; // 向右移動
    mc.step(s, dt);
    expect(s.player.vx).toBe(250);
    expect(s.player.stopped).toBe(false);

    // 反向鍵：放開 D、按 A（與 +x 移動相反）→ 急停穿越 tick
    s.held.right = false;
    s.held.left = true;
    mc.step(s, dt);
    expect(s.player.vx).toBe(0);
    expect(s.player.stopped).toBe(true);
  });

  it('急停後續按反向鍵 → 次 tick 反向 −v、stopped=false（過衝）', () => {
    const mc = createMovementController();
    const s = createSharedState();

    s.held.right = true;
    mc.step(s, dt); // vx=+250
    s.held.right = false;
    s.held.left = true;
    mc.step(s, dt); // 急停：vx=0、stopped=true
    expect(s.player.stopped).toBe(true);

    mc.step(s, dt); // 仍按 A、prevVx=0 → 非急停 → 反向
    expect(s.player.vx).toBe(-250);
    expect(s.player.stopped).toBe(false);
  });

  it('A+D 同按（反向鍵壓下但同向仍持）→ 仍判急停 vx=0、stopped=true', () => {
    const mc = createMovementController();
    const s = createSharedState();

    s.held.right = true;
    mc.step(s, dt); // vx=+250
    s.held.left = true; // A+D 同按（net target=0，但反向鍵已壓 → 急停）
    mc.step(s, dt);
    expect(s.player.vx).toBe(0);
    expect(s.player.stopped).toBe(true);
  });

  it('向左移動時按 D（反向）→ 對稱急停 vx=0、stopped=true', () => {
    const mc = createMovementController();
    const s = createSharedState();

    s.held.left = true;
    mc.step(s, dt);
    expect(s.player.vx).toBe(-250);

    s.held.left = false;
    s.held.right = true;
    mc.step(s, dt);
    expect(s.player.vx).toBe(0);
    expect(s.player.stopped).toBe(true);
  });

  it('純放開（非反向）→ vx=0 但 stopped=false（放手不算急停）', () => {
    const mc = createMovementController();
    const s = createSharedState();

    s.held.right = true;
    mc.step(s, dt); // vx=+250
    s.held.right = false; // 只放開、未按反向鍵
    mc.step(s, dt);
    expect(s.player.vx).toBe(0);
    expect(s.player.stopped).toBe(false); // 非急停 → 開火 gate 不計精準
  });

  it('靜止起步（prevVx=0）按 A → 移動、非急停', () => {
    const mc = createMovementController();
    const s = createSharedState();

    s.held.left = true; // 靜止直接按 A（無反向可穿越）
    mc.step(s, dt);
    expect(s.player.vx).toBe(-250);
    expect(s.player.stopped).toBe(false);
  });
});
