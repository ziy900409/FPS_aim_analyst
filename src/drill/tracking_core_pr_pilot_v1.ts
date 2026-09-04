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
 * The band sets how far the target travels per unit speed, and therefore whether the condition can
 * discriminate tracking from not-tracking at all.
 *
 * **OQ-54-14 (researcher's decision, 2026-09-03): `[0.3, 2.1]` → `[0.15, 1.05]` Hz.** Gate A round
 * 3 measured the *frozen-crosshair ratio* — freeze the crosshair at the participant's own median
 * aim, recompute ε(t), and divide by their achieved RMS ε; it is the upper bound on how much a
 * condition can tell a tracker from someone who does not move. The band-limited cells scored
 * 1.08–1.35 (the reversal family, 2.06–3.01, was the only one that measured tracking at all).
 *
 * Travel is pinned by speed and band together (amplitude ≈ speed / 2πf), so this ratio is a pure
 * function of the band and the delivered speed:
 *
 *     ratio ≈ 0.3776 · k(band) · v / (0.183 + 0.1867 · v),   k = Σ(1/ω_i) / √(N/2)
 *
 * whose v → ∞ asymptote is `2.023 · k`. At `[0.3, 2.1]` that ceiling is **1.61 — no speed could
 * ever reach 2.0**, which is why raising the speed candidates could not have rescued the matrix.
 * `[0.15, 1.05]` gives k = 1.589 (ceiling 3.21), predicting 2.32–2.94 across 2.5–10 deg/s, i.e.
 * bracketing the reversal family's demonstrated range. Measured band/ratio table: KI-024 §5.2.
 *
 * The cost is task character: 25 s holds ~3.8 cycles of the lowest component instead of ~7.5.
 * Lower bands (`[0.12, 0.84]`, `[0.1, 0.7]`) score higher still but fall to 3.0/2.5 cycles and
 * push the target below the floor at the fast candidate.
 *
 * Superseded rationale (KI-020 §4.2): `[0.3, 2.1]` was chosen because the original `[0.1, 0.7]`
 * could only deliver ~0.86 deg/s per axis inside the then ±2° envelope. Raising the amplitude was
 * rejected at the time because 20 deg/s appeared to need ±48°. Both figures were computed before
 * KI-024 — the eye sat 4 u behind the world origin, so the envelope was being spent at twice the
 * rate needed for a given angle at the eye. With `field-low` anchored (BD-024) the same eye-relative
 * travel costs half the world displacement, which is what makes this band affordable.
 */
const FREQUENCY_BAND_HZ = [0.15, 1.05] as const;
/**
 * Travel amplitude — **shared by every cell**, so `targetRmsSpeedDegPerSec` is the only dynamic
 * difference between them. This is **not** a manipulated variable; size is the hitbox.
 *
 * ±16° is the smallest bound that still lets the fast candidate be delivered: at this band the
 * 14 deg/s cell needs ±15.73° of analytic headroom (`createTrackingTrajectory` fails fast below
 * that, KI-020's guard). The bound is an analytic upper bound, not the excursion — the target
 * actually reaches ~15°, keeping it above the floor (world y ≈ 0.44–2.56) and inside the vertical
 * FOV (asserted in `tracking_core_pr_pilot_v1.test.ts`).
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

/**
 * **T7 revise (researcher's decision, 2026-09-04): `[2.0, 0.5]` → `[3.0, 2.0]` deg.**
 *
 * OQ-54-2 registered these as *candidates*; T7 emits retained/revise/remove, and the 2026-09-04
 * operator dry-run produced the evidence for a revise at both ends. TOT re-derived from that run's
 * own recordings with the shipped pipeline, only the hitbox swapped:
 *
 * | cell | at 0.5° | at 2.0° | at 3.0° |
 * |---|---|---|---|
 * | `0p5deg_14dps` | **1.5%** | 16.4% | 29.4% |
 * | `0p5deg_5dps`  | **3.9%** | 53.7% | 85.8% |
 * | `2deg_14dps`   | 2.0%     | 19.0% | 35.4% |
 * | `2deg_5dps`    | 9.6%     | 62.3% | 86.2% |
 *
 * The two 0.5° cells sat at **1.5% / 3.9% TOT — under the frozen B-2b hard floor of 5%**
 * (`T7-difficulty-calibration-gate.md` §2.2), so 0.5° could not stay as the small level. The
 * researcher chose to lift the small level to 2.0° and the large level to 3.0°, which keeps a true
 * 2x2 (two size levels x two speeds) and puts three of the four cells inside the frozen 5–80%
 * window: 3.0°/14dps 35.4%, 2.0°/5dps 53.7%, 2.0°/14dps 16.4%.
 *
 * **Known risk, accepted by the researcher after being shown the number:** `3deg_5dps` measured
 * **86.2%** on this single operator run, above the frozen 80% ceiling. B-2a is judged on the
 * *median across participants* plus a between-participant CV floor, not on one practised operator,
 * so this is a risk rather than a determination — but it is the cell most likely to be judged
 * `revise` at Gate B.
 *
 * **drillId reuse:** the IDs `..._2deg_5dps` / `..._2deg_14dps` existed in earlier generations as
 * the *large* level and now denote the *small* level. Angular size is the same 2.0° in both, but
 * the seed differs (seeds are index-derived), so the trajectory realisation differs. Every payload
 * that ever carried those IDs is already void (G1–G3) or explicitly non-evidence (the G4 dry-run),
 * so nothing live is affected; layer 3b (`checkTrackingStimulusFidelity`) catches any attempt to
 * pool across generations, and `analysis-tracking.md` identifies G5 by these size candidates.
 */
export const CORE_PR_PILOT_V1_SIZE_CANDIDATES_DEG = [3.0, 2.0] as const;
/**
 * **T7 revise (researcher's decision, 2026-09-03): fast candidate `20` → `14` deg/s.**
 *
 * OQ-54-2 registered these as *candidates*, not frozen values, and T7's job is to emit
 * retained/revise/remove — this is a revise, forced by geometry rather than by preference.
 *
 * At the `[0.15, 1.05]` Hz band the travel needed to deliver a speed grows as `speed / 2πf`, and
 * a 20 deg/s cell demands ±22.5° of analytic headroom. Measured across the actual cell seeds that
 * puts `0p5deg_20dps` (seed 54013) at world **y = −0.01 — the target passes below the ground** —
 * and `2deg_20dps` at a 20.2° excursion, tripping the vertical-headroom guard. 14 deg/s needs
 * ±15.73°, reaches ~15.4°, and keeps world y ≈ 0.44–2.56.
 *
 * The alternative was the shallower `[0.2, 1.4]` band, which fits 20 deg/s but predicts
 * frozen-crosshair ratios of only 1.99–2.04 on the slow cells — within 2% of the frozen Gate B
 * threshold of 2.0, with a human-error model extrapolated from two participants. 5/14 at this band
 * predicts 2.70/3.00, i.e. real margin. The speed contrast falls from 4x to 2.8x and remains a
 * strong manipulation.
 */
export const CORE_PR_PILOT_V1_SPEED_CANDIDATES_DEG_PER_SEC = [5, 14] as const;
export type CorePrPilotV1SizeDeg = (typeof CORE_PR_PILOT_V1_SIZE_CANDIDATES_DEG)[number];
export type CorePrPilotV1SpeedDegPerSec = (typeof CORE_PR_PILOT_V1_SPEED_CANDIDATES_DEG_PER_SEC)[number];
/**
 * Axis calibration uses the smaller candidate. Until 2026-09-04 that was 0.5° and the block existed
 * to answer README §3's pixel-floor question; the dry-run answered it (a true 0.5° target — ~8.5
 * CSS px once KI-024 was fixed — is resolvable and trackable **single-axis**, TOT 15.7–19.7%, but
 * not on the two-axis core cells, TOT 1.5–3.9%), and the researcher closed that question on those
 * data. These blocks now serve their remaining purpose only: isolating one axis at a time.
 */
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
