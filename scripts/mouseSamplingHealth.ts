/**
 * WP-60 T4 / WP-61 T2 —— 匯出的**原始滑鼠取樣健康度**（FR-60.8）。
 *
 * 本檔是把 `spiderWideRepositioningRunner.ts` 裡的私有 `readSamplingHealth()` **原封不動**抬出來，
 * 讓 WP-61 的 cohort 稽核（`liftCohortAudit.ts`）與 WP-57 的方向性 runner 共用**同一個**定義。
 * 抬出來的理由是負面的：兩邊各算一次 `activeRateHz`，就會有兩個「事件率夠不夠」的答案 —— 而那正是
 * D-60.X1 花了一輪才校準對的那個量（平均率 vs 連續期間率差一個量級）。
 *
 * 間隙一律走 `segmentByTimeGap()`、中斷區間一律走 `deriveUnlockedIntervals()`（C-D4 單一定義）。
 * 本檔只做計數與取最大值，**不判斷任何一個空洞是什麼** —— 那是 WP-61 的構念問題。
 *
 * 純函式：不讀時鐘、不讀隨機、無 I/O。
 */
import type { ExportPayload } from '../src/data/export.ts';
import { deriveUnlockedIntervals, segmentByTimeGap, type TimeInterval } from '../src/metrics/mouseSampleGaps.ts';

export interface SamplingHealth {
  readonly sampleCount: number;
  readonly observedRateHz: number | undefined;
  readonly activeRateHz: number | undefined;
  readonly sampleOverflow: boolean | undefined;
  readonly lockBreakCount: number;
  readonly gapCountAtThreshold: number;
  readonly longestGapMs: number;
  /** 樣本流末筆的絕對時間（ms）—— 未關閉的 lock 中斷以它收尾，呼叫端也用它界定 drill 窗尾。 */
  readonly lastSampleMs: number;
  /** 推導出的未取鎖區間；呼叫端要判斷「標註是否落在中斷內」時需要它們本身，不只是計數。 */
  readonly unlockedIntervals: readonly TimeInterval[];
}

/**
 * 讀出取樣健康度；`mouseSamples` 缺席即回 `undefined`（所有欄位一起缺席）。
 *
 * `lockBreakCount` 也綁在 block 的存在上 —— `pointer_lock` 事件單獨存在時沒有任何樣本流可歸因，
 * 報一個「中斷 N 次」只會讓讀者以為某份取樣被污染了，而那份取樣根本不存在。
 *
 * @param gapThresholdMs 間隙門檻（ms）。**呼叫端必填** —— 它條件於錄製硬體的事件率（比照
 *                       `segmentByTimeGap()` 的紀律，凍成常數就會在別的硬體上說謊）。
 */
export function deriveSamplingHealth(payload: ExportPayload, gapThresholdMs: number): SamplingHealth | undefined {
  const block = payload.mouseSamples;
  if (block === undefined) return undefined;

  const sampling = payload.meta.mouseSampling;
  // 整數 µs 空間累加後才換算 ms，比照 `segmentByTimeGap()`（避免逐筆以 ms 相加累積浮點漂移）。
  let elapsedUs = 0;
  for (let i = 1; i < block.dtUs.length; i++) elapsedUs += block.dtUs[i];
  const lastSampleMs = block.t0Ms + elapsedUs / 1000;

  const unlockedIntervals = deriveUnlockedIntervals(payload.events, lastSampleMs);
  const segmentation = segmentByTimeGap(block, gapThresholdMs, unlockedIntervals);
  let longestGapMs = 0;
  for (const gap of segmentation.gaps) {
    if (gap.durationMs > longestGapMs) longestGapMs = gap.durationMs;
  }

  // WP-60 T-exit（D-60.X1）—— **連續期間**事件率：只計入落在 segment 內的樣本間隔，排除所有空洞。
  // 為什麼不能用 `meta.mouseSampling.observedRateHz` 當閘：那是整段 span 的**平均**率（含刻意的停頓、
  // 抬滑鼠、以及 drill 內任何不動的時間）。兩者在真人資料上差一個量級 —— T0 R2 三組實機摘要的平均率
  // 為 417／494／412 Hz，全部低於 500 Hz 下限，而**同一支滑鼠**在 R1 的連續移動期間量到 1005 Hz。
  // 以平均率當閘會把那三組全部誤判為「事件率不足、時間間隙判定不可用」，而 F1 要問的是「瀏覽器有沒有
  // 退化到 rAF 率」，不是「受測者有沒有停手」。⇒ 閘走 `activeRateHz`，`observedRateHz` 維持 provenance。
  let intervalCount = 0;
  let activeUs = 0;
  for (const segment of segmentation.segments) {
    for (let i = segment.startIndex + 1; i <= segment.endIndex; i++) {
      intervalCount++;
      activeUs += block.dtUs[i];
    }
  }
  // 一個間隔都沒有（樣本數 < 2，或每段都只有單筆）⇒ 無從量測，回 `undefined` 而非 0：0 會誤觸 blocker。
  const activeRateHz = intervalCount > 0 && activeUs > 0 ? (intervalCount * 1_000_000) / activeUs : undefined;

  return {
    sampleCount: block.dtUs.length,
    observedRateHz: sampling?.observedRateHz,
    activeRateHz,
    sampleOverflow: sampling?.overflow,
    lockBreakCount: unlockedIntervals.length,
    gapCountAtThreshold: segmentation.gaps.length,
    longestGapMs,
    lastSampleMs,
    unlockedIntervals,
  };
}
