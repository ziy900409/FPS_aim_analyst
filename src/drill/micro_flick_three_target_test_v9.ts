import type { DrillConfig } from './DrillConfig.ts';
import { MICRO_FLICK_V8_TARGET_DIAMETER_U } from './micro_flick_three_target_test_v8.ts';
export const MICRO_FLICK_THREE_TARGET_TEST_V9_DRILL_ID = 'micro_flick_three_target_test_v9' as const;
export const MICRO_FLICK_ROOM_V9_SCENE_ID = 'micro-flick-room-v9' as const;
/** v8 sphere reduced by a further 10%; derived from v8 so the two can never drift apart. */
export const MICRO_FLICK_V9_TARGET_DIAMETER_U = MICRO_FLICK_V8_TARGET_DIAMETER_U * 0.9;
/** v9 is scored by the clock, not by a kill budget: 60 s from the end of the countdown. */
export const MICRO_FLICK_V9_TIME_LIMIT_MS = 60000;
export const microFlickThreeTargetTestV9 = {
  id: MICRO_FLICK_THREE_TARGET_TEST_V9_DRILL_ID, sceneId: MICRO_FLICK_ROOM_V9_SCENE_ID,
  drill: { drillId: MICRO_FLICK_THREE_TARGET_TEST_V9_DRILL_ID, mode: 'practice' as const, playerControl: { translation: 'locked' as const },
    // `count` is a spawn safety ceiling only (10 kills/s for the full 60 s); the time limit ends the run.
    targets: { count: 600, distance: 25, hitbox: { widthU: MICRO_FLICK_V9_TARGET_DIAMETER_U, heightU: MICRO_FLICK_V9_TARGET_DIAMETER_U, depthU: MICRO_FLICK_V9_TARGET_DIAMETER_U, shape: 'sphere' as const }, population: { activeCount: 3, replacement: 'next-tick' as const }, spawnArea: { yawDegRange: [-6.5, 6.5] as [number, number], pitchDegRange: [-5, 6] as [number, number], distanceURange: [24, 26] as [number, number], minAngularSeparationDeg: 5, preferredReplacementSeparationDeg: 2.6 } },
    sequence: { alternation: 'LR' as const, seed: 56009 }, timing: { countdownMs: 3000 }, endCondition: { type: 'timeLimit' as const, value: MICRO_FLICK_V9_TIME_LIMIT_MS },
  } satisfies DrillConfig,
} as const;
