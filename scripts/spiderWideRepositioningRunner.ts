/**
 * WP-57 —— `spider-shot-wide-v1` 真人 run 的抬滑鼠標註彙總（OQ-57.5 第 ③ 項：`cm/360` 方向性）。
 *
 * **它要回答的問題**：抬滑鼠疑慮的標註率是否隨 `cm/360`（每轉一圈所需的實體行程）單調上升？
 * 2026-09-08 那四份真人 run **回答不了** —— 感度與指示完全共線（1.0／1.5／0.5／1.5），順序甚至
 * 不單調（見 WP-57 progress §T5-real）。要答它需要**同一個指示 × 多個感度**的 cohort，錄製規格見
 * [`docs/operational/spider-wide-recording-spec.md`](../docs/operational/spider-wide-recording-spec.md)。
 *
 * **本模組因此刻意會拒答**：`assessDirectionality()` 在 cohort 共線時回 `answerable: false` 並說出
 * 缺什麼，而不是照樣印一張看起來有斜率的表。那張表正是 §T5-real 推翻掉的東西。
 *
 * **WP-60 T4 追加**：逐份報告**原始滑鼠取樣的健康度**（FR-60.8）。理由同上 —— WP-57 §T5-real 的教訓
 * 是「一份看起來正常的匯出，其指標可能整組靜默歸零」（KI-031，detected 0/113 而 CI 全綠）。原始取樣
 * 多了三種同型的靜默失效：**事件率不足**、**溢位**、**時間戳精度不足**，加上一種會被誤讀成抬滑鼠的
 * **Pointer Lock 中斷**。四者一律變成逐份點名的 blocker，印在數字之前。
 * ⚠️ 缺 `mouseSamples` 區塊**不是** blocker —— 那只是少了一維資料，不是資料有問題。
 *
 * **沒有第二套定義（C-D4）**：`cm/360` 一律走 `deriveMouseThrow()`、標註一律走
 * `deriveRepositioningSuspicion()`、偵測率一律走 `deriveDetectionMetrics()`、時間間隙一律走
 * `segmentByTimeGap()`／`deriveUnlockedIntervals()`。本模組只做分組、計數與可答性判斷。
 * 純函式：不讀時鐘、不讀隨機、無 I/O（I/O 全在
 * `analyze-spider-wide-repositioning.ts`，比照 `trackingContactRunner.ts` 的分工）。
 */
import type { ExportPayload } from '../src/data/export.ts';
import { deriveDetectionMetrics } from '../src/metrics/detectionDerivation.ts';
import { deriveUnlockedIntervals, segmentByTimeGap } from '../src/metrics/mouseSampleGaps.ts';
import { deriveMouseThrow } from '../src/metrics/mouseThrow.ts';
import { deriveRepositioningSuspicion } from '../src/metrics/spiderShotRepositioning.ts';

/** 本 runner 只認這一支 drill —— 其他 drill 沒有 `zone: 'peripheral'`，母體為空（Surprises 16）。 */
export const SPIDER_WIDE_DRILL_ID = 'spider-shot-wide-v1';

/**
 * 2026-09-08 以四份真人 run 校準的交付門檻（D-57.T5-7）。**不是 production 常數** —— T5 invariant
 * 明文不凍結單一門檻，且該值條件於錄製機器的取樣特性。放在這裡是為了讓每次分析都用同一組數字，
 * 並讓「換了門檻」在 diff 裡看得見。
 */
export const CALIBRATED_STALL_MIN_MS = 150;
export const CALIBRATED_STALL_OMEGA_DEG_PER_SEC = 2;

/**
 * ⚠️ **KI-031 繞道**：canonical 預設 `sustainedTicks: 4` 在 aim 更新率低於 sim 率的機器上讓
 * detection 全滅（60 Hz 顯示 ⇒ 0/113）。以 `1` 呼叫是既有參數而非第二套定義，但它失去「持續」
 * 那一層雜訊抑制。KI-031 修好後本模組須改回預設並重跑所有數字。
 */
export const KI031_WORKAROUND_SUSTAINED_TICKS = 1;

/** 方向性檢查所需的最少感度檔數（同一指示內的相異 `cm/360`）。兩點才有斜率，三點才看得出單調。 */
export const MIN_SENSITIVITY_LEVELS = 2;

/**
 * WP-60 T4 —— 原始取樣的事件率下限（Hz）。低於此值，樣本間 `dt` 的解析度不足以支撐任何時間間隙
 * 判定（README §2.6 F1：這是本 WP 的 go/no-go 門檻，T0 R1 在 1000 Hz 滑鼠上實測 1005 Hz 通過）。
 */
export const MIN_OBSERVED_RATE_HZ = 500;

/**
 * WP-60 T4 —— 報告用的時間間隙門檻（ms）。
 *
 * **不是校準值，也不是 production 常數。** `segmentByTimeGap()` 刻意不給預設值（呼叫端必填），因為
 * 門檻條件於錄製硬體的事件率；把它放在這裡，是為了讓每次分析都用同一個數字、並讓「換了門檻」在
 * diff 裡看得見（比照上面 `CALIBRATED_STALL_*` 的處置）。
 *
 * 取值依據：`performance_analysis` 的 `lod_v3_default_config.json`（`TIME_GAP_THRESHOLD_MS = 30`，
 * 授權無虞見 D-60.P7）當 prior；T0 R1 在本專案硬體上量到連續移動期間的空洞上限約 18 ms，30 ms 約有
 * 1.7× headroom。⚠️ T0 R2 已判定**空洞長度不足以可靠分離抬滑鼠與停頓**，故本欄只回報「有幾個空洞、
 * 最長多久」這種**描述性**的量，不宣稱任何一個空洞是什麼。
 */
export const REPORTED_GAP_THRESHOLD_MS = 30;

export interface SpiderWideRunInput {
  readonly sourcePath: string;
  readonly payload: ExportPayload;
  /**
   * 操作者填的指示標籤（例如 `照平常打`）——**這是 ground truth**。方向性檢查靠它分組：
   * 只有同一個指示內的多個感度才構成有效對照。缺席時該 run 進 `ungrouped`，不參與方向性判斷。
   */
  readonly instruction?: string;
}

export interface SpiderWideRunSummary {
  readonly sourcePath: string;
  readonly instruction: string | undefined;
  readonly sensitivity: number;
  readonly dpi: number | undefined;
  readonly fovDeg: number | undefined;
  /** 由 `meta.spawn.spiderShot.resolvedFrom.aspect` 讀出（FR-57.10 provenance）；缺席即 `undefined`。 */
  readonly aspect: number | undefined;
  readonly countsPer360: number;
  readonly cmPer360: number | undefined;
  readonly peripheralCount: number;
  /** canonical 預設下的 `status: 'detected'` 數 —— 為 0 且母體非空即撞上 KI-031 懸崖。 */
  readonly detectedAtDefault: number;
  /** KI-031 繞道下的 detected 數。 */
  readonly detectedAtWorkaround: number;
  /** OQ-57.4 的另一半：繞道下仍 timeout 的比例（真人 timeout 率，harness 恆為 0 故量不到）。 */
  readonly timeoutRate: number | undefined;
  /** 兩端窗界都存在、因而可判定的抵達數。 */
  readonly evaluableCount: number;
  readonly suspectedCount: number;
  /** `suspectedCount / evaluableCount`；`evaluableCount === 0` 時 `undefined`（無從判定 ≠ 0%）。 */
  readonly suspectedRate: number | undefined;

  // ── WP-60 T4：原始取樣健康度（FR-60.8）──────────────────────────────────────
  // 六欄一律**同進同出**：`payload.mouseSamples` 缺席時全部 `undefined`，不是 0。缺席與零必須分得開
  // ——「這份 run 沒錄原始取樣」與「錄了但一個間隙都沒有」是完全不同的兩件事（比照 `RingBuffer` 的
  // `hasFire` 慣例）。缺席**不是 blocker**：它只是少了一維資料，不是資料有問題（T4 invariant）。

  /** 實際錄到的樣本數（= `mouseSamples.dtUs.length`）。 */
  readonly sampleCount: number | undefined;
  /** `meta.mouseSampling.observedRateHz` —— 實測平均事件率。 */
  readonly observedRateHz: number | undefined;
  /** `meta.mouseSampling.overflow` —— 樣本數超過容量、末端被丟棄（FR-60.9，**不**進 `meta.suspect`）。 */
  readonly sampleOverflow: boolean | undefined;
  /** 由 `pointer_lock` 事件推導出的未取鎖區間數 —— 那些區間的空洞不是感測器離地（FR-60.6）。 */
  readonly lockBreakCount: number | undefined;
  /** `REPORTED_GAP_THRESHOLD_MS` 下、**未被 Pointer Lock 中斷解釋**的時間間隙數。 */
  readonly gapCountAtThreshold: number | undefined;
  /** 上述間隙中最長的一個（ms）；一個都沒有時為 0（有錄到但沒間隙 ≠ 沒錄到）。 */
  readonly longestGapMs: number | undefined;

  /** 讓這份 run 不可用或不可稽核的原因；空陣列 = 全綠。 */
  readonly blockers: readonly string[];
}

export interface DirectionalityAssessment {
  /** cohort 是否足以回答方向性。false 時 `reasons` 說明缺什麼。 */
  readonly answerable: boolean;
  readonly reasons: readonly string[];
  /** 可答時，同一指示內按 `cm/360` 遞增排序的 (cm/360, 標註率) 對。 */
  readonly points: readonly { readonly instruction: string; readonly cmPer360: number; readonly suspectedRate: number }[];
  /** 可答且點數 ≥ 2 時，標註率是否隨 `cm/360` 單調不減。 */
  readonly monotonicIncreasing: boolean | undefined;
}

/** 逐 run 彙總。順序與輸入相同，讓 diff 穩定。 */
export function summarizeSpiderWideRuns(inputs: readonly SpiderWideRunInput[]): readonly SpiderWideRunSummary[] {
  return inputs.map((input) => summarizeRun(input));
}

function summarizeRun(input: SpiderWideRunInput): SpiderWideRunSummary {
  const { payload, sourcePath, instruction } = input;
  const meta = payload.meta;
  const blockers: string[] = [];

  if (meta.drillId !== SPIDER_WIDE_DRILL_ID) {
    blockers.push(`drillId 為 '${meta.drillId}'，非 '${SPIDER_WIDE_DRILL_ID}' ⇒ 無 peripheral 母體`);
  }
  if (instruction === undefined) blockers.push('缺指示標籤 ⇒ 無 ground truth，不參與方向性分組');

  const throw360 = deriveMouseThrow(payload);
  if (throw360.dpi === undefined) {
    blockers.push('`meta.dpi` 缺席 ⇒ `cm/360` 不可稽核（錄製時未填 SessionSetup 的 Mouse DPI）');
  }
  if (meta.suspect) blockers.push('`meta.suspect: true` ⇒ 過不了實驗資格閘（60 Hz 顯示即會如此）');

  const peripheralIds = new Set(
    payload.events
      .filter((event): event is Extract<ExportPayload['events'][number], { type: 'visible' }> => event.type === 'visible')
      .filter((event) => event.zone === 'peripheral')
      .map((event) => event.targetId),
  );
  const peripheralCount = peripheralIds.size;
  if (peripheralCount === 0) blockers.push('零個 `zone: peripheral` 抵達 ⇒ 母體為空');

  const detectedAtDefault = countDetected(payload, peripheralIds, undefined);
  const detectedAtWorkaround = countDetected(payload, peripheralIds, KI031_WORKAROUND_SUSTAINED_TICKS);
  if (peripheralCount > 0 && detectedAtDefault === 0) {
    blockers.push(
      `canonical 預設下 detected = 0/${peripheralCount} ⇒ 撞上 KI-031 懸崖（aim 更新率低於 sim 率）；` +
        `下列數字全部以 sustainedTicks=${KI031_WORKAROUND_SUSTAINED_TICKS} 的繞道取得`,
    );
  }

  const suspicions = deriveRepositioningSuspicion(payload, {
    stallMinMs: CALIBRATED_STALL_MIN_MS,
    stallOmegaDegPerSec: CALIBRATED_STALL_OMEGA_DEG_PER_SEC,
    detection: { sustainedTicks: KI031_WORKAROUND_SUSTAINED_TICKS },
  });
  // 兩端窗界缺一即 `suspected: false` 且不帶欄位（模組契約：那是「無從判定」而非「沒抬滑鼠」），
  // 故可判定數只能由 detected 數推得，不能拿 suspicions.length 當分母。
  const evaluableCount = detectedAtWorkaround;
  const suspectedCount = suspicions.filter((suspicion) => suspicion.suspected).length;

  const sampling = readSamplingHealth(payload);
  if (sampling !== undefined) {
    if (sampling.observedRateHz !== undefined && sampling.observedRateHz < MIN_OBSERVED_RATE_HZ) {
      blockers.push(
        `原始取樣事件率不足（${sampling.observedRateHz.toFixed(0)} Hz < ${MIN_OBSERVED_RATE_HZ} Hz）⇒ ` +
          '時間間隙判定不可用（README §2.6 F1）',
      );
    }
    if (sampling.sampleOverflow === true) {
      blockers.push(
        `原始取樣溢位（recorded ${sampling.sampleCount} 已達容量上限）⇒ 末端資料缺失，` +
          '不要把樣本流的結尾當成 drill 的結尾（FR-60.9；tick 資料本身仍有效）',
      );
    }
    if (!meta.crossOriginIsolated) {
      blockers.push(
        '`meta.crossOriginIsolated: false` ⇒ `event.timeStamp` 精度不足（F4），' +
          '樣本間 `dt` 被捨入雜訊污染，時間間隙判定不可信',
      );
    }
    if (sampling.lockBreakCount > 0) {
      blockers.push(
        `Pointer Lock 中斷 ${sampling.lockBreakCount} 次 ⇒ 該區間的空洞**不是**抬滑鼠（FR-60.6）；` +
          '已排除在間隙計數之外，但中斷期間的移動依 FR-A-8 整筆丟棄，那段軌跡不可復原',
      );
    }
  }

  return {
    sourcePath,
    instruction,
    sensitivity: meta.sensitivity,
    dpi: throw360.dpi,
    fovDeg: meta.fovDeg,
    aspect: readResolvedAspect(meta.spawn?.spiderShot),
    countsPer360: throw360.countsPer360,
    cmPer360: throw360.cmPer360,
    peripheralCount,
    detectedAtDefault,
    detectedAtWorkaround,
    timeoutRate: peripheralCount === 0 ? undefined : (peripheralCount - detectedAtWorkaround) / peripheralCount,
    evaluableCount,
    suspectedCount,
    suspectedRate: evaluableCount === 0 ? undefined : suspectedCount / evaluableCount,
    sampleCount: sampling?.sampleCount,
    observedRateHz: sampling?.observedRateHz,
    sampleOverflow: sampling?.sampleOverflow,
    lockBreakCount: sampling?.lockBreakCount,
    gapCountAtThreshold: sampling?.gapCountAtThreshold,
    longestGapMs: sampling?.longestGapMs,
    blockers,
  };
}

interface SamplingHealth {
  readonly sampleCount: number;
  readonly observedRateHz: number | undefined;
  readonly sampleOverflow: boolean | undefined;
  readonly lockBreakCount: number;
  readonly gapCountAtThreshold: number;
  readonly longestGapMs: number;
}

/**
 * 讀出 WP-60 的取樣健康度；`mouseSamples` 缺席即回 `undefined`（六欄一起缺席，見 `SpiderWideRunSummary`）。
 *
 * `lockBreakCount` 也綁在 block 的存在上 —— `pointer_lock` 事件單獨存在時沒有任何樣本流可歸因，
 * 報一個「中斷 N 次」只會讓讀者以為某份取樣被污染了，而那份取樣根本不存在。
 *
 * 間隙一律走 `segmentByTimeGap()`（C-D4 單一定義），中斷區間一律走 `deriveUnlockedIntervals()`。
 * 本函式只做計數與取最大值，不自己判斷任何一個空洞是什麼。
 */
function readSamplingHealth(payload: ExportPayload): SamplingHealth | undefined {
  const block = payload.mouseSamples;
  if (block === undefined) return undefined;

  const sampling = payload.meta.mouseSampling;
  // 樣本流末筆時間 —— 未關閉的 lock 中斷以它收尾。整數 µs 空間累加後才換算 ms，比照 `segmentByTimeGap()`。
  let elapsedUs = 0;
  for (let i = 1; i < block.dtUs.length; i++) elapsedUs += block.dtUs[i];
  const lastSampleMs = block.t0Ms + elapsedUs / 1000;

  const unlockedIntervals = deriveUnlockedIntervals(payload.events, lastSampleMs);
  const segmentation = segmentByTimeGap(block, REPORTED_GAP_THRESHOLD_MS, unlockedIntervals);
  let longestGapMs = 0;
  for (const gap of segmentation.gaps) {
    if (gap.durationMs > longestGapMs) longestGapMs = gap.durationMs;
  }

  return {
    sampleCount: block.dtUs.length,
    observedRateHz: sampling?.observedRateHz,
    sampleOverflow: sampling?.overflow,
    lockBreakCount: unlockedIntervals.length,
    gapCountAtThreshold: segmentation.gaps.length,
    longestGapMs,
  };
}

function countDetected(
  payload: ExportPayload,
  peripheralIds: ReadonlySet<string>,
  sustainedTicks: number | undefined,
): number {
  const result = deriveDetectionMetrics(payload, sustainedTicks === undefined ? undefined : { sustainedTicks });
  return result.presentations.filter(
    (presentation) => peripheralIds.has(presentation.targetId) && presentation.status === 'detected',
  ).length;
}

/** `meta.spawn.spiderShot` 是 opaque `unknown`（Surprises 13）—— 只讀不驗，讀不到就回 `undefined`。 */
function readResolvedAspect(spiderShot: unknown): number | undefined {
  if (typeof spiderShot !== 'object' || spiderShot === null) return undefined;
  const resolvedFrom = (spiderShot as { resolvedFrom?: unknown }).resolvedFrom;
  if (typeof resolvedFrom !== 'object' || resolvedFrom === null) return undefined;
  const aspect = (resolvedFrom as { aspect?: unknown }).aspect;
  return typeof aspect === 'number' && Number.isFinite(aspect) ? aspect : undefined;
}

/**
 * 判斷 cohort 是否足以回答「標註率隨 `cm/360` 上升嗎」。
 *
 * **可答的條件**：某一個指示分組內，有 ≥ `MIN_SENSITIVITY_LEVELS` 個**相異** `cm/360`，且每個
 * 都有可判定的標註率。這正是 §T5-real 那四份 run 不滿足的條件 —— 它們每個指示只有一個感度，
 * 感度與條件共線，任何斜率都無法歸因。
 */
export function assessDirectionality(summaries: readonly SpiderWideRunSummary[]): DirectionalityAssessment {
  const reasons: string[] = [];
  const usable = summaries.filter(
    (summary) => summary.instruction !== undefined && summary.cmPer360 !== undefined && summary.suspectedRate !== undefined,
  );
  if (usable.length < summaries.length) {
    reasons.push(`${summaries.length - usable.length} 份 run 缺指示／DPI／可判定標註率，未納入方向性判斷`);
  }

  const groups = new Map<string, SpiderWideRunSummary[]>();
  for (const summary of usable) {
    const key = summary.instruction as string;
    const bucket = groups.get(key);
    if (bucket === undefined) groups.set(key, [summary]);
    else bucket.push(summary);
  }

  let best: { instruction: string; rows: SpiderWideRunSummary[] } | undefined;
  for (const [instruction, rows] of groups) {
    const levels = new Set(rows.map((row) => row.cmPer360 as number)).size;
    if (levels < MIN_SENSITIVITY_LEVELS) {
      reasons.push(`指示「${instruction}」只有 ${levels} 個相異 cm/360，需要 ≥ ${MIN_SENSITIVITY_LEVELS}`);
      continue;
    }
    if (best === undefined || rows.length > best.rows.length) best = { instruction, rows };
  }

  if (best === undefined) {
    reasons.push('沒有任何指示分組達到方向性檢查的最低要求 ⇒ 拒答（感度與條件共線時，斜率無法歸因）');
    return { answerable: false, reasons, points: [], monotonicIncreasing: undefined };
  }

  const points = best.rows
    .map((row) => ({
      instruction: best.instruction,
      cmPer360: row.cmPer360 as number,
      suspectedRate: row.suspectedRate as number,
    }))
    .sort((a, b) => a.cmPer360 - b.cmPer360);

  let monotonicIncreasing = true;
  for (let i = 1; i < points.length; i++) {
    if (points[i].suspectedRate < points[i - 1].suspectedRate) monotonicIncreasing = false;
  }
  return { answerable: true, reasons, points, monotonicIncreasing };
}

/** 人可讀的報告。刻意把 blockers 印在數字**之前** —— 先知道能不能信，再看數字。 */
export function formatSpiderWideRepositioningSummary(
  summaries: readonly SpiderWideRunSummary[],
  directionality: DirectionalityAssessment,
): string {
  const lines: string[] = [];
  lines.push(`# spider-shot-wide-v1 抬滑鼠標註彙總（${summaries.length} 份 run）`);
  lines.push('');
  lines.push(
    `門檻 stallMinMs=${CALIBRATED_STALL_MIN_MS} / stallOmegaDegPerSec=${CALIBRATED_STALL_OMEGA_DEG_PER_SEC}` +
      `（D-57.T5-7 真人校準值，未凍結）；detection sustainedTicks=${KI031_WORKAROUND_SUSTAINED_TICKS}（KI-031 繞道）。`,
  );
  lines.push(
    `原始取樣（WP-60）：間隙門檻 ${REPORTED_GAP_THRESHOLD_MS.toFixed(1)} ms（PA prior，**非校準值**）；` +
      `事件率下限 ${MIN_OBSERVED_RATE_HZ} Hz。空洞長度**不足以**區分抬滑鼠與停頓（T0 R2），下表只描述有幾個、多長。`,
  );
  lines.push('');

  const blocked = summaries.filter((summary) => summary.blockers.length > 0);
  lines.push(blocked.length === 0 ? '## 資料品質：全綠' : `## 資料品質：${blocked.length}／${summaries.length} 份有 blocker`);
  for (const summary of blocked) {
    lines.push('');
    lines.push(`- **${summary.sourcePath}**`);
    for (const blocker of summary.blockers) lines.push(`  - ${blocker}`);
  }
  lines.push('');

  lines.push('## 逐 run');
  lines.push('');
  lines.push('| run | 指示 | sens | dpi | cm/360 | peripheral | detected(預設) | detected(繞道) | timeout 率 | 標註 | 標註率 |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const summary of summaries) {
    lines.push(
      `| ${summary.sourcePath} | ${summary.instruction ?? '—'} | ${summary.sensitivity} | ${summary.dpi ?? '—'} ` +
        `| ${fmt(summary.cmPer360, 1)} | ${summary.peripheralCount} | ${summary.detectedAtDefault} ` +
        `| ${summary.detectedAtWorkaround} | ${pct(summary.timeoutRate)} | ${summary.suspectedCount}/${summary.evaluableCount} ` +
        `| ${pct(summary.suspectedRate)} |`,
    );
  }
  lines.push('');

  // 取樣健康度是**同一段**的第二張表，不是第四段 —— 報告維持「資料品質／逐 run／方向性」三段結構。
  lines.push('### 原始取樣健康度（WP-60）');
  lines.push('');
  if (summaries.every((summary) => summary.sampleCount === undefined)) {
    lines.push(
      '本批**沒有任何** run 帶 `mouseSamples` 區塊（錄製時未以 `?rawMouse=1` 開啟原始取樣）。' +
        '這**不是 blocker** —— 只是少了這一維資料，上面的數字不受影響。',
    );
  } else {
    lines.push(
      `| run | samples | 事件率 (Hz) | 溢位 | lock 中斷 | 間隙 > ${REPORTED_GAP_THRESHOLD_MS.toFixed(1)} ms | 最長間隙 (ms) |`,
    );
    lines.push('|---|---|---|---|---|---|---|');
    for (const summary of summaries) {
      lines.push(
        `| ${summary.sourcePath} | ${summary.sampleCount ?? '—'} | ${fmt(summary.observedRateHz, 0)} ` +
          `| ${bool(summary.sampleOverflow)} | ${summary.lockBreakCount ?? '—'} ` +
          `| ${summary.gapCountAtThreshold ?? '—'} | ${fmt(summary.longestGapMs, 1)} |`,
      );
    }
    lines.push('');
    lines.push('`—` = 該 run 沒有 `mouseSamples` 區塊（合法，非 blocker）；`0` = 有錄到但該項為零。');
  }
  lines.push('');

  lines.push('## `cm/360` 方向性（OQ-57.5 ③）');
  lines.push('');
  if (!directionality.answerable) {
    lines.push('**拒答** —— 這批資料回答不了方向性：');
    for (const reason of directionality.reasons) lines.push(`- ${reason}`);
    lines.push('');
    lines.push('補錄規格見 `docs/operational/spider-wide-recording-spec.md`。');
    return lines.join('\n');
  }
  for (const reason of directionality.reasons) lines.push(`- ⚠️ ${reason}`);
  lines.push('');
  lines.push(`指示「${directionality.points[0].instruction}」，按 cm/360 遞增：`);
  lines.push('');
  lines.push('| cm/360 | 標註率 |');
  lines.push('|---|---|');
  for (const point of directionality.points) lines.push(`| ${fmt(point.cmPer360, 1)} | ${pct(point.suspectedRate)} |`);
  lines.push('');
  lines.push(
    directionality.monotonicIncreasing === true
      ? `**單調不減成立**（${directionality.points.length} 點）。這是方向一致，不是效果量估計；n 與受測者數請一併報告。`
      : `**單調不減不成立**（${directionality.points.length} 點）—— 標註率未隨行程增加而上升。`,
  );
  return lines.join('\n');
}

function fmt(value: number | undefined, digits: number): string {
  return value === undefined ? '—' : value.toFixed(digits);
}

function pct(value: number | undefined): string {
  return value === undefined ? '—' : `${(value * 100).toFixed(0)}%`;
}

/** `undefined`（沒錄）與 `false`（錄了、沒溢位）必須在報告上分得開，故不用 `?? false`。 */
function bool(value: boolean | undefined): string {
  return value === undefined ? '—' : value ? '是' : '否';
}
