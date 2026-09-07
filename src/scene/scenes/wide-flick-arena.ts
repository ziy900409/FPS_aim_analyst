import { validateScene, type SceneConfig } from '../SceneConfig.ts';

/**
 * WP-57 / T3（README §2.5.2，FR-57.9）—— `spider-shot-wide-v1` 的寬場 arena。
 *
 * 純 procedural、零 props：`asset: null` + `propBounds: []` ⇒ KI-011（道具重疊拒入）天然滿足、
 * GD-9（資產授權白名單）不適用。既有場景一律不動；本 arena 也不得被既有 drill 引用。
 *
 * 幾何逐項出處（T0 PoC A/C/D 實測，見 README §2.5.2）：
 * - `roomSize[0] = 18`：最壞側向落點 `7.5322 u`（FOV 120、pitch 0）+ 目標半徑 `0.139641` +
 *   `CLEARANCE_MARGIN_U 0.5` ⇒ 需半寬 ≥ `8.1719`;取 9。
 * - `roomSize[1] = 20`：`eyeZ: 0` 把中心目標推到 `z = −8`,後牆必須在它之後 ⇒ 需 `depth ≥ 17.28`。
 *   `depth: 10` 會讓後牆（`z = −5`）比目標更靠近相機 —— 視覺上整顆被遮但 `HitDetector` 不查牆遮擋、
 *   命中仍過(**KI-012**)。20 沿用 `placeholder-room` 的同一理由與同一數值。
 * - `roomSize[2] = 4`：pitch `+6.5°` 的上緣 `2.6453` 之上仍留視覺餘裕;房間無天花板幾何
 *   （`SceneManager.#buildRoom` 只建地板 + 四牆），本 WP 不改變這件事。
 * - `eyeZ: 0`**明確指定,不吃 fallback**（`depth/2 − CAMERA_STANDOFF = 9`）：`SceneConfig.eyeZ` 契約
 *   要求 radial-spawn drill 設 0,使實際交戰距離 == config distance;且匯出的 origin-frame
 *   `D_deg`／`W_deg` 偏差由 `eyeZ: 4` 的 27.9°／43.6% 收斂到 2.4°／4.0%（README §2.5.1）。
 * - `floorY` 省略（= 0，KI-014）：pitch 窗的地板淨空推導（`SPIDER_WIDE_FLOOR_CLEARANCE_U`）即以
 *   地板在 `y = 0` 為前提，改動這裡會讓 resolver 的 pitch 上界失效。
 * - `eyeHeight: 1.6` 必須等於 sim 側的 `PLAYER_EYE_HEIGHT_U`（GD-6：sim 用常數、scene 用 config，
 *   兩者相等才不脫鉤）；由 `wide-flick-arena.test.ts` 與 `requireSpiderWideArenaGeometry()` 釘死。
 *
 * `playerCorridor.halfWidthU` 取與 `spider-shot-room`／`micro-flick-room` 同一個極小值：本 drill
 * `translation: 'locked'`（FR-57.8），玩家不位移。
 */
export const wideFlickArena: SceneConfig = validateScene({
  sceneId: 'wide-flick-arena',
  assetPackVersion: 'wide-flick-arena-v1',
  clutterTier: 'low',
  asset: null,
  propBounds: [],
  playerCorridor: { halfWidthU: 0.000001 },
  proceduralRoom: {
    roomSize: [18, 20, 4],
    eyeZ: 0,
    eyeHeight: 1.6,
    fovDeg: 75,
    colors: {
      floor: 0x33373c,
      wall: 0x4d545c,
      background: 0x202428,
    },
    lights: {
      ambientIntensity: 0.6,
      directionalIntensity: 1.2,
      directionalPosition: { x: 3, y: 4.5, z: 2.5 },
    },
  },
});
