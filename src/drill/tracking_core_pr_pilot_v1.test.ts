import { describe, expect, it } from 'vitest';
import { loadDrill } from './DrillLoader.ts';
import { createDrillRunner } from './DrillRunner.ts';
import { createTargetManager } from '../sim/TargetManager.ts';
import { createSharedState } from '../state/SharedState.ts';
import { createDataRecorder } from '../data/DataRecorder.ts';
import { simStep } from '../loop/SimLoop.ts';
import { SIM_HZ } from '../loop/constants.ts';
import { formatClearanceViolations, validateClearance } from '../scene/clearance.ts';
import { fieldLow } from '../scene/scenes/field-low.ts';
import {
  CORE_PR_PILOT_V1_SIZE_CANDIDATES_DEG,
  CORE_PR_PILOT_V1_SPEED_CANDIDATES_DEG_PER_SEC,
  TRACKING_CORE_PR_PILOT_V1_CANDIDATES,
  trackingCorePrPilotV1CalibrationHorizontal,
  trackingCorePrPilotV1CalibrationVertical,
  trackingCorePrPilotV1Practice,
} from './tracking_core_pr_pilot_v1.ts';

const ALL_BLOCKS = [
  trackingCorePrPilotV1Practice,
  trackingCorePrPilotV1CalibrationHorizontal,
  trackingCorePrPilotV1CalibrationVertical,
  ...TRACKING_CORE_PR_PILOT_V1_CANDIDATES,
];

describe('tracking_core_pr_pilot_v1 — practice/calibration/core matrix configs (WP-54 / T2)', () => {
  it('every block loads and passes field-low clearance', () => {
    for (const drill of ALL_BLOCKS) {
      expect(() => loadDrill(drill, fieldLow), drill.drillId).not.toThrow();
      const violations = validateClearance(fieldLow, drill);
      expect(violations, `${drill.drillId}: ${formatClearanceViolations(violations)}`).toEqual([]);
    }
  });

  it('every block has a distinct drillId (researcher-mode registration key)', () => {
    const ids = ALL_BLOCKS.map((d) => d.drillId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('practice block: mode=practice, no trackingPrepMs/protocolGuard (nothing to score)', () => {
    expect(trackingCorePrPilotV1Practice.mode).toBe('practice');
    expect(trackingCorePrPilotV1Practice.timing.trackingPrepMs).toBeUndefined();
    expect(trackingCorePrPilotV1Practice.protocolGuard).toBeUndefined();
    expect(trackingCorePrPilotV1Practice.targets.trackingTrajectory?.kind).toBe('band-limited-2d-v1');
  });

  it('calibration blocks: full amplitude on the calibrated axis, near-zero on the other', () => {
    const h = trackingCorePrPilotV1CalibrationHorizontal.targets.trackingTrajectory;
    if (h?.kind !== 'band-limited-2d-v1') throw new Error('expected band-limited-2d-v1');
    expect(h.yawBoundDeg).toBeGreaterThan(1);
    expect(h.pitchBoundDeg).toBeLessThan(1);

    const v = trackingCorePrPilotV1CalibrationVertical.targets.trackingTrajectory;
    if (v?.kind !== 'band-limited-2d-v1') throw new Error('expected band-limited-2d-v1');
    expect(v.pitchBoundDeg).toBeGreaterThan(1);
    expect(v.yawBoundDeg).toBeLessThan(1);
  });

  it('calibration/core cells: scored window contract — trackingPrepMs + protocolGuard + 25s scored duration', () => {
    const scoredBlocks = [
      trackingCorePrPilotV1CalibrationHorizontal,
      trackingCorePrPilotV1CalibrationVertical,
      ...TRACKING_CORE_PR_PILOT_V1_CANDIDATES,
    ];
    for (const drill of scoredBlocks) {
      expect(drill.timing.trackingPrepMs, drill.drillId).toBe(1000);
      expect(drill.protocolGuard, drill.drillId).toEqual({ noFire: true, noAds: true, noMovement: true });
      expect(drill.targets.trackingTrajectory?.durationMs, drill.drillId).toBe(25000);
      expect(drill.endCondition, drill.drillId).toEqual({ type: 'timeLimit', value: 26000 }); // prep(1000) + scored(25000)
    }
  });

  it('core 2x2 matrix covers every (size, speed) candidate pair exactly once', () => {
    expect(TRACKING_CORE_PR_PILOT_V1_CANDIDATES).toHaveLength(
      CORE_PR_PILOT_V1_SIZE_CANDIDATES_DEG.length * CORE_PR_PILOT_V1_SPEED_CANDIDATES_DEG_PER_SEC.length,
    );
    const pairs = new Set(
      TRACKING_CORE_PR_PILOT_V1_CANDIDATES.map((d) => {
        const t = d.targets.trackingTrajectory;
        if (t?.kind !== 'band-limited-2d-v1') throw new Error('expected band-limited-2d-v1');
        return `${t.yawBoundDeg}/${t.targetRmsSpeedDegPerSec}`;
      }),
    );
    for (const size of CORE_PR_PILOT_V1_SIZE_CANDIDATES_DEG) {
      for (const speed of CORE_PR_PILOT_V1_SPEED_CANDIDATES_DEG_PER_SEC) {
        expect(pairs.has(`${size}/${speed}`)).toBe(true);
      }
    }
  });

  it('every trackingTrajectory seed is distinct (no two blocks share an RNG stream)', () => {
    const seeds = ALL_BLOCKS.map((d) => d.targets.trackingTrajectory?.seed);
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it('end-to-end sim run: target becomes visible and scored_start fires ~1s after countdown ends (2.0deg/5dps cell)', () => {
    const drill = loadDrill(TRACKING_CORE_PR_PILOT_V1_CANDIDATES[0], fieldLow);
    const state = createSharedState();
    const tm = createTargetManager(drill);
    const runner = createDrillRunner(state, tm);
    const recorder = createDataRecorder({ capacity: 4096, maxDrillSeconds: 40 });
    runner.start(drill);

    const tickMs = 1000 / SIM_HZ;
    let nowMs = 0;
    const prepTicks = Math.round(drill.timing.trackingPrepMs! / tickMs);
    // countdownMs ticks + prepTicks + a few extra ticks into the scored window.
    const totalTicks = Math.round(drill.timing.countdownMs / tickMs) + prepTicks + 5;
    for (let i = 0; i < totalTicks; i++) {
      nowMs += tickMs;
      simStep(state, 1 / SIM_HZ, nowMs, tm, undefined, undefined, undefined, runner, recorder);
    }

    const events = recorder.snapshot().events;
    expect(events.some((e) => e.type === 'visible')).toBe(true);
    expect(events.filter((e) => e.type === 'scored_start')).toHaveLength(1);
  });
});
