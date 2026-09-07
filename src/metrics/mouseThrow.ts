import type { ExportPayload } from '../data/export.ts';
import { resolveMouseGain } from '../input/mouseGain.ts';

/**
 * mouseThrow —— WP-57 / T4（README §2.8、discovery item 8）：由匯出 metadata 離線推導
 * `counts/360` 與 `cm/360`。**不新增任何輸入欄位**：`meta.sensitivity`、`meta.dpi`、
 * `meta.fovDeg` 與 `meta.weapon.ads.sensitivityRatio` 都已在 payload 內。
 *
 * **為什麼要它**：大幅度拉槍（WP-57）單邊 yaw 約 50°，中心↔周邊來回接近 100° 峰對峰，會壓到低感度
 * 選手的滑鼠墊行程。若不把「這個 run 的每 360° 需要幾公分」算出來，感度會以「被迫抬滑鼠重新定位」
 * 的形式偷渡成混淆因子（T5 的標註率方向性檢查即以本函式為 x 軸）。
 *
 * **C-D4**：gain 公式不在此重寫 —— `hipStep`／`adsStep` 一律來自 `resolveMouseGain()`
 * （`src/input/mouseGain.ts`，KI-005 的唯一定義），本模組只做「rad/count → counts/360 → cm/360」
 * 的單位換算。純函式：不讀時鐘、不讀隨機、無 I/O。
 *
 * **不猜測**：`meta.dpi` 是 self-reported 的外部硬體設定，瀏覽器讀不到。缺席時 `cmPer360`
 * 回 `undefined`（`countsPer360` 仍成立，因為它不需要 DPI）；`meta.fovDeg` 缺席時 ADS 感度鏈
 * 不可稽核（見 `metadata.ts` 的 `fovDeg` 註解），`adsCountsPer360`／`adsCmPer360` 一併回 `undefined`。
 */

/** 吋→公分。DPI 是 counts per inch，故 `cm/360 = counts/360 ÷ dpi × 2.54`。 */
export const CM_PER_INCH = 2.54;

/**
 * `resolveMouseGain()` 要求 `hipFovDeg` 為正有限數，但該值**只在 `ads` 分支**被讀
 * （`ratio * (fovDeg / hipFovDeg)`）。`meta.fovDeg` 缺席時本模組一律不帶 `ads` 呼叫，
 * 故此值對結果不可能有影響 —— 它是為了通過參數檢查的惰性佔位，不是對 FOV 的猜測。
 * （`hipCountsPer360WithoutFov === hipCountsPer360WithFov` 由測試釘死。）
 */
const HIP_ONLY_FOV_PLACEHOLDER = 1;

export interface MouseThrow {
  /** hip 態轉一整圈所需的 mouse counts = `2π ÷ hipStep`。恆可推導（不需 DPI）。 */
  readonly countsPer360: number;
  /** hip 態轉一整圈所需的實體行程（cm）。`meta.dpi` 缺席時 `undefined`。 */
  readonly cmPer360: number | undefined;
  /** ADS 態的 counts/360。武器無 ADS 光學、或 `meta.fovDeg` 缺席時 `undefined`。 */
  readonly adsCountsPer360: number | undefined;
  /** ADS 態的 cm/360。上列任一前提缺席、或 `meta.dpi` 缺席時 `undefined`。 */
  readonly adsCmPer360: number | undefined;
  /** 本次推導實際用到的 self-reported DPI；缺席即 `undefined`（供呼叫端揭露資料完整度）。 */
  readonly dpi: number | undefined;
}

/**
 * @throws `meta.sensitivity`（或宣告了的 ADS 欄位）非正有限時，由 `resolveMouseGain()` 擲錯 ——
 *   刻意不吞：一個沒有合法感度的匯出無法推導行程，回 0 或 NaN 只會讓錯誤往下游流。
 */
export function deriveMouseThrow(payload: ExportPayload): MouseThrow {
  const meta = payload.meta;
  const dpi = isFinitePositive(meta.dpi) ? meta.dpi : undefined;
  const ads = meta.fovDeg !== undefined ? meta.weapon?.ads : undefined;

  const gain = resolveMouseGain({
    sensitivity: meta.sensitivity,
    hipFovDeg: meta.fovDeg ?? HIP_ONLY_FOV_PLACEHOLDER,
    ...(ads !== undefined ? { ads } : {}),
  });

  const countsPer360 = countsPerTurn(gain.hipStep);
  const adsCountsPer360 = ads === undefined ? undefined : countsPerTurn(gain.adsStep);

  return {
    countsPer360,
    cmPer360: cmPerTurn(countsPer360, dpi),
    adsCountsPer360,
    adsCmPer360: adsCountsPer360 === undefined ? undefined : cmPerTurn(adsCountsPer360, dpi),
    dpi,
  };
}

/** rad/count → counts/360。 */
function countsPerTurn(radPerCount: number): number {
  return (2 * Math.PI) / radPerCount;
}

/** counts/360 → cm/360；DPI 缺席時不猜。 */
function cmPerTurn(countsPer360: number, dpi: number | undefined): number | undefined {
  if (dpi === undefined) return undefined;
  return (countsPer360 / dpi) * CM_PER_INCH;
}

function isFinitePositive(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
