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
/**
 * D-54.50 (`tracking-pilot-v2`, frozen 2026-09-04 **before data collection**): a run whose drill
 * declares `protocolGuard.requireFire` is eligible only if the participant held fire on `>= 95%`
 * of its scored ticks — a 25 s block therefore tolerates ~1.25 s of cumulative release.
 *
 * **Why a threshold rather than the all-or-nothing rule the other guard kinds use.** The failure
 * modes are not symmetric. Under `noFire` a single stray shot injects recoil punch and contaminates
 * the whole block, so one event must void it. Under `requireFire` the weapon is zero-recoil
 * (`tracking_pilot_hold`), so a brief release costs a few shots' audio and tracers and perturbs the
 * aiming task not at all. Against 26 s of continuous holding x ~9 blocks x 12-20 participants, an
 * all-or-nothing rule would convert one twitch — or one late press at the scored-window boundary —
 * straight into lost data.
 *
 * Per README §2.2 discipline this threshold **must not be adjusted after data collection starts**;
 * changing it requires a new protocol version and a new decision row.
 */
export const MIN_FIRE_HOLD_COVERAGE = 0.95;
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
  | 'unrecognized-tracking-trajectory'
  | 'protocol-violation'
  /** WP-54 / T7: held-fire coverage below `MIN_FIRE_HOLD_COVERAGE` on a `requireFire` run (D-54.50). */
  | 'insufficient-fire-hold-coverage'
  /**
   * WP-54 / T7: the drill declared `requireFire` but scored ticks carry no `fire` flag, so the
   * protocol cannot be verified at all. Deliberately **not** folded into
   * `insufficient-fire-hold-coverage`: missing flags would compute as 0% coverage and the run
   * would be rejected for "the participant did not hold fire" when the truth is "the instrument
   * did not record it". Reporting the wrong cause is exactly the C-D3 failure mode.
   */
  | 'missing-fire-flag';

export type TrackingRunEligibility =
  | { readonly status: 'eligible'; readonly validScoredTicks: number; readonly durationMs: number }
  | { readonly status: 'blocked'; readonly reasons: readonly TrackingQualityReason[] };

type ScoredStartEvent = Extract<ExportPayload['events'][number], { type: 'scored_start' }>;
type ProtocolViolationEvent = Extract<ExportPayload['events'][number], { type: 'protocol_violation' }>;
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

  // FR-54-10 "protocol mismatch" / §1.3 Constraints「Scored block 禁止射擊、ADS 與玩家移動」:
  // a violation inside the scored window changes FOV/sensitivity or adds player motion mid-block,
  // so epsilon(t) and the velocity gain are contaminated — the run must not reach aggregation.
  // `deriveTrackingDynamics()` already refuses such a run (`protocol-incompatible`), but that only
  // protects P1; without this check the **primary** outcome RMS(epsilon) was still aggregated and
  // the operator screen reported "Eligible" (measured on a real ADS'd block, WP-54 T6 slice 7).
  if (payload.events.some((event): event is ProtocolViolationEvent => isScoredWindowViolation(event, scoredStartMs))) {
    reasons.push('protocol-violation');
  }

  // WP-54 / T7 (`tracking-pilot-v2`): only applied when the payload's own protocol snapshot says
  // the run required held fire. Applying it unconditionally would compute 0% coverage for every
  // drill that simply never fires; inferring the protocol from the data instead would let the
  // outcome define the criterion, which is what preregistration exists to prevent.
  if (payload.meta.protocolGuard?.requireFire === true && scoredTicks.length > 0) {
    if (scoredTicks.some((tick) => tick.fire === undefined)) {
      reasons.push('missing-fire-flag');
    } else if (fireHoldCoverage(scoredTicks) < MIN_FIRE_HOLD_COVERAGE) {
      reasons.push('insufficient-fire-hold-coverage');
    }
  }

  const lastTick = payload.ticks[payload.ticks.length - 1];
  const durationMs = lastTick !== undefined ? lastTick.t - scoredStartMs : 0;
  const coverage = scoredCoverage(scoredTicks.length, durationMs, payload.meta.simHz);
  if (coverage < MIN_SCORED_COVERAGE) reasons.push('insufficient-scored-coverage');

  if (reasons.length > 0) return { status: 'blocked', reasons };
  return { status: 'eligible', validScoredTicks: scoredTicks.length, durationMs };
}

/** Violations recorded before `scored_start` (i.e. during the centring prep window) are not
 * scored-window contamination — the prep window is excluded from analysis by construction, same
 * boundary the missing-target check uses.
 *
 * WP-54 / T7: `fire-released` is **excluded from this all-or-nothing rule**. It marks *when* the
 * participant let go, not that the run is void; eligibility for a `requireFire` run is decided by
 * the `MIN_FIRE_HOLD_COVERAGE` threshold above (D-54.50). Leaving it in this predicate would make
 * a single release void the block, which is precisely the rule the researcher rejected — the
 * criterion would be silently overridden by its own implementation. */
function isScoredWindowViolation(event: ExportPayload['events'][number], scoredStartMs: number): boolean {
  return event.type === 'protocol_violation' && event.kind !== 'fire-released' && event.t + EPSILON >= scoredStartMs;
}

/** Share of scored ticks recorded with the fire button held. Callers must first establish that
 * every scored tick carries the flag — a missing flag is a distinct, separately reported defect. */
function fireHoldCoverage(scoredTicks: readonly Tick[]): number {
  let held = 0;
  for (const tick of scoredTicks) if (tick.fire === true) held++;
  return held / scoredTicks.length;
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