import type { DrillConfig } from './DrillConfig.ts';
export const MICRO_FLICK_THREE_TARGET_TEST_V8_DRILL_ID = 'micro_flick_three_target_test_v8' as const;
export const MICRO_FLICK_ROOM_V8_SCENE_ID = 'micro-flick-room-v8' as const;
/** v7 sphere reduced by 15%; WP-59 retunes only population spacing inside the unchanged v8 field. */
export const MICRO_FLICK_V8_TARGET_DIAMETER_U = 1.08375;
export const microFlickThreeTargetTestV8 = {
  id: MICRO_FLICK_THREE_TARGET_TEST_V8_DRILL_ID, sceneId: MICRO_FLICK_ROOM_V8_SCENE_ID,
  // WP-63 / T1：v8 的命中與否必須是開火瞬間角誤差的純函式。無 `weaponId` 時會吃 `main.ts` 的預設
  // `ak47`（有 punch、有散布、右鍵縮 FOV），與 micro-flick 指標設計要求的「hitscan、零散布、零後座」
  // 直接矛盾。`usp_s_laser` 的 recoil 全 0、inaccuracy 四項全 0、且無 `ads` 區塊，且零 inaccuracy 讓
  // `sampleSpread()` 早退而不消耗 spread RNG（NFR-63.7）。斷代靠匯出的 `meta.weaponId`。
  drill: { drillId: MICRO_FLICK_THREE_TARGET_TEST_V8_DRILL_ID, mode: 'practice' as const, weaponId: 'usp_s_laser', playerControl: { translation: 'locked' as const },
    targets: { count: 60, distance: 25, hitbox: { widthU: MICRO_FLICK_V8_TARGET_DIAMETER_U, heightU: MICRO_FLICK_V8_TARGET_DIAMETER_U, depthU: MICRO_FLICK_V8_TARGET_DIAMETER_U, shape: 'sphere' as const }, population: { activeCount: 3, replacement: 'next-tick' as const }, spawnArea: { yawDegRange: [-6.5, 6.5] as [number, number], pitchDegRange: [-5, 6] as [number, number], distanceURange: [24, 26] as [number, number], minAngularSeparationDeg: 5, preferredReplacementSeparationDeg: 2.6 } },
    sequence: { alternation: 'LR' as const, seed: 56008 }, timing: { countdownMs: 3000 }, endCondition: { type: 'targetCount' as const, value: 60 },
  } satisfies DrillConfig,
} as const;
