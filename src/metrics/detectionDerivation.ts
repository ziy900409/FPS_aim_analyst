import type { ExportPayload } from '../data/export.ts';

export interface DetectionDerivationOptions {
  preStimulusMs?: number;
  thresholdSdMultiplier?: number;
  sustainedTicks?: number;
  anticipationMs?: number;
  eyeHeight?: number;
}

export interface ResolvedDetectionDerivationOptions {
  preStimulusMs: number;
  thresholdSdMultiplier: number;
  sustainedTicks: number;
  anticipationMs: number;
  eyeHeight: number;
}

export type DetectionStatus = 'detected' | 'timeout';

export interface DetectionPresentationDerivation {
  targetId: string;
  tVisibleMs: number;
  spawnTickMs: number;
  spawnTickOffsetMs: number;
  status: DetectionStatus;
  eccentricityAtSpawnDeg: number;
  thresholdDegPerSec: number;
  baselineSdDegPerSec: number;
  baselineVelocitySampleCount: number;
  baselineInsufficient: boolean;
  samplesEvaluated: number;
  anticipation: boolean;
  tDetectMs?: number;
  reactionMs?: number;
}

export interface DetectionDerivationResult {
  options: ResolvedDetectionDerivationOptions;
  presentations: DetectionPresentationDerivation[];
}

type Tick = ExportPayload['ticks'][number];
type VisibleEvent = Extract<ExportPayload['events'][number], { type: 'visible' }>;

interface TargetPoint {
  x: number;
  y: number;
  z: number;
}

interface EccentricitySample {
  t: number;
  eccentricityDeg: number;
}

interface VelocitySample {
  t: number;
  degPerSec: number;
}

const DEFAULT_OPTIONS: ResolvedDetectionDerivationOptions = {
  preStimulusMs: 500,
  thresholdSdMultiplier: 3,
  sustainedTicks: 4,
  anticipationMs: 100,
  eyeHeight: 1.6,
};

const EPSILON = 1e-9;

export function deriveDetectionMetrics(
  payload: ExportPayload,
  options: DetectionDerivationOptions = {},
): DetectionDerivationResult {
  const resolved = resolveOptions(options);
  const ticks = payload.ticks.slice().sort((a, b) => a.t - b.t);
  const visibleEvents = payload.events
    .filter((event): event is VisibleEvent => event.type === 'visible')
    .slice()
    .sort((a, b) => a.t - b.t);

  const presentations = visibleEvents.map((visible, index) =>
    derivePresentation(visible, visibleEvents[index + 1], ticks, resolved),
  );
  return { options: resolved, presentations };
}

function derivePresentation(
  visible: VisibleEvent,
  nextVisible: VisibleEvent | undefined,
  ticks: readonly Tick[],
  options: ResolvedDetectionDerivationOptions,
): DetectionPresentationDerivation {
  const spawnTick = firstTickAtOrAfter(ticks, visible.t);
  if (spawnTick === undefined) {
    throw new Error(`cannot derive detection metrics for ${visible.targetId}: no tick at or after t_visible`);
  }

  const spawnTarget = targetFromVisibleOrTick(visible, spawnTick);
  const baselineSamples = eccentricitySamples(
    ticks,
    visible.t - options.preStimulusMs,
    visible.t,
    spawnTarget,
    options.eyeHeight,
    false,
  );
  const baselineVelocities = velocitySamples(baselineSamples);
  const baselineAbsVelocities = baselineVelocities.map((sample) => Math.abs(sample.degPerSec));
  const baselineSdDegPerSec = standardDeviation(baselineAbsVelocities);
  const thresholdDegPerSec = options.thresholdSdMultiplier * baselineSdDegPerSec;
  const baselineCoverageMs = baselineSamples.length > 0 ? visible.t - baselineSamples[0].t : 0;
  const baselineInsufficient =
    baselineVelocities.length < 2 || baselineCoverageMs + EPSILON < options.preStimulusMs;

  const windowEnd = nextVisible?.t ?? Infinity;
  const postSamples = eccentricitySamples(ticks, visible.t, windowEnd, spawnTarget, options.eyeHeight, true);
  const postVelocities = velocitySamples(postSamples);
  const tDetectMs = firstSustainedDecrease(postVelocities, thresholdDegPerSec, options.sustainedTicks);
  const reactionMs = tDetectMs !== undefined ? tDetectMs - visible.t : undefined;
  const status: DetectionStatus = tDetectMs !== undefined ? 'detected' : 'timeout';

  return {
    targetId: visible.targetId,
    tVisibleMs: visible.t,
    spawnTickMs: spawnTick.t,
    spawnTickOffsetMs: spawnTick.t - visible.t,
    status,
    eccentricityAtSpawnDeg: angularEccentricityDeg(spawnTick, targetForTick(spawnTick, spawnTarget), options.eyeHeight),
    thresholdDegPerSec,
    baselineSdDegPerSec,
    baselineVelocitySampleCount: baselineVelocities.length,
    baselineInsufficient,
    samplesEvaluated: postSamples.length,
    anticipation: reactionMs !== undefined && reactionMs < options.anticipationMs,
    ...(tDetectMs !== undefined ? { tDetectMs, reactionMs } : {}),
  };
}

function eccentricitySamples(
  ticks: readonly Tick[],
  startMs: number,
  endMs: number,
  fallbackTarget: TargetPoint,
  eyeHeight: number,
  preferTickTarget: boolean,
): EccentricitySample[] {
  const samples: EccentricitySample[] = [];
  for (const tick of ticks) {
    if (tick.t + EPSILON < startMs || tick.t >= endMs - EPSILON) continue;
    const target = preferTickTarget ? targetForTick(tick, fallbackTarget) : fallbackTarget;
    samples.push({ t: tick.t, eccentricityDeg: angularEccentricityDeg(tick, target, eyeHeight) });
  }
  return samples;
}

function velocitySamples(samples: readonly EccentricitySample[]): VelocitySample[] {
  const velocities: VelocitySample[] = [];
  for (let i = 1; i < samples.length; i++) {
    const previous = samples[i - 1];
    const current = samples[i];
    const dtSec = (current.t - previous.t) / 1000;
    if (dtSec <= 0 || !Number.isFinite(dtSec)) continue;
    velocities.push({ t: current.t, degPerSec: (current.eccentricityDeg - previous.eccentricityDeg) / dtSec });
  }
  return velocities;
}

function firstSustainedDecrease(
  velocities: readonly VelocitySample[],
  thresholdDegPerSec: number,
  sustainedTicks: number,
): number | undefined {
  let run = 0;
  let candidateStart: number | undefined;
  for (const sample of velocities) {
    if (sample.degPerSec < -thresholdDegPerSec) {
      if (run === 0) candidateStart = sample.t;
      run++;
      if (run >= sustainedTicks) return candidateStart;
    } else {
      run = 0;
      candidateStart = undefined;
    }
  }
  return undefined;
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

function targetFromVisibleOrTick(visible: VisibleEvent, tick: Tick): TargetPoint {
  if (
    isFiniteNumber(visible.targetX) &&
    isFiniteNumber(visible.targetY) &&
    isFiniteNumber(visible.targetZ)
  ) {
    return { x: visible.targetX, y: visible.targetY, z: visible.targetZ };
  }
  if (tick.tx !== null && tick.ty !== null && tick.tz !== null) return { x: tick.tx, y: tick.ty, z: tick.tz };
  throw new Error(`cannot derive detection metrics for ${visible.targetId}: visible target position is missing`);
}

function targetForTick(tick: Tick, fallback: TargetPoint): TargetPoint {
  if (tick.tx !== null && tick.ty !== null && tick.tz !== null) return { x: tick.tx, y: tick.ty, z: tick.tz };
  return fallback;
}

function firstTickAtOrAfter(ticks: readonly Tick[], t: number): Tick | undefined {
  return ticks.find((tick) => tick.t + EPSILON >= t);
}

function resolveOptions(options: DetectionDerivationOptions): ResolvedDetectionDerivationOptions {
  return {
    preStimulusMs: positiveFinite(options.preStimulusMs ?? DEFAULT_OPTIONS.preStimulusMs, 'preStimulusMs'),
    thresholdSdMultiplier: nonNegativeFinite(
      options.thresholdSdMultiplier ?? DEFAULT_OPTIONS.thresholdSdMultiplier,
      'thresholdSdMultiplier',
    ),
    sustainedTicks: positiveInteger(options.sustainedTicks ?? DEFAULT_OPTIONS.sustainedTicks, 'sustainedTicks'),
    anticipationMs: nonNegativeFinite(options.anticipationMs ?? DEFAULT_OPTIONS.anticipationMs, 'anticipationMs'),
    eyeHeight: finite(options.eyeHeight ?? DEFAULT_OPTIONS.eyeHeight, 'eyeHeight'),
  };
}

function positiveFinite(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive finite number`);
  return value;
}

function nonNegativeFinite(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative finite number`);
  return value;
}

function finite(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  return value;
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

function standardDeviation(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
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
