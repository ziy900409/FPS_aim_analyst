/**
 * WP-61 T2 —— 感測器離地標註 cohort 的**可用性／標註完整性／資料充分性**稽核。
 *
 * **它要回答的問題**：這批 run 能不能拿去跑 T3 的可分性消融？三個答案都是一級交付物：
 * `sufficient`（可以）、`blocked-by-data`（資料不夠，差多少寫清楚）、`annotation-channel-unusable`
 * （標籤本身有系統性偏差 ⇒ 直接跳 T-exit，**不得**進 T3）。
 *
 * **為什麼稽核要在分析之前**：用一批髒標籤跑消融，得到的「分不開」無法歸因 —— 是訊號沒有，還是標籤
 * 太髒？那比不跑更糟，因為它會被當成結論引用（T2 task 檔的開頭警語）。
 *
 * **這裡的每一個門檻都在 T0 凍結**（D-61.T0-1，`progress.md` §Pre-registration）。看過資料之後只能
 * 升版，不得改值（GD-20 / FR-61.5 / D-61.P6）。凍結值以 `const` 具名於下，讓「換了門檻」在 diff 裡
 * 看得見。
 *
 * **本模組不指派標籤**（FR-61.3）。它量的是「標註時刻離最近的候選空洞邊界多遠」這個**距離**，用來
 * 否證 §1.4 的假設（lift 與 pause 的自報延遲無系統性差異）。把候選空洞配上 `lift`／`pause`／`none`
 * 標籤的 one-to-one greedy pairing 只有一個定義，在 Python 側 `research/src/lift/`（D-61.P4）。
 *
 * 間隙一律走 `segmentByTimeGap()`、中斷區間一律走 `deriveUnlockedIntervals()`、取樣健康度一律走
 * `deriveSamplingHealth()`（C-D4 單一定義）。純函式：不讀時鐘、不讀隨機、無 I/O。
 */
import type { DrillEvent } from '../src/data/DataRecorder.ts';
import type { ExportPayload } from '../src/data/export.ts';
import { segmentByTimeGap, type SampleGap, type TimeInterval } from '../src/metrics/mouseSampleGaps.ts';
import { deriveSamplingHealth } from './mouseSamplingHealth.ts';

// ─────────────────────────────────────────────────────────────────────────────
// T0 凍結契約（D-61.T0-1）。事後只能升版，不得改值。
// ─────────────────────────────────────────────────────────────────────────────

/** 評估契約版本。任何一個下列常數變動 ⇒ 升版，不得原地改值。 */
export const LIFT_VALIDATION_CONTRACT = 'sensor-lift-validation-v1';

/** θ sweep（ms）：WP-60 R1 的 18.2 ms 雜訊底線近似／PA v3 的 30 ms prior／保守的 50 ms 上界。 */
export const GAP_THRESHOLD_SWEEP_MS = [18, 30, 50] as const;

/** cohort 一律錄在 240 Hz 顯示器；不等於即作廢該 run（D-61.U3，禁止混合更新率）。 */
export const REQUIRED_DISPLAY_HZ = 240;

/** 連續期間事件率下限（Hz）—— 量在 segment 內，不是整段平均（D-60.X1）。 */
export const MIN_ACTIVE_RATE_HZ = 500;

/** 事件匹配容差（ms）：D-61.U2 的約 200 ms 自報反應時間 + WP-57 §T5-real 的 180–225 ms lift 事件長度。 */
export const ANNOTATION_MATCH_TOLERANCE_MS = 300;

/** 資料充分性下限（NFR-61.7）。 */
export const MIN_SESSIONS = 2;
export const MIN_INTERVALS_PER_CLASS = 30;
export const MIN_HELD_OUT_INTERVALS_PER_CLASS = 10;

/** 標註完整性：lift／pause 自報延遲的組間差上限（ms）。超過即宣告標註通道不可用。 */
export const MAX_LATENCY_MEDIAN_DIFF_MS = 150;
export const MAX_LATENCY_P90_DIFF_MS = 300;

/** 標註數與 expected trials 的差額上限。**這是一個函式而非常數** —— 它條件於該 run 的 trial 數。 */
export function annotationCountToleranceFor(expectedTrials: number): number {
  return Math.max(1, Math.floor(0.05 * expectedTrials));
}

/** 錄製協定的封閉指示類別（`spider-wide-recording-spec.md` §3.3）。 */
export const INSTRUCTION_CLASSES = ['lift', 'pause', 'oneshot'] as const;
export type InstructionClass = (typeof INSTRUCTION_CLASSES)[number];

export function isInstructionClass(value: unknown): value is InstructionClass {
  return typeof value === 'string' && (INSTRUCTION_CLASSES as readonly string[]).includes(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// 標註區間
// ─────────────────────────────────────────────────────────────────────────────

/** 一段自報標註區間（`KeyL` down → up）。時間為 payload 時鐘域的 ms。 */
export interface AnnotationInterval {
  readonly startMs: number;
  readonly endMs: number;
}

export interface AnnotationExtraction {
  readonly intervals: readonly AnnotationInterval[];
  /** 事件總數（down + up）。與 `intervals.length * 2` 不等即代表有成對性問題。 */
  readonly eventCount: number;
  /**
   * 成對性違規數：重複 down（前一段未關就再開）、無主 up（沒有 down 就 up）、run 結束時仍未關的
   * down，各記一次。**違規的那一段一律丟棄** —— 一個端點不明的區間，其匹配結果不可稽核。
   */
  readonly pairViolations: number;
}

/**
 * 從匯出事件串抽出標註區間（FR-61.11）。
 *
 * 事件依 `t` 升冪處理（匯出本身已升冪，這裡不重排以免掩蓋錄製端的順序問題；只在偵測到倒退時記一次
 * 違規）。**不做任何補救** —— 漏按就是漏按，補一個推測的端點會讓標註不再獨立於資料（FR-61.3）。
 */
export function extractAnnotationIntervals(events: readonly DrillEvent[]): AnnotationExtraction {
  const intervals: AnnotationInterval[] = [];
  let eventCount = 0;
  let pairViolations = 0;
  let openStartMs: number | undefined;
  let previousMs: number | undefined;

  for (const event of events) {
    if (event.type !== 'annotation') continue;
    eventCount++;
    if (previousMs !== undefined && event.t < previousMs) pairViolations++;
    previousMs = event.t;

    if (event.down) {
      // 前一段還開著就再按下 ⇒ 前一段沒有 up。丟棄前一段，改以本次為新的開頭。
      if (openStartMs !== undefined) pairViolations++;
      openStartMs = event.t;
      continue;
    }
    if (openStartMs === undefined) {
      pairViolations++;
      continue;
    }
    intervals.push({ startMs: openStartMs, endMs: Math.max(openStartMs, event.t) });
    openStartMs = undefined;
  }

  if (openStartMs !== undefined) pairViolations++;
  return { intervals, eventCount, pairViolations };
}

// ─────────────────────────────────────────────────────────────────────────────
// 逐 run 稽核（T2 step 2／3）
// ─────────────────────────────────────────────────────────────────────────────

export interface LiftRunInput {
  readonly sourcePath: string;
  readonly payload: ExportPayload;
  /** manifest 的 `instructionClass`。缺席即無法歸組 ⇒ 作廢（沒有它就不知道這些標註代表什麼）。 */
  readonly instructionClass?: InstructionClass;
  /** manifest 的 `sessionId`。FR-61.7 的分割隔離靠它；缺席即作廢。 */
  readonly sessionId?: string;
  /** manifest 的 `recordedAt`（ISO 8601）。缺席時分割改用檔名時間，再缺就用 manifest 順序。 */
  readonly recordedAt?: string;
  /** manifest 的 `order`（人填的錄製順序）。 */
  readonly order?: number;
}

export interface LiftRunAudit {
  readonly sourcePath: string;
  readonly sessionId: string | undefined;
  readonly instructionClass: InstructionClass | undefined;

  // ── step 2：逐份可用性覆核（六項，每項都有實際值）────────────────────────────
  readonly crossOriginIsolated: boolean;
  readonly displayHz: number;
  readonly dpi: number | undefined;
  readonly recordedSamples: number | undefined;
  readonly sampleOverflow: boolean | undefined;
  readonly activeRateHz: number | undefined;
  readonly unlockedIntervalCount: number | undefined;

  // ── step 3：標註完整性稽核（FR-61.11）──────────────────────────────────────
  readonly annotationEventCount: number;
  readonly annotationIntervalCount: number;
  /** block 設計的 trial 數 = peripheral `visible` 事件數（T0 凍結的 trial 定義）。 */
  readonly expectedTrials: number;
  /** `annotationIntervalCount - expectedTrials`（帶正負號：漏按為負，多按為正）。 */
  readonly trialDelta: number;
  readonly trialDeltaLimit: number;
  readonly pairViolations: number;
  readonly annotationsInUnlocked: number;

  /** 每個 θ 下、未被 Pointer Lock 解釋的候選空洞數。 */
  readonly candidateCountsByTheta: readonly { readonly thetaMs: number; readonly candidateCount: number }[];

  /** `true` = 可進 cohort。`false` 時 `voidReasons` 逐條說出**哪一項**不過。 */
  readonly usable: boolean;
  readonly voidReasons: readonly string[];
}

/**
 * 逐份稽核。**作廢是丟掉整份 run，不是丟掉不方便的事件**；規則在 T0 凍結，本函式只執行。
 *
 * ⚠️ `oneshot` run **不套用** trial 差額閘。它的指示是「一次到位，遇到實際抬滑鼠才標註」——
 * 標註數本來就遠少於 trial 數，套用會把整個 oneshot 負例組作廢掉。凍結契約寫的是「interval 數與
 * expected trials 差額」，而 expected trials 這個概念只在 `lift`／`pause` 這種「每個 trial 都標」
 * 的 block 設計下成立（見 `spider-wide-recording-spec.md` §3.3 的三段 instruction 文字）。
 * 這是**契約的適用範圍**，不是放寬門檻：成對性與 unlocked 兩個閘對 `oneshot` 照樣生效。
 */
export function auditLiftRuns(inputs: readonly LiftRunInput[]): readonly LiftRunAudit[] {
  return inputs.map((input) => auditRun(input));
}

function auditRun(input: LiftRunInput): LiftRunAudit {
  const { payload, sourcePath, instructionClass, sessionId } = input;
  const meta = payload.meta;
  const voidReasons: string[] = [];

  if (instructionClass === undefined) {
    voidReasons.push(
      `manifest 缺 \`instructionClass\`（封閉值 ${INSTRUCTION_CLASSES.join('／')}）⇒ 這些標註代表什麼無從得知`,
    );
  }
  if (sessionId === undefined) {
    voidReasons.push('manifest 缺 `sessionId` ⇒ 校準／held-out 無法依 session 隔離（FR-61.7）');
  }

  if (!meta.crossOriginIsolated) {
    voidReasons.push('`meta.crossOriginIsolated: false` ⇒ 時間戳鈍化到 100 µs 級，整份作廢（WP-60 F4）');
  }
  if (meta.displayHz !== REQUIRED_DISPLAY_HZ) {
    voidReasons.push(
      `\`meta.displayHz\` = ${meta.displayHz}，非 ${REQUIRED_DISPLAY_HZ} ⇒ 作廢（D-61.U3：顯示更新率` +
        '同時改變 aim 更新率與 `meta.suspect`，混批是顯性 confound）',
    );
  }
  const dpi = typeof meta.dpi === 'number' && Number.isFinite(meta.dpi) ? meta.dpi : undefined;
  if (dpi === undefined) {
    voidReasons.push('`meta.dpi` 缺席 ⇒ 錄製條件不可稽核（`spider-wide-recording-spec.md` §2.3）');
  }

  const sampling = deriveSamplingHealth(payload, ANNOTATION_GAP_PROBE_MS);
  const recordedSamples = meta.mouseSampling?.recorded;
  if (sampling === undefined) {
    voidReasons.push('無 `mouseSamples` 區塊 ⇒ 沒有候選空洞可判定（錄製時未加 `?rawMouse=1`）');
  } else {
    if (recordedSamples === undefined || recordedSamples <= 0) {
      voidReasons.push(`\`meta.mouseSampling.recorded\` = ${recordedSamples ?? '缺席'} ⇒ 未錄到任何原始取樣`);
    }
    if (sampling.sampleOverflow === true) {
      voidReasons.push(`原始取樣溢位（recorded ${sampling.sampleCount} 已達容量上限）⇒ 末段缺失，整份作廢`);
    }
    if (sampling.activeRateHz === undefined) {
      voidReasons.push('連續期間事件率無從量測（可用間隔數為 0）⇒ 不是 0 Hz，是量不到');
    } else if (sampling.activeRateHz < MIN_ACTIVE_RATE_HZ) {
      voidReasons.push(
        `連續期間事件率 ${sampling.activeRateHz.toFixed(0)} Hz < ${MIN_ACTIVE_RATE_HZ} Hz ⇒ 時間間隙判定不可用（D-60.X1）`,
      );
    }
    if (sampling.lockBreakCount > 0) {
      voidReasons.push(
        `Pointer Lock 中斷 ${sampling.lockBreakCount} 次 ⇒ 依 T0 凍結規則列為污染（未取鎖期間的移動整筆丟棄，FR-A-8）`,
      );
    }
  }

  const annotation = extractAnnotationIntervals(payload.events);
  const expectedTrials = countPeripheralTrials(payload.events);
  const trialDelta = annotation.intervals.length - expectedTrials;
  const trialDeltaLimit = annotationCountToleranceFor(expectedTrials);
  const unlockedIntervals = sampling?.unlockedIntervals ?? [];
  const annotationsInUnlocked = annotation.intervals.filter((interval) =>
    overlapsAnyInterval(interval, unlockedIntervals),
  ).length;

  if (annotation.intervals.length === 0) {
    voidReasons.push('零個有效標註區間 ⇒ 無標籤可用（錄製時未加 `?annotation=1`，或全程未按 `KeyL`）');
  }
  if (annotation.pairViolations > 0) {
    voidReasons.push(`標註成對性違規 ${annotation.pairViolations} 次（T0 凍結上限 0）⇒ 作廢`);
  }
  if (annotationsInUnlocked > 0) {
    voidReasons.push(`${annotationsInUnlocked} 個標註落在 Pointer Lock 未取鎖區間內（T0 凍結上限 0）⇒ 作廢`);
  }
  if (instructionClass !== 'oneshot' && Math.abs(trialDelta) > trialDeltaLimit) {
    voidReasons.push(
      `標註數 ${annotation.intervals.length} 與 expected trials ${expectedTrials} 差 ${trialDelta}，` +
        `超過凍結上限 ±${trialDeltaLimit} ⇒ 作廢`,
    );
  }

  const candidateCountsByTheta = GAP_THRESHOLD_SWEEP_MS.map((thetaMs) => ({
    thetaMs,
    candidateCount:
      payload.mouseSamples === undefined
        ? 0
        : segmentByTimeGap(payload.mouseSamples, thetaMs, unlockedIntervals).gaps.length,
  }));

  return {
    sourcePath,
    sessionId,
    instructionClass,
    crossOriginIsolated: meta.crossOriginIsolated,
    displayHz: meta.displayHz,
    dpi,
    recordedSamples,
    sampleOverflow: sampling?.sampleOverflow,
    activeRateHz: sampling?.activeRateHz,
    unlockedIntervalCount: sampling?.lockBreakCount,
    annotationEventCount: annotation.eventCount,
    annotationIntervalCount: annotation.intervals.length,
    expectedTrials,
    trialDelta,
    trialDeltaLimit,
    pairViolations: annotation.pairViolations,
    annotationsInUnlocked,
    candidateCountsByTheta,
    usable: voidReasons.length === 0,
    voidReasons,
  };
}

/**
 * 取樣健康度在本模組內用的探測門檻（ms）。
 *
 * **不是判準，也不是 sweep 的一員。** `activeRateHz` 要的是「排除空洞之後的連續期間事件率」，那個量
 * 對門檻並不敏感（18／30／50 ms 之間的差別是幾個 20 ms 級的間隔算不算進去）；沿用 WP-60 報告用的
 * 30 ms，讓可用性判定與既有 `analyze:spider-wide` 的那一欄**同一個數字**，不製造兩個「事件率」。
 * 候選空洞本身一律走 `GAP_THRESHOLD_SWEEP_MS` 的三個值（見 `candidateCountsByTheta`）。
 */
const ANNOTATION_GAP_PROBE_MS = 30;

/** T0 凍結的 trial 定義：由 peripheral `visible` 開始。這裡只數開頭，不重建窗界。 */
function countPeripheralTrials(events: readonly DrillEvent[]): number {
  let count = 0;
  for (const event of events) {
    if (event.type === 'visible' && event.zone === 'peripheral') count++;
  }
  return count;
}

/** 實質重疊（長度 > 0）。端點相接不算 —— 比照 `mouseSampleGaps.ts` 的 `overlapsAny()`。 */
function overlapsAnyInterval(interval: AnnotationInterval, others: readonly TimeInterval[]): boolean {
  for (const other of others) {
    if (Math.max(interval.startMs, other.startMs) < Math.min(interval.endMs, other.endMs)) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// F3 檢定：自報延遲的組間差（T2 step 4）
// ─────────────────────────────────────────────────────────────────────────────

export interface LatencyQuantiles {
  readonly p10: number;
  readonly p50: number;
  readonly p90: number;
  readonly n: number;
}

export interface AnnotationChannelAssessment {
  readonly thetaMs: number;
  readonly lift: LatencyQuantiles | undefined;
  readonly pause: LatencyQuantiles | undefined;
  readonly medianDiffMs: number | undefined;
  readonly p90DiffMs: number | undefined;
  /** `indeterminate` = 某一組沒有樣本 ⇒ 檢定不成立。**不是通過**。 */
  readonly verdict: 'usable' | 'annotation-channel-unusable' | 'indeterminate';
  readonly reasons: readonly string[];
}

/**
 * 檢定 §1.4 的假設：lift 與 pause 兩組的自報延遲**無系統性差異**。
 *
 * 延遲的定義（T2 step 4 的「標註時刻 − 最近候選空洞邊界」）在此具體化為：對每一段標註區間，取
 * `annotationStartMs - gap.startMs`，其中 gap 是使 `|annotationStartMs - gap.startMs|` 最小的候選
 * 空洞。用 gap 的**起始**邊界而非兩端最近者，是因為受測者反應的是「空洞開始」那個動作（抬起／停住），
 * 這個量因此可直接讀成反應時間；取兩端最近者會讓同一個動作在長空洞與短空洞上得到不同符號的值。
 *
 * ⚠️ **這不是標籤指派**（FR-61.3）。它只量距離，不宣稱那個空洞是什麼；配標籤的 one-to-one greedy
 * pairing 只有一個定義，在 Python 側。
 *
 * 判定為 `annotation-channel-unusable` 時，**T2 到此停止**，走 FR-61.8 的「證據不足」路徑，不得續行 T3。
 */
export function assessAnnotationChannel(
  runs: readonly { readonly audit: LiftRunAudit; readonly payload: ExportPayload }[],
  thetaMs: number,
): AnnotationChannelAssessment {
  const reasons: string[] = [];
  const lift: number[] = [];
  const pause: number[] = [];

  for (const { audit, payload } of runs) {
    if (!audit.usable) continue;
    if (audit.instructionClass !== 'lift' && audit.instructionClass !== 'pause') continue;
    const block = payload.mouseSamples;
    if (block === undefined) continue;

    const sampling = deriveSamplingHealth(payload, ANNOTATION_GAP_PROBE_MS);
    const gaps = segmentByTimeGap(block, thetaMs, sampling?.unlockedIntervals ?? []).gaps;
    if (gaps.length === 0) {
      reasons.push(`${audit.sourcePath}：θ=${thetaMs} ms 下零個候選空洞 ⇒ 該 run 不貢獻延遲樣本`);
      continue;
    }

    const bucket = audit.instructionClass === 'lift' ? lift : pause;
    for (const interval of extractAnnotationIntervals(payload.events).intervals) {
      bucket.push(interval.startMs - nearestGapStartMs(gaps, interval.startMs));
    }
  }

  const liftQuantiles = quantiles(lift);
  const pauseQuantiles = quantiles(pause);
  if (liftQuantiles === undefined || pauseQuantiles === undefined) {
    reasons.push(
      `lift ${lift.length} 個／pause ${pause.length} 個延遲樣本 —— 某一組為空，F3 檢定不成立。` +
        '**這不是通過**：兩組都要有樣本才談得上「無系統性差異」。',
    );
    return {
      thetaMs,
      lift: liftQuantiles,
      pause: pauseQuantiles,
      medianDiffMs: undefined,
      p90DiffMs: undefined,
      verdict: 'indeterminate',
      reasons,
    };
  }

  const medianDiffMs = Math.abs(liftQuantiles.p50 - pauseQuantiles.p50);
  const p90DiffMs = Math.abs(liftQuantiles.p90 - pauseQuantiles.p90);
  const unusable = medianDiffMs > MAX_LATENCY_MEDIAN_DIFF_MS || p90DiffMs > MAX_LATENCY_P90_DIFF_MS;
  if (unusable) {
    reasons.push(
      `中位數差 ${medianDiffMs.toFixed(1)} ms（上限 ${MAX_LATENCY_MEDIAN_DIFF_MS}）、` +
        `p90 差 ${p90DiffMs.toFixed(1)} ms（上限 ${MAX_LATENCY_P90_DIFF_MS}）⇒ 兩組自報延遲有系統性差異，` +
        '匹配容差本身就會製造可分性假象（README §1.4）',
    );
  }

  return {
    thetaMs,
    lift: liftQuantiles,
    pause: pauseQuantiles,
    medianDiffMs,
    p90DiffMs,
    verdict: unusable ? 'annotation-channel-unusable' : 'usable',
    reasons,
  };
}

function nearestGapStartMs(gaps: readonly SampleGap[], tMs: number): number {
  let best = gaps[0].startMs;
  let bestDistance = Math.abs(tMs - best);
  for (let i = 1; i < gaps.length; i++) {
    const distance = Math.abs(tMs - gaps[i].startMs);
    if (distance < bestDistance) {
      best = gaps[i].startMs;
      bestDistance = distance;
    }
  }
  return best;
}

/** 線性內插分位數（比照 numpy 預設）。樣本數 0 ⇒ `undefined`，不是 0。 */
function quantiles(values: readonly number[]): LatencyQuantiles | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return { p10: quantile(sorted, 0.1), p50: quantile(sorted, 0.5), p90: quantile(sorted, 0.9), n: sorted.length };
}

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

// ─────────────────────────────────────────────────────────────────────────────
// 資料充分性判定（T2 step 7）—— 本 task 的核心產出
// ─────────────────────────────────────────────────────────────────────────────

export interface CohortSplit {
  readonly calibration: readonly string[];
  readonly heldOut: readonly string[];
  readonly heldOutLiftIntervals: number;
  readonly heldOutPauseIntervals: number;
}

export interface CohortSufficiency {
  readonly contract: string;
  readonly verdict: 'sufficient' | 'blocked-by-data';
  readonly usableRunCount: number;
  readonly voidedRunCount: number;
  readonly sessionCount: number;
  readonly liftIntervals: number;
  readonly pauseIntervals: number;
  readonly oneshotIntervals: number;
  readonly candidateCountsByTheta: readonly { readonly thetaMs: number; readonly candidateCount: number }[];
  readonly split: CohortSplit | undefined;
  /** 判 `blocked-by-data` 時逐條寫出**差多少**；`sufficient` 時為空。 */
  readonly shortfalls: readonly string[];
}

/**
 * 對照 NFR-61.7 的下限逐項報告。**未達 ⇒ `blocked-by-data`，寫明差多少，停止**，不得以「先看看」
 * 為由續行 T3。
 */
export function assessCohortSufficiency(audits: readonly LiftRunAudit[]): CohortSufficiency {
  const usable = audits.filter((audit) => audit.usable);
  const shortfalls: string[] = [];

  const sessions = new Set(usable.map((audit) => audit.sessionId).filter((id): id is string => id !== undefined));
  if (sessions.size < MIN_SESSIONS) {
    shortfalls.push(`獨立 session 數 ${sessions.size} < ${MIN_SESSIONS}（差 ${MIN_SESSIONS - sessions.size}）`);
  }

  const liftIntervals = countIntervals(usable, 'lift');
  const pauseIntervals = countIntervals(usable, 'pause');
  const oneshotIntervals = countIntervals(usable, 'oneshot');
  if (liftIntervals < MIN_INTERVALS_PER_CLASS) {
    shortfalls.push(`lift 標註區間 ${liftIntervals} < ${MIN_INTERVALS_PER_CLASS}（差 ${MIN_INTERVALS_PER_CLASS - liftIntervals}）`);
  }
  if (pauseIntervals < MIN_INTERVALS_PER_CLASS) {
    shortfalls.push(
      `pause 標註區間 ${pauseIntervals} < ${MIN_INTERVALS_PER_CLASS}（差 ${MIN_INTERVALS_PER_CLASS - pauseIntervals}）`,
    );
  }

  const candidateCountsByTheta = GAP_THRESHOLD_SWEEP_MS.map((thetaMs) => ({
    thetaMs,
    candidateCount: usable.reduce(
      (total, audit) => total + (audit.candidateCountsByTheta.find((row) => row.thetaMs === thetaMs)?.candidateCount ?? 0),
      0,
    ),
  }));
  for (const row of candidateCountsByTheta) {
    if (row.candidateCount === 0) shortfalls.push(`θ=${row.thetaMs} ms 下零個候選空洞 ⇒ 該 θ 無事可分`);
  }

  const split = splitBySession(usable);
  if (split === undefined) {
    shortfalls.push(`無法做出「每側至少 1 session、同 session 不跨兩側」的 50/50 分割（可用 session ${sessions.size} 個）`);
  } else {
    if (split.heldOutLiftIntervals < MIN_HELD_OUT_INTERVALS_PER_CLASS) {
      shortfalls.push(
        `held-out lift 區間 ${split.heldOutLiftIntervals} < ${MIN_HELD_OUT_INTERVALS_PER_CLASS}` +
          `（差 ${MIN_HELD_OUT_INTERVALS_PER_CLASS - split.heldOutLiftIntervals}）`,
      );
    }
    if (split.heldOutPauseIntervals < MIN_HELD_OUT_INTERVALS_PER_CLASS) {
      shortfalls.push(
        `held-out pause 區間 ${split.heldOutPauseIntervals} < ${MIN_HELD_OUT_INTERVALS_PER_CLASS}` +
          `（差 ${MIN_HELD_OUT_INTERVALS_PER_CLASS - split.heldOutPauseIntervals}）`,
      );
    }
  }

  return {
    contract: LIFT_VALIDATION_CONTRACT,
    verdict: shortfalls.length === 0 ? 'sufficient' : 'blocked-by-data',
    usableRunCount: usable.length,
    voidedRunCount: audits.length - usable.length,
    sessionCount: sessions.size,
    liftIntervals,
    pauseIntervals,
    oneshotIntervals,
    candidateCountsByTheta,
    split,
    shortfalls,
  };
}

function countIntervals(audits: readonly LiftRunAudit[], instructionClass: InstructionClass): number {
  return audits
    .filter((audit) => audit.instructionClass === instructionClass)
    .reduce((total, audit) => total + audit.annotationIntervalCount, 0);
}

/**
 * T0 凍結的分割（FR-61.7）：依 `recordedAt` ／檔名時間／manifest 順序排序，前半 calibration、後半
 * held-out，50/50，每側至少 1 session，**同一個 session 不跨兩側**。
 *
 * session 不可分割 ⇒ 50/50 只能逼近。作法是依 session 的最早 run 排序後逐個累加進 calibration，
 * 直到再加一個就會超過半數為止；兩側各至少一個 session 做不到時回 `undefined`（不是硬湊）。
 */
export function splitBySession(audits: readonly LiftRunAudit[]): CohortSplit | undefined {
  const ordered = [...audits].filter((audit) => audit.sessionId !== undefined);
  if (ordered.length === 0) return undefined;

  const sessionOrder: string[] = [];
  const bySession = new Map<string, LiftRunAudit[]>();
  for (const audit of ordered) {
    const key = audit.sessionId as string;
    const bucket = bySession.get(key);
    if (bucket === undefined) {
      bySession.set(key, [audit]);
      sessionOrder.push(key);
    } else {
      bucket.push(audit);
    }
  }
  if (sessionOrder.length < 2) return undefined;

  const half = ordered.length / 2;
  const calibrationSessions: string[] = [];
  let taken = 0;
  for (let i = 0; i < sessionOrder.length - 1; i++) {
    const size = (bySession.get(sessionOrder[i]) as LiftRunAudit[]).length;
    // 第一個 session 一定進 calibration（否則該側為空）；之後只在不超過半數時才繼續加。
    if (i > 0 && taken + size > half) break;
    calibrationSessions.push(sessionOrder[i]);
    taken += size;
  }
  const heldOutSessions = sessionOrder.filter((id) => !calibrationSessions.includes(id));
  if (heldOutSessions.length === 0) return undefined;

  const runsOf = (ids: readonly string[]): LiftRunAudit[] => ids.flatMap((id) => bySession.get(id) as LiftRunAudit[]);
  const heldOutRuns = runsOf(heldOutSessions);

  return {
    calibration: runsOf(calibrationSessions).map((audit) => audit.sourcePath),
    heldOut: heldOutRuns.map((audit) => audit.sourcePath),
    heldOutLiftIntervals: countIntervals(heldOutRuns, 'lift'),
    heldOutPauseIntervals: countIntervals(heldOutRuns, 'pause'),
  };
}

/**
 * 排序鍵（分割前的正規順序，T0 凍結）：`recordedAt` → 檔名內的 ISO 時間 → manifest `order` → 輸入順序。
 * 匯出檔名形如 `<drill>-2026-09-15T02_00_00.000Z.json`（冒號被檔案系統換成底線）。
 */
export function sortLiftRunInputs(inputs: readonly LiftRunInput[]): readonly LiftRunInput[] {
  return [...inputs]
    .map((input, index) => ({ input, index, key: sortKey(input, index) }))
    .sort((a, b) => (a.key === b.key ? a.index - b.index : a.key < b.key ? -1 : 1))
    .map((entry) => entry.input);
}

function sortKey(input: LiftRunInput, index: number): string {
  if (input.recordedAt !== undefined) return `0:${input.recordedAt}`;
  const stamp = /(\d{4}-\d{2}-\d{2}T\d{2}[_:]\d{2}[_:]\d{2}\.\d{3}Z)/.exec(input.sourcePath);
  if (stamp !== null) return `0:${stamp[1].replace(/_/g, ':')}`;
  if (input.order !== undefined) return `1:${String(input.order).padStart(6, '0')}`;
  return `2:${String(index).padStart(6, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 操作者報告（T2 step 8）
// ─────────────────────────────────────────────────────────────────────────────

export interface LiftCohortReport {
  readonly audits: readonly LiftRunAudit[];
  readonly channelByTheta: readonly AnnotationChannelAssessment[];
  readonly sufficiency: CohortSufficiency;
  /** 本批的最終去向。三個都是合法結案形態（FR-61.8）。 */
  readonly verdict: 'sufficient' | 'blocked-by-data' | 'annotation-channel-unusable';
}

/**
 * 一次跑完 step 2／3／4／7 並收斂成單一去向。
 *
 * **順序有意義**：標註通道不可用**優先於**資料充分性。一批「量夠但標籤有系統性偏差」的資料不該被
 * 報成 `sufficient` —— 它進 T3 只會產生一個無法歸因的結果（T2 task 檔的序列閘 ③）。
 *
 * F3 檢定逐 θ 各跑一次。**任一 θ 判 unusable 即整批 unusable** —— T0 沒有凍結「用哪個 θ 做 F3」，
 * 而在缺乏凍結值時，拒絕比通過保守：拒絕不可能製造出可分性假象，通過可以。
 */
export function buildLiftCohortReport(inputs: readonly LiftRunInput[]): LiftCohortReport {
  const ordered = sortLiftRunInputs(inputs);
  const audits = auditLiftRuns(ordered);
  const runs = ordered.map((input, index) => ({ audit: audits[index], payload: input.payload }));
  const channelByTheta = GAP_THRESHOLD_SWEEP_MS.map((thetaMs) => assessAnnotationChannel(runs, thetaMs));
  const sufficiency = assessCohortSufficiency(audits);

  const verdict = channelByTheta.some((entry) => entry.verdict === 'annotation-channel-unusable')
    ? 'annotation-channel-unusable'
    : sufficiency.verdict;

  return { audits, channelByTheta, sufficiency, verdict };
}

/** 人可讀的報告。判定印在數字**之前** —— 先知道這批能不能用，再看細節。 */
export function formatLiftCohortReport(report: LiftCohortReport): string {
  const lines: string[] = [];
  const { sufficiency } = report;

  lines.push(`# 感測器離地標註 cohort 稽核（${report.audits.length} 份 run）`);
  lines.push('');
  lines.push(
    `評估契約 \`${sufficiency.contract}\`，**凍結於 T0（D-61.T0-1），事後只能升版不得改值**：` +
      `θ sweep ${GAP_THRESHOLD_SWEEP_MS.join(' / ')} ms；匹配容差 ${ANNOTATION_MATCH_TOLERANCE_MS} ms；` +
      `逐份條件 displayHz = ${REQUIRED_DISPLAY_HZ}、COI true、連續期間事件率 ≥ ${MIN_ACTIVE_RATE_HZ} Hz、` +
      '無溢位、Pointer Lock 中斷 0。',
  );
  lines.push('');

  lines.push('## 判定');
  lines.push('');
  lines.push(verdictLine(report.verdict));
  if (report.verdict === 'annotation-channel-unusable') {
    for (const entry of report.channelByTheta) {
      for (const reason of entry.reasons) lines.push(`- θ=${entry.thetaMs} ms：${reason}`);
    }
    lines.push('');
    lines.push('⇒ **T2 到此停止**，走 FR-61.8 的「證據不足」路徑；不得續行 T3（task-checklist 序列閘 ③）。');
  } else if (report.verdict === 'blocked-by-data') {
    for (const shortfall of sufficiency.shortfalls) lines.push(`- ${shortfall}`);
    lines.push('');
    lines.push('⇒ **不得進 T3**。補錄規格見 `docs/operational/spider-wide-recording-spec.md` §2.5／§3.3。');
  }
  lines.push('');

  const voided = report.audits.filter((audit) => !audit.usable);
  lines.push(`## 逐份可用性（${voided.length}／${report.audits.length} 份作廢）`);
  lines.push('');
  lines.push('作廢是**丟掉整份 run**，不是丟掉不方便的事件；規則在 T0 凍結，本報告只執行。');
  for (const audit of voided) {
    lines.push('');
    lines.push(`- **${audit.sourcePath}**`);
    for (const reason of audit.voidReasons) lines.push(`  - ${reason}`);
  }
  lines.push('');
  lines.push('| run | session | class | displayHz | COI | dpi | samples | 溢位 | 連續期間 (Hz) | lock 中斷 | 可用 |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const audit of report.audits) {
    lines.push(
      `| ${audit.sourcePath} | ${audit.sessionId ?? '—'} | ${audit.instructionClass ?? '—'} | ${audit.displayHz} ` +
        `| ${audit.crossOriginIsolated ? '是' : '否'} | ${audit.dpi ?? '—'} | ${audit.recordedSamples ?? '—'} ` +
        `| ${boolText(audit.sampleOverflow)} | ${numText(audit.activeRateHz, 0)} | ${audit.unlockedIntervalCount ?? '—'} ` +
        `| ${audit.usable ? '✅' : '❌'} |`,
    );
  }
  lines.push('');

  lines.push('## 標註完整性（FR-61.11）');
  lines.push('');
  lines.push('| run | class | 標註事件 | 標註區間 | expected trials | 差額 | 上限 | 成對違規 | 落在 unlocked |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const audit of report.audits) {
    const delta = audit.instructionClass === 'oneshot' ? `${audit.trialDelta}（不適用）` : String(audit.trialDelta);
    lines.push(
      `| ${audit.sourcePath} | ${audit.instructionClass ?? '—'} | ${audit.annotationEventCount} ` +
        `| ${audit.annotationIntervalCount} | ${audit.expectedTrials} | ${delta} | ±${audit.trialDeltaLimit} ` +
        `| ${audit.pairViolations} | ${audit.annotationsInUnlocked} |`,
    );
  }
  lines.push('');
  lines.push(
    '`oneshot` 不套 trial 差額閘 —— 它的指示是「遇到實際抬滑鼠才標註」，標註數本來就遠少於 trial 數；' +
      '成對性與 unlocked 兩個閘照樣生效。',
  );
  lines.push('');

  lines.push('## F3 檢定：lift 與 pause 的自報延遲（README §1.4）');
  lines.push('');
  lines.push('量的是「標註起點 − 最近候選空洞起點」。**這不是標籤指派** —— 配標籤在 `research/src/lift/`。');
  lines.push('');
  lines.push('| θ (ms) | lift n | lift p10/p50/p90 | pause n | pause p10/p50/p90 | 中位數差 | p90 差 | 判定 |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const entry of report.channelByTheta) {
    lines.push(
      `| ${entry.thetaMs} | ${entry.lift?.n ?? 0} | ${quantileText(entry.lift)} | ${entry.pause?.n ?? 0} ` +
        `| ${quantileText(entry.pause)} | ${numText(entry.medianDiffMs, 1)} | ${numText(entry.p90DiffMs, 1)} ` +
        `| ${entry.verdict} |`,
    );
  }
  lines.push('');
  lines.push(
    `上限：中位數差 ${MAX_LATENCY_MEDIAN_DIFF_MS} ms、p90 差 ${MAX_LATENCY_P90_DIFF_MS} ms。` +
      '`indeterminate` = 某一組沒有樣本 ⇒ 檢定不成立，**不是通過**。',
  );
  lines.push('');

  lines.push('## 資料充分性（NFR-61.7）');
  lines.push('');
  lines.push('| 項目 | 實測 | 下限 |');
  lines.push('|---|---|---|');
  lines.push(`| 可用 run | ${sufficiency.usableRunCount}（作廢 ${sufficiency.voidedRunCount}） | — |`);
  lines.push(`| 獨立 session | ${sufficiency.sessionCount} | ${MIN_SESSIONS} |`);
  lines.push(`| lift 標註區間 | ${sufficiency.liftIntervals} | ${MIN_INTERVALS_PER_CLASS} |`);
  lines.push(`| pause 標註區間 | ${sufficiency.pauseIntervals} | ${MIN_INTERVALS_PER_CLASS} |`);
  lines.push(`| oneshot 標註區間 | ${sufficiency.oneshotIntervals} | — |`);
  for (const row of sufficiency.candidateCountsByTheta) {
    lines.push(`| θ=${row.thetaMs} ms 候選空洞 | ${row.candidateCount} | > 0 |`);
  }
  if (sufficiency.split === undefined) {
    lines.push(`| held-out lift／pause 區間 | —（無法分割） | 各 ${MIN_HELD_OUT_INTERVALS_PER_CLASS} |`);
  } else {
    lines.push(
      `| held-out lift／pause 區間 | ${sufficiency.split.heldOutLiftIntervals}／${sufficiency.split.heldOutPauseIntervals} ` +
        `| 各 ${MIN_HELD_OUT_INTERVALS_PER_CLASS} |`,
    );
  }
  lines.push('');
  if (sufficiency.split !== undefined) {
    lines.push(`校準集：${sufficiency.split.calibration.join('、')}`);
    lines.push('');
    lines.push(`held-out：${sufficiency.split.heldOut.join('、')}`);
    lines.push('');
    lines.push('同一個 session 不跨兩側（FR-61.7）。');
  }
  return lines.join('\n');
}

function verdictLine(verdict: LiftCohortReport['verdict']): string {
  if (verdict === 'sufficient') return '✅ **`sufficient`** —— 每一項凍結下限都達到，可進 T3 消融。';
  if (verdict === 'annotation-channel-unusable') {
    return '❌ **`annotation-channel-unusable`** —— lift 與 pause 的自報延遲有系統性差異，標籤通道本身不可用。';
  }
  return '⛔ **`blocked-by-data`** —— 資料量未達 T0 凍結下限。差多少逐條列於下。';
}

function quantileText(quantiles: LatencyQuantiles | undefined): string {
  if (quantiles === undefined) return '—';
  return `${quantiles.p10.toFixed(1)} / ${quantiles.p50.toFixed(1)} / ${quantiles.p90.toFixed(1)}`;
}

function numText(value: number | undefined, digits: number): string {
  return value === undefined ? '—' : value.toFixed(digits);
}

/** `undefined`（沒錄）與 `false`（錄了、沒溢位）必須在報告上分得開，故不用 `?? false`。 */
function boolText(value: boolean | undefined): string {
  return value === undefined ? '—' : value ? '是' : '否';
}
