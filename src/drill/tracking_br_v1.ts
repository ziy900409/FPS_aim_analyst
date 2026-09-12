import type { DrillConfig } from './DrillConfig.ts';
import type { SceneDrillConfig } from './tracking_scene_v1.ts';

const DEG_TO_RAD = Math.PI / 180;
const TARGET_HEIGHT_U = 1;
const TARGET_ANGULAR_SPEED_DEG_PER_S = 5;
const PRESENTATION_MS = 2000;
const TARGET_COUNT = 10;

export type BrTrackingAdsAxis = 'ads_off' | 'ads_on';
export type BrTrackingBallisticAxis = 'hitscan' | 'projectile';
export type BrTrackingAngularAxis = '0p5deg' | '2deg';

export interface BrTrackingVariant extends SceneDrillConfig {
  axes: {
    ads: BrTrackingAdsAxis;
    ballistic: BrTrackingBallisticAxis;
    angularHeight: BrTrackingAngularAxis;
  };
}

const ANGULAR_PROFILES: Record<BrTrackingAngularAxis, { angularHeightDeg: number; seedOffset: number }> = {
  '0p5deg': { angularHeightDeg: 0.5, seedOffset: 0 },
  '2deg': { angularHeightDeg: 2.0, seedOffset: 100 },
};

/**
 * WP-66 / T4 — 命中視覺回饋（render-only）在**整個 `tracking_br_v1` 家族**啟用。
 *
 * 這些目標是 `persistent: true`（命中不撤除），所以在本常數之前，受試者在整個呈現窗內**無從
 * 得知自己有沒有打中**——非 tracking 的 peek drill 靠「目標消失」當回饋，tracking 沒有這個事件。
 *
 * **為什麼設在 `makeVariant()` 裡（一處生效八個）**：`hitFeedback` 必須對這個 2x2x2 條件矩陣的
 * **每一格逐格相同**，否則 ads x ballistic x angularHeight 三個被操弄變數就與「有無回饋」共變。
 * `brTrackingProtocol`（`src/display/brTrackingProtocol.ts`）的 conditions 正是 `trackingBrVariants`
 * 全部八格，所以寫在 builder 上＝該 protocol 全條件一致，協定內比較不受污染。
 *
 * ⚠️ **效度斷代（FM-7）**：啟用於 2026-09-12。此日期之後收的 `tracking_br_v1` 家族資料，刺激與
 * 之前**不同**，兩者不可混池比較。逐 run 的判別依據是匯出的 `meta.targets.hitFeedback`
 * （FR-66.10），不是收集日期。
 *
 * 本欄位不得影響命中判定、目標推進、hitbox 或任何指標（見 `DrillConfig['targets'].hitFeedback`）。
 */
const HIT_FEEDBACK = 'flash' as const;

const WEAPON_BY_AXIS: Record<BrTrackingAdsAxis, Record<BrTrackingBallisticAxis, string>> = {
  ads_off: {
    hitscan: 'ak47_br_hip_hitscan',
    projectile: 'ak47_br_hip_projectile',
  },
  ads_on: {
    hitscan: 'ak47_br_ads_hitscan',
    projectile: 'ak47_br_ads_projectile',
  },
};

function distanceForAngularHeight(heightU: number, angularHeightDeg: number): number {
  return heightU / (2 * Math.tan((angularHeightDeg * DEG_TO_RAD) / 2));
}

function speedForAngularRate(distanceU: number, angularSpeedDegPerS: number): number {
  return distanceU * angularSpeedDegPerS * DEG_TO_RAD;
}

function variantId(
  ads: BrTrackingAdsAxis,
  ballistic: BrTrackingBallisticAxis,
  angularHeight: BrTrackingAngularAxis,
): string {
  if (ads === 'ads_on' && ballistic === 'projectile' && angularHeight === '0p5deg') return 'tracking_br_v1';
  return `tracking_br_v1__${ads}__${ballistic}__${angularHeight}`;
}

function makeVariant(
  ads: BrTrackingAdsAxis,
  ballistic: BrTrackingBallisticAxis,
  angularHeight: BrTrackingAngularAxis,
  seedOffset: number,
): BrTrackingVariant {
  const angular = ANGULAR_PROFILES[angularHeight];
  const distance = distanceForAngularHeight(TARGET_HEIGHT_U, angular.angularHeightDeg);
  const speed = speedForAngularRate(distance, TARGET_ANGULAR_SPEED_DEG_PER_S);
  const drillId = variantId(ads, ballistic, angularHeight);

  return {
    id: drillId,
    sceneId: 'br-field',
    axes: { ads, ballistic, angularHeight },
    drill: {
      drillId,
      weaponId: WEAPON_BY_AXIS[ads][ballistic],
      targets: {
        count: TARGET_COUNT,
        distance,
        hitbox: { widthU: 0.5, heightU: TARGET_HEIGHT_U, depthU: 0.5 },
        spawnArea: { yawDegRange: [0, 0], distanceURange: [distance, distance] },
        motion: { type: 'pingpong', axis: 'horizontal', range: speed / 2, speed },
        hitFeedback: HIT_FEEDBACK,
      },
      sequence: {
        alternation: 'LR',
        seed: 26000 + angular.seedOffset + seedOffset,
      },
      timing: {
        countdownMs: 3000,
        presentationMs: PRESENTATION_MS,
        timeLimitMs: 120000,
      },
      endCondition: { type: 'targetCount', value: TARGET_COUNT },
    } satisfies DrillConfig,
  };
}

export const trackingBrVariants = [
  makeVariant('ads_off', 'hitscan', '0p5deg', 1),
  makeVariant('ads_on', 'hitscan', '0p5deg', 2),
  makeVariant('ads_off', 'projectile', '0p5deg', 3),
  makeVariant('ads_on', 'projectile', '0p5deg', 4),
  makeVariant('ads_off', 'hitscan', '2deg', 5),
  makeVariant('ads_on', 'hitscan', '2deg', 6),
  makeVariant('ads_off', 'projectile', '2deg', 7),
  makeVariant('ads_on', 'projectile', '2deg', 8),
] as const satisfies readonly BrTrackingVariant[];

export const trackingBrV1 = trackingBrVariants[3];
