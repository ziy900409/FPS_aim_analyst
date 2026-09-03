import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ExportPayload } from '../data/export.ts';
import type { Meta } from '../data/metadata.ts';
import type { TickRecord } from '../data/RingBuffer.ts';
import { deriveTrackingMetrics } from './trackingDerivation.ts';
import {
  deriveTrackingContactSamples,
  type TrackingContactBlockedReason,
  type TrackingContactDerivationResult,
} from './trackingContact.ts';

const SIM_HZ = 128;
const TICK_MS = 1000 / SIM_HZ;
const EYE = { x: 0, y: 1.6, z: 0 };
const TARGET = { x: 0, y: 1.6, z: -4 };
const TARGET_2 = { x: 3, y: 1.6, z: -4 };

const baseMeta: Meta = {
  schemaVersion: 2,
  drillId: 'tracking_v1',
  weaponId: 'ak47',
  weaponSeed: 223,
  rngSeed: 18018,
  backend: 'webgl2',
  displayHz: 144,
  simHz: SIM_HZ,
  browser: 'test-browser',
  sensitivity: 1,
  sensitivityModel: 'cs2-0.022deg',
  movementModel: 'cs2-source',
  crossOriginIsolated: true,
  startedAt: '2026-09-03T00:00:00.000Z',
  unit: 'source',
  vStrafe: 250,
  maxDrillSeconds: 300,
  lateEventCount: 0,
  bufferOverflow: false,
  recorderOverflow: false,
  suspect: false,
  simToWorld: 1,
  scene: { sceneId: 'test-scene', assetPackVersion: 'test-v1', clutterTier: 'low', fallback: false, eye: EYE },
};

describe('deriveTrackingContactSamples', () => {
  it('freezes the T1 result and blocked reason contracts', () => {
    expectTypeOf<TrackingContactDerivationResult>().toMatchTypeOf<
      | { status: 'ok'; analysisVersion: 'tracking-contact-v1'; drillId: string; samples: readonly unknown[] }
      | { status: 'blocked'; analysisVersion: 'tracking-contact-v1'; reasons: readonly TrackingContactBlockedReason[] }
    >();
    const reasons = [
      'schema-version-unsupported',
      'missing-visible-event',
      'missing-target-telemetry',
      'missing-eye-origin',
      'invalid-hitbox',
      'no-tracking-drill',
      'protocol-incompatible',
    ] satisfies readonly TrackingContactBlockedReason[];

    expect(reasons).toHaveLength(7);
  });

  it('derives perfect on-target samples with target center, aim, epsilon, and pursuit window', () => {
    const payload = payloadWithTicks([
      tick(0, TARGET, aimAt(TARGET)),
      tick(TICK_MS, TARGET, aimAt(TARGET)),
    ]);

    const result = onlyOk(deriveTrackingContactSamples(payload));

    expect(result.analysisVersion).toBe('tracking-contact-v1');
    expect(result.drillId).toBe('tracking_v1');
    expect(result.samples).toHaveLength(2);
    expect(result.samples.map((sample) => sample.onTarget)).toEqual([true, true]);
    expect(result.samples.map((sample) => sample.trackingWindow)).toEqual(['pursuit', 'pursuit']);
    expect(result.samples[0]).toMatchObject({
      t: 0,
      targetId: 'target-1',
      target: TARGET,
      aim: aimAt(TARGET),
      presentationIndex: 0,
    });
    expect(result.samples[0].epsilonDeg).toBeLessThan(1e-9);
  });

  it('keeps known misses as observations instead of blocked or fake-zero results', () => {
    const payload = payloadWithTicks([
      tick(0, TARGET, aimAt({ x: 6, y: TARGET.y, z: TARGET.z })),
      tick(TICK_MS, TARGET, aimAt({ x: 6, y: TARGET.y, z: TARGET.z })),
    ]);

    const result = onlyOk(deriveTrackingContactSamples(payload));

    expect(result.samples.map((sample) => sample.onTarget)).toEqual([false, false]);
    expect(result.samples.map((sample) => sample.trackingWindow)).toEqual(['pre-acquire', 'pre-acquire']);
    expect(result.samples.every((sample) => sample.epsilonDeg > 40)).toBe(true);
  });

  it('uses the same inclusive AABB edge geometry as deriveTrackingMetrics', () => {
    const edgeHit = onlyOk(deriveTrackingContactSamples(payloadWithTicks([tick(0, TARGET, aimAt({ ...TARGET, x: 0.5 }))])));
    const edgeMiss = onlyOk(deriveTrackingContactSamples(payloadWithTicks([tick(0, TARGET, aimAt({ ...TARGET, x: 0.58 }))])));

    expect(edgeHit.samples[0].onTarget).toBe(true);
    expect(edgeMiss.samples[0].onTarget).toBe(false);
  });

  it('skips invisible ticks and does not carry samples across presentation boundaries', () => {
    const payload = payloadWithTicks(
      [
        tick(0, TARGET, aimAt(TARGET)),
        tick(TICK_MS, null, aimAt(TARGET)),
        tick(2 * TICK_MS, TARGET_2, aimAt(TARGET_2), 'target-2'),
      ],
      [
        { type: 'visible', targetId: 'target-1', side: 'R', t: 0, targetX: TARGET.x, targetY: TARGET.y, targetZ: TARGET.z },
        {
          type: 'visible',
          targetId: 'target-2',
          side: 'L',
          t: 2 * TICK_MS,
          targetX: TARGET_2.x,
          targetY: TARGET_2.y,
          targetZ: TARGET_2.z,
        },
      ],
    );

    const result = onlyOk(deriveTrackingContactSamples(payload));

    expect(result.samples.map((sample) => [sample.targetId, sample.t, sample.presentationIndex])).toEqual([
      ['target-1', 0, 0],
      ['target-2', 2 * TICK_MS, 1],
    ]);
  });

  it('starts contact sampling at scored_start when the export declares a scored window', () => {
    const payload = payloadWithTicks(
      [
        tick(0, TARGET, aimAt(TARGET)),
        tick(TICK_MS, TARGET, aimAt(TARGET)),
        tick(2 * TICK_MS, TARGET, aimAt(TARGET)),
      ],
      [
        { type: 'visible', targetId: 'target-1', side: 'R', t: 0, targetX: TARGET.x, targetY: TARGET.y, targetZ: TARGET.z },
        { type: 'scored_start', targetId: 'target-1', t: TICK_MS, targetX: TARGET.x, targetY: TARGET.y, targetZ: TARGET.z },
      ],
    );

    const result = onlyOk(deriveTrackingContactSamples(payload));

    expect(result.samples.map((sample) => sample.t)).toEqual([TICK_MS, 2 * TICK_MS]);
  });

  it('prefers metadata hitbox while retaining the default H1 hitbox fallback', () => {
    const edgeAimPayload = payloadWithTicks([tick(0, TARGET, aimAt({ ...TARGET, x: 0.49 }))]);
    const smallHitboxPayload = withMeta(edgeAimPayload, {
      targets: { hitbox: { widthU: 0.5, heightU: 1, depthU: 0.5, shape: 'box' } },
    });

    expect(onlyOk(deriveTrackingContactSamples(edgeAimPayload)).samples[0].onTarget).toBe(true);
    expect(onlyOk(deriveTrackingContactSamples(smallHitboxPayload)).samples[0].onTarget).toBe(false);
  });

  it('returns closed blocked reasons for unsupported or insufficient exports', () => {
    expect(blockedReasons(withMeta(payloadWithTicks([tick(0, TARGET, aimAt(TARGET))]), { schemaVersion: 1 as 2 }))).toEqual([
      'schema-version-unsupported',
    ]);
    expect(blockedReasons(withMeta(payloadWithTicks([tick(0, TARGET, aimAt(TARGET))]), { drillId: 'counterstrafe_ad_v1' }))).toEqual([
      'no-tracking-drill',
    ]);
    expect(blockedReasons(payloadWithTicks([tick(0, TARGET, aimAt(TARGET))], []))).toEqual(['missing-visible-event']);
    expect(blockedReasons(withMeta(payloadWithTicks([tick(0, TARGET, aimAt(TARGET))]), { scene: undefined }))).toEqual([
      'missing-eye-origin',
    ]);
    expect(
      blockedReasons(
        withMeta(payloadWithTicks([tick(0, TARGET, aimAt(TARGET))]), {
          targets: { hitbox: { widthU: 0, heightU: 1, depthU: 0.5, shape: 'box' } },
        }),
      ),
    ).toEqual(['invalid-hitbox']);
    expect(blockedReasons(payloadWithTicks([tick(0, null, aimAt(TARGET))]))).toEqual(['missing-target-telemetry']);
  });

  it('matches deriveTrackingMetrics acquisition, TOT, and RMS epsilon on the same source samples', () => {
    const payload = payloadWithTicks([
      tick(0, TARGET, aimAt({ x: 6, y: TARGET.y, z: TARGET.z })),
      tick(TICK_MS, TARGET, aimAt({ x: 6, y: TARGET.y, z: TARGET.z })),
      tick(2 * TICK_MS, TARGET, aimAt(TARGET)),
      tick(3 * TICK_MS, TARGET, aimAt(TARGET)),
      tick(4 * TICK_MS, TARGET, aimAt({ ...TARGET, x: 0.25 })),
    ]);
    const contact = summarize(onlyOk(deriveTrackingContactSamples(payload)).samples);
    const metric = deriveTrackingMetrics(payload, { strictEyeOrigin: true }).presentations[0];

    expect(contact.tFirstOnTargetMs).toBe(metric.tFirstOnTargetMs);
    expect(contact.tAcquireMs).toBe(metric.tAcquireMs);
    expect(contact.totPercent).toBeCloseTo(metric.totPercent!, 12);
    expect(contact.rmsEpsilonDeg).toBeCloseTo(metric.rmsEpsilonDeg!, 12);
  });
});

function payloadWithTicks(
  ticks: readonly TickRecord[],
  events: ExportPayload['events'] = [
    { type: 'visible', targetId: 'target-1', side: 'R', t: 0, targetX: TARGET.x, targetY: TARGET.y, targetZ: TARGET.z },
  ],
): ExportPayload {
  return { meta: baseMeta, ticks: ticks.slice(), events: events.slice() };
}

function tick(
  t: number,
  target: { x: number; y: number; z: number } | null,
  aim: { yaw: number; pitch: number },
  replayTargetId = target === null ? null : 'target-1',
): TickRecord {
  return {
    t,
    vx: 0,
    vz: 0,
    px: 0,
    pz: 0,
    tx: target?.x ?? null,
    ty: target?.y ?? null,
    tz: target?.z ?? null,
    aim,
    keys: [],
    ads: false,
    replayTargetId,
  };
}

function aimAt(point: { x: number; y: number; z: number }): { yaw: number; pitch: number } {
  const dx = point.x - EYE.x;
  const dy = point.y - EYE.y;
  const dz = point.z - EYE.z;
  const len = Math.hypot(dx, dy, dz);
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.asin(dy / len) };
}

function withMeta(payload: ExportPayload, meta: Partial<Meta>): ExportPayload {
  return { ...payload, meta: { ...payload.meta, ...meta } };
}

function onlyOk(result: TrackingContactDerivationResult): Extract<TrackingContactDerivationResult, { status: 'ok' }> {
  expect(result.status).toBe('ok');
  if (result.status !== 'ok') throw new Error(`expected ok, got blocked: ${result.reasons.join(', ')}`);
  return result;
}

function blockedReasons(payload: ExportPayload): readonly TrackingContactBlockedReason[] {
  const result = deriveTrackingContactSamples(payload);
  expect(result.status).toBe('blocked');
  if (result.status !== 'blocked') throw new Error('expected blocked result');
  return result.reasons;
}

function summarize(samples: readonly { t: number; onTarget: boolean; epsilonDeg: number }[]): {
  readonly tFirstOnTargetMs: number;
  readonly tAcquireMs: number;
  readonly totPercent: number;
  readonly rmsEpsilonDeg: number;
} {
  const first = samples.find((sample) => sample.onTarget);
  if (first === undefined) throw new Error('expected acquisition');
  const windowSamples = samples.filter((sample) => sample.t + 1e-9 >= first.t);
  const onTargetCount = windowSamples.filter((sample) => sample.onTarget).length;
  const epsilons = windowSamples.map((sample) => sample.epsilonDeg);
  return {
    tFirstOnTargetMs: first.t,
    tAcquireMs: first.t,
    totPercent: (onTargetCount / windowSamples.length) * 100,
    rmsEpsilonDeg: Math.sqrt(epsilons.reduce((sum, value) => sum + value * value, 0) / epsilons.length),
  };
}
