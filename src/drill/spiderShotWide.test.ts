import { describe, expect, it } from 'vitest';
import { PLAYER_EYE_HEIGHT_U } from '../sim/playerEye.ts';
import { spiderWideEyePos } from '../sim/spiderEyeFrame.ts';
import {
  SPIDER_WIDE_DISTANCE_U,
  SPIDER_WIDE_FLOOR_CLEARANCE_U,
  SPIDER_WIDE_HITBOX_DIAMETER_U,
  SPIDER_WIDE_PITCH_MAG_DEG,
  SPIDER_WIDE_SCREEN_MARGIN,
  SPIDER_WIDE_TARGET_ANGULAR_DIAMETER_DEG,
  SPIDER_WIDE_YAW_EDGE_FACTOR,
  SpiderWideResolveError,
  resolveSpiderWideYawPitch,
  spiderWideResolveInput,
} from './spiderShotWide.ts';

const DEG_TO_RAD = Math.PI / 180;

describe('WP-57 T1 — 凍結常數（README §1.5，OQ-57.1／57.2）', () => {
  it('距離/角徑/hitbox 沿用 v2 血緣，hitbox 由角徑與距離反推（GD-7 單一來源）', () => {
    expect(SPIDER_WIDE_DISTANCE_U).toBe(8);
    expect(SPIDER_WIDE_TARGET_ANGULAR_DIAMETER_DEG).toBe(2.0);
    expect(SPIDER_WIDE_HITBOX_DIAMETER_U).toBeCloseTo(0.279281, 6);
    expect(SPIDER_WIDE_HITBOX_DIAMETER_U).toBe(2 * 8 * Math.tan(1 * DEG_TO_RAD));
  });

  it('screenMargin / kLo / pitch 窗 / 地板淨空為 T0 凍結值', () => {
    expect(SPIDER_WIDE_SCREEN_MARGIN).toBe(0.04);
    expect(SPIDER_WIDE_YAW_EDGE_FACTOR).toBe(0.92);
    expect(SPIDER_WIDE_PITCH_MAG_DEG).toBe(6.5);
    expect(SPIDER_WIDE_FLOOR_CLEARANCE_U).toBe(0.5);
  });

  it('resolve input 只讓 FOV/aspect 由顯示狀態決定，眼高取 sim 側唯一常數（GD-6）', () => {
    expect(spiderWideResolveInput(75, 16 / 9)).toEqual({
      fovDegVertical: 75,
      aspect: 16 / 9,
      distanceU: SPIDER_WIDE_DISTANCE_U,
      hitboxDiameterU: SPIDER_WIDE_HITBOX_DIAMETER_U,
      screenMargin: SPIDER_WIDE_SCREEN_MARGIN,
      kLo: SPIDER_WIDE_YAW_EDGE_FACTOR,
      eyeHeightU: PLAYER_EYE_HEIGHT_U,
      floorClearanceU: SPIDER_WIDE_FLOOR_CLEARANCE_U,
    });
  });
});

describe('WP-57 T1 — resolveSpiderWideYawPitch（FR-57.3；README §2.4／T0 PoC A）', () => {
  it('16:9 的四個 FOV 檔位輸出與 README §2.4 表格逐位相符', () => {
    const expected: readonly (readonly [number, number, number, number])[] = [
      // fovDeg, yawMax, yawMin(= kLo·yawMax), 側向 abs(x) at yawMax
      [60, 43.5771, 40.0909, 5.5146],
      [75, 51.6343, 47.5036, 6.2725],
      [90, 58.6324, 53.9418, 6.8308],
      [120, 70.3098, 64.685, 7.5322],
    ];
    for (const [fovDeg, yawMax, yawMin, lateralU] of expected) {
      const resolved = resolveSpiderWideYawPitch(spiderWideResolveInput(fovDeg, 16 / 9));
      expect(resolved.yawMagDegRange[1]).toBeCloseTo(yawMax, 4);
      expect(resolved.yawMagDegRange[0]).toBeCloseTo(yawMin, 4);
      expect(spiderWideEyePos(resolved.yawMagDegRange[1], 0, SPIDER_WIDE_DISTANCE_U).x).toBeCloseTo(lateralU, 4);
    }
  });

  it('T0 的 21:9／4:3 兩組：yawMax 對 aspect 單調遞增（OQ-57.6 的量化依據）', () => {
    const narrow = resolveSpiderWideYawPitch(spiderWideResolveInput(75, 4 / 3));
    const wide = resolveSpiderWideYawPitch(spiderWideResolveInput(75, 21 / 9));
    expect(narrow.yawMagDegRange[1]).toBeCloseTo(43.485, 3);
    expect(wide.yawMagDegRange[1]).toBeCloseTo(58.809, 3);

    const sixteenNine = resolveSpiderWideYawPitch(spiderWideResolveInput(75, 16 / 9)).yawMagDegRange[1];
    expect(narrow.yawMagDegRange[1]).toBeLessThan(sixteenNine);
    expect(sixteenNine).toBeLessThan(wide.yawMagDegRange[1]);
    // 同 FOV 下 4:3 與 21:9 相差 > 15°，遠大於任何合理的合併容差。
    expect(wide.yawMagDegRange[1] - narrow.yawMagDegRange[1]).toBeGreaterThan(15);
  });

  it('yawMax 對 FOV 單調遞增，且四個檔位都落在 schema 的 (0, 90) 內', () => {
    let previous = 0;
    for (const fovDeg of [60, 75, 90, 120]) {
      const yawMax = resolveSpiderWideYawPitch(spiderWideResolveInput(fovDeg, 21 / 9)).yawMagDegRange[1];
      expect(yawMax).toBeGreaterThan(previous);
      expect(yawMax).toBeLessThan(90);
      previous = yawMax;
    }
  });

  it('pitch 窗恆為凍結的 ±6.5°，地板淨空硬上界為 6.8947°（餘裕 0.395°，非硬貼邊界）', () => {
    const resolved = resolveSpiderWideYawPitch(spiderWideResolveInput(120, 16 / 9));
    expect(resolved.pitchDegRange).toEqual([-6.5, 6.5]);
    expect(resolved.pitchLimitDeg).toBeCloseTo(6.8947, 4);
    expect(resolved.pitchLimitDeg - SPIDER_WIDE_PITCH_MAG_DEG).toBeCloseTo(0.3947, 4);
  });

  it('pitch 窗與 FOV/aspect 無關（地板淨空推導，不是視野推導）', () => {
    const a = resolveSpiderWideYawPitch(spiderWideResolveInput(60, 4 / 3));
    const b = resolveSpiderWideYawPitch(spiderWideResolveInput(120, 21 / 9));
    expect(a.pitchDegRange).toEqual(b.pitchDegRange);
    expect(a.pitchLimitDeg).toBe(b.pitchLimitDeg);
  });

  it('地板淨空 0 / 0.25 / 0.5 三列與 T0 PoC C 實測相符（asin 球面而非 atan 圓柱）', () => {
    const limitFor = (floorClearanceU: number): number =>
      resolveSpiderWideYawPitch({ ...spiderWideResolveInput(75, 16 / 9), floorClearanceU }).pitchLimitDeg;
    expect(limitFor(0)).toBeCloseTo(10.518, 3);
    expect(limitFor(0.25)).toBeCloseTo(8.702, 3);
    expect(limitFor(0.5)).toBeCloseTo(6.8947, 4);
    // 圓柱參數化會給出不同的（且不適用的）數字——這正是 §0 item 4 明確不沿用的那一套。
    expect((Math.atan(PLAYER_EYE_HEIGHT_U / 8) / DEG_TO_RAD).toFixed(2)).toBe('11.31');
    expect((Math.asin(PLAYER_EYE_HEIGHT_U / 8) / DEG_TO_RAD).toFixed(4)).toBe('11.5370');
  });

  it('外緣 ndc_x 是 tight-by-construction：yawMax + r 恰好等於 1 − screenMargin', () => {
    for (const fovDeg of [60, 75, 90, 120]) {
      const input = spiderWideResolveInput(fovDeg, 16 / 9);
      const yawMax = resolveSpiderWideYawPitch(input).yawMagDegRange[1];
      const rDeg = Math.atan(SPIDER_WIDE_HITBOX_DIAMETER_U / 2 / SPIDER_WIDE_DISTANCE_U) / DEG_TO_RAD;
      const halfHFovRad = Math.atan(Math.tan((fovDeg / 2) * DEG_TO_RAD) * (16 / 9));
      const outerNdcX = Math.tan((yawMax + rDeg) * DEG_TO_RAD) / Math.tan(halfHFovRad);
      expect(outerNdcX).toBeCloseTo(1 - SPIDER_WIDE_SCREEN_MARGIN, 12);
    }
  });
});

describe('WP-57 T1 — resolver typed errors（FR-57.14：fail fast，不回退預設值）', () => {
  const valid = spiderWideResolveInput(75, 16 / 9);

  const cases: readonly (readonly [string, Partial<typeof valid>, string])[] = [
    ['非有限 FOV', { fovDegVertical: Number.NaN }, 'fovDegVertical'],
    ['無限大 FOV', { fovDegVertical: Number.POSITIVE_INFINITY }, 'fovDegVertical'],
    ['非正 FOV', { fovDegVertical: 0 }, 'fovDegVertical'],
    ['負 FOV', { fovDegVertical: -75 }, 'fovDegVertical'],
    ['FOV ≥ 180（透視奇異）', { fovDegVertical: 180 }, 'fovDegVertical'],
    ['aspect = 0', { aspect: 0 }, 'aspect'],
    ['aspect < 0', { aspect: -1.777 }, 'aspect'],
    ['非有限 aspect', { aspect: Number.NaN }, 'aspect'],
    ['distanceU 非正', { distanceU: 0 }, 'distanceU'],
    ['hitboxDiameterU 非正', { hitboxDiameterU: 0 }, 'hitboxDiameterU'],
    ['screenMargin ≥ 1', { screenMargin: 1 }, 'screenMargin'],
    ['screenMargin < 0', { screenMargin: -0.01 }, 'screenMargin'],
    ['非有限 screenMargin', { screenMargin: Number.NaN }, 'screenMargin'],
    ['kLo = 0', { kLo: 0 }, 'kLo'],
    ['kLo > 1（反轉區間）', { kLo: 1.2 }, 'kLo'],
    ['kLo = 1（退化區間）', { kLo: 1 }, 'yawMagDegRange'],
    ['eyeHeightU 非正', { eyeHeightU: 0 }, 'eyeHeightU'],
    ['floorClearanceU 為負', { floorClearanceU: -0.1 }, 'floorClearanceU'],
    ['floorClearanceU 使目標埋入地板', { floorClearanceU: 1.6 }, 'floorClearanceU'],
    ['眼高不足以容納 hitbox 與淨空', { eyeHeightU: 0.5 }, 'floorClearanceU'],
    ['pitch 窗超過地板淨空上界', { floorClearanceU: 0.7 }, 'pitchDegRange'],
    ['目標角徑吃掉整個可用視野', { hitboxDiameterU: 400, distanceU: 1 }, 'yawMagDegRange'],
  ];

  for (const [label, patch, field] of cases) {
    it(`${label} → SpiderWideResolveError(field=${field})`, () => {
      let thrown: unknown;
      try {
        resolveSpiderWideYawPitch({ ...valid, ...patch });
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(SpiderWideResolveError);
      expect((thrown as SpiderWideResolveError).field).toBe(field);
    });
  }

  it('合法輸入不 throw（負向矩陣不是靠全部拒收通過的）', () => {
    for (const fovDeg of [60, 75, 90, 120]) {
      for (const aspect of [16 / 9, 21 / 9, 4 / 3]) {
        expect(() => resolveSpiderWideYawPitch(spiderWideResolveInput(fovDeg, aspect))).not.toThrow();
      }
    }
  });
});
