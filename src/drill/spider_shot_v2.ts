import type { DrillConfig, TargetHitboxConfig } from './DrillConfig.ts';

const SPIDER_SHOT_V2_DISTANCE_U = 8;
// Aim Lab Ultimate/Standard 1.8°–2.2° candidate midpoint.
const SPIDER_SHOT_V2_ANGULAR_DIAMETER_DEG = 2.0;
const SPIDER_SHOT_V2_HITBOX_DIAMETER_U =
  2 * SPIDER_SHOT_V2_DISTANCE_U * Math.tan((SPIDER_SHOT_V2_ANGULAR_DIAMETER_DEG / 2) * (Math.PI / 180));

/** Sphere diameter subtending 2.0° at the fixed 8u spider-shot-v2 target distance. */
export const SPIDER_SHOT_HITBOX_V2: TargetHitboxConfig = {
  widthU: SPIDER_SHOT_V2_HITBOX_DIAMETER_U,
  heightU: SPIDER_SHOT_V2_HITBOX_DIAMETER_U,
  depthU: SPIDER_SHOT_V2_HITBOX_DIAMETER_U,
  shape: 'sphere',
};

/**
 * WP-44 candidate range: split into 3 equal-solid-angle tiers (near/mid/far off the center
 * sightline). NOT pilot-calibrated — unlike spider-shot-v1's WP-39-frozen [15, 15], adjust freely
 * after hands-on testing (stage9 README OQ-S9-1).
 */
export const SPIDER_SHOT_ANGULAR_RADIUS_DEG_RANGE_V2: [number, number] = [10, 25];

/**
 * Assessment Spider Shot protocol with a stratified peripheral schedule (WP-44). Independent from
 * `spider-shot-v1` (WP-36/WP-39-frozen) — v1 is untouched by this drill. Peripheral targets are
 * drawn from a shuffled 4-azimuth-quadrant × 3-radius-tier queue instead of continuous uniform
 * sampling, so consecutive peripheral spawns don't repeat the same region before the others have
 * appeared; center↔peripheral alternation and all downstream metrics/condition-cell derivation are
 * unchanged from v1 (`spiderShotConditions.ts`/`spiderShotMetrics.ts` are agnostic to how a spawn
 * was scheduled).
 */
export const spiderShotV2: DrillConfig = {
  drillId: 'spider-shot-v2',
  mode: 'assessment',
  targets: {
    // Safety ceiling only; the 60s time limit is the actual completion condition.
    count: 300,
    distance: SPIDER_SHOT_V2_DISTANCE_U,
    hitbox: SPIDER_SHOT_HITBOX_V2,
  },
  // Required legacy compatibility field; ignored by the spiderShot branch.
  sequence: { alternation: 'LR' },
  spiderShot: {
    kind: 'center-peripheral-stratified',
    seed: 260826,
    centerDistanceU: 8,
    peripheral: {
      angularRadiusDegRange: SPIDER_SHOT_ANGULAR_RADIUS_DEG_RANGE_V2,
      azimuthDegRange: [0, 360],
      distanceURange: [SPIDER_SHOT_V2_DISTANCE_U, SPIDER_SHOT_V2_DISTANCE_U],
    },
    grid: { azimuthQuadrants: 4, radiusTiers: 3 },
    centerExemptFromTimeout: true,
  },
  timing: {
    countdownMs: 3000,
    peekTimeoutMs: 1750,
  },
  endCondition: { type: 'timeLimit', value: 60000 },
};
