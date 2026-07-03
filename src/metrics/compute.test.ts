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

    expect(metrics.switchTimeMs.values).toEqual([130, 90]);
    expect(metrics.switchTimeMs.mean).toBe(110);

    expect(metrics.rhythmStability).toBe(0);

    expect(metrics.leftRightSymmetry.left.values).toEqual([80]);
    expect(metrics.leftRightSymmetry.right.values).toEqual([50, 60]);
    expect(metrics.leftRightSymmetry.diff).toBe(25);
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
