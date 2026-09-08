import type { DrillConfig } from './DrillConfig.ts';

export const MICRO_FLICK_THREE_TARGET_TEST_V3_DRILL_ID = 'micro_flick_three_target_test_v3' as const;
export const MICRO_FLICK_ROOM_V3_SCENE_ID = 'micro-flick-room-v3' as const;
export const MICRO_FLICK_V3_TARGET_DISTANCE_U = 21;
/** Maintain v1's 3° apparent target diameter at v3's reference distance. */
export const MICRO_FLICK_V3_TARGET_DIAMETER_U = 2 * MICRO_FLICK_V3_TARGET_DISTANCE_U * Math.tan((1.5 * Math.PI) / 180);

export interface MicroFlickThreeTargetTestV3Config {
  readonly id: typeof MICRO_FLICK_THREE_TARGET_TEST_V3_DRILL_ID;
  readonly sceneId: typeof MICRO_FLICK_ROOM_V3_SCENE_ID;
  readonly drill: DrillConfig;
}

/** Researcher-only practice variant: targets at 20–22u in a 52u corridor. */
export const microFlickThreeTargetTestV3: MicroFlickThreeTargetTestV3Config = {
  id: MICRO_FLICK_THREE_TARGET_TEST_V3_DRILL_ID,
  sceneId: MICRO_FLICK_ROOM_V3_SCENE_ID,
  drill: {
    drillId: MICRO_FLICK_THREE_TARGET_TEST_V3_DRILL_ID,
    mode: 'practice',
    playerControl: { translation: 'locked' },
    targets: {
      count: 60,
      distance: MICRO_FLICK_V3_TARGET_DISTANCE_U,
      hitbox: {
        widthU: MICRO_FLICK_V3_TARGET_DIAMETER_U,
        heightU: MICRO_FLICK_V3_TARGET_DIAMETER_U,
        depthU: MICRO_FLICK_V3_TARGET_DIAMETER_U,
        shape: 'sphere',
      },
      population: { activeCount: 3, replacement: 'next-tick' },
      spawnArea: {
        yawDegRange: [-22, 22],
        pitchDegRange: [-12, 12],
        distanceURange: [20, 22],
        minAngularSeparationDeg: 7,
      },
    },
    sequence: { alternation: 'LR', seed: 56003 },
    timing: { countdownMs: 3000 },
    endCondition: { type: 'targetCount', value: 60 },
  },
};
