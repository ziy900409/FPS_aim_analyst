import type { ExportPayload } from '../data/export.ts';

/**
 * trackingRunEligibility — WP-54 / T4 (README §2.4 `TrackingRunEligibility` interface contract,
 * FR-54-10, NFR-54-4).
 *
 * Run-level data-quality gate, evaluated once per export **before** any P0/P1 metric aggregation
 * (FR-54-10) — a distinct, higher layer than T3's per-metric `TrackingDynamicsResult.status ===
 * 'blocked'` vocabulary (`src/metrics/trackingDynamics.ts`). A run can be `eligible` here while its
 * P1 dynamics are still metric-blocked (e.g. `lag-peak-ambiguous`); the two closed vocabularies are
 * never merged or compared to each other (see `docs/operational/analysis-tracking.md`).
 */

const EPSILON = 1e-9;
/** NFR-54-4: eligible run scored-window tick coverage must be `>= 99.5%`. */
const MIN_SCORED_COVERAGE = 0.995;
const RECOGNIZED_TRAJECTORY_KINDS = new Set(['band-limited-2d-v1', 'reversal-2d-v1']);

/**
 * Closed, run-level quality-gate reason vocabulary (FR-54-10). Distinct namespace from T3's
 * metric-level `TrackingDynamicsResult` blocked reasons — do not compare or merge the two lists.
 */
export type TrackingQualityReason =
  | 'recorder-overflow'
  | 'input-buffer-overflow'
  | 'missing-scored-start'
  | 'missing-target-position'
  | 'non-monotonic-timestamps'
  | 'insufficient-scored-coverage'
  | 'unsupported-schema-version'
  | 'unrecognized-tracking-trajectory';

export type TrackingRunEligibility =
  | { readonly status: 'eligible'; readonly validScoredTicks: number; readonly durationMs: number }
  | { readonly status: 'blocked'; readonly reasons: readonly TrackingQualityReason[] };

type ScoredStartEvent = Extract<ExportPayload['events'][number], { type: 'scored_start' }>;
type Tick = ExportPayload['ticks'][number];

/**
 * Evaluates every independent quality check and collects **all** applicable reasons — a run can
 * fail more than one check at once, and short-circuiting on the first would silently hide the rest
 * (FR-54-10 closed reason-code contract).
 */
export function evaluateTrackingRunEligibility(payload: ExportPayload): TrackingRunEligibility {
  const reasons: TrackingQualityReason[] = [];

  if (payload.meta.schemaVersion !== 2) reasons.push('unsupported-schema-version');
  if (payload.meta.recorderOverflow) reasons.push('recorder-overflow');
  if (payload.meta.bufferOverflow) reasons.push('input-buffer-overflow');
  if (!isRecognizedTrackingTrajectory(payload.meta.spawn?.trackingTrajectory)) {
    reasons.push('unrecognized-tracking-trajectory');
  }
  if (hasNonMonotonicTimestamps(payload.ticks)) reasons.push('non-monotonic-timestamps');

  const scoredStarts = payload.events.filter((event): event is ScoredStartEvent => event.type === 'scored_start');
  if (scoredStarts.length === 0) {
    reasons.push('missing-scored-start');
    return { status: 'blocked', reasons };
  }

  const scoredStartMs = Math.min(...scoredStarts.map((event) => event.t));
  const scoredTicks = payload.ticks.filter((tick) => tick.t + EPSILON >= scoredStartMs);
  if (scoredTicks.some(isMissingTargetPosition)) reasons.push('missing-target-position');

  const lastTick = payload.ticks[payload.ticks.length - 1];
  const durationMs = lastTick !== undefined ? lastTick.t - scoredStartMs : 0;
  const coverage = scoredCoverage(scoredTicks.length, durationMs, payload.meta.simHz);
  if (coverage < MIN_SCORED_COVERAGE) reasons.push('insufficient-scored-coverage');

  if (reasons.length > 0) return { status: 'blocked', reasons };
  return { status: 'eligible', validScoredTicks: scoredTicks.length, durationMs };
}

function isMissingTargetPosition(tick: Tick): boolean {
  return tick.tx === null || tick.ty === null || tick.tz === null;
}

function hasNonMonotonicTimestamps(ticks: readonly Tick[]): boolean {
  for (let i = 1; i < ticks.length; i++) {
    if (ticks[i].t <= ticks[i - 1].t) return true;
  }
  return false;
}

function isRecognizedTrackingTrajectory(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const kind = (value as { kind?: unknown }).kind;
  return typeof kind === 'string' && RECOGNIZED_TRAJECTORY_KINDS.has(kind);
}

/** `durationMs <= 0` (degenerate/empty scored window) counts as full coverage only when ticks were
 * actually observed; a scored window with zero ticks must never read as "100% of nothing". */
function scoredCoverage(actualTickCount: number, durationMs: number, simHz: number): number {
  if (durationMs <= 0) return actualTickCount > 0 ? 1 : 0;
  const tickMs = 1000 / simHz;
  const expectedTickCount = Math.round(durationMs / tickMs) + 1;
  if (expectedTickCount <= 0) return 1;
  return actualTickCount / expectedTickCount;
}