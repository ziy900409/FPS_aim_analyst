import { describe, expect, it } from 'vitest';
import type { ExportPayload } from '../data/export.ts';
import type { Meta } from '../data/metadata.ts';
import type { TickRecord } from '../data/RingBuffer.ts';
import { trackingBrV1 } from '../drill/tracking_br_v1.ts';
import { trackingLongrangeV1 } from '../drill/tracking_longrange_v1.ts';
import { trackingV1 } from '../drill/tracking_v1.ts';
import { buildReplayContactTrace } from '../replay/replayContact.ts';
import { buildTrackingContactCoverageReport } from './trackingContactCoverage.ts';
import {
  buildTrackingContactReport,
  renderTrackingContactReportHtml,
  serializeTrackingContactReport,
  type TrackingContactReportArtifact,
} from './trackingContactReport.ts';
import { deriveTrackingMetrics } from './trackingDerivation.ts';

const SIM_HZ = 128;
const TICK_MS = 1000 / SIM_HZ;
const EYE = { x: 0, y: 1.6, z: 0 };
const TARGET = { x: 0, y: 1.6, z: -4 };
const DEG_TO_RAD = Math.PI / 180;

const baseMeta: Meta = {
  schemaVersion: 2,
  drillId: 'tracking_v1',
  weaponId: 'ak47',
  weaponSeed: 223,
  rngSeed: 55055,
  backend: 'webgl2',
  displayHz: 144,
  simHz: SIM_HZ,
  browser: 'test-browser',
  sensitivity: 1,
  sensitivityModel: 'cs2-0.022deg',
  movementModel: 'cs2-source',
  crossOriginIsolated: true,
  startedAt: '2026-09-03T05:00:00.000Z',
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

describe('buildTrackingContactReport — WP-55 T5 report and quality projection', () => {
  it('projects acquisition, pursuit, epsilon statistics, replay frame count, and contact timeline from artifacts', () => {
    const coverage = buildTrackingContactCoverageReport([trackingPayload()]);
    const included = onlyIncluded(coverage.runs[0]);
    const trace = buildReplayContactTrace(included.contactArtifact, { replayTimesMs: [0, TICK_MS, 2 * TICK_MS] });

    const report = buildTrackingContactReport(coverage, { replayTraces: [trace] });
    const run = onlyReportIncluded(report.runs[0]);

    expect(report).toMatchObject({
      reportSchemaVersion: 'tracking-contact-report-v1',
      generatedFrom: 'tracking-contact-coverage',
      runCount: 1,
      includedRunCount: 1,
      excludedRunCount: 0,
    });
    expect(run.timeline).toMatchObject({
      source: 'tracking-contact-artifact.samples',
      n: 5,
      condition: 'tracking_v1',
      drillId: 'tracking_v1',
      analysisVersion: 'tracking-contact-v1',
      sourceId: 'tracking_v1@2026-09-03T05:00:00.000Z',
    });
    expect(run.timeline.samples.map((sample) => [sample.t, sample.onTarget, sample.trackingWindow])).toEqual([
      [0, false, 'pre-acquire'],
      [TICK_MS, false, 'pre-acquire'],
      [2 * TICK_MS, true, 'pursuit'],
      [3 * TICK_MS, true, 'pursuit'],
      [4 * TICK_MS, true, 'pursuit'],
    ]);
    expect(run.replayTraceFrameCount?.value).toBe(3);
    expect(run.summary.presentations[0].tAcquireMs?.value).toBe(2 * TICK_MS);
    expect(run.summary.totPercent).toMatchObject({
      unit: 'percent',
      n: 3,
      condition: 'tracking_v1',
      drillId: 'tracking_v1',
      analysisVersion: 'tracking-contact-v1',
      sourceId: 'tracking_v1@2026-09-03T05:00:00.000Z',
      sourceRunId: 'tracking_v1@2026-09-03T05:00:00.000Z',
    });
    expect(run.summary.rmsEpsilonDeg?.unit).toBe('deg');
    expect(run.summary.medianEpsilonDeg?.unit).toBe('deg');
    expect(run.summary.p95EpsilonDeg?.unit).toBe('deg');
  });

  it('keeps report summary values in parity with deriveTrackingMetrics without report-side contact derivation', () => {
    const payload = trackingPayload();
    const metric = deriveTrackingMetrics(payload, { strictEyeOrigin: true }).presentations[0];
    const report = buildTrackingContactReport(buildTrackingContactCoverageReport([payload]));
    const summary = onlyReportIncluded(report.runs[0]).summary;
    const presentation = summary.presentations[0];

    expect(presentation.tFirstOnTargetMs?.value).toBe(metric.tFirstOnTargetMs);
    expect(presentation.tAcquireMs?.value).toBe(metric.tAcquireMs);
    expect(summary.totPercent?.value).toBeCloseTo(metric.totPercent!, 12);
    expect(summary.rmsEpsilonDeg?.value).toBeCloseTo(metric.rmsEpsilonDeg!, 12);
    expect(summary.medianEpsilonDeg?.value).toBeCloseTo(metric.medianEpsilonDeg!, 12);
    expect(summary.p95EpsilonDeg?.value).toBeCloseTo(metric.p95EpsilonDeg!, 12);
  });

  it('shows closed blocked reasons and keeps excluded protocol-mismatch runs out of aggregates', () => {
    const good = trackingPayload({ metaOverrides: { startedAt: '2026-09-03T05:01:00.000Z' } });
    const blocked = trackingPayload({ metaOverrides: { startedAt: 'not-a-date' } });

    const report = buildTrackingContactReport(buildTrackingContactCoverageReport([good, blocked]));
    const blockedRun = onlyBlocked(report.runs[1]);

    expect(report.includedRunCount).toBe(1);
    expect(report.excludedRunCount).toBe(1);
    expect(report.exclusionReasonCounts).toEqual({ 'protocol-incompatible': 1 });
    expect(report.aggregate.conditions).toEqual([
      {
        condition: 'tracking_v1',
        drillId: 'tracking_v1',
        includedRunCount: 1,
        excludedRunCount: 1,
        sourceIds: ['tracking_v1@2026-09-03T05:01:00.000Z'],
        excludedSourceIds: [null],
      },
    ]);
    expect(blockedRun.blocked).toEqual({
      vocabulary: 'tracking-contact-blocked-reason-v1',
      reasons: ['protocol-incompatible'],
    });
    expect('summary' in blockedRun).toBe(false);
    expect('timeline' in blockedRun).toBe(false);
  });

  it('renders BR aim-ray contact separately from ballistic hit columns and leaves pure summary unchanged', () => {
    const report = buildTrackingContactReport(buildTrackingContactCoverageReport([brPayload()]));
    const run = onlyReportIncluded(report.runs[0]);

    expect(run.drillId).toBe('tracking_br_v1');
    expect(run.brCompanion).toMatchObject({
      interpretation: 'companion-only-not-pure-tracking',
      weaponBulletModel: 'projectile',
      aimRayOnTargetRate: { value: 1, n: 4, condition: 'tracking_br_v1' },
      ballisticFireEventCount: { value: 1, unit: 'count' },
      ballisticHitscanFireHitCount: { value: 0, unit: 'count' },
      ballisticProjectileHitEventCount: { value: 1, unit: 'count' },
    });
    expect(run.summary.totPercent?.value).toBe(100);
    expect(run.summary.totPercent?.sourceId).toBe(run.brCompanion?.aimRayOnTargetRate.sourceId);
  });

  it('serializes a deterministic report artifact and embeds the same JSON in the self-contained HTML report', () => {
    const report = buildTrackingContactReport(buildTrackingContactCoverageReport([
      trackingPayload(),
      trackingPayload({ metaOverrides: { drillId: 'tracking_longrange_v1', startedAt: '2026-09-03T05:02:00.000Z' } }),
    ]));
    const serialized = serializeTrackingContactReport(report);
    const html = renderTrackingContactReportHtml(report);
    const embedded = extractEmbeddedReport(html);

    expect(serialized.endsWith('\n')).toBe(true);
    expect(JSON.parse(serialized)).toEqual(report);
    expect(embedded).toEqual(JSON.parse(JSON.stringify(report)));
    expect(html).toContain('<style>');
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/<link[^>]+href=/);
    expect(html).toContain('blocked: ');
    expect(html).toContain('BR companion only');
  });
});

interface PayloadOptions {
  readonly metaOverrides?: Partial<Meta>;
}

function trackingPayload(options: PayloadOptions = {}): ExportPayload {
  return payloadWithTicks(
    [
      tick(0, TARGET, aimAt({ ...TARGET, x: 6 })),
      tick(TICK_MS, TARGET, aimAt({ ...TARGET, x: 6 })),
      tick(2 * TICK_MS, TARGET, aimAt(TARGET)),
      tick(3 * TICK_MS, TARGET, aimAt(TARGET)),
      tick(4 * TICK_MS, TARGET, aimAt({ ...TARGET, x: 0.25 })),
    ],
    {
      drillId: trackingV1.drillId,
      ...options.metaOverrides,
    },
  );
}

function brPayload(): ExportPayload {
  const drill = trackingBrV1.drill;
  const target = spawnAreaTarget();
  const base = payloadWithTicks(
    [
      tick(0, target, aimAt(target), true),
      tick(TICK_MS, target, aimAt(target), true),
      tick(2 * TICK_MS, target, aimAt(target), true),
      tick(3 * TICK_MS, target, aimAt(target), true),
    ],
    {
      drillId: drill.drillId,
      weaponId: drill.weaponId!,
      weapon: {
        id: drill.weaponId!,
        ads: { fovDeg: 45, sensitivityRatio: 0.75 },
        bullet: { model: 'projectile', speedU: 200, gravityU: 9.8, maxRangeU: 500 },
      },
      targets: { hitbox: drill.targets.hitbox! },
      spawn: { seed: drill.sequence.seed!, spawnArea: drill.targets.spawnArea, motion: drill.targets.motion },
    },
    target,
  );
  return {
    ...base,
    events: [
      ...base.events,
      { type: 'ads', down: true, t: 0 },
      { type: 'fire', t: TICK_MS, hit: false, firstShot: true, residualSpeed: 0, shotSeq: 1, targetId: 'target-1' },
      { type: 'hit', t: 2 * TICK_MS, timeOfFlightMs: TICK_MS, shotSeq: 1, targetId: 'target-1' },
    ],
  };
}

function payloadWithTicks(
  ticks: readonly TickRecord[],
  metaOverrides: Partial<Meta> = {},
  target = TARGET,
): ExportPayload {
  const meta = {
    ...baseMeta,
    ...(metaOverrides.drillId === trackingLongrangeV1.drill.drillId ? { targets: { hitbox: trackingLongrangeV1.drill.targets.hitbox! } } : {}),
    ...metaOverrides,
  };
  return {
    meta,
    ticks: ticks.slice(),
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

function tick(
  t: number,
  target: { readonly x: number; readonly y: number; readonly z: number },
  aim: { readonly yaw: number; readonly pitch: number },
  ads = false,
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
    ads,
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

function spawnAreaTarget(): { x: number; y: number; z: number } {
  const spawnArea = trackingBrV1.drill.targets.spawnArea!;
  const yawRad = spawnArea.yawDegRange[0] * DEG_TO_RAD;
  const distance = spawnArea.distanceURange[0];
  return { x: Math.sin(yawRad) * distance, y: EYE.y, z: -Math.cos(yawRad) * distance };
}

function onlyIncluded(run: ReturnType<typeof buildTrackingContactCoverageReport>['runs'][number]) {
  expect(run.status).toBe('included');
  if (run.status !== 'included') throw new Error(`expected included, got ${run.reasons.join(', ')}`);
  return run;
}

function onlyReportIncluded(run: TrackingContactReportArtifact['runs'][number]) {
  expect(run.status).toBe('included');
  if (run.status !== 'included') throw new Error(`expected included, got ${run.reasons.join(', ')}`);
  return run;
}

function onlyBlocked(run: TrackingContactReportArtifact['runs'][number]) {
  expect(run.status).toBe('blocked');
  if (run.status !== 'blocked') throw new Error('expected blocked run');
  return run;
}

function extractEmbeddedReport(html: string): unknown {
  const match = html.match(/<script type="application\/json" id="tracking-contact-report-data">([\s\S]*?)<\/script>/);
  if (match === null) throw new Error('missing tracking contact report JSON script');
  return JSON.parse(match[1]);
}
