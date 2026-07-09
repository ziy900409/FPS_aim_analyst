import { describe, expect, it } from 'vitest';
import { createDataRecorder } from '../data/DataRecorder.ts';
import { buildExportPayload, serializeJSON, type ExportPayload } from '../data/export.ts';
import type { Meta } from '../data/metadata.ts';
import { deriveTrackingMetrics } from './trackingDerivation.ts';

const SIM_HZ = 128;
const TICK_MS = 1000 / SIM_HZ;
const EYE_HEIGHT = 1.6;
const TARGET_Y = 1.6;
const TARGET_Z = -4;
const MOTION_RANGE = 1; // horizontal pingpong half-amplitude (u), matching tracking_v1
const OFF_TARGET_X = 6; // aim held far from the corridor → never on-target

const meta: Meta = {
  schemaVersion: 2,
  drillId: 'tracking_v1',
  weaponId: 'ak47',
  weaponSeed: 223,
  rngSeed: 18018,
  backend: 'webgl2',
  displayHz: 144,
  simHz: SIM_HZ,
  browser: 'test-browser',
  sensitivity: 1,
  sensitivityModel: 'cs2-0.022deg',
  movementModel: 'cs2-source',
  crossOriginIsolated: true,
  startedAt: '2026-07-09T00:00:00.000Z',
  unit: 'source',
  vStrafe: 250,
  maxDrillSeconds: 300,
  lateEventCount: 0,
  bufferOverflow: false,
  recorderOverflow: false,
  suspect: false,
};

describe('deriveTrackingMetrics', () => {
  it('reports near-perfect tracking when the aim rides the target center every tick', () => {
    const payload = makeRoundTripPayload({ visibleTick: 20, totalTicks: 80, mode: 'perfect' });
    const presentation = onlyPresentation(deriveTrackingMetrics(payload));

    expect(presentation.acquisitionFailure).toBe(false);
    expect(presentation.tAcquireMs).toBeCloseTo(0, 9); // on-target from the first visible tick
    expect(presentation.totPercent).toBe(100);
    expect(presentation.rmsEpsilonDeg!).toBeLessThan(1e-6);
    expect(presentation.p95EpsilonDeg!).toBeLessThan(1e-6);
  });

  it('records an acquisition failure when the aim never covers the moving target', () => {
    const payload = makeRoundTripPayload({ visibleTick: 20, totalTicks: 80, mode: 'stationary-miss' });
    const result = deriveTrackingMetrics(payload);
    const presentation = onlyPresentation(result);

    expect(presentation.acquisitionFailure).toBe(true);
    expect(presentation.tAcquireMs).toBeUndefined();
    expect(presentation.totPercent).toBeUndefined(); // excluded from TOT aggregation
    expect(presentation.rmsEpsilonDeg).toBeUndefined();
    expect(result.acquisitionFailureRate).toBe(1);
  });

  it('recovers a known acquisition onset within one tick', () => {
    const visibleTick = 20;
    const onsetTick = 45;
    const payload = makeRoundTripPayload({ visibleTick, totalTicks: 90, mode: 'lock-at', onsetTick });
    const presentation = onlyPresentation(deriveTrackingMetrics(payload));

    expect(presentation.acquisitionFailure).toBe(false);
    const expectedAcquireMs = (onsetTick - visibleTick) * TICK_MS;
    expect(Math.abs(presentation.tAcquireMs! - expectedAcquireMs)).toBeLessThanOrEqual(TICK_MS + 1e-9);
    // TOT window starts at first-on-target; from onset on it tracks perfectly → 100%.
    expect(presentation.totPercent).toBe(100);
    expect(presentation.rmsEpsilonDeg!).toBeLessThan(1e-6);
  });

  it('aggregates the acquisition failure rate across multiple presentations', () => {
    const payload = makeMultiPresentationPayload();
    const result = deriveTrackingMetrics(payload);

    expect(result.presentations).toHaveLength(2);
    expect(result.presentations[0].acquisitionFailure).toBe(false);
    expect(result.presentations[1].acquisitionFailure).toBe(true);
    expect(result.acquisitionFailureRate).toBe(0.5);
    // A presentation window must not leak samples into the next presentation.
    expect(result.presentations[0].windowEndMs).toBeCloseTo(result.presentations[1].tVisibleMs, 9);
  });
});

interface FixtureOptions {
  visibleTick: number;
  totalTicks: number;
  mode: 'perfect' | 'stationary-miss' | 'lock-at';
  onsetTick?: number;
}

function makeRoundTripPayload(options: FixtureOptions): ExportPayload {
  const recorder = createDataRecorder({ capacity: options.totalTicks + 1 });

  for (let tick = 0; tick <= options.totalTicks; tick++) {
    const t = tickTime(tick);
    const active = tick >= options.visibleTick;
    const target = active ? targetAt(tick) : null;

    if (tick === options.visibleTick) {
      recorder.recordEvent({
        type: 'visible',
        targetId: 'target-1',
        side: 'R',
        t,
        targetX: target!.x,
        targetY: target!.y,
        targetZ: target!.z,
      });
    }

    const aim = aimForTick(tick, options, target);
    recorder.recordTick({
      t,
      vx: 0,
      vz: 0,
      px: 0,
      pz: 0,
      tx: target ? target.x : null,
      ty: target ? target.y : null,
      tz: target ? target.z : null,
      aim,
      keys: [],
    });
  }

  return roundTrip(recorder.snapshot());
}

function makeMultiPresentationPayload(): ExportPayload {
  const visibleA = 20;
  const advanceTick = 60; // presentation A ends, presentation B (a miss) begins
  const totalTicks = 100;
  const recorder = createDataRecorder({ capacity: totalTicks + 1 });

  for (let tick = 0; tick <= totalTicks; tick++) {
    const t = tickTime(tick);
    const presentationA = tick >= visibleA && tick < advanceTick;
    const presentationB = tick >= advanceTick;
    const target = presentationA || presentationB ? targetAt(tick) : null;

    if (tick === visibleA) {
      recorder.recordEvent({ type: 'visible', targetId: 'target-1', side: 'R', t, targetX: target!.x, targetY: target!.y, targetZ: target!.z });
    }
    if (tick === advanceTick) {
      recorder.recordEvent({ type: 'visible', targetId: 'target-2', side: 'L', t, targetX: target!.x, targetY: target!.y, targetZ: target!.z });
    }

    // Presentation A: perfect tracking. Presentation B: aim held off-target (miss).
    const aim = presentationB ? aimAtOffTarget() : target ? aimAtCenter(target) : aimAtOffTarget();
    recorder.recordTick({
      t,
      vx: 0,
      vz: 0,
      px: 0,
      pz: 0,
      tx: target ? target.x : null,
      ty: target ? target.y : null,
      tz: target ? target.z : null,
      aim,
      keys: [],
    });
  }

  return roundTrip(recorder.snapshot());
}

function aimForTick(tick: number, options: FixtureOptions, target: { x: number; y: number; z: number } | null) {
  if (options.mode === 'stationary-miss') return aimAtOffTarget();
  if (options.mode === 'lock-at' && tick < options.onsetTick!) return aimAtOffTarget();
  if (target === null) return aimAtOffTarget();
  return aimAtCenter(target);
}

/** Horizontal pingpong-style target trajectory (source units), centered on x = 0 at distance 4. */
function targetAt(tick: number): { x: number; y: number; z: number } {
  const x = MOTION_RANGE * Math.sin(tick * 0.15);
  return { x, y: TARGET_Y, z: TARGET_Z };
}

/** Yaw/pitch that aims exactly at a world point from eye (0, EYE_HEIGHT, 0). */
function aimAtCenter(point: { x: number; y: number; z: number }): { yaw: number; pitch: number } {
  const dx = point.x;
  const dy = point.y - EYE_HEIGHT;
  const dz = point.z;
  const len = Math.hypot(dx, dy, dz);
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.asin(dy / len) };
}

function aimAtOffTarget(): { yaw: number; pitch: number } {
  return aimAtCenter({ x: OFF_TARGET_X, y: TARGET_Y, z: TARGET_Z });
}

function roundTrip(snapshot: ReturnType<ReturnType<typeof createDataRecorder>['snapshot']>): ExportPayload {
  const payload = buildExportPayload(meta, snapshot);
  return JSON.parse(serializeJSON(payload)) as ExportPayload;
}

function onlyPresentation(result: ReturnType<typeof deriveTrackingMetrics>) {
  expect(result.presentations).toHaveLength(1);
  return result.presentations[0];
}

function tickTime(tick: number): number {
  return tick * TICK_MS;
}
