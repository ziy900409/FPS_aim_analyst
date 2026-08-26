import type { DrillConfig } from './DrillConfig.ts';
import { SPIDER_SHOT_HITBOX_V1 } from './spider_shot_v1.ts';

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
    count: 20,
    distance: 8,
    hitbox: SPIDER_SHOT_HITBOX_V1,
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
      distanceURange: [8, 8],
    },
    grid: { azimuthQuadrants: 4, radiusTiers: 3 },
  },
  timing: {
    countdownMs: 3000,
    peekTimeoutMs: 1500,
    timeLimitMs: 120000,
  },
  endCondition: { type: 'targetCount', value: 20 },
};
