import { describe, expect, it } from 'vitest';
import type { ExportPayload } from '../data/export.ts';
import type { TickRecord } from '../data/RingBuffer.ts';
import type { Meta } from '../data/metadata.ts';
import { aimForward } from '../metrics/eyeOrigin.ts';
import { buildTrackingPilotEvidence, type TrackingPilotEvidence } from './trackingPilotEvidence.ts';
import { renderTrackingPilotReportHtml } from './trackingPilotReport.ts';

const SIM_HZ = 128;
const TICK_MS = 1000 / SIM_HZ;
const EYE = { x: 0, y: 1.6, z: 0 };
const DISTANCE = 4;
const DEG_TO_RAD = Math.PI / 180;
const TARGET_ID = 'target-1';

const baseMeta: Meta = {
  schemaVersion: 2,
  drillId: 'tracking_core_pr_pilot_v1_2p0deg_5dps',
  weaponId: 'ak47',
  weaponSeed: 223,
  rngSeed: 54000,
  backend: 'webgl2',
  displayHz: 144,
  simHz: SIM_HZ,
  browser: 'test-browser',
  sensitivity: 1,
  sensitivityModel: 'cs2-0.022deg',
  movementModel: 'cs2-source',
  fovDeg: 103,
  crossOriginIsolated: true,
  startedAt: '2026-09-02T00:00:00.000Z',
  unit: 'source',
  vStrafe: 250,
  maxDrillSeconds: 300,
  lateEventCount: 0,
  bufferOverflow: false,
  recorderOverflow: false,
  suspect: false,
  spawn: {
    seed: 54000,
    trackingTrajectory: {
      kind: 'band-limited-2d-v1',
      seed: 54000,
      durationMs: 25000,
      yawBoundDeg: 2,
      pitchBoundDeg: 2,
      targetRmsSpeedDegPerSec: 5,
      frequencyBandHz: [0.1, 0.7],
    },
  },
};

function anglesToWorld(yawDeg: number, pitchDeg: number): { x: number; y: number; z: number } {
  const dir = aimForward(yawDeg * DEG_TO_RAD, pitchDeg * DEG_TO_RAD);
  return { x: EYE.x + DISTANCE * dir.x, y: EYE.y + DISTANCE * dir.y, z: EYE.z + DISTANCE * dir.z };
}

function coreYawDeg(tSec: number): number {
  return 3 * Math.sin(2 * Math.PI * 0.3 * tSec + 0.4) + 1.5 * Math.sin(2 * Math.PI * 0.53 * tSec + 1.1);
}
function corePitchDeg(tSec: number): number {
  return 2 * Math.sin(2 * Math.PI * 0.37 * tSec + 0.9) + 1 * Math.sin(2 * Math.PI * 0.61 * tSec + 2.2);
}

interface BuildOptions {
  totalTicks: number;
  prepTicks?: number;
  targetYawDeg(tSec: number): number;
  targetPitchDeg(tSec: number): number;
  aimYawDeg(tSec: number): number;
  aimPitchDeg(tSec: number): number;
  omitScoredStart?: boolean;
  metaOverrides?: Partial<Meta>;
}

function buildPayload(options: BuildOptions): ExportPayload {
  const prepTicks = options.prepTicks ?? 0;
  const ticks: TickRecord[] = [];
  const events: ExportPayload['events'] = [];
  let previousAimYawDeg: number | undefined;
  let previousAimPitchDeg: number | undefined;

  for (let tick = 0; tick <= options.totalTicks; tick++) {
    const t = tick * TICK_MS;
    const tSec = t / 1000;
    const targetPos = anglesToWorld(options.targetYawDeg(tSec), options.targetPitchDeg(tSec));

    if (tick === 0) {
      events.push({
        type: 'visible',
        targetId: TARGET_ID,
        side: 'R',
        t,
        targetX: targetPos.x,
        targetY: targetPos.y,
        targetZ: targetPos.z,
      });
    }
    if (tick === prepTicks && !options.omitScoredStart) {
      events.push({
        type: 'scored_start',
        targetId: TARGET_ID,
        t,
        targetX: targetPos.x,
        targetY: targetPos.y,
        targetZ: targetPos.z,
      });
    }

    const aimYawDeg = options.aimYawDeg(tSec);
    const aimPitchDeg = options.aimPitchDeg(tSec);
    const tickRecord: TickRecord = {
      t,
      vx: 0,
      vz: 0,
      px: 0,
      pz: 0,
      tx: targetPos.x,
      ty: targetPos.y,
      tz: targetPos.z,
      aim: { yaw: aimYawDeg * DEG_TO_RAD, pitch: aimPitchDeg * DEG_TO_RAD },
      keys: [],
      ads: false,
    };
    if (previousAimYawDeg !== undefined && previousAimPitchDeg !== undefined) {
      tickRecord.dYaw = (aimYawDeg - previousAimYawDeg) * DEG_TO_RAD;
      tickRecord.dPitch = (aimPitchDeg - previousAimPitchDeg) * DEG_TO_RAD;
    }
    previousAimYawDeg = aimYawDeg;
    previousAimPitchDeg = aimPitchDeg;
    ticks.push(tickRecord);
  }

  return { meta: { ...baseMeta, ...options.metaOverrides }, ticks, events };
}

function perfectFollowerPayload(overrides: Partial<Meta> = {}, totalTicks = 800, prepTicks = 5): ExportPayload {
  return buildPayload({
    totalTicks,
    prepTicks,
    targetYawDeg: coreYawDeg,
    targetPitchDeg: corePitchDeg,
    aimYawDeg: coreYawDeg,
    aimPitchDeg: corePitchDeg,
    metaOverrides: overrides,
  });
}

function extractEmbeddedEvidence(html: string): unknown {
  const match = html.match(
    /<script type="application\/json" id="evidence-data">([\s\S]*?)<\/script>/,
  );
  if (match === null) throw new Error('report HTML has no #evidence-data script block');
  return JSON.parse(match[1]);
}

describe('renderTrackingPilotReportHtml — JSON/HTML parity', () => {
  it('embeds the exact evidence object passed in, byte-for-byte deep-equal after JSON round-trip', () => {
    const eligible = perfectFollowerPayload({ drillId: 'condition-a', startedAt: 't0' });
    const blockedSource = perfectFollowerPayload({ drillId: 'condition-b', startedAt: 't1' }, 300, 5);
    const blocked: ExportPayload = {
      ...blockedSource,
      events: blockedSource.events.filter((event) => event.type !== 'scored_start'),
    };

    const evidence: TrackingPilotEvidence = buildTrackingPilotEvidence([eligible, blocked], {
      analysisCommit: 'cafef00d',
      includeTrace: true,
    });
    const html = renderTrackingPilotReportHtml(evidence);
    const embedded = extractEmbeddedEvidence(html);

    // Compare against the artifact's actual JSON form (`JSON.parse(JSON.stringify(evidence))`), not
    // the raw in-memory object: a presentation's `windowEndMs` can legitimately be `Infinity` (no
    // subsequent `visible` event — the normal WP-54 single-persistent-target case), and JSON has no
    // way to represent that; `JSON.stringify` collapses it to `null`. That collapse happens identically
    // whether a researcher saves `evidence` straight to a `.json` file or reads it back out of this
    // report's embedded script — parity is about matching *that* canonical form, not bypassing it.
    const canonical = JSON.parse(JSON.stringify(evidence));
    expect(embedded).toEqual(canonical);
    expect(JSON.stringify(embedded)).toBe(JSON.stringify(canonical));
  });

  it('is a single self-contained document: no external script/link/src references', () => {
    const evidence = buildTrackingPilotEvidence([perfectFollowerPayload()]);
    const html = renderTrackingPilotReportHtml(evidence);
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/<link[^>]+href=/);
    expect(html).toContain('<!doctype html>');
  });

  it('escapes "<" inside the embedded JSON so no payload string can prematurely close the script tag', () => {
    const evidence = buildTrackingPilotEvidence([
      perfectFollowerPayload({ drillId: 'weird-</script><script>alert(1)</script>-drill' }),
    ]);
    const html = renderTrackingPilotReportHtml(evidence);
    expect(html).not.toContain('</script><script>alert(1)</script>');
    const embedded = extractEmbeddedEvidence(html) as TrackingPilotEvidence;
    expect(embedded.conditions[0].condition).toBe('weird-</script><script>alert(1)</script>-drill');
  });
});
