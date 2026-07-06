/**
 * recoil punch 角度轉換 — WP-13 / T2（稽核 A6）
 *
 * 整個 sim / view / 彈道射線路徑中 **唯一** 允許把 recoil punch 由 Source 度慣例轉成 three.js
 * 弧度慣例（含 pitch 符號翻轉）的地方。集中於此以免 deg↔rad 與符號在多處各轉一次、彈道/視覺
 * 錯亂難追（README §3 failure-mode、T2 DoD 契約）。
 *
 * 慣例對照（Source engine（`src/recoil` 數學核心）↔ three.js（`CameraController` / 彈道射線））：
 *
 * | 量    | Source（度）                              | three.js（弧度）                       | 轉換        |
 * |-------|-------------------------------------------|----------------------------------------|-------------|
 * | pitch | **下為正**（aimPunch 上跳 → 負值）        | **上為正**（繞 camera local +X）       | **翻號**    |
 * | yaw   | **左為正**（向右漂 → 負值）               | **左為正**（繞 world +Y）              | 同號        |
 *
 * 例：pitch −10°（Source，上跳）→ +0.17453 rad（three，向上）；yaw −1.5°（Source，向右）→
 * −0.02618 rad（three，向右）。
 */

/** 度→弧度換算係數（本模組自足，不倚賴 THREE，使 sim/view 路徑的 deg→rad 收斂於此單點）。 */
const RAD_PER_DEG = Math.PI / 180;

export interface ThreePunchRad {
  /** three local-X 繞轉角（上為正）。 */
  pitchRad: number;
  /** three world-Y 繞轉角（左為正）。 */
  yawRad: number;
}

/**
 * Source 度慣例的 punch（pitch 下正 / yaw 左正）→ three 弧度慣例（pitch 上正 / yaw 左正）。
 * pitch 翻號、yaw 同號。視覺 punch 與彈道 rawPunch 皆經此轉換後才進 three 旋轉組合。
 */
export function punchToThreeRad(pitchDeg: number, yawDeg: number): ThreePunchRad {
  return {
    pitchRad: -pitchDeg * RAD_PER_DEG,
    yawRad: yawDeg * RAD_PER_DEG,
  };
}
