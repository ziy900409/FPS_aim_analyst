import type { DrillConfig } from './DrillConfig.ts';

export const MICRO_FLICK_THREE_TARGET_TEST_V5_DRILL_ID = 'micro_flick_three_target_test_v5' as const;
export const MICRO_FLICK_ROOM_V5_SCENE_ID = 'micro-flick-room-v5' as const;
export const MICRO_FLICK_V5_TARGET_DISTANCE_U = 25;
/**
 * Reference-image calibration: with a 12u-high end wall at 30u, a 1.5u target at 25u
 * projects to 15% of the wall height (the measured red-sphere/end-wall ratio).
 */
export const MICRO_FLICK_V5_TARGET_DIAMETER_U = 1.5;

export interface MicroFlickThreeTargetTestV5Config {
  readonly id: typeof MICRO_FLICK_THREE_TARGET_TEST_V5_DRILL_ID;
  readonly sceneId: typeof MICRO_FLICK_ROOM_V5_SCENE_ID;
  readonly drill: DrillConfig;
}

/** Researcher-only reference-image calibration: 12.9u × 12u end wall and 24–26u targets. */
export const microFlickThreeTargetTestV5: MicroFlickThreeTargetTestV5Config = {
  id: MICRO_FLICK_THREE_TARGET_TEST_V5_DRILL_ID,
  sceneId: MICRO_FLICK_ROOM_V5_SCENE_ID,
  drill: {
    drillId: MICRO_FLICK_THREE_TARGET_TEST_V5_DRILL_ID,
    mode: 'practice',
    playerControl: { translation: 'locked' },
    targets: {
      count: 60,
      distance: MICRO_FLICK_V5_TARGET_DISTANCE_U,
      hitbox: {
        widthU: MICRO_FLICK_V5_TARGET_DIAMETER_U,
        heightU: MICRO_FLICK_V5_TARGET_DIAMETER_U,
        depthU: MICRO_FLICK_V5_TARGET_DIAMETER_U,
        shape: 'sphere',
      },
      population: { activeCount: 3, replacement: 'next-tick' },
      // Narrowed so the reference-width end wall contains the complete three-target field.
      spawnArea: {
        yawDegRange: [-10, 10],
        pitchDegRange: [-8, 8],
        distanceURange: [24, 26],
        minAngularSeparationDeg: 7,
      },
    },
    sequence: { alternation: 'LR', seed: 56005 },
    timing: { countdownMs: 3000 },
    endCondition: { type: 'targetCount', value: 60 },
  },
};
