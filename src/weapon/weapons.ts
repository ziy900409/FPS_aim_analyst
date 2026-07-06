import { validateWeapon, type WeaponConfig } from './WeaponConfig.ts';

export type WeaponId = 'ak47' | 'm4a4' | 'm4a1s';

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

export const WEAPONS = {
  ak47,
  m4a4,
  m4a1s,
} as const satisfies Record<WeaponId, WeaponConfig>;

const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];

export function getWeapon(id: string): WeaponConfig {
  if (isWeaponId(id)) return WEAPONS[id];
  throw new Error(`Unknown weapon id: ${id}. Available weapons: ${WEAPON_IDS.join(', ')}`);
}

function isWeaponId(id: string): id is WeaponId {
  return Object.prototype.hasOwnProperty.call(WEAPONS, id);
}
