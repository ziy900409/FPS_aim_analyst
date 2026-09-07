import {
  resolveTargetHitbox,
  type DrillConfig,
  type SpiderShotYawPitchConfig,
  type TargetHitboxSize,
} from '../drill/DrillConfig.ts';
import { PLAYER_EYE_HEIGHT_U } from '../sim/playerEye.ts';
import { SPIDER_WIDE_EYE_ORIGIN, spiderWideEyePos } from '../sim/spiderEyeFrame.ts';
import { CLEARANCE_MARGIN_U, targetHitboxRadius } from './clearance.ts';
import type { ProceduralRoomConfig, SceneConfig } from './SceneConfig.ts';
import { resolveEyeWorldBase } from './eyePose.ts';

/**
 * WP-57 / T3（README §2.5，FR-57.9）—— **穿牆／埋地板的自動閘**。
 *
 * T0 discovery item 11：`validateClearance()` 只掃 `scene.propBounds`,全檔零 `wall`／`floor`／
 * `roomSize` 引用 ⇒ 牆與地板**不在**既有淨空檢查範圍。本 drill 的周邊落點是全 repo 第一個會逼近
 * 側牆的 spawn 幾何（FOV 120 下 `x = ±7.5322`）,故需要這一個閘;否則「房間裝不下」只會表現成
 * 目標被牆遮住、但 `HitDetector` 不查牆遮擋而命中仍過（KI-012 的失敗模式）。
 *
 * 純函式：不 import DOM／three／`node:*`／`fs`,不讀時鐘、不讀隨機。層次上屬 **scene validation**
 * （GD-6 允許讀場景幾何的唯一一側）;`src/sim` 不得反向 import 本模組。
 *
 * 落點極值取解析解而非取樣（`x = d·sin(yaw)·cos(pitch)`,`cos(pitch) ≤ 1` ⇒ 側向極值必在
 * `pitch = 0`;`y` 只由 pitch 決定;`z` 最遠在中心目標、最近在 `yaw` 與 `|pitch|` 同時取上界）。
 */

const EYE_ANCHOR_EPSILON_U = 1e-9;

/** 各面的淨空（world unit）；正值 = 目標外緣到該面的距離，負值 = 已穿透。 */
export interface SpiderWideArenaClearance {
  /** 側牆（`x = ±width/2`）。 */
  readonly sideWallU: number;
  /** 後牆（`z = −depth/2`）—— 中心目標最靠近的一面。 */
  readonly backWallU: number;
  /** 前牆（`z = +depth/2`，玩家背後）。 */
  readonly frontWallU: number;
  /** 地板（`floorY`）。 */
  readonly floorU: number;
  /** 牆體上緣（`roomSize[2]`）。房間**無天花板幾何**,故此欄為觀測值,不參與 fits 判定。 */
  readonly wallTopU: number;
  /** 上述四個受檢面的最小值（不含 `wallTopU`）。 */
  readonly minU: number;
}

/** 落點包絡的極值（含目標半徑前的中心座標）。 */
export interface SpiderWideArenaExtremes {
  /** 側向最大 `abs(x)`（`pitch = 0` 時的 yaw 上界）。 */
  readonly maxLateralU: number;
  /** 側向最小 `abs(x)`（`pitch` 取上界時的 yaw 下界）—— 負向證據要的是這個全域最小。 */
  readonly minLateralU: number;
  readonly maxY: number;
  readonly minY: number;
  /** 最負的 `z`（= 中心目標）。 */
  readonly minZ: number;
  /** 最不負的 `z`（yaw 與 `abs(pitch)` 同時取上界的周邊落點）。 */
  readonly maxZ: number;
}

/** 由已解析的 yaw/pitch 窗算出落點包絡極值（含中心目標）。 */
export function spiderWideArenaExtremes(schedule: SpiderShotYawPitchConfig): SpiderWideArenaExtremes {
  const d = schedule.distanceU;
  const [yawMinDeg, yawMaxDeg] = schedule.peripheral.yawMagDegRange;
  const [pitchMinDeg, pitchMaxDeg] = schedule.peripheral.pitchDegRange;
  const pitchMagMaxDeg = Math.max(Math.abs(pitchMinDeg), Math.abs(pitchMaxDeg));

  const maxLateralU = spiderWideEyePos(yawMaxDeg, 0, d).x;
  const minLateralU = spiderWideEyePos(yawMinDeg, pitchMagMaxDeg, d).x;
  const maxY = spiderWideEyePos(0, pitchMaxDeg, d).y;
  const minY = spiderWideEyePos(0, pitchMinDeg, d).y;
  const nearestZ = spiderWideEyePos(yawMaxDeg, pitchMagMaxDeg, d).z;
  const centerZ = spiderWideEyePos(0, 0, d).z;

  return {
    maxLateralU,
    minLateralU,
    maxY,
    minY,
    minZ: centerZ,
    maxZ: nearestZ,
  };
}

/**
 * 目標外緣對房間各面的淨空。`room` 刻意獨立於 `SceneConfig` 傳入,讓「預設 `[10, 10, 3]` 房間裝不下」
 * 的負向證據（FR-57.9）能走**同一個**判定式,而不是另寫一套比較。
 *
 * 落點是 **world 座標**（eye-frame 原點 == sim 原點 == world 原點正上方 1.6u）,而牆面在
 * `x = ±width/2`／`z = ±depth/2`,同樣以 world 原點為中心 ⇒ 本判定式**不含 `eyeZ`**。
 * `eyeZ` 只決定 camera 位置,其與 sim eye 原點必須相等一事由
 * `requireSpiderWideArenaGeometry()` 的 eye anchor 斷言獨立守住。
 */
export function spiderWideArenaClearance(
  room: ProceduralRoomConfig,
  schedule: SpiderShotYawPitchConfig,
  targetRadiusU: number,
): SpiderWideArenaClearance {
  const [width, depth, wallTopY] = room.roomSize;
  const floorY = room.floorY ?? 0;
  const extremes = spiderWideArenaExtremes(schedule);

  const sideWallU = width / 2 - (extremes.maxLateralU + targetRadiusU);
  const backWallU = extremes.minZ - targetRadiusU + depth / 2;
  const frontWallU = depth / 2 - (extremes.maxZ + targetRadiusU);
  const floorU = extremes.minY - targetRadiusU - floorY;
  const wallTopU = wallTopY - (extremes.maxY + targetRadiusU);

  return {
    sideWallU,
    backWallU,
    frontWallU,
    floorU,
    wallTopU,
    minU: Math.min(sideWallU, backWallU, frontWallU, floorU),
  };
}

/**
 * 目標外緣半徑,**由同一個 `resolveTargetHitbox()` 推導**（GD-7 單一來源）。`shape: 'sphere'` 的外緣
 * 就是半徑;`'box'` 沿用 `targetHitboxRadius()` 的角點半徑（既有淨空慣例）。
 */
export function spiderWideTargetRadiusU(hitbox: TargetHitboxSize): number {
  if (hitbox.shape === 'sphere') return Math.max(hitbox.width, hitbox.height, hitbox.depth) / 2;
  return targetHitboxRadius(hitbox);
}

/**
 * Fail-fast 閘：`center-peripheral-yawpitch` 排程只能綁在裝得下它的 procedural 房間裡。
 * 由 `loadDrill()` 在 clearance 驗證之前呼叫（與 `requireSpiderShotDeliveryGeometry()` 同一慣例）。
 */
export function requireSpiderWideArenaGeometry(scene: SceneConfig, drill: DrillConfig): void {
  if (drill.spiderShot?.kind !== 'center-peripheral-yawpitch') return;
  const room = scene.proceduralRoom;
  if (room === undefined) {
    throw new Error('DrillConfig 載入失敗: wide flick arena 需要 procedural room envelope');
  }
  // GD-6：sim 用 `PLAYER_EYE_HEIGHT_U` 常數、scene 用 config;兩者相等才不脫鉤。
  if (room.eyeHeight !== PLAYER_EYE_HEIGHT_U) {
    throw new Error(
      `DrillConfig 載入失敗: wide flick arena eyeHeight=${room.eyeHeight} 必須等於 PLAYER_EYE_HEIGHT_U=${PLAYER_EYE_HEIGHT_U}`,
    );
  }
  const eye = resolveEyeWorldBase(scene);
  if (
    Math.abs(eye.x - SPIDER_WIDE_EYE_ORIGIN.x) > EYE_ANCHOR_EPSILON_U ||
    Math.abs(eye.y - SPIDER_WIDE_EYE_ORIGIN.y) > EYE_ANCHOR_EPSILON_U ||
    Math.abs(eye.z - SPIDER_WIDE_EYE_ORIGIN.z) > EYE_ANCHOR_EPSILON_U
  ) {
    throw new Error(
      `DrillConfig 載入失敗: wide flick arena eye anchor mismatch — scene=${scene.sceneId} ` +
        `eye=(${eye.x},${eye.y},${eye.z}) expected=(${SPIDER_WIDE_EYE_ORIGIN.x},${SPIDER_WIDE_EYE_ORIGIN.y},${SPIDER_WIDE_EYE_ORIGIN.z})`,
    );
  }

  const hitbox = resolveTargetHitbox(drill);
  const clearance = spiderWideArenaClearance(room, drill.spiderShot, spiderWideTargetRadiusU(hitbox));
  if (clearance.minU < CLEARANCE_MARGIN_U) {
    throw new Error(
      `DrillConfig 載入失敗: wide flick arena 裝不下周邊落點 — scene=${scene.sceneId} ` +
        `side=${clearance.sideWallU} back=${clearance.backWallU} front=${clearance.frontWallU} ` +
        `floor=${clearance.floorU} 最小淨空需 ≥ ${CLEARANCE_MARGIN_U}`,
    );
  }
}
