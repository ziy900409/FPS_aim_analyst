import { describe, expect, it } from 'vitest';
import { PLAYER_EYE_HEIGHT_U } from '../../sim/playerEye.ts';
import { SPIDER_WIDE_EYE_ORIGIN } from '../../sim/spiderEyeFrame.ts';
import { resolveSpiderShotWideV1, spiderShotWideV1Binding } from '../../drill/spider_shot_wide_v1.ts';
import { CAMERA_STANDOFF, resolveEyeWorldBase } from '../eyePose.ts';
import { CLEARANCE_MARGIN_U, formatClearanceViolations, validateClearance } from '../clearance.ts';
import { wideFlickArena } from './wide-flick-arena.ts';

/**
 * WP-57 / T3 —— arena config 本體的契約（README §2.5.2）。落點對牆／地板的逐列幾何斷言在
 * `tests/regression/spider-wide-arena-geometry.test.ts`，本檔只釘 config 欄位與 scene↔drill 綁定。
 */

const room = wideFlickArena.proceduralRoom!;

describe('wide-flick-arena SceneConfig', () => {
  it('通過 validateScene(模組載入即自驗)且為零道具的純 procedural 場景', () => {
    expect(wideFlickArena.sceneId).toBe('wide-flick-arena');
    expect(wideFlickArena.assetPackVersion).toBe('wide-flick-arena-v1');
    expect(wideFlickArena.clutterTier).toBe('low');
    // 零 props ⇒ KI-011 天然滿足、GD-9 不適用（無外部資產可授權）。
    expect(wideFlickArena.asset).toBeNull();
    expect(wideFlickArena.propBounds).toEqual([]);
  });

  it('roomSize 為 README §2.5.2 更正後的 [18, 20, 4]', () => {
    expect(room.roomSize).toEqual([18, 20, 4]);
  });

  it('eyeZ 明確為 0,而非 depth/2 − CAMERA_STANDOFF 的 fallback', () => {
    expect(room.eyeZ).toBe(0);
    // fallback 會是 9；若日後有人刪掉 eyeZ，這一條會連同 eye anchor 斷言一起紅燈。
    expect(room.roomSize[1] / 2 - CAMERA_STANDOFF).toBe(9);
  });

  it('floorY 省略 ⇒ 地板逐位維持 y = 0（KI-014;resolver 的 pitch 上界以此為前提）', () => {
    expect(room.floorY).toBeUndefined();
  });

  it('eyeHeight === PLAYER_EYE_HEIGHT_U（GD-6：sim 常數與 scene config 不得脫鉤）', () => {
    expect(room.eyeHeight).toBe(PLAYER_EYE_HEIGHT_U);
  });

  it('推導出的 eye world base 與 sim 側的 eye 原點逐位相同', () => {
    const eye = resolveEyeWorldBase(wideFlickArena);
    expect(eye.x).toBe(SPIDER_WIDE_EYE_ORIGIN.x);
    expect(eye.y).toBe(SPIDER_WIDE_EYE_ORIGIN.y);
    expect(eye.z).toBe(SPIDER_WIDE_EYE_ORIGIN.z);
  });

  it('T1 宣告的 scene binding 指向本 arena', () => {
    expect(spiderShotWideV1Binding.sceneId).toBe(wideFlickArena.sceneId);
  });

  it('房間半寬與縱深滿足 §2.5.2 的兩個上界需求', () => {
    // 最壞側向落點 7.5322（FOV 120、pitch 0）+ 目標半徑 0.139641 + CLEARANCE_MARGIN_U。
    expect(room.roomSize[0] / 2).toBeGreaterThanOrEqual(8.1719);
    // 中心目標在 z = −8，後牆必須在它之後（KI-012：牆比目標更近會全遮但命中仍過）。
    expect(room.roomSize[1]).toBeGreaterThanOrEqual(17.28);
    expect(CLEARANCE_MARGIN_U).toBe(0.5);
  });

  it('validateClearance 對 arena × 已解析的 wide drill 零違規（無 props 可違規）', () => {
    for (const fovDegVertical of [60, 75, 90, 120]) {
      const drill = resolveSpiderShotWideV1(fovDegVertical, 16 / 9);
      const violations = validateClearance(wideFlickArena, drill);
      expect(violations, formatClearanceViolations(violations)).toEqual([]);
    }
  });
});
