import { describe, expect, it } from 'vitest';
import {
  canonicalMovingTargetFrames,
  EXPECTED_TICKS,
  movingTargetFrameSequences,
  runMovingTarget,
} from './movingTargetDeterminismFixture.ts';

/**
 * 移動目標跨 render FPS 決定性回歸（WP-18 / T5）★ M1 不變性擴到移動目標。
 *
 * canonical = 每幀恰一 tick 的 ground-truth 跑。針對每種 render FPS 幀切法斷言：整份記錄資料集
 * （逐 tick `tx/ty/tz` + fire 命中事件）與 canonical **bit-exact 相等** → 移動目標 `pos` 與 sub-tick
 * 命中序列皆與 render FPS 無關。既有 stage1/2 baseline 為 additive、不受本檔影響（不改既有 fixture）。
 */

const CANON = runMovingTarget(canonicalMovingTargetFrames());

describe('WP-18 T5 — 移動目標跨 FPS 決定性回歸（per-tick pos + sub-tick 命中序列）', () => {
  it('canonical 跑覆蓋 countdown→running + 移動目標 + sub-tick 命中（基準）', () => {
    // 相同總模擬時間 → 相同總 tick 數（與 FPS 無關）。
    expect(CANON.ticks).toBe(EXPECTED_TICKS);
    expect(CANON.phase).toBe('running');
    expect(CANON.snapshot.recorderOverflow).toBe(false);
    // 目標真的在移動：記錄期間出現多個相異 tx（非常數）。
    expect(CANON.distinctTx).toBeGreaterThan(1);
    // 兩個 presentation（首側 L、timed presentation 到期推進至對側 R）。
    expect(CANON.snapshot.events.filter((e) => e.type === 'visible').length).toBe(2);
    // held fire 打完整彈匣；sub-tick 命中內插對移動目標產生「命中/脫靶混合」序列（非全中/全失）。
    expect(CANON.fireCount).toBe(30);
    expect(CANON.hitCount).toBe(13);
    expect(CANON.hitCount).toBeGreaterThan(0);
    expect(CANON.hitCount).toBeLessThan(CANON.fireCount);
  });

  for (const [name, abs] of Object.entries(movingTargetFrameSequences)) {
    it(`${name}：DataRecorder 快照（逐 tick pos + fire 命中事件）與 canonical bit-exact 相等`, () => {
      const run = runMovingTarget(abs);
      expect(run.ticks).toBe(EXPECTED_TICKS);
      expect(run.phase).toBe(CANON.phase);
      // 逐 tick `tx/ty/tz`（移動目標位置）+ 事件序列（含 sub-tick 命中）逐欄深度相等。
      expect(run.snapshot).toEqual(CANON.snapshot);
    });
  }

  it('同輸入序列重播兩次 → 記錄資料集完全一致（無 Date.now / 無種子 Math.random 洩漏）', () => {
    const seq = movingTargetFrameSequences['抖動 144 Hz ±50%'];
    const a = runMovingTarget(seq);
    const b = runMovingTarget(seq);
    expect(a.snapshot).toEqual(b.snapshot);
  });
});
