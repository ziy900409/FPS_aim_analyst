/**
 * WP-54 / T7 — B-3c: does performance drift across a 25 s block?
 *
 * Gate B criterion B-3c (`T7-difficulty-calibration-gate.md` §2.2, frozen 2026-09-03) is defined as
 * "the RMS ε of the **first 5 s** and the **last 5 s** of the same scored window, Δ = (last −
 * first) / first, averaged over the cell's eligible runs; |Δ| ≤ 20%". This module is the per-run
 * half of that: it produces one run's two half-window RMS figures and their Δ. The cell-level mean
 * lives in the Gate B aggregation (slice 9) — gate §5 requires both to be pure functions with
 * regression tests rather than numbers produced by a one-off script.
 *
 * **No second definition of ε or of the scored window (C-D4).** The window is the canonical one —
 * `scored_start`-adapted presentation, first-on-target to window end, exactly as
 * `deriveTrackingDynamics()` and `trackingFrozenCrosshairRatio.ts` (layer 5) use it — and both RMS
 * figures come from `angularEccentricityDeg()`, the single TS implementation. `windowRmsEpsilonDeg`
 * recomputes the whole window over that same tick set and is carried alongside
 * `canonicalRmsEpsilonDeg` so the identity is visible on every run, not merely asserted in a test.
 *
 * **Why the halves are cut from the ticks, not from `windowEndMs`.** `windowEndMs` is `Infinity`
 * for the last presentation in a block (`trackingDerivation`), which is exactly the case here —
 * a pilot block has one presentation. So "the last 5 s" is measured back from the last tick that
 * actually carries data, which is also the honest reading of the criterion: the last 5 s the
 * participant was measured, not the last 5 s of a nominal schedule.
 */
import type { ExportPayload } from '../src/data/export.ts';
import { angularEccentricityDeg, resolveEyeOrigin } from '../src/metrics/eyeOrigin.ts';
import { deriveTrackingMetrics } from '../src/metrics/trackingDerivation.ts';
import { adaptPayloadForScoredWindow, pickPresentation } from '../src/metrics/trackingDynamics.ts';

const EPSILON = 1e-9;
/** The 5 s frozen by gate §2.2. Not a knob — changing it changes the criterion, which after data
 * collection requires a new protocol version (README §5). */
export const TRACKING_TIME_ON_TASK_HALF_MS = 5000;
/** Same floor as the canonical P1 pipeline's `minValidTicks` (D-54.21), applied per half — one
 * definition of "too few ticks to say anything", not a new knob. */
const DEFAULT_MIN_TICKS = 32;

export type TrackingTimeOnTaskSlopeStatus =
  | 'ok'
  /** No `scored_start`-windowed presentation, or the participant never acquired the target. */
  | 'no-scored-window'
  /** The scored window spans less than 2 × 5 s, so the two halves would overlap and Δ would be
   * partly a comparison of a stretch of data with itself. */
  | 'window-too-short'
  | 'insufficient-ticks'
  | 'missing-target-telemetry';

export interface TrackingTimeOnTaskSlopeResult {
  readonly status: TrackingTimeOnTaskSlopeStatus;
  /** RMS ε over the first 5 s of the scored window. */
  readonly firstRmsEpsilonDeg: number;
  /** RMS ε over the last 5 s of the scored window. */
  readonly lastRmsEpsilonDeg: number;
  /** `(last − first) / first`. NaN when not `ok`. Unbounded above — `acos` near dot=1 floors a
   * flawless opening 5 s at ~5e-7 deg rather than 0, so Δ grows very large instead of dividing by
   * zero; such a run is a genuine outlier for the cell mean, not a defect of this measure. */
  readonly deltaFraction: number;
  /** RMS ε over the whole scored window, recomputed here. */
  readonly windowRmsEpsilonDeg: number;
  /** The canonical P0 figure, for the C-D4 identity check; equals `windowRmsEpsilonDeg`. */
  readonly canonicalRmsEpsilonDeg: number;
  readonly firstTickCount: number;
  readonly lastTickCount: number;
  /** Span of the scored window's ticks, first to last, in ms. */
  readonly windowSpanMs: number;
}

const NOT_COMPUTED = {
  firstRmsEpsilonDeg: Number.NaN,
  lastRmsEpsilonDeg: Number.NaN,
  deltaFraction: Number.NaN,
  windowRmsEpsilonDeg: Number.NaN,
  canonicalRmsEpsilonDeg: Number.NaN,
  firstTickCount: 0,
  lastTickCount: 0,
  windowSpanMs: 0,
} as const;

export function computeTrackingTimeOnTaskSlope(
  payload: ExportPayload,
  options: { readonly minTicks?: number } = {},
): TrackingTimeOnTaskSlopeResult {
  const minTicks = options.minTicks ?? DEFAULT_MIN_TICKS;

  const scoredStarts = payload.events.filter((event) => event.type === 'scored_start');
  const targetId = scoredStarts[0]?.targetId;
  const adapted = adaptPayloadForScoredWindow(payload);
  const metrics = pickPresentation(deriveTrackingMetrics(adapted).presentations, targetId);
  if (metrics === undefined || metrics.acquisitionFailure) {
    return { status: 'no-scored-window', ...NOT_COMPUTED };
  }

  // The same window as `deriveTrackingDynamics()`: first-on-target to window end.
  const tFirstOnTargetMs = metrics.tFirstOnTargetMs!;
  const windowEndMs = metrics.windowEndMs;
  const windowTicks = payload.ticks
    .slice()
    .sort((a, b) => a.t - b.t)
    .filter((tick) => tick.t + EPSILON >= tFirstOnTargetMs && tick.t < windowEndMs - EPSILON);

  if (windowTicks.some((tick) => tick.tx === null || tick.ty === null || tick.tz === null)) {
    return { status: 'missing-target-telemetry', ...NOT_COMPUTED };
  }
  if (windowTicks.length < minTicks) return { status: 'insufficient-ticks', ...NOT_COMPUTED };

  const firstTickMs = windowTicks[0].t;
  const lastTickMs = windowTicks[windowTicks.length - 1].t;
  const windowSpanMs = lastTickMs - firstTickMs;
  if (windowSpanMs + EPSILON < 2 * TRACKING_TIME_ON_TASK_HALF_MS) {
    return { status: 'window-too-short', ...NOT_COMPUTED, windowSpanMs };
  }

  const eyeOrigin = resolveEyeOrigin(payload);
  const firstCutoffMs = firstTickMs + TRACKING_TIME_ON_TASK_HALF_MS;
  const lastCutoffMs = lastTickMs - TRACKING_TIME_ON_TASK_HALF_MS;

  const whole: number[] = [];
  const first: number[] = [];
  const last: number[] = [];
  for (const tick of windowTicks) {
    const epsilon = angularEccentricityDeg(tick, { x: tick.tx!, y: tick.ty!, z: tick.tz! }, eyeOrigin);
    whole.push(epsilon);
    if (tick.t < firstCutoffMs - EPSILON) first.push(epsilon);
    if (tick.t > lastCutoffMs + EPSILON) last.push(epsilon);
  }
  if (first.length < minTicks || last.length < minTicks) {
    return { status: 'insufficient-ticks', ...NOT_COMPUTED, windowSpanMs };
  }

  const firstRmsEpsilonDeg = rms(first);
  const lastRmsEpsilonDeg = rms(last);
  return {
    status: 'ok',
    firstRmsEpsilonDeg,
    lastRmsEpsilonDeg,
    deltaFraction: (lastRmsEpsilonDeg - firstRmsEpsilonDeg) / firstRmsEpsilonDeg,
    windowRmsEpsilonDeg: rms(whole),
    canonicalRmsEpsilonDeg: metrics.rmsEpsilonDeg!,
    firstTickCount: first.length,
    lastTickCount: last.length,
    windowSpanMs,
  };
}

/** Mirrors `trackingDerivation`'s `rms()` — same accumulation order, so `windowRmsEpsilonDeg`
 * reproduces the canonical `rmsEpsilonDeg` rather than merely approximating it. */
function rms(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const meanSquare = values.reduce((sum, value) => sum + value * value, 0) / values.length;
  return Math.sqrt(meanSquare);
}

/** One-line console rendering for the analysis runner's per-run block. */
export function formatTrackingTimeOnTaskSlope(result: TrackingTimeOnTaskSlopeResult): string {
  if (result.status !== 'ok') return `timeSlope=${result.status}`;
  // A drift between the two would mean the halves no longer partition the window P0 reports.
  const parity =
    Math.abs(result.windowRmsEpsilonDeg - result.canonicalRmsEpsilonDeg) <= 1e-9
      ? ''
      : ` !!P0-MISMATCH canonical=${result.canonicalRmsEpsilonDeg.toFixed(4)}deg`;
  return (
    `timeSlope delta=${(result.deltaFraction * 100).toFixed(1)}% ` +
    `first5s=${result.firstRmsEpsilonDeg.toFixed(3)}deg ` +
    `last5s=${result.lastRmsEpsilonDeg.toFixed(3)}deg ` +
    `span=${(result.windowSpanMs / 1000).toFixed(1)}s ticks=${result.firstTickCount}/${result.lastTickCount}${parity}`
  );
}
