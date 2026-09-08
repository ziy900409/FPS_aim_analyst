import type { ExportPayload } from '../data/export.ts';
import type { EyeOriginOptions } from './eyeOrigin.ts';
import { deriveSpiderShotTransitions } from './spiderShotConditions.ts';

/**
 * projectedFootprint —— WP-57 / OQ-57.8 處置 (a)：把「離軸目標在螢幕上長什麼形狀、佔多少面積」
 * 變成一個**可量測的共變量**，而不動刺激本身。
 *
 * **為什麼需要它**：直線透視下，離軸的球投影到平面螢幕上是**橢圓**（切線錐與像平面的交線），
 * 而不是圓。`angularSizeDeg`（`W_deg`）恆為設計值 2.0° 是真的 —— 球在眼睛處張的確實是 2° 的圓錐 ——
 * 但那**不代表**它在畫面上長得一樣。軸比與螢幕面積都隨離軸角 θ 單調變化，而 θ 就是
 * `angularDistanceDeg`（`D_deg`）本身 ⇒ **足跡與條件變因共變**，是 `switchReaction`
 * （`tDetectMs`／`reactionMs`）的混淆因子：「偏心度越大反應越慢」可能有一部分是「目標越大越長」。
 *
 * **為什麼它不是缺陷**：渲染器沒錯，這是直線投影的正確行為（也是 FOV 120 玩 CS2 的生態真實）。
 * 本模組因此**只量測、不修正**：不改 hitbox、不改 spawn 幾何、不新增任何匯出欄位。重建所需的量
 * （`angularDistanceDeg`／`angularSizeDeg`／`resolvedFrom.fovDegVertical`）匯出裡已全有。
 *
 * **這是研究用的共變量，不是教練指標（C-D3）**：本模組**不得**被 `diagnosisRules.ts`、教練報告
 * 產生路徑或 `DrillMetricRegistry` 引用（由 `projectedFootprint.test.ts` 的 boundary scan 釘死）。
 *
 * **沒有第二套定義（C-D4）**：θ 與 α 一律取自 `deriveSpiderShotTransitions()` 已經算好的
 * `angularDistanceDeg`／`angularSizeDeg`（eye-frame，KI-026／GD-32 之後的唯一定義）。本模組不自己
 * 碰 eye origin、目標座標或 hitbox 尺寸。
 *
 * 純函式：不讀時鐘、不讀隨機、不 import DOM／three／`node:*`／`fs`。
 */

/**
 * 一顆離軸球的投影橢圓。長度單位一律是**螢幕半高**（垂直方向 0 → 1 = 畫面中心到上緣），
 * 故所有數字與解析度無關。
 *
 * ⚠️ **aspect 刻意不在輸入裡**。OQ-57.8 的原文把 `resolvedFrom.aspect` 列為所需的量，但實際推導
 * 下來它只影響 **NDC 座標**的水平縮放，不影響橢圓在**物理螢幕**上的形狀 —— 因為正確設定的渲染器
 * 是把像平面等向地映到方形像素上。本模組因此報告等向像平面上的量（= 眼睛真正看到的形狀），
 * 不報告 NDC；要 NDC 座標的人得自己套 `tan(halfHFOV)`，而那是另一個問題。
 */
export interface ProjectedFootprint {
  /** θ —— 目標方向與視軸的夾角（度）。 */
  readonly offAxisDeg: number;
  /** α —— 目標的角半徑（度）= `angularSizeDeg / 2`。 */
  readonly angularRadiusDeg: number;
  /** 半長軸／半短軸。θ = 0 時恰為 1（正圓）；小 α 下趨近 `1 / cos θ`。 */
  readonly axisRatio: number;
  /** 半長軸（螢幕半高為 1）。方向為**徑向**（畫面中心指向目標）。 */
  readonly semiMajorScreen: number;
  /** 半短軸（螢幕半高為 1）。方向為**切向**。 */
  readonly semiMinorScreen: number;
  /** 橢圓面積 `π·a·b`（螢幕半高平方）。 */
  readonly areaScreen: number;
  /** 相對於**同一個 α 在軸上**的面積倍率。小 α 下趨近 `1 / cos³θ`。 */
  readonly areaRatioToOnAxis: number;
  /**
   * 橢圓形心相對「球心方向的投影點」的外移量，以半長軸為單位。
   *
   * 這是「瞄準視覺中心」與「瞄準幾何中心」的差距 —— 實錄參數下僅 2% 左右，故該直覺不會被明顯誤導。
   * 之所以要報告它：不報的話，讀者無從知道這個誤差是可忽略的還是被忽略的。
   */
  readonly centroidOffsetShare: number;
}

/**
 * 離軸球的投影橢圓（**閉式解，非小角近似**）。
 *
 * 推導：眼睛在原點、視軸為 `+z`、像平面在 `z = f`。半角 α 的切線錐（軸與視軸夾 θ）與像平面的交線是
 * `k·(x − x₀)² + cos²α·y² = f²·cos²α·sin²α / k`，其中 `k = cos²α − sin²θ`。由此
 * `a = f·cosα·sinα / k`、`b = f·sinα / √k`、`x₀ = f·sinθ·cosθ / k`。取 `f = 1 / tan(halfVFOV)`
 * 使螢幕半高為 1。
 *
 * 自洽檢查（由測試釘死）：θ = 0 時 `a = b = f·tanα`（正圓，即在軸球的既有結果）；
 * 面積倍率的閉式為 `(cos²α / k)^{3/2}`，小 α 下 → `1 / cos³θ`。
 *
 * @throws `k ≤ 0` 時擲錯 —— 那代表切線錐已擦過與視軸垂直的方向，交線不再是橢圓（拋物線／雙曲線），
 *   「螢幕足跡」在該幾何下沒有有限值。刻意不回 `Infinity`：那會靜默地流進下游統計。
 */
export function projectedSphereFootprint(args: {
  readonly offAxisDeg: number;
  readonly angularRadiusDeg: number;
  readonly fovDegVertical: number;
}): ProjectedFootprint {
  const offAxisDeg = nonNegativeFinite(args.offAxisDeg, 'offAxisDeg');
  const angularRadiusDeg = positiveFinite(args.angularRadiusDeg, 'angularRadiusDeg');
  const fovDegVertical = positiveFinite(args.fovDegVertical, 'fovDegVertical');
  if (fovDegVertical >= 180) throw new Error('fovDegVertical must be below 180 degrees');
  if (offAxisDeg + angularRadiusDeg >= 90) {
    throw new Error(`offAxisDeg + angularRadiusDeg must stay below 90 degrees (got ${offAxisDeg + angularRadiusDeg})`);
  }

  const theta = toRadians(offAxisDeg);
  const alpha = toRadians(angularRadiusDeg);
  const sinTheta = Math.sin(theta);
  const cosAlpha = Math.cos(alpha);
  const sinAlpha = Math.sin(alpha);

  const k = cosAlpha * cosAlpha - sinTheta * sinTheta;
  if (k <= 0) {
    throw new Error(`the tangent cone does not project to an ellipse (cos^2(alpha) - sin^2(theta) = ${k})`);
  }
  const sqrtK = Math.sqrt(k);

  // 螢幕半高 = 1 的焦距。
  const focal = 1 / Math.tan(toRadians(fovDegVertical / 2));

  const semiMajorScreen = (focal * cosAlpha * sinAlpha) / k;
  const semiMinorScreen = (focal * sinAlpha) / sqrtK;
  const onAxisRadius = focal * Math.tan(alpha);

  const centroidRadial = (focal * sinTheta * Math.cos(theta)) / k;
  const sphereCentreRadial = focal * Math.tan(theta);

  return {
    offAxisDeg,
    angularRadiusDeg,
    axisRatio: cosAlpha / sqrtK,
    semiMajorScreen,
    semiMinorScreen,
    areaScreen: Math.PI * semiMajorScreen * semiMinorScreen,
    // = (cos²α / k)^{3/2}，但由兩個實際算出的面積相除而得，免得閉式與上面的 a／b 各自漂移。
    areaRatioToOnAxis: (semiMajorScreen * semiMinorScreen) / (onAxisRadius * onAxisRadius),
    centroidOffsetShare: (centroidRadial - sphereCentreRadial) / semiMajorScreen,
  };
}

export interface ProjectedFootprintPresentation {
  /** 對應的 `SpiderShotTransition.index`。 */
  readonly index: number;
  readonly targetId: string;
  /**
   * `D_deg` —— 本次切換的角位移，同時就是抵達目標在**切換發生那一刻**的離軸角 θ。
   *
   * ⚠️ 它是**設計上的**離軸角（`center-to-peripheral` 的定義即「視線在中心目標上、目標出現在
   * D_deg 之外」），不是拉槍途中的瞬時偏心度。橢圓只存在於拉槍**之前**的偵測階段 —— 開火時目標
   * 已被轉到軸上、渲染為正圓，故 `firstShot`／`stopControl` 幾乎不受影響。共變的是 `switchReaction`。
   */
  readonly angularDistanceDeg: number;
  readonly footprint: ProjectedFootprint;
}

/**
 * 對每個 `center-to-peripheral` 切換輸出一筆投影足跡。
 *
 * 回中心的切換不輸出：中心目標恆在軸上（θ = 0），足跡是常數正圓，不構成共變量。
 *
 * @throws `meta.spawn.spiderShot.resolvedFrom.fovDegVertical` 缺席時擲錯。**刻意不退回
 *   `meta.fovDeg`**：那會變成第二個 FOV 來源，而用錯 FOV 算出的足跡是**靜默錯誤**（數字看起來
 *   完全正常）。`resolvedFrom` 是唯一保證等於 resolver 當時真正用到的那個值（FR-57.10 provenance）。
 */
export function deriveProjectedFootprint(
  payload: ExportPayload,
  options: EyeOriginOptions = {},
): readonly ProjectedFootprintPresentation[] {
  const fovDegVertical = readResolvedFovDegVertical(payload);

  return deriveSpiderShotTransitions(payload, options)
    .filter((transition) => transition.direction === 'center-to-peripheral')
    .map((transition) => ({
      index: transition.index,
      targetId: transition.targetId,
      angularDistanceDeg: transition.angularDistanceDeg,
      footprint: projectedSphereFootprint({
        offAxisDeg: transition.angularDistanceDeg,
        angularRadiusDeg: transition.angularSizeDeg / 2,
        fovDegVertical,
      }),
    }));
}

export interface FootprintSpread {
  readonly count: number;
  readonly minAreaScreen: number;
  readonly maxAreaScreen: number;
  /** `max / min` —— **窗內**的足跡變異。OQ-57.8 的「隨 yaw 變動 1.38×」就是這個量。 */
  readonly areaRatio: number;
  readonly minAxisRatio: number;
  readonly maxAxisRatio: number;
}

/**
 * 一批呈現的足跡離散度。
 *
 * 這是本模組唯一的聚合輸出，存在的理由是「窗內變異」本身就是 OQ-57.8 的論點（足跡不只是比中心大，
 * 而且**在條件窗內部**還隨 yaw 變動）。刻意只回極值與比值、不回平均或標準差 —— 那會讓它看起來
 * 像個可比較的分數（C-D3）。
 */
export function footprintSpread(
  presentations: readonly ProjectedFootprintPresentation[],
): FootprintSpread | undefined {
  if (presentations.length === 0) return undefined;

  let minArea = Infinity;
  let maxArea = -Infinity;
  let minAxis = Infinity;
  let maxAxis = -Infinity;
  for (const presentation of presentations) {
    const { areaScreen, axisRatio } = presentation.footprint;
    if (areaScreen < minArea) minArea = areaScreen;
    if (areaScreen > maxArea) maxArea = areaScreen;
    if (axisRatio < minAxis) minAxis = axisRatio;
    if (axisRatio > maxAxis) maxAxis = axisRatio;
  }
  return {
    count: presentations.length,
    minAreaScreen: minArea,
    maxAreaScreen: maxArea,
    areaRatio: maxArea / minArea,
    minAxisRatio: minAxis,
    maxAxisRatio: maxAxis,
  };
}

function readResolvedFovDegVertical(payload: ExportPayload): number {
  const spiderShot = payload.meta.spawn?.spiderShot;
  if (typeof spiderShot === 'object' && spiderShot !== null) {
    const resolvedFrom = (spiderShot as { resolvedFrom?: unknown }).resolvedFrom;
    if (typeof resolvedFrom === 'object' && resolvedFrom !== null) {
      const value = (resolvedFrom as { fovDegVertical?: unknown }).fovDegVertical;
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
    }
  }
  throw new Error(
    'meta.spawn.spiderShot.resolvedFrom.fovDegVertical is required to project a footprint; ' +
      'meta.fovDeg is deliberately not used as a fallback (a wrong FOV yields a silently wrong footprint)',
  );
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function nonNegativeFinite(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative finite number`);
  return value;
}

function positiveFinite(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive finite number`);
  return value;
}
