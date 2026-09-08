import type { DrillConfig } from './DrillConfig.ts';

export const MICRO_FLICK_THREE_TARGET_TEST_V6_DRILL_ID = 'micro_flick_three_target_test_v6' as const;
export const MICRO_FLICK_ROOM_V6_SCENE_ID = 'micro-flick-room-v6' as const;
export const MICRO_FLICK_V6_TARGET_DISTANCE_U = 25;
/** v5 reference-calibrated sphere reduced by 15%. */
export const MICRO_FLICK_V6_TARGET_DIAMETER_U = 1.275;

export const microFlickThreeTargetTestV6 = {
  id: MICRO_FLICK_THREE_TARGET_TEST_V6_DRILL_ID,
  sceneId: MICRO_FLICK_ROOM_V6_SCENE_ID,
  drill: {
    drillId: MICRO_FLICK_THREE_TARGET_TEST_V6_DRILL_ID,
    mode: 'practice' as const,
    playerControl: { translation: 'locked' as const },
    targets: {
      count: 60,
      distance: MICRO_FLICK_V6_TARGET_DISTANCE_U,
      hitbox: { widthU: MICRO_FLICK_V6_TARGET_DIAMETER_U, heightU: MICRO_FLICK_V6_TARGET_DIAMETER_U, depthU: MICRO_FLICK_V6_TARGET_DIAMETER_U, shape: 'sphere' as const },
      population: { activeCount: 3, replacement: 'next-tick' as const },
      spawnArea: { yawDegRange: [-8.5, 8.5] as [number, number], pitchDegRange: [-8, 8] as [number, number], distanceURange: [24, 26] as [number, number], minAngularSeparationDeg: 7 },
    },
    sequence: { alternation: 'LR' as const, seed: 56006 },
    timing: { countdownMs: 3000 },
    endCondition: { type: 'targetCount' as const, value: 60 },
  } satisfies DrillConfig,
} as const;
