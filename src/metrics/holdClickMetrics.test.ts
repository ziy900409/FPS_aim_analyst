import { describe, expect, it } from 'vitest';
import { createDataRecorder } from '../data/DataRecorder.ts';
import { buildExportPayload, serializeJSON, type ExportPayload } from '../data/export.ts';
import type { Meta } from '../data/metadata.ts';
import type { SceneConfig } from '../scene/SceneConfig.ts';
import { deriveHoldClickMetrics } from './holdClickMetrics.ts';

const SIM_HZ = 128;
const TICK_MS = 1000 / SIM_HZ;
const EYE_HEIGHT = 1.6;
const VISIBLE_TICK = 80;
const ONSET_TICK = 90;
const DETECT_TICK = 96;
const ON_TARGET_TICK = 105;
const FIRE_TICK = 112;
const TARGET_Z = -10;

const meta: Meta = {
  schemaVersion: 2,
  drillId: 'hold_click_v1',
  weaponId: 'ak47',
  weaponSeed: 223,
  rngSeed: 34034,
  backend: 'webgl2',
  displayHz: 144,
  simHz: SIM_HZ,
  browser: 'test-browser',
  sensitivity: 1,
  sensitivityModel: 'cs2-0.022deg',
  movementModel: 'cs2-source',
  crossOriginIsolated: true,
  startedAt: '2026-08-19T00:00:00.000Z',
  unit: 'source',
  vStrafe: 250,
  maxDrillSeconds: 300,
  lateEventCount: 0,
  bufferOverflow: false,
  recorderOverflow: false,
  suspect: false,
  simToWorld: 1,
  scene: {
    sceneId: 'hold-click-fixture',
    assetPackVersion: 'synthetic-v1',
    clutterTier: 'low',
    fallback: false,
    eye: { x: 0, y: EYE_HEIGHT, z: 0 },
  },
};

const holdClickOptions = {
  sampleCount: 9,
  onsetThreshold: 0.5,
  detection: { preStimulusMs: 100, sustainedTicks: 1, thresholdSdMultiplier: 0 },
} as const;

describe('deriveHoldClickMetrics', () => {
  it('assembles visibility, detection, acquisition, and first-shot timings without redefining them', () => {
    const result = deriveHoldClickMetrics(makePayload(FIRE_TICK), fixtureScene(), holdClickOptions);
    const presentation = onlyPresentation(result);

    expect(presentation.targetId).toBe('target-1');
    expect(presentation.tFirstVisibleMs).toBeCloseTo(tickTime(ONSET_TICK), 12);
    expect(presentation.tMeasurementOnsetMs).toBeCloseTo(tickTime(ONSET_TICK), 12);
    expect(presentation.tFullExposureMs).toBeCloseTo(tickTime(ONSET_TICK), 12);
    expect(presentation.tDetectMs).toBeCloseTo(tickTime(DETECT_TICK), 12);
    expect(presentation.detectionLatencyFromOnsetMs).toBeCloseTo((DETECT_TICK - ONSET_TICK) * TICK_MS, 12);
    expect(presentation.tFirstOnTargetMs).toBeCloseTo(tickTime(ON_TARGET_TICK), 12);
    expect(presentation.acquisitionFromDetectMs).toBeCloseTo((ON_TARGET_TICK - DETECT_TICK) * TICK_MS, 12);
    expect(presentation.tFirstShotMs).toBeCloseTo(tickTime(FIRE_TICK), 12);
    expect(presentation.firstShotAfterOnTargetMs).toBeCloseTo((FIRE_TICK - ON_TARGET_TICK) * TICK_MS, 12);
    expect(presentation.firstShotHit).toBe(true);
    expect(presentation.preAim?.tMs).toBeCloseTo(tickTime(ONSET_TICK - 1), 12);
    expect(presentation.preAim?.eccentricityDeg).toBeGreaterThan(10);
    expect(presentation.anticipation).toBe(false);
    expect(presentation.flags).toEqual([]);
    expect(result.anticipationRate).toBe(0);
  });

  it.each([
    { name: 'before first visible', fireTick: VISIBLE_TICK + 3, expected: true },
    { name: 'at measurement onset', fireTick: ONSET_TICK, expected: false },
    { name: 'after acquisition', fireTick: FIRE_TICK, expected: false },
  ])('marks anticipation for early fire: $name', ({ fireTick, expected }) => {
    const presentation = onlyPresentation(deriveHoldClickMetrics(makePayload(fireTick), fixtureScene(), holdClickOptions));

    expect(presentation.anticipation).toBe(expected);
    expect(presentation.fireBeforeMeasurementOnset).toBe(expected);
  });
});

function makePayload(fireTick: number): ExportPayload {
  const totalTicks = FIRE_TICK + 12;
  const recorder = createDataRecorder({ capacity: totalTicks + 1 });

  recorder.recordEvent({
    type: 'fire',
    t: tickTime(fireTick),
    hit: true,
    firstShot: true,
    residualSpeed: 0,
    shotSeq: 1,
    targetId: 'target-1',
    offsetDeg: 0,
  });

  for (let tick = 0; tick <= totalTicks; tick++) {
    const t = tickTime(tick);
    const target = targetAtTick(tick);
    if (tick === VISIBLE_TICK) {
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

    recorder.recordTick({
      t,
      vx: 0,
      vz: 0,
      px: 0,
      pz: 0,
      tx: target?.x ?? null,
      ty: target?.y ?? null,
      tz: target?.z ?? null,
      aim: aimAtTick(tick),
      keys: [],
    });
  }

  const payload = buildExportPayload(meta, recorder.snapshot());
  return JSON.parse(serializeJSON(payload)) as ExportPayload;
}

function targetAtTick(tick: number): { x: number; y: number; z: number } | null {
  if (tick < VISIBLE_TICK) return null;
  return { x: tick < ONSET_TICK ? -2 : 0, y: EYE_HEIGHT, z: TARGET_Z };
}

function aimAtTick(tick: number): { yaw: number; pitch: number } {
  if (tick < DETECT_TICK) return aimAtPoint({ x: -4, y: EYE_HEIGHT, z: TARGET_Z });
  if (tick < ON_TARGET_TICK) return aimAtPoint({ x: -3, y: EYE_HEIGHT, z: TARGET_Z });
  return aimAtPoint({ x: 0, y: EYE_HEIGHT, z: TARGET_Z });
}

function aimAtPoint(point: { x: number; y: number; z: number }): { yaw: number; pitch: number } {
  const dx = point.x;
  const dy = point.y - EYE_HEIGHT;
  const dz = point.z;
  const len = Math.hypot(dx, dy, dz);
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.asin(dy / len) };
}

function fixtureScene(): SceneConfig {
  return {
    sceneId: 'hold-click-fixture',
    assetPackVersion: 'synthetic-v1',
    clutterTier: 'low',
    asset: null,
    propBounds: [
      {
        id: 'cover-wall',
        min: { x: -1.5, y: 0, z: -5.1 },
        max: { x: -0.5, y: 3, z: -4.9 },
      },
    ],
    playerCorridor: { halfWidthU: 1 },
  };
}

function onlyPresentation(result: ReturnType<typeof deriveHoldClickMetrics>) {
  expect(result.presentations).toHaveLength(1);
  return result.presentations[0];
}

function tickTime(tick: number): number {
  return tick * TICK_MS;
}
