import { describe, expect, it } from 'vitest';
import { createDataRecorder } from '../data/DataRecorder.ts';
import { buildExportPayload, serializeJSON, type ExportPayload } from '../data/export.ts';
import type { Meta } from '../data/metadata.ts';
import { deriveLeadError } from './leadDerivation.ts';

const SIM_HZ = 128;
const TICK_MS = 1000 / SIM_HZ;
const EYE_HEIGHT = 1.6;
const TARGET_Y = 1.6;
const TARGET_Z = -100;
const BULLET_SPEED_U = 100;
const FLIGHT_MS = 1000;

const meta: Meta = {
  schemaVersion: 2,
  drillId: 'lead_fixture_v1',
  weaponId: 'ak47_projectile',
  weaponSeed: 223,
  rngSeed: 25025,
  backend: 'webgl2',
  displayHz: 144,
  simHz: SIM_HZ,
  browser: 'test-browser',
  sensitivity: 1,
  sensitivityModel: 'cs2-0.022deg',
  movementModel: 'cs2-source',
  crossOriginIsolated: true,
  startedAt: '2026-07-14T00:00:00.000Z',
  unit: 'source',
  vStrafe: 250,
  maxDrillSeconds: 300,
  lateEventCount: 0,
  bufferOverflow: false,
  recorderOverflow: false,
  suspect: false,
  weapon: {
    id: 'ak47_projectile',
    bullet: { model: 'projectile', speedU: BULLET_SPEED_U, gravityU: 0.001, maxRangeU: 160 },
    projectileOverflow: false,
  },
};

describe('deriveLeadError', () => {
  it('scores a known horizontal lead fixture near zero when aim points at the predicted intercept', () => {
    const payload = makeLeadPayload({
      targetVelocityX: 10,
      gravityU: 0.001,
      aim: 'ideal',
      includeHit: true,
    });

    const result = deriveLeadError(payload);
    const sample = onlySample(result);

    expect(sample.shotSeq).toBe(1);
    expect(sample.timeOfFlightMs).toBe(FLIGHT_MS);
    expect(sample.timeOfFlightSource).toBe('hit');
    expect(sample.targetVelocityUPerSec.x).toBeCloseTo(10, 12);
    expect(sample.leadErrorDeg).toBeLessThan(1e-6);
  });

  it('reports the expected angular miss when aim stays on the target current position', () => {
    const payload = makeLeadPayload({
      targetVelocityX: 10,
      gravityU: 0.001,
      aim: 'current',
      includeHit: true,
    });

    const sample = onlySample(deriveLeadError(payload));

    expect(sample.leadErrorDeg).toBeCloseTo(radToDeg(Math.atan2(10, 100)), 3);
  });

  it('includes gravity compensation in the ideal lead direction', () => {
    const payload = makeLeadPayload({
      targetVelocityX: 0,
      gravityU: 2,
      aim: 'current',
      includeHit: true,
    });

    const sample = onlySample(deriveLeadError(payload));

    expect(sample.leadErrorDeg).toBeCloseTo(radToDeg(Math.atan2(1, 100)), 3);
    expect(sample.idealPitch).toBeGreaterThan(sample.actualPitch);
  });

  it('can estimate flight time from projectile speed when no hit event exists', () => {
    const payload = makeLeadPayload({
      targetVelocityX: 0,
      gravityU: 0.001,
      aim: 'current',
      includeHit: false,
    });

    const sample = onlySample(deriveLeadError(payload));

    expect(sample.timeOfFlightSource).toBe('estimated');
    expect(sample.timeOfFlightMs).toBeCloseTo(1000, 9);
  });
});

interface LeadFixtureOptions {
  targetVelocityX: number;
  gravityU: number;
  aim: 'ideal' | 'current';
  includeHit: boolean;
}

function makeLeadPayload(options: LeadFixtureOptions): ExportPayload {
  const totalTicks = SIM_HZ;
  const recorder = createDataRecorder({ capacity: totalTicks + 1 });
  const targetAtFire = { x: 0, y: TARGET_Y, z: TARGET_Z };
  const targetAtHit = { x: options.targetVelocityX, y: TARGET_Y, z: TARGET_Z };
  const aimPoint =
    options.aim === 'ideal'
      ? { x: targetAtHit.x, y: targetAtHit.y + 0.5 * options.gravityU, z: targetAtHit.z }
      : targetAtFire;
  const aim = aimAtPoint(aimPoint);

  recorder.recordEvent({
    type: 'fire',
    t: 0,
    hit: false,
    firstShot: true,
    residualSpeed: 0,
    shotSeq: 1,
    targetId: 'target-1',
    viewYaw: aim.yaw,
    viewPitch: aim.pitch,
  });
  if (options.includeHit) {
    recorder.recordEvent({
      type: 'hit',
      t: FLIGHT_MS,
      timeOfFlightMs: FLIGHT_MS,
      shotSeq: 1,
      targetId: 'target-1',
      part: 'body',
    });
  }

  for (let tick = 0; tick <= totalTicks; tick++) {
    const t = tick * TICK_MS;
    const ageSec = t / 1000;
    const tx = options.targetVelocityX * ageSec;
    recorder.recordTick({
      t,
      vx: 0,
      vz: 0,
      px: 0,
      pz: 0,
      tx,
      ty: TARGET_Y,
      tz: TARGET_Z,
      aim,
      keys: [],
    });
  }

  const payload = buildExportPayload(
    {
      ...meta,
      weapon: {
        id: 'ak47_projectile',
        bullet: { model: 'projectile', speedU: BULLET_SPEED_U, gravityU: options.gravityU, maxRangeU: 160 },
        projectileOverflow: false,
      },
    },
    recorder.snapshot(),
  );
  return JSON.parse(serializeJSON(payload)) as ExportPayload;
}

function aimAtPoint(point: { x: number; y: number; z: number }): { yaw: number; pitch: number } {
  const dx = point.x;
  const dy = point.y - EYE_HEIGHT;
  const dz = point.z;
  const len = Math.hypot(dx, dy, dz);
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.asin(dy / len) };
}

function onlySample(result: ReturnType<typeof deriveLeadError>) {
  expect(result.samples).toHaveLength(1);
  return result.samples[0];
}

function radToDeg(value: number): number {
  return (value * 180) / Math.PI;
}
