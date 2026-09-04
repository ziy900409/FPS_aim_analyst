/**
 * WP-55 / T7 — the operator entry point's output contract (OI-55-1).
 *
 * What needs guarding here is *not* contact semantics — `trackingContact.test.ts` and friends own
 * epsilon/TOT/acquisition/blocked, and this runner must never grow a second definition of them
 * (C-D4). What is guarded here is the glue: that every run reaches disk (blocked ones included,
 * with their closed reason codes intact), that a rejected input file is named rather than dropped,
 * that each output can be traced back to the export it came from, and that the same inputs produce
 * byte-identical files (NFR-55-1).
 */
import { describe, expect, it } from 'vitest';
import type { ExportPayload } from '../../src/data/export.ts';
import type { Meta } from '../../src/data/metadata.ts';
import type { TickRecord } from '../../src/data/RingBuffer.ts';
import { trackingV1 } from '../../src/drill/tracking_v1.ts';
import { buildTrackingContactCoverageReport } from '../../src/metrics/trackingContactCoverage.ts';
import {
  MANIFEST_FILENAME,
  REPORT_HTML_FILENAME,
  REPORT_JSON_FILENAME,
  buildTrackingContactRunnerOutputs,
  formatTrackingContactRunnerSummary,
} from '../../scripts/trackingContactRunner.ts';

const SIM_HZ = 128;
const TICK_MS = 1000 / SIM_HZ;
const EYE = { x: 0, y: 1.6, z: 0 };

const baseMeta: Meta = {
  schemaVersion: 2,
  drillId: trackingV1.drillId,
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
  startedAt: '2026-09-04T03:00:00.000Z',
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

describe('buildTrackingContactRunnerOutputs — WP-55 T7 operator entry point', () => {
  it('writes an artifact plus a replay trace per included run, the aggregate report, and a manifest', () => {
    const outputs = buildTrackingContactRunnerOutputs([{ sourcePath: '/exports/run-a.json', payload: onTargetPayload() }]);

    expect(outputs.coverage).toMatchObject({ runCount: 1, includedRunCount: 1, excludedRunCount: 0 });

    const names = outputs.files.map((file) => file.name);
    // `:` is stripped from the source id because it is illegal in a Windows filename; the
    // untouched id stays available in the artifact and the manifest.
    expect(names).toEqual([
      '001-tracking_v1@2026-09-04T03-00-00.000Z.contact-artifact.json',
      '001-tracking_v1@2026-09-04T03-00-00.000Z.replay-trace.html',
      REPORT_JSON_FILENAME,
      REPORT_HTML_FILENAME,
      MANIFEST_FILENAME,
    ]);

    // The artifact on disk is the coverage run's artifact verbatim — the runner adds no numbers.
    const written = JSON.parse(fileNamed(outputs, names[0]));
    expect(written).toEqual(JSON.parse(JSON.stringify(outputs.coverage.runs[0].contactArtifact)));
    expect(written.status).toBe('ok');
    expect(written.sampleCount).toBeGreaterThan(0);

    expect(fileNamed(outputs, REPORT_HTML_FILENAME)).toContain('tracking-contact-report-data');
    expect(fileNamed(outputs, names[1])).toContain('replay-contact-trace-data');
  });

  it('traces every output file back to the export it came from', () => {
    const outputs = buildTrackingContactRunnerOutputs([
      { sourcePath: '/exports/run-a.json', payload: onTargetPayload() },
      { sourcePath: '/exports/run-b.json', payload: onTargetPayload({ startedAt: '2026-09-04T04:00:00.000Z' }) },
    ]);

    const manifest = JSON.parse(fileNamed(outputs, MANIFEST_FILENAME));
    expect(manifest.manifestVersion).toBe('tracking-contact-runner-manifest-v1');
    expect(manifest.runs.map((run: { sourcePath: string }) => run.sourcePath)).toEqual([
      '/exports/run-a.json',
      '/exports/run-b.json',
    ]);
    // Each manifest row names files that were actually produced.
    const names = new Set(outputs.files.map((file) => file.name));
    for (const run of manifest.runs) {
      expect(names.has(run.artifactFile)).toBe(true);
      expect(names.has(run.replayTraceFile)).toBe(true);
      expect(run.sourceId).toContain(trackingV1.drillId);
    }
  });

  it('still emits an artifact for a blocked run, with closed reason codes and no replay trace', () => {
    // No `visible` event and no eye origin: two closed reasons, and nothing to replay.
    const blocked: ExportPayload = { ...onTargetPayload(), events: [] };
    const outputs = buildTrackingContactRunnerOutputs([{ sourcePath: '/exports/bad.json', payload: blocked }]);

    expect(outputs.coverage).toMatchObject({ runCount: 1, includedRunCount: 0, excludedRunCount: 1 });

    const manifest = JSON.parse(fileNamed(outputs, MANIFEST_FILENAME));
    expect(manifest.runs[0].status).toBe('excluded');
    expect(manifest.runs[0].reasons.length).toBeGreaterThan(0);
    expect(manifest.runs[0].replayTraceFile).toBeUndefined();

    const artifact = JSON.parse(fileNamed(outputs, manifest.runs[0].artifactFile));
    expect(artifact.status).toBe('blocked');
    expect(artifact.reasons).toEqual(outputs.coverage.runs[0].contactArtifact.reasons);
    // A blocked run reports zero samples, not a zero TOT or an empty timeline pretending to be data.
    expect(artifact.sampleCount).toBe(0);
    expect(artifact.samples).toBeUndefined();
    expect(outputs.files.some((file) => file.name.endsWith('.replay-trace.html'))).toBe(false);
  });

  it('names rejected input files in the manifest and the summary instead of dropping them', () => {
    const outputs = buildTrackingContactRunnerOutputs(
      [{ sourcePath: '/exports/run-a.json', payload: onTargetPayload() }],
      { rejected: [{ sourcePath: '/exports/broken.json', reason: 'schema errors: meta: must be an object' }] },
    );

    const manifest = JSON.parse(fileNamed(outputs, MANIFEST_FILENAME));
    expect(manifest.rejectedFileCount).toBe(1);
    expect(manifest.rejectedFiles[0].sourcePath).toBe('/exports/broken.json');

    const summary = formatTrackingContactRunnerSummary(outputs);
    expect(summary).toContain('rejected files: 1');
    expect(summary).toContain('/exports/broken.json');
  });

  it('keeps two runs that share a source id in separate files', () => {
    const payload = onTargetPayload();
    const outputs = buildTrackingContactRunnerOutputs([
      { sourcePath: '/exports/first.json', payload },
      { sourcePath: '/exports/second.json', payload },
    ]);

    const artifactNames = outputs.files.filter((file) => file.name.endsWith('.contact-artifact.json')).map((f) => f.name);
    expect(artifactNames).toHaveLength(2);
    expect(new Set(artifactNames).size).toBe(2);
  });

  it('produces byte-identical files for the same inputs', () => {
    const inputs = [{ sourcePath: '/exports/run-a.json', payload: onTargetPayload() }];
    const first = buildTrackingContactRunnerOutputs(inputs);
    const second = buildTrackingContactRunnerOutputs(inputs);
    expect(second.files).toEqual(first.files);
  });

  it('reports the same coverage as calling the shipped coverage function directly', () => {
    const payloads = [onTargetPayload(), { ...onTargetPayload(), events: [] }];
    const outputs = buildTrackingContactRunnerOutputs(
      payloads.map((payload, index) => ({ sourcePath: `/exports/run-${index}.json`, payload })),
    );
    expect(outputs.coverage).toEqual(buildTrackingContactCoverageReport(payloads, { strictEyeOrigin: undefined }));
  });
});

function fileNamed(outputs: { files: readonly { name: string; content: string }[] }, name: string): string {
  const file = outputs.files.find((entry) => entry.name === name);
  if (file === undefined) throw new Error(`no output file named ${name}`);
  return file.content;
}

function onTargetPayload(metaOverrides: Partial<Meta> = {}): ExportPayload {
  const drill = trackingV1;
  const target = { x: 0, y: EYE.y, z: -drill.targets.distance };
  const ticks: TickRecord[] = [];
  for (let index = 0; index < 4; index++) ticks.push(tick(index * TICK_MS, target, aimAt(target)));

  return {
    meta: {
      ...baseMeta,
      ...(drill.targets.hitbox !== undefined ? { targets: { hitbox: drill.targets.hitbox } } : {}),
      ...metaOverrides,
    },
    ticks,
    events: [
      { type: 'visible', targetId: 'target-1', side: 'R', t: 0, targetX: target.x, targetY: target.y, targetZ: target.z },
    ],
  };
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
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.asin(dy / Math.hypot(dx, dy, dz)) };
}
