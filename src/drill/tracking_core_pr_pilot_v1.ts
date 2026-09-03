import type { DrillConfig, TargetHitboxConfig } from './DrillConfig.ts';

/**
 * WP-54 / T2 — tracking pilot: practice block + horizontal/vertical axis calibration blocks +
 * core pseudorandom (band-limited-2d-v1) 2x2 size/speed matrix (README §2.2/§2.4, task-checklist
 * T2). Researcher/pilot-only (`docs/exec-plan/active/stage11/wp-54-tracking-pilot/README.md` §0
 * "交付定位") — every config here uses `mode: 'practice'` (WP-33 Assessment/Practice contract),
 * matching the existing WP-52 pilot v2 precedent (`peek_click_transfer_pilot_v2.ts`): pilot-only
 * research drills never use `mode: 'assessment'` regardless of whether WP-54's own vocabulary
 * calls the block "scored" — that distinction is expressed by `timing.trackingPrepMs` +
 * `protocolGuard` presence, not by `DrillConfig.mode`.
 *
 * "Scored" vs "practice" (WP-54's own vocabulary, distinct from `DrillConfig.mode` above): the
 * practice block below has neither `trackingPrepMs` nor `protocolGuard` — nothing to score, no
 * scored window. Every calibration/core cell has both: a 1s center-prep window
 * (`timing.trackingPrepMs`, FR-54-5) before the frozen 25s scored window (D-54.4), and
 * `protocolGuard` flagging no-fire/no-ADS/no-movement violations during that scored window
 * (§1.3 Constraints "Scored block 禁止射擊、ADS 與玩家移動").
 *
 * **KI-020 re-parameterization (2026-09-03)** — the 2x2 matrix now manipulates what it claims to.
 * The first real pilot session showed neither factor was being delivered: `size` was wired to the
 * trajectory's travel amplitude (leaving every cell the same oversized default H1 target, TOT
 * pinned at 100.0%), and both speed candidates were silently clamped to ~0.86 deg/s by the
 * amplitude bound. Now:
 *
 * - `size` = the target's **angular size**, expressed as a cubic `targets.hitbox` sized for
 *   `DISTANCE_U` — this is what README §3's "0.5 deg 目標接近 pixel floor" risk and FR-54-4's
 *   "angular size" mean.
 * - `speed` = the delivered RMS angular speed. Travel amplitude is a **shared constant** across
 *   every cell, and the frequency band was raised so both candidates are actually realizable.
 *
 * `createTrackingTrajectory()` now rejects any config whose requested speed cannot be delivered
 * within its amplitude/band, so this class of silent mismatch cannot ship again.
 *
 * Both candidate sets remain OQ-54-2 calibration candidates — **not** frozen; T7 decides
 * retained/revise/remove per README §1.4. Axis calibration blocks suppress the off-axis bound to
 * a near-zero value (cannot be exactly 0 — `trackingTrajectory.ts` requires positive bounds) so
 * the target travels along essentially one axis only, for visibility/perceptibility inspection.
 */

const DISTANCE_U = 4; // matches tracking_v1's forward sightline convention (field-low clear zone)
/**
 * KI-020 §4.2 (researcher's decision: raise the band, share one amplitude). The original
 * `[0.1, 0.7]` Hz band could only deliver ~0.86 deg/s per axis inside a ±2° envelope, so 5 and 20
 * deg/s collapsed to the same delivered speed. At `[0.3, 2.1]` Hz both candidates are delivered at
 * one shared amplitude (measured: 5.05 and 20.21 deg/s).
 *
 * The rejected alternative was "enlarge the amplitude": 20 deg/s would need ±48°, which puts the
 * target at ±37° — below the floor (y ≈ -1.5) and outside the ~±35° vertical FOV.
 */
const FREQUENCY_BAND_HZ = [0.3, 2.1] as const;
/**
 * Travel amplitude — **shared by every cell**, so `targetRmsSpeedDegPerSec` is the only dynamic
 * difference between them. ±16° is the intersection of vertical headroom and deliverable speed:
 * the target actually reaches ~13° (y ≈ [0.6, 2.6], above the floor and inside the FOV) while
 * still permitting 20 deg/s. This is **not** a manipulated variable — size is now the hitbox.
 */
const TRAVEL_AMPLITUDE_DEG = 16;
const PREP_MS = 1000; // FR-54-5 "scored 開始前 1 秒置中準備"
const SCORED_DURATION_MS = 25000; // D-54.4 frozen block length
const RUNNING_DURATION_MS = PREP_MS + SCORED_DURATION_MS;
const PRESENTATION_MS = RUNNING_DURATION_MS + 4000; // comfortably above RUNNING_DURATION_MS so presentationMs never preempts the timeLimit end
const COUNTDOWN_MS = 3000; // existing tracking_v1/_longrange_v1/_br_v1 convention
const SUPPRESSED_AXIS_DEG = 0.1; // near-zero but positive (requirePositiveNumber); negligible travel on the suppressed axis
const CALIBRATION_SPEED_DEG_PER_SEC = 5; // the slower candidate — isolates axis visibility from a fast-motion confound
const SCORED_PROTOCOL_GUARD: NonNullable<DrillConfig['protocolGuard']> = { noFire: true, noAds: true, noMovement: true };

/** WP-54-only seed base — distinct from every other WP's series (18018/23002/94000s/95000s). */
const SEED_BASE = 54000;

export const CORE_PR_PILOT_V1_SIZE_CANDIDATES_DEG = [2.0, 0.5] as const;
export const CORE_PR_PILOT_V1_SPEED_CANDIDATES_DEG_PER_SEC = [5, 20] as const;
export type CorePrPilotV1SizeDeg = (typeof CORE_PR_PILOT_V1_SIZE_CANDIDATES_DEG)[number];
export type CorePrPilotV1SpeedDegPerSec = (typeof CORE_PR_PILOT_V1_SPEED_CANDIDATES_DEG_PER_SEC)[number];
/** Axis calibration probes the *at-risk* size — the smallest candidate (README §3 pixel-floor risk). */
const CALIBRATION_SIZE_DEG: CorePrPilotV1SizeDeg = CORE_PR_PILOT_V1_SIZE_CANDIDATES_DEG[1];

/**
 * Angular target size -> hitbox diameter in source units.
 *
 * A **sphere** (`shape: 'sphere'`), so on-target tolerance is `angularSizeDeg` in every direction
 * — which is what "angular size" means. This was a cube until KI-021 (GD-30): WP-55's contact
 * derivation accepted box hitboxes only, because `trackingDerivation.isOnTarget()` was a ray/AABB
 * test that ignored `shape`. That cost a sqrt(2)x anisotropy — on-target tolerance up to 41%
 * looser on the diagonal than on the axes. KI-021 gave the derivation the engine's ray/sphere
 * geometry, so the workaround is gone.
 */
export function trackingPilotAngularSizeToDiameterU(angularSizeDeg: number, distanceU: number): number {
  return 2 * distanceU * Math.tan((angularSizeDeg / 2) * (Math.PI / 180));
}

function sphereHitbox(angularSizeDeg: number): TargetHitboxConfig {
  const diameterU = trackingPilotAngularSizeToDiameterU(angularSizeDeg, DISTANCE_U);
  return { widthU: diameterU, heightU: diameterU, depthU: diameterU, shape: 'sphere' };
}

function baseTargets(angularSizeDeg: number): {
  count: 1;
  distance: number;
  hitbox: TargetHitboxConfig;
} {
  return { count: 1, distance: DISTANCE_U, hitbox: sphereHitbox(angularSizeDeg) };
}

function scoredTiming(): DrillConfig['timing'] {
  return {
    countdownMs: COUNTDOWN_MS,
    presentationMs: PRESENTATION_MS,
    trackingPrepMs: PREP_MS,
  };
}

/** Practice cell — the easiest candidate pair (largest target, slower speed), no scored window /
 * no protocolGuard. */
export const trackingCorePrPilotV1Practice: DrillConfig = {
  drillId: 'tracking_core_pr_pilot_v1_practice',
  mode: 'practice',
  targets: {
    ...baseTargets(CORE_PR_PILOT_V1_SIZE_CANDIDATES_DEG[0]),
    trackingTrajectory: {
      kind: 'band-limited-2d-v1',
      seed: SEED_BASE,
      durationMs: SCORED_DURATION_MS,
      yawBoundDeg: TRAVEL_AMPLITUDE_DEG,
      pitchBoundDeg: TRAVEL_AMPLITUDE_DEG,
      targetRmsSpeedDegPerSec: CORE_PR_PILOT_V1_SPEED_CANDIDATES_DEG_PER_SEC[0],
      frequencyBandHz: FREQUENCY_BAND_HZ,
    },
  },
  sequence: { alternation: 'RL' },
  timing: { countdownMs: COUNTDOWN_MS, presentationMs: PRESENTATION_MS },
  endCondition: { type: 'timeLimit', value: SCORED_DURATION_MS },
};

/**
 * Horizontal axis calibration: full yaw amplitude, near-zero pitch, and the **at-risk 0.5° target**
 * — the whole purpose of these two blocks is README §3's "0.5 deg 目標接近 pixel floor" risk, i.e.
 * whether the smallest candidate is visually resolvable at all along this axis. Before the KI-020
 * re-parameterization they carried the same oversized default target as every other cell and so
 * could not answer that question.
 */
export const trackingCorePrPilotV1CalibrationHorizontal: DrillConfig = {
  drillId: 'tracking_core_pr_pilot_v1_calibration_horizontal',
  mode: 'practice',
  targets: {
    ...baseTargets(CALIBRATION_SIZE_DEG),
    trackingTrajectory: {
      kind: 'band-limited-2d-v1',
      seed: SEED_BASE + 1,
      durationMs: SCORED_DURATION_MS,
      yawBoundDeg: TRAVEL_AMPLITUDE_DEG,
      pitchBoundDeg: SUPPRESSED_AXIS_DEG,
      targetRmsSpeedDegPerSec: CALIBRATION_SPEED_DEG_PER_SEC,
      frequencyBandHz: FREQUENCY_BAND_HZ,
    },
  },
  sequence: { alternation: 'RL' },
  timing: scoredTiming(),
  endCondition: { type: 'timeLimit', value: RUNNING_DURATION_MS },
  protocolGuard: SCORED_PROTOCOL_GUARD,
};

/** Vertical axis calibration: full pitch amplitude, near-zero yaw, same at-risk 0.5° target. */
export const trackingCorePrPilotV1CalibrationVertical: DrillConfig = {
  drillId: 'tracking_core_pr_pilot_v1_calibration_vertical',
  mode: 'practice',
  targets: {
    ...baseTargets(CALIBRATION_SIZE_DEG),
    trackingTrajectory: {
      kind: 'band-limited-2d-v1',
      seed: SEED_BASE + 2,
      durationMs: SCORED_DURATION_MS,
      yawBoundDeg: SUPPRESSED_AXIS_DEG,
      pitchBoundDeg: TRAVEL_AMPLITUDE_DEG,
      targetRmsSpeedDegPerSec: CALIBRATION_SPEED_DEG_PER_SEC,
      frequencyBandHz: FREQUENCY_BAND_HZ,
    },
  },
  sequence: { alternation: 'RL' },
  timing: scoredTiming(),
  endCondition: { type: 'timeLimit', value: RUNNING_DURATION_MS },
  protocolGuard: SCORED_PROTOCOL_GUARD,
};

function corePrPilotV1DrillId(sizeDeg: CorePrPilotV1SizeDeg, speedDegPerSec: CorePrPilotV1SpeedDegPerSec): string {
  return `tracking_core_pr_pilot_v1_${sizeDeg.toString().replace('.', 'p')}deg_${speedDegPerSec}dps`;
}

/** Builds one core-matrix cell for a fixed (size, speed) candidate pair (FR-54-4). */
export function buildTrackingCorePrPilotV1Cell(
  sizeDeg: CorePrPilotV1SizeDeg,
  speedDegPerSec: CorePrPilotV1SpeedDegPerSec,
): DrillConfig {
  const drillId = corePrPilotV1DrillId(sizeDeg, speedDegPerSec);
  // Deterministic distinct seed per cell — offset by the candidate arrays' index product, distinct
  // from the practice/calibration seeds above (SEED_BASE/+1/+2) and from every other cell.
  const sizeIndex = CORE_PR_PILOT_V1_SIZE_CANDIDATES_DEG.indexOf(sizeDeg);
  const speedIndex = CORE_PR_PILOT_V1_SPEED_CANDIDATES_DEG_PER_SEC.indexOf(speedDegPerSec);
  const seed = SEED_BASE + 10 + sizeIndex * CORE_PR_PILOT_V1_SPEED_CANDIDATES_DEG_PER_SEC.length + speedIndex;
  return {
    drillId,
    mode: 'practice',
    targets: {
      // `sizeDeg` is the **target's angular size** (KI-020 §4.1), not its travel amplitude.
      ...baseTargets(sizeDeg),
      trackingTrajectory: {
        kind: 'band-limited-2d-v1',
        seed,
        durationMs: SCORED_DURATION_MS,
        // Shared across every cell so speed is the only dynamic difference between them.
        yawBoundDeg: TRAVEL_AMPLITUDE_DEG,
        pitchBoundDeg: TRAVEL_AMPLITUDE_DEG,
        targetRmsSpeedDegPerSec: speedDegPerSec,
        frequencyBandHz: FREQUENCY_BAND_HZ,
      },
    },
    sequence: { alternation: 'RL' },
    timing: scoredTiming(),
    endCondition: { type: 'timeLimit', value: RUNNING_DURATION_MS },
    protocolGuard: SCORED_PROTOCOL_GUARD,
  };
}

/** Every core 2x2 size/speed candidate cell (FR-54-4) — single source for researcher-mode registration. */
export const TRACKING_CORE_PR_PILOT_V1_CANDIDATES: readonly DrillConfig[] = CORE_PR_PILOT_V1_SIZE_CANDIDATES_DEG.flatMap(
  (sizeDeg) => CORE_PR_PILOT_V1_SPEED_CANDIDATES_DEG_PER_SEC.map((speedDegPerSec) => buildTrackingCorePrPilotV1Cell(sizeDeg, speedDegPerSec)),
);
