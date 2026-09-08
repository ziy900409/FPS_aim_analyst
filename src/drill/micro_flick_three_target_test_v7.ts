import type { DrillConfig } from './DrillConfig.ts';
export const MICRO_FLICK_THREE_TARGET_TEST_V7_DRILL_ID = 'micro_flick_three_target_test_v7' as const;
export const MICRO_FLICK_ROOM_V7_SCENE_ID = 'micro-flick-room-v7' as const;
/** v6 ball is deliberately unchanged; only the end wall is 20% smaller. */
export const MICRO_FLICK_V7_TARGET_DIAMETER_U = 1.275;
export const microFlickThreeTargetTestV7 = {
  id: MICRO_FLICK_THREE_TARGET_TEST_V7_DRILL_ID, sceneId: MICRO_FLICK_ROOM_V7_SCENE_ID,
  drill: { drillId: MICRO_FLICK_THREE_TARGET_TEST_V7_DRILL_ID, mode: 'practice' as const, playerControl: { translation: 'locked' as const },
    targets: { count: 60, distance: 25, hitbox: { widthU: MICRO_FLICK_V7_TARGET_DIAMETER_U, heightU: MICRO_FLICK_V7_TARGET_DIAMETER_U, depthU: MICRO_FLICK_V7_TARGET_DIAMETER_U, shape: 'sphere' as const }, population: { activeCount: 3, replacement: 'next-tick' as const }, spawnArea: { yawDegRange: [-6.5, 6.5] as [number, number], pitchDegRange: [-5, 6] as [number, number], distanceURange: [24, 26] as [number, number], minAngularSeparationDeg: 7 } },
    sequence: { alternation: 'LR' as const, seed: 56007 }, timing: { countdownMs: 3000 }, endCondition: { type: 'targetCount' as const, value: 60 },
  } satisfies DrillConfig,
} as const;
