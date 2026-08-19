import type { DrillEvent } from '../data/DataRecorder.ts';
import type { ExportPayload } from '../data/export.ts';
import type { TickRecord } from '../data/RingBuffer.ts';
import { buildPeekWindows } from './peekWindows.ts';
import { computePhaseMetrics, computePromotedMetrics, computeSyncMetrics } from './researchMetrics.ts';
import { describe, expect, it } from 'vitest';

describe('WP-32 T3 promoted phase/sync metrics', () => {
  it('blocks promoted metrics when tick-integral mouse metadata is absent', () => {
    const payload = payloadWithTicks(ticks(40), [
      visible(0, 0),
      counter(20, 'D'),
      fire(120, 'target-0'),
      visible(1, 400),
    ]);
    const actual = computePromotedMetrics(payload);

    expect(actual.status).toBe('blocked');
    if (actual.status === 'blocked') expect(actual.reason).toContain('mouseIntegration');
  });

  it('derives peek release and no-counter inference flags without changing window anchors', () => {
    const payload = payloadWithTicks(
      [
        tick(0, ['A']),
        tick(7.8125, ['A']),
        tick(15.625, []),
        tick(23.4375, ['D']),
        tick(31.25, []),
      ],
      [visible(0, 0), fire(35, 'target-0')],
    );
    const [peek] = buildPeekWindows(payload);

    expect(peek.tVisible).toBe(0);
    expect(peek.tRelease).toBe(23.4375);
    expect(peek.releaseKey).toBe('D');
    expect(peek.flags).toEqual(['no_counter', 'release_inferred_no_counter']);
  });

  it('phase flags short windows and preserves t_detect from deriveDetectionMetrics path', () => {
    const payload = payloadWithTicks(ticks(8), [visible(0, 0), counter(10, 'D'), fire(20, 'target-0')], true);
    const actual = computePhaseMetrics(payload);

    expect(actual.samples).toHaveLength(1);
    expect(actual.samples[0].flags).toEqual(['window_too_short']);
    expect(actual.samples[0].tDetect).toBeUndefined();
    expect(actual.aggregate.recMs.n).toBe(0);
    expect(actual.aggregate.flagCounts.window_too_short).toBe(1);
  });

  it('sync marks missing anchors and counter hold truncation explicitly', () => {
    const payload = payloadWithTicks(
      [
        tick(0, ['A']),
        tick(10, ['A']),
        tick(20, []),
        tick(30, ['D']),
        tick(40, ['D']),
      ],
      [visible(0, 0), counter(30, 'D')],
    );
    const actual = computeSyncMetrics(payload);

    expect(actual.rows).toHaveLength(1);
    expect(actual.rows[0].releaseToFireMs).toBeUndefined();
    expect(actual.rows[0].counterHoldMs).toBe(10);
    expect(actual.rows[0].flags).toEqual(['no_first_shot', 'missing_first_shot', 'counter_hold_truncated']);
    expect(actual.aggregate.verdicts[0].verdict).toBe('blocked-by-data');
  });
});

function payloadWithTicks(tickRows: TickRecord[], events: DrillEvent[], mouseIntegration = false): ExportPayload {
  return {
    meta: {
      schemaVersion: 2,
      drillId: 'counterstrafe_ad_v1',
      weaponId: 'ak47',
      weaponSeed: 1,
      rngSeed: 1,
      backend: 'webgl2',
      displayHz: 144,
      simHz: 128,
      browser: 'vitest',
      sensitivity: 1,
      sensitivityModel: 'cs2-0.022deg',
      movementModel: 'cs2-source',
      crossOriginIsolated: true,
      startedAt: '2026-08-17T00:00:00.000Z',
      unit: 'source',
      vStrafe: 250,
      maxDrillSeconds: 10,
      lateEventCount: 0,
      bufferOverflow: false,
      recorderOverflow: false,
      suspect: false,
      scene: { sceneId: 'test', assetPackVersion: 'test', clutterTier: 'low', fallback: false, eye: { x: 0, y: 0, z: 0 } },
      ...(mouseIntegration
        ? { mouseIntegration: { model: 'tick-window-integral' as const, radPerCount: 1, hipStep: 1, adsStep: 1 } }
        : {}),
    },
    ticks: tickRows,
    events,
  };
}

function ticks(count: number): TickRecord[] {
  return Array.from({ length: count }, (_, index) => tick(index * 7.8125, index % 3 === 0 ? ['A'] : []));
}

function tick(t: number, keys: readonly string[]): TickRecord {
  return {
    t,
    vx: 0,
    vz: 0,
    px: 0,
    pz: 0,
    tx: 10,
    ty: 0,
    tz: 0,
    aim: { yaw: 0, pitch: 0 },
    keys: keys.filter((key): key is 'A' | 'D' | 'W' | 'S' => ['A', 'D', 'W', 'S'].includes(key)),
    ads: false,
    dYaw: 0,
    dPitch: 0,
  };
}

function visible(index: number, t: number): DrillEvent {
  return { type: 'visible', targetId: `target-${index}`, side: index % 2 === 0 ? 'L' : 'R', t, targetX: 10, targetY: 0, targetZ: 0 };
}

function counter(t: number, key: string): DrillEvent {
  return { type: 'counter', key, t };
}

function fire(t: number, targetId: string): DrillEvent {
  return { type: 'fire', t, hit: false, firstShot: true, residualSpeed: 0, targetId };
}
