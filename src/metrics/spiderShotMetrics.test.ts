import { describe, expect, it } from 'vitest';
import type { ExportPayload } from '../data/export.ts';
import type { Meta } from '../data/metadata.ts';
import { SPIDER_SHOT_HITBOX_V2 } from '../drill/spider_shot_v2.ts';
import { deriveSpiderShotMetrics } from './spiderShotMetrics.ts';

const CENTER = { x: 0, y: 0, z: -10 };
const PERIPHERAL = { x: 5, y: 0, z: -Math.sqrt(75) };

const meta: Meta = {
  schemaVersion: 2,
  drillId: 'spider-shot-v1',
  weaponId: 'ak47',
  weaponSeed: 0,
  rngSeed: 36036,
  backend: 'webgl2',
  displayHz: 144,
  simHz: 100,
  browser: 'test-browser',
  sensitivity: 1,
  sensitivityModel: 'cs2-0.022deg',
  movementModel: 'cs2-source',
  crossOriginIsolated: true,
  startedAt: '2026-08-24T00:00:00.000Z',
  unit: 'source',
  vStrafe: 250,
  maxDrillSeconds: 300,
  lateEventCount: 0,
  bufferOverflow: false,
  recorderOverflow: false,
  suspect: false,
  simToWorld: 1,
  scene: { sceneId: 'fixture', assetPackVersion: 'synthetic-v1', clutterTier: 'low', fallback: false, eye: { x: 0, y: 0, z: 0 } },
  targets: { hitbox: { widthU: 1, heightU: 2, depthU: 1 } },
  spawn: { seed: 36036, spiderShot: { kind: 'center-peripheral' } },
};

describe('deriveSpiderShotMetrics', () => {
  it('assembles the five metrics for peripheral arrivals and keeps center returns in rhythm only', () => {
    const result = deriveSpiderShotMetrics(makePayload(), {
      detection: { preStimulusMs: 50, sustainedTicks: 1, thresholdSdMultiplier: 0 },
    });

    expect(result.switchReaction).toEqual([
      { targetId: 'peripheral-1', tDetectMs: 210, reactionMs: 10 },
      { targetId: 'peripheral-2', tDetectMs: 410, reactionMs: 10 },
    ]);
    expect(result.movementExecution).toEqual([
      { targetId: 'peripheral-1', movementTimeMs: 30, peakOmegaDegPerSec: 1500 },
      { targetId: 'peripheral-2', movementTimeMs: 30, peakOmegaDegPerSec: 1500 },
    ]);
    expect(result.stopControl).toEqual([
      { targetId: 'peripheral-1', overshootDeg: expect.any(Number), dropCount: 1, microAdjustCount: 1 },
      { targetId: 'peripheral-2', overshootDeg: expect.any(Number), dropCount: 1, microAdjustCount: 1 },
    ]);
    expect(result.stopControl.every((metric) => metric.overshootDeg! > 3)).toBe(true);
    expect(result.firstShot).toEqual([
      { targetId: 'peripheral-1', hit: true, fireAngleErrorDeg: 0 },
      { targetId: 'peripheral-2', hit: false, fireAngleErrorDeg: 0 },
    ]);
    expect(result.rhythm).toEqual({ transitionIntervalMs: [100, 100, 100, 100], medianMs: 100, p95Ms: 100 });
  });

  it('reads the spider-shot-v2 sphere hitbox as a sphere, never as its bounding cube (KI-021)', () => {
    const detection = { preStimulusMs: 50, sustainedTicks: 1, thresholdSdMultiplier: 0 } as const;
    // Same dimensions, only `shape` differs — so any movement-time gap is purely the geometry.
    const asSphere = deriveSpiderShotMetrics(makeSphereAnisotropyPayload('sphere'), { detection });
    const asCube = deriveSpiderShotMetrics(makeSphereAnisotropyPayload('box'), { detection });

    const sphereMs = asSphere.movementExecution[0].movementTimeMs;
    const cubeMs = asCube.movementExecution[0].movementTimeMs;
    expect(cubeMs).toBeDefined();
    expect(sphereMs).toBeDefined();

    // The fixture holds the aim in the cube's corner region (0.115u off-axis on two axes: inside
    // the bounding cube, 0.162u out radially vs the 0.1396u sphere radius) for two ticks before
    // settling on centre. The bounding-cube reading stamps `firstOnTarget` there; the sphere does
    // not — that pair of ticks is the tick-level lock on the pre-fix misread.
    expect(cubeMs).toBe(CORNER_HOLD_MS - DETECT_MS);
    expect(sphereMs).toBe(CENTRE_ARRIVAL_MS - DETECT_MS);
    // Single-direction regression: sphere geometry is strictly the stricter of the two, so a
    // sphere `firstOnTarget` can never precede the bounding-cube one.
    expect(sphereMs!).toBeGreaterThan(cubeMs!);
  });
});

const V2_VISIBLE_MS = 200;
const DETECT_MS = 210;
const CORNER_HOLD_MS = 230;
const CENTRE_ARRIVAL_MS = 250;
const V2_PRESENTATION_END_MS = 300;
const V2_DISTANCE_U = 8;
/** Off-axis offset per axis (u), in the sightline frame: inside the cube, outside the sphere. */
const CORNER_OFFSET_U = 0.115;
const V2_CENTER = { x: 0, y: 0, z: -V2_DISTANCE_U };
const V2_PERIPHERAL = { x: 4, y: 0, z: -Math.sqrt(V2_DISTANCE_U * V2_DISTANCE_U - 16) };

/**
 * One peripheral presentation whose aim parks in the cube-corner region before settling on the
 * target centre. Identical in every respect except `meta.targets.hitbox.shape`.
 */
function makeSphereAnisotropyPayload(shape: 'box' | 'sphere'): ExportPayload {
  const ticks: ExportPayload['ticks'] = [];
  let previousYaw = aimAtPoint(V2_CENTER).yaw;
  let previousPitch = 0;
  for (let t = 0; t <= V2_PRESENTATION_END_MS; t += 10) {
    const peripheral = t >= V2_VISIBLE_MS && t < V2_PRESENTATION_END_MS;
    const target = peripheral ? V2_PERIPHERAL : V2_CENTER;
    const aim = aimAtPoint(v2AimPoint(t));
    ticks.push({
      t,
      vx: 0,
      vz: 0,
      px: 0,
      pz: 0,
      tx: target.x,
      ty: target.y,
      tz: target.z,
      aim,
      keys: [],
      ads: false,
      dYaw: aim.yaw - previousYaw,
      dPitch: aim.pitch - previousPitch,
    });
    previousYaw = aim.yaw;
    previousPitch = aim.pitch;
  }

  return {
    meta: {
      ...meta,
      drillId: 'spider-shot-v2',
      targets: { hitbox: { ...SPIDER_SHOT_HITBOX_V2, shape } },
    },
    ticks,
    events: [
      visible('center-0', 'center', V2_CENTER, 100),
      visible('peripheral-1', 'peripheral', V2_PERIPHERAL, V2_VISIBLE_MS),
      visible('center-1', 'center', V2_CENTER, V2_PRESENTATION_END_MS),
    ],
  };
}

function v2AimPoint(t: number): { x: number; y: number; z: number } {
  if (t < DETECT_MS) return V2_CENTER;
  if (t < CORNER_HOLD_MS) return midpoint(V2_CENTER, V2_PERIPHERAL);
  if (t < CENTRE_ARRIVAL_MS) return cornerAimPoint();
  return V2_PERIPHERAL;
}

function midpoint(a: typeof V2_CENTER, b: typeof V2_CENTER): typeof V2_CENTER {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

/** `V2_PERIPHERAL` displaced by `CORNER_OFFSET_U` along both axes perpendicular to the sightline. */
function cornerAimPoint(): typeof V2_CENTER {
  const forward = {
    x: V2_PERIPHERAL.x / V2_DISTANCE_U,
    y: V2_PERIPHERAL.y / V2_DISTANCE_U,
    z: V2_PERIPHERAL.z / V2_DISTANCE_U,
  };
  // World up is perpendicular to this sightline (the target sits on the eye plane), so `right` is
  // simply forward × up and the two offsets stay orthogonal to the ray.
  const right = { x: -forward.z, y: 0, z: forward.x };
  return {
    x: V2_PERIPHERAL.x + CORNER_OFFSET_U * right.x,
    y: V2_PERIPHERAL.y + CORNER_OFFSET_U,
    z: V2_PERIPHERAL.z + CORNER_OFFSET_U * right.z,
  };
}

function aimAtPoint(point: { x: number; y: number; z: number }): { yaw: number; pitch: number } {
  const len = Math.hypot(point.x, point.y, point.z);
  return { yaw: Math.atan2(-point.x, -point.z), pitch: Math.asin(point.y / len) };
}

function makePayload(): ExportPayload {
  const ticks: ExportPayload['ticks'] = [];
  let previousYaw = 0;
  for (let t = 0; t <= 500; t += 10) {
    const target = targetAt(t);
    const aim = aimAt(t);
    ticks.push({
      t,
      vx: 0,
      vz: 0,
      px: 0,
      pz: 0,
      tx: target.x,
      ty: target.y,
      tz: target.z,
      aim: { yaw: aim, pitch: 0 },
      keys: [],
      ads: false,
      dYaw: aim - previousYaw,
      dPitch: 0,
    });
    previousYaw = aim;
  }

  return {
    meta,
    ticks,
    events: [
      visible('center-0', 'center', CENTER, 100),
      visible('peripheral-1', 'peripheral', PERIPHERAL, 200),
      { type: 'fire', t: 280, hit: true, firstShot: true, residualSpeed: 0, targetId: 'peripheral-1' },
      visible('center-1', 'center', CENTER, 300),
      visible('peripheral-2', 'peripheral', PERIPHERAL, 400),
      { type: 'fire', t: 480, hit: false, firstShot: true, residualSpeed: 0, targetId: 'peripheral-2' },
      visible('center-2', 'center', CENTER, 500),
    ],
  };
}

function targetAt(t: number): typeof CENTER {
  return (t >= 200 && t < 300) || (t >= 400 && t < 500) ? PERIPHERAL : CENTER;
}

function aimAt(t: number): number {
  const peripheralYaw = aimYaw(PERIPHERAL);
  const withinPeripheral = (t >= 200 && t < 300) || (t >= 400 && t < 500);
  if (!withinPeripheral) return aimYaw(CENTER);
  const phase = t % 200;
  if (phase === 0) return aimYaw(CENTER);
  if (phase === 10) return peripheralYaw / 2;
  if (phase === 20) return (peripheralYaw * 2) / 3;
  if (phase === 30) return (peripheralYaw * 5) / 6;
  if (phase === 50) return peripheralYaw + 0.06;
  if (phase === 60) return peripheralYaw + 0.08;
  return peripheralYaw;
}

function aimYaw(point: { x: number; z: number }): number {
  return Math.atan2(-point.x, -point.z);
}

function visible(
  targetId: string,
  zone: 'center' | 'peripheral',
  point: { x: number; y: number; z: number },
  t: number,
): Extract<ExportPayload['events'][number], { type: 'visible' }> {
  return { type: 'visible', targetId, side: 'R', zone, t, targetX: point.x, targetY: point.y, targetZ: point.z };
}
