import { describe, expect, it } from 'vitest';
import { createDataRecorder } from '../data/DataRecorder.ts';
import { buildExportPayload, serializeJSON, type ExportPayload } from '../data/export.ts';
import type { Meta } from '../data/metadata.ts';
import { deriveDetectionMetrics } from './detectionDerivation.ts';

const SIM_HZ = 128;
const TICK_MS = 1000 / SIM_HZ;
const TARGET = { x: 0, y: 1.6, z: -4 };
const BASE_YAW_DEG = 10;

const meta: Meta = {
  schemaVersion: 2,
  drillId: 'detection_popin_v1',
  weaponId: 'ak47',
  weaponSeed: 223,
  rngSeed: 21021,
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

describe('deriveDetectionMetrics', () => {
  it.each([
    { name: 'fast onset / low noise', speedDegPerTick: 1.2, noiseDeg: 0.005 },
    { name: 'fast onset / high noise', speedDegPerTick: 1.2, noiseDeg: 0.08 },
    { name: 'slow onset / low noise', speedDegPerTick: 0.55, noiseDeg: 0.005 },
    { name: 'slow onset / high noise', speedDegPerTick: 0.55, noiseDeg: 0.08 },
  ])('recovers a known onset within one tick from JSON export shape: $name', ({ speedDegPerTick, noiseDeg }) => {
    const visibleTick = 80;
    const onsetTick = 100;
    const payload = makeRoundTripPayload({ visibleTick, onsetTick, speedDegPerTick, noiseDeg });
    const result = deriveDetectionMetrics(payload);
    const presentation = onlyPresentation(result);

    expect(presentation.status).toBe('detected');
    expect(presentation.tDetectMs).toBeDefined();
    expect(Math.abs(presentation.tDetectMs! - tickTime(onsetTick))).toBeLessThanOrEqual(TICK_MS + 1e-9);
    expect(presentation.baselineInsufficient).toBe(false);
    expect(presentation.samplesEvaluated).toBeGreaterThan(4);
    expect(presentation.spawnTickOffsetMs).toBe(0);
  });

  it('computes spawn eccentricity from aim and target center', () => {
    const payload = makeRoundTripPayload({ visibleTick: 80, onsetTick: 100, speedDegPerTick: 1, noiseDeg: 0 });
    const presentation = onlyPresentation(deriveDetectionMetrics(payload));

    expect(presentation.eccentricityAtSpawnDeg).toBeCloseTo(BASE_YAW_DEG, 12);
    expect(presentation.thresholdDegPerSec).toBe(0);
  });

  it('returns timeout for a presentation with no sustained eccentricity decrease', () => {
    const payload = makeRoundTripPayload({
      visibleTick: 80,
      onsetTick: 100,
      speedDegPerTick: 0,
      noiseDeg: 0,
    });
    const presentation = onlyPresentation(deriveDetectionMetrics(payload));

    expect(presentation.status).toBe('timeout');
    expect(presentation.tDetectMs).toBeUndefined();
    expect(presentation.reactionMs).toBeUndefined();
    expect(presentation.anticipation).toBe(false);
  });

  it('flags detections below the human RT lower bound as anticipation', () => {
    const visibleTick = 80;
    const onsetTick = 86;
    const payload = makeRoundTripPayload({ visibleTick, onsetTick, speedDegPerTick: 1.2, noiseDeg: 0.005 });
    const presentation = onlyPresentation(deriveDetectionMetrics(payload));

    expect(presentation.status).toBe('detected');
    expect(presentation.reactionMs).toBeCloseTo((onsetTick - visibleTick) * TICK_MS, 12);
    expect(presentation.anticipation).toBe(true);
  });

  it('keeps first-presentation short pre-stimulus windows explicit', () => {
    const payload = makeRoundTripPayload({ visibleTick: 3, onsetTick: 20, speedDegPerTick: 1, noiseDeg: 0.005 });
    const presentation = onlyPresentation(deriveDetectionMetrics(payload));

    expect(presentation.baselineInsufficient).toBe(true);
    expect(presentation.baselineVelocitySampleCount).toBe(2);
    expect(presentation.status).toBe('detected');
  });
});

interface FixtureOptions {
  visibleTick: number;
  onsetTick: number;
  speedDegPerTick: number;
  noiseDeg: number;
}

function makeRoundTripPayload(options: FixtureOptions): ExportPayload {
  const totalTicks = Math.max(options.onsetTick + 18, options.visibleTick + 32);
  const recorder = createDataRecorder({ capacity: totalTicks + 1 });

  for (let tick = 0; tick <= totalTicks; tick++) {
    const t = tickTime(tick);
    if (tick === options.visibleTick) {
      recorder.recordEvent({
        type: 'visible',
        targetId: 'target-1',
        side: 'R',
        t,
        targetX: TARGET.x,
        targetY: TARGET.y,
        targetZ: TARGET.z,
      });
    }

    recorder.recordTick({
      t,
      vx: 0,
      vz: 0,
      px: 0,
      pz: 0,
      tx: tick >= options.visibleTick ? TARGET.x : null,
      ty: tick >= options.visibleTick ? TARGET.y : null,
      tz: tick >= options.visibleTick ? TARGET.z : null,
      aim: { yaw: degToRad(yawDegAt(tick, options)), pitch: 0 },
      keys: [],
    });
  }

  const payload = buildExportPayload(meta, recorder.snapshot());
  return JSON.parse(serializeJSON(payload)) as ExportPayload;
}

function yawDegAt(tick: number, options: FixtureOptions): number {
  const noise = options.noiseDeg * Math.sin(tick * 0.73);
  if (options.speedDegPerTick === 0 || tick < options.onsetTick) return BASE_YAW_DEG + noise;

  const movementTicks = tick - options.onsetTick + 1;
  return Math.max(0, BASE_YAW_DEG - movementTicks * options.speedDegPerTick) + noise;
}

function onlyPresentation(result: ReturnType<typeof deriveDetectionMetrics>) {
  expect(result.presentations).toHaveLength(1);
  return result.presentations[0];
}

function tickTime(tick: number): number {
  return tick * TICK_MS;
}

function degToRad(value: number): number {
  return (value * Math.PI) / 180;
}
