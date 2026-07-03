import { describe, expect, it } from 'vitest';
import type { DataRecorderSnapshot } from '../data/DataRecorder.ts';
import { computeMetrics, stat } from './compute.ts';

const snapshot: DataRecorderSnapshot = {
  ticks: [],
  events: [
    { type: 'visible', targetId: 't0', side: 'R', t: 100 },
    { type: 'counter', key: 'A', t: 150 },
    { type: 'fire', targetId: 't0', t: 170, hit: true, firstShot: true, residualSpeed: 0, offsetDeg: 0 },
    { type: 'visible', targetId: 't1', side: 'L', t: 300 },
    { type: 'counter', key: 'D', t: 380 },
    { type: 'fire', targetId: 't1', t: 390, hit: false, firstShot: true, residualSpeed: 250, offsetDeg: 2 },
    { type: 'fire', targetId: 't1', t: 410, hit: true, firstShot: false, residualSpeed: 0, offsetDeg: 1.5 },
    { type: 'visible', targetId: 't2', side: 'R', t: 500 },
    { type: 'counter', key: 'A', t: 560 },
    { type: 'fire', targetId: 't2', t: 570, hit: true, firstShot: true, residualSpeed: 0, offsetDeg: 1 },
  ],
  recorderOverflow: false,
};

describe('computeMetrics', () => {
  it('computes the eight WP-8 metrics from recorder events', () => {
    const metrics = computeMetrics(snapshot);

    expect(metrics.counterReactionMs.values).toEqual([50, 80, 60]);
    expect(metrics.counterReactionMs.mean).toBeCloseTo(63.333333, 6);
    expect(metrics.counterReactionMs.sd).toBeCloseTo(12.472191, 6);

    expect(metrics.residualSpeed.values).toEqual([0, 250, 0, 0]);
    expect(metrics.residualSpeed.mean).toBe(62.5);

    expect(metrics.fireTimingAlignmentMs.values).toEqual([20, 10, 10]);
    expect(metrics.fireTimingAlignmentMs.mean).toBeCloseTo(13.333333, 6);

    expect(metrics.firstShotHitRate).toBeCloseTo(200 / 3, 6);

    expect(metrics.crosshairOffset.values).toEqual([0, 2, 1.5, 1]);
    expect(metrics.crosshairOffset.mean).toBe(1.125);

    // 切換時間 = 擊殺 → 對下一目標的首發 fire（有效對齊錨）：
    // kill t0@170 → t1 首發@390 = 220；kill t1@410(hit) → t2 首發@570 = 160。
    expect(metrics.switchTimeMs.values).toEqual([220, 160]);
    expect(metrics.switchTimeMs.mean).toBe(190);

    expect(metrics.rhythmStability).toBe(0);

    expect(metrics.leftRightSymmetry.left.values).toEqual([80]);
    expect(metrics.leftRightSymmetry.right.values).toEqual([50, 60]);
    expect(metrics.leftRightSymmetry.diff).toBe(25);
  });

  it('switch time anchors on next-target acquisition, not on target respawn', () => {
    // 立即補生（spawnDelayMs=0）：下一目標在擊殺後 ~1 tick 就 visible。
    // 若錨在 t_next_visible，switch time 會塌縮成引擎 respawn latency（此處 5ms）；
    // 正確錨是玩家對下一目標的首發 fire（此處 kill@200 → 首發@350 = 150）。
    const respawnSnapshot: DataRecorderSnapshot = {
      ticks: [],
      events: [
        { type: 'visible', targetId: 'a', side: 'L', t: 100 },
        { type: 'fire', targetId: 'a', t: 200, hit: true, firstShot: true, residualSpeed: 0, offsetDeg: 0 },
        { type: 'visible', targetId: 'b', side: 'R', t: 205 }, // 補生僅晚 5ms
        { type: 'fire', targetId: 'b', t: 350, hit: true, firstShot: true, residualSpeed: 0, offsetDeg: 0 },
      ],
      recorderOverflow: false,
    };

    const metrics = computeMetrics(respawnSnapshot);
    expect(metrics.switchTimeMs.values).toEqual([150]);
    expect(metrics.switchTimeMs.values).not.toContain(5);
  });

  it('returns n=0 stats and zero rates for empty samples', () => {
    const metrics = computeMetrics({ ticks: [], events: [], recorderOverflow: false });

    expect(metrics.counterReactionMs).toEqual({ mean: 0, sd: 0, n: 0, values: [] });
    expect(metrics.residualSpeed).toEqual({ mean: 0, sd: 0, n: 0, values: [] });
    expect(metrics.fireTimingAlignmentMs).toEqual({ mean: 0, sd: 0, n: 0, values: [] });
    expect(metrics.firstShotHitRate).toBe(0);
    expect(metrics.crosshairOffset).toEqual({ mean: 0, sd: 0, n: 0, values: [] });
    expect(metrics.switchTimeMs).toEqual({ mean: 0, sd: 0, n: 0, values: [] });
    expect(metrics.rhythmStability).toBe(0);
    expect(metrics.leftRightSymmetry).toEqual({
      left: { mean: 0, sd: 0, n: 0, values: [] },
      right: { mean: 0, sd: 0, n: 0, values: [] },
      diff: 0,
    });
  });
});

describe('stat', () => {
  it('filters non-finite values and uses population sd', () => {
    expect(stat([1, 2, Number.NaN, Infinity, 3])).toEqual({
      mean: 2,
      sd: Math.sqrt(2 / 3),
      n: 3,
      values: [1, 2, 3],
    });
  });
});
