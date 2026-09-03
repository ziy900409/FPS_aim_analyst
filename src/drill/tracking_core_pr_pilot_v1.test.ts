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
import { createTrackingTrajectory } from '../sim/trackingTrajectory.ts';
import type { DrillConfig } from './DrillConfig.ts';
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

/** Inverse of the config's angular-size -> hitbox-diameter mapping, so the test derives the
 * delivered angular size from the shipped hitbox rather than trusting a config field. */
function angularSizeOf(drill: DrillConfig): number {
  const hitbox = drill.targets.hitbox;
  if (hitbox === undefined) throw new Error(`${drill.drillId} has no hitbox`);
  return 2 * (180 / Math.PI) * Math.atan(hitbox.widthU / 2 / drill.targets.distance);
}

function nominalSpeedOf(drill: DrillConfig): number {
  const config = drill.targets.trackingTrajectory;
  if (config?.kind !== 'band-limited-2d-v1') throw new Error('expected band-limited-2d-v1');
  return config.targetRmsSpeedDegPerSec;
}

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
    // KI-020: `size` is the target's angular size (a hitbox), NOT the trajectory's travel
    // amplitude — the pair identity therefore comes from the hitbox, not from `yawBoundDeg`.
    const pairs = new Set(
      TRACKING_CORE_PR_PILOT_V1_CANDIDATES.map((d) => `${angularSizeOf(d).toFixed(3)}/${nominalSpeedOf(d)}`),
    );
    for (const size of CORE_PR_PILOT_V1_SIZE_CANDIDATES_DEG) {
      for (const speed of CORE_PR_PILOT_V1_SPEED_CANDIDATES_DEG_PER_SEC) {
        expect(pairs.has(`${size.toFixed(3)}/${speed}`)).toBe(true);
      }
    }
  });

  // --- KI-020 regression: the matrix must deliver the manipulation it claims ---

  it('every cell renders its size candidate as a real angular target size (KI-020)', () => {
    for (const drill of [trackingCorePrPilotV1Practice, ...TRACKING_CORE_PR_PILOT_V1_CANDIDATES]) {
      const hitbox = drill.targets.hitbox;
      if (hitbox === undefined) throw new Error(`${drill.drillId} has no hitbox`);
      // A sphere of this diameter subtends the candidate size in every direction, so on-target
      // tolerance is isotropic (KI-021 / GD-30 replaced the interim cube and its sqrt(2)x diagonal
      // anisotropy). Hit detection, rendering and the offline on-target derivation all read the
      // same `TargetState.hitbox` source (WP-46 / GD-7).
      expect(hitbox.shape, drill.drillId).toBe('sphere');
      expect(hitbox.widthU, drill.drillId).toBe(hitbox.heightU);
      expect(hitbox.widthU, drill.drillId).toBe(hitbox.depthU);
      expect(CORE_PR_PILOT_V1_SIZE_CANDIDATES_DEG as readonly number[], drill.drillId).toContain(
        Number(angularSizeOf(drill).toFixed(3)),
      );
    }
    // Both size candidates are actually present and distinguishable (pre-KI-020 every cell shared
    // the default H1 target, so the "size" factor did not exist at all).
    const sizes = new Set(TRACKING_CORE_PR_PILOT_V1_CANDIDATES.map((d) => Number(angularSizeOf(d).toFixed(3))));
    expect([...sizes].sort((a, b) => a - b)).toEqual([...CORE_PR_PILOT_V1_SIZE_CANDIDATES_DEG].sort((a, b) => a - b));
  });

  it('axis calibration blocks use the at-risk 0.5deg target (that is what they exist to probe)', () => {
    for (const drill of [trackingCorePrPilotV1CalibrationHorizontal, trackingCorePrPilotV1CalibrationVertical]) {
      expect(angularSizeOf(drill), drill.drillId).toBeCloseTo(0.5, 3);
    }
  });

  it('every cell actually delivers its nominal RMS speed, and amplitude is held constant (KI-020)', () => {
    // The defect this locks down: `boundedSpeedScale` clamps to the amplitude bound, so a config
    // could claim 20deg/s while delivering 1.18deg/s — and the claim went into export metadata.
    for (const drill of [
      trackingCorePrPilotV1Practice,
      trackingCorePrPilotV1CalibrationHorizontal,
      trackingCorePrPilotV1CalibrationVertical,
      ...TRACKING_CORE_PR_PILOT_V1_CANDIDATES,
    ]) {
      const config = drill.targets.trackingTrajectory;
      if (config?.kind !== 'band-limited-2d-v1') throw new Error('expected band-limited-2d-v1');
      const trajectory = createTrackingTrajectory(config);
      const out = { yawDeg: 0, pitchDeg: 0, yawVelocityDegPerSec: 0, pitchVelocityDegPerSec: 0 };
      const tickCount = Math.round((config.durationMs / 1000) * SIM_HZ);
      // KI-023: measure the *2D* speed — the speed of the target on screen. Measuring only the
      // driven axis is what let every two-axis cell deliver √2 × its nominal (7.14 for a claimed
      // 5, 28.3 for a claimed 20) and still pass this very assertion.
      let sumSquares = 0;
      let maxAbsDeg = 0;
      for (let i = 0; i < tickCount; i++) {
        trajectory.sample(i / SIM_HZ, out);
        sumSquares += out.yawVelocityDegPerSec ** 2 + out.pitchVelocityDegPerSec ** 2;
        maxAbsDeg = Math.max(maxAbsDeg, Math.abs(out.yawDeg), Math.abs(out.pitchDeg));
      }
      const deliveredRms = Math.sqrt(sumSquares / tickCount);
      expect(deliveredRms / config.targetRmsSpeedDegPerSec, `${drill.drillId} delivered/nominal`).toBeGreaterThan(0.9);
      expect(deliveredRms / config.targetRmsSpeedDegPerSec, `${drill.drillId} delivered/nominal`).toBeLessThan(1.1);
      // Vertical headroom: the target must stay above the floor and inside the vertical FOV.
      expect(maxAbsDeg, `${drill.drillId} max excursion`).toBeLessThan(20);
    }

    // Amplitude is shared, so speed is the only dynamic difference across the matrix.
    const amplitudes = new Set(
      TRACKING_CORE_PR_PILOT_V1_CANDIDATES.map((d) => {
        const t = d.targets.trackingTrajectory;
        if (t?.kind !== 'band-limited-2d-v1') throw new Error('expected band-limited-2d-v1');
        return `${t.yawBoundDeg}/${t.pitchBoundDeg}`;
      }),
    );
    expect(amplitudes.size).toBe(1);
  });

  it('fails fast when a config requests a speed its amplitude/band cannot deliver (KI-020)', () => {
    const base = TRACKING_CORE_PR_PILOT_V1_CANDIDATES[0].targets.trackingTrajectory;
    if (base?.kind !== 'band-limited-2d-v1') throw new Error('expected band-limited-2d-v1');
    expect(() => createTrackingTrajectory({ ...base, yawBoundDeg: 2, pitchBoundDeg: 2 })).toThrow(
      /cannot deliver targetRmsSpeedDegPerSec/,
    );
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
