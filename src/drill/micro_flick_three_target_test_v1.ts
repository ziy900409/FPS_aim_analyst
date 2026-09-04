import type { DrillConfig } from './DrillConfig.ts';

export const MICRO_FLICK_THREE_TARGET_TEST_DRILL_ID = 'micro_flick_three_target_test_v1' as const;
export const MICRO_FLICK_ROOM_SCENE_ID = 'micro-flick-room' as const;
export const MICRO_FLICK_TARGET_DIAMETER_U = 2 * 13 * Math.tan((1.5 * Math.PI) / 180);

export interface MicroFlickThreeTargetTestConfig {
  readonly id: typeof MICRO_FLICK_THREE_TARGET_TEST_DRILL_ID;
  readonly sceneId: typeof MICRO_FLICK_ROOM_SCENE_ID;
  readonly drill: DrillConfig;
}

/**
 * WP-56 T1 researcher-only Practice fixture. The scene binding is declared here, while the T3
 * scene/presentation slice owns registering and rendering the actual corridor asset.
 */
export const microFlickThreeTargetTestV1: MicroFlickThreeTargetTestConfig = {
  id: MICRO_FLICK_THREE_TARGET_TEST_DRILL_ID,
  sceneId: MICRO_FLICK_ROOM_SCENE_ID,
  drill: {
    drillId: MICRO_FLICK_THREE_TARGET_TEST_DRILL_ID,
    mode: 'practice',
    playerControl: { translation: 'locked' },
    targets: {
      count: 60,
      distance: 13,
      hitbox: {
        widthU: MICRO_FLICK_TARGET_DIAMETER_U,
        heightU: MICRO_FLICK_TARGET_DIAMETER_U,
        depthU: MICRO_FLICK_TARGET_DIAMETER_U,
        shape: 'sphere',
      },
      population: { activeCount: 3, replacement: 'next-tick' },
      spawnArea: {
        yawDegRange: [-22, 22],
        pitchDegRange: [-12, 12],
        distanceURange: [12, 14],
        minAngularSeparationDeg: 7,
      },
    },
    sequence: { alternation: 'LR', seed: 56001 },
    timing: { countdownMs: 3000 },
    endCondition: { type: 'targetCount', value: 60 },
  },
};
