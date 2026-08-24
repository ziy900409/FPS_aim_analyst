import type { DrillEvent } from '../data/DataRecorder.ts';
import type { ExportPayload } from '../data/export.ts';
import type { TickRecord } from '../data/RingBuffer.ts';
import { CS2_PROFILE } from '../sim/MovementController.ts';
import { describe, expect, it } from 'vitest';
import { counterstrafeCuedV1 } from '../drill/counterstrafe_cued_v1.ts';
import { counterstrafeFreeV1 } from '../drill/counterstrafe_free_v1.ts';
import { counterstrafeReversalV1 } from '../drill/counterstrafe_reversal_v1.ts';
import { deriveCounterstrafeMetrics, type CounterstrafeMetrics } from './counterstrafeMetrics.ts';

describe('deriveCounterstrafeMetrics', () => {
  it.each([
    ['cued', counterstrafeCuedV1, [{ type: 'cue', t: 0, direction: 'A' } satisfies DrillEvent], 120],
    [
      'reversal',
      counterstrafeReversalV1,
      [
        { type: 'cue', t: 100, direction: 'A' } satisfies DrillEvent,
        { type: 'cue', t: 125, direction: 'D' } satisfies DrillEvent,
      ],
      20,
    ],
  ])('%s protocols expose cue-to-key latency', (_name, config, cues, expectedCueToKeyMs) => {
    const metrics = deriveCounterstrafeMetrics(payload(config.drillId, cues));

    expect(metrics.cueToKeyMs?.left.mean).toBe(expectedCueToKeyMs);
    expect(metrics.counterToFireMs.left.mean).toBe(20);
    expect(metrics.timeToAccuracyGateMs.left.mean).toBe(10);
    expect(metrics.zeroCrossingMs.left.mean).toBe(20);
    expect(metrics.fireBeforeGateRate).toBe(1);
    expect(metrics.firstShotHitRate).toBe(1);
  });

  it('keeps the free protocol practice-only and omits cue-to-key latency', () => {
    const metrics = deriveCounterstrafeMetrics(payload(counterstrafeFreeV1.drillId));

    expect(counterstrafeFreeV1).toMatchObject({
      drillId: 'counterstrafe-free-v1',
      mode: 'practice',
      targets: { count: 20, distance: 4 },
      sequence: { alternation: 'LR', seed: 1 },
      timing: { countdownMs: 3000, spawnDelayMs: 0 },
      endCondition: { type: 'targetCount', value: 20 },
    });
    expect(counterstrafeFreeV1.cue).toBeUndefined();
    expect(metrics.cueToKeyMs).toBeUndefined();
  });

  it('exports only stratified measures, never a composite counter-strafe score', () => {
    const metrics = deriveCounterstrafeMetrics(payload(counterstrafeFreeV1.drillId));
    const expectedKeys: readonly (keyof CounterstrafeMetrics)[] = [
      'releaseToFireMs',
      'counterHoldMs',
      'counterToFireMs',
      'timeToAccuracyGateMs',
      'zeroCrossingMs',
      'stopDistanceU',
      'overReversalUPerS',
      'fireBeforeGateRate',
      'firstShotHitRate',
    ];

    expect(Object.keys(metrics).sort()).toEqual([...expectedKeys].sort());
    expect(Object.keys(metrics)).not.toContain('score');
  });
});

function payload(drillId: string, cues: DrillEvent[] = []): ExportPayload {
  const threshold = CS2_PROFILE.accuracyThreshold;
  return {
    meta: {
      schemaVersion: 2,
      drillId,
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
    },
    ticks: [
      tick(100, threshold + 100, 0, ['A']),
      tick(110, threshold + 60, 1, ['A']),
      tick(120, threshold + 10, 2, ['D']),
      tick(130, threshold - 1, 4, ['D']),
      tick(140, -40, 5, []),
      tick(150, -50, 6, []),
    ],
    events: [
      ...cues,
      { type: 'visible', targetId: 'target-0', side: 'L', t: 100 },
      { type: 'counter', key: 'D', t: 120 },
      { type: 'fire', targetId: 'target-0', t: 140, hit: true, firstShot: true, residualSpeed: threshold },
    ],
  };
}

function tick(t: number, vx: number, px: number, keys: TickRecord['keys']): TickRecord {
  return { t, vx, vz: 0, px, pz: 0, tx: 0, ty: 0, tz: 0, aim: { yaw: 0, pitch: 0 }, keys, ads: false };
}
