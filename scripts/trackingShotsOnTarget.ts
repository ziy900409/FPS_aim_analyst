/**
 * WP-54 / T7 — gate §3.5: shots-on-target as a free instrument cross-check.
 *
 * `tracking-pilot-v2`'s weapon (`tracking_pilot_hold`, D-54.51) has **zero spread and zero
 * recoil**, so every bullet leaves along the crosshair ray. That makes the engine's own per-shot
 * verdict (`HitDetector`, live, `fire.hit`) and the offline on-target derivation
 * (`trackingDerivation`, replayed from the recorded ticks) two independent readings of the *same*
 * sphere geometry. They must agree; if they do not, one of the two is wrong about the hitbox and
 * every TOT figure in the gate is suspect.
 *
 * **This is not a new metric (C-D3).** Nothing here enters a coach report, an aggregate, or a Gate
 * B criterion — it is instrument reconciliation, in the same family as layer 3b (was this payload
 * recorded by the current stimulus code?). The gate's TOT keeps its single canonical definition;
 * this module only asks whether the engine agreed with it at the ~250 moments it fired.
 *
 * **No second definition of TOT or of the window (C-D4).** The on-target share is recomputed over
 * the canonical tracking-window samples — the same `scored_start`-adapted presentation
 * `deriveTrackingMetrics()` reports `totPercent` for — and `canonicalTotPercent` is carried
 * alongside so the identity is visible on every run rather than merely asserted in a test (the
 * convention `trackingTimeOnTaskSlope.ts` established for ε). Shots are matched to that same
 * window, so the two sides cover one interval, not two.
 *
 * **Why a difference of a few points is expected and not a defect.** The offline share is measured
 * on all ~3200 ticks of the window at 128 Hz; the engine fires ~250 times at 10 Hz. The shot side
 * is therefore a sample of the same indicator, with a standard error near 3 percentage points at a
 * 50% hit rate. Agreement is judged on that scale — a fixed threshold would either flag ordinary
 * sampling noise or hide a real geometry mismatch, so this module reports the difference and
 * leaves the reading to the operator.
 */
import type { ExportPayload } from '../src/data/export.ts';
import { deriveTrackingMetrics, deriveTrackingSamples } from '../src/metrics/trackingDerivation.ts';
import { adaptPayloadForScoredWindow, pickPresentation } from '../src/metrics/trackingDynamics.ts';

const EPSILON = 1e-9;

type ScoredStartEvent = Extract<ExportPayload['events'][number], { type: 'scored_start' }>;
type FireEvent = Extract<ExportPayload['events'][number], { type: 'fire' }>;

export type TrackingShotsOnTargetStatus =
  | 'ok'
  /** No `scored_start`-windowed presentation, or the participant never acquired the target — the
   * same boundary the canonical TOT reports as an acquisition failure. */
  | 'no-scored-window'
  /** A run with no shots inside the window: every pre-v2 payload, and any v2 run whose weapon
   * never cycled. Reported rather than treated as 0% so it is never read as "missed everything". */
  | 'no-shots';

export interface TrackingShotsOnTargetResult {
  readonly status: TrackingShotsOnTargetStatus;
  /** `fire` events inside the canonical tracking window. */
  readonly shotCount: number;
  readonly hitCount: number;
  /** Engine side: `hitCount / shotCount` in [0,100]. NaN when not `ok`. */
  readonly hitRatePercent: number;
  /** Offline side: on-target share of the canonical window samples, in [0,100]. NaN when not `ok`. */
  readonly totPercent: number;
  /** P0's own TOT for the C-D4 identity check; equals `totPercent`. */
  readonly canonicalTotPercent: number;
  /** `hitRatePercent − totPercent`, in percentage points. NaN when not `ok`. */
  readonly deltaPoints: number;
  /** Window ticks behind `totPercent` — the denominator the shot count is being compared against. */
  readonly sampleCount: number;
}

const BLANK = {
  shotCount: 0,
  hitCount: 0,
  hitRatePercent: Number.NaN,
  totPercent: Number.NaN,
  canonicalTotPercent: Number.NaN,
  deltaPoints: Number.NaN,
  sampleCount: 0,
} as const;

export function computeTrackingShotsOnTarget(payload: ExportPayload): TrackingShotsOnTargetResult {
  const adapted = adaptPayloadForScoredWindow(payload);
  const scoredStarts = payload.events.filter((event): event is ScoredStartEvent => event.type === 'scored_start');
  const targetId = scoredStarts[0]?.targetId;

  const presentationSamples = pickPresentation(deriveTrackingSamples(adapted).presentations, targetId)?.samples;
  if (presentationSamples === undefined || presentationSamples.length === 0) {
    return { status: 'no-scored-window', ...BLANK };
  }

  // `deriveTrackingSamples` covers the **presentation** window `[t_visible, windowEnd)`, but
  // `totPercent` is measured over the **tracking** window — from the first on-target sample
  // onwards. Cutting here by the same rule `derivePresentation()` uses (the first sample with
  // `onTarget`) is what keeps this one definition of the window rather than a second one; slicing
  // from `samples[0]` instead would silently diverge from P0 on every run that acquired late.
  const firstOnTargetIndex = presentationSamples.findIndex((sample) => sample.onTarget);
  // No on-target sample at all is the canonical acquisition failure, where `totPercent` is
  // `undefined` — there is no window for the shots to be reconciled against.
  if (firstOnTargetIndex < 0) return { status: 'no-scored-window', ...BLANK };
  const samples = presentationSamples.slice(firstOnTargetIndex);

  const windowStartMs = samples[0].t;
  const windowEndMs = samples[samples.length - 1].t;
  const shots = payload.events.filter(
    (event): event is FireEvent =>
      event.type === 'fire' && event.t + EPSILON >= windowStartMs && event.t <= windowEndMs + EPSILON,
  );

  const onTargetSamples = samples.filter((sample) => sample.onTarget).length;
  const totPercent = (100 * onTargetSamples) / samples.length;
  const canonicalTotPercent =
    pickPresentation(deriveTrackingMetrics(adapted).presentations, targetId)?.totPercent ?? Number.NaN;

  if (shots.length === 0) {
    return { status: 'no-shots', ...BLANK, totPercent, canonicalTotPercent, sampleCount: samples.length };
  }

  const hitCount = shots.filter((shot) => shot.hit).length;
  const hitRatePercent = (100 * hitCount) / shots.length;
  return {
    status: 'ok',
    shotCount: shots.length,
    hitCount,
    hitRatePercent,
    totPercent,
    canonicalTotPercent,
    deltaPoints: hitRatePercent - totPercent,
    sampleCount: samples.length,
  };
}

/** One-line console rendering for the analysis runner's per-run block. */
export function formatTrackingShotsOnTarget(result: TrackingShotsOnTargetResult): string {
  if (result.status === 'no-scored-window') return `shotsOnTarget=${result.status}`;
  // A drift here means the recomputed share no longer covers the ticks P0 reported TOT over, so
  // the engine would be reconciled against a window nobody else uses.
  const parity =
    Number.isNaN(result.canonicalTotPercent) || Math.abs(result.totPercent - result.canonicalTotPercent) <= 1e-9
      ? ''
      : ` !!P0-MISMATCH canonical=${result.canonicalTotPercent.toFixed(1)}%`;
  if (result.status === 'no-shots') {
    return `shotsOnTarget=no-shots offlineTot=${result.totPercent.toFixed(1)}% ticks=${result.sampleCount}${parity}`;
  }
  return (
    `shotsOnTarget shots=${result.shotCount} hit=${result.hitRatePercent.toFixed(1)}% ` +
    `offlineTot=${result.totPercent.toFixed(1)}% delta=${result.deltaPoints >= 0 ? '+' : ''}` +
    `${result.deltaPoints.toFixed(1)}pt ticks=${result.sampleCount}${parity}`
  );
}
