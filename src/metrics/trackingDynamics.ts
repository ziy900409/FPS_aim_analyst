import type { ExportPayload } from '../data/export.ts';
import type { TickRecord } from '../data/RingBuffer.ts';
import {
  deriveTrackingMetrics,
  deriveTrackingSamples,
  type TrackingSample,
} from './trackingDerivation.ts';
import { deriveTrackingTransitions } from './trackingTransitions.ts';
import { eyeOriginForTick, type ResolvedEyeOrigin } from './eyeOrigin.ts';

/**
 * trackingDynamics — WP-54 / T3（README §2.4/§2.5, FR-54-6~9, NFR-54-2/3）.
 *
 * P1 canonical derivation for the tracking pilot: lag/gain/residual, drop/reacquire recovery,
 * directional bias, and (separately) reversal step-response windows. Offline-only, pure functions
 * of `ExportPayload` — no sim computation, no `Date.now()`/`Math.random()` (CLAUDE.md §4).
 *
 * P0 reuse contract (D-54.13, see progress.md): this module never modifies
 * `trackingDerivation.ts`. WP-54 blocks need the pursuit window to start at `scored_start`
 * (post prep-centering), not `visible` — so `adaptPayloadForScoredWindow()` builds a shallow
 * payload copy that replaces each `visible` event's `t` (and target position) with the matching
 * `scored_start` event's `t`/position for the same `targetId`, then calls the unmodified
 * `deriveTrackingMetrics()`/`deriveTrackingSamples()` on that copy. When a payload has no
 * `scored_start` events at all (e.g. a legacy tracking export), the payload passes through
 * unchanged and this module falls back to plain `visible`-windowed P0 — permissive, not an error.
 */

const EPSILON = 1e-9;
const RAD_TO_DEG = 180 / Math.PI;

export interface TrackingDynamicsOptions {
  readonly version: 'tracking-dynamics-v1';
  readonly lagSearchMs: readonly [number, number];
  readonly smoothingVersion: string;
  readonly minValidTicks: number;
  readonly correlationAmbiguityRatio: number;
}

export type TrackingDynamicsResult =
  | {
      readonly status: 'ok';
      readonly lagMs: number;
      readonly velocityGain: number;
      readonly velocityRmseDegPerSec: number;
      readonly signedYawBiasDeg: number;
      readonly signedPitchBiasDeg: number;
      readonly dropRatePerSec: number;
      readonly completedReacquireCount: number;
      readonly terminalDropCount: number;
      readonly longestOffTargetMs: number;
    }
  | {
      readonly status: 'blocked';
      readonly reason:
        | 'insufficient-valid-ticks'
        | 'no-acquisition'
        | 'lag-peak-ambiguous'
        | 'missing-target-telemetry'
        | 'protocol-incompatible';
    };

type ScoredStartEvent = Extract<ExportPayload['events'][number], { type: 'scored_start' }>;
type ProtocolViolationEvent = Extract<ExportPayload['events'][number], { type: 'protocol_violation' }>;
type MotionChangeEvent = Extract<ExportPayload['events'][number], { type: 'target_motion_change' }>;

// ---------------------------------------------------------------------------
// P0 reuse: scored_start-based window adapter (no change to trackingDerivation.ts)
// ---------------------------------------------------------------------------

/**
 * Shallow payload copy for P0 windowing purposes only: each `visible` event whose `targetId` has a
 * matching `scored_start` event has its `t`/target position replaced by that `scored_start`'s
 * `t`/position. This makes `deriveTrackingMetrics`/`deriveTrackingSamples` window pursuit from
 * `scored_start` instead of `visible`, excluding the `timing.trackingPrepMs` centering window from
 * aggregation (FR-54-6) — without touching the 11-caller canonical derivation.
 */
function adaptPayloadForScoredWindow(payload: ExportPayload): ExportPayload {
  const scoredStarts = payload.events.filter((event): event is ScoredStartEvent => event.type === 'scored_start');
  if (scoredStarts.length === 0) return payload;

  const byTargetId = new Map(scoredStarts.map((event) => [event.targetId, event]));
  const events = payload.events.map((event) => {
    if (event.type !== 'visible') return event;
    const scoredStart = byTargetId.get(event.targetId);
    if (scoredStart === undefined) return event;
    return {
      ...event,
      t: scoredStart.t,
      targetX: scoredStart.targetX,
      targetY: scoredStart.targetY,
      targetZ: scoredStart.targetZ,
    };
  });
  return { ...payload, events };
}

function pickPresentation<T extends { targetId: string }>(
  presentations: readonly T[],
  targetId: string | undefined,
): T | undefined {
  if (presentations.length === 0) return undefined;
  if (targetId === undefined) return presentations[0];
  return presentations.find((p) => p.targetId === targetId) ?? presentations[0];
}

// ---------------------------------------------------------------------------
// Canonical P1 entry point
// ---------------------------------------------------------------------------

export function deriveTrackingDynamics(
  payload: ExportPayload,
  options: TrackingDynamicsOptions,
): TrackingDynamicsResult {
  const scoredStarts = payload.events.filter((event): event is ScoredStartEvent => event.type === 'scored_start');
  const targetId = scoredStarts[0]?.targetId;
  const adapted = adaptPayloadForScoredWindow(payload);

  const samplesResult = deriveTrackingSamples(adapted);
  const metricsResult = deriveTrackingMetrics(adapted);
  const presentationSamples = pickPresentation(samplesResult.presentations, targetId);
  const presentationMetrics = pickPresentation(metricsResult.presentations, targetId);

  if (presentationSamples === undefined || presentationMetrics === undefined) {
    return { status: 'blocked', reason: 'insufficient-valid-ticks' };
  }

  const scoredStartMs = presentationSamples.tVisibleMs;
  const windowEndMs = presentationSamples.windowEndMs;

  // FR-54-8/README §2.4 protocol-incompatible: any protocol_violation inside the scored window
  // (from scored_start to window end) invalidates this metric, regardless of acquisition outcome.
  const hasViolation = payload.events.some(
    (event): event is ProtocolViolationEvent =>
      event.type === 'protocol_violation' && event.t + EPSILON >= scoredStartMs && event.t < windowEndMs - EPSILON,
  );
  if (hasViolation) return { status: 'blocked', reason: 'protocol-incompatible' };

  // FR-54-8 risk register: acquisition failure must never be masked as pursuit data. P0's own
  // acquisitionFailureRate is unaffected by this — the caller derives it separately from the same
  // canonical deriveTrackingMetrics() result.
  if (presentationMetrics.acquisitionFailure) return { status: 'blocked', reason: 'no-acquisition' };

  const tFirstOnTargetMs = presentationMetrics.tFirstOnTargetMs!;
  const sortedTicks = payload.ticks.slice().sort((a, b) => a.t - b.t);
  const windowTicks = sortedTicks.filter(
    (tick) => tick.t + EPSILON >= tFirstOnTargetMs && tick.t < windowEndMs - EPSILON,
  );

  if (hasMissingTelemetry(windowTicks)) return { status: 'blocked', reason: 'missing-target-telemetry' };
  if (windowTicks.length < options.minValidTicks) return { status: 'blocked', reason: 'insufficient-valid-ticks' };

  const eyeOrigin = metricsResult.options.eyeOrigin;
  const rawSeries = computeSignedOmegaSeries(windowTicks, eyeOrigin);

  const tickMs = 1000 / payload.meta.simHz;
  const [loMs, hiMs] = options.lagSearchMs;
  const minK = Math.max(0, Math.round(loMs / tickMs));
  const maxK = Math.max(minK, Math.round(hiMs / tickMs));
  if (rawSeries.length <= maxK) return { status: 'blocked', reason: 'insufficient-valid-ticks' };

  const series = applySmoothingToSeries(rawSeries, options.smoothingVersion);
  const lagResult = searchLag(series, minK, maxK, tickMs, options.correlationAmbiguityRatio);
  if (lagResult.status === 'ambiguous') return { status: 'blocked', reason: 'lag-peak-ambiguous' };

  const bias = computeSignedBias(windowTicks, eyeOrigin);
  const transitions = deriveTrackingTransitions(presentationSamples.samples, presentationSamples.targetId);
  const completedReacquireCount = transitions.reacquireMs.length;
  const terminalDropCount = transitions.dropCount - completedReacquireCount;
  const { longestOffTargetMs } = scanLongestOffTarget(presentationSamples.samples);
  const pursuitDurationSec = pursuitDurationSeconds(presentationSamples.samples, tFirstOnTargetMs);
  const dropRatePerSec = pursuitDurationSec > 0 ? transitions.dropCount / pursuitDurationSec : 0;

  return {
    status: 'ok',
    lagMs: lagResult.lagMs,
    velocityGain: lagResult.gain,
    velocityRmseDegPerSec: lagResult.rmseDegPerSec,
    signedYawBiasDeg: bias.yaw,
    signedPitchBiasDeg: bias.pitch,
    dropRatePerSec,
    completedReacquireCount,
    terminalDropCount,
    longestOffTargetMs,
  };
}

// ---------------------------------------------------------------------------
// Target/aim angular kinematics (signed, tick-integral, wraparound-safe)
// ---------------------------------------------------------------------------

interface OmegaPairSample {
  readonly t: number;
  readonly targetYawOmega: number;
  readonly targetPitchOmega: number;
  readonly aimYawOmega: number;
  readonly aimPitchOmega: number;
}

function hasMissingTelemetry(ticks: readonly TickRecord[]): boolean {
  for (let i = 0; i < ticks.length; i++) {
    const tick = ticks[i];
    if (tick.tx === null || tick.ty === null || tick.tz === null) return true;
    if (i > 0 && (!isFiniteNumber(tick.dYaw) || !isFiniteNumber(tick.dPitch))) return true;
  }
  return false;
}

/**
 * Signed 2D (yaw, pitch) angular velocity for both target and aim, one sample per consecutive tick
 * pair (index 0 of `ticks` produces no sample — same "first sample needs a predecessor" contract as
 * `angularKinematics.ts`'s `omegaDegPerSec`). Aim omega reads `tick.dYaw`/`dPitch` (KI-005 tick-window
 * mouse integration) directly rather than differencing `aim.yaw`/`aim.pitch` — same
 * render/sim-beat-aliasing avoidance rationale as `omegaDegPerSec`. Target omega is derived by
 * inverting `aimForward` (the exact algebraic inverse: `yaw = atan2(-dx,-dz)`, `pitch = asin(dy)`)
 * against the per-tick target position, tick-differenced with wraparound handled explicitly (a
 * band-limited/reversal trajectory can cross the ±180° seam depending on config bounds).
 */
function computeSignedOmegaSeries(ticks: readonly TickRecord[], eyeOrigin: ResolvedEyeOrigin): OmegaPairSample[] {
  const out: OmegaPairSample[] = [];
  for (let i = 1; i < ticks.length; i++) {
    const previous = ticks[i - 1];
    const current = ticks[i];
    const dtS = (current.t - previous.t) / 1000;
    if (dtS <= 0) throw new Error('trackingDynamics: tick timestamps must be strictly increasing');

    const previousTarget = targetAnglesDeg(previous, eyeOrigin);
    const currentTarget = targetAnglesDeg(current, eyeOrigin);
    const targetYawOmega = wrapDeltaDeg(currentTarget.yawDeg - previousTarget.yawDeg) / dtS;
    const targetPitchOmega = wrapDeltaDeg(currentTarget.pitchDeg - previousTarget.pitchDeg) / dtS;

    const aimYawOmega = (radToDeg(current.dYaw!) ) / dtS;
    const aimPitchOmega = (radToDeg(current.dPitch!)) / dtS;

    out.push({ t: current.t, targetYawOmega, targetPitchOmega, aimYawOmega, aimPitchOmega });
  }
  return out;
}

function targetAnglesDeg(tick: TickRecord, eyeOrigin: ResolvedEyeOrigin): { yawDeg: number; pitchDeg: number } {
  const eye = eyeOriginForTick(tick, eyeOrigin);
  const dx = tick.tx! - eye.x;
  const dy = tick.ty! - eye.y;
  const dz = tick.tz! - eye.z;
  const len = Math.hypot(dx, dy, dz);
  const pitchRad = Math.asin(clamp(dy / len, -1, 1));
  const yawRad = Math.atan2(-dx, -dz);
  return { yawDeg: radToDeg(yawRad), pitchDeg: radToDeg(pitchRad) };
}

function computeSignedBias(ticks: readonly TickRecord[], eyeOrigin: ResolvedEyeOrigin): { yaw: number; pitch: number } {
  let yawSum = 0;
  let pitchSum = 0;
  for (const tick of ticks) {
    const target = targetAnglesDeg(tick, eyeOrigin);
    const aimYawDeg = radToDeg(tick.aim.yaw);
    const aimPitchDeg = radToDeg(tick.aim.pitch);
    yawSum += wrapDeltaDeg(aimYawDeg - target.yawDeg);
    pitchSum += wrapDeltaDeg(aimPitchDeg - target.pitchDeg);
  }
  return { yaw: yawSum / ticks.length, pitch: pitchSum / ticks.length };
}

// ---------------------------------------------------------------------------
// Offline fixed-coefficient smoothing (D-54.5, OQ-54-4) — versioned, applied to the omega series
// only (bias uses raw tick angles and is unaffected). Unknown `smoothingVersion` fails fast, same
// discipline as `trackingTrajectory.ts`'s unknown-`kind` guard: a config/version error, not one of
// the five closed blocked-result reasons.
// ---------------------------------------------------------------------------

type SmoothingKernel = readonly number[];

const SMOOTHING_KERNELS: Readonly<Record<string, SmoothingKernel>> = {
  'tracking-dynamics-smoothing-v1-none': [1],
  /** Symmetric 3-tap triangular FIR (edge taps renormalized against available neighbors). */
  'tracking-dynamics-smoothing-v1-tri3': [0.25, 0.5, 0.25],
};

function resolveSmoothingKernel(version: string): SmoothingKernel {
  const kernel = SMOOTHING_KERNELS[version];
  if (kernel === undefined) throw new Error(`trackingDynamics: unknown smoothingVersion "${version}"`);
  return kernel;
}

function applySmoothing(values: readonly number[], kernel: SmoothingKernel): number[] {
  if (kernel.length === 1) return values.slice();
  const half = (kernel.length - 1) / 2;
  const out = new Array<number>(values.length);
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    let weightSum = 0;
    for (let k = -half; k <= half; k++) {
      const idx = i + k;
      if (idx < 0 || idx >= values.length) continue;
      const w = kernel[k + half];
      sum += values[idx] * w;
      weightSum += w;
    }
    out[i] = weightSum > 0 ? sum / weightSum : values[i];
  }
  return out;
}

function applySmoothingToSeries(series: readonly OmegaPairSample[], smoothingVersion: string): OmegaPairSample[] {
  const kernel = resolveSmoothingKernel(smoothingVersion);
  if (kernel.length === 1) return series.slice();
  const targetYaw = applySmoothing(series.map((s) => s.targetYawOmega), kernel);
  const targetPitch = applySmoothing(series.map((s) => s.targetPitchOmega), kernel);
  const aimYaw = applySmoothing(series.map((s) => s.aimYawOmega), kernel);
  const aimPitch = applySmoothing(series.map((s) => s.aimPitchOmega), kernel);
  return series.map((sample, i) => ({
    t: sample.t,
    targetYawOmega: targetYaw[i],
    targetPitchOmega: targetPitch[i],
    aimYawOmega: aimYaw[i],
    aimPitchOmega: aimPitch[i],
  }));
}

// ---------------------------------------------------------------------------
// Lag search, positive-lag sign contract, velocity gain, velocity residual
// ---------------------------------------------------------------------------

interface LagSearchOk {
  readonly status: 'ok';
  readonly lagMs: number;
  readonly gain: number;
  readonly rmseDegPerSec: number;
}
interface LagSearchAmbiguous {
  readonly status: 'ambiguous';
}

/**
 * `corr(omega_target(t), omega_aim(t + tau))` maximized over `tau` in `options.lagSearchMs`
 * (D-54.5, tau quantized to whole sim ticks — assumes the fixed-step sim's uniform tick spacing,
 * not a generic irregularly-sampled algorithm). `tau > 0` means aim lags target (README §2.4 sign
 * contract). Peak selection uses the *mean* dot product per candidate `k` (fair across different
 * overlap lengths near the search boundary); `gain`/`rmse` are then computed from the *sum* dot
 * products at the chosen `k`, matching the README formula's `sum(...)/sum(...)` shape exactly
 * (sum vs. mean over an identical index range are proportional, so this is equivalent to always
 * normalizing by the same overlap count).
 *
 * Ambiguity (D-54.5 / OQ-54-4): local peaks of the mean-correlation-vs-tau curve are collected;
 * if a 2nd-best peak exists whose value exceeds `1 / options.correlationAmbiguityRatio` times the
 * best peak's value, the result is `lag-peak-ambiguous` — a periodic/multi-peak signal must never
 * resolve to one silently-chosen lag/gain.
 */
function searchLag(
  series: readonly OmegaPairSample[],
  minK: number,
  maxK: number,
  tickMs: number,
  correlationAmbiguityRatio: number,
): LagSearchOk | LagSearchAmbiguous {
  const n = series.length;
  const meanCorrByK = new Map<number, number>();
  for (let k = minK; k <= maxK; k++) {
    const overlap = n - k;
    if (overlap <= 0) continue;
    let sum = 0;
    for (let i = 0; i < overlap; i++) {
      sum +=
        series[i].targetYawOmega * series[i + k].aimYawOmega +
        series[i].targetPitchOmega * series[i + k].aimPitchOmega;
    }
    meanCorrByK.set(k, sum / overlap);
  }

  const ks = [...meanCorrByK.keys()].sort((a, b) => a - b);
  if (ks.length === 0) return { status: 'ambiguous' };

  const peaks = findLocalPeaks(ks, meanCorrByK);
  peaks.sort((a, b) => b.value - a.value);
  const best = peaks[0];
  if (peaks.length >= 2) {
    const second = peaks[1];
    const ratio = best.value !== 0 ? second.value / best.value : 1;
    if (ratio > 1 / correlationAmbiguityRatio) return { status: 'ambiguous' };
  }

  const kHat = best.k;
  const overlap = n - kHat;
  let corrSum = 0;
  let denomSum = 0;
  for (let i = 0; i < overlap; i++) {
    const target = series[i];
    const aim = series[i + kHat];
    corrSum += target.targetYawOmega * aim.aimYawOmega + target.targetPitchOmega * aim.aimPitchOmega;
    denomSum += target.targetYawOmega * target.targetYawOmega + target.targetPitchOmega * target.targetPitchOmega;
  }
  const gain = denomSum > 0 ? corrSum / denomSum : 0;

  let residualSumSq = 0;
  for (let i = 0; i < overlap; i++) {
    const target = series[i];
    const aim = series[i + kHat];
    const ryaw = aim.aimYawOmega - gain * target.targetYawOmega;
    const rpitch = aim.aimPitchOmega - gain * target.targetPitchOmega;
    residualSumSq += ryaw * ryaw + rpitch * rpitch;
  }
  const rmseDegPerSec = overlap > 0 ? Math.sqrt(residualSumSq / overlap) : 0;

  return { status: 'ok', lagMs: kHat * tickMs, gain, rmseDegPerSec };
}

function findLocalPeaks(
  ks: readonly number[],
  values: ReadonlyMap<number, number>,
): Array<{ k: number; value: number }> {
  const peaks: Array<{ k: number; value: number }> = [];
  for (let idx = 0; idx < ks.length; idx++) {
    const k = ks[idx];
    const value = values.get(k)!;
    const previousValue = idx > 0 ? values.get(ks[idx - 1])! : -Infinity;
    const nextValue = idx < ks.length - 1 ? values.get(ks[idx + 1])! : -Infinity;
    if (value >= previousValue && value >= nextValue) peaks.push({ k, value });
  }
  return peaks;
}

// ---------------------------------------------------------------------------
// Recovery aggregation: drop/sec, completed vs terminal-censored, longest off-target
// ---------------------------------------------------------------------------

/**
 * `deriveTrackingTransitions()`'s `dropCount` already counts every on->off transition after first
 * acquisition, including a final unrecovered ("terminal-censored") drop; `reacquireMs` only holds
 * *completed* drop->reacquire intervals. So `terminalDropCount = dropCount - reacquireMs.length`
 * recovers the terminal count for free, with no separate scan and no risk of double-counting.
 */
function scanLongestOffTarget(samples: readonly TrackingSample[]): { longestOffTargetMs: number } {
  const firstOnTargetIdx = samples.findIndex((sample) => sample.onTarget);
  if (firstOnTargetIdx < 0) return { longestOffTargetMs: 0 };

  let longest = 0;
  let runStartT: number | undefined;
  for (let i = firstOnTargetIdx + 1; i < samples.length; i++) {
    const previous = samples[i - 1];
    const current = samples[i];
    if (previous.onTarget && !current.onTarget) runStartT = current.t;
    if (!previous.onTarget && current.onTarget && runStartT !== undefined) {
      longest = Math.max(longest, current.t - runStartT);
      runStartT = undefined;
    }
  }
  if (runStartT !== undefined) {
    // Terminal open run (never reacquired): extends to the end of the observed window. This never
    // feeds into `reacquireMs`/`completedReacquireCount` — a terminal drop must not leak into a
    // "completed" duration number (§1.3 constraint).
    const lastT = samples[samples.length - 1].t;
    longest = Math.max(longest, lastT - runStartT);
  }
  return { longestOffTargetMs: longest };
}

function pursuitDurationSeconds(samples: readonly TrackingSample[], tFirstOnTargetMs: number): number {
  if (samples.length === 0) return 0;
  const lastT = samples[samples.length - 1].t;
  return Math.max(lastT - tFirstOnTargetMs, 0) / 1000;
}

// ---------------------------------------------------------------------------
// Reversal event windows (FR-54-9): response latency, peak error/overshoot, settling time
// ---------------------------------------------------------------------------

/**
 * Additive to `TrackingDynamicsResult` (README §2.4 does not list reversal-window fields in that
 * contract — this is a separate function for FR-54-9 / task-checklist T3's "reversal event windows"
 * item and README §2.5's "P1 reactive" row). Windowed on `target_motion_change` event boundaries
 * (T2's precomputed reversal leg schedule); pursuit (core matrix) blocks legitimately produce zero
 * such events, in which case `windows` is simply empty — not a blocked state (see
 * `src/sim/trackingTrajectory.ts`'s `changes` contract).
 */
export interface TrackingReversalWindowOptions {
  readonly version: 'tracking-dynamics-v1';
  /** Minimum ms after the change event required to evaluate peak/settling; else excluded. */
  readonly minWindowMs: number;
  /** Upper cap on how far past the change event to look for peak/settling. */
  readonly maxWindowMs: number;
  /** Minimum steady ms since the previous change event required for a clean baseline; else excluded. */
  readonly minBaselineMs: number;
  /** epsilon(t) must return to within `baselineErrorDeg + this` (and stay there) to count as settled. */
  readonly settlingToleranceDeg: number;
}

export interface TrackingReversalWindowMetrics {
  readonly targetId: string;
  readonly changeTMs: number;
  readonly excluded: boolean;
  readonly excludedReason?: 'overlap' | 'insufficient-window-data';
  readonly baselineErrorDeg?: number;
  readonly peakErrorDeg?: number;
  readonly overshootDeg?: number;
  readonly responseLatencyMs?: number;
  readonly settlingTimeMs?: number;
}

export interface TrackingReversalWindowsResult {
  readonly windows: readonly TrackingReversalWindowMetrics[];
}

/** Margin (deg) above baseline epsilon that counts as "the reversal has started to visibly disturb
 * tracking" — used only to detect the onset of `responseLatencyMs`, not a hit/on-target threshold. */
const RESPONSE_MARGIN_DEG = 1e-3;

export function deriveTrackingReversalWindows(
  payload: ExportPayload,
  options: TrackingReversalWindowOptions,
): TrackingReversalWindowsResult {
  const changes = payload.events
    .filter((event): event is MotionChangeEvent => event.type === 'target_motion_change')
    .slice()
    .sort((a, b) => a.t - b.t);
  if (changes.length === 0) return { windows: [] };

  const adapted = adaptPayloadForScoredWindow(payload);
  const samplesResult = deriveTrackingSamples(adapted);
  const targetId = changes[0].targetId;
  const presentation = pickPresentation(samplesResult.presentations, targetId);
  if (presentation === undefined) {
    return { windows: changes.map((change) => excludedWindow(change, 'insufficient-window-data')) };
  }

  const samples = presentation.samples;
  // `presentation.windowEndMs` is `Infinity` when there is no subsequent `visible` event (the usual
  // WP-54 case: one persistent target per run) — bound it by the last actually-recorded sample so
  // "not enough room before the run ends" is judged against real data, not an open-ended window.
  const lastSampleMs = samples.length > 0 ? samples[samples.length - 1].t : presentation.tVisibleMs;
  const scoredWindowEndMs = Math.min(presentation.windowEndMs, lastSampleMs);
  const windows: TrackingReversalWindowMetrics[] = [];

  for (let idx = 0; idx < changes.length; idx++) {
    const change = changes[idx];
    const previousChange = idx > 0 ? changes[idx - 1] : undefined;
    const nextChange = idx + 1 < changes.length ? changes[idx + 1] : undefined;
    const usableEndMs = Math.min(nextChange?.t ?? scoredWindowEndMs, change.t + options.maxWindowMs, scoredWindowEndMs);

    if (usableEndMs - change.t < options.minWindowMs) {
      windows.push(excludedWindow(change, 'insufficient-window-data'));
      continue;
    }
    if (previousChange !== undefined && change.t - previousChange.t < options.minBaselineMs) {
      windows.push(excludedWindow(change, 'overlap'));
      continue;
    }

    const baselineSample = lastSampleAtOrBefore(samples, change.t);
    const windowSamples = samples.filter((sample) => sample.t + EPSILON >= change.t && sample.t < usableEndMs - EPSILON);
    if (baselineSample === undefined || windowSamples.length === 0) {
      windows.push(excludedWindow(change, 'insufficient-window-data'));
      continue;
    }

    const baselineErrorDeg = baselineSample.epsilonDeg;
    let peakErrorDeg = -Infinity;
    for (const sample of windowSamples) {
      if (sample.epsilonDeg > peakErrorDeg) peakErrorDeg = sample.epsilonDeg;
    }
    const overshootDeg = Math.max(peakErrorDeg - baselineErrorDeg, 0);

    let responseLatencyMs: number | undefined;
    for (const sample of windowSamples) {
      if (sample.epsilonDeg > baselineErrorDeg + RESPONSE_MARGIN_DEG) {
        responseLatencyMs = sample.t - change.t;
        break;
      }
    }

    let settlingTimeMs: number | undefined;
    const tolerance = baselineErrorDeg + options.settlingToleranceDeg;
    for (let i = 0; i < windowSamples.length; i++) {
      if (windowSamples[i].epsilonDeg <= tolerance) {
        const staysSettled = windowSamples.slice(i).every((sample) => sample.epsilonDeg <= tolerance);
        if (staysSettled) {
          settlingTimeMs = windowSamples[i].t - change.t;
          break;
        }
      }
    }

    windows.push({
      targetId: change.targetId,
      changeTMs: change.t,
      excluded: false,
      baselineErrorDeg,
      peakErrorDeg,
      overshootDeg,
      responseLatencyMs,
      settlingTimeMs,
    });
  }

  return { windows };
}

function excludedWindow(
  change: MotionChangeEvent,
  reason: 'overlap' | 'insufficient-window-data',
): TrackingReversalWindowMetrics {
  return { targetId: change.targetId, changeTMs: change.t, excluded: true, excludedReason: reason };
}

function lastSampleAtOrBefore(samples: readonly TrackingSample[], t: number): TrackingSample | undefined {
  let result: TrackingSample | undefined;
  for (const sample of samples) {
    if (sample.t <= t + EPSILON) result = sample;
    else break;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Small utils
// ---------------------------------------------------------------------------

function wrapDeltaDeg(deltaDeg: number): number {
  let d = deltaDeg % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function radToDeg(value: number): number {
  return value * RAD_TO_DEG;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
