import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ExportPayload } from '../data/export.ts';
import type { Meta } from '../data/metadata.ts';
import type { TickRecord } from '../data/RingBuffer.ts';
import {
  buildTrackingContactArtifact,
  serializeTrackingContactArtifact,
  type TrackingContactArtifact,
} from './trackingContactArtifact.ts';

const SIM_HZ = 128;
const TICK_MS = 1000 / SIM_HZ;
const EYE = { x: 0, y: 1.6, z: 0 };
const TARGET = { x: 0, y: 1.6, z: -4 };

const baseMeta: Meta = {
  schemaVersion: 2,
  drillId: 'tracking_v1',
  weaponId: 'ak47',
  weaponSeed: 223,
  rngSeed: 55002,
  backend: 'webgl2',
  displayHz: 144,
  simHz: SIM_HZ,
  browser: 'test-browser',
  sensitivity: 1,
  sensitivityModel: 'cs2-0.022deg',
  movementModel: 'cs2-source',
  crossOriginIsolated: true,
  startedAt: '2026-09-03T01:00:00.000Z',
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

describe('buildTrackingContactArtifact', () => {
  it('freezes the T2 artifact contract', () => {
    expectTypeOf<Extract<TrackingContactArtifact, { status: 'ok' }>>().toMatchTypeOf<{
      status: 'ok';
      artifactSchemaVersion: 'tracking-contact-artifact-v1';
      analysisVersion: 'tracking-contact-v1';
      generatedFrom: 'export-derived';
      sourceId: string;
      sourceIdKind: 'sourceRunId' | 'exportBasename';
      drillId: string;
      schemaVersion: number;
      simHz: number;
      geometry: unknown;
      sampleCount: number;
      samples: readonly unknown[];
    }>();
    expectTypeOf<Extract<TrackingContactArtifact, { status: 'blocked' }>>().toMatchTypeOf<{
      status: 'blocked';
      artifactSchemaVersion: 'tracking-contact-artifact-v1';
      analysisVersion: 'tracking-contact-v1';
      generatedFrom: 'export-derived';
      drillId: string;
      reasons: readonly string[];
      sampleCount: number;
    }>();
  });

  it('emits an export-derived JSON artifact with identity, geometry, sample count, and samples', () => {
    const payload = withMeta(payloadWithTicks([tick(0, TARGET, aimAt(TARGET))]), {
      targets: { hitbox: { widthU: 0.75, heightU: 1.5, depthU: 0.75, shape: 'box' } },
    });

    const artifact = onlyOk(
      buildTrackingContactArtifact(payload, { sourceRunId: 'run-001', exportBasename: 'tracking/run 001' }),
    );

    expect(artifact).toMatchObject({
      artifactSchemaVersion: 'tracking-contact-artifact-v1',
      analysisVersion: 'tracking-contact-v1',
      generatedFrom: 'export-derived',
      sourceId: 'run-001',
      sourceIdKind: 'sourceRunId',
      sourceRunId: 'run-001',
      exportBasename: 'tracking/run 001',
      drillId: 'tracking_v1',
      schemaVersion: 2,
      simHz: SIM_HZ,
      startedAt: baseMeta.startedAt,
      sampleCount: 1,
      geometry: {
        hitbox: { source: 'meta.targets.hitbox', widthU: 0.75, heightU: 1.5, depthU: 0.75, shape: 'box' },
        eyeOrigin: { source: 'meta', ...EYE, simToWorld: 1 },
      },
    });
    expect(artifact.samples[0]).toMatchObject({
      t: 0,
      targetId: 'target-1',
      target: TARGET,
      aim: aimAt(TARGET),
      onTarget: true,
      epsilonDeg: 0,
      trackingWindow: 'pursuit',
    });
  });

  it('uses the deterministic run identity and default H1 hitbox when no explicit source fields are supplied', () => {
    const artifact = onlyOk(buildTrackingContactArtifact(payloadWithTicks([tick(0, TARGET, aimAt(TARGET))])));

    expect(artifact.sourceId).toBe('tracking_v1@2026-09-03T01:00:00.000Z');
    expect(artifact.sourceIdKind).toBe('sourceRunId');
    expect(artifact.sourceRunId).toBe('tracking_v1@2026-09-03T01:00:00.000Z');
    expect(artifact.exportBasename).toBeUndefined();
    expect(artifact.geometry.hitbox).toEqual({
      source: 'default-h1',
      widthU: 1,
      heightU: 2,
      depthU: 1,
      shape: 'box',
    });
  });

  it('accepts an export basename as traceability when no run id can be derived', () => {
    const payload = withMeta(payloadWithTicks([tick(0, TARGET, aimAt(TARGET))]), { startedAt: 'not-a-date' });

    const artifact = onlyOk(buildTrackingContactArtifact(payload, { exportBasename: 'tracking_v1-run-legacy' }));

    expect(artifact.sourceId).toBe('tracking_v1-run-legacy');
    expect(artifact.sourceIdKind).toBe('exportBasename');
    expect(artifact.sourceRunId).toBeUndefined();
    expect(artifact.exportBasename).toBe('tracking_v1-run-legacy');
  });

  it('serializes byte-equivalent JSON for the same export', () => {
    const payload = payloadWithTicks([
      tick(0, TARGET, aimAt({ ...TARGET, x: 6 })),
      tick(TICK_MS, TARGET, aimAt(TARGET)),
    ]);

    const first = serializeTrackingContactArtifact(payload, { exportBasename: 'tracking_v1-run-001' });
    const second = serializeTrackingContactArtifact(payload, { exportBasename: 'tracking_v1-run-001' });

    expect(second).toBe(first);
    expect(JSON.parse(second)).toEqual(JSON.parse(first));
    expect(second.endsWith('\n')).toBe(true);
  });

  it('returns closed blocked reasons without fake samples or zero metrics', () => {
    const cases: Array<readonly [string, ExportPayload, readonly string[]]> = [
      [
        'unsupported schema',
        withMeta(payloadWithTicks([tick(0, TARGET, aimAt(TARGET))]), { schemaVersion: 1 as 2 }),
        ['schema-version-unsupported'],
      ],
      [
        'missing visible event',
        payloadWithTicks([tick(0, TARGET, aimAt(TARGET))], []),
        ['missing-visible-event'],
      ],
      [
        'missing target telemetry',
        payloadWithTicks([tick(0, null, aimAt(TARGET))]),
        ['missing-target-telemetry'],
      ],
      [
        'missing eye origin',
        withMeta(payloadWithTicks([tick(0, TARGET, aimAt(TARGET))]), { scene: undefined }),
        ['missing-eye-origin'],
      ],
      [
        // A well-formed sphere is accepted since KI-021; a sphere with unequal axes is not,
        // because only `widthU` would survive as its diameter.
        'invalid hitbox',
        withMeta(payloadWithTicks([tick(0, TARGET, aimAt(TARGET))]), {
          targets: { hitbox: { widthU: 1, heightU: 2, depthU: 1, shape: 'sphere' } },
        }),
        ['invalid-hitbox'],
      ],
      [
        'no tracking drill',
        withMeta(payloadWithTicks([tick(0, TARGET, aimAt(TARGET))]), { drillId: 'counterstrafe_ad_v1' }),
        ['no-tracking-drill'],
      ],
      [
        'protocol incompatible identity',
        withMeta(payloadWithTicks([tick(0, TARGET, aimAt(TARGET))]), { startedAt: 'not-a-date' }),
        ['protocol-incompatible'],
      ],
    ];

    for (const [name, payload, reasons] of cases) {
      const artifact = buildTrackingContactArtifact(payload);
      expect(artifact.status, name).toBe('blocked');
      if (artifact.status !== 'blocked') throw new Error(`expected ${name} to be blocked`);
      expect(artifact.reasons, name).toEqual(reasons);
      expect(artifact.sampleCount, name).toBe(0);
      expect('samples' in artifact, name).toBe(false);
      expect('totPercent' in artifact, name).toBe(false);
    }
  });

  it('generates a 30 second reference export artifact under 500 ms', () => {
    const payload = payloadWithTicks(longRunTicks(30));

    const started = performance.now();
    const artifact = buildTrackingContactArtifact(payload);
    const elapsedMs = performance.now() - started;

    expect(onlyOk(artifact).sampleCount).toBe(30 * SIM_HZ);
    expect(elapsedMs).toBeLessThan(500);
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

function longRunTicks(seconds: number): TickRecord[] {
  const tickCount = seconds * SIM_HZ;
  const ticks: TickRecord[] = [];
  for (let i = 0; i < tickCount; i++) {
    const t = i * TICK_MS;
    ticks.push(tick(t, TARGET, aimAt(TARGET)));
  }
  return ticks;
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

function onlyOk(artifact: TrackingContactArtifact): Extract<TrackingContactArtifact, { status: 'ok' }> {
  expect(artifact.status).toBe('ok');
  if (artifact.status !== 'ok') throw new Error(`expected ok, got blocked: ${artifact.reasons.join(', ')}`);
  return artifact;
}
