import { describe, expect, it } from 'vitest';
import type { DrillEvent } from '../data/DataRecorder.ts';
import type { ExportPayload } from '../data/export.ts';
import type { Meta } from '../data/metadata.ts';
import type { TickRecord } from '../data/RingBuffer.ts';
import type { SceneConfig } from '../scene/SceneConfig.ts';
import { CS2_PROFILE } from '../sim/MovementController.ts';
import { derivePeekClickTransferMetrics, type PeekClickTransferMetrics } from './peekClickTransferMetrics.ts';

const OPTIONS = { sampleCount: 9 as const, onsetThreshold: 0.5 };
const UNDER_GATE = CS2_PROFILE.accuracyThreshold - 5;
const OVER_GATE = CS2_PROFILE.accuracyThreshold + 50;

describe('derivePeekClickTransferMetrics', () => {
  it('joins a clean first-hit presentation without redefining frozen constructs', () => {
    const payload = buildPayload({
      ticks: [tick(10, { tx: -2 }), tick(20, { tx: -2 }), tick(30, { tx: -2 })],
      events: [
        visible('target-0', 'L', 10),
        counter(15),
        fire({ t: 30, hit: true, firstShot: true, residualSpeed: UNDER_GATE, targetId: 'target-0' }),
      ],
    });

    const metrics = derivePeekClickTransferMetrics(payload, scene(), OPTIONS);
    const presentation = onlyPresentation(metrics);

    expect(presentation.targetId).toBe('target-0');
    expect(presentation.side).toBe('L');
    expect(presentation.tMeasurementOnsetMs).toBe(10);
    expect(presentation.tFirstShotMs).toBe(30);
    expect(presentation.onsetToFirstShotMs).toBe(20);
    expect(presentation.onsetToHitMs).toBe(20);
    expect(presentation.shotsToKill).toBe(1);
    expect(presentation.firstShotHit).toBe(true);
    expect(presentation.validFirstShot).toBe(true);
    expect(presentation.flags).toEqual([]);
    expect(metrics.validFirstShotRate).toBe(1);
  });

  it('separates a first miss from the second, killing shot', () => {
    const payload = buildPayload({
      ticks: [tick(10, { tx: -2 }), tick(20, { tx: -2 }), tick(30, { tx: -2 }), tick(40, { tx: -2 })],
      events: [
        visible('target-0', 'L', 10),
        counter(15),
        fire({ t: 30, hit: false, firstShot: true, residualSpeed: OVER_GATE, targetId: 'target-0' }),
        fire({ t: 40, hit: true, firstShot: false, residualSpeed: UNDER_GATE, targetId: 'target-0' }),
      ],
    });

    const presentation = onlyPresentation(derivePeekClickTransferMetrics(payload, scene(), OPTIONS));

    expect(presentation.tFirstShotMs).toBe(30);
    expect(presentation.shotsToKill).toBe(2);
    expect(presentation.firstShotHit).toBe(false);
    expect(presentation.validFirstShot).toBe(false);
    expect(presentation.flags).toEqual(['fire_before_gate']);
  });

  it('flags a target that never reaches measurement onset as a pre-onset timeout', () => {
    const payload = buildPayload({
      ticks: [tick(10), tick(3000)],
      events: [visible('target-0', 'R', 10, { x: -2, y: 1.6, z: -8 })],
    });

    const presentation = onlyPresentation(derivePeekClickTransferMetrics(payload, scene(), OPTIONS));

    expect(presentation.tMeasurementOnsetMs).toBeUndefined();
    expect(presentation.tFirstShotMs).toBeUndefined();
    expect(presentation.onsetToFirstShotMs).toBeUndefined();
    expect(presentation.onsetToHitMs).toBeUndefined();
    expect(presentation.shotsToKill).toBeUndefined();
    expect(presentation.firstShotHit).toBe(false);
    expect(presentation.validFirstShot).toBe(false);
    expect(sortedFlags(presentation)).toEqual(['no_counter', 'no_measurement_onset', 'timeout', 'timeout_before_onset']);
  });

  it('flags a shot fired before the target is geometrically exposed', () => {
    const payload = buildPayload({
      ticks: [tick(10), tick(15), tick(20, { tx: -2 })],
      events: [
        visible('target-0', 'L', 10, { x: -2, y: 1.6, z: -8 }),
        counter(12),
        fire({ t: 15, hit: false, firstShot: true, residualSpeed: UNDER_GATE, targetId: 'target-0' }),
      ],
    });

    const presentation = onlyPresentation(derivePeekClickTransferMetrics(payload, scene(), OPTIONS));

    expect(presentation.tMeasurementOnsetMs).toBe(20);
    expect(sortedFlags(presentation)).toEqual(['fire_before_first_visible', 'fire_before_measurement_onset', 'timeout']);
  });

  it('flags a presentation with no counter event', () => {
    const payload = buildPayload({
      ticks: [tick(10, { tx: -2 }), tick(20, { tx: -2 })],
      events: [visible('target-0', 'L', 10), fire({ t: 20, hit: true, firstShot: true, residualSpeed: UNDER_GATE, targetId: 'target-0' })],
    });

    const presentation = onlyPresentation(derivePeekClickTransferMetrics(payload, scene(), OPTIONS));

    expect(presentation.validFirstShot).toBe(true);
    expect(presentation.flags).toEqual(['no_counter']);
  });

  it('flags player movement beyond the configured corridor during the presentation window', () => {
    const payload = buildPayload({
      ticks: [tick(10, { tx: -2, px: 0 }), tick(20, { tx: -2, px: 50 }), tick(30, { tx: -2, px: 0 })],
      events: [
        visible('target-0', 'L', 10),
        counter(15),
        fire({ t: 30, hit: true, firstShot: true, residualSpeed: UNDER_GATE, targetId: 'target-0' }),
      ],
    });

    const presentation = onlyPresentation(derivePeekClickTransferMetrics(payload, scene(1), OPTIONS));

    expect(presentation.flags).toEqual(['player_corridor_exceeded']);
  });

  it('produces the same result regardless of event array order (targetId join, not index)', () => {
    const events: DrillEvent[] = [
      visible('target-0', 'L', 10),
      counter(15),
      fire({ t: 30, hit: false, firstShot: true, residualSpeed: OVER_GATE, targetId: 'target-0' }),
      fire({ t: 40, hit: true, firstShot: false, residualSpeed: UNDER_GATE, targetId: 'target-0' }),
    ];
    const ticks = [tick(10, { tx: -2 }), tick(20, { tx: -2 }), tick(30, { tx: -2 }), tick(40, { tx: -2 })];

    const inOrder = derivePeekClickTransferMetrics(buildPayload({ ticks, events }), scene(), OPTIONS);
    const shuffled = derivePeekClickTransferMetrics(
      buildPayload({ ticks: [...ticks].reverse(), events: [...events].reverse() }),
      scene(),
      OPTIONS,
    );

    expect(shuffled).toEqual(inOrder);
  });

  it('exports only the documented keys and never a composite score', () => {
    const payload = buildPayload({
      ticks: [tick(10, { tx: -2 }), tick(20, { tx: -2 })],
      events: [
        visible('target-0', 'L', 10),
        counter(15),
        fire({ t: 20, hit: true, firstShot: true, residualSpeed: UNDER_GATE, targetId: 'target-0' }),
      ],
    });

    const metrics = derivePeekClickTransferMetrics(payload, scene(), OPTIONS);
    const expectedKeys: readonly (keyof PeekClickTransferMetrics)[] = [
      'presentations',
      'validFirstShotRate',
      'firstShotHitRate',
      'fireBeforeGateRate',
      'counterstrafe',
      'anticipationRate',
    ];

    expect(Object.keys(metrics).sort()).toEqual([...expectedKeys].sort());
    expect(Object.keys(metrics)).not.toContain('score');
    expect(Object.keys(metrics)).not.toContain('compositeScore');

    const presentationKeys = Object.keys(onlyPresentation(metrics));
    expect(presentationKeys).not.toContain('score');
    expect(presentationKeys).not.toContain('compositeScore');
  });
});

function buildPayload(input: { ticks: TickRecord[]; events: DrillEvent[]; metaOverrides?: Partial<Meta> }): ExportPayload {
  return { meta: baseMeta(input.metaOverrides), ticks: input.ticks, events: input.events };
}

function baseMeta(overrides: Partial<Meta> = {}): Meta {
  return {
    schemaVersion: 2,
    drillId: 'peek-click-transfer-pilot-v1',
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
    fovDeg: 90,
    crossOriginIsolated: true,
    startedAt: '2026-08-26T00:00:00.000Z',
    unit: 'source',
    vStrafe: 250,
    maxDrillSeconds: 120,
    lateEventCount: 0,
    bufferOverflow: false,
    recorderOverflow: false,
    suspect: false,
    simToWorld: 1,
    scene: {
      sceneId: 'peek-transfer-fixture',
      assetPackVersion: 'synthetic-v1',
      clutterTier: 'low',
      fallback: false,
      eye: { x: 0, y: 1.6, z: 0 },
    },
    ...overrides,
  };
}

function scene(halfWidthU = 10): SceneConfig {
  return {
    sceneId: 'peek-transfer-fixture',
    assetPackVersion: 'synthetic-v1',
    clutterTier: 'low',
    asset: null,
    propBounds: [],
    playerCorridor: { halfWidthU },
  };
}

function tick(t: number, overrides: Partial<TickRecord> = {}): TickRecord {
  return {
    t,
    vx: 0,
    vz: 0,
    px: 0,
    pz: 0,
    tx: null,
    ty: 1.6,
    tz: -8,
    aim: { yaw: 0, pitch: 0 },
    keys: [],
    ads: false,
    ...overrides,
  };
}

function visible(
  targetId: string,
  side: 'L' | 'R',
  t: number,
  target?: { x: number; y: number; z: number },
): DrillEvent {
  return {
    type: 'visible',
    targetId,
    side,
    t,
    ...(target !== undefined ? { targetX: target.x, targetY: target.y, targetZ: target.z } : {}),
  };
}

function counter(t: number): DrillEvent {
  return { type: 'counter', key: 'D', t };
}

function fire(input: { t: number; hit: boolean; firstShot: boolean; residualSpeed: number; targetId: string }): DrillEvent {
  return { type: 'fire', ...input };
}

function onlyPresentation(metrics: PeekClickTransferMetrics) {
  expect(metrics.presentations).toHaveLength(1);
  return metrics.presentations[0];
}

function sortedFlags(presentation: PeekClickTransferMetrics['presentations'][number]): string[] {
  return [...presentation.flags].sort();
}
