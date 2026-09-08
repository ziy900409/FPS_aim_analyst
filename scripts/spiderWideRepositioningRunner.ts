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
 * **沒有第二套定義（C-D4）**：`cm/360` 一律走 `deriveMouseThrow()`、標註一律走
 * `deriveRepositioningSuspicion()`、偵測率一律走 `deriveDetectionMetrics()`。本模組只做分組、
 * 計數與可答性判斷。純函式：不讀時鐘、不讀隨機、無 I/O（I/O 全在
 * `analyze-spider-wide-repositioning.ts`，比照 `trackingContactRunner.ts` 的分工）。
 */
import type { ExportPayload } from '../src/data/export.ts';
import { deriveDetectionMetrics } from '../src/metrics/detectionDerivation.ts';
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
    blockers,
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
