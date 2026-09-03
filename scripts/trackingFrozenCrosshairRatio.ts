/**
 * WP-54 / T7 — can this condition tell tracking from not-tracking at all?
 *
 * Gate A's third round (T6 gate §12.8) answered "no" for the band-limited core matrix, with a
 * one-off probe script. That probe is the quantitative design target T6 handed to T7
 * (task-checklist T7 段, OQ-54-14), so it lives here as a pure function with regression tests —
 * same reason as `trackingStimulusFidelity.ts` (slice 17): `analyze-tracking-pilot.ts` runs
 * `main()` on import, so its logic is only testable from a separate module.
 *
 * **The measure.** Freeze the crosshair at the participant's own median aim over the scored
 * window and recompute ε(t). For someone who cannot see the target, holding still at their own
 * median is the best available strategy — that median already sits on the target's mean bearing.
 * The ratio
 *
 *     frozenRmsEpsilonDeg / actualRmsEpsilonDeg
 *
 * is therefore the **upper bound on how much this condition can discriminate** between a
 * participant who tracks and one who does not move at all. A ratio near 1 means the stimulus left
 * ε no room to differ: the condition measures nothing about tracking, however faithfully it is
 * instrumented (C-D3 — such a metric must not reach a coach report).
 *
 * Measured anchors from Gate A round 3 (P04 s0 + P05 s1, G3 stimulus, gate §12.8):
 * reversal family **2.08–3.26** (discriminating); 20 deg/s cells 1.38–1.49; the three 5 deg/s
 * cells and both axis calibration blocks **1.05–1.25** (not discriminating).
 *
 * **No second definition of ε or of the scored window (C-D4).** Both RMS figures come from
 * `angularEccentricityDeg()` — the single TS implementation — over the exact tick set the
 * canonical P0 `rmsEpsilonDeg` uses (`scored_start`-adapted presentation, from first-on-target to
 * window end, as in `deriveTrackingDynamics()`). `canonicalRmsEpsilonDeg` is carried in the result
 * so that identity is visible on every run, not just asserted in a test.
 */
import type { ExportPayload } from '../src/data/export.ts';
import type { TickRecord } from '../src/data/RingBuffer.ts';
import { angularEccentricityDeg, resolveEyeOrigin, type ResolvedEyeOrigin } from '../src/metrics/eyeOrigin.ts';
import { deriveTrackingMetrics } from '../src/metrics/trackingDerivation.ts';
import { adaptPayloadForScoredWindow, pickPresentation } from '../src/metrics/trackingDynamics.ts';

const EPSILON = 1e-9;
const RAD_TO_DEG = 180 / Math.PI;
/** Same floor as the canonical P1 pipeline's `minValidTicks` (D-54.21) — one definition of "too
 * few ticks to say anything", not a new knob. */
const DEFAULT_MIN_TICKS = 32;

export type TrackingFrozenCrosshairStatus =
  | 'ok'
  /** No `scored_start`-windowed presentation, or the participant never acquired the target — the
   * canonical `rmsEpsilonDeg` this ratio divides by does not exist (P0 reports that separately). */
  | 'no-scored-window'
  | 'insufficient-ticks'
  | 'missing-target-telemetry';

export interface TrackingFrozenCrosshairResult {
  readonly status: TrackingFrozenCrosshairStatus;
  /** RMS ε(t) with the crosshair frozen at the median aim — the "did not move at all" baseline. */
  readonly frozenRmsEpsilonDeg: number;
  /** RMS ε(t) the participant actually achieved, recomputed over the same ticks. */
  readonly actualRmsEpsilonDeg: number;
  /** The canonical P0 figure, for the C-D4 identity check; equals `actualRmsEpsilonDeg`. */
  readonly canonicalRmsEpsilonDeg: number;
  /** `frozen / actual`. NaN when not `ok`. Unbounded above — `acos` near dot=1 floors a flawless
   * follower's ε at ~5e-7 deg rather than 0, so the ratio grows very large instead of dividing by
   * zero. */
  readonly ratio: number;
  /** Largest ε the frozen crosshair sees — the target's angular sweep about that median. */
  readonly maxFrozenEpsilonDeg: number;
  readonly frozenAimYawDeg: number;
  readonly frozenAimPitchDeg: number;
  readonly tickCount: number;
}

const NOT_COMPUTED = {
  frozenRmsEpsilonDeg: Number.NaN,
  actualRmsEpsilonDeg: Number.NaN,
  canonicalRmsEpsilonDeg: Number.NaN,
  ratio: Number.NaN,
  maxFrozenEpsilonDeg: Number.NaN,
  frozenAimYawDeg: Number.NaN,
  frozenAimPitchDeg: Number.NaN,
  tickCount: 0,
} as const;

export function computeTrackingFrozenCrosshairRatio(
  payload: ExportPayload,
  options: { readonly minTicks?: number } = {},
): TrackingFrozenCrosshairResult {
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

  const eyeOrigin = resolveEyeOrigin(payload);
  const frozenAim = medianAim(windowTicks);

  const actual: number[] = [];
  const frozen: number[] = [];
  let maxFrozenEpsilonDeg = 0;
  for (const tick of windowTicks) {
    const target = { x: tick.tx!, y: tick.ty!, z: tick.tz! };
    actual.push(angularEccentricityDeg(tick, target, eyeOrigin));
    const frozenEpsilon = frozenEpsilonDeg(tick, target, frozenAim, eyeOrigin);
    frozen.push(frozenEpsilon);
    maxFrozenEpsilonDeg = Math.max(maxFrozenEpsilonDeg, frozenEpsilon);
  }

  const actualRmsEpsilonDeg = rms(actual);
  const frozenRmsEpsilonDeg = rms(frozen);
  return {
    status: 'ok',
    frozenRmsEpsilonDeg,
    actualRmsEpsilonDeg,
    canonicalRmsEpsilonDeg: metrics.rmsEpsilonDeg!,
    ratio: frozenRmsEpsilonDeg / actualRmsEpsilonDeg,
    maxFrozenEpsilonDeg,
    frozenAimYawDeg: frozenAim.yaw * RAD_TO_DEG,
    frozenAimPitchDeg: frozenAim.pitch * RAD_TO_DEG,
    tickCount: windowTicks.length,
  };
}

/** ε(t) as if the aim had been held at `frozenAim` for the whole window — same geometry function,
 * only the aim substituted. Player position still comes from the tick: `px/pz` are frozen by the
 * no-movement protocol guard anyway, and reading them keeps the eye origin honest if it is not. */
function frozenEpsilonDeg(
  tick: TickRecord,
  target: { x: number; y: number; z: number },
  frozenAim: { readonly yaw: number; readonly pitch: number },
  eyeOrigin: ResolvedEyeOrigin,
): number {
  return angularEccentricityDeg({ px: tick.px, pz: tick.pz, aim: frozenAim }, target, eyeOrigin);
}

/**
 * Median aim over the window, in radians. Yaw is unwrapped against the first tick before the
 * median is taken (a run that crosses ±π would otherwise average to the opposite bearing); the
 * unwrapped value is fed straight to `aimForward()`, which is periodic, so no re-normalization.
 * Percentile convention mirrors `trackingDerivation`'s `percentile(values, 50)`.
 */
function medianAim(ticks: readonly TickRecord[]): { readonly yaw: number; readonly pitch: number } {
  const first = ticks[0].aim.yaw;
  const yaws = ticks.map((tick) => first + normalizeRad(tick.aim.yaw - first));
  return { yaw: median(yaws), pitch: median(ticks.map((tick) => tick.aim.pitch)) };
}

function normalizeRad(value: number): number {
  const twoPi = 2 * Math.PI;
  let out = value % twoPi;
  if (out > Math.PI) out -= twoPi;
  if (out < -Math.PI) out += twoPi;
  return out;
}

function median(values: readonly number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const rank = (sorted.length - 1) / 2;
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

/** Mirrors `trackingDerivation`'s `rms()` — same accumulation order, so `actualRmsEpsilonDeg`
 * reproduces the canonical `rmsEpsilonDeg` rather than merely approximating it. */
function rms(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const meanSquare = values.reduce((sum, value) => sum + value * value, 0) / values.length;
  return Math.sqrt(meanSquare);
}

/** One-line console rendering for the analysis runner's per-run block. */
export function formatTrackingFrozenCrosshairRatio(result: TrackingFrozenCrosshairResult): string {
  if (result.status !== 'ok') return `discriminability=${result.status}`;
  // A drift between the two would mean the ratio no longer divides the canonical P0 figure.
  const parity =
    Math.abs(result.actualRmsEpsilonDeg - result.canonicalRmsEpsilonDeg) <= 1e-9
      ? ''
      : ` !!P0-MISMATCH canonical=${result.canonicalRmsEpsilonDeg.toFixed(4)}deg`;
  return (
    `discriminability ratio=${result.ratio.toFixed(2)} ` +
    `frozenRmsEps=${result.frozenRmsEpsilonDeg.toFixed(3)}deg ` +
    `actualRmsEps=${result.actualRmsEpsilonDeg.toFixed(3)}deg ` +
    `frozenSweep=${result.maxFrozenEpsilonDeg.toFixed(2)}deg ticks=${result.tickCount}${parity}`
  );
}
