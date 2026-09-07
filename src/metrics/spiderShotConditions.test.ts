import { describe, expect, it } from 'vitest';
import type { ExportPayload } from '../data/export.ts';
import type { Meta } from '../data/metadata.ts';
import { buildCompatibilityKey } from './compatibilityKey.ts';
import { deriveSpiderShotTransitions } from './spiderShotConditions.ts';

const CENTER = { x: 0, y: 0, z: -10 };
const COS_30 = Math.sqrt(3) / 2;
const SIN_30 = 0.5;

const meta: Meta = {
  schemaVersion: 2,
  drillId: 'spider-shot-v1',
  weaponId: 'ak47',
  weaponSeed: 0,
  rngSeed: 36036,
  backend: 'webgl2',
  displayHz: 144,
  simHz: 128,
  browser: 'test-browser',
  sensitivity: 1,
  sensitivityModel: 'cs2-0.022deg',
  movementModel: 'cs2-source',
  fovDeg: 90,
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
  scene: {
    sceneId: 'synthetic-eye-origin',
    assetPackVersion: 'synthetic-v1',
    clutterTier: 'low',
    fallback: false,
    eye: { x: 0, y: 0, z: 0 },
  },
  targets: { hitbox: { widthU: 1, heightU: 2, depthU: 1 } },
  spawn: { seed: 36036, spiderShot: { kind: 'center-peripheral' } },
  assessment: {
    protocolVersion: '1.0.0',
    assessmentFeedbackPolicy: 'minimal-end-of-block',
  },
  session: { participantId: 'p-1' },
};

describe('deriveSpiderShotTransitions', () => {
  it('derives D_deg, W_deg, and four axial plus two oblique presentation labels', () => {
    const transitions = deriveSpiderShotTransitions(makePayload());
    const peripheral = transitions.filter((transition) => transition.direction === 'center-to-peripheral');
    const returns = transitions.filter((transition) => transition.direction === 'peripheral-to-center');

    expect(peripheral.map((transition) => transition.quadrant)).toEqual([
      'vertical',
      'horizontal',
      'vertical',
      'horizontal',
      'oblique',
      'oblique',
    ]);
    expect(returns.every((transition) => transition.quadrant === undefined)).toBe(true);

    for (const transition of transitions) {
      expect(transition.angularDistanceDeg).toBeCloseTo(30, 12);
      expect(transition.worldDistanceU).toBeCloseTo(10, 12);
      expect(transition.angularSizeDeg).toBeCloseTo((2 * Math.atan(0.5 / 10) * 180) / Math.PI, 12);
      expect(transition.targetConditionCell).toBe(
        `spider:d=${transition.angularDistanceDeg.toFixed(6)};w=${transition.angularSizeDeg.toFixed(6)}`,
      );
      expect(transition.seed).toBe(36036);
      expect(transition.hitbox).toEqual({ width: 1, height: 2, depth: 1 });
    }

    expect(() => buildCompatibilityKey(meta, 'spider-shot-v1', transitions[0].targetConditionCell, 'ok')).not.toThrow();
  });

  it('uses the exported GD-7 hitbox as the sole angular-size source', () => {
    const standard = deriveSpiderShotTransitions(makePayload())[0];
    const wider: ExportPayload = {
      ...makePayload(),
      meta: { ...meta, targets: { hitbox: { widthU: 2, heightU: 2, depthU: 1 } } },
    };
    const changed = deriveSpiderShotTransitions(wider)[0];

    expect(changed.hitbox.width).toBe(2);
    expect(changed.angularSizeDeg).toBeGreaterThan(standard.angularSizeDeg);
    expect(changed.targetConditionCell).not.toBe(standard.targetConditionCell);
  });

  it('derives delivered D_deg and W_deg from the exported eye position at each visible tick', () => {
    const center = { x: 0, y: 1.5, z: -8 };
    const peripheral = { x: 2, y: 1.5, z: -8 };
    const payload: ExportPayload = {
      meta: {
        ...meta,
        simToWorld: 1,
        scene: {
          sceneId: 'placeholder-room',
          assetPackVersion: 'placeholder-room-v1',
          clutterTier: 'low',
          fallback: false,
          eye: { x: 0, y: 1.6, z: 4 },
        },
      },
      ticks: [tick(0, 0, 0), tick(10, 1, 0)],
      events: [
        visible('center', 'center', center, 0),
        visible('peripheral', 'peripheral', peripheral, 10),
      ],
    };

    const [transition] = deriveSpiderShotTransitions(payload, { strictEyeOrigin: true });
    const centerDirection = normalize({ x: 0, y: -0.1, z: -12 });
    const peripheralDirection = normalize({ x: 1, y: -0.1, z: -12 });
    const expectedDistanceU = Math.hypot(1, -0.1, -12);
    const expectedAngularDistanceDeg =
      (Math.acos(
        centerDirection.x * peripheralDirection.x +
          centerDirection.y * peripheralDirection.y +
          centerDirection.z * peripheralDirection.z,
      ) *
        180) /
      Math.PI;

    expect(transition.worldDistanceU).toBeCloseTo(expectedDistanceU, 12);
    expect(transition.angularDistanceDeg).toBeCloseTo(expectedAngularDistanceDeg, 12);
    expect(transition.angularSizeDeg).toBeCloseTo((2 * Math.atan(0.5 / expectedDistanceU) * 180) / Math.PI, 12);
  });
});

function tick(t: number, px: number, pz: number): ExportPayload['ticks'][number] {
  return {
    t,
    vx: 0,
    vz: 0,
    px,
    pz,
    tx: null,
    ty: null,
    tz: null,
    aim: { yaw: 0, pitch: 0 },
    keys: [],
    ads: false,
  };
}

function normalize(point: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  const length = Math.hypot(point.x, point.y, point.z);
  return { x: point.x / length, y: point.y / length, z: point.z / length };
}

function makePayload(): ExportPayload {
  const peripheral = [
    pointAtAzimuth(0),
    pointAtAzimuth(90),
    pointAtAzimuth(180),
    pointAtAzimuth(270),
    pointAtAzimuth(45),
    pointAtAzimuth(225),
  ];
  const events: ExportPayload['events'] = [];

  events.push(visible('center-0', 'center', CENTER, 0));
  peripheral.forEach((point, index) => {
    events.push(visible(`peripheral-${index}`, 'peripheral', point, index * 2 + 1));
    events.push(visible(`center-${index + 1}`, 'center', CENTER, index * 2 + 2));
  });

  return { meta, ticks: [], events };
}

function pointAtAzimuth(azimuthDeg: number): { x: number; y: number; z: number } {
  const azimuthRad = (azimuthDeg * Math.PI) / 180;
  return {
    x: 10 * SIN_30 * Math.sin(azimuthRad),
    y: 10 * SIN_30 * Math.cos(azimuthRad),
    z: -10 * COS_30,
  };
}

function visible(
  targetId: string,
  zone: 'center' | 'peripheral',
  point: { x: number; y: number; z: number },
  t: number,
): Extract<ExportPayload['events'][number], { type: 'visible' }> {
  return { type: 'visible', targetId, side: 'R', zone, t, targetX: point.x, targetY: point.y, targetZ: point.z };
}
