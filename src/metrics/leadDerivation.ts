import type { ExportPayload } from '../data/export.ts';

export interface LeadDerivationOptions {
  eyeHeight?: number;
}

export interface ResolvedLeadDerivationOptions {
  eyeHeight: number;
}

export interface LeadVector {
  x: number;
  y: number;
  z: number;
}

export interface LeadErrorSample {
  shotSeq: number;
  targetId?: string;
  tFireMs: number;
  timeOfFlightMs: number;
  timeOfFlightSource: 'hit' | 'estimated';
  targetVelocityUPerSec: LeadVector;
  actualYaw: number;
  actualPitch: number;
  idealYaw: number;
  idealPitch: number;
  leadErrorDeg: number;
}

export interface LeadDerivationResult {
  options: ResolvedLeadDerivationOptions;
  samples: LeadErrorSample[];
}

type Tick = ExportPayload['ticks'][number];
type FireEvent = Extract<ExportPayload['events'][number], { type: 'fire' }>;
type HitEvent = Extract<ExportPayload['events'][number], { type: 'hit' }>;

interface Point3 {
  x: number;
  y: number;
  z: number;
}

interface InterpolatedState {
  eye: Point3;
  target: Point3;
}

const DEFAULT_OPTIONS: ResolvedLeadDerivationOptions = {
  eyeHeight: 1.6,
};

const EPSILON = 1e-9;

export function deriveLeadError(payload: ExportPayload, options: LeadDerivationOptions = {}): LeadDerivationResult {
  const bullet = payload.meta.weapon?.bullet;
  if (bullet === undefined) throw new Error('lead derivation requires meta.weapon.bullet projectile metadata');

  const resolved = resolveOptions(options);
  const ticks = payload.ticks.slice().sort((a, b) => a.t - b.t);
  const events = payload.events.slice().sort((a, b) => a.t - b.t);
  const fires = events.filter((event): event is FireEvent => event.type === 'fire' && event.shotSeq !== undefined);
  const hitsByShotSeq = new Map<number, HitEvent>();
  for (const hit of events) {
    if (hit.type === 'hit') hitsByShotSeq.set(hit.shotSeq, hit);
  }

  const samples = fires.map((fire) => {
    if (fire.shotSeq === undefined) throw new Error('projectile fire row is missing shotSeq');
    if (fire.viewYaw === undefined || fire.viewPitch === undefined) {
      throw new Error(`cannot derive lead error for shotSeq ${fire.shotSeq}: fire-time view angles are missing`);
    }

    const state = interpolateState(ticks, fire.t, resolved.eyeHeight, fire.shotSeq);
    const velocity = targetVelocityAt(ticks, fire.t);
    const hit = hitsByShotSeq.get(fire.shotSeq);
    const timeOfFlightSource: LeadErrorSample['timeOfFlightSource'] = hit !== undefined ? 'hit' : 'estimated';
    const timeOfFlightMs =
      hit !== undefined ? hit.timeOfFlightMs : estimateTimeOfFlightMs(state.eye, state.target, bullet.speedU);
    const flightSec = timeOfFlightMs / 1000;
    const idealTarget = {
      x: state.target.x + velocity.x * flightSec,
      y: state.target.y + velocity.y * flightSec,
      z: state.target.z + velocity.z * flightSec,
    };
    const idealDelta = {
      x: idealTarget.x - state.eye.x,
      y: idealTarget.y - state.eye.y + 0.5 * bullet.gravityU * flightSec * flightSec,
      z: idealTarget.z - state.eye.z,
    };
    const idealDir = normalize(idealDelta);
    const actualDir = aimForward(fire.viewYaw, fire.viewPitch);
    const idealAngles = anglesFromDirection(idealDir);

    return {
      shotSeq: fire.shotSeq,
      ...(fire.targetId !== undefined ? { targetId: fire.targetId } : {}),
      tFireMs: fire.t,
      timeOfFlightMs,
      timeOfFlightSource,
      targetVelocityUPerSec: velocity,
      actualYaw: fire.viewYaw,
      actualPitch: fire.viewPitch,
      idealYaw: idealAngles.yaw,
      idealPitch: idealAngles.pitch,
      leadErrorDeg: angleBetweenDeg(actualDir, idealDir),
    };
  });

  return { options: resolved, samples };
}

function interpolateState(
  ticks: readonly Tick[],
  t: number,
  eyeHeight: number,
  shotSeq: number,
): InterpolatedState {
  if (ticks.length === 0) throw new Error(`cannot derive lead error for shotSeq ${shotSeq}: no tick rows`);

  const firstAfterIndex = ticks.findIndex((tick) => tick.t + EPSILON >= t);
  const after = firstAfterIndex >= 0 ? ticks[firstAfterIndex] : ticks[ticks.length - 1];
  const before = firstAfterIndex > 0 ? ticks[firstAfterIndex - 1] : after;
  const ratio = after.t === before.t ? 0 : clamp((t - before.t) / (after.t - before.t), 0, 1);
  const targetBefore = targetPoint(before);
  const targetAfter = targetPoint(after);
  if (targetBefore === undefined || targetAfter === undefined) {
    throw new Error(`cannot derive lead error for shotSeq ${shotSeq}: target position is missing at fire time`);
  }

  return {
    eye: {
      x: lerp(before.px, after.px, ratio),
      y: eyeHeight,
      z: lerp(before.pz, after.pz, ratio),
    },
    target: {
      x: lerp(targetBefore.x, targetAfter.x, ratio),
      y: lerp(targetBefore.y, targetAfter.y, ratio),
      z: lerp(targetBefore.z, targetAfter.z, ratio),
    },
  };
}

function targetVelocityAt(ticks: readonly Tick[], t: number): LeadVector {
  const targetTicks = ticks.filter((tick) => targetPoint(tick) !== undefined);
  if (targetTicks.length < 2) return { x: 0, y: 0, z: 0 };

  const firstAtOrAfter = targetTicks.findIndex((tick) => tick.t + EPSILON >= t);
  const beforeIndex = firstAtOrAfter <= 0 ? 0 : firstAtOrAfter - 1;
  const afterIndex = firstAtOrAfter <= 0 ? 1 : Math.min(firstAtOrAfter, targetTicks.length - 1);
  const before = targetTicks[beforeIndex];
  const after = targetTicks[afterIndex];
  const dtSec = (after.t - before.t) / 1000;
  if (dtSec <= 0 || !Number.isFinite(dtSec)) return { x: 0, y: 0, z: 0 };

  const a = targetPoint(before)!;
  const b = targetPoint(after)!;
  return {
    x: (b.x - a.x) / dtSec,
    y: (b.y - a.y) / dtSec,
    z: (b.z - a.z) / dtSec,
  };
}

function targetPoint(tick: Tick): Point3 | undefined {
  if (tick.tx === null || tick.ty === null || tick.tz === null) return undefined;
  return { x: tick.tx, y: tick.ty, z: tick.tz };
}

function estimateTimeOfFlightMs(eye: Point3, target: Point3, speedU: number): number {
  const distance = Math.hypot(target.x - eye.x, target.y - eye.y, target.z - eye.z);
  return (distance / speedU) * 1000;
}

function aimForward(yaw: number, pitch: number): LeadVector {
  const cosPitch = Math.cos(pitch);
  return {
    x: -Math.sin(yaw) * cosPitch,
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * cosPitch,
  };
}

function anglesFromDirection(dir: LeadVector): { yaw: number; pitch: number } {
  return {
    yaw: Math.atan2(-dir.x, -dir.z),
    pitch: Math.asin(clamp(dir.y, -1, 1)),
  };
}

function normalize(value: LeadVector): LeadVector {
  const len = Math.hypot(value.x, value.y, value.z);
  if (len === 0) return { x: 0, y: 0, z: -1 };
  return { x: value.x / len, y: value.y / len, z: value.z / len };
}

function angleBetweenDeg(a: LeadVector, b: LeadVector): number {
  const dot = a.x * b.x + a.y * b.y + a.z * b.z;
  return radToDeg(Math.acos(clamp(dot, -1, 1)));
}

function resolveOptions(options: LeadDerivationOptions): ResolvedLeadDerivationOptions {
  return {
    eyeHeight: finite(options.eyeHeight ?? DEFAULT_OPTIONS.eyeHeight, 'eyeHeight'),
  };
}

function finite(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  return value;
}

function lerp(a: number, b: number, ratio: number): number {
  return a + (b - a) * ratio;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function radToDeg(value: number): number {
  return (value * 180) / Math.PI;
}
