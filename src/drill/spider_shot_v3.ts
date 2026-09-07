import type { DrillConfig, TargetHitboxConfig } from './DrillConfig.ts';

export const SPIDER_SHOT_V3_DRILL_ID = 'spider-shot-v3' as const;
export const SPIDER_SHOT_V3_SCENE_ID = 'spider-shot-room' as const;
export const SPIDER_SHOT_V3_PROTOCOL_VERSION = 'spider-shot-v3@1.0.0' as const;
export const SPIDER_SHOT_DISTANCE_U_V3 = 8;
export const SPIDER_SHOT_ANGULAR_DIAMETER_DEG_V3 = 2;
export const SPIDER_SHOT_ANGULAR_RADIUS_DEG_RANGE_V3: [number, number] = [10, 25];

const SPIDER_SHOT_HITBOX_DIAMETER_U_V3 =
  2 *
  SPIDER_SHOT_DISTANCE_U_V3 *
  Math.tan((SPIDER_SHOT_ANGULAR_DIAMETER_DEG_V3 / 2) * (Math.PI / 180));

export const SPIDER_SHOT_HITBOX_V3: TargetHitboxConfig = {
  widthU: SPIDER_SHOT_HITBOX_DIAMETER_U_V3,
  heightU: SPIDER_SHOT_HITBOX_DIAMETER_U_V3,
  depthU: SPIDER_SHOT_HITBOX_DIAMETER_U_V3,
  shape: 'sphere',
};

export const spiderShotV3: DrillConfig = {
  drillId: SPIDER_SHOT_V3_DRILL_ID,
  mode: 'assessment',
  playerControl: { translation: 'locked' },
  protocolGuard: { noMovement: true },
  targets: {
    count: 300,
    distance: SPIDER_SHOT_DISTANCE_U_V3,
    hitbox: SPIDER_SHOT_HITBOX_V3,
  },
  sequence: { alternation: 'LR' },
  spiderShot: {
    kind: 'center-peripheral-eye-stratified',
    seed: 260827,
    centerDistanceU: SPIDER_SHOT_DISTANCE_U_V3,
    targetAngularDiameterDeg: SPIDER_SHOT_ANGULAR_DIAMETER_DEG_V3,
    peripheral: {
      angularRadiusDegRange: SPIDER_SHOT_ANGULAR_RADIUS_DEG_RANGE_V3,
      azimuthDegRange: [0, 360],
      distanceURange: [SPIDER_SHOT_DISTANCE_U_V3, SPIDER_SHOT_DISTANCE_U_V3],
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

export const spiderShotV3Binding = {
  id: SPIDER_SHOT_V3_DRILL_ID,
  sceneId: SPIDER_SHOT_V3_SCENE_ID,
} as const;
