import { describe, expect, it } from 'vitest';
import type { ExportPayload } from '../data/export.ts';
import type { Meta } from '../data/metadata.ts';
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
});

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
