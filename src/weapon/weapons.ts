import { validateWeapon, type WeaponConfig } from './WeaponConfig.ts';

export type WeaponId =
  | 'ak47'
  | 'm4a4'
  | 'm4a1s'
  | 'usp_s_laser'
  | 'tracking_pilot_hold'
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

export const uspSLaser: WeaponConfig = validateWeapon({
  id: 'usp_s_laser',
  cycletimeSec: 0.17,
  magSize: 12,
  recoil: {
    seed: 223,
    magnitude: 0,
    magnitudeVariance: 0,
    angleVariance: 0,
  },
  inaccuracy: {
    stand: 0,
    crouch: 0,
    fire: 0,
    move: 0,
    recoveryTimeStand: 0.4,
    recoveryTimeCrouch: 0.3,
  },
});

/**
 * WP-54 / T7 — `tracking-pilot-v2` 專用武器（研究者決定 2026-09-04，D-54.49）。tracking pilot 從
 * 「scored 窗禁止開火」改為「scored 窗全程按住左鍵」，動機是生態效度：真實 CS2 的追蹤是邊噴邊跟。
 * 這把武器存在的唯一理由，是讓「按住左鍵」在**不換掉被量測構念**的前提下成立。三個欄位各自對應
 * 一條硬約束：
 *
 * - **`recoil` 全 0**：記錄的 `ticks[].aim` 是 `aimSink`，**不含** punch（`CameraController` 的
 *   punch 只作用在 render 相機），但受測者為了壓槍所做的補償**會**進到 `aimSink`。在有後座力的
 *   武器上按住左鍵,ε(t) 就從「純追蹤誤差」變成「追蹤 + 壓槍」的混合量——同一個構念會有第二種
 *   定義,直接牴觸 **C-D4**,並讓 T3 以來所有 tracking 指標失效。零後座力是按住左鍵的前提,不是
 *   偏好。
 * - **`ads` 省略**：`CameraController` 的 `effectiveActive = active && adsConfig !== undefined`
 *   ⇒ 沒有這個區塊,右鍵對 FOV／感度**完全無效**。這正是「停用右鍵」的實作:不攔輸入、不改事件鏈,
 *   `heldAds` 旗標與 `ads` event 照記(稽核不損失),只是不再有任何效果。歷來 6/6 的 protocol
 *   violation 全是右鍵,而在 v2 之前 pilot drill 沒有 `weaponId` ⇒ 吃 `main.ts` 的預設 `ak47`,
 *   那把**有** `ads: { fovDeg: 40 }`,所以右鍵真的會改視角。
 * - **`inaccuracy` 全 0**：彈著點 = 準心 ⇒ 每一發的命中與否是 ε(t) 在開火時刻的直接函數,於是
 *   逐發 shots-on-target 與離線 TOT 走**同一套 sphere 幾何**(引擎 `HitDetector` vs 離線
 *   `trackingDerivation`,GD-7/KI-021 單一來源),兩者一致性本身就是一條 fidelity 交叉驗證。若改用
 *   AK 的真實 `fire` 散佈,shots-on-target 會退化成被隨機散佈稀釋過的 TOT,交叉驗證失效,還要在
 *   pilot 內多注入一條 seeded RNG 串流。
 *
 * `cycletimeSec` 取 AK 的 0.1 s(生態效度的本體:步槍連射節奏);`magSize` 必須大到 25 s scored +
 * 1 s prep 打不完——26 000 ms / 100 ms = **260 發**,512 給約 2× 裕度(≈51 s 連續開火)。這道
 * 不等式由 `tracking_core_pr_pilot_v1.test.ts` 從 drill 的 `endCondition.value` 導出驗證,不寫死。
 * 彈匣打空會讓 `SimLoop.scheduleFire` 把 `state.heldFire` 強制歸 false(`SimLoop.ts` 空倉分支),
 * 亦即受測者連「按住」的意圖旗標都會被清掉、被誤記為放開——所以彈匣裕度是效度問題,不是體感問題。
 *
 * `recoil.seed` 沿用 `usp_s_laser` 的 223:magnitude/variance 全 0 時彈道表逐筆為 0,seed 不影響
 * 任何輸出,取既有零後座力武器的同一值以免看起來像一個有意義的新參數。
 */
export const trackingPilotHold: WeaponConfig = validateWeapon({
  id: 'tracking_pilot_hold',
  cycletimeSec: ak47.cycletimeSec,
  magSize: 512,
  recoil: { seed: 223, magnitude: 0, magnitudeVariance: 0, angleVariance: 0 },
  inaccuracy: {
    stand: 0,
    crouch: 0,
    fire: 0,
    move: 0,
    recoveryTimeStand: 0.4,
    recoveryTimeCrouch: 0.3,
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
  usp_s_laser: uspSLaser,
  tracking_pilot_hold: trackingPilotHold,
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
