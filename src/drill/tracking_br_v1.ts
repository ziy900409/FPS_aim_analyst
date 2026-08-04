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
