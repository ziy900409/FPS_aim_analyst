import type { DrillConfig } from './DrillConfig.ts';

/**
 * Assessment Spider Shot protocol. The fixed values are v1 candidates; WP-39
 * calibrates future condition levels without changing the schedule contract.
 */
export const spiderShotV1: DrillConfig = {
  drillId: 'spider-shot-v1',
  mode: 'assessment',
  targets: {
    count: 20,
    distance: 8,
    hitbox: { widthU: 1, heightU: 2, depthU: 1 },
  },
  // Required legacy compatibility field; ignored by the spiderShot branch.
  sequence: { alternation: 'LR' },
  spiderShot: {
    kind: 'center-peripheral',
    seed: 36036,
    centerDistanceU: 8,
    peripheral: {
      angularRadiusDegRange: [15, 15],
      azimuthDegRange: [0, 360],
      distanceURange: [8, 8],
    },
  },
  timing: {
    countdownMs: 3000,
    peekTimeoutMs: 1500,
    timeLimitMs: 120000,
  },
  endCondition: { type: 'targetCount', value: 20 },
};
