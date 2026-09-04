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
import { createTrackingTrajectory } from '../sim/trackingTrajectory.ts';
import { trackingPilotHold } from '../weapon/weapons.ts';

describe('tracking_reversal_pilot_v1 — medium/high reversal-density configs (WP-54 / T2)', () => {
  // KI-019 regression: the shipped cells themselves, not just a synthetic config. The medium cell
  // shipped a schedule that froze the target at a corner for a third of the block (6644 legs, 32.6%
  // stationary) and no test noticed, because every existing assertion was about continuity, bounds
  // and acceleration — all of which a frozen target satisfies.
  it('both density cells deliver a continuously moving target (KI-019)', () => {
    for (const drill of TRACKING_REVERSAL_PILOT_V1_CANDIDATES) {
      const config = drill.targets.trackingTrajectory;
      if (config === undefined) throw new Error(`${drill.drillId} has no trackingTrajectory`);
      const trajectory = createTrackingTrajectory(config);
      const out = { yawDeg: 0, pitchDeg: 0, yawVelocityDegPerSec: 0, pitchVelocityDegPerSec: 0 };
      const tickCount = Math.round((config.durationMs / 1000) * SIM_HZ);
      let still = 0;
      let run = 0;
      let maxRun = 0;
      for (let i = 0; i < tickCount; i++) {
        trajectory.sample(i / SIM_HZ, out);
        if (Math.hypot(out.yawVelocityDegPerSec, out.pitchVelocityDegPerSec) < 0.5) {
          still += 1;
          run += 1;
          maxRun = Math.max(maxRun, run);
        } else {
          run = 0;
        }
      }
      const label = drill.drillId;
      expect(still / tickCount, `${label} stationary fraction`).toBeLessThan(0.05);
      expect((maxRun * 1000) / SIM_HZ, `${label} longest stationary run (ms)`).toBeLessThanOrEqual(50);
      for (const change of trajectory.changes) {
        expect(
          Math.hypot(change.yawVelocityAfterDegPerSec, change.pitchVelocityAfterDegPerSec),
          `${label} zero-velocity leg`,
        ).toBeGreaterThan(0);
      }
      // Exact leg count stays geometry-dependent until KI-019 F-A2 re-parameterizes the medium
      // cell (its demanded travel per leg still exceeds the angular window); this only pins down
      // "not thousands of slivers".
      expect(trajectory.changes.length, `${label} leg count`).toBeLessThan(200);
    }
  });

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
      // tracking-pilot-v2 (D-54.49/D-54.50) — must match the core family exactly; a session that
      // mixed protocols across families would not be one protocol.
      expect(drill.protocolGuard, drill.drillId).toEqual({ requireFire: true, noMovement: true });
      expect(drill.targets.trackingTrajectory?.durationMs, drill.drillId).toBe(25000);
      expect(drill.endCondition, drill.drillId).toEqual({ type: 'timeLimit', value: 26000 });
    }
  });

  // WP-54 / T7 — tracking-pilot-v2 weapon contract (D-54.49/D-54.51); mirrors the core family's.
  it('both density cells ship the v2 hold-fire weapon with a magazine that outlasts the block', () => {
    const sustainableMs = trackingPilotHold.magSize * trackingPilotHold.cycletimeSec * 1000;
    for (const drill of TRACKING_REVERSAL_PILOT_V1_CANDIDATES) {
      expect(drill.weaponId, drill.drillId).toBe(trackingPilotHold.id);
      expect(sustainableMs, drill.drillId).toBeGreaterThan(drill.endCondition.value);
    }
    expect(trackingPilotHold.ads).toBeUndefined();
    expect(trackingPilotHold.recoil.magnitude).toBe(0);
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
