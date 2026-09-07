import { PLAYER_EYE_HEIGHT_U } from './playerEye.ts';
import type { Vec3 } from '../state/types.ts';

/**
 * WP-57 / T1（README §2.2/§2.4，FR-57.2／57.4）—— **eye-frame 球面**投影與 NDC 判定式。
 *
 * 與既有兩套 spawn 幾何刻意分離：
 * - `peripheralPos()`（`TargetManager.ts`）的錐軸起點是**世界原點**而非眼睛，故其 `radius/azimuth`
 *   與玩家所見有系統性偏移（GD-32 已入帳；v1/v2 參數已凍結，不回頭改）。
 * - `angularSpawnPose()`（`TargetManager.ts`）是**圓柱**參數化（`y = TARGET_Y + tan(pitch)·d`），
 *   水平半徑恆為 `d`，故 3D 距離隨 pitch 增大 ⇒ 目標角徑會漂。本 WP 要把 yaw 幅度當條件變因，
 *   角徑必須恆定，因此不沿用。
 *
 * 本模組是純函式：不 import DOM／three／`node:*`／`fs`，不讀時鐘、不讀隨機（NFR-57.6）。
 * 眼睛高度取 sim 側既有唯一常數 `PLAYER_EYE_HEIGHT_U`，**不**從 `SceneConfig.proceduralRoom.eyeHeight`
 * 讀（GD-6）；arena 必須把 `eyeHeight` 設為同值，並由 T3 以測試釘死。
 */

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/** 玩家眼睛在 sim 原點正上方；本 WP 所有 yaw/pitch 都相對這一點定義。 */
export const SPIDER_WIDE_EYE_ORIGIN: Vec3 = { x: 0, y: PLAYER_EYE_HEIGHT_U, z: 0 };

/**
 * FR-57.2：`pos = eye + d·(sin(yaw)·cos(pitch), sin(pitch), −cos(yaw)·cos(pitch))`。
 *
 * `abs(pos − eye)` 對所有落點恆等於 `distanceU`（NFR-57.3），故目標角徑只由 hitbox 直徑與
 * `distanceU` 決定（GD-7）。`yaw = 0, pitch = 0` 即中心目標 `(0, eyeY, −d)`。
 */
export function spiderWideEyePos(yawDeg: number, pitchDeg: number, distanceU: number): Vec3 {
  const yawRad = yawDeg * DEG_TO_RAD;
  const pitchRad = pitchDeg * DEG_TO_RAD;
  const cosPitch = Math.cos(pitchRad);
  return {
    x: SPIDER_WIDE_EYE_ORIGIN.x + distanceU * Math.sin(yawRad) * cosPitch,
    y: SPIDER_WIDE_EYE_ORIGIN.y + distanceU * Math.sin(pitchRad),
    z: SPIDER_WIDE_EYE_ORIGIN.z - distanceU * Math.cos(yawRad) * cosPitch,
  };
}

/** `spiderWideEyePos()` 的反函式；離線重建與 round-trip 斷言用。 */
export function spiderWideEyeAngles(pos: Vec3): {
  yawDeg: number;
  pitchDeg: number;
  distanceU: number;
} {
  const dx = pos.x - SPIDER_WIDE_EYE_ORIGIN.x;
  const dy = pos.y - SPIDER_WIDE_EYE_ORIGIN.y;
  const dz = pos.z - SPIDER_WIDE_EYE_ORIGIN.z;
  const distanceU = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return {
    yawDeg: Math.atan2(dx, -dz) * RAD_TO_DEG,
    pitchDeg: distanceU === 0 ? 0 : Math.asin(dy / distanceU) * RAD_TO_DEG,
    distanceU,
  };
}

/** 水平半 FOV（弧度）：`atan(tan(fovDegVertical / 2) · aspect)`。 */
export function halfHorizontalFovRad(fovDegVertical: number, aspect: number): number {
  return Math.atan(Math.tan((fovDegVertical / 2) * DEG_TO_RAD) * aspect);
}

/**
 * FR-57.4 的判定式（直線透視）：
 *
 * ```text
 * ndc_x = tan(yaw) / tan(halfHFOV)
 * ndc_y = tan(pitch) / (cos(yaw) · tan(halfVFOV))
 * ```
 *
 * `ndc_x` **只含 yaw** ⇒ 水平裁切是一個純 yaw 條件，與 pitch 完全解耦；`ndc_y` 雖含 yaw，但在本
 * drill 的參數下永遠寬鬆（跨 aspect 最壞 0.371，見 README §2.4）。
 */
export function ndcForEyeAngles(
  yawDeg: number,
  pitchDeg: number,
  fovDegVertical: number,
  aspect: number,
): { x: number; y: number } {
  const yawRad = yawDeg * DEG_TO_RAD;
  const tanHalfV = Math.tan((fovDegVertical / 2) * DEG_TO_RAD);
  return {
    x: Math.tan(yawRad) / Math.tan(halfHorizontalFovRad(fovDegVertical, aspect)),
    y: Math.tan(pitchDeg * DEG_TO_RAD) / (Math.cos(yawRad) * tanHalfV),
  };
}
