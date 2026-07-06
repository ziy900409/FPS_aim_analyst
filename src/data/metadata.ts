import type { RenderBackend } from '../render/createRenderer.ts';
import { DEFAULT_MAX_DRILL_SECONDS } from './RingBuffer.ts';

export const DEFAULT_SIM_HZ = 128;
export const DEFAULT_V_STRAFE = 250;

export interface Meta {
  drillId: string;
  backend: RenderBackend;
  displayHz: number;
  simHz: number;
  browser: string;
  sensitivity: number;
  sensitivityModel: 'cs2-0.022deg';
  crossOriginIsolated: boolean;
  startedAt: string;
  unit: 'source';
  vStrafe: number;
  maxDrillSeconds: number;
  lateEventCount: number;
  bufferOverflow: boolean;
  recorderOverflow: boolean;
  suspect: boolean;
}

export interface CollectMetaArgs {
  drillId: string;
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
}

export interface MeasureDisplayHzOptions {
  samples?: number;
  requestAnimationFrame?: ((callback: FrameRequestCallback) => number) | null;
}

export function collectMeta(args: CollectMetaArgs): Meta {
  const drillId = requireNonEmptyString(args.drillId, 'drillId');
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

  return {
    drillId,
    backend,
    displayHz,
    simHz,
    browser,
    sensitivity,
    sensitivityModel: 'cs2-0.022deg',
    crossOriginIsolated,
    startedAt,
    unit: 'source',
    vStrafe,
    maxDrillSeconds,
    lateEventCount,
    bufferOverflow,
    recorderOverflow,
    suspect: bufferOverflow || recorderOverflow,
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

function requirePositiveFiniteNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive finite number`);
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
