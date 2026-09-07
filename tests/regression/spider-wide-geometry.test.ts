import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRan1 } from '../../src/recoil/rng.ts';
import {
  SPIDER_WIDE_EYE_ORIGIN,
  ndcForEyeAngles,
  spiderWideEyePos,
} from '../../src/sim/spiderEyeFrame.ts';
import {
  SPIDER_WIDE_DISTANCE_U,
  SPIDER_WIDE_HITBOX_DIAMETER_U,
  SPIDER_WIDE_SCREEN_MARGIN,
  resolveSpiderWideYawPitch,
  spiderWideResolveInput,
} from '../../src/drill/spiderShotWide.ts';

/**
 * WP-57 / T1 —— NFR-57.3（角徑恆定）、NFR-57.4（on-screen）、NFR-57.6（純函式邊界）。
 *
 * 取樣一律走 `createRan1(seed)`（GD-5），不用 `Math.random()`：同一 seed 的樣本序列在 CI 與本機
 * 逐位一致，紅燈可重現。本檔只測**幾何純函式**——`TargetManager` 的 spawn 分支屬 T2。
 */

const DEG_TO_RAD = Math.PI / 180;
const SAMPLES_PER_COMBINATION = 10_000;
const FOV_DEG_LEVELS = [60, 75, 90, 120] as const;
const ASPECTS = [16 / 9, 21 / 9, 4 / 3] as const;
/** FR-57.4 的 `ndc_x` 上界是 tight-by-construction（見 README §2.4 PoC B），故必須帶浮點容差。 */
const NDC_EPSILON = 1e-9;

const TARGET_ANGULAR_RADIUS_DEG =
  Math.atan(SPIDER_WIDE_HITBOX_DIAMETER_U / 2 / SPIDER_WIDE_DISTANCE_U) / DEG_TO_RAD;

function eyeDistance(pos: { x: number; y: number; z: number }): number {
  const dx = pos.x - SPIDER_WIDE_EYE_ORIGIN.x;
  const dy = pos.y - SPIDER_WIDE_EYE_ORIGIN.y;
  const dz = pos.z - SPIDER_WIDE_EYE_ORIGIN.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

describe('WP-57 T1 — NFR-57.3：角徑恆定（≥ 10,000 seeded spawn）', () => {
  it('|pos − eye| 對每個落點的相對誤差 ≤ 1e-12', () => {
    const rng = createRan1(57003);
    const { yawMagDegRange, pitchDegRange } = resolveSpiderWideYawPitch(spiderWideResolveInput(120, 21 / 9));
    let worstRelativeError = 0;

    for (let i = 0; i < SAMPLES_PER_COMBINATION; i++) {
      const yawMagDeg = yawMagDegRange[0] + rng() * (yawMagDegRange[1] - yawMagDegRange[0]);
      const side = rng() < 0.5 ? -1 : 1;
      const pitchDeg = pitchDegRange[0] + rng() * (pitchDegRange[1] - pitchDegRange[0]);
      const pos = spiderWideEyePos(side * yawMagDeg, pitchDeg, SPIDER_WIDE_DISTANCE_U);
      const relativeError = Math.abs(eyeDistance(pos) - SPIDER_WIDE_DISTANCE_U) / SPIDER_WIDE_DISTANCE_U;
      if (relativeError > worstRelativeError) worstRelativeError = relativeError;
    }

    expect(worstRelativeError).toBeLessThanOrEqual(1e-12);
  });
});

describe('WP-57 T1 — NFR-57.4：on-screen（4 FOV × 3 aspect × 10,000 樣本，失敗數 0）', () => {
  it('每個落點的目標外緣都滿足兩條 NDC 不等式', () => {
    const bound = 1 - SPIDER_WIDE_SCREEN_MARGIN;
    let failures = 0;
    let worstNdcX = 0;
    let worstNdcY = 0;

    for (const fovDegVertical of FOV_DEG_LEVELS) {
      for (const aspect of ASPECTS) {
        const { yawMagDegRange, pitchDegRange } = resolveSpiderWideYawPitch(
          spiderWideResolveInput(fovDegVertical, aspect),
        );
        // seed 依組合區分，避免 12 組共用同一條樣本序列而互相掩蓋。
        const rng = createRan1(57004 + fovDegVertical * 10 + Math.round(aspect * 100));

        for (let i = 0; i < SAMPLES_PER_COMBINATION; i++) {
          const yawMagDeg = yawMagDegRange[0] + rng() * (yawMagDegRange[1] - yawMagDegRange[0]);
          const side = rng() < 0.5 ? -1 : 1;
          const pitchDeg = pitchDegRange[0] + rng() * (pitchDegRange[1] - pitchDegRange[0]);
          // 外緣＝中心角度各推出一個目標角半徑（保守估計：大 yaw 下透視拉伸使實際外緣略小於此）。
          const outer = ndcForEyeAngles(
            side * (yawMagDeg + TARGET_ANGULAR_RADIUS_DEG),
            pitchDeg + Math.sign(pitchDeg || 1) * TARGET_ANGULAR_RADIUS_DEG,
            fovDegVertical,
            aspect,
          );
          const absX = Math.abs(outer.x);
          const absY = Math.abs(outer.y);
          if (absX > worstNdcX) worstNdcX = absX;
          if (absY > worstNdcY) worstNdcY = absY;
          if (absX > bound + NDC_EPSILON || absY > bound + NDC_EPSILON) failures++;
        }
      }
    }

    expect(failures).toBe(0);
    // ndc_x 逼近上界是定義式的代數必然；ndc_y 則有大量餘裕（跨 aspect 最壞約 0.373）。
    expect(worstNdcX).toBeLessThanOrEqual(bound + NDC_EPSILON);
    expect(worstNdcX).toBeGreaterThan(bound - 1e-3);
    expect(worstNdcY).toBeLessThan(0.4);
  });

  it('垂直方向永遠寬鬆：最壞 abs(ndc_y) 出現在 21:9 × FOV 60，且遠低於水平上界', () => {
    let worst = { fovDegVertical: 0, aspect: 0, absY: 0 };
    for (const fovDegVertical of FOV_DEG_LEVELS) {
      for (const aspect of ASPECTS) {
        const { yawMagDegRange, pitchDegRange } = resolveSpiderWideYawPitch(
          spiderWideResolveInput(fovDegVertical, aspect),
        );
        const absY = Math.abs(
          ndcForEyeAngles(
            yawMagDegRange[1] + TARGET_ANGULAR_RADIUS_DEG,
            pitchDegRange[1] + TARGET_ANGULAR_RADIUS_DEG,
            fovDegVertical,
            aspect,
          ).y,
        );
        if (absY > worst.absY) worst = { fovDegVertical, aspect, absY };
      }
    }
    expect(worst.fovDegVertical).toBe(60);
    expect(worst.aspect).toBeCloseTo(21 / 9, 12);
    // README §2.4 記 0.371（T0 PoC 進位）；同一式子實算為 0.3728，差異不影響「垂直永遠寬鬆」的結論。
    expect(worst.absY).toBeCloseTo(0.3728, 4);
  });
});

describe('WP-57 T1 — FR-57.9 負向證據：預設房間放不下本 drill 的周邊落點', () => {
  it('16:9 下四個 FOV 檔位的整段 yaw 窗都穿過預設 [10, 10, 3] 房間的側牆（x = ±5）', () => {
    const defaultRoomHalfWidthU = 5;
    for (const fovDegVertical of FOV_DEG_LEVELS) {
      const { yawMagDegRange } = resolveSpiderWideYawPitch(spiderWideResolveInput(fovDegVertical, 16 / 9));
      // pitch = 0 是側向極值（x = d·sin(yaw)·cos(pitch)，cos(pitch) ≤ 1）；窗下界才是全域最小。
      const minLateralU = spiderWideEyePos(yawMagDegRange[0], 0, SPIDER_WIDE_DISTANCE_U).x;
      const maxLateralU = spiderWideEyePos(yawMagDegRange[1], 0, SPIDER_WIDE_DISTANCE_U).x;
      expect(minLateralU).toBeGreaterThan(defaultRoomHalfWidthU);
      expect(maxLateralU).toBeGreaterThan(minLateralU);
    }
  });

  it('負向證據只能建立在側牆上：pitch +6.5° 的上緣仍放得進預設 3u 牆高', () => {
    const { pitchDegRange } = resolveSpiderWideYawPitch(spiderWideResolveInput(75, 16 / 9));
    const topEdgeY =
      spiderWideEyePos(0, pitchDegRange[1], SPIDER_WIDE_DISTANCE_U).y + SPIDER_WIDE_HITBOX_DIAMETER_U / 2;
    expect(topEdgeY).toBeLessThan(3);
    expect(topEdgeY).toBeCloseTo(2.6453, 4);
  });

  it('pitch −6.5° 的下緣對地板保有 CLEARANCE_MARGIN_U 的淨空', () => {
    const { pitchDegRange } = resolveSpiderWideYawPitch(spiderWideResolveInput(75, 16 / 9));
    const bottomEdgeY =
      spiderWideEyePos(0, pitchDegRange[0], SPIDER_WIDE_DISTANCE_U).y - SPIDER_WIDE_HITBOX_DIAMETER_U / 2;
    expect(bottomEdgeY).toBeCloseTo(0.5547, 4);
    expect(bottomEdgeY).toBeGreaterThan(0.5);
  });
});

/**
 * NFR-57.6：resolver 與投影是純函式。靜態文字掃描比間接靠行為測到更便宜也更耐久——有人加入
 * 禁用 import 的那一刻就紅燈，而不是等到某條路徑剛好被執行到。
 */
const PURE_GEOMETRY_MODULES = ['../../src/sim/spiderEyeFrame.ts', '../../src/drill/spiderShotWide.ts'];

const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /from ['"]three/,
  /from ['"]node:/,
  /from ['"]fs['"]/,
  /Date\.now\s*\(/,
  /performance\.now\s*\(/,
  /Math\.random\s*\(/,
  /requestAnimationFrame/,
  /document\./,
  /window\./,
  /from ['"].*SceneConfig/,
  /from ['"].*SceneManager/,
  /from ['"].*SettingsPanel/,
];

describe('WP-57 T1 — NFR-57.6：幾何/resolver 純函式邊界掃描', () => {
  for (const relativePath of PURE_GEOMETRY_MODULES) {
    it(`${relativePath} 無 DOM／three／node:*／fs／時鐘／隨機／render 狀態 import`, () => {
      const source = readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(source).not.toMatch(pattern);
      }
    });
  }
});
