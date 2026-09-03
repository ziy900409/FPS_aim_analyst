import { describe, expect, it } from 'vitest';
import type { ExportPayload } from '../data/export.ts';
import type { TickRecord } from '../data/RingBuffer.ts';
import type { Meta } from '../data/metadata.ts';
import { aimForward } from '../metrics/eyeOrigin.ts';
import { buildTrackingPilotEvidence } from './trackingPilotEvidence.ts';

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

function neverAcquirePayload(overrides: Partial<Meta> = {}, totalTicks = 200, prepTicks = 5): ExportPayload {
  return buildPayload({
    totalTicks,
    prepTicks,
    targetYawDeg: coreYawDeg,
    targetPitchDeg: corePitchDeg,
    aimYawDeg: (tSec) => coreYawDeg(tSec) + 90,
    aimPitchDeg: corePitchDeg,
    metaOverrides: overrides,
  });
}

describe('buildTrackingPilotEvidence — eligible run', () => {
  it('attaches quality/p0/p1/reversal and carries the version/traceability fields', () => {
    const payload = perfectFollowerPayload();
    const evidence = buildTrackingPilotEvidence([payload], { analysisCommit: 'abc1234' });

    expect(evidence.metricVersion).toBe('tracking-dynamics-v1');
    expect(evidence.protocolVersion).toBe('tracking-pilot-v1');
    expect(evidence.analysisCommit).toBe('abc1234');
    expect(evidence.conditions).toHaveLength(1);

    const condition = evidence.conditions[0];
    expect(condition.condition).toBe(baseMeta.drillId);
    expect(condition.runCount).toBe(1);
    expect(condition.eligibleRunCount).toBe(1);
    expect(condition.seeds).toEqual([54000]);
    expect(condition.totalDurationMs).toBeGreaterThan(0);

    const run = condition.runs[0];
    expect(run.runId).toBe(`${payload.meta.drillId}@${payload.meta.startedAt}`);
    expect(run.seed).toBe(54000);
    expect(run.quality.status).toBe('eligible');
    expect(run.p0).toBeDefined();
    expect(run.p0?.acquisitionFailure).toBe(false);
    expect(run.p1).toBeDefined();
    expect(run.p1?.status).toBe('ok');
    expect(run.reversal).toBeDefined();
    expect(run.reversal?.windows).toEqual([]);
  });
});

describe('buildTrackingPilotEvidence — run-level blocked never reaches metric derivation', () => {
  it('omits p0/p1/reversal and reports the blocked reasons instead', () => {
    const payload = perfectFollowerPayload({}, 400, 5);
    const blockedPayload: ExportPayload = { ...payload, events: payload.events.filter((e) => e.type !== 'scored_start') };
    const evidence = buildTrackingPilotEvidence([blockedPayload]);

    const run = evidence.conditions[0].runs[0];
    expect(run.quality).toEqual({ status: 'blocked', reasons: ['missing-scored-start'] });
    expect(run.p0).toBeUndefined();
    expect(run.p1).toBeUndefined();
    expect(run.reversal).toBeUndefined();
    expect(evidence.conditions[0].eligibleRunCount).toBe(0);
    expect(evidence.conditions[0].totalDurationMs).toBe(0);
  });
});

describe('buildTrackingPilotEvidence — P1 blocked does not remove a still-valid P0', () => {
  it('keeps p0 (acquisitionFailure reported, not hidden) alongside a p1 no-acquisition block', () => {
    const payload = neverAcquirePayload();
    const evidence = buildTrackingPilotEvidence([payload]);
    const run = evidence.conditions[0].runs[0];

    expect(run.quality.status).toBe('eligible'); // run-level quality is independent of P1 blocking
    expect(run.p0).toBeDefined();
    expect(run.p0?.acquisitionFailure).toBe(true);
    expect(run.p0?.rmsEpsilonDeg).toBeUndefined(); // never a silent 0
    expect(run.p1).toEqual({ status: 'blocked', reason: 'no-acquisition' });
  });
});

function withTrajectorySeed(seed: number): Meta['spawn'] {
  return { seed: 54000, trackingTrajectory: { ...(baseMeta.spawn!.trackingTrajectory as object), seed } };
}

describe('buildTrackingPilotEvidence — condition grouping and seed stats', () => {
  it('groups runs by meta.drillId and dedupes/sorts observed seeds', () => {
    const runA1 = perfectFollowerPayload({ drillId: 'condition-a', startedAt: 't0', spawn: withTrajectorySeed(1) });
    const runA2 = perfectFollowerPayload({ drillId: 'condition-a', startedAt: 't1', spawn: withTrajectorySeed(2) });
    const runA3 = perfectFollowerPayload({ drillId: 'condition-a', startedAt: 't2', spawn: withTrajectorySeed(1) });
    const runB = perfectFollowerPayload({ drillId: 'condition-b', startedAt: 't3' });

    const evidence = buildTrackingPilotEvidence([runA1, runB, runA2, runA3]);
    expect(evidence.conditions.map((c) => c.condition)).toEqual(['condition-a', 'condition-b']);

    const conditionA = evidence.conditions[0];
    expect(conditionA.runCount).toBe(3);
    expect(conditionA.seeds).toEqual([1, 2]);
  });
});

describe('buildTrackingPilotEvidence — practice exclusion (FR-54-5)', () => {
  it('never aggregates a practice block, and states how many it dropped', () => {
    // A practice export is otherwise indistinguishable from a scored one to this pipeline: it
    // carries a `scored_start` event (no prep window ⇒ stamped on the first motion tick, measured
    // in T6 slice 2) and passes eligibility. Exclusion is therefore by role, not by event
    // presence — see progress.md D-54.34/D-54.36.
    const practice = perfectFollowerPayload({ drillId: 'tracking_core_pr_pilot_v1_practice', startedAt: 't0' });
    const scored = perfectFollowerPayload({ drillId: 'tracking_core_pr_pilot_v1_2p0deg_5dps', startedAt: 't1' });

    const evidence = buildTrackingPilotEvidence([practice, scored]);

    expect(evidence.conditions.map((c) => c.condition)).toEqual(['tracking_core_pr_pilot_v1_2p0deg_5dps']);
    expect(evidence.excludedPracticeRunCount).toBe(1);
  });

  it('reports zero exclusions (not an absent field) when no practice run was supplied', () => {
    const evidence = buildTrackingPilotEvidence([perfectFollowerPayload()]);
    expect(evidence.excludedPracticeRunCount).toBe(0);
    expect(evidence.conditions).toHaveLength(1);
  });

  it('leaves an unregistered drillId aggregated rather than throwing on it', () => {
    // `isTrackingPilotPracticeDrillId()` is deliberately non-throwing: this aggregator may be
    // handed payloads from outside WP-54's own block registry.
    const evidence = buildTrackingPilotEvidence([perfectFollowerPayload({ drillId: 'some_other_drill_v9' })]);
    expect(evidence.conditions.map((c) => c.condition)).toEqual(['some_other_drill_v9']);
    expect(evidence.excludedPracticeRunCount).toBe(0);
  });
});

describe('buildTrackingPilotEvidence — determinism', () => {
  it('produces a deep-equal artifact across two calls with the same input', () => {
    const eligible = perfectFollowerPayload();
    const blocked: ExportPayload = {
      ...perfectFollowerPayload({}, 200, 5),
      events: perfectFollowerPayload({}, 200, 5).events.filter((e) => e.type !== 'scored_start'),
    };
    const payloads = [eligible, blocked];

    const first = buildTrackingPilotEvidence(payloads, { analysisCommit: 'deadbeef' });
    const second = buildTrackingPilotEvidence(payloads, { analysisCommit: 'deadbeef' });
    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});
