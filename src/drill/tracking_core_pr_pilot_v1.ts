import type { DrillConfig } from './DrillConfig.ts';

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
 * Core matrix values (`yawBoundDeg`/`pitchBoundDeg` = travel amplitude, `targetRmsSpeedDegPerSec`
 * = RMS angular speed) are OQ-54-2's calibration candidates — **not** frozen; T7 decides
 * retained/revise/remove per README §1.4. Axis calibration blocks suppress the off-axis bound to
 * a near-zero value (cannot be exactly 0 — `trackingTrajectory.ts` requires positive bounds) so
 * the target travels along essentially one axis only, for visibility/perceptibility inspection.
 */

const DISTANCE_U = 4; // matches tracking_v1's forward sightline convention (field-low clear zone)
const FREQUENCY_BAND_HZ = [0.1, 0.7] as const; // fixed across every core/calibration cell — not a manipulated variable (OQ-54-2 only varies size/speed)
const PREP_MS = 1000; // FR-54-5 "scored 開始前 1 秒置中準備"
const SCORED_DURATION_MS = 25000; // D-54.4 frozen block length
const RUNNING_DURATION_MS = PREP_MS + SCORED_DURATION_MS;
const PRESENTATION_MS = RUNNING_DURATION_MS + 4000; // comfortably above RUNNING_DURATION_MS so presentationMs never preempts the timeLimit end
const COUNTDOWN_MS = 3000; // existing tracking_v1/_longrange_v1/_br_v1 convention
const SUPPRESSED_AXIS_DEG = 0.1; // near-zero but positive (requirePositiveNumber); negligible travel on the suppressed axis
const CALIBRATION_AMPLITUDE_DEG = 2.0; // core matrix's larger/easier amplitude — visibility calibration probes the more visible cell first
const CALIBRATION_SPEED_DEG_PER_SEC = 5; // core matrix's slower speed — isolates axis visibility from fast-motion confound
const SCORED_PROTOCOL_GUARD: NonNullable<DrillConfig['protocolGuard']> = { noFire: true, noAds: true, noMovement: true };

/** WP-54-only seed base — distinct from every other WP's series (18018/23002/94000s/95000s). */
const SEED_BASE = 54000;

export const CORE_PR_PILOT_V1_SIZE_CANDIDATES_DEG = [2.0, 0.5] as const;
export const CORE_PR_PILOT_V1_SPEED_CANDIDATES_DEG_PER_SEC = [5, 20] as const;
export type CorePrPilotV1SizeDeg = (typeof CORE_PR_PILOT_V1_SIZE_CANDIDATES_DEG)[number];
export type CorePrPilotV1SpeedDegPerSec = (typeof CORE_PR_PILOT_V1_SPEED_CANDIDATES_DEG_PER_SEC)[number];

function baseTargets(): { count: 1; distance: number } {
  return { count: 1, distance: DISTANCE_U };
}

function scoredTiming(): DrillConfig['timing'] {
  return {
    countdownMs: COUNTDOWN_MS,
    presentationMs: PRESENTATION_MS,
    trackingPrepMs: PREP_MS,
  };
}

/** Practice cell — the core matrix's easiest candidate, no scored window / no protocolGuard. */
export const trackingCorePrPilotV1Practice: DrillConfig = {
  drillId: 'tracking_core_pr_pilot_v1_practice',
  mode: 'practice',
  targets: {
    ...baseTargets(),
    trackingTrajectory: {
      kind: 'band-limited-2d-v1',
      seed: SEED_BASE,
      durationMs: SCORED_DURATION_MS,
      yawBoundDeg: CORE_PR_PILOT_V1_SIZE_CANDIDATES_DEG[0],
      pitchBoundDeg: CORE_PR_PILOT_V1_SIZE_CANDIDATES_DEG[0],
      targetRmsSpeedDegPerSec: CORE_PR_PILOT_V1_SPEED_CANDIDATES_DEG_PER_SEC[0],
      frequencyBandHz: FREQUENCY_BAND_HZ,
    },
  },
  sequence: { alternation: 'RL' },
  timing: { countdownMs: COUNTDOWN_MS, presentationMs: PRESENTATION_MS },
  endCondition: { type: 'timeLimit', value: SCORED_DURATION_MS },
};

/** Horizontal axis calibration: full yaw amplitude, near-zero pitch. */
export const trackingCorePrPilotV1CalibrationHorizontal: DrillConfig = {
  drillId: 'tracking_core_pr_pilot_v1_calibration_horizontal',
  mode: 'practice',
  targets: {
    ...baseTargets(),
    trackingTrajectory: {
      kind: 'band-limited-2d-v1',
      seed: SEED_BASE + 1,
      durationMs: SCORED_DURATION_MS,
      yawBoundDeg: CALIBRATION_AMPLITUDE_DEG,
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

/** Vertical axis calibration: full pitch amplitude, near-zero yaw. */
export const trackingCorePrPilotV1CalibrationVertical: DrillConfig = {
  drillId: 'tracking_core_pr_pilot_v1_calibration_vertical',
  mode: 'practice',
  targets: {
    ...baseTargets(),
    trackingTrajectory: {
      kind: 'band-limited-2d-v1',
      seed: SEED_BASE + 2,
      durationMs: SCORED_DURATION_MS,
      yawBoundDeg: SUPPRESSED_AXIS_DEG,
      pitchBoundDeg: CALIBRATION_AMPLITUDE_DEG,
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
      ...baseTargets(),
      trackingTrajectory: {
        kind: 'band-limited-2d-v1',
        seed,
        durationMs: SCORED_DURATION_MS,
        yawBoundDeg: sizeDeg,
        pitchBoundDeg: sizeDeg,
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
