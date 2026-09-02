import type { DrillConfig } from './DrillConfig.ts';

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
 * reversal frequency varies between them.
 */

const DISTANCE_U = 4; // matches tracking_core_pr_pilot_v1.ts / tracking_v1's forward sightline convention
const ANGULAR_BOUNDS_DEG = [-8, 8] as const;
const SPEED_RANGE_DEG_PER_SEC = [5, 20] as const; // reuses the core matrix's speed candidates for cross-block comparability
const ACCELERATION_RAMP_MS = 150; // well under both density cells' reversalIntervalMs[0] (schema.ts-enforced)
const PREP_MS = 1000; // FR-54-5, same as tracking_core_pr_pilot_v1.ts
const SCORED_DURATION_MS = 25000; // D-54.4 frozen block length
const RUNNING_DURATION_MS = PREP_MS + SCORED_DURATION_MS;
const PRESENTATION_MS = RUNNING_DURATION_MS + 4000;
const COUNTDOWN_MS = 3000;
const PROTOCOL_GUARD: NonNullable<DrillConfig['protocolGuard']> = { noFire: true, noAds: true, noMovement: true };

/** WP-54-only seed base, offset from tracking_core_pr_pilot_v1.ts's 54000-series so the two families' seeds never collide. */
const SEED_BASE = 54100;

function buildReversalCell(drillIdSuffix: string, seed: number, reversalIntervalMs: readonly [number, number]): DrillConfig {
  return {
    drillId: `tracking_reversal_pilot_v1_${drillIdSuffix}`,
    mode: 'practice',
    targets: {
      count: 1,
      distance: DISTANCE_U,
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
