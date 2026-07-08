import type { RenderBackend } from '../render/createRenderer.ts';
import { DEFAULT_MAX_DRILL_SECONDS } from './RingBuffer.ts';

export const DEFAULT_SIM_HZ = 128;
export const DEFAULT_V_STRAFE = 250;
export const SCHEMA_VERSION = 2;
export const DEFAULT_WEAPON_ID = 'ak47';
export const DEFAULT_WEAPON_SEED = 223;
export const DEFAULT_RNG_SEED = 1;
export const DEFAULT_MOVEMENT_MODEL = 'cs2-source';

export interface SpawnMeta {
  seed: number;
  motion?: unknown;
  spawnArea?: unknown;
}

export interface SceneMeta {
  sceneId: string;
  assetPackVersion: string;
  clutterTier: 'low' | 'mid' | 'high';
  fallback: boolean;
}

export interface Meta {
  schemaVersion: 2;
  drillId: string;
  weaponId: string;
  weaponSeed: number;
  rngSeed: number;
  backend: RenderBackend;
  displayHz: number;
  simHz: number;
  browser: string;
  sensitivity: number;
  sensitivityModel: 'cs2-0.022deg';
  movementModel: 'cs2-source';
  crossOriginIsolated: boolean;
  startedAt: string;
  unit: 'source';
  vStrafe: number;
  maxDrillSeconds: number;
  lateEventCount: number;
  bufferOverflow: boolean;
  recorderOverflow: boolean;
  suspect: boolean;
  spawn?: SpawnMeta;
  scene?: SceneMeta;
  display?: unknown;
  frames?: unknown;
  session?: { participantId?: string; sessionLabel?: string };
}

export interface CollectMetaArgs {
  drillId: string;
  weaponId?: string;
  weaponSeed?: number;
  rngSeed?: number;
  backend: RenderBackend;
  displayHz: number;
  simHz?: number;
  browser?: string;
  sensitivity: number;
  crossOriginIsolated: boolean;
  startedAt?: string | Date;
  vStrafe?: number;
  maxDrillSeconds?: number;
  lateEventCount?: number;
  bufferOverflow?: boolean | number;
  recorderOverflow?: boolean;
  spawn?: SpawnMeta;
  scene?: SceneMeta;
  display?: unknown;
  frames?: unknown;
  session?: { participantId?: string; sessionLabel?: string };
}

export interface MeasureDisplayHzOptions {
  samples?: number;
  requestAnimationFrame?: ((callback: FrameRequestCallback) => number) | null;
}

export function collectMeta(args: CollectMetaArgs): Meta {
  const drillId = requireNonEmptyString(args.drillId, 'drillId');
  const weaponId = requireNonEmptyString(args.weaponId ?? DEFAULT_WEAPON_ID, 'weaponId');
  const weaponSeed = requireNonNegativeInteger(args.weaponSeed ?? DEFAULT_WEAPON_SEED, 'weaponSeed');
  const rngSeed = requireFiniteNumber(args.rngSeed ?? DEFAULT_RNG_SEED, 'rngSeed');
  const backend = requireBackend(args.backend);
  const displayHz = requirePositiveFiniteNumber(args.displayHz, 'displayHz');
  const simHz = requirePositiveFiniteNumber(args.simHz ?? DEFAULT_SIM_HZ, 'simHz');
  const browser = args.browser ?? globalThis.navigator?.userAgent ?? 'unknown';
  const sensitivity = requirePositiveFiniteNumber(args.sensitivity, 'sensitivity');
  const crossOriginIsolated = requireBoolean(args.crossOriginIsolated, 'crossOriginIsolated');
  const startedAt = normalizeStartedAt(args.startedAt);
  const vStrafe = requirePositiveFiniteNumber(args.vStrafe ?? DEFAULT_V_STRAFE, 'vStrafe');
  const maxDrillSeconds = requirePositiveFiniteNumber(
    args.maxDrillSeconds ?? DEFAULT_MAX_DRILL_SECONDS,
    'maxDrillSeconds',
  );
  const lateEventCount = requireNonNegativeInteger(args.lateEventCount ?? 0, 'lateEventCount');
  const bufferOverflow = normalizeOverflow(args.bufferOverflow ?? false, 'bufferOverflow');
  const recorderOverflow = requireBoolean(args.recorderOverflow ?? false, 'recorderOverflow');
  const scene = args.scene === undefined ? undefined : requireSceneMeta(args.scene);

  return {
    schemaVersion: SCHEMA_VERSION,
    drillId,
    weaponId,
    weaponSeed,
    rngSeed,
    backend,
    displayHz,
    simHz,
    browser,
    sensitivity,
    sensitivityModel: 'cs2-0.022deg',
    movementModel: DEFAULT_MOVEMENT_MODEL,
    crossOriginIsolated,
    startedAt,
    unit: 'source',
    vStrafe,
    maxDrillSeconds,
    lateEventCount,
    bufferOverflow,
    recorderOverflow,
    suspect: bufferOverflow || recorderOverflow,
    ...(args.spawn !== undefined ? { spawn: args.spawn } : {}),
    ...(scene !== undefined ? { scene } : {}),
    ...(args.display !== undefined ? { display: args.display } : {}),
    ...(args.frames !== undefined ? { frames: args.frames } : {}),
    ...(args.session !== undefined ? { session: args.session } : {}),
  };
}

function requireSceneMeta(value: SceneMeta): SceneMeta {
  const scene = requireRecord(value, 'scene');
  return {
    sceneId: requireNonEmptyString(scene.sceneId, 'scene.sceneId'),
    assetPackVersion: requireNonEmptyString(scene.assetPackVersion, 'scene.assetPackVersion'),
    clutterTier: requireClutterTier(scene.clutterTier, 'scene.clutterTier'),
    fallback: requireBoolean(scene.fallback, 'scene.fallback'),
  };
}

export async function measureDisplayHz(options: MeasureDisplayHzOptions = {}): Promise<number> {
  const samples = requireNonNegativeInteger(options.samples ?? 60, 'samples');
  if (samples < 2) throw new Error('samples must be at least 2');

  const requestAnimationFrame =
    options.requestAnimationFrame === undefined
      ? globalThis.requestAnimationFrame?.bind(globalThis)
      : options.requestAnimationFrame;
  if (!requestAnimationFrame) throw new Error('requestAnimationFrame is not available');

  const timestamps: number[] = [];
  while (timestamps.length < samples + 1) {
    timestamps.push(await nextAnimationFrame(requestAnimationFrame));
  }

  const intervals: number[] = [];
  for (let i = 1; i < timestamps.length; i++) {
    const delta = timestamps[i] - timestamps[i - 1];
    if (Number.isFinite(delta) && delta > 0) intervals.push(delta);
  }
  if (intervals.length === 0) throw new Error('displayHz could not be measured');

  intervals.sort((a, b) => a - b);
  const mid = Math.floor(intervals.length / 2);
  const medianMs =
    intervals.length % 2 === 0 ? (intervals[mid - 1] + intervals[mid]) / 2 : intervals[mid];
  return 1000 / medianMs;
}

function nextAnimationFrame(
  requestAnimationFrame: (callback: FrameRequestCallback) => number,
): Promise<number> {
  return new Promise((resolve) => {
    requestAnimationFrame((time) => resolve(time));
  });
}

function requireBackend(value: RenderBackend): RenderBackend {
  if (value !== 'webgpu' && value !== 'webgl2') throw new Error('backend must be webgpu or webgl2');
  return value;
}

function requireBoolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${name} must be a boolean`);
  return value;
}

function requireNonEmptyString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${name} must be a non-empty string`);
  return value;
}

function requireRecord(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireClutterTier(value: unknown, name: string): SceneMeta['clutterTier'] {
  if (value !== 'low' && value !== 'mid' && value !== 'high') {
    throw new Error(`${name} must be low, mid, or high`);
  }
  return value;
}

function requirePositiveFiniteNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive finite number`);
  }
  return value;
}

function requireFiniteNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
  return value;
}

function requireNonNegativeInteger(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

function normalizeOverflow(value: boolean | number, name: string): boolean {
  if (typeof value === 'boolean') return value;
  return requireNonNegativeInteger(value, name) > 0;
}

function normalizeStartedAt(value: string | Date | undefined): string {
  if (value === undefined) return new Date().toISOString();
  const iso = value instanceof Date ? value.toISOString() : value;
  if (typeof iso !== 'string' || Number.isNaN(Date.parse(iso))) {
    throw new Error('startedAt must be an ISO-compatible date string');
  }
  return iso;
}
