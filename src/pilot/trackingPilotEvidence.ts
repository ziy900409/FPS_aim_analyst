import type { ExportPayload } from '../data/export.ts';
import {
  adaptPayloadForScoredWindow,
  deriveTrackingDynamics,
  deriveTrackingReversalWindows,
  pickPresentation,
  type TrackingDynamicsOptions,
  type TrackingDynamicsResult,
  type TrackingReversalWindowOptions,
  type TrackingReversalWindowsResult,
} from '../metrics/trackingDynamics.ts';
import {
  deriveTrackingMetrics,
  deriveTrackingSamples,
  type TrackingPresentationDerivation,
  type TrackingSample,
} from '../metrics/trackingDerivation.ts';
import { evaluateTrackingRunEligibility, type TrackingRunEligibility } from './trackingRunEligibility.ts';

/**
 * trackingPilotEvidence — WP-54 / T4 (FR-54-11, NFR-54-5, README §2.5 metrics/evidence contract).
 *
 * Deterministic, pure aggregation of one or more `ExportPayload`s (T3's `deriveTrackingDynamics`/
 * `deriveTrackingReversalWindows`/`deriveTrackingMetrics`, T4's `evaluateTrackingRunEligibility`)
 * into a self-contained, JSON-serializable evidence artifact. No I/O, no `Date.now()`/`Math.random()`
 * (C-D2/C-D3) — `analysisCommit` is caller-supplied traceability, never computed here.
 *
 * **Deviates from README §2.4's locked `buildTrackingPilotEvidence(manifest, payloads)` signature**
 * (see progress.md decision log): `TrackingPilotManifest`/`TrackingPilotBlock` are T5 scope and do
 * not exist yet. Every field FR-54-11 requires (condition, n/duration, quality, seed) is already
 * derivable from `payload.meta` alone — `meta.drillId` doubles as the condition label (T2 slice 4
 * decision) and `meta.spawn.trackingTrajectory.seed` carries the seed — so this function takes only
 * `payloads`. T5 can pass `manifest.orderedBlocks`-derived payload arrays into this same function
 * once it exists; no redesign anticipated, but not designed in speculatively either (Rule 0.5).
 */

export const TRACKING_PILOT_EVIDENCE_METRIC_VERSION = 'tracking-dynamics-v1';
export const TRACKING_PILOT_EVIDENCE_PROTOCOL_VERSION = 'tracking-pilot-v1';

/**
 * D-54.5/D-54.16 froze `lagSearchMs`/the ambiguity-gate *existence* but left the ambiguity ratio and
 * these reversal-window parameters as calibration candidates; `minValidTicks: 32` is not arbitrary —
 * it is exactly `lagSearchMs`'s 250ms upper bound at 128Hz, the shortest window that can resolve the
 * full search range. `smoothingVersion` defaults to the tri3 kernel here (unlike T3's truth-fixture
 * tests, which default to `-none` to keep synthetic recovery exact) because real pilot tracking data
 * is noisy and benefits from smoothing before lag search — documented as a T4 pipeline default, not
 * a new protocol freeze; both remain fully overridable via `options`.
 */
const DEFAULT_DYNAMICS_OPTIONS: TrackingDynamicsOptions = {
  version: 'tracking-dynamics-v1',
  lagSearchMs: [0, 250],
  smoothingVersion: 'tracking-dynamics-smoothing-v1-tri3',
  minValidTicks: 32,
  correlationAmbiguityRatio: 2,
};

const DEFAULT_REVERSAL_OPTIONS: TrackingReversalWindowOptions = {
  version: 'tracking-dynamics-v1',
  minWindowMs: 300,
  maxWindowMs: 500,
  minBaselineMs: 200,
  settlingToleranceDeg: 0.5,
};

export interface TrackingPilotEvidenceOptions {
  /** Traceability only (NFR-54-5) — the caller's own git commit lookup, never read internally. */
  readonly analysisCommit?: string;
  readonly dynamics?: TrackingDynamicsOptions;
  readonly reversal?: TrackingReversalWindowOptions;
  /**
   * When `true`, attaches each eligible run's ε(t)/on-target sample series as `run.trace` — the raw
   * per-tick series `trackingPilotReport.ts`'s target/aim trace chart reads. Off by default: a real
   * pilot run's trace is thousands of samples, and most evidence consumers (aggregate audits, T6-T8
   * gate checks) never need it. Opt in only when building the HTML report so the report's embedded
   * JSON stays a byte-for-byte copy of the same evidence object passed to it (see
   * `renderTrackingPilotReportHtml`'s parity-by-construction design).
   */
  readonly includeTrace?: boolean;
}

export interface TrackingPilotRunEvidence {
  /** `${drillId}@${startedAt}` — deterministic, traceable to the source export (no separate run-id
   * field exists on `ExportPayload`/`Meta`). */
  readonly runId: string;
  readonly seed?: number;
  readonly quality: TrackingRunEligibility;
  /** Present only when `quality.status === 'eligible'` — FR-54-10: a blocked run reports its reasons
   * and is never fed into metric derivation. */
  readonly p0?: TrackingPresentationDerivation;
  /** P1 dynamics/recovery — reused verbatim from T3; its own `status: 'blocked'` (e.g.
   * `lag-peak-ambiguous`) never removes an otherwise-valid `p0` from this same run (checklist T4
   * "P1 blocked 不刪除仍有效的 P0" — the two are derived and attached independently below). */
  readonly p1?: TrackingDynamicsResult;
  readonly reversal?: TrackingReversalWindowsResult;
  /** Only present when `options.includeTrace` is `true` (see that option's doc). */
  readonly trace?: readonly TrackingSample[];
}

export interface TrackingPilotConditionEvidence {
  /** `meta.drillId` — WP-54's single source for condition identity (T2 slice 4 decision: every
   * candidate config already gets its own drillId carrying the condition label). */
  readonly condition: string;
  readonly runCount: number;
  readonly eligibleRunCount: number;
  /** Sum of `quality.durationMs` over eligible runs only (deterministic; never includes a blocked
   * run's partial/undefined duration). */
  readonly totalDurationMs: number;
  /** Distinct trajectory seeds observed across this condition's runs, ascending — audit trail for
   * seed reuse/variety, not a statistical summary. */
  readonly seeds: readonly number[];
  readonly runs: readonly TrackingPilotRunEvidence[];
}

export interface TrackingPilotEvidence {
  readonly metricVersion: typeof TRACKING_PILOT_EVIDENCE_METRIC_VERSION;
  readonly protocolVersion: typeof TRACKING_PILOT_EVIDENCE_PROTOCOL_VERSION;
  readonly analysisCommit?: string;
  readonly conditions: readonly TrackingPilotConditionEvidence[];
}

type ScoredStartEvent = Extract<ExportPayload['events'][number], { type: 'scored_start' }>;

export function buildTrackingPilotEvidence(
  payloads: readonly ExportPayload[],
  options: TrackingPilotEvidenceOptions = {},
): TrackingPilotEvidence {
  const dynamicsOptions = options.dynamics ?? DEFAULT_DYNAMICS_OPTIONS;
  const reversalOptions = options.reversal ?? DEFAULT_REVERSAL_OPTIONS;

  const byCondition = new Map<string, ExportPayload[]>();
  for (const payload of payloads) {
    const group = byCondition.get(payload.meta.drillId);
    if (group !== undefined) group.push(payload);
    else byCondition.set(payload.meta.drillId, [payload]);
  }

  const includeTrace = options.includeTrace ?? false;
  const conditions: TrackingPilotConditionEvidence[] = [];
  for (const [condition, group] of byCondition) {
    conditions.push(buildConditionEvidence(condition, group, dynamicsOptions, reversalOptions, includeTrace));
  }

  return {
    metricVersion: TRACKING_PILOT_EVIDENCE_METRIC_VERSION,
    protocolVersion: TRACKING_PILOT_EVIDENCE_PROTOCOL_VERSION,
    ...(options.analysisCommit !== undefined ? { analysisCommit: options.analysisCommit } : {}),
    conditions,
  };
}

function buildConditionEvidence(
  condition: string,
  group: readonly ExportPayload[],
  dynamicsOptions: TrackingDynamicsOptions,
  reversalOptions: TrackingReversalWindowOptions,
  includeTrace: boolean,
): TrackingPilotConditionEvidence {
  const runs = group.map((payload) => buildRunEvidence(payload, dynamicsOptions, reversalOptions, includeTrace));
  const eligibleRuns = runs.filter(
    (run): run is TrackingPilotRunEvidence & { quality: { status: 'eligible'; validScoredTicks: number; durationMs: number } } =>
      run.quality.status === 'eligible',
  );
  const totalDurationMs = eligibleRuns.reduce((sum, run) => sum + run.quality.durationMs, 0);
  const seeds = [...new Set(runs.flatMap((run) => (run.seed === undefined ? [] : [run.seed])))].sort((a, b) => a - b);

  return { condition, runCount: runs.length, eligibleRunCount: eligibleRuns.length, totalDurationMs, seeds, runs };
}

function buildRunEvidence(
  payload: ExportPayload,
  dynamicsOptions: TrackingDynamicsOptions,
  reversalOptions: TrackingReversalWindowOptions,
  includeTrace: boolean,
): TrackingPilotRunEvidence {
  const runId = `${payload.meta.drillId}@${payload.meta.startedAt}`;
  const seed = readTrajectorySeed(payload.meta.spawn?.trackingTrajectory);
  const quality = evaluateTrackingRunEligibility(payload);

  if (quality.status === 'blocked') {
    return { runId, ...(seed !== undefined ? { seed } : {}), quality };
  }

  const adapted = adaptPayloadForScoredWindow(payload);
  const scoredStarts = payload.events.filter((event): event is ScoredStartEvent => event.type === 'scored_start');
  const targetId = scoredStarts[0]?.targetId;
  const p0 = pickPresentation(deriveTrackingMetrics(adapted).presentations, targetId);
  const p1 = deriveTrackingDynamics(payload, dynamicsOptions);
  const reversal = deriveTrackingReversalWindows(payload, reversalOptions);
  const trace = includeTrace ? pickPresentation(deriveTrackingSamples(adapted).presentations, targetId)?.samples : undefined;

  return {
    runId,
    ...(seed !== undefined ? { seed } : {}),
    quality,
    ...(p0 !== undefined ? { p0 } : {}),
    p1,
    reversal,
    ...(trace !== undefined ? { trace } : {}),
  };
}

function readTrajectorySeed(value: unknown): number | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const seed = (value as { seed?: unknown }).seed;
  return typeof seed === 'number' && Number.isFinite(seed) ? seed : undefined;
}
