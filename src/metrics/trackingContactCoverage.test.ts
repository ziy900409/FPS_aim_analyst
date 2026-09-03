import { describe, expect, it } from 'vitest';
import type { ExportPayload } from '../data/export.ts';
import type { Meta } from '../data/metadata.ts';
import type { TickRecord } from '../data/RingBuffer.ts';
import type { DrillConfig } from '../drill/DrillConfig.ts';
import { trackingBrV1 } from '../drill/tracking_br_v1.ts';
import { TRACKING_CORE_PR_PILOT_V1_CANDIDATES } from '../drill/tracking_core_pr_pilot_v1.ts';
import { trackingLongrangeV1 } from '../drill/tracking_longrange_v1.ts';
import { TRACKING_REVERSAL_PILOT_V1_CANDIDATES } from '../drill/tracking_reversal_pilot_v1.ts';
import { trackingV1 } from '../drill/tracking_v1.ts';
import { deriveTrackingMetrics } from './trackingDerivation.ts';
import { buildTrackingContactCoverageReport } from './trackingContactCoverage.ts';

const SIM_HZ = 128;
const TICK_MS = 1000 / SIM_HZ;
const EYE = { x: 0, y: 1.6, z: 0 };
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

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
  startedAt: '2026-09-03T03:00:00.000Z',
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

describe('buildTrackingContactCoverageReport — WP-55 T3 drill matrix', () => {
  it('covers tracking_v1 with contact samples and P0 acquisition/TOT/RMS parity', () => {
    const payload = fixtureForDrill(trackingV1, { acquireAtTick: 2 });
    const report = buildTrackingContactCoverageReport([payload]);
    const run = onlyIncluded(report.runs[0]);
    const metric = deriveTrackingMetrics(payload, { strictEyeOrigin: true }).presentations[0];

    expect(report).toMatchObject({ runCount: 1, includedRunCount: 1, excludedRunCount: 0 });
    expect(run.drillId).toBe('tracking_v1');
    expect(run.contactArtifact.sampleCount).toBeGreaterThan(0);
    expect(run.pureSummary.presentationCount).toBe(1);
    expect(run.pureSummary.presentations[0].tFirstOnTargetMs).toBe(metric.tFirstOnTargetMs);
    expect(run.pureSummary.presentations[0].tAcquireMs).toBe(metric.tAcquireMs);
    expect(run.pureSummary.presentations[0].totPercent).toBeCloseTo(metric.totPercent!, 12);
    expect(run.pureSummary.presentations[0].rmsEpsilonDeg).toBeCloseTo(metric.rmsEpsilonDeg!, 12);
    expect(run.brCompanion).toBeUndefined();
  });

  it('covers tracking_longrange_v1 with source-unit hitbox provenance and angular-height parity', () => {
    const drill = trackingLongrangeV1.drill;
    const payload = fixtureForDrill(drill, {
      acquireAtTick: 1,
      target: spawnAreaTarget(drill, 1.5),
      metaOverrides: {
        targets: { hitbox: drill.targets.hitbox! },
        spawn: {
          seed: drill.sequence.seed!,
          spawnArea: drill.targets.spawnArea,
          motion: drill.targets.motion,
          presentationMs: drill.timing.presentationMs,
        },
      },
    });
    const report = buildTrackingContactCoverageReport([payload]);
    const run = onlyIncluded(report.runs[0]);

    expect(run.drillId).toBe('tracking_longrange_v1');
    expect(run.contactArtifact.geometry.hitbox).toEqual({
      source: 'meta.targets.hitbox',
      widthU: 0.5,
      heightU: 1,
      depthU: 0.5,
      shape: 'box',
    });
    expect(run.contactArtifact.schemaVersion).toBe(2);
    expect(payload.meta.unit).toBe('source');
    expect(angularHeightDeg(drill.targets.hitbox!.heightU, drill.targets.distance)).toBeCloseTo(0.5, 12);
    expect(run.pureSummary.presentations[0].totPercent).toBe(100);
  });

  it('covers tracking_br_v1 with aim-ray contact separated from ADS/projectile/hitscan companions', () => {
    const payload = brFixture({ ballisticEvents: true });
    const report = buildTrackingContactCoverageReport([payload]);
    const run = onlyIncluded(report.runs[0]);

    expect(run.drillId).toBe('tracking_br_v1');
    expect(run.contactArtifact.sampleCount).toBeGreaterThan(0);
    expect(run.pureSummary.totPercent).toBe(100);
    expect(run.brCompanion).toEqual({
      ads: { tickCount: 4, eventCount: 1, downEventCount: 1 },
      aimRay: {
        sampleCount: run.contactArtifact.sampleCount,
        onTargetSampleCount: 4,
        onTargetRate: 1,
      },
      ballistic: {
        fireEventCount: 1,
        hitscanFireHitCount: 0,
        projectileHitEventCount: 1,
        weaponBulletModel: 'projectile',
      },
    });
  });

  it('keeps pure tracking summary independent of fire/hit event counts', () => {
    const withoutBallistic = onlyIncluded(buildTrackingContactCoverageReport([brFixture({ ballisticEvents: false })]).runs[0]);
    const withBallistic = onlyIncluded(buildTrackingContactCoverageReport([brFixture({ ballisticEvents: true })]).runs[0]);

    expect(withBallistic.pureSummary).toEqual(withoutBallistic.pureSummary);
    expect(withBallistic.brCompanion?.ballistic).not.toEqual(withoutBallistic.brCompanion?.ballistic);
  });

  it('excludes protocol-incompatible artifacts from aggregate while preserving reason counts', () => {
    const goodTracking = fixtureForDrill(trackingV1);
    const goodLongrange = fixtureForDrill(trackingLongrangeV1.drill, {
      target: spawnAreaTarget(trackingLongrangeV1.drill, 1.5),
      metaOverrides: { targets: { hitbox: trackingLongrangeV1.drill.targets.hitbox! } },
    });
    const blocked = withMeta(fixtureForDrill(trackingV1), { startedAt: 'not-a-date' });

    const report = buildTrackingContactCoverageReport([goodTracking, goodLongrange, blocked]);
    const excluded = report.runs.filter((run) => run.status === 'excluded');

    expect(report.includedRunCount).toBe(2);
    expect(report.excludedRunCount).toBe(1);
    expect(report.exclusionReasonCounts).toEqual({ 'protocol-incompatible': 1 });
    expect(excluded).toHaveLength(1);
    expect(excluded[0]).toMatchObject({ drillId: 'tracking_v1', reasons: ['protocol-incompatible'] });
  });

  it('keeps WP-54 candidate drills as contact-contract compatibility evidence only', () => {
    const core = fixtureForDrill(TRACKING_CORE_PR_PILOT_V1_CANDIDATES[0], {
      metaOverrides: {
        spawn: {
          seed: TRACKING_CORE_PR_PILOT_V1_CANDIDATES[0].targets.trackingTrajectory!.seed,
          trackingTrajectory: TRACKING_CORE_PR_PILOT_V1_CANDIDATES[0].targets.trackingTrajectory,
        },
      },
    });
    const reversal = fixtureForDrill(TRACKING_REVERSAL_PILOT_V1_CANDIDATES[0], {
      metaOverrides: {
        spawn: {
          seed: TRACKING_REVERSAL_PILOT_V1_CANDIDATES[0].targets.trackingTrajectory!.seed,
          trackingTrajectory: TRACKING_REVERSAL_PILOT_V1_CANDIDATES[0].targets.trackingTrajectory,
        },
      },
    });

    const report = buildTrackingContactCoverageReport([core, reversal]);

    expect(report).toMatchObject({ runCount: 2, includedRunCount: 2, excludedRunCount: 0 });
    expect(report.runs.map((run) => run.drillId)).toEqual([
      'tracking_core_pr_pilot_v1_2deg_5dps',
      'tracking_reversal_pilot_v1_medium',
    ]);
    expect(report.runs.every((run) => run.status === 'included' && run.contactArtifact.status === 'ok')).toBe(true);
    expect(report.runs.every((run) => run.status === 'included' && run.brCompanion === undefined)).toBe(true);
  });
});

interface FixtureOptions {
  readonly acquireAtTick?: number;
  readonly target?: { readonly x: number; readonly y: number; readonly z: number };
  readonly metaOverrides?: Partial<Meta>;
}

function fixtureForDrill(drill: DrillConfig, options: FixtureOptions = {}): ExportPayload {
  const acquireAtTick = options.acquireAtTick ?? 0;
  const target = options.target ?? { x: 0, y: EYE.y, z: -drill.targets.distance };
  const ticks: TickRecord[] = [];
  for (let index = 0; index < 4; index++) {
    ticks.push(tick(index * TICK_MS, target, index < acquireAtTick ? aimAt({ ...target, x: target.x + 8 }) : aimAt(target)));
  }

  return {
    meta: {
      ...baseMeta,
      drillId: drill.drillId,
      rngSeed: drill.sequence.seed ?? baseMeta.rngSeed,
      startedAt: `2026-09-03T03:${String((drill.sequence.seed ?? 0) % 60).padStart(2, '0')}:00.000Z`,
      ...(drill.targets.hitbox !== undefined ? { targets: { hitbox: drill.targets.hitbox } } : {}),
      ...(options.metaOverrides ?? {}),
    },
    ticks,
    events: [
      {
        type: 'visible',
        targetId: 'target-1',
        side: 'R',
        t: 0,
        targetX: target.x,
        targetY: target.y,
        targetZ: target.z,
      },
    ],
  };
}

function brFixture(options: { readonly ballisticEvents: boolean }): ExportPayload {
  const drill = trackingBrV1.drill;
  const payload = fixtureForDrill(drill, {
    target: spawnAreaTarget(drill, EYE.y),
    metaOverrides: {
      weaponId: drill.weaponId!,
      weapon: {
        id: drill.weaponId!,
        ads: { fovDeg: 45, sensitivityRatio: 0.75 },
        bullet: { model: 'projectile', speedU: 200, gravityU: 9.8, maxRangeU: 500 },
      },
      targets: { hitbox: drill.targets.hitbox! },
      spawn: { seed: drill.sequence.seed!, spawnArea: drill.targets.spawnArea, motion: drill.targets.motion },
    },
  });
  const ticks = payload.ticks.map((row) => ({ ...row, ads: true }));
  const ballisticEvents: ExportPayload['events'] = options.ballisticEvents
    ? [
        { type: 'ads', down: true, t: 0 },
        { type: 'fire', t: TICK_MS, hit: false, firstShot: true, residualSpeed: 0, shotSeq: 1, targetId: 'target-1' },
        { type: 'hit', t: 2 * TICK_MS, timeOfFlightMs: TICK_MS, shotSeq: 1, targetId: 'target-1' },
      ]
    : [];
  return { ...payload, ticks, events: [...payload.events, ...ballisticEvents] };
}

function tick(
  t: number,
  target: { readonly x: number; readonly y: number; readonly z: number },
  aim: { readonly yaw: number; readonly pitch: number },
): TickRecord {
  return {
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
    replayTargetId: 'target-1',
  };
}

function aimAt(point: { readonly x: number; readonly y: number; readonly z: number }): { yaw: number; pitch: number } {
  const dx = point.x - EYE.x;
  const dy = point.y - EYE.y;
  const dz = point.z - EYE.z;
  const len = Math.hypot(dx, dy, dz);
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.asin(dy / len) };
}

function spawnAreaTarget(drill: DrillConfig, y: number): { x: number; y: number; z: number } {
  const spawnArea = drill.targets.spawnArea;
  if (spawnArea === undefined) return { x: 0, y, z: -drill.targets.distance };
  const yawDeg = spawnArea.yawDegRange[0];
  const distance = spawnArea.distanceURange[0];
  const yawRad = yawDeg * DEG_TO_RAD;
  return { x: Math.sin(yawRad) * distance, y, z: -Math.cos(yawRad) * distance };
}

function angularHeightDeg(heightU: number, distanceU: number): number {
  return 2 * Math.atan(heightU / (2 * distanceU)) * RAD_TO_DEG;
}

function withMeta(payload: ExportPayload, meta: Partial<Meta>): ExportPayload {
  return { ...payload, meta: { ...payload.meta, ...meta } };
}

function onlyIncluded(run: ReturnType<typeof buildTrackingContactCoverageReport>['runs'][number]) {
  expect(run.status).toBe('included');
  if (run.status !== 'included') throw new Error(`expected included, got ${run.reasons.join(', ')}`);
  return run;
}
