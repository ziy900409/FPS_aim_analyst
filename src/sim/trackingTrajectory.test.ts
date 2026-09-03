import { describe, expect, it } from 'vitest';
import {
  createTrackingTrajectory,
  projectTrackingAngles,
  type TrackingTrajectoryConfig,
  type TrackingTrajectorySample,
} from './trackingTrajectory.ts';
import type { Vec3 } from '../state/types.ts';

function makeSample(): TrackingTrajectorySample {
  return { yawDeg: 0, pitchDeg: 0, yawVelocityDegPerSec: 0, pitchVelocityDegPerSec: 0 };
}

function sampleAt(config: TrackingTrajectoryConfig, ageSec: number): TrackingTrajectorySample {
  const trajectory = createTrackingTrajectory(config);
  const out = makeSample();
  trajectory.sample(ageSec, out);
  return out;
}

/** KI-020: the requested speed must be deliverable inside the amplitude/band (the generator now
 * rejects configs where it is not). At the previous `[0.1, 0.6]`Hz band, ±8° could only deliver
 * 3.21deg/s — yet this fixture asked for 10, which is precisely the mismatch that shipped. */
const BAND_LIMITED_BASE: Extract<TrackingTrajectoryConfig, { kind: 'band-limited-2d-v1' }> = {
  kind: 'band-limited-2d-v1',
  seed: 12345,
  durationMs: 60_000,
  yawBoundDeg: 8,
  pitchBoundDeg: 6,
  targetRmsSpeedDegPerSec: 7,
  frequencyBandHz: [0.3, 2.1],
};

const REVERSAL_BASE: Extract<TrackingTrajectoryConfig, { kind: 'reversal-2d-v1' }> = {
  kind: 'reversal-2d-v1',
  seed: 54321,
  durationMs: 30_000,
  // KI-019 F-A2: a leg may demand speedMax x (intervalMax - ramp) = 24.6deg, which must fit the
  // window (the generator rejects configs where it cannot).
  angularBoundsDeg: [-13, 13],
  speedRangeDegPerSec: [10, 30],
  reversalIntervalMs: [400, 900],
  accelerationRampMs: 80,
};

describe('createTrackingTrajectory — band-limited-2d-v1', () => {
  it('never exceeds the configured yaw/pitch bounds across a dense sweep', () => {
    const trajectory = createTrackingTrajectory(BAND_LIMITED_BASE);
    const out = makeSample();
    for (let ms = 0; ms <= BAND_LIMITED_BASE.durationMs; ms += 17) {
      trajectory.sample(ms / 1000, out);
      expect(Math.abs(out.yawDeg)).toBeLessThanOrEqual(BAND_LIMITED_BASE.yawBoundDeg + 1e-9);
      expect(Math.abs(out.pitchDeg)).toBeLessThanOrEqual(BAND_LIMITED_BASE.pitchBoundDeg + 1e-9);
    }
  });

  it('achieves approximately the configured target RMS speed (long-duration analytic approximation)', () => {
    const trajectory = createTrackingTrajectory(BAND_LIMITED_BASE);
    const out = makeSample();
    const stepSec = 0.01;
    let sumSquaredYawVel = 0;
    let count = 0;
    for (let t = 0; t <= BAND_LIMITED_BASE.durationMs / 1000; t += stepSec) {
      trajectory.sample(t, out);
      sumSquaredYawVel += out.yawVelocityDegPerSec ** 2;
      count += 1;
    }
    const rms = Math.sqrt(sumSquaredYawVel / count);
    // KI-020 regression. This assertion previously read `rms > 0.5` with a comment accepting that
    // "bound safety may have scaled speed down" — which is exactly how a config asking for
    // 20deg/s and delivering 1.18deg/s passed its tests and shipped. Now that an undeliverable
    // config fails fast at construction, a constructed trajectory must actually hit its set-point.
    expect(rms / BAND_LIMITED_BASE.targetRmsSpeedDegPerSec).toBeGreaterThan(0.9);
    expect(rms).toBeLessThanOrEqual(BAND_LIMITED_BASE.targetRmsSpeedDegPerSec + 1e-6);
  });

  it('fails fast when the requested speed cannot fit the amplitude/band (KI-020)', () => {
    // The generator must refuse rather than silently clamp: the clamped value would then be
    // reported in export metadata as though it had been delivered.
    expect(() => createTrackingTrajectory({ ...BAND_LIMITED_BASE, yawBoundDeg: 1 })).toThrow(
      /cannot deliver targetRmsSpeedDegPerSec/,
    );
    // A deliberately suppressed axis (axis-calibration's off-axis) stays exempt — its whole job is
    // to be near-static.
    expect(() => createTrackingTrajectory({ ...BAND_LIMITED_BASE, pitchBoundDeg: 0.1 })).not.toThrow();
  });

  it('is a pure function of age — independent of sampling cadence (60/120/240 Hz pump equivalence)', () => {
    const trajectory60 = createTrackingTrajectory(BAND_LIMITED_BASE);
    const trajectory240 = createTrackingTrajectory(BAND_LIMITED_BASE);
    const out60 = makeSample();
    const out240 = makeSample();
    const checkAgesSec = [0, 1 / 60, 0.5, 1, 2.5, 10, 30];
    for (const ageSec of checkAgesSec) {
      trajectory60.sample(ageSec, out60);
      trajectory240.sample(ageSec, out240);
      expect(out240.yawDeg).toBeCloseTo(out60.yawDeg, 12);
      expect(out240.pitchDeg).toBeCloseTo(out60.pitchDeg, 12);
      expect(out240.yawVelocityDegPerSec).toBeCloseTo(out60.yawVelocityDegPerSec, 12);
    }
  });

  it('reproduces identical output from the same seed/config (reset reproducibility)', () => {
    const a = sampleAt(BAND_LIMITED_BASE, 12.345);
    const b = sampleAt(BAND_LIMITED_BASE, 12.345);
    expect(a).toEqual(b);
  });

  it('produces a different trajectory for a different seed', () => {
    const a = sampleAt(BAND_LIMITED_BASE, 12.345);
    const b = sampleAt({ ...BAND_LIMITED_BASE, seed: BAND_LIMITED_BASE.seed + 1 }, 12.345);
    expect(a).not.toEqual(b);
  });

  it('reports no discrete change events (continuous pursuit)', () => {
    const trajectory = createTrackingTrajectory(BAND_LIMITED_BASE);
    expect(trajectory.changes).toEqual([]);
  });

  it.each([
    ['non-finite seed', { ...BAND_LIMITED_BASE, seed: Number.NaN }],
    ['negative duration', { ...BAND_LIMITED_BASE, durationMs: -1 }],
    ['zero duration', { ...BAND_LIMITED_BASE, durationMs: 0 }],
    ['non-ascending band', { ...BAND_LIMITED_BASE, frequencyBandHz: [0.6, 0.1] as const }],
    ['zero low band', { ...BAND_LIMITED_BASE, frequencyBandHz: [0, 0.6] as const }],
    ['non-positive yaw bound', { ...BAND_LIMITED_BASE, yawBoundDeg: 0 }],
    ['non-positive target speed', { ...BAND_LIMITED_BASE, targetRmsSpeedDegPerSec: -5 }],
  ])('fails fast on %s', (_label, config) => {
    expect(() => createTrackingTrajectory(config)).toThrow();
  });
});

/**
 * KI-019 fixture. Same parameter shape as the shipped `tracking_reversal_pilot_v1_medium` cell
 * (and geometrically legal — it passes the F-A2 consistency guard: a leg demands at most
 * `20 x (1.4 - 0.15)` = 25deg inside a 26deg window), with the seed picked so the RNG walk
 * actually walks both axes onto the same-side bound: pre-fix this config produced **3382 legs,
 * 15.0% of the run stationary, and a 2781 ms stretch frozen at a corner**; post-fix it is
 * 32 legs / 1.0% / 16 ms.
 *
 * A *legal* config on purpose — the trap is a generator bug, not merely a consequence of the
 * inconsistent bounds KI-019 F-A2 fixed, and ~5% of seeds still hit it at this shape.
 */
const REVERSAL_SATURATING: Extract<TrackingTrajectoryConfig, { kind: 'reversal-2d-v1' }> = {
  kind: 'reversal-2d-v1',
  seed: 13,
  durationMs: 25_000,
  angularBoundsDeg: [-13, 13],
  speedRangeDegPerSec: [5, 20],
  reversalIntervalMs: [800, 1400],
  accelerationRampMs: 150,
};

/** Samples at the sim rate and reports how much of the run the target is effectively stationary —
 * the observable signature of a bound-pinned schedule (KI-019). */
function stationaryProfile(
  config: Extract<TrackingTrajectoryConfig, { kind: 'reversal-2d-v1' }>,
  simHz = 128,
): { readonly stillFraction: number; readonly maxStillRunMs: number } {
  const trajectory = createTrackingTrajectory(config);
  const out = makeSample();
  const tickCount = Math.round((config.durationMs / 1000) * simHz);
  let still = 0;
  let run = 0;
  let maxRun = 0;
  for (let i = 0; i < tickCount; i++) {
    trajectory.sample(i / simHz, out);
    if (Math.hypot(out.yawVelocityDegPerSec, out.pitchVelocityDegPerSec) < 0.5) {
      still += 1;
      run += 1;
      maxRun = Math.max(maxRun, run);
    } else {
      run = 0;
    }
  }
  return { stillFraction: tickCount === 0 ? 0 : still / tickCount, maxStillRunMs: (maxRun * 1000) / simHz };
}

describe('createTrackingTrajectory — reversal-2d-v1', () => {
  it('never exceeds the configured angular bounds across a dense sweep', () => {
    const trajectory = createTrackingTrajectory(REVERSAL_BASE);
    const out = makeSample();
    const [lowDeg, highDeg] = REVERSAL_BASE.angularBoundsDeg;
    for (let ms = 0; ms <= REVERSAL_BASE.durationMs; ms += 5) {
      trajectory.sample(ms / 1000, out);
      expect(out.yawDeg).toBeGreaterThanOrEqual(lowDeg - 1e-6);
      expect(out.yawDeg).toBeLessThanOrEqual(highDeg + 1e-6);
      expect(out.pitchDeg).toBeGreaterThanOrEqual(lowDeg - 1e-6);
      expect(out.pitchDeg).toBeLessThanOrEqual(highDeg + 1e-6);
    }
  });

  it('never exceeds the finite acceleration implied by speedRange/accelerationRampMs', () => {
    const trajectory = createTrackingTrajectory(REVERSAL_BASE);
    const [, speedMax] = REVERSAL_BASE.speedRangeDegPerSec;
    // Worst case: a full reversal from +speedMax to -speedMax over the configured ramp.
    const maxAccelDegPerSec2 = (2 * speedMax) / (REVERSAL_BASE.accelerationRampMs / 1000);
    const dtSec = 0.001;
    const a = makeSample();
    const b = makeSample();
    for (let t = 0; t < REVERSAL_BASE.durationMs / 1000 - dtSec; t += dtSec) {
      trajectory.sample(t, a);
      trajectory.sample(t + dtSec, b);
      const yawAccel = Math.abs(b.yawVelocityDegPerSec - a.yawVelocityDegPerSec) / dtSec;
      const pitchAccel = Math.abs(b.pitchVelocityDegPerSec - a.pitchVelocityDegPerSec) / dtSec;
      // A small numerical-differentiation margin above the analytic worst case guards against
      // sampling exactly across a ramp boundary without asserting on a physically impossible jump.
      expect(yawAccel).toBeLessThanOrEqual(maxAccelDegPerSec2 * 1.05 + 1);
      expect(pitchAccel).toBeLessThanOrEqual(maxAccelDegPerSec2 * 1.05 + 1);
    }
  });

  it('is continuous in position and velocity across every recorded change event', () => {
    const trajectory = createTrackingTrajectory(REVERSAL_BASE);
    expect(trajectory.changes.length).toBeGreaterThan(0);
    const epsilonSec = 1e-4;
    const before = makeSample();
    const after = makeSample();
    for (const change of trajectory.changes) {
      if (change.tMs === 0) continue; // no "before" instant to compare against at t=0
      trajectory.sample(change.tMs / 1000 - epsilonSec, before);
      trajectory.sample(change.tMs / 1000 + epsilonSec, after);
      expect(after.yawDeg).toBeCloseTo(before.yawDeg, 3);
      expect(after.pitchDeg).toBeCloseTo(before.pitchDeg, 3);
    }
  });

  it('rests at zero velocity at every leg boundary (rest-to-rest ramp design)', () => {
    const trajectory = createTrackingTrajectory(REVERSAL_BASE);
    const at = makeSample();
    for (const change of trajectory.changes) {
      trajectory.sample(change.tMs / 1000, at);
      expect(at.yawVelocityDegPerSec).toBeCloseTo(0, 9);
      expect(at.pitchVelocityDegPerSec).toBeCloseTo(0, 9);
    }
  });

  it("each change event's recorded after-velocity matches the mid-cruise sampled velocity of its own leg", () => {
    const trajectory = createTrackingTrajectory(REVERSAL_BASE);
    const changes = trajectory.changes;
    const at = makeSample();
    for (let i = 0; i < changes.length; i++) {
      const legStartMs = changes[i].tMs;
      const legEndMs = i + 1 < changes.length ? changes[i + 1].tMs : REVERSAL_BASE.durationMs;
      const midSec = (legStartMs + legEndMs) / 2 / 1000;
      trajectory.sample(midSec, at);
      // Skip legs so short (relative to accelerationRampMs) that the midpoint still falls inside a
      // ramp rather than the cruise plateau — this check only targets the steady-state cruise value.
      if (legEndMs - legStartMs < REVERSAL_BASE.accelerationRampMs * 2.5) continue;
      expect(at.yawVelocityDegPerSec).toBeCloseTo(changes[i].yawVelocityAfterDegPerSec, 2);
      expect(at.pitchVelocityDegPerSec).toBeCloseTo(changes[i].pitchVelocityAfterDegPerSec, 2);
    }
  });

  it("each change event's before-velocity matches the previous change event's after-velocity", () => {
    const trajectory = createTrackingTrajectory(REVERSAL_BASE);
    const changes = trajectory.changes;
    for (let i = 1; i < changes.length; i++) {
      expect(changes[i].yawVelocityBeforeDegPerSec).toBe(changes[i - 1].yawVelocityAfterDegPerSec);
      expect(changes[i].pitchVelocityBeforeDegPerSec).toBe(changes[i - 1].pitchVelocityAfterDegPerSec);
    }
  });

  it('is a pure function of age — independent of sampling cadence (60/120/240 Hz pump equivalence)', () => {
    const trajectoryA = createTrackingTrajectory(REVERSAL_BASE);
    const trajectoryB = createTrackingTrajectory(REVERSAL_BASE);
    const outA = makeSample();
    const outB = makeSample();
    const checkAgesSec = [0, 1 / 240, 1 / 120, 1 / 60, 0.5, 1, 5, 15, 29.9];
    for (const ageSec of checkAgesSec) {
      trajectoryA.sample(ageSec, outA);
      trajectoryB.sample(ageSec, outB);
      expect(outB).toEqual(outA);
    }
  });

  // --- KI-019 regression: bound saturation must not degenerate the schedule ---

  it('never emits a zero-velocity leg, even when every leg saturates the angular bounds (KI-019)', () => {
    const trajectory = createTrackingTrajectory(REVERSAL_SATURATING);
    expect(trajectory.changes.length).toBeGreaterThan(0);
    for (const change of trajectory.changes) {
      // A leg whose cruise velocity is zero on both axes is not a reversal — it is the generator
      // spinning against a bound. Pre-fix this config produced thousands of them.
      expect(Math.hypot(change.yawVelocityAfterDegPerSec, change.pitchVelocityAfterDegPerSec)).toBeGreaterThan(0);
    }
    // Leg count stays proportional to the reversal schedule instead of collapsing into slivers
    // (pre-fix this fixture generated 3382 legs for a 25 s block; the shipped medium cell, 6644).
    expect(trajectory.changes.length).toBeLessThan(200);
  });

  it('keeps a bound-saturating target moving instead of freezing it at a corner (KI-019)', () => {
    const { stillFraction, maxStillRunMs } = stationaryProfile(REVERSAL_SATURATING);
    // Rest-to-rest legs are momentarily still at every leg boundary, so a small fraction is by
    // design; a pinned schedule instead parks the target (pre-fix: 15.0% still, 2781 ms frozen).
    expect(stillFraction).toBeLessThan(0.05);
    expect(maxStillRunMs).toBeLessThanOrEqual(50);
  });

  it('still respects the angular bounds under saturation (KI-019 fix must not trade bounds for motion)', () => {
    const trajectory = createTrackingTrajectory(REVERSAL_SATURATING);
    const out = makeSample();
    const [lowDeg, highDeg] = REVERSAL_SATURATING.angularBoundsDeg;
    for (let ms = 0; ms <= REVERSAL_SATURATING.durationMs; ms += 5) {
      trajectory.sample(ms / 1000, out);
      expect(out.yawDeg).toBeGreaterThanOrEqual(lowDeg - 1e-6);
      expect(out.yawDeg).toBeLessThanOrEqual(highDeg + 1e-6);
      expect(out.pitchDeg).toBeGreaterThanOrEqual(lowDeg - 1e-6);
      expect(out.pitchDeg).toBeLessThanOrEqual(highDeg + 1e-6);
    }
  });

  it('reproduces an identical change schedule from the same seed/config (reset reproducibility)', () => {
    const a = createTrackingTrajectory(REVERSAL_BASE).changes;
    const b = createTrackingTrajectory(REVERSAL_BASE).changes;
    expect(b).toEqual(a);
  });

  it('produces a different change schedule for a different seed', () => {
    const a = createTrackingTrajectory(REVERSAL_BASE).changes;
    const b = createTrackingTrajectory({ ...REVERSAL_BASE, seed: REVERSAL_BASE.seed + 1 }).changes;
    expect(b).not.toEqual(a);
  });

  it.each([
    ['non-finite seed', { ...REVERSAL_BASE, seed: Number.NaN }],
    ['negative duration', { ...REVERSAL_BASE, durationMs: -1 }],
    ['non-ascending angular bounds', { ...REVERSAL_BASE, angularBoundsDeg: [8, -8] as const }],
    ['non-ascending speed range', { ...REVERSAL_BASE, speedRangeDegPerSec: [30, 10] as const }],
    ['non-positive min speed', { ...REVERSAL_BASE, speedRangeDegPerSec: [0, 30] as const }],
    ['non-ascending reversal interval', { ...REVERSAL_BASE, reversalIntervalMs: [900, 400] as const }],
    ['ramp not shorter than min interval', { ...REVERSAL_BASE, accelerationRampMs: 400 }],
  ])('fails fast on %s', (_label, config) => {
    expect(() => createTrackingTrajectory(config)).toThrow();
  });
});

describe('createTrackingTrajectory — unknown kind', () => {
  it('fails fast on an unrecognized kind (runtime-decoded config safety)', () => {
    const bogus = { kind: 'bogus-v1', seed: 1, durationMs: 1000 } as unknown as TrackingTrajectoryConfig;
    expect(() => createTrackingTrajectory(bogus)).toThrow(/unknown kind/);
  });
});

describe('projectTrackingAngles', () => {
  const origin = { distanceU: 4, centerY: 1.5 };

  function project(yawDeg: number, pitchDeg: number): Vec3 {
    const out: Vec3 = { x: 0, y: 0, z: 0 };
    projectTrackingAngles(yawDeg, pitchDeg, origin, out);
    return out;
  }

  it('maps (0, 0) onto the boresight point (0, centerY, -distanceU)', () => {
    const p = project(0, 0);
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.y).toBeCloseTo(origin.centerY, 9);
    expect(p.z).toBeCloseTo(-origin.distanceU, 9);
  });

  it('maps yaw=90deg onto the +x axis at the same depth-plane height', () => {
    const p = project(90, 0);
    expect(p.x).toBeCloseTo(origin.distanceU, 9);
    expect(p.z).toBeCloseTo(0, 9);
    expect(p.y).toBeCloseTo(origin.centerY, 9);
  });

  it('maps pitch=90deg onto straight up from centerY', () => {
    const p = project(0, 90);
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.y).toBeCloseTo(origin.centerY + origin.distanceU, 9);
    expect(p.z).toBeCloseTo(0, 9);
  });

  it('is an odd function of yaw around the boresight (mirror symmetry)', () => {
    const left = project(-30, 10);
    const right = project(30, 10);
    expect(right.x).toBeCloseTo(-left.x, 9);
    expect(right.y).toBeCloseTo(left.y, 9);
    expect(right.z).toBeCloseTo(left.z, 9);
  });

  it('is a pure function of its inputs', () => {
    expect(project(17, -8)).toEqual(project(17, -8));
  });
});
