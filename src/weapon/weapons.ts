import { validateWeapon, type WeaponConfig } from './WeaponConfig.ts';

export type WeaponId =
  | 'ak47'
  | 'm4a4'
  | 'm4a1s'
  | 'ak47_br_hip_hitscan'
  | 'ak47_br_ads_hitscan'
  | 'ak47_br_hip_projectile'
  | 'ak47_br_ads_projectile';

// Source: the stage2 CS2 recoil research plan and WP-11 README lock recoil
// seed/magnitude/variance, angle variance, cycletime, mag size, and
// InaccuracyFire from current CS2 vdata.
// AK base inaccuracy/recovery matches the research plan and pattern viewer.
// M4 base stand/crouch/move/recovery inherit the same stage2 baseline until
// WP-15 calibration records per-weapon CS2 vdata for those secondary fields.
const BASE_INACCURACY = {
  stand: 0.00641,
  crouch: 0.00481,
  move: 0.02,
  recoveryTimeStand: 0.4,
  recoveryTimeCrouch: 0.3,
};

export const ak47: WeaponConfig = validateWeapon({
  id: 'ak47',
  cycletimeSec: 0.1,
  magSize: 30,
  recoil: {
    seed: 223,
    magnitude: 30,
    magnitudeVariance: 0,
    angleVariance: 70,
  },
  inaccuracy: {
    ...BASE_INACCURACY,
    fire: 0.0078,
  },
  // WP-24 / T2（FR-E5）— ADS 示範光學：開鏡收窄 FOV（zoom-in），sensitivityRatio=1.0
  // （GD-16 預設，pre-registered 凍結）。zoom-in 由 fovDeg < hipFov 自然成立。
  ads: {
    fovDeg: 40,
    sensitivityRatio: 1.0,
  },
});

export const m4a4: WeaponConfig = validateWeapon({
  id: 'm4a4',
  cycletimeSec: 0.09,
  magSize: 30,
  recoil: {
    seed: 38965,
    magnitude: 23,
    magnitudeVariance: 0,
    angleVariance: 70,
  },
  inaccuracy: {
    ...BASE_INACCURACY,
    fire: 0.007,
  },
});

export const m4a1s: WeaponConfig = validateWeapon({
  id: 'm4a1s',
  cycletimeSec: 0.1,
  magSize: 20,
  recoil: {
    seed: 38965,
    magnitude: 25,
    magnitudeVariance: 3,
    angleVariance: 65,
  },
  inaccuracy: {
    ...BASE_INACCURACY,
    fire: 0.012,
  },
});

const AK47_BR_BASE = {
  cycletimeSec: ak47.cycletimeSec,
  magSize: ak47.magSize,
  recoil: { ...ak47.recoil },
  inaccuracy: { ...ak47.inaccuracy },
  ...(ak47.recoveryTransition !== undefined ? { recoveryTransition: { ...ak47.recoveryTransition } } : {}),
};

export const BR_PROJECTILE_BULLET = {
  model: 'projectile',
  speedU: 916.73,
  gravityU: 32,
  maxRangeU: 143.24,
} as const;

export const ak47BrHipHitscan: WeaponConfig = validateWeapon({
  ...AK47_BR_BASE,
  id: 'ak47_br_hip_hitscan',
});

export const ak47BrAdsHitscan: WeaponConfig = validateWeapon({
  ...AK47_BR_BASE,
  id: 'ak47_br_ads_hitscan',
  ads: { ...ak47.ads! },
});

export const ak47BrHipProjectile: WeaponConfig = validateWeapon(
  {
    ...AK47_BR_BASE,
    id: 'ak47_br_hip_projectile',
    bullet: BR_PROJECTILE_BULLET,
  },
  { engagementDistanceU: 114.59 },
);

export const ak47BrAdsProjectile: WeaponConfig = validateWeapon(
  {
    ...AK47_BR_BASE,
    id: 'ak47_br_ads_projectile',
    ads: { ...ak47.ads! },
    bullet: BR_PROJECTILE_BULLET,
  },
  { engagementDistanceU: 114.59 },
);

export const WEAPONS = {
  ak47,
  m4a4,
  m4a1s,
  ak47_br_hip_hitscan: ak47BrHipHitscan,
  ak47_br_ads_hitscan: ak47BrAdsHitscan,
  ak47_br_hip_projectile: ak47BrHipProjectile,
  ak47_br_ads_projectile: ak47BrAdsProjectile,
} as const satisfies Record<WeaponId, WeaponConfig>;

const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];

export function getWeapon(id: string): WeaponConfig {
  if (isWeaponId(id)) return WEAPONS[id];
  throw new Error(`Unknown weapon id: ${id}. Available weapons: ${WEAPON_IDS.join(', ')}`);
}

function isWeaponId(id: string): id is WeaponId {
  return Object.prototype.hasOwnProperty.call(WEAPONS, id);
}
