import type { DrillEvent } from '../data/DataRecorder.ts';
import type { MouseSampleBlock } from '../data/export.ts';

/**
 * mouseSampleGaps —— WP-60 / T3（FR-60.5、FR-60.6、README §2.3）：把匯出的原始滑鼠取樣
 * （`ExportPayload.mouseSamples`）依**硬體時間間隙**切成連續區段，並把 Pointer Lock 中斷造成的
 * 空洞與其餘空洞分開。
 *
 * **這裡不偵測抬滑鼠。** 本模組交付的是一個中性的時序原語：「樣本流在哪裡不連續」。至於某個不連續
 * 是感測器離地、手停著不動、還是別的原因，是一個**構念**問題，屬 WP-61（OQ-60.4）。因此型別與函式
 * 名一律用 `gap`／`segment`／`unlocked` 這類時序語彙，不出現 `lift`／`reposition`／`suspicion`
 * —— 那三個字屬於既有的 `deriveRepositioningSuspicion()`（WP-57，角速度停滯語意），本模組
 * **不是它的第二套定義**（C-D4 / R6，由 `mouseSampleGaps.test.ts` 的 boundary scan 釘死）。
 *
 * **方法學來源**：`performance_analysis` 的 v3 輸入清洗管線 Stage 1（`contracts/modules/input/
 * lod_v3_default_config.json` 的 `TIME_GAP_THRESHOLD_MS = 30`、ADR-002）。授權無虞（D-60.P7），
 * 但**刻意不搬 Go 實作**（`backend/modules/input/infrastructure/lodclean/service.go`）：那份程式碼
 * 綁死 px/s 空間、1 ms nominal dt 與 pandas 語意相容性，三個前提在本專案都不成立。此處為 TS 重寫，
 * 且 `gapThresholdMs` **不凍結預設值**（見下）。
 *
 * **FR-60.6 的三種空洞**在本模組的分工：
 * - Pointer Lock 中斷 → 由 `lockIntervals` 指認，落入 `lockGapIndices`，**排除在 `gaps` 之外**；
 * - drill 尚未開始／已結束 → **結構性地不存在於本模組的輸出**：block 只涵蓋已記錄的樣本，
 *   第一筆之前與最後一筆之後沒有 `dtUs`，故不會被當成間隙。呼叫端比對 `t0Ms`／末筆時間與 drill
 *   窗界即可辨識，本模組不代為宣稱；
 * - 其餘（含感測器離地）→ 留在 `gaps`，**作為候選而非結論**。
 *
 * 純函式：不讀時鐘、不讀隨機、不 I/O，不 import DOM／three／`node:*`／`fs`。
 */

/** 一段時間區間（ms，payload 時鐘域）。 */
export interface TimeInterval {
  readonly startMs: number;
  readonly endMs: number;
}

/** 樣本流中的一個時間間隙（相鄰兩筆樣本之間 `dt > gapThresholdMs` 的空洞）。 */
export interface SampleGap {
  /** 間隙前最後一筆樣本的時間（ms）。 */
  readonly startMs: number;
  /** 間隙後第一筆樣本的時間（ms）。 */
  readonly endMs: number;
  /** 間隙長度（ms）= `dtUs[afterIndex] / 1000`，直接由整數微秒換算而非由兩端相減。 */
  readonly durationMs: number;
  /** 間隙前後樣本在 block 中的 index，供呼叫端取用鄰近運動學。 */
  readonly beforeIndex: number;
  readonly afterIndex: number;
}

/** 一段連續（無間隙）的樣本區段；`endIndex` 為**含端點**。 */
export interface SampleSegment {
  readonly startIndex: number;
  readonly endIndex: number;
}

export interface SampleSegmentation {
  /**
   * 依 `gapThresholdMs` 切出的連續區段（PA 語彙的 stroke）。**每一個**間隙都會切段
   * —— 包含被歸因於 Pointer Lock 的那些：lock 中斷同樣是樣本流的真實不連續，兩側的樣本並不相鄰。
   * lock 只改變間隙的**歸因**，不改變切段。
   */
  readonly segments: readonly SampleSegment[];
  /** 未被 `lockIntervals` 解釋的間隙。 */
  readonly gaps: readonly SampleGap[];
  /**
   * 與 Pointer Lock 中斷重疊的間隙 —— **這些不是感測器離地**（FR-60.6）。
   *
   * 值為該間隙**前一筆樣本在 block 中的 index**（即它若留在 `gaps` 時的 `beforeIndex`）。刻意不用
   * 「`gaps` 陣列的 index」：那些間隙已被排除在 `gaps` 之外（見 §Invariants），指向一個不含它們的
   * 陣列會是空指標。以樣本 index 表示，呼叫端可直接在 block 上定位那個空洞。
   */
  readonly lockGapIndices: readonly number[];
}

/**
 * 間隙判定的浮點容差（µs）。
 *
 * 判定一律在**整數微秒空間**進行：`dtUs[i] > gapThresholdMs * 1000`。`dtUs` 本身是整數，唯一的浮點
 * 來源是 `gapThresholdMs * 1000` 這個乘積（例：`18.2 * 1000` 不是精確的 `18200`）。該誤差為相對
 * 1e-16 量級，對 30 ms 門檻約 1e-9 µs —— 遠小於 1 µs 的量化格。加上這個 1e-6 µs（= 1 ps）的容差，
 * 「**恰在門檻上**」在任一方向的表示誤差下都判為**不是間隙**（README §2.3 明文：`dt > 門檻`），
 * 而任何真正超過門檻至少 1 µs 的間隔都不會被吃掉。
 */
const GAP_EPSILON_US = 1e-6;

/**
 * 依時間間隙切段（FR-60.5，= PA 輸入清洗管線的 Stage 1）。
 *
 * 註：來源管線那個三字母縮寫在本 repo **刻意不拼出**（D-60.P4／R7：Three.js 的 level-of-detail
 * 標準類別佔用了同一個縮寫，而本專案 `import * as THREE from 'three/webgpu'`）。出處以
 * `lod_v3_default_config.json` 這個實際檔名指認即可，資訊不損失。
 *
 * @param block          匯出的原始取樣區塊（columnar，`dtUs` 為整數微秒）。
 * @param gapThresholdMs 間隙門檻（ms，正有限）。**呼叫端必填、不給預設值** —— 它條件於錄製硬體的
 *                       事件率（T0 R1 在 1000 Hz 滑鼠上量到連續移動期間的空洞上限約 18 ms），凍成
 *                       常數就會在別的硬體上說謊。比照 `RepositioningSuspicionOptions` 的紀律。
 * @param lockIntervals  Pointer Lock **中斷**（未取鎖）區間；缺席即空陣列。由
 *                       `deriveUnlockedIntervals()` 從 `pointer_lock` 事件推導。
 * @throws 三個 columnar 陣列不等長、`dtUs` 含負值／非有限、`t0Ms` 非有限、`gapThresholdMs` 非正或
 *         非有限、`lockIntervals` 端點非有限或倒置時，擲出**指名欄位**的錯誤。
 */
export function segmentByTimeGap(
  block: MouseSampleBlock,
  gapThresholdMs: number,
  lockIntervals: readonly TimeInterval[] = [],
): SampleSegmentation {
  if (!Number.isFinite(gapThresholdMs) || gapThresholdMs <= 0) {
    throw new Error('segmentByTimeGap: gapThresholdMs must be a positive finite number');
  }
  if (!Number.isFinite(block.t0Ms)) {
    throw new Error('segmentByTimeGap: block.t0Ms must be a finite number');
  }

  const n = block.dtUs.length;
  if (block.dx.length !== n) {
    throw new Error(`segmentByTimeGap: block.dx length ${block.dx.length} does not match block.dtUs length ${n}`);
  }
  if (block.dy.length !== n) {
    throw new Error(`segmentByTimeGap: block.dy length ${block.dy.length} does not match block.dtUs length ${n}`);
  }
  for (let i = 0; i < n; i++) {
    const dtUs = block.dtUs[i];
    if (!Number.isFinite(dtUs) || dtUs < 0) {
      throw new Error(`segmentByTimeGap: block.dtUs[${i}] must be a non-negative finite number`);
    }
  }
  for (let i = 0; i < lockIntervals.length; i++) {
    const interval = lockIntervals[i];
    if (!Number.isFinite(interval.startMs) || !Number.isFinite(interval.endMs)) {
      throw new Error(`segmentByTimeGap: lockIntervals[${i}] endpoints must be finite numbers`);
    }
    if (interval.endMs < interval.startMs) {
      throw new Error(`segmentByTimeGap: lockIntervals[${i}].endMs must be >= lockIntervals[${i}].startMs`);
    }
  }

  // 少於兩筆樣本 ⇒ 沒有任何「相鄰兩筆之間的間隔」存在，關於連續性的宣稱一律無從成立。回空
  // segmentation（而非一個長度 1 的區段），讓「本份取樣不足以切段」與「切出了一個區段」在型別上
  // 就分得開。n >= 2 時單筆樣本的區段仍是合法區段（startIndex === endIndex）。
  if (n < 2) return { segments: [], gaps: [], lockGapIndices: [] };

  const thresholdUs = gapThresholdMs * 1000;
  // 絕對時間在**整數微秒**空間累加後才換算成 ms（`dtUs[0]` 依契約恆為 0，且 index 0 沒有前一筆，
  // 故一律從 index 1 起算）——避免逐筆以 ms 相加累積浮點漂移。
  const timesMs = new Array<number>(n);
  timesMs[0] = block.t0Ms;
  let elapsedUs = 0;
  for (let i = 1; i < n; i++) {
    elapsedUs += block.dtUs[i];
    timesMs[i] = block.t0Ms + elapsedUs / 1000;
  }

  const segments: SampleSegment[] = [];
  const gaps: SampleGap[] = [];
  const lockGapIndices: number[] = [];
  let segmentStart = 0;

  for (let i = 1; i < n; i++) {
    if (block.dtUs[i] - thresholdUs <= GAP_EPSILON_US) continue;

    const gap: SampleGap = {
      startMs: timesMs[i - 1],
      endMs: timesMs[i],
      durationMs: block.dtUs[i] / 1000,
      beforeIndex: i - 1,
      afterIndex: i,
    };

    segments.push({ startIndex: segmentStart, endIndex: i - 1 });
    segmentStart = i;

    if (overlapsAny(gap, lockIntervals)) lockGapIndices.push(gap.beforeIndex);
    else gaps.push(gap);
  }
  segments.push({ startIndex: segmentStart, endIndex: n - 1 });

  return { segments, gaps, lockGapIndices };
}

/**
 * 從 `pointer_lock` 事件推導**未取鎖**區間（FR-60.6 的第二種空洞）。
 *
 * `pointer_lock` 是狀態 edge（`{ locked, t }`，WP-60 / T1）：`locked: false` 開一段中斷，下一個
 * `locked: true` 關掉它；直到 `untilMs` 都沒有關掉的，就以 `untilMs` 收尾。連續同向的 edge 只有第一個
 * 有意義（重複的 unlock 不會另開一段）。事件缺席 ⇒ 回空陣列 ⇒ `segmentByTimeGap()` 不會把任何間隙
 * 歸因給 lock —— 這是**保守側**：寧可把 lock 空洞留在 `gaps` 當候選，也不要無中生有地解釋掉一個
 * 真實的空洞。
 *
 * @param events  匯出的事件串（`ExportPayload.events`；非 `pointer_lock` 者忽略）。
 * @param untilMs 未關閉的中斷段以此收尾（一般取樣本流末筆時間或 drill 結束時間）。
 * @throws `untilMs` 非有限、或 `pointer_lock` 事件的 `t` 非有限時，擲出指名欄位的錯誤。
 */
export function deriveUnlockedIntervals(
  events: readonly DrillEvent[],
  untilMs: number,
): readonly TimeInterval[] {
  if (!Number.isFinite(untilMs)) {
    throw new Error('deriveUnlockedIntervals: untilMs must be a finite number');
  }

  const intervals: TimeInterval[] = [];
  let openStartMs: number | undefined;

  for (const event of events) {
    if (event.type !== 'pointer_lock') continue;
    if (!Number.isFinite(event.t)) {
      throw new Error('deriveUnlockedIntervals: pointer_lock event t must be a finite number');
    }
    if (!event.locked) {
      if (openStartMs === undefined) openStartMs = event.t;
      continue;
    }
    if (openStartMs !== undefined) {
      intervals.push({ startMs: openStartMs, endMs: Math.max(openStartMs, event.t) });
      openStartMs = undefined;
    }
  }
  if (openStartMs !== undefined) {
    intervals.push({ startMs: openStartMs, endMs: Math.max(openStartMs, untilMs) });
  }

  return intervals;
}

/**
 * 間隙與中斷區間是否**實質重疊**（重疊長度 > 0）。端點相接不算重疊 —— 一個恰好在間隙起點收掉的
 * lock 中斷，不該把它後面那個真實的間隙一起解釋掉（README §2.6 F2）。
 */
function overlapsAny(gap: SampleGap, lockIntervals: readonly TimeInterval[]): boolean {
  for (const interval of lockIntervals) {
    if (Math.max(gap.startMs, interval.startMs) < Math.min(gap.endMs, interval.endMs)) return true;
  }
  return false;
}
