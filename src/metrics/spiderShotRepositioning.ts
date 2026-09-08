import type { ExportPayload } from '../data/export.ts';
import { omegaDegPerSec } from './angularKinematics.ts';
import { deriveDetectionMetrics, type DetectionDerivationOptions } from './detectionDerivation.ts';
import { deriveTrackingSamples, type TrackingDerivationOptions } from './trackingDerivation.ts';

/**
 * spiderShotRepositioning —— WP-57 / T5（FR-57.12、README §2.8）：把「拉槍中途疑似抬滑鼠重新定位」
 * 標註出來。
 *
 * **為什麼需要它**：本 drill 單邊 yaw 約 50°，中心↔周邊來回接近 100° 峰對峰。以
 * `deriveMouseThrow()`（`mouseThrow.ts`）算出的 `cm/360` 換算，80 cm/360 的選手單次來回需要約
 * 22 cm 實體行程，已超過多數滑鼠墊的可用行程 ⇒ 他必須抬起滑鼠重新定位。那是**完全不同的運動行為**
 * （中斷 + 重置），會在 `movementTimeMs`／`overshootDeg` 留下大離群值，且系統性地與感度相關。不標註，
 * 感度就會以離群值的形式偷渡成混淆因子。
 *
 * **這是資料品質標註，不是構念（C-D3）**。型別與欄位一律用 `Suspicion` 語意，刻意不提供
 * `repositioningCount`／rate 之類看起來像指標的輸出；本模組**不得**被 `diagnosisRules.ts`、
 * 教練報告產生路徑或 `DrillMetricRegistry` 引用（由 `spiderShotRepositioning.test.ts` 的 boundary
 * scan 釘死）。它與「玩家刻意停頓」在觀測上**不可完全分離** —— 這是近似，不是判定。
 *
 * **沒有第二套定義（C-D4）**：
 * - 角速度一律走 `omegaDegPerSec()`（KI-005 A1 後的事件時間戳積分，`angularKinematics.ts`）；
 * - 偵測窗兩端一律走既有 canonical derivations —— 起點 = `deriveDetectionMetrics()` 的
 *   `tDetectMs`（sustained movement onset）、終點 = `deriveTrackingSamples()` 的首個 `onTarget`
 *   樣本時間。這正是 `deriveSpiderShotMetrics()` 用來定義 `movementTimeMs` 的同一對邊界，故本旗標
 *   標的就是那段區間內部發生的事，不是另開一個窗。
 *
 * 純函式：不讀時鐘、不讀隨機、不 import DOM／three／`node:*`／`fs`。
 */

/** 一次 center→peripheral 抵達的抬滑鼠疑慮標註。 */
export interface RepositioningSuspicion {
  readonly targetId: string;
  /** 窗內存在長度 ≥ `stallMinMs` 且 `abs(omega) < stallOmegaDegPerSec` 的連續區段。 */
  readonly suspected: boolean;
  /**
   * 觸發區段的起點（ms，payload 時鐘域）。**只在 `suspected` 時出現** —— 未達門檻的次長停滯不回報，
   * 否則這兩欄很容易被當成「停滯程度」的連續量來用，那就是把品質標註偷渡成構念（C-D3）。
   */
  readonly stallStartMs?: number;
  /**
   * 觸發區段的長度（ms）= 該連續區段首、末兩個合格 ω 樣本的時間差。
   *
   * ω 樣本 `i` 描述的是區間 `(t[i−1], t[i]]` 的平均角速度，故此定義比「真實停滯長度」**少算最多一個
   * tick 間隔**。刻意選保守側：本旗標寧可漏報也不要虛報一段不存在的停滯。
   */
  readonly stallDurationMs?: number;
}

export interface RepositioningSuspicionOptions {
  /**
   * 觸發所需的最短停滯長度（ms，非負有限）。**門檻未凍結**（OQ-57.5），刻意不給預設值。
   * 2026-09-08 以四份真人 run 校準後的交付值為 `150`（見 WP-57 progress §T5-real）。
   */
  readonly stallMinMs: number;
  /**
   * 判定「停滯」的角速度上界（deg/s，正有限）。真人校準值為 `2` —— 比合成期建議的 `15` 緊得多，
   * 因為寬鬆門檻抓到的是拉槍中途的正常減速（`15` 會標掉 44% 的「全程不抬滑鼠」對照 run）。
   * ⚠️ 該值條件於錄製機器的取樣特性，換硬體須複驗。
   */
  readonly stallOmegaDegPerSec: number;
  /** 傳給 canonical detection derivation；省略即該模組自身的預設值。 */
  readonly detection?: DetectionDerivationOptions;
  /** 傳給 canonical tracking derivation；省略即該模組自身的預設值（含 H1 hitbox 慣例）。 */
  readonly tracking?: TrackingDerivationOptions;
}

const EPSILON = 1e-9;

interface Stall {
  readonly startMs: number;
  readonly durationMs: number;
}

/**
 * 對每個 `zone: 'peripheral'` 的抵達輸出一筆標註（與 `deriveSpiderShotMetrics()` 的逐目標構念同一
 * 母體；回中心不是拉槍，不標註）。
 *
 * 窗界任一端缺席 —— detection `timeout`（沒有 `tDetectMs`）或 acquisition failure（整段沒有
 * `onTarget` 樣本）—— 一律回 `suspected: false` 且不帶欄位。**這是「無從判定」，不是「已判定沒有抬
 * 滑鼠」**；呼叫端若要區分兩者，請對照 canonical derivations 的 `status`／`acquisitionFailure`。
 *
 * @throws `stallMinMs` 非負有限、`stallOmegaDegPerSec` 非正有限時擲錯；`omegaDegPerSec()` 亦會對
 *   缺 `ticks.dYaw/dPitch` 的 pre-KI-005 匯出擲錯（刻意不吞：那種匯出的 ω 帶 beat-aliasing bug）。
 */
export function deriveRepositioningSuspicion(
  payload: ExportPayload,
  options: RepositioningSuspicionOptions,
): readonly RepositioningSuspicion[] {
  const stallMinMs = nonNegativeFinite(options.stallMinMs, 'stallMinMs');
  const stallOmegaDegPerSec = positiveFinite(options.stallOmegaDegPerSec, 'stallOmegaDegPerSec');

  const peripheral = payload.events
    .filter((event): event is Extract<ExportPayload['events'][number], { type: 'visible' }> => event.type === 'visible')
    .slice()
    .sort((a, b) => a.t - b.t)
    .filter((event) => event.zone === 'peripheral');
  if (peripheral.length === 0) return [];

  const ticks = payload.ticks.slice().sort((a, b) => a.t - b.t);
  const omega = omegaDegPerSec(ticks).values;
  const onsetByTarget = new Map(
    deriveDetectionMetrics(payload, options.detection).presentations.map((presentation) => [
      presentation.targetId,
      presentation.tDetectMs,
    ]),
  );
  const arrivalByTarget = new Map(
    deriveTrackingSamples(payload, options.tracking).presentations.map((presentation) => [
      presentation.targetId,
      presentation.samples.find((sample) => sample.onTarget)?.t,
    ]),
  );

  return peripheral.map((event) => {
    const onsetMs = onsetByTarget.get(event.targetId);
    const arrivalMs = arrivalByTarget.get(event.targetId);
    if (onsetMs === undefined || arrivalMs === undefined) return { targetId: event.targetId, suspected: false };

    const stall = longestStall(ticks, omega, onsetMs, arrivalMs, stallOmegaDegPerSec);
    if (stall === undefined || stall.durationMs + EPSILON < stallMinMs) {
      return { targetId: event.targetId, suspected: false };
    }
    return {
      targetId: event.targetId,
      suspected: true,
      stallStartMs: stall.startMs,
      stallDurationMs: stall.durationMs,
    };
  });
}

/**
 * 窗 `[windowStartMs, windowEndMs)` 內最長的連續近零角速度區段。
 *
 * 非有限的 ω（`omegaDegPerSec()` 契約上的第一個樣本為 NaN）視為「不合格」而非「停滯」—— 把未知當成
 * 停滯會在每段窗的開頭虛報。
 */
function longestStall(
  ticks: readonly ExportPayload['ticks'][number][],
  omega: readonly number[],
  windowStartMs: number,
  windowEndMs: number,
  thresholdDegPerSec: number,
): Stall | undefined {
  let best: Stall | undefined;
  let runStartMs: number | undefined;
  let runEndMs = 0;

  for (let i = 0; i < ticks.length; i++) {
    const t = ticks[i].t;
    const inWindow = t + EPSILON >= windowStartMs && t + EPSILON < windowEndMs;
    const value = omega[i];
    if (inWindow && Number.isFinite(value) && Math.abs(value) < thresholdDegPerSec) {
      if (runStartMs === undefined) runStartMs = t;
      runEndMs = t;
      continue;
    }
    if (runStartMs !== undefined) {
      best = longer(best, { startMs: runStartMs, durationMs: runEndMs - runStartMs });
      runStartMs = undefined;
    }
  }
  if (runStartMs !== undefined) best = longer(best, { startMs: runStartMs, durationMs: runEndMs - runStartMs });
  return best;
}

/** 同長度時保留較早者，使輸出與 tick 順序一致而非依賴比較的偶然結果。 */
function longer(current: Stall | undefined, candidate: Stall): Stall {
  if (current === undefined) return candidate;
  return candidate.durationMs > current.durationMs ? candidate : current;
}

function nonNegativeFinite(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative finite number`);
  return value;
}

function positiveFinite(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive finite number`);
  return value;
}
