/**
 * `spider-shot-wide-v1` 的**機制層逐 trial 抽取**——把 canonical 推導接成研究側可讀的一列一呈現。
 *
 * **它為什麼存在**：mouse × grip 研究管線（`research/src/mousegrip/`）跑在 Python，而 reaction /
 * movement / peak ω / overshoot 這些構念的權威實作在 TypeScript（C-D4）。在 Python 重寫等於建立第二
 * 套定義，因此改由本模組把 TS 側算好的值吐成 CSV，Python 以 `targetId` 左接。**本模組一行幾何都不重算**
 * ——它只呼叫 `deriveSpiderShotMetrics()` / `deriveTrackingSamples()` / `buildPeekWindows()` /
 * `omegaDegPerSec()` 並做欄位組裝。
 *
 * **兩層品質分界（這是本模組的主要設計判斷）**：
 *
 * - **Tier 0**（`peakOmega` / `entryOmega` / `brakeRetention` / `triggerMargin` / `overshoot` /
 *   `dropCount` / `microAdjustCount` / `fireAngleError`）只依賴 tracking samples、peek window 與角速度
 *   ——**完全不經過 detector**，因此不受 KI-031（aim 更新率不足時 detection 全滅）與 KI-034
 *   （pre-stimulus baseline 被前一次交戰污染）影響。
 * - **Tier 1**（`reactionMs` / `movementTimeMs`）兩者都以 `tDetectMs` 為起點，因此**一起**受上述兩個
 *   已知問題牽制。`movementTimeMs` 常被誤認為與 detector 無關，但它是 `firstOnTarget − tDetect`。
 *   逐呈現輸出 `detectionStatus` 與 `baselineInsufficient`，讓品質**逐指標傳播**而不是逐 run 一刀切。
 *
 * **不輸出首發命中（KI-042）**：`deriveSpiderShotMetrics().firstShot.hit` 取的是
 * `PeekWindowTs.outcome`，規則為「窗內任一發命中即 `'hit'`」，首發 miss、補槍命中會被記成首發命中
 * （S01–S06 cohort 實測分歧 313/2442 = 12.8%，方向恆為樂觀）。本模組**只取 `fireAngleErrorDeg`**；
 * 首發命中與補槍成本留在研究側直接讀 fire event，以免在 KI-042 落地前多出第四份實作。
 *
 * 純函式：不讀檔、不讀時鐘、不讀隨機、不 print。I/O 全在 `analyze-spider-wide-mechanism.ts`
 * （比照 `spiderWideRepositioningRunner.ts` / `analyze-spider-wide-repositioning.ts` 的分工）。
 */
import type { ExportPayload } from '../src/data/export.ts';
import { omegaDegPerSec } from '../src/metrics/angularKinematics.ts';
import { deriveDetectionMetrics } from '../src/metrics/detectionDerivation.ts';
import { buildPeekWindows } from '../src/metrics/peekWindows.ts';
import { deriveSpiderShotMetrics } from '../src/metrics/spiderShotMetrics.ts';
import { deriveTrackingSamples } from '../src/metrics/trackingDerivation.ts';

type VisibleEvent = Extract<ExportPayload['events'][number], { type: 'visible' }>;

/** 本模組只認這一支 drill —— 其他 drill 沒有 `zone: 'peripheral'`，母體為空。 */
export const SPIDER_WIDE_DRILL_ID = 'spider-shot-wide-v1';

/** 一次周邊呈現的機制層讀數。`undefined` 一律代表「不可算」，絕不以 0 代替。 */
export interface SpiderWideMechanismRow {
  readonly targetId: string;
  /** 1-based ordinal among peripheral presentations —— 與研究側的 `presentation_index` 對齊。 */
  readonly presentationIndex: number;
  readonly side: string;

  // --- Tier 0：不經 detector ---
  readonly peakOmegaDegPerSec?: number;
  /** 首次進靶當下的 |ω|。與 peak 併看才知道煞停完成度。 */
  readonly entryOmegaDegPerSec?: number;
  /** `entryOmega / peakOmega`。越低代表進靶前卸速越完整；單獨看不代表好壞。 */
  readonly brakeRetention?: number;
  /** `tFirstShot − tFirstOnTarget`。負值＝早於進靶擊發，正值＝進靶後的確認時間。 */
  readonly triggerMarginMs?: number;
  /**
   * 首次進靶後最大逸出角。**空白有兩種意思，靠 `flags` 區分**：`no_on_target` = 從未進靶（真的不可算）；
   * 沒有該旗標而仍為空 = 進靶後準星未再離開目標，即「沒有逸出」。canonical 對後者回 `undefined` 而非 0，
   * 本模組照實傳遞不代為改寫（C-D4）；下游若要當 0 處理，必須自己說明並對 `flags` 設條件。
   */
  readonly overshootDeg?: number;
  readonly dropCount?: number;
  readonly microAdjustCount?: number;
  readonly fireAngleErrorDeg?: number;

  // --- Tier 1：以 tDetectMs 為起點，受 KI-031 / KI-034 牽制 ---
  readonly reactionMs?: number;
  readonly movementTimeMs?: number;

  // --- 逐呈現品質，供下游逐指標傳播 ---
  readonly detectionStatus: string;
  readonly baselineInsufficient: boolean;
  readonly flags: readonly string[];
}

export interface SpiderWideMechanismSummary {
  readonly peripheralCount: number;
  /** 有 `tDetectMs` 的呈現數。遠低於 `peripheralCount` 即 KI-031 的靜默失效樣態。 */
  readonly detectedCount: number;
  readonly baselineInsufficientCount: number;
  readonly rows: readonly SpiderWideMechanismRow[];
}

const EPSILON_MS = 1e-9;

export function deriveSpiderWideMechanism(payload: ExportPayload): SpiderWideMechanismSummary {
  if (payload.meta.drillId !== SPIDER_WIDE_DRILL_ID) {
    throw new Error(`expected ${SPIDER_WIDE_DRILL_ID}, got ${String(payload.meta.drillId)}`);
  }

  const metrics = deriveSpiderShotMetrics(payload);
  const detection = deriveDetectionMetrics(payload).presentations;
  const tracking = deriveTrackingSamples(payload).presentations;
  const windows = buildPeekWindows(payload);
  const ticks = payload.ticks.slice().sort((a, b) => a.t - b.t);
  const omega = omegaDegPerSec(ticks).values;

  const reactionBy = byTarget(metrics.switchReaction);
  const movementBy = byTarget(metrics.movementExecution);
  const stopBy = byTarget(metrics.stopControl);
  const shotBy = byTarget(metrics.firstShot);
  const detectionBy = byTarget(detection);
  const trackingBy = byTarget(tracking);
  const windowBy = byTarget(windows);

  const peripheral = payload.events
    .filter((event): event is VisibleEvent => event.type === 'visible' && event.zone === 'peripheral')
    .slice()
    .sort((a, b) => a.t - b.t);

  const rows = peripheral.map((event, index): SpiderWideMechanismRow => {
    const targetId = event.targetId;
    const flags: string[] = [];

    const firstOnTarget = trackingBy.get(targetId)?.samples.find((sample) => sample.onTarget);
    if (firstOnTarget === undefined) flags.push('no_on_target');

    const window = windowBy.get(targetId);
    if (window?.tFirstShot === undefined) flags.push('no_first_shot');

    const peak = movementBy.get(targetId)?.peakOmegaDegPerSec;
    const entry = firstOnTarget !== undefined ? omegaAt(ticks, omega, firstOnTarget.t) : undefined;
    // A zero peak would make the ratio meaningless rather than "perfectly braked".
    const brake = entry !== undefined && peak !== undefined && peak > 0 ? entry / peak : undefined;

    const trigger =
      window?.tFirstShot !== undefined && firstOnTarget !== undefined
        ? window.tFirstShot - firstOnTarget.t
        : undefined;

    const detected = detectionBy.get(targetId);
    if (detected?.baselineInsufficient) flags.push('baseline_insufficient');
    if (detected?.tDetectMs === undefined) flags.push('no_detection');

    const stop = stopBy.get(targetId);
    return {
      targetId,
      presentationIndex: index + 1,
      side: String(event.side),
      ...optional('peakOmegaDegPerSec', peak),
      ...optional('entryOmegaDegPerSec', entry),
      ...optional('brakeRetention', brake),
      ...optional('triggerMarginMs', trigger),
      ...optional('overshootDeg', stop?.overshootDeg),
      ...optional('dropCount', stop?.dropCount),
      ...optional('microAdjustCount', stop?.microAdjustCount),
      ...optional('fireAngleErrorDeg', shotBy.get(targetId)?.fireAngleErrorDeg),
      ...optional('reactionMs', reactionBy.get(targetId)?.reactionMs),
      ...optional('movementTimeMs', movementBy.get(targetId)?.movementTimeMs),
      detectionStatus: detected?.status ?? 'missing',
      baselineInsufficient: detected?.baselineInsufficient ?? true,
      flags,
    };
  });

  return {
    peripheralCount: rows.length,
    detectedCount: rows.filter((row) => !row.flags.includes('no_detection')).length,
    baselineInsufficientCount: rows.filter((row) => row.baselineInsufficient).length,
    rows,
  };
}

/** CSV 欄序 —— 研究側以 `run_id` + `target_id` 左接 `trial_metrics.csv`。 */
export const MECHANISM_CSV_COLUMNS = [
  'run_id',
  'target_id',
  'presentation_index',
  'side',
  'peak_omega_deg_per_sec',
  'entry_omega_deg_per_sec',
  'brake_retention',
  'trigger_margin_ms',
  'overshoot_deg',
  'drop_count',
  'micro_adjust_count',
  'fire_angle_error_deg',
  'reaction_ms',
  'movement_time_ms',
  'detection_status',
  'baseline_insufficient',
  'flags',
] as const;

export interface MechanismRunInput {
  readonly runId: string;
  readonly summary: SpiderWideMechanismSummary;
}

export function formatMechanismCsv(runs: readonly MechanismRunInput[]): string {
  const lines = [MECHANISM_CSV_COLUMNS.join(',')];
  for (const run of runs) {
    for (const row of run.summary.rows) {
      lines.push([
        csv(run.runId),
        csv(row.targetId),
        String(row.presentationIndex),
        csv(row.side),
        num(row.peakOmegaDegPerSec),
        num(row.entryOmegaDegPerSec),
        num(row.brakeRetention),
        num(row.triggerMarginMs),
        num(row.overshootDeg),
        num(row.dropCount),
        num(row.microAdjustCount),
        num(row.fireAngleErrorDeg),
        num(row.reactionMs),
        num(row.movementTimeMs),
        csv(row.detectionStatus),
        row.baselineInsufficient ? 'true' : 'false',
        csv(row.flags.join('|')),
      ].join(','));
    }
  }
  return `${lines.join('\n')}\n`;
}

function omegaAt(
  ticks: readonly { readonly t: number }[],
  values: readonly number[],
  t: number,
): number | undefined {
  const index = ticks.findIndex((tick) => tick.t + EPSILON_MS >= t);
  if (index < 0) return undefined;
  const value = values[index];
  return Number.isFinite(value) ? Math.abs(value) : undefined;
}

function byTarget<T extends { readonly targetId: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item) => [item.targetId, item]));
}

function optional<K extends string, V>(key: K, value: V | undefined): Record<K, V> | Record<string, never> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

function num(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value) ? '' : String(value);
}

function csv(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
