import type { ExportPayload } from '../data/export.ts';
import { omegaDegPerSec } from './angularKinematics.ts';
import { deriveDetectionMetrics } from './detectionDerivation.ts';
import type { SpiderShotMetricsOptions } from './spiderShotMetrics.ts';
import { deriveTrackingSamples } from './trackingDerivation.ts';

/**
 * spiderShotRepositioning —— WP-57 / T5（README §2.8）：把「低感度選手被迫抬滑鼠重新定位」這個
 * 混淆因子從隱形變成**可見**。
 *
 * **為什麼要它**：wide flick 單邊 yaw 約 50°，中心↔周邊來回接近 100° 峰對峰。cm/360 = 80 的選手
 * 單次就要 22.2 cm 行程，已超過多數滑鼠墊。被迫抬滑鼠是**完全不同的運動行為**（中斷 + 重置），
 * 會在 `movementTimeMs`／`overshootDeg` 產生大離群值，且系統性與感度相關 —— 不標註，感度就會
 * 偷渡成混淆因子。
 *
 * ⚠️ **這是資料品質標註，不是構念（C-D3 / GD-20）。** 本模組**不得**被 `diagnosisRules.ts`、
 * 教練報告產生路徑（`ResultPresentation.ts`／`ResultDetailBody.ts`／`sessionHistory.ts`）或
 * `DrillMetricRegistry` 引用；該邊界由 `spiderShotRepositioning.test.ts` 的靜態掃描守住。
 *
 * ⚠️ **本旗標與「刻意停頓」在觀測上不可完全分離。** 兩者在角速度軌跡上都是「窗內一段近零 ω」；
 * 唯一的差別（手離開滑鼠墊）沒有任何感測器記錄。門檻只能把兩者的分布推開，不能分辨個案 ——
 * 故名稱一律保留 `Suspicion` 語意，不得出現 `repositioningCount` 之類看起來像指標的名稱。
 *
 * **C-D4（既有構念不得有第二定義）**：
 * - 角速度一律走 `omegaDegPerSec()`（KI-005 A1 後的 `ticks[].dYaw`／`dPitch` 事件時間戳積分），
 *   本檔零 ω 計算。
 * - 偵測窗兩個邊界皆取自既有 canonical derivations —— 左界 = `deriveDetectionMetrics()` 的
 *   `tDetectMs`（movement onset），右界 = `deriveTrackingSamples()` 的首個 `onTarget` 樣本。
 *   這正是 `spiderShotMetrics.ts` 算 `movementTimeMs` 用的同一組邊界，故本旗標標註的區間與它
 *   保護的指標**逐格對齊**，不自建第二套 onset／on-target 判定。
 *
 * **對 pre-KI-005 匯出直接拒絕**：`omegaDegPerSec()` 對缺 `ticks.dYaw`／`dPitch` 的匯出擲錯而非
 * 退回舊的 aim-diff 推導（那條路帶 render/sim beat-aliasing bug）。本模組繼承同一個拒絕，且**在
 * 檢查有無可推導的窗之前**就計算 ω —— 沒有逐 tick 滑鼠積分的匯出，本旗標一格資料都產不出來，
 * 回空陣列會把「這份匯出不支援」偽裝成「量過且乾淨」。
 *
 * 純函式：不讀時鐘、不讀隨機、不 import DOM／three、無 I/O。
 */

export interface RepositioningSuspicion {
  readonly targetId: string;
  /** 窗內存在長度 ≥ `stallMinMs` 的近零角速度區段。**疑慮**，不是判定。 */
  readonly suspected: boolean;
  /** 最長合格停滯區段的起點（ms，與 `ticks[].t` 同時鐘域）。`suspected === false` 時省略。 */
  readonly stallStartMs?: number;
  /** 該區段長度（ms）。`suspected === false` 時省略。 */
  readonly stallDurationMs?: number;
}

/**
 * `detection`／`tracking` 沿用 `SpiderShotMetricsOptions` 的**同一組**旋鈕（README §2.8 的簽章只
 * 列了兩個門檻）。這不是可有可無的方便：呼叫端若用與 `deriveSpiderShotMetrics()` 不同的推導參數，
 * 窗界就會與 `movementTimeMs` 的窗界靜默分歧，等於替 onset／on-target 開了第二套定義（C-D4）。
 * 故此處刻意讓兩者共用型別，逼呼叫端傳同一份 options。
 */
export interface RepositioningSuspicionOptions extends SpiderShotMetricsOptions {
  /** 判為疑慮所需的最短連續近零區段長度（ms）。 */
  readonly stallMinMs: number;
  /** 「近零」的角速度上界（deg/s，取絕對值比較）。 */
  readonly stallOmegaDegPerSec: number;
}

type VisibleEvent = Extract<ExportPayload['events'][number], { type: 'visible' }>;

interface StallSegment {
  readonly startMs: number;
  readonly durationMs: number;
}

const EPSILON = 1e-9;

/**
 * 每個 **center-to-peripheral 抵達**一列。作用域與 `deriveSpiderShotMetrics()` 的
 * `movementExecution`／`stopControl` 相同（`zone === 'peripheral'`）—— 那正是本旗標要保護的指標
 * 表面；回中心的那一腿目前不進任何構念，故不標註（回中心若也要標，是晉升 WP 的決定，不是這裡）。
 *
 * **缺列 ≠ 乾淨**。只有「窗可推導」的抵達才會出現：
 * - movement onset 缺席（detection `timeout`，玩家整段沒往目標動）→ 不出列。窗界不存在時回
 *   `suspected: false` 會把「沒量到」偽裝成「量過且乾淨」。
 * - 從未 on-target（acquisition failure）→ **仍出列**，右界改用該 presentation 結束
 *   （`windowEndMs`，最後一顆目標為 `Infinity` ⇒ 由資料尾端自然截斷）。抓不到目標又長時間近零
 *   正是抬滑鼠最強的訊號，把它排除掉會剛好漏掉最該標的個案。
 *
 * @throws 兩個門檻非正有限時擲錯 —— 不吞：門檻無效時回 `suspected: false` 只會讓錯誤往下游流。
 */
export function deriveRepositioningSuspicion(
  payload: ExportPayload,
  options: RepositioningSuspicionOptions,
): readonly RepositioningSuspicion[] {
  const stallMinMs = positiveFinite(options.stallMinMs, 'stallMinMs');
  const stallOmegaDegPerSec = positiveFinite(options.stallOmegaDegPerSec, 'stallOmegaDegPerSec');

  const ticks = payload.ticks.slice().sort((a, b) => a.t - b.t);
  if (ticks.length === 0) return [];
  const omega = omegaDegPerSec(ticks).values;

  const detection = new Map(
    deriveDetectionMetrics(payload, options.detection).presentations.map((p) => [p.targetId, p]),
  );
  const tracking = new Map(
    deriveTrackingSamples(payload, options.tracking).presentations.map((p) => [p.targetId, p]),
  );

  const peripheral = payload.events
    .filter((event): event is VisibleEvent => event.type === 'visible' && event.zone === 'peripheral')
    .slice()
    .sort((a, b) => a.t - b.t);

  const suspicions: RepositioningSuspicion[] = [];
  for (const event of peripheral) {
    const windowStartMs = detection.get(event.targetId)?.tDetectMs;
    const presentation = tracking.get(event.targetId);
    if (windowStartMs === undefined || presentation === undefined) continue;

    const windowEndMs = presentation.samples.find((sample) => sample.onTarget)?.t ?? presentation.windowEndMs;
    const stall = longestStall(ticks, omega, windowStartMs, windowEndMs, stallOmegaDegPerSec);
    const suspected = stall !== undefined && stall.durationMs + EPSILON >= stallMinMs;

    suspicions.push({
      targetId: event.targetId,
      suspected,
      ...(suspected && stall !== undefined
        ? { stallStartMs: stall.startMs, stallDurationMs: stall.durationMs }
        : {}),
    });
  }
  return suspicions;
}

/**
 * 窗 `[windowStartMs, windowEndMs)` 內最長的連續近零區段。
 *
 * `omega[i]` 描述的是 `(ticks[i-1].t, ticks[i].t]` 這段區間的平均角速度（`omega[0]` 依契約為
 * `NaN`），故一段索引 `a..b` 的合格樣本涵蓋的時間是 `ticks[a-1].t → ticks[b].t`。起點在窗左界
 * 之前時夾到窗左界，讓回報的區段恆落在窗內。
 */
function longestStall(
  ticks: readonly ExportPayload['ticks'][number][],
  omega: readonly number[],
  windowStartMs: number,
  windowEndMs: number,
  stallOmegaDegPerSec: number,
): StallSegment | undefined {
  let best: StallSegment | undefined;
  let runStart = -1;

  for (let i = 0; i < ticks.length; i++) {
    const t = ticks[i].t;
    const inWindow = t + EPSILON >= windowStartMs && t + EPSILON < windowEndMs;
    const stalled =
      inWindow && i >= 1 && Number.isFinite(omega[i]) && Math.abs(omega[i]) < stallOmegaDegPerSec;
    if (stalled) {
      if (runStart < 0) runStart = i;
      continue;
    }
    if (runStart >= 0) {
      best = longer(best, segment(ticks, runStart, i - 1, windowStartMs));
      runStart = -1;
    }
  }
  if (runStart >= 0) best = longer(best, segment(ticks, runStart, ticks.length - 1, windowStartMs));
  return best;
}

function segment(
  ticks: readonly ExportPayload['ticks'][number][],
  firstIndex: number,
  lastIndex: number,
  windowStartMs: number,
): StallSegment {
  const startMs = Math.max(ticks[firstIndex - 1].t, windowStartMs);
  return { startMs, durationMs: ticks[lastIndex].t - startMs };
}

function longer(current: StallSegment | undefined, candidate: StallSegment): StallSegment {
  return current === undefined || candidate.durationMs > current.durationMs ? candidate : current;
}

function positiveFinite(value: number, path: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${path} must be a positive finite number`);
  return value;
}
