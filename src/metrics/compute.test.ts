import { describe, expect, it } from 'vitest';
import type { DataRecorderSnapshot } from '../data/DataRecorder.ts';
import { buildIdealPath, compensationError, computeMetrics, stat } from './compute.ts';

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
    expect(metrics.residualSpeed.p50).toBe(0);
    expect(metrics.residualSpeed.sd).toBeCloseTo(108.253175, 6);

    expect(metrics.fireTimingAlignmentMs.values).toEqual([20, 10, 10]);
    expect(metrics.fireTimingAlignmentMs.mean).toBeCloseTo(13.333333, 6);

    expect(metrics.firstShotHitRate).toBeCloseTo(200 / 3, 6);

    expect(metrics.crosshairOffset.values).toEqual([0, 2, 1.5, 1]);
    expect(metrics.crosshairOffset.mean).toBe(1.125);
    expect(metrics.recoilCompensationError).toEqual({ meanDeg: 0, rmsDeg: 0 });
    expect(metrics.recoilCompensationPath).toEqual({ actual: [], ideal: [] });

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

  it('backfills projectile first-shot outcomes from hit events while keeping timing anchored to fire time', () => {
    const projectileSnapshot: DataRecorderSnapshot = {
      ticks: [],
      events: [
        { type: 'visible', targetId: 'a', side: 'L', t: 100 },
        { type: 'counter', key: 'D', t: 140 },
        { type: 'fire', targetId: 'a', t: 170, hit: false, firstShot: true, residualSpeed: 0, shotSeq: 11 },
        { type: 'hit', targetId: 'a', t: 195, timeOfFlightMs: 25, shotSeq: 11, part: 'body' },
        { type: 'visible', targetId: 'b', side: 'R', t: 230 },
        { type: 'counter', key: 'A', t: 260 },
        { type: 'fire', targetId: 'b', t: 310, hit: false, firstShot: true, residualSpeed: 0, shotSeq: 12 },
      ],
      recorderOverflow: false,
    };

    const metrics = computeMetrics(projectileSnapshot);

    expect(metrics.firstShotHitRate).toBe(50);
    expect(metrics.fireTimingAlignmentMs.values).toEqual([30, 50]);
    expect(metrics.switchTimeMs.values).toEqual([140]);
    expect(metrics.switchTimeMs.values).not.toContain(115);
  });

  it('returns n=0 stats and zero rates for empty samples', () => {
    const metrics = computeMetrics({ ticks: [], events: [], recorderOverflow: false });

    expect(metrics.counterReactionMs).toEqual({ mean: 0, p50: 0, sd: 0, n: 0, values: [] });
    expect(metrics.residualSpeed).toEqual({ mean: 0, p50: 0, sd: 0, n: 0, values: [] });
    expect(metrics.fireTimingAlignmentMs).toEqual({ mean: 0, p50: 0, sd: 0, n: 0, values: [] });
    expect(metrics.firstShotHitRate).toBe(0);
    expect(metrics.crosshairOffset).toEqual({ mean: 0, p50: 0, sd: 0, n: 0, values: [] });
    expect(metrics.recoilCompensationError).toEqual({ meanDeg: 0, rmsDeg: 0 });
    expect(metrics.recoilCompensationPath).toEqual({ actual: [], ideal: [] });
    expect(metrics.switchTimeMs).toEqual({ mean: 0, p50: 0, sd: 0, n: 0, values: [] });
    expect(metrics.rhythmStability).toBe(0);
    expect(metrics.leftRightSymmetry).toEqual({
      left: { mean: 0, p50: 0, sd: 0, n: 0, values: [] },
      right: { mean: 0, p50: 0, sd: 0, n: 0, values: [] },
      diff: 0,
    });
  });
});

describe('recoil compensation path metrics', () => {
  it('builds the ideal path as the -aimPunch x2 mirror and scores perfect compensation as zero', () => {
    const ideal = buildIdealPath([
      { aimPunchPitch: 0, aimPunchYaw: 0 },
      { aimPunchPitch: 0.5, aimPunchYaw: -0.25 },
      { aimPunchPitch: 1, aimPunchYaw: 0.5 },
    ]);

    expect(ideal).toEqual([
      { pitchDeg: 0, yawDeg: 0 },
      { pitchDeg: -1, yawDeg: 0.5 },
      { pitchDeg: -2, yawDeg: -1 },
    ]);
    expect(compensationError(ideal, ideal).meanDeg).toBeLessThan(1e-9);
    expect(compensationError(ideal, ideal).rmsDeg).toBeLessThan(1e-9);
  });

  it('scores zero compensation against the analytic ideal path magnitude', () => {
    const ideal = buildIdealPath([
      { aimPunchPitch: 0, aimPunchYaw: 0 },
      { aimPunchPitch: 0.5, aimPunchYaw: -0.25 },
      { aimPunchPitch: 1, aimPunchYaw: 0.5 },
    ]);
    const zeroAim = ideal.map(() => ({ pitchDeg: 0, yawDeg: 0 }));
    const expectedErrors = [0, Math.hypot(1, 0.5), Math.hypot(2, 1)];
    const error = compensationError(zeroAim, ideal);

    expect(error.meanDeg).toBeCloseTo(expectedErrors.reduce((sum, value) => sum + value, 0) / expectedErrors.length, 12);
    expect(error.rmsDeg).toBeCloseTo(
      Math.sqrt(expectedErrors.reduce((sum, value) => sum + value * value, 0) / expectedErrors.length),
      12,
    );
  });

  it('computes recoil compensation error from fire-time view and punch fields', () => {
    const basePitch = 0.12;
    const baseYaw = -2.9;
    const perfectSnapshot: DataRecorderSnapshot = {
      ticks: [],
      events: [
        {
          type: 'fire',
          t: 100,
          hit: false,
          firstShot: true,
          residualSpeed: 0,
          viewPitch: basePitch,
          viewYaw: baseYaw,
          aimPunchPitch: 0,
          aimPunchYaw: 0,
        },
        {
          type: 'fire',
          t: 200,
          hit: false,
          firstShot: false,
          residualSpeed: 0,
          viewPitch: basePitch + degToRad(-1),
          viewYaw: baseYaw + degToRad(0.5),
          aimPunchPitch: 0.5,
          aimPunchYaw: -0.25,
        },
        {
          type: 'fire',
          t: 300,
          hit: false,
          firstShot: false,
          residualSpeed: 0,
          viewPitch: basePitch + degToRad(-2),
          viewYaw: baseYaw + degToRad(-1),
          aimPunchPitch: 1,
          aimPunchYaw: 0.5,
        },
      ],
      recorderOverflow: false,
    };

    const metrics = computeMetrics(perfectSnapshot);
    expect(metrics.recoilCompensationError.meanDeg).toBeLessThan(1e-9);
    expect(metrics.recoilCompensationError.rmsDeg).toBeLessThan(1e-9);
    expect(metrics.recoilCompensationPath.ideal).toEqual([
      { pitchDeg: 0, yawDeg: 0 },
      { pitchDeg: -1, yawDeg: 0.5 },
      { pitchDeg: -2, yawDeg: -1 },
    ]);
    expect(metrics.recoilCompensationPath.actual).toHaveLength(3);
    expect(metrics.recoilCompensationPath.actual[0]).toEqual({ pitchDeg: 0, yawDeg: 0 });
    expect(metrics.recoilCompensationPath.actual[1].pitchDeg).toBeCloseTo(-1, 12);
    expect(metrics.recoilCompensationPath.actual[1].yawDeg).toBeCloseTo(0.5, 12);
    expect(metrics.recoilCompensationPath.actual[2].pitchDeg).toBeCloseTo(-2, 12);
    expect(metrics.recoilCompensationPath.actual[2].yawDeg).toBeCloseTo(-1, 12);
  });
});

describe('stat', () => {
  it('filters non-finite values and uses population sd', () => {
    expect(stat([1, 2, Number.NaN, Infinity, 3])).toEqual({
      mean: 2,
      p50: 2,
      sd: Math.sqrt(2 / 3),
      n: 3,
      values: [1, 2, 3],
    });
  });

  it('computes p50 from continuous distributions', () => {
    expect(stat([12, 4, 30, 20]).p50).toBe(16);
    expect(stat([12, 4, 30]).p50).toBe(12);
  });
});

function degToRad(value: number): number {
  return (value * Math.PI) / 180;
}
