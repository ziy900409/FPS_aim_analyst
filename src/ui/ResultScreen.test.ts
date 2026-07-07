import { describe, expect, it } from 'vitest';
import type { Metrics } from '../metrics/compute.ts';
import { createRecoilOverlayModel, createResultSummary, summarizeResidualSpeed } from './ResultScreen.ts';

const metrics: Metrics = {
  counterReactionMs: { mean: 63.33, p50: 60, sd: 12.47, n: 3, values: [50, 80, 60] },
  residualSpeed: { mean: 62.5, p50: 0, sd: 108.25, n: 4, values: [0, 250, 0, 0] },
  fireTimingAlignmentMs: { mean: 13.33, p50: 10, sd: 4.71, n: 3, values: [20, 10, 10] },
  firstShotHitRate: 66.666,
  crosshairOffset: { mean: 1.125, p50: 1.25, sd: 0.74, n: 4, values: [0, 2, 1.5, 1] },
  recoilCompensationError: { meanDeg: 0.42, rmsDeg: 0.55 },
  recoilCompensationPath: {
    actual: [
      { pitchDeg: 0, yawDeg: 0 },
      { pitchDeg: -0.8, yawDeg: 0.4 },
      { pitchDeg: -1.7, yawDeg: -0.6 },
    ],
    ideal: [
      { pitchDeg: 0, yawDeg: 0 },
      { pitchDeg: -1, yawDeg: 0.5 },
      { pitchDeg: -2, yawDeg: -1 },
    ],
  },
  switchTimeMs: { mean: 110, p50: 110, sd: 20, n: 2, values: [130, 90] },
  rhythmStability: 0.0834,
  leftRightSymmetry: {
    left: { mean: 80, p50: 80, sd: 0, n: 1, values: [80] },
    right: { mean: 55, p50: 55, sd: 5, n: 2, values: [50, 60] },
    diff: 25,
  },
};

describe('createResultSummary', () => {
  it('maps the eight WP-8 metrics to result cards and reaction distribution values', () => {
    const summary = createResultSummary(metrics);

    expect(summary.cards.map((card) => card.id)).toEqual([
      'counterReactionMs',
      'residualSpeed',
      'fireTimingAlignmentMs',
      'firstShotHitRate',
      'crosshairOffset',
      'switchTimeMs',
      'rhythmStability',
      'leftRightSymmetry',
    ]);
    expect(summary.reactionValues).toEqual([50, 80, 60]);
    expect(summary.recoilCompensation).toEqual({
      error: { meanDeg: 0.42, rmsDeg: 0.55 },
      path: metrics.recoilCompensationPath,
    });
    expect(summary.cards.find((card) => card.id === 'residualSpeed')?.title).toBe('Residual speed / overshoot');
    expect(summary.cards.find((card) => card.id === 'residualSpeed')?.value).toBe('62.5 u/s');
    expect(summary.cards.find((card) => card.id === 'residualSpeed')?.detail).toBe(
      'p50 0.0 u/s · SD 108.3 u/s · n=4 · 3/4 under 88 u/s gate',
    );
    expect(summary.cards.find((card) => card.id === 'firstShotHitRate')?.value).toBe('66.7%');
    expect(summary.cards.find((card) => card.id === 'leftRightSymmetry')?.value).toBe('25 ms');
    expect(summary.methodNote).toContain('Subject-relative');
  });

  it('keeps empty samples display-safe', () => {
    const empty = createResultSummary({
      ...metrics,
      counterReactionMs: { mean: 0, p50: 0, sd: 0, n: 0, values: [] },
      residualSpeed: { mean: 0, p50: 0, sd: 0, n: 0, values: [] },
      leftRightSymmetry: {
        left: { mean: 0, p50: 0, sd: 0, n: 0, values: [] },
        right: { mean: 0, p50: 0, sd: 0, n: 0, values: [] },
        diff: 0,
      },
    });

    expect(empty.cards.find((card) => card.id === 'counterReactionMs')?.value).toBe('N/A');
    expect(empty.cards.find((card) => card.id === 'residualSpeed')?.value).toBe('N/A');
    expect(empty.cards.find((card) => card.id === 'leftRightSymmetry')?.value).toBe('N/A');
  });
});

describe('createRecoilOverlayModel', () => {
  it('creates a stable recoil path overlay model with actual and ideal series plus mean and RMS', () => {
    const summary = createResultSummary({
      ...metrics,
      recoilCompensationError: { meanDeg: 0.3333, rmsDeg: 0.4444 },
      recoilCompensationPath: buildSyntheticPath(10),
    });
    const model = createRecoilOverlayModel(summary.recoilCompensation);

    expect(model?.meanText).toBe('0.33 deg');
    expect(model?.rmsText).toBe('0.44 deg');
    expect(model?.actual).toHaveLength(10);
    expect(model?.ideal).toHaveLength(10);
    expect(formatPointList(model?.ideal ?? [])).toMatchInlineSnapshot(
      `"311.143,158 278.571,142.444 408.857,126.889 213.429,111.333 506.571,95.778 148.286,80.222 604.286,64.667 83.143,49.111 702,33.556 18,18"`,
    );
  });

  it('hides the recoil path block when there are no fire path samples', () => {
    const summary = createResultSummary({
      ...metrics,
      recoilCompensationPath: { actual: [], ideal: [] },
    });

    expect(createRecoilOverlayModel(summary.recoilCompensation)).toBeUndefined();
  });

  it('keeps a single fire renderable as point markers without path lines', () => {
    const summary = createResultSummary({
      ...metrics,
      recoilCompensationPath: {
        actual: [{ pitchDeg: 0, yawDeg: 0 }],
        ideal: [{ pitchDeg: 0, yawDeg: 0 }],
      },
    });
    const model = createRecoilOverlayModel(summary.recoilCompensation);

    expect(model?.actual).toHaveLength(1);
    expect(model?.ideal).toHaveLength(1);
    expect(model?.actual[0]).toEqual({ x: 18, y: 18 });
    expect(model?.ideal[0]).toEqual({ x: 18, y: 18 });
  });
});

describe('summarizeResidualSpeed', () => {
  it('keeps the velocity gate as detail derived from continuous u/s samples', () => {
    expect(summarizeResidualSpeed(metrics.residualSpeed)).toMatchObject({
      detail: 'p50 0.0 u/s · SD 108.3 u/s · n=4 · 3/4 under 88 u/s gate',
      withinGate: 3,
      overGate: 1,
    });
  });
});

function buildSyntheticPath(count: number): Metrics['recoilCompensationPath'] {
  const actual = [];
  const ideal = [];
  for (let i = 0; i < count; i++) {
    actual.push({ pitchDeg: -i * 0.9, yawDeg: i % 2 === 0 ? i * 0.16 : -i * 0.11 });
    ideal.push({ pitchDeg: -i, yawDeg: i % 2 === 0 ? i * 0.18 : -i * 0.12 });
  }
  return { actual, ideal };
}

function formatPointList(points: readonly { x: number; y: number }[]): string {
  return points.map((point) => `${formatNumber(point.x)},${formatNumber(point.y)}`).join(' ');
}

function formatNumber(value: number): string {
  return value.toFixed(3).replace(/\.?0+$/, '');
}
