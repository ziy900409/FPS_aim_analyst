import { readFileSync } from 'node:fs';
import type { ExportPayload } from '../../../src/data/export';
import {
  computePhaseMetrics,
  computeSyncMetrics,
  type PhaseAggregate,
  type PhaseSample,
  type PrecisionVerdict,
  type PromotedStat,
  type SyncAggregate,
  type SyncRow,
} from '../../../src/metrics/researchMetrics';
import { describe, expect, it } from 'vitest';

interface PhaseGolden {
  version: 'phase-v1';
  segmentVersion: 'seg-v2';
  source: string;
  filterDegeneratePolicy: 'excluded-from-ts-flags';
  peekCount: number;
  nonDegenerateCount: number;
  samples: GoldenPhaseSample[];
  aggregate: PhaseAggregate;
}

interface SyncGolden {
  version: 'sync-v1';
  source: string;
  peekCount: number;
  unflaggedCount: number;
  rows: GoldenSyncRow[];
  aggregate: SyncAggregate;
}

type GoldenPhaseSample = NullableNumbers<PhaseSample> & { pythonFlags: string[] };
type GoldenSyncRow = NullableNumbers<SyncRow>;

const PHASE_FIXTURES = [
  'counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json',
  'counterstrafe_ad_v1-2026-08-07T09_24_18.148Z.json',
  'counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json',
  'synthetic_counterstrafe_t1_long.json',
] as const;

const SYNC_FIXTURES = [
  ...PHASE_FIXTURES,
  'counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json',
  'counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json',
] as const;

describe('WP-32 T3 Python/TypeScript promoted phase-v1 and sync-v1 parity', () => {
  for (const fixture of PHASE_FIXTURES) {
    it(`${fixture} phase samples and aggregate match Python golden`, () => {
      const payload = loadJson<ExportPayload>(`../../../research/fixtures/exports/${fixture}`);
      const golden = loadPhase(fixture);
      const actual = computePhaseMetrics(payload);

      expect(golden.version).toBe('phase-v1');
      expect(golden.segmentVersion).toBe('seg-v2');
      expect(golden.source).toBe(fixture);
      expect(golden.filterDegeneratePolicy).toBe('excluded-from-ts-flags');
      expect(actual.samples).toHaveLength(golden.peekCount);
      expect(actual.samples).toHaveLength(golden.samples.length);
      expect(actual.samples.filter((sample) => sample.flags.length === 0)).toHaveLength(golden.nonDegenerateCount);
      actual.samples.forEach((sample, index) => expectPhaseSampleParity(sample, golden.samples[index]));
      expectPhaseAggregateParity(actual.aggregate, golden.aggregate);
    });
  }

  it('has the pre-registered pooled real phase non-degenerate count of 59', () => {
    const pooled = PHASE_FIXTURES.filter((fixture) => fixture.startsWith('counterstrafe_ad_v1-2026-08-07')).reduce(
      (total, fixture) => total + loadPhase(fixture).nonDegenerateCount,
      0,
    );

    expect(pooled).toBe(59);
  });

  for (const fixture of SYNC_FIXTURES) {
    it(`${fixture} sync rows, aggregate, and precision verdicts match Python golden`, () => {
      const payload = loadJson<ExportPayload>(`../../../research/fixtures/exports/${fixture}`);
      const golden = loadSync(fixture);
      const actual = computeSyncMetrics(payload);

      expect(golden.version).toBe('sync-v1');
      expect(golden.source).toBe(fixture);
      expect(actual.rows).toHaveLength(golden.peekCount);
      expect(actual.rows).toHaveLength(golden.rows.length);
      expect(actual.rows.filter((row) => row.flags.length === 0)).toHaveLength(golden.unflaggedCount);
      actual.rows.forEach((row, index) => expectSyncRowParity(row, golden.rows[index]));
      expectSyncAggregateParity(actual.aggregate, golden.aggregate);
    });
  }

  it('keeps the 09:39 sync anti-vacuous count and 08:03 zero-input boundary', () => {
    expect(loadSync('counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json').unflaggedCount).toBe(13);
    const zeroInput = loadSync('counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json');

    expect(zeroInput.aggregate.releaseToFireMs.n).toBe(0);
    expect(zeroInput.aggregate.verdicts[0].verdict).toBe('blocked-by-data');
  });
});

function expectPhaseSampleParity(actual: PhaseSample, expected: GoldenPhaseSample): void {
  expect(actual.peekIndex).toBe(expected.peekIndex);
  expect(actual.side).toBe(expected.side);
  expectNullableParity(actual.tOnset, expected.tOnset);
  expectNullableParity(actual.tMrEnd, expected.tMrEnd);
  expectNullableParity(actual.tAnchor, expected.tAnchor);
  expectNullableParity(actual.recMs, expected.recMs);
  expectNullableParity(actual.mrMs, expected.mrMs);
  expectNullableParity(actual.vMs, expected.vMs);
  expectNullableParity(actual.peakOmegaDegPerSec, expected.peakOmegaDegPerSec);
  expectNullableParity(actual.tDetect, expected.tDetect);
  expectNullableParity(actual.recMinusDetectMs, expected.recMinusDetectMs);
  expect(actual.flags).toEqual(expected.flags);
  expect(expected.pythonFlags.filter((flag) => flag !== 'filter_degenerate')).toEqual(expected.flags);
}

function expectSyncRowParity(actual: SyncRow, expected: GoldenSyncRow): void {
  expect(actual.peekIndex).toBe(expected.peekIndex);
  expectNullableParity(actual.releaseToFireMs, expected.releaseToFireMs);
  expectNullableParity(actual.counterHoldMs, expected.counterHoldMs);
  expectNullableParity(actual.counterToFireMs, expected.counterToFireMs);
  expect(actual.side).toBe(expected.side);
  expect(actual.ads ?? null).toBe(expected.ads);
  expect(actual.weaponMode).toBe(expected.weaponMode);
  expect(actual.flags).toEqual(expected.flags);
}

function expectPhaseAggregateParity(actual: PhaseAggregate, expected: PhaseAggregate): void {
  expect(actual.version).toBe(expected.version);
  expectStatParity(actual.recMs, expected.recMs);
  expectStatParity(actual.mrMs, expected.mrMs);
  expectStatParity(actual.vMs, expected.vMs);
  expectStatParity(actual.peakOmegaDegPerSec, expected.peakOmegaDegPerSec);
  expect(actual.flagCounts).toEqual(expected.flagCounts);
}

function expectSyncAggregateParity(actual: SyncAggregate, expected: SyncAggregate): void {
  expect(actual.version).toBe(expected.version);
  expectStatParity(actual.releaseToFireMs, expected.releaseToFireMs);
  expectStatParity(actual.counterHoldMs, expected.counterHoldMs);
  expectStatParity(actual.counterToFireMs, expected.counterToFireMs);
  expect(actual.flagCounts).toEqual(expected.flagCounts);
  expect(actual.verdicts).toHaveLength(expected.verdicts.length);
  actual.verdicts.forEach((verdict, index) => expectVerdictParity(verdict, expected.verdicts[index]));
}

function expectVerdictParity(actual: PrecisionVerdict, expected: PrecisionVerdict): void {
  expect(actual.metric).toBe(expected.metric);
  expect(actual.n).toBe(expected.n);
  expectNullableParity(actual.sampleSdMs, expected.sampleSdMs ?? null);
  expectRelativeParity(actual.quantizationSdMs, expected.quantizationSdMs);
  expect(actual.verdict).toBe(expected.verdict);
  expect(actual.reason).toBe(expected.reason);
}

function expectStatParity(actual: PromotedStat, expected: PromotedStat): void {
  expectRelativeParity(actual.mean, expected.mean);
  expectRelativeParity(actual.p50, expected.p50);
  expectRelativeParity(actual.sd, expected.sd);
  expect(actual.n).toBe(expected.n);
}

function loadPhase(fixture: string): PhaseGolden {
  const stem = fixture.replace(/\.json$/, '');
  return loadJson<PhaseGolden>(`../../../research/fixtures/golden/phase-${stem}.json`);
}

function loadSync(fixture: string): SyncGolden {
  const stem = fixture.replace(/\.json$/, '');
  return loadJson<SyncGolden>(`../../../research/fixtures/golden/sync-${stem}.json`);
}

function loadJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as T;
}

function expectNullableParity(actual: number | undefined, expected: number | null | undefined): void {
  if (expected === null || expected === undefined) {
    expect(actual).toBeUndefined();
    return;
  }
  expect(actual).toBeDefined();
  expectRelativeParity(actual, expected);
}

function expectRelativeParity(actual: number | undefined, expected: number): void {
  expect(actual).toBeDefined();
  const value = actual as number;
  const absoluteError = Math.abs(value - expected);
  if (expected === 0) {
    expect(absoluteError).toBeLessThanOrEqual(1e-12);
  } else {
    expect(absoluteError / Math.abs(expected)).toBeLessThanOrEqual(1e-9);
  }
}

type NullableNumbers<T> = {
  [K in keyof T]: T[K] extends number | undefined ? number | null : T[K];
};
