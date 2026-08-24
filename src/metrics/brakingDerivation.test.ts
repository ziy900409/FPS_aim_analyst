import type { DrillEvent } from '../data/DataRecorder.ts';
import type { ExportPayload } from '../data/export.ts';
import type { TickRecord } from '../data/RingBuffer.ts';
import { CS2_PROFILE } from '../sim/MovementController.ts';
import { describe, expect, it } from 'vitest';
import { deriveBrakingSamples } from './brakingDerivation.ts';

describe('deriveBrakingSamples', () => {
  it('derives all four measurements using the MovementController accuracy threshold', () => {
    const threshold = CS2_PROFILE.accuracyThreshold;
    const [sample] = deriveBrakingSamples(
      payload([
        tick(0, threshold + 100, 10),
        tick(10, threshold, 12),
        tick(20, threshold - 1, 15),
        tick(30, -40, 18),
        tick(40, -60, 20),
      ]),
    );

    expect(sample).toMatchObject({
      peekIndex: 0,
      side: 'L',
      timeToAccuracyGateMs: 20,
      zeroCrossingMs: 30,
      stopDistanceU: 5,
      overReversalUPerS: 60,
      flags: [],
    });
  });

  it('does not invent a zero crossing when velocity never reverses', () => {
    const [sample] = deriveBrakingSamples(payload([tick(0, 150, 10), tick(10, 80, 14), tick(20, 20, 16)]));

    expect(sample.zeroCrossingMs).toBeUndefined();
    expect(sample.overReversalUPerS).toBeUndefined();
    expect(sample.flags).toContain('no_zero_crossing');
  });

  it('reads the current MovementController threshold instead of carrying a duplicate constant', () => {
    const originalThreshold = CS2_PROFILE.accuracyThreshold;
    CS2_PROFILE.accuracyThreshold = originalThreshold + 10;
    try {
      const [sample] = deriveBrakingSamples(payload([tick(0, originalThreshold, 10)]));
      expect(sample.timeToAccuracyGateMs).toBe(0);
    } finally {
      CS2_PROFILE.accuracyThreshold = originalThreshold;
    }
  });

  it('flags a first-shot-truncated window instead of treating a missing reversal as zero', () => {
    const [sample] = deriveBrakingSamples(
      payload(
        [tick(0, 150, 10), tick(10, 110, 12), tick(20, 95, 13)],
        [{ type: 'fire', t: 20, hit: false, firstShot: true, residualSpeed: 95, targetId: 'target-0' }],
      ),
    );

    expect(sample.zeroCrossingMs).toBeUndefined();
    expect(sample.overReversalUPerS).toBeUndefined();
    expect(sample.flags).toEqual(['no_accuracy_gate', 'no_zero_crossing', 'window_truncated_by_fire']);
  });
});

function payload(ticks: TickRecord[], extraEvents: DrillEvent[] = []): ExportPayload {
  return {
    meta: baseMeta(),
    ticks,
    events: [
      { type: 'visible', targetId: 'target-0', side: 'L', t: 0 },
      { type: 'counter', key: 'D', t: 0 },
      ...extraEvents,
    ],
  };
}

function tick(t: number, vx: number, px: number): TickRecord {
  return {
    t,
    vx,
    vz: 0,
    px,
    pz: 0,
    tx: 0,
    ty: 0,
    tz: 0,
    aim: { yaw: 0, pitch: 0 },
    keys: [],
    ads: false,
  };
}

function baseMeta(): ExportPayload['meta'] {
  return {
    schemaVersion: 2,
    drillId: 'counterstrafe-cued-v1',
    weaponId: 'ak47',
    weaponSeed: 1,
    rngSeed: 1,
    backend: 'webgl2',
    displayHz: 144,
    simHz: 100,
    browser: 'vitest',
    sensitivity: 1,
    sensitivityModel: 'cs2-0.022deg',
    movementModel: 'cs2-source',
    fovDeg: 90,
    crossOriginIsolated: true,
    startedAt: '2026-08-24T00:00:00.000Z',
    unit: 'source',
    vStrafe: 250,
    maxDrillSeconds: 10,
    lateEventCount: 0,
    bufferOverflow: false,
    recorderOverflow: false,
    suspect: false,
  };
}
