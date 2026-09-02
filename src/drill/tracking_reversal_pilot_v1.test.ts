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
  TRACKING_REVERSAL_PILOT_V1_CANDIDATES,
  trackingReversalPilotV1High,
  trackingReversalPilotV1Medium,
} from './tracking_reversal_pilot_v1.ts';

describe('tracking_reversal_pilot_v1 — medium/high reversal-density configs (WP-54 / T2)', () => {
  it('both blocks load and pass field-low clearance', () => {
    for (const drill of TRACKING_REVERSAL_PILOT_V1_CANDIDATES) {
      expect(() => loadDrill(drill, fieldLow), drill.drillId).not.toThrow();
      const violations = validateClearance(fieldLow, drill);
      expect(violations, `${drill.drillId}: ${formatClearanceViolations(violations)}`).toEqual([]);
    }
  });

  it('distinct drillIds and seeds', () => {
    const ids = TRACKING_REVERSAL_PILOT_V1_CANDIDATES.map((d) => d.drillId);
    const seeds = TRACKING_REVERSAL_PILOT_V1_CANDIDATES.map((d) => d.targets.trackingTrajectory?.seed);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it('high density uses a strictly shorter reversalIntervalMs range than medium (only density varies)', () => {
    const medium = trackingReversalPilotV1Medium.targets.trackingTrajectory;
    const high = trackingReversalPilotV1High.targets.trackingTrajectory;
    if (medium?.kind !== 'reversal-2d-v1' || high?.kind !== 'reversal-2d-v1') {
      throw new Error('expected reversal-2d-v1');
    }
    expect(high.reversalIntervalMs[1]).toBeLessThan(medium.reversalIntervalMs[0]);
    // angularBoundsDeg/speedRangeDegPerSec held fixed — only density (reversalIntervalMs) varies.
    expect(high.angularBoundsDeg).toEqual(medium.angularBoundsDeg);
    expect(high.speedRangeDegPerSec).toEqual(medium.speedRangeDegPerSec);
  });

  it('scored window contract — trackingPrepMs + protocolGuard + 25s scored duration', () => {
    for (const drill of TRACKING_REVERSAL_PILOT_V1_CANDIDATES) {
      expect(drill.mode, drill.drillId).toBe('practice');
      expect(drill.timing.trackingPrepMs, drill.drillId).toBe(1000);
      expect(drill.protocolGuard, drill.drillId).toEqual({ noFire: true, noAds: true, noMovement: true });
      expect(drill.targets.trackingTrajectory?.durationMs, drill.drillId).toBe(25000);
      expect(drill.endCondition, drill.drillId).toEqual({ type: 'timeLimit', value: 26000 });
    }
  });

  it('accelerationRampMs stays below both density cells’ shortest reversalIntervalMs (schema.ts-enforced)', () => {
    for (const drill of TRACKING_REVERSAL_PILOT_V1_CANDIDATES) {
      const t = drill.targets.trackingTrajectory;
      if (t?.kind !== 'reversal-2d-v1') throw new Error('expected reversal-2d-v1');
      expect(t.accelerationRampMs, drill.drillId).toBeLessThan(t.reversalIntervalMs[0]);
    }
  });

  it('end-to-end sim run (high density): scored_start fires once and target_motion_change events reach the recorder', () => {
    const drill = loadDrill(trackingReversalPilotV1High, fieldLow);
    const state = createSharedState();
    const tm = createTargetManager(drill);
    const runner = createDrillRunner(state, tm);
    const recorder = createDataRecorder({ capacity: 4096, maxDrillSeconds: 40 });
    runner.start(drill);

    const tickMs = 1000 / SIM_HZ;
    let nowMs = 0;
    const prepTicks = Math.round(drill.timing.trackingPrepMs! / tickMs);
    // Run well past the shortest reversalIntervalMs so at least one leg boundary fires.
    const t = drill.targets.trackingTrajectory;
    if (t?.kind !== 'reversal-2d-v1') throw new Error('expected reversal-2d-v1');
    const ticksIntoScored = Math.round((t.reversalIntervalMs[1] + t.accelerationRampMs) / tickMs);
    const totalTicks = Math.round(drill.timing.countdownMs / tickMs) + prepTicks + ticksIntoScored;
    for (let i = 0; i < totalTicks; i++) {
      nowMs += tickMs;
      simStep(state, 1 / SIM_HZ, nowMs, tm, undefined, undefined, undefined, runner, recorder);
    }

    const events = recorder.snapshot().events;
    expect(events.filter((e) => e.type === 'scored_start')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'target_motion_change').length).toBeGreaterThanOrEqual(1);
  });
});
