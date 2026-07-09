import type { ExportPayload } from '../data/export.ts';

/**
 * WP-18 / T4 tracking metrics offline derivation (GD-7).
 *
 * The engine records raw schema v2 ticks/events only; the tracking metrics
 * (`t_acquire`, TOT%, RMS ε) are derived offline from those rows — zero new sim computation,
 * zero new threshold parameter. This module is the executable interface (dev verifier, test
 * level, not a hot path) alongside the prose spec `docs/operational/analysis-tracking.md`.
 *
 * Mirrors the WP-21 T3 detection derivation pattern (`detectionDerivation.ts`): consume the
 * production `ExportPayload` JSON shape, one presentation per `visible` event.
 *
 * Definitions (CONTEXT §A / GD-7):
 *   - on-target(tick) = aim ray ∩ H1 hitbox (same geometry as hit detection, no new threshold).
 *   - ε(t)            = unsigned angle between aim ray and target center, in degrees.
 *   - t_acquire       = t_first_on_target − t_visible; whole presentation off-target → acquisition
 *                       failure (counts toward failure rate, excluded from TOT aggregation).
 *   - tracking window = [t_first_on_target, presentation end).
 *   - TOT%            = fraction of tracking-window ticks that are on-target.
 *   - primary stat    = RMS(ε) over the tracking window (median/P95 are offline secondary).
 */

export interface HitboxSize {
  width: number;
  height: number;
  depth: number;
}

export interface TrackingDerivationOptions {
  /** Player eye height (source units); defaults to 1.6, matching the scene/player eye height. */
  eyeHeight?: number;
  /**
   * H1 hitbox dimensions used to reconstruct the on-target box (source units). Defaults to the
   * engine H1 box (width 1, height 2, depth 1). This is a structural constant of the target, not
   * a tuning knob — it is not exported per tick, so it is supplied here to keep the on-target
   * geometry identical to the engine hit detector.
   */
  hitbox?: HitboxSize;
}

export interface ResolvedTrackingDerivationOptions {
  eyeHeight: number;
  hitbox: HitboxSize;
}

export interface TrackingPresentationDerivation {
  targetId: string;
  tVisibleMs: number;
  /** Right edge of the presentation window (next visible.t, or Infinity for the last one). */
  windowEndMs: number;
  /** Ticks evaluated inside the presentation window [t_visible, windowEnd). */
  presentationTickCount: number;
  /** True when no tick in the presentation was on-target (acquisition failure, not missing data). */
  acquisitionFailure: boolean;
  tFirstOnTargetMs?: number;
  tAcquireMs?: number;
  /** Ticks in the tracking window [t_first_on_target, windowEnd). */
  trackingWindowTickCount?: number;
  /** On-target ticks inside the tracking window. */
  onTargetTickCount?: number;
  /** TOT% in [0,100] over the tracking window; undefined on acquisition failure. */
  totPercent?: number;
  /** Primary statistic: RMS(ε) in degrees over the tracking window; undefined on acquisition failure. */
  rmsEpsilonDeg?: number;
  /** Offline secondary: median ε in degrees over the tracking window. */
  medianEpsilonDeg?: number;
  /** Offline secondary: 95th-percentile ε in degrees over the tracking window. */
  p95EpsilonDeg?: number;
}

export interface TrackingDerivationResult {
  options: ResolvedTrackingDerivationOptions;
  presentations: TrackingPresentationDerivation[];
  /** Acquisition failures / total presentations, in [0,1]; 0 when there are no presentations. */
  acquisitionFailureRate: number;
}

type Tick = ExportPayload['ticks'][number];
type VisibleEvent = Extract<ExportPayload['events'][number], { type: 'visible' }>;

interface TargetPoint {
  x: number;
  y: number;
  z: number;
}

interface TrackingSample {
  t: number;
  onTarget: boolean;
  epsilonDeg: number;
}

const DEFAULT_OPTIONS: ResolvedTrackingDerivationOptions = {
  eyeHeight: 1.6,
  hitbox: { width: 1, height: 2, depth: 1 },
};

const EPSILON = 1e-9;

export function deriveTrackingMetrics(
  payload: ExportPayload,
  options: TrackingDerivationOptions = {},
): TrackingDerivationResult {
  const resolved = resolveOptions(options);
  const ticks = payload.ticks.slice().sort((a, b) => a.t - b.t);
  const visibleEvents = payload.events
    .filter((event): event is VisibleEvent => event.type === 'visible')
    .slice()
    .sort((a, b) => a.t - b.t);

  const presentations = visibleEvents.map((visible, index) =>
    derivePresentation(visible, visibleEvents[index + 1], ticks, resolved),
  );
  const failures = presentations.filter((p) => p.acquisitionFailure).length;
  const acquisitionFailureRate = presentations.length > 0 ? failures / presentations.length : 0;
  return { options: resolved, presentations, acquisitionFailureRate };
}

function derivePresentation(
  visible: VisibleEvent,
  nextVisible: VisibleEvent | undefined,
  ticks: readonly Tick[],
  options: ResolvedTrackingDerivationOptions,
): TrackingPresentationDerivation {
  const windowEnd = nextVisible?.t ?? Infinity;
  const fallbackTarget = targetFromVisibleOrFirstTick(visible, ticks);
  const samples = trackingSamples(ticks, visible.t, windowEnd, fallbackTarget, options);

  const firstOnTarget = samples.find((sample) => sample.onTarget);
  if (firstOnTarget === undefined) {
    return {
      targetId: visible.targetId,
      tVisibleMs: visible.t,
      windowEndMs: windowEnd,
      presentationTickCount: samples.length,
      acquisitionFailure: true,
    };
  }

  const tFirstOnTargetMs = firstOnTarget.t;
  const windowSamples = samples.filter((sample) => sample.t + EPSILON >= tFirstOnTargetMs);
  const onTargetTickCount = windowSamples.filter((sample) => sample.onTarget).length;
  const epsilons = windowSamples.map((sample) => sample.epsilonDeg);

  return {
    targetId: visible.targetId,
    tVisibleMs: visible.t,
    windowEndMs: windowEnd,
    presentationTickCount: samples.length,
    acquisitionFailure: false,
    tFirstOnTargetMs,
    tAcquireMs: tFirstOnTargetMs - visible.t,
    trackingWindowTickCount: windowSamples.length,
    onTargetTickCount,
    totPercent: windowSamples.length > 0 ? (onTargetTickCount / windowSamples.length) * 100 : 0,
    rmsEpsilonDeg: rms(epsilons),
    medianEpsilonDeg: percentile(epsilons, 50),
    p95EpsilonDeg: percentile(epsilons, 95),
  };
}

function trackingSamples(
  ticks: readonly Tick[],
  startMs: number,
  endMs: number,
  fallbackTarget: TargetPoint,
  options: ResolvedTrackingDerivationOptions,
): TrackingSample[] {
  const samples: TrackingSample[] = [];
  for (const tick of ticks) {
    if (tick.t + EPSILON < startMs || tick.t >= endMs - EPSILON) continue;
    const target = targetForTick(tick, fallbackTarget);
    samples.push({
      t: tick.t,
      onTarget: isOnTarget(tick, target, options),
      epsilonDeg: angularEccentricityDeg(tick, target, options.eyeHeight),
    });
  }
  return samples;
}

/**
 * on-target = aim ray (t ≥ 0) intersects the H1 hitbox AABB centered at the target. Ray/box slab
 * test, equivalent to `THREE.Ray.intersectBox` used by the engine hit detector (same geometry,
 * no new threshold parameter).
 */
function isOnTarget(tick: Tick, target: TargetPoint, options: ResolvedTrackingDerivationOptions): boolean {
  const dir = aimForward(tick.aim.yaw, tick.aim.pitch);
  const ox = tick.px;
  const oy = options.eyeHeight;
  const oz = tick.pz;
  const hw = options.hitbox.width / 2;
  const hh = options.hitbox.height / 2;
  const hd = options.hitbox.depth / 2;

  let tmin = -Infinity;
  let tmax = Infinity;

  for (const [o, d, lo, hi] of [
    [ox, dir.x, target.x - hw, target.x + hw],
    [oy, dir.y, target.y - hh, target.y + hh],
    [oz, dir.z, target.z - hd, target.z + hd],
  ] as const) {
    if (Math.abs(d) < EPSILON) {
      if (o < lo || o > hi) return false; // ray parallel to slab and outside it
      continue;
    }
    let t1 = (lo - o) / d;
    let t2 = (hi - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return false;
  }
  return tmax >= Math.max(tmin, 0); // intersection lies at t ≥ 0 (in front of the aim origin)
}

function angularEccentricityDeg(tick: Tick, target: TargetPoint, eyeHeight: number): number {
  const aim = aimForward(tick.aim.yaw, tick.aim.pitch);
  const dx = target.x - tick.px;
  const dy = target.y - eyeHeight;
  const dz = target.z - tick.pz;
  const len = Math.hypot(dx, dy, dz);
  if (len === 0) return 0;

  const dot = aim.x * (dx / len) + aim.y * (dy / len) + aim.z * (dz / len);
  return radToDeg(Math.acos(clamp(dot, -1, 1)));
}

function aimForward(yaw: number, pitch: number): TargetPoint {
  const cosPitch = Math.cos(pitch);
  return {
    x: -Math.sin(yaw) * cosPitch,
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * cosPitch,
  };
}

function targetFromVisibleOrFirstTick(visible: VisibleEvent, ticks: readonly Tick[]): TargetPoint {
  if (isFiniteNumber(visible.targetX) && isFiniteNumber(visible.targetY) && isFiniteNumber(visible.targetZ)) {
    return { x: visible.targetX, y: visible.targetY, z: visible.targetZ };
  }
  const tick = ticks.find((candidate) => candidate.t + EPSILON >= visible.t);
  if (tick !== undefined && tick.tx !== null && tick.ty !== null && tick.tz !== null) {
    return { x: tick.tx, y: tick.ty, z: tick.tz };
  }
  throw new Error(`cannot derive tracking metrics for ${visible.targetId}: visible target position is missing`);
}

function targetForTick(tick: Tick, fallback: TargetPoint): TargetPoint {
  if (tick.tx !== null && tick.ty !== null && tick.tz !== null) return { x: tick.tx, y: tick.ty, z: tick.tz };
  return fallback;
}

function resolveOptions(options: TrackingDerivationOptions): ResolvedTrackingDerivationOptions {
  const hitbox = options.hitbox ?? DEFAULT_OPTIONS.hitbox;
  return {
    eyeHeight: finite(options.eyeHeight ?? DEFAULT_OPTIONS.eyeHeight, 'eyeHeight'),
    hitbox: {
      width: positiveFinite(hitbox.width, 'hitbox.width'),
      height: positiveFinite(hitbox.height, 'hitbox.height'),
      depth: positiveFinite(hitbox.depth, 'hitbox.depth'),
    },
  };
}

function rms(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const meanSquare = values.reduce((sum, value) => sum + value * value, 0) / values.length;
  return Math.sqrt(meanSquare);
}

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

function positiveFinite(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive finite number`);
  return value;
}

function finite(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  return value;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function radToDeg(value: number): number {
  return (value * 180) / Math.PI;
}
