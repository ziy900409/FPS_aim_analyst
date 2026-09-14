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
  // WP-68 / T1：v9 與 v8 共用同一套 micro-flick 指標族，前提同樣是「命中與否 = 開火瞬間角誤差的
  // 純函式」。無 `weaponId` 時 v9 吃 `main.ts` 的預設 `ak47`（有 punch、有散布、右鍵縮 FOV）——
  // 實測 33/33 發帶散布、32/33 發帶 punch，且需要「擊殺→擊殺」轉移的兩層指標整個算不出來。
  // `usp_s_laser` 的 recoil 全 0、inaccuracy 四項全 0、且無 `ads` 區塊，零 inaccuracy 讓
  // `sampleSpread()` 早退而不消耗 spread RNG（NFR-68.2）。斷代靠匯出的 `meta.weaponId`；與 v8
  // 同一把 ⇒ 兩者自此只能以 `meta.drillId` 分池。副作用：cycletime 0.10 → 0.17 s、magSize 30 → 12，
  // 而 v9 的鐘不因失手而停 ⇒ 空倉旗標的觸發率高於 v8（OQ-68.4）。
  drill: { drillId: MICRO_FLICK_THREE_TARGET_TEST_V9_DRILL_ID, mode: 'practice' as const, weaponId: 'usp_s_laser', playerControl: { translation: 'locked' as const },
    // `count` is a spawn safety ceiling only (10 kills/s for the full 60 s); the time limit ends the run.
    targets: { count: 600, distance: 25, hitbox: { widthU: MICRO_FLICK_V9_TARGET_DIAMETER_U, heightU: MICRO_FLICK_V9_TARGET_DIAMETER_U, depthU: MICRO_FLICK_V9_TARGET_DIAMETER_U, shape: 'sphere' as const }, population: { activeCount: 3, replacement: 'next-tick' as const }, spawnArea: { yawDegRange: [-6.5, 6.5] as [number, number], pitchDegRange: [-5, 6] as [number, number], distanceURange: [24, 26] as [number, number], minAngularSeparationDeg: 5, preferredReplacementSeparationDeg: 2.6 } },
    sequence: { alternation: 'LR' as const, seed: 56009 }, timing: { countdownMs: 3000 }, endCondition: { type: 'timeLimit' as const, value: MICRO_FLICK_V9_TIME_LIMIT_MS },
  } satisfies DrillConfig,
} as const;
