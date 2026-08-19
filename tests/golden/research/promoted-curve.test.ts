import { readFileSync } from 'node:fs';
import type { ExportPayload } from '../../../src/data/export';
import {
  computeCurveMetrics,
  computePromotedMetrics,
  normalize101,
  type CurveAggregate,
  type NormalizedCurve,
} from '../../../src/metrics/researchMetrics';
import { deriveTrackingMetrics, deriveTrackingSamples } from '../../../src/metrics/trackingDerivation';
import { describe, expect, it } from 'vitest';

interface CurveGolden {
  version: 'curve-v1';
  source: string;
  peekCount: number;
  rowCount: number;
  unflaggedRows: number;
  flagCounts: Record<string, number>;
  aggregate: CurveAggregate;
}

const CURVE_FIXTURES = [
  'counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json',
  'counterstrafe_ad_v1-2026-08-07T09_24_18.148Z.json',
  'counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json',
  'synthetic_counterstrafe.json',
] as const;

describe('WP-32 T4 normalize101', () => {
  it('matches a known linear ramp and clamps to endpoint values like np.interp', () => {
    const t = [0, 50, 100];
    const values = [10, 60, 110];

    expect(normalize101(values, t, 25, 75, 3)).toEqual([35, 60, 85]);
    expect(normalize101(values, t, -50, 150, 5)).toEqual([10, 10, 60, 110, 110]);
  });

  it('drops non-finite samples before interpolation', () => {
    const curve = normalize101([0, Number.NaN, 50, Number.NaN, 100], [0, 25, 50, 75, 100], 0, 100, 5);

    expect(curve).toEqual([0, 25, 50, 75, 100]);
  });

  it('rejects degenerate inputs instead of guessing a curve', () => {
    expect(() => normalize101([1], [0], 0, 1)).toThrow(/at least two finite/);
    expect(() => normalize101([1, 2], [0, 1], 1, 1)).toThrow(/greater than t0/);
    expect(() => normalize101([1, 2], [0], 0, 1)).toThrow(/same shape/);
  });
});

describe('WP-32 T4 Python/TypeScript promoted curve-v1 parity', () => {
  for (const fixture of CURVE_FIXTURES) {
    it(`${fixture} curve aggregate matches Python golden point-by-point`, () => {
      const payload = loadJson<ExportPayload>(`../../../research/fixtures/exports/${fixture}`);
      const golden = loadCurve(fixture);
      const actual = computeCurveMetrics(payload);

      expect(golden.version).toBe('curve-v1');
      expect(golden.source).toBe(fixture);
      expect(actual.rows).toHaveLength(golden.rowCount);
      expect(actual.rows.filter((row) => row.flags.length === 0)).toHaveLength(golden.unflaggedRows);
      expect(actual.aggregate.flagCounts).toEqual(golden.flagCounts);
      expectCurveAggregateParity(actual.aggregate, golden.aggregate);
    });
  }

  it('keeps the pre-registered real fixture anti-vacuous counts', () => {
    for (const fixture of CURVE_FIXTURES.filter((name) => name.startsWith('counterstrafe_ad_v1-2026-08-07'))) {
      const golden = loadCurve(fixture);

      expect(golden.aggregate.omega.left.n).toBe(10);
      expect(golden.aggregate.omega.right.n).toBe(10);
      expect(golden.aggregate.epsilon.left.n).toBe(10);
      expect(golden.aggregate.epsilon.right.n).toBe(10);
      expect(golden.flagCounts).toEqual({});
    }
  });

  it('keeps the synthetic short-window fixture scorable at min_ticks=3', () => {
    const payload = loadJson<ExportPayload>('../../../research/fixtures/exports/synthetic_counterstrafe.json');
    const actual = computeCurveMetrics(payload);

    expect(actual.rows.some((row) => row.flags.includes('window_too_short'))).toBe(false);
    expect(actual.aggregate.omega.left.n + actual.aggregate.omega.right.n).toBeGreaterThan(0);
    expect(actual.aggregate.epsilon.left.n + actual.aggregate.epsilon.right.n).toBeGreaterThan(0);
  });

  it('flags a pathological two-tick first-shot window as too short', () => {
    const actual = computeCurveMetrics(twoTickPayload());

    expect(actual.rows).toHaveLength(2);
    expect(actual.rows[0].flags).toEqual(['window_too_short']);
    expect(actual.rows[1].flags).toEqual(['window_too_short']);
    expect(actual.aggregate.flagCounts).toEqual({ window_too_short: 2 });
  });

  it('reconstructs deriveTrackingMetrics epsilon summaries from the exported sample source', () => {
    const payload = loadJson<ExportPayload>(
      '../../../research/fixtures/exports/counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json',
    );
    const metrics = deriveTrackingMetrics(payload);
    const samples = deriveTrackingSamples(payload);

    expect(samples.presentations).toHaveLength(metrics.presentations.length);
    metrics.presentations.forEach((presentation, index) => {
      if (presentation.acquisitionFailure) return;
      const firstOnTarget = samples.presentations[index].samples.find((sample) => sample.onTarget);
      expect(firstOnTarget?.t).toBe(presentation.tFirstOnTargetMs);
      const windowSamples = samples.presentations[index].samples.filter((sample) => sample.t + 1e-9 >= firstOnTarget!.t);
      const epsilons = windowSamples.map((sample) => sample.epsilonDeg);

      expectRelativeParity(rms(epsilons), presentation.rmsEpsilonDeg!);
      expectRelativeParity(percentile(epsilons, 0.5), presentation.medianEpsilonDeg!);
      expectRelativeParity(percentile(epsilons, 0.95), presentation.p95EpsilonDeg!);
    });

    const researchMetricsSource = readFileSync(
      new URL('../../../src/metrics/researchMetrics.ts', import.meta.url),
      'utf8',
    );
    expect(researchMetricsSource).not.toMatch(/eyeOrigin\.ts/);
  });

  it('includes curve in the promoted metrics ok payload', () => {
    const payload = loadJson<ExportPayload>('../../../research/fixtures/exports/synthetic_counterstrafe.json');
    const promoted = computePromotedMetrics(payload);

    expect(promoted.status).toBe('ok');
    if (promoted.status === 'ok') expect(promoted.curve.version).toBe('curve-v1');
  });
});

function expectCurveAggregateParity(actual: CurveAggregate, expected: CurveAggregate): void {
  expect(actual.version).toBe(expected.version);
  expect(actual.flagCounts).toEqual(expected.flagCounts);
  expectNormalizedCurveParity(actual.omega.left, expected.omega.left);
  expectNormalizedCurveParity(actual.omega.right, expected.omega.right);
  expectNormalizedCurveParity(actual.epsilon.left, expected.epsilon.left);
  expectNormalizedCurveParity(actual.epsilon.right, expected.epsilon.right);
}

function expectNormalizedCurveParity(actual: NormalizedCurve, expected: NormalizedCurve): void {
  expect(actual.n).toBe(expected.n);
  expect(actual.mean).toHaveLength(101);
  expect(actual.lower).toHaveLength(101);
  expect(actual.upper).toHaveLength(101);
  actual.mean.forEach((value, index) => expectRelativeParity(value, expected.mean[index]));
  actual.lower.forEach((value, index) => expectRelativeParity(value, expected.lower[index]));
  actual.upper.forEach((value, index) => expectRelativeParity(value, expected.upper[index]));
}

function loadCurve(fixture: string): CurveGolden {
  const stem = fixture.replace(/\.json$/, '');
  return loadJson<CurveGolden>(`../../../research/fixtures/golden/curve-${stem}.json`);
}

function loadJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as T;
}

function expectRelativeParity(actual: number, expected: number): void {
  const absoluteError = Math.abs(actual - expected);
  if (expected === 0) {
    expect(absoluteError).toBeLessThanOrEqual(1e-12);
  } else {
    expect(absoluteError / Math.abs(expected)).toBeLessThanOrEqual(1e-9);
  }
}

function rms(values: readonly number[]): number {
  return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
}

function percentile(values: readonly number[], ratio: number): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const index = (sorted.length - 1) * ratio;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function twoTickPayload(): ExportPayload {
  return {
    meta: {
      schemaVersion: 2,
      drillId: 'counterstrafe_ad_v1',
      weaponId: 'ak47',
      weaponSeed: 223,
      rngSeed: 1,
      backend: 'webgl2',
      displayHz: 144,
      simHz: 128,
      browser: 'test-browser',
      sensitivity: 1,
      sensitivityModel: 'cs2-0.022deg',
      movementModel: 'cs2-source',
      crossOriginIsolated: true,
      startedAt: '2026-08-17T00:00:00.000Z',
      unit: 'source',
      vStrafe: 250,
      maxDrillSeconds: 300,
      lateEventCount: 0,
      bufferOverflow: false,
      recorderOverflow: false,
      suspect: false,
      simToWorld: 0.01,
      scene: { sceneId: 'test', assetPackVersion: 'test-v1', clutterTier: 'low', fallback: false, eye: { x: 0, y: 1.6, z: 0 } },
      mouseIntegration: { model: 'tick-window-integral', radPerCount: 0.001, hipStep: 0.001, adsStep: 0.001 },
    },
    events: [
      { type: 'visible', targetId: 'target-1', side: 'R', t: 0, targetX: 0, targetY: 1.6, targetZ: -10 },
      { type: 'fire', t: 1000 / 128, hit: false, firstShot: true, residualSpeed: 0, targetId: 'target-1' },
    ],
    ticks: [
      tick(0, 0),
      tick(1000 / 128, 0.001),
    ],
  };
}

function tick(t: number, dYaw: number): ExportPayload['ticks'][number] {
  return {
    t,
    vx: 0,
    vz: 0,
    px: 0,
    pz: 0,
    tx: 0,
    ty: 1.6,
    tz: -10,
    aim: { yaw: dYaw, pitch: 0 },
    dYaw,
    dPitch: 0,
    keys: [],
    ads: false,
  };
}
