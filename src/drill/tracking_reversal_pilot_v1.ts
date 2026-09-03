import type { DrillConfig, TargetHitboxConfig } from './DrillConfig.ts';
import {
  CORE_PR_PILOT_V1_SIZE_CANDIDATES_DEG,
  trackingPilotAngularSizeToDiameterU,
} from './tracking_core_pr_pilot_v1.ts';

/**
 * WP-54 / T2 — tracking pilot: medium/high reversal-density candidate blocks (README §2.2/§2.4,
 * task-checklist T2 "新增 medium/high reversal density candidate blocks"). Uses `reversal-2d-v1`
 * (finite-acceleration random-reversal, `src/sim/trackingTrajectory.ts`) instead of the core
 * pseudorandom matrix's `band-limited-2d-v1` (`tracking_core_pr_pilot_v1.ts`) — reactive
 * correction is reported separately from steady pursuit (D-54.2/OQ-54-1), not combined into one
 * score.
 *
 * `mode: 'practice'`, prep window, and `protocolGuard` follow the exact same convention as
 * `tracking_core_pr_pilot_v1.ts` — see that file's header comment for the rationale.
 *
 * Density candidates (`reversalIntervalMs`) are calibration candidates, not frozen values (same
 * OQ-54-2 status as the core matrix's size/speed candidates) — T7 decides retained/revise/remove.
 * `angularBoundsDeg`/`speedRangeDegPerSec` are held fixed across both density cells so only
 * reversal frequency varies between them. The bounds were widened from ±8° to ±13° for KI-019 F-A2:
 * at ±8° a leg's demanded travel (25°) could not fit the 16° window, so every leg was truncated at
 * a bound and the delivered reversal density stopped matching `reversalIntervalMs` entirely.
 */

const DISTANCE_U = 4; // matches tracking_core_pr_pilot_v1.ts / tracking_v1's forward sightline convention
// KI-019 F-A2（研究者選定：放寬角度視窗，兩個被操弄變數維持 T0 預註冊值）。單一 leg 的最大需求
// 位移 = speedMax x (intervalMax - ramp) = 20 x (1.4 - 0.15) = 25deg，必須放得進視窗，否則每個 leg
// 都被邊界截斷、交付密度不等於 `reversalIntervalMs`（見 KI-019 §5）。±13deg 給 26deg 視窗。
// `createTrackingTrajectory()` 現在會在建構期驗證這個關係並 fail fast。
const ANGULAR_BOUNDS_DEG = [-13, 13] as const;
/**
 * Originally chosen to match the core matrix's speed candidates for cross-block comparability.
 * **That alignment no longer holds and is deliberately not restored (T7, 2026-09-03):** the core
 * matrix's fast candidate was revised `20` → `14` deg/s because `[0.15, 1.05]` Hz could not deliver
 * 20 inside field-low's vertical envelope (see `CORE_PR_PILOT_V1_SPEED_CANDIDATES_DEG_PER_SEC`).
 * The reversal family has a different generator, is not bound by that band, and is the **only**
 * family that cleared Gate A's validity check (frozen-crosshair ratio 2.06–3.01), so its range is
 * held at `[5, 20]` rather than re-tuned on the back of a core-matrix constraint. Consequence to
 * keep in mind when reading results: nominal speeds are **no longer exactly comparable across the
 * two families**; compare within a family, or use the delivered `atEye` figures.
 */
const SPEED_RANGE_DEG_PER_SEC = [5, 20] as const;
const ACCELERATION_RAMP_MS = 150; // well under both density cells' reversalIntervalMs[0] (schema.ts-enforced)
const PREP_MS = 1000; // FR-54-5, same as tracking_core_pr_pilot_v1.ts
const SCORED_DURATION_MS = 25000; // D-54.4 frozen block length
const RUNNING_DURATION_MS = PREP_MS + SCORED_DURATION_MS;
const PRESENTATION_MS = RUNNING_DURATION_MS + 4000;
const COUNTDOWN_MS = 3000;
const PROTOCOL_GUARD: NonNullable<DrillConfig['protocolGuard']> = { noFire: true, noAds: true, noMovement: true };

/** WP-54-only seed base, offset from tracking_core_pr_pilot_v1.ts's 54000-series so the two families' seeds never collide. */
const SEED_BASE = 54100;

/**
 * Target angular size, held constant across both density cells so reversal frequency stays the
 * only manipulation here (KI-020 §4.1 made angular size a real hitbox rather than a mislabelled
 * travel amplitude). Uses the core matrix's **larger/easier** candidate: these blocks probe
 * reactive correction, and pairing them with the at-risk 0.5° target would confound density with
 * the pixel-floor question the axis-calibration blocks exist to answer. Without a hitbox these
 * cells inherited the default H1 target (~±7°), which pinned their TOT at 100.0%.
 */
const TARGET_ANGULAR_SIZE_DEG = CORE_PR_PILOT_V1_SIZE_CANDIDATES_DEG[0];

/** Sphere, matching the core matrix (KI-021 / GD-30); see `trackingPilotAngularSizeToDiameterU`. */
function sphereHitbox(): TargetHitboxConfig {
  const diameterU = trackingPilotAngularSizeToDiameterU(TARGET_ANGULAR_SIZE_DEG, DISTANCE_U);
  return { widthU: diameterU, heightU: diameterU, depthU: diameterU, shape: 'sphere' };
}

function buildReversalCell(drillIdSuffix: string, seed: number, reversalIntervalMs: readonly [number, number]): DrillConfig {
  return {
    drillId: `tracking_reversal_pilot_v1_${drillIdSuffix}`,
    mode: 'practice',
    targets: {
      count: 1,
      distance: DISTANCE_U,
      hitbox: sphereHitbox(),
      trackingTrajectory: {
        kind: 'reversal-2d-v1',
        seed,
        durationMs: SCORED_DURATION_MS,
        angularBoundsDeg: ANGULAR_BOUNDS_DEG,
        speedRangeDegPerSec: SPEED_RANGE_DEG_PER_SEC,
        reversalIntervalMs,
        accelerationRampMs: ACCELERATION_RAMP_MS,
      },
    },
    sequence: { alternation: 'RL' },
    timing: {
      countdownMs: COUNTDOWN_MS,
      presentationMs: PRESENTATION_MS,
      trackingPrepMs: PREP_MS,
    },
    endCondition: { type: 'timeLimit', value: RUNNING_DURATION_MS },
    protocolGuard: PROTOCOL_GUARD,
  };
}

/** Medium reversal density: longer intervals between direction changes. */
export const trackingReversalPilotV1Medium: DrillConfig = buildReversalCell('medium', SEED_BASE, [800, 1400]);

/** High reversal density: shorter intervals — more frequent reactive corrections per block. */
export const trackingReversalPilotV1High: DrillConfig = buildReversalCell('high', SEED_BASE + 1, [300, 600]);

/** Both reversal-density candidate cells — single source for researcher-mode registration. */
export const TRACKING_REVERSAL_PILOT_V1_CANDIDATES: readonly DrillConfig[] = [
  trackingReversalPilotV1Medium,
  trackingReversalPilotV1High,
];
