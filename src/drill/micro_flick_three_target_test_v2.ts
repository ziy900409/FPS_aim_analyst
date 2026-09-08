import type { DrillConfig } from './DrillConfig.ts';

export const MICRO_FLICK_THREE_TARGET_TEST_V2_DRILL_ID = 'micro_flick_three_target_test_v2' as const;
export const MICRO_FLICK_ROOM_V2_SCENE_ID = 'micro-flick-room-v2' as const;
export const MICRO_FLICK_V2_TARGET_DISTANCE_U = 17;
/** Maintain v1's 3° apparent target diameter at v2's reference distance. */
export const MICRO_FLICK_V2_TARGET_DIAMETER_U = 2 * MICRO_FLICK_V2_TARGET_DISTANCE_U * Math.tan((1.5 * Math.PI) / 180);

export interface MicroFlickThreeTargetTestV2Config {
  readonly id: typeof MICRO_FLICK_THREE_TARGET_TEST_V2_DRILL_ID;
  readonly sceneId: typeof MICRO_FLICK_ROOM_V2_SCENE_ID;
  readonly drill: DrillConfig;
}

/** Researcher-only practice variant: targets at 16–18u in a 44u corridor. */
export const microFlickThreeTargetTestV2: MicroFlickThreeTargetTestV2Config = {
  id: MICRO_FLICK_THREE_TARGET_TEST_V2_DRILL_ID,
  sceneId: MICRO_FLICK_ROOM_V2_SCENE_ID,
  drill: {
    drillId: MICRO_FLICK_THREE_TARGET_TEST_V2_DRILL_ID,
    mode: 'practice',
    playerControl: { translation: 'locked' },
    targets: {
      count: 60,
      distance: MICRO_FLICK_V2_TARGET_DISTANCE_U,
      hitbox: {
        widthU: MICRO_FLICK_V2_TARGET_DIAMETER_U,
        heightU: MICRO_FLICK_V2_TARGET_DIAMETER_U,
        depthU: MICRO_FLICK_V2_TARGET_DIAMETER_U,
        shape: 'sphere',
      },
      population: { activeCount: 3, replacement: 'next-tick' },
      spawnArea: {
        yawDegRange: [-22, 22],
        pitchDegRange: [-12, 12],
        distanceURange: [16, 18],
        minAngularSeparationDeg: 7,
      },
    },
    sequence: { alternation: 'LR', seed: 56002 },
    timing: { countdownMs: 3000 },
    endCondition: { type: 'targetCount', value: 60 },
  },
};
