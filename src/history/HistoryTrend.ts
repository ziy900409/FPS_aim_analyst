import type { HistoryRunProjection } from './contracts.ts';
import { toTrendCompatibilityKey, type DrillMetricRegistration, type MetricDescriptor, type TrendCompatibilityKey } from './DrillMetricRegistry.ts';

/**
 * WP-49 T4 (README §2.7) — pure cohort/eligibility/trend domain over already-loaded projections.
 * Assumes the caller already scoped `projections` to one Assessment-only, exact-drill route
 * (README §2.7 gate order steps 1–2); this module owns everything from "projection ready" onward.
 */

export interface CompatibilityCohort {
  readonly id: string;
  readonly label: string;
  readonly key: TrendCompatibilityKey;
  readonly runCount: number;
}

export interface TrendPoint {
  readonly runId: string;
  readonly startedAt: string;
  readonly value: number;
  readonly deltaFromPrevious?: number;
}

export type HistoryTrendResult =
  | {
      readonly status: 'ready';
      readonly descriptor: MetricDescriptor;
      readonly cohort: CompatibilityCohort;
      readonly points: readonly TrendPoint[]; // oldest → newest
      readonly excludedCounts: Readonly<Record<string, number>>;
    }
  | { readonly status: 'empty'; readonly reason: 'unregistered-drill' | 'no-finite-values' | 'insufficient-data' };

export function buildHistoryTrend(args: {
  readonly projections: readonly HistoryRunProjection[];
  readonly registration?: DrillMetricRegistration;
  readonly metricId?: string;
  readonly cohortId?: string;
}): HistoryTrendResult {
  const { projections, registration, metricId, cohortId } = args;
  if (registration === undefined) return { status: 'empty', reason: 'unregistered-drill' };

  const excludedCounts: Record<string, number> = {};
  const bump = (key: string): void => {
    excludedCounts[key] = (excludedCounts[key] ?? 0) + 1;
  };

  const ready = projections.filter((item) => {
    if (item.projection.status !== 'ready') {
      bump('not-ready');
      return false;
    }
    return true;
  });

  // Quality is an eligibility gate (FR-49.9), never part of cohort identity (D-49.P5/§2.5
  // `toTrendCompatibilityKey`) — a suspect run is excluded here, not folded into a second cohort.
  const eligible = ready.filter((item) => {
    if (item.projection.status !== 'ready') return false; // narrows for TS; already filtered above
    if (item.projection.qualityGateStatus !== 'ok') {
      bump('quality-gate');
      return false;
    }
    return true;
  }) as readonly (HistoryRunProjection & { readonly projection: Extract<HistoryRunProjection['projection'], { status: 'ready' }> })[];

  if (eligible.length === 0) {
    return { status: 'empty', reason: 'insufficient-data' };
  }

  const cohorts = groupByCohort(eligible);
  const selectedCohort = selectCohort(cohorts, cohortId);
  if (selectedCohort === undefined) {
    return { status: 'empty', reason: 'insufficient-data' };
  }

  const descriptor = selectDescriptor(registration, metricId);
  if (descriptor === undefined) {
    return { status: 'empty', reason: 'no-finite-values' };
  }

  const cohortItems = eligible.filter(
    (item) => cohortKeyId(toTrendCompatibilityKey(item.projection.compatibilityKey)) === selectedCohort.id,
  );
  for (const item of eligible) {
    if (cohortKeyId(toTrendCompatibilityKey(item.projection.compatibilityKey)) !== selectedCohort.id) {
      bump('other-cohort');
    }
  }

  const points: TrendPoint[] = [];
  for (const item of cohortItems) {
    const observation = item.projection.observations.find(
      (candidate) => candidate.metricId === descriptor.id && candidate.unit === descriptor.unit,
    );
    if (observation === undefined || !Number.isFinite(observation.value)) {
      bump('missing-metric');
      continue;
    }
    points.push({ runId: item.run.runId, startedAt: item.run.startedAt, value: observation.value });
  }

  if (points.length === 0) {
    return { status: 'empty', reason: 'no-finite-values' };
  }

  points.sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  const withDeltas = points.map((point, index) =>
    index === 0 ? point : { ...point, deltaFromPrevious: point.value - points[index - 1].value },
  );

  return {
    status: 'ready',
    descriptor,
    cohort: selectedCohort,
    points: withDeltas,
    excludedCounts,
  };
}

function selectDescriptor(registration: DrillMetricRegistration, metricId: string | undefined): MetricDescriptor | undefined {
  if (metricId === undefined) return registration.descriptors.find((d) => d.primary) ?? registration.descriptors[0];
  return registration.descriptors.find((d) => d.id === metricId);
}

function cohortKeyId(key: TrendCompatibilityKey): string {
  // Deterministic identity string over a fixed, known field set — not JSON.stringify (whose key
  // order is not part of `TrendCompatibilityKey`'s contract, so it must not be relied on here).
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

function cohortLabel(key: TrendCompatibilityKey): string {
  return `${key.sensitivityFovKey}; ${key.assessmentFeedbackPolicy}`;
}

function groupByCohort(
  eligible: readonly (HistoryRunProjection & { readonly projection: Extract<HistoryRunProjection['projection'], { status: 'ready' }> })[],
): readonly (CompatibilityCohort & { readonly latestStartedAt: string })[] {
  const byId = new Map<string, { key: TrendCompatibilityKey; runCount: number; latestStartedAt: string }>();
  for (const item of eligible) {
    const key = toTrendCompatibilityKey(item.projection.compatibilityKey);
    const id = cohortKeyId(key);
    const existing = byId.get(id);
    if (existing === undefined) {
      byId.set(id, { key, runCount: 1, latestStartedAt: item.run.startedAt });
    } else {
      existing.runCount += 1;
      if (Date.parse(item.run.startedAt) > Date.parse(existing.latestStartedAt)) {
        existing.latestStartedAt = item.run.startedAt;
      }
    }
  }
  return [...byId.entries()].map(([id, agg]) => ({
    id,
    label: cohortLabel(agg.key),
    key: agg.key,
    runCount: agg.runCount,
    latestStartedAt: agg.latestStartedAt,
  }));
}

/**
 * WP-49 T5 (FR-49.10) — every compatibility cohort present among quality-ok, ready projections for
 * a drill, independent of which metric is selected (a cohort selector must be populate-able before
 * the user has picked a metric). Sorted most-recently-active first so a selector's default ordering
 * matches `buildHistoryTrend`'s own "latest eligible cohort" default (D-49.P10).
 */
export function listCompatibilityCohorts(projections: readonly HistoryRunProjection[]): readonly CompatibilityCohort[] {
  const eligible = projections.filter(
    (item): item is HistoryRunProjection & { readonly projection: Extract<HistoryRunProjection['projection'], { status: 'ready' }> } =>
      item.projection.status === 'ready' && item.projection.qualityGateStatus === 'ok',
  );
  return groupByCohort(eligible)
    .slice()
    .sort((a, b) => Date.parse(b.latestStartedAt) - Date.parse(a.latestStartedAt))
    .map(({ latestStartedAt: _latestStartedAt, ...cohort }) => cohort);
}

/** Default (D-49.P10): the cohort containing the most recent eligible run. `cohortId`, when given,
 * selects an explicit cohort instead (README §2.7 "provide a selector"). */
function selectCohort(
  cohorts: readonly (CompatibilityCohort & { readonly latestStartedAt: string })[],
  cohortId: string | undefined,
): CompatibilityCohort | undefined {
  if (cohorts.length === 0) return undefined;
  if (cohortId !== undefined) return cohorts.find((cohort) => cohort.id === cohortId);
  return cohorts.reduce((latest, candidate) =>
    Date.parse(candidate.latestStartedAt) > Date.parse(latest.latestStartedAt) ? candidate : latest,
  );
}
