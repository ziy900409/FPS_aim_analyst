import { halfHorizontalFovRad } from '../sim/spiderEyeFrame.ts';
import { PLAYER_EYE_HEIGHT_U } from '../sim/playerEye.ts';

/**
 * WP-57 / T1（README §2.4，FR-57.3／57.14）—— **arm-time resolver**。
 *
 * 這是本 WP 唯一一次讀 render 狀態（FOV／aspect）的地方，而且只發生在 drill arm 時：輸出是純資料
 * 常數，寫進 resolved `DrillConfig`。越過這一點之後 `TargetManager` 對 FOV、aspect、camera、
 * `SceneConfig` 一無所知（GD-6／GD-10；run 中 resize 不重解析 ⇒ 解析度變化不改 sim）。
 *
 * 純函式：不 import DOM／three／`node:*`／`fs`，不讀時鐘、不讀隨機（NFR-57.6）。輸入非法時擲
 * `SpiderWideResolveError`，**不回退預設值** —— 靜默降級會讓刺激幾何與匯出 provenance 不一致。
 */

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/** 中心與周邊共用距離（沿用 v1/v2 血緣；固定距離使角徑恆定）。 */
export const SPIDER_WIDE_DISTANCE_U = 8;
/** 沿用 v2 的 2.0°（Aim Lab Ultimate/Standard 1.8–2.2° 中點）。 */
export const SPIDER_WIDE_TARGET_ANGULAR_DIAMETER_DEG = 2.0;
/** 由角徑與距離反推的 sphere 直徑；hitbox 與 `W_deg` 同源於此（GD-7／GD-30）。 */
export const SPIDER_WIDE_HITBOX_DIAMETER_U =
  2 * SPIDER_WIDE_DISTANCE_U * Math.tan((SPIDER_WIDE_TARGET_ANGULAR_DIAMETER_DEG / 2) * DEG_TO_RAD);
/** NDC 邊界安全餘裕（以 NDC 比例定義，因為裁切發生在 NDC 空間）。未經實機校準（OQ-57.3）。 */
export const SPIDER_WIDE_SCREEN_MARGIN = 0.04;
/** yaw 貼邊係數 `kLo`：窗下界 = `kLo · yawMax`。未經實機校準（OQ-57.3）。 */
export const SPIDER_WIDE_YAW_EDGE_FACTOR = 0.92;
/** 目標下緣對地板的最小間距，沿用 `CLEARANCE_MARGIN_U` 慣例。 */
export const SPIDER_WIDE_FLOOR_CLEARANCE_U = 0.5;
/**
 * OQ-57.2（2026-09-07 凍結，D-57.P14）：`±6.5°`。地板淨空的硬上界是 `6.8947°`（見
 * `resolveSpiderWideYawPitch()`），這裡刻意留 `0.395°` 餘裕，不硬貼邊界。
 * 完整 `±15°` 在 8u 距離、1.6u 眼高下**不存在**——它與地板衝突，而非與 FOV 衝突。
 */
export const SPIDER_WIDE_PITCH_MAG_DEG = 6.5;

export interface SpiderWideResolveInput {
  /** `SettingsPanel.fov`，60–120（垂直 FOV）。 */
  readonly fovDegVertical: number;
  /** `camera.aspect = w / h`。 */
  readonly aspect: number;
  readonly distanceU: number;
  readonly hitboxDiameterU: number;
  /** NDC 比例。 */
  readonly screenMargin: number;
  readonly kLo: number;
  /** = `PLAYER_EYE_HEIGHT_U`。 */
  readonly eyeHeightU: number;
  /** 目標下緣對地板的最小間距。 */
  readonly floorClearanceU: number;
}

export interface SpiderWideResolved {
  readonly yawMagDegRange: readonly [number, number];
  readonly pitchDegRange: readonly [number, number];
  /**
   * 地板淨空推導出的 pitch 硬上界（度）。`pitchDegRange` 取的是已凍結的
   * `SPIDER_WIDE_PITCH_MAG_DEG`，本欄位是它的**餘裕證據**，一併留作 provenance。
   */
  readonly pitchLimitDeg: number;
}

/** 帶欄位名的 typed error（FR-57.14）；呼叫端可據 `field` 分類，不需要解析訊息字串。 */
export class SpiderWideResolveError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(`SpiderWide resolver 失敗: ${field} ${message}`);
    this.name = 'SpiderWideResolveError';
    this.field = field;
  }
}

function requirePositiveFinite(value: number, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new SpiderWideResolveError(field, '必須為正有限數');
  }
  return value;
}

/**
 * FR-57.3。yaw 上界（貼邊但不被切）：
 *
 * ```text
 * halfHFOV = atan( tan(fovDegVertical / 2) * aspect )
 * r        = atan( (hitboxDiameterU / 2) / distanceU )   // 目標角半徑
 * yawMax   = atan( (1 - screenMargin) * tan(halfHFOV) ) - r
 * yawMagDegRange = [ kLo * yawMax, yawMax ]
 * ```
 *
 * 這使 `tan(yawMax + r) / tan(halfHFOV)` 恰恰**等於** `1 − screenMargin`（代數必然，非巧合），
 * 故 FR-57.4 的 `ndc_x` 判定必須是 `≤` 且帶浮點容差。
 *
 * pitch 上界（地板淨空）：`sin(pitchMax) ≤ (eyeHeightU − hitboxDiameterU/2 − floorClearanceU) / distanceU`。
 */
export function resolveSpiderWideYawPitch(input: SpiderWideResolveInput): SpiderWideResolved {
  const fovDegVertical = requirePositiveFinite(input.fovDegVertical, 'fovDegVertical');
  if (fovDegVertical >= 180) throw new SpiderWideResolveError('fovDegVertical', '必須 < 180');
  const aspect = requirePositiveFinite(input.aspect, 'aspect');
  const distanceU = requirePositiveFinite(input.distanceU, 'distanceU');
  const hitboxDiameterU = requirePositiveFinite(input.hitboxDiameterU, 'hitboxDiameterU');
  const kLo = requirePositiveFinite(input.kLo, 'kLo');
  if (kLo > 1) throw new SpiderWideResolveError('kLo', '必須 ≤ 1');
  const eyeHeightU = requirePositiveFinite(input.eyeHeightU, 'eyeHeightU');
  const { screenMargin, floorClearanceU } = input;
  if (!Number.isFinite(screenMargin) || screenMargin < 0 || screenMargin >= 1) {
    throw new SpiderWideResolveError('screenMargin', '必須為 [0, 1) 的有限數');
  }
  if (!Number.isFinite(floorClearanceU) || floorClearanceU < 0) {
    throw new SpiderWideResolveError('floorClearanceU', '必須為非負有限數');
  }

  const targetAngularRadiusRad = Math.atan(hitboxDiameterU / 2 / distanceU);
  const yawMaxRad =
    Math.atan((1 - screenMargin) * Math.tan(halfHorizontalFovRad(fovDegVertical, aspect))) -
    targetAngularRadiusRad;
  if (!(yawMaxRad > 0)) {
    throw new SpiderWideResolveError('yawMagDegRange', '解析後上界 ≤ 0（目標角徑吃掉整個可用視野）');
  }
  const yawMaxDeg = yawMaxRad * RAD_TO_DEG;
  const yawMinDeg = kLo * yawMaxDeg;
  if (!(yawMinDeg < yawMaxDeg)) {
    throw new SpiderWideResolveError('yawMagDegRange', '解析後區間退化（需 kLo < 1）');
  }

  const sinPitchLimit = (eyeHeightU - hitboxDiameterU / 2 - floorClearanceU) / distanceU;
  if (!(sinPitchLimit > 0)) {
    throw new SpiderWideResolveError('floorClearanceU', 'pitch 窗使目標埋入地板（眼高不足以容納 hitbox 與淨空）');
  }
  const pitchLimitDeg = Math.asin(Math.min(sinPitchLimit, 1)) * RAD_TO_DEG;
  if (SPIDER_WIDE_PITCH_MAG_DEG > pitchLimitDeg) {
    throw new SpiderWideResolveError(
      'pitchDegRange',
      `凍結的 ±${SPIDER_WIDE_PITCH_MAG_DEG}° 超過地板淨空上界 ${pitchLimitDeg}°`,
    );
  }

  return {
    yawMagDegRange: [yawMinDeg, yawMaxDeg],
    pitchDegRange: [-SPIDER_WIDE_PITCH_MAG_DEG, SPIDER_WIDE_PITCH_MAG_DEG],
    pitchLimitDeg,
  };
}

/** 本 WP 的既定解析輸入（只留 FOV／aspect 由 arm 時的顯示狀態決定）。 */
export function spiderWideResolveInput(fovDegVertical: number, aspect: number): SpiderWideResolveInput {
  return {
    fovDegVertical,
    aspect,
    distanceU: SPIDER_WIDE_DISTANCE_U,
    hitboxDiameterU: SPIDER_WIDE_HITBOX_DIAMETER_U,
    screenMargin: SPIDER_WIDE_SCREEN_MARGIN,
    kLo: SPIDER_WIDE_YAW_EDGE_FACTOR,
    eyeHeightU: PLAYER_EYE_HEIGHT_U,
    floorClearanceU: SPIDER_WIDE_FLOOR_CLEARANCE_U,
  };
}
