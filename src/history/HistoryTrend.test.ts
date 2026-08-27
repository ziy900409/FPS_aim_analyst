import { describe, expect, it } from 'vitest';
import type { CompatibilityKey, QualityGateStatus } from '../metrics/compatibilityKey.ts';
import { buildHistoryTrend } from './HistoryTrend.ts';
import type { DrillMetricRegistration, HistoryProjectionResult, MetricObservation } from './DrillMetricRegistry.ts';
import type { HistoryRunProjection, HistoryRunSummary } from './contracts.ts';

const PRIMARY_METRIC = 'spider-v2.peripheral-hits-per-minute';
const SECONDARY_METRIC = 'spider-v2.peripheral-first-shot-hit-rate';

const REGISTRATION: DrillMetricRegistration = {
  drillId: 'spider-shot-v2',
  version: '1.0.0',
  descriptors: [
    { id: PRIMARY_METRIC, label: 'hits/min', unit: 'hits/min', direction: 'higher-is-better', primary: true, format: 'decimal-1' },
    { id: SECONDARY_METRIC, label: 'first shot', unit: '%', direction: 'higher-is-better', primary: false, format: 'percent' },
  ],
  project: () => [],
};

function makeKey(overrides: Partial<CompatibilityKey> = {}): CompatibilityKey {
  return {
    participantId: 'P-1',
    taskId: 'spider-shot-v2',
    protocolVersion: '1.0.0',
    gameMovementProfile: 'cs2-source',
    weaponId: 'ak47',
    weaponMode: 'ak47',
    sensitivityFovKey: 'sensitivity=1;fovDeg=90',
    targetConditionCell: 'spider-v2:radius=10-25deg;width=2deg;grid=4x3;timeout=1750ms;duration=60s;shape=sphere',
    assessmentFeedbackPolicy: 'minimal-end-of-block',
    qualityGateStatus: 'ok',
    ...overrides,
  };
}

function makeRun(runId: string, startedAt: string): HistoryRunSummary {
  return {
    runId,
    participantId: 'P-1',
    drillId: 'spider-shot-v2',
    startedAt,
    schemaVersion: 2,
    suspect: false,
    byteLength: 1000,
    replaySupport: 'unchecked',
  };
}

function makeReadyProjection(
  runId: string,
  startedAt: string,
  observations: readonly MetricObservation[],
  keyOverrides: Partial<Omit<CompatibilityKey, 'qualityGateStatus'>> & { qualityGateStatus?: QualityGateStatus } = {},
): HistoryRunProjection {
  const qualityGateStatus = keyOverrides.qualityGateStatus ?? 'ok';
  const key = makeKey({ ...keyOverrides, qualityGateStatus });
  const projection: HistoryProjectionResult = {
    status: 'ready',
    compatibilityKey: key,
    qualityGateStatus,
    observations,
  };
  return { run: makeRun(runId, startedAt), projection };
}

function obs(value: number, metricId = PRIMARY_METRIC, unit = 'hits/min'): MetricObservation {
  return { metricId, unit, value };
}

describe('buildHistoryTrend', () => {
  it('returns empty/unregistered-drill when no registration is given', () => {
    const result = buildHistoryTrend({ projections: [], registration: undefined });
    expect(result).toEqual({ status: 'empty', reason: 'unregistered-drill' });
  });

  it('returns empty/insufficient-data when nothing is ready', () => {
    const result = buildHistoryTrend({
      projections: [{ run: makeRun('r1', '2026-08-10T00:00:00.000Z'), projection: { status: 'invalid-metric', reasonCode: 'x' } }],
      registration: REGISTRATION,
    });
    expect(result).toEqual({ status: 'empty', reason: 'insufficient-data' });
  });

  it('excludes non-ok quality runs from the trend without inventing a second cohort for them', () => {
    const ok = makeReadyProjection('r1', '2026-08-10T00:00:00.000Z', [obs(100)]);
    const suspect = makeReadyProjection('r2', '2026-08-11T00:00:00.000Z', [obs(200)], { qualityGateStatus: 'suspect-run' });
    const result = buildHistoryTrend({ projections: [ok, suspect], registration: REGISTRATION });
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.points).toHaveLength(1);
    expect(result.points[0].runId).toBe('r1');
    expect(result.excludedCounts['quality-gate']).toBe(1);
  });

  it('defaults to the primary descriptor, oldest-to-newest points, and per-point deltas', () => {
    const a = makeReadyProjection('r1', '2026-08-10T00:00:00.000Z', [obs(100)]);
    const b = makeReadyProjection('r2', '2026-08-12T00:00:00.000Z', [obs(130)]);
    const c = makeReadyProjection('r3', '2026-08-11T00:00:00.000Z', [obs(90)]); // out of order on purpose
    const result = buildHistoryTrend({ projections: [a, b, c], registration: REGISTRATION });
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.descriptor.id).toBe(PRIMARY_METRIC);
    expect(result.points.map((p) => p.runId)).toEqual(['r1', 'r3', 'r2']);
    expect(result.points[0].deltaFromPrevious).toBeUndefined();
    expect(result.points[1].deltaFromPrevious).toBeCloseTo(-10);
    expect(result.points[2].deltaFromPrevious).toBeCloseTo(40);
  });

  it('selects an explicit metricId and reports missing-metric exclusions', () => {
    const withSecondary = makeReadyProjection('r1', '2026-08-10T00:00:00.000Z', [obs(100), obs(50, SECONDARY_METRIC, '%')]);
    const withoutSecondary = makeReadyProjection('r2', '2026-08-11T00:00:00.000Z', [obs(100)]);
    const result = buildHistoryTrend({
      projections: [withSecondary, withoutSecondary],
      registration: REGISTRATION,
      metricId: SECONDARY_METRIC,
    });
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.descriptor.id).toBe(SECONDARY_METRIC);
    expect(result.points).toHaveLength(1);
    expect(result.points[0].runId).toBe('r1');
    expect(result.excludedCounts['missing-metric']).toBe(1);
  });

  it('returns empty/no-finite-values when the selected metric has no eligible observation anywhere', () => {
    const noSecondary = makeReadyProjection('r1', '2026-08-10T00:00:00.000Z', [obs(100)]);
    const result = buildHistoryTrend({ projections: [noSecondary], registration: REGISTRATION, metricId: SECONDARY_METRIC });
    expect(result).toEqual({ status: 'empty', reason: 'no-finite-values' });
  });

  it('groups by compatibility cohort (quality-status-independent) and defaults to the cohort of the latest run', () => {
    const cohortA1 = makeReadyProjection('a1', '2026-08-01T00:00:00.000Z', [obs(100)], { sensitivityFovKey: 'sensitivity=1;fovDeg=90' });
    const cohortA2 = makeReadyProjection('a2', '2026-08-05T00:00:00.000Z', [obs(110)], { sensitivityFovKey: 'sensitivity=1;fovDeg=90' });
    const cohortB1 = makeReadyProjection('b1', '2026-08-10T00:00:00.000Z', [obs(200)], { sensitivityFovKey: 'sensitivity=2;fovDeg=100' });
    const result = buildHistoryTrend({ projections: [cohortA1, cohortA2, cohortB1], registration: REGISTRATION });
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    // cohort B has the single latest run (2026-08-10) so it is the default, even though cohort A
    // has more runs overall.
    expect(result.cohort.runCount).toBe(1);
    expect(result.points.map((p) => p.runId)).toEqual(['b1']);
    expect(result.excludedCounts['other-cohort']).toBe(2);
  });

  it('honors an explicit cohortId over the latest-run default', () => {
    const cohortA = makeReadyProjection('a1', '2026-08-01T00:00:00.000Z', [obs(100)], { sensitivityFovKey: 'sensitivity=1;fovDeg=90' });
    const cohortB = makeReadyProjection('b1', '2026-08-10T00:00:00.000Z', [obs(200)], { sensitivityFovKey: 'sensitivity=2;fovDeg=100' });
    const defaultResult = buildHistoryTrend({ projections: [cohortA, cohortB], registration: REGISTRATION });
    expect(defaultResult.status).toBe('ready');
    if (defaultResult.status !== 'ready') return;
    expect(defaultResult.points.map((p) => p.runId)).toEqual(['b1']);

    const explicit = buildHistoryTrend({ projections: [cohortA, cohortB], registration: REGISTRATION, cohortId: cohortIdFor(cohortA) });
    expect(explicit.status).toBe('ready');
    if (explicit.status !== 'ready') return;
    expect(explicit.points.map((p) => p.runId)).toEqual(['a1']);
  });
});

function cohortIdFor(projection: HistoryRunProjection): string {
  if (projection.projection.status !== 'ready') throw new Error('expected a ready projection');
  const key = projection.projection.compatibilityKey;
  return [
    key.participantId,
    key.taskId,
    key.protocolVersion,
    key.gameMovementProfile,
    key.weaponId,
    key.weaponMode,
    key.sensitivityFovKey,
    key.targetConditionCell,
    key.assessmentFeedbackPolicy,
  ].join('|');
}
