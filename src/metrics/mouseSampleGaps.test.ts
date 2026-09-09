import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { DrillEvent } from '../data/DataRecorder.ts';
import type { MouseSampleBlock } from '../data/export.ts';
import { deriveUnlockedIntervals, segmentByTimeGap } from './mouseSampleGaps.ts';

/**
 * WP-60 / T3 —— FR-60.5／FR-60.6：時間間隙切段原語與 Pointer Lock 消歧。
 *
 * 本檔的 fixture 全部是**合成**的，且刻意如此：切段是一個純時序運算，它的正確性完全由 `dtUs`
 * 決定，不需要真人資料。真人資料要回答的是**門檻該取多少**（WP-61），而那個問題本檔不碰
 * —— `gapThresholdMs` 一律由測試明文傳入。
 */

const NOMINAL_DT_US = 1000;

/**
 * 由「相鄰間隔（µs）」建 block。`dtUs[0]` 依契約恆為 0，故傳入的第一個間隔對應第二筆樣本。
 * `dx`/`dy` 只需存在且等長（切段不讀它們），以 index 當值讓錯位一眼可見。
 */
function blockFromIntervals(intervalsUs: readonly number[], t0Ms = 1000): MouseSampleBlock {
  const dtUs = [0, ...intervalsUs];
  return {
    t0Ms,
    dtUs,
    dx: dtUs.map((_, i) => i),
    dy: dtUs.map((_, i) => -i),
  };
}

/** n 筆 nominal 間隔（1 ms）的連續樣本。 */
function steady(sampleCount: number): number[] {
  return new Array<number>(sampleCount - 1).fill(NOMINAL_DT_US);
}

describe('WP-60 T3 — 依時間間隙切段（FR-60.5）', () => {
  it('returns one segment and no gaps when every interval is below the threshold', () => {
    const result = segmentByTimeGap(blockFromIntervals(steady(10)), 30);

    expect(result.segments).toEqual([{ startIndex: 0, endIndex: 9 }]);
    expect(result.gaps).toEqual([]);
    expect(result.lockGapIndices).toEqual([]);
  });

  it('splits at a gap and reports its endpoints, duration and neighbouring indices', () => {
    // 樣本 0..2 連續、樣本 2→3 之間空 50 ms、樣本 3..5 連續。
    const result = segmentByTimeGap(blockFromIntervals([1000, 1000, 50_000, 1000, 1000]), 30);

    expect(result.segments).toEqual([
      { startIndex: 0, endIndex: 2 },
      { startIndex: 3, endIndex: 5 },
    ]);
    expect(result.gaps).toEqual([
      { startMs: 1002, endMs: 1052, durationMs: 50, beforeIndex: 2, afterIndex: 3 },
    ]);
  });

  it('treats an interval exactly at the threshold as continuous, and one microsecond above it as a gap', () => {
    // README §2.3 明文是 `dt > 門檻`：**恰在門檻上不是間隙**。這一對案例是 `GAP_EPSILON_US`
    // 容差策略的直接驗收 —— 容差必須大到吃掉 `gapThresholdMs * 1000` 的浮點表示誤差，
    // 又小到不吃掉 1 µs 的真實差異。
    const atThreshold = segmentByTimeGap(blockFromIntervals([1000, 30_000, 1000]), 30);
    const justAbove = segmentByTimeGap(blockFromIntervals([1000, 30_001, 1000]), 30);

    expect(atThreshold.gaps).toEqual([]);
    expect(atThreshold.segments).toEqual([{ startIndex: 0, endIndex: 3 }]);
    expect(justAbove.gaps).toHaveLength(1);
    expect(justAbove.gaps[0].beforeIndex).toBe(1);
  });

  it('treats an interval just below the threshold as continuous, including a non-integral threshold', () => {
    // `18.2 * 1000` 不是精確的 `18200`（T0 R1 量到的連續移動空洞上限恰在這個量級），故這個門檻值
    // 專門用來壓浮點路徑：18,200 µs 不得成為間隙，18,201 µs 必須成為間隙。
    const below = segmentByTimeGap(blockFromIntervals([1000, 29_999, 1000]), 30);
    const atFractional = segmentByTimeGap(blockFromIntervals([1000, 18_200, 1000]), 18.2);
    const aboveFractional = segmentByTimeGap(blockFromIntervals([1000, 18_201, 1000]), 18.2);

    expect(below.gaps).toEqual([]);
    expect(atFractional.gaps).toEqual([]);
    expect(aboveFractional.gaps).toHaveLength(1);
  });

  it('holds the boundary for a threshold whose microsecond product lands below the integer', () => {
    // `GAP_EPSILON_US` 的**唯一**有偵測力的案例：`32.3 * 1000` = 32,299.999999999996，落在
    // 32,300 的**下方**。少了容差，恰在門檻上的 32,300 µs 會因為 5.8e-12 µs 的表示誤差被判成間隙
    // —— 那正是把捨入雜訊當成訊號。（一般的門檻值如 30／18.2 其乘積落在整數上或其上方，
    // 拿它們當邊界案例證明不了容差有沒有生效；此處以 10–60 ms 間全部一位小數值窮舉找出這一個。）
    const atThreshold = segmentByTimeGap(blockFromIntervals([1000, 32_300, 1000]), 32.3);
    const justAbove = segmentByTimeGap(blockFromIntervals([1000, 32_301, 1000]), 32.3);

    expect(atThreshold.gaps).toEqual([]);
    expect(justAbove.gaps).toHaveLength(1);
  });

  it('splits twice when two gaps are adjacent, leaving a single-sample segment between them', () => {
    const result = segmentByTimeGap(blockFromIntervals([1000, 50_000, 60_000, 1000]), 30);

    expect(result.segments).toEqual([
      { startIndex: 0, endIndex: 1 },
      { startIndex: 2, endIndex: 2 },
      { startIndex: 3, endIndex: 4 },
    ]);
    expect(result.gaps.map((gap) => gap.durationMs)).toEqual([50, 60]);
    expect(result.gaps.map((gap) => [gap.beforeIndex, gap.afterIndex])).toEqual([
      [1, 2],
      [2, 3],
    ]);
  });

  it('handles a gap at the head and at the tail of the sample stream', () => {
    const head = segmentByTimeGap(blockFromIntervals([50_000, 1000, 1000]), 30);
    const tail = segmentByTimeGap(blockFromIntervals([1000, 1000, 50_000]), 30);

    expect(head.segments).toEqual([
      { startIndex: 0, endIndex: 0 },
      { startIndex: 1, endIndex: 3 },
    ]);
    expect(head.gaps.map((gap) => gap.afterIndex)).toEqual([1]);
    expect(tail.segments).toEqual([
      { startIndex: 0, endIndex: 2 },
      { startIndex: 3, endIndex: 3 },
    ]);
    expect(tail.gaps.map((gap) => gap.beforeIndex)).toEqual([2]);
  });

  it('reports two single-sample segments when the whole block is one big gap', () => {
    const result = segmentByTimeGap(blockFromIntervals([1_500_000], 2000), 30);

    expect(result.segments).toEqual([
      { startIndex: 0, endIndex: 0 },
      { startIndex: 1, endIndex: 1 },
    ]);
    expect(result.gaps).toEqual([
      { startMs: 2000, endMs: 3500, durationMs: 1500, beforeIndex: 0, afterIndex: 1 },
    ]);
  });

  it('keeps absolute times exact across a long stream by accumulating in integer microseconds', () => {
    // 逐筆以 ms 相加會漂移；本模組在整數 µs 空間累加後才換算。10,000 筆 × 997 µs 的總跨度必須
    // 逐位等於 `t0Ms + 9,970,000 µs`。
    const result = segmentByTimeGap(blockFromIntervals(new Array<number>(10_000).fill(997), 1000), 30);
    const lastGap = segmentByTimeGap(
      blockFromIntervals([...new Array<number>(10_000).fill(997), 50_000], 1000),
      30,
    ).gaps[0];

    expect(result.gaps).toEqual([]);
    expect(lastGap.startMs).toBe(1000 + 9_970_000 / 1000);
  });
});

describe('WP-60 T3 — Pointer Lock 消歧（FR-60.6、F2）', () => {
  it('moves a gap overlapping an unlocked interval out of gaps and into lockGapIndices', () => {
    const block = blockFromIntervals([1000, 500_000, 1000]);
    const result = segmentByTimeGap(block, 30, [{ startMs: 1100, endMs: 1400 }]);

    expect(result.lockGapIndices).toEqual([1]);
    expect(result.gaps).toEqual([]);
    // lock 只改變歸因，不改變切段 —— 兩側樣本確實不相鄰。
    expect(result.segments).toEqual([
      { startIndex: 0, endIndex: 1 },
      { startIndex: 2, endIndex: 3 },
    ]);
  });

  it('separates an unlocked hole from an immediately adjacent real gap without touching the other', () => {
    // F2 的關鍵案例：樣本 1→2 的空洞被 lock 中斷解釋（1001–1201 ms），樣本 2→3 的空洞緊接其後
    // （1201–1451 ms）但 lock 已在 1201 ms 收掉。端點相接不算重疊，故後者必須留在 `gaps`。
    const block = blockFromIntervals([1000, 200_000, 250_000, 1000]);
    const result = segmentByTimeGap(block, 30, [{ startMs: 1001, endMs: 1201 }]);

    // 一個斷言同時檢查兩邊：被歸因的那一個進 lockGapIndices，未被歸因的留在 gaps，且兩邊不重疊。
    expect({
      lockGapIndices: result.lockGapIndices,
      gapBeforeIndices: result.gaps.map((gap) => gap.beforeIndex),
      overlap: result.gaps.filter((gap) => result.lockGapIndices.includes(gap.beforeIndex)),
    }).toEqual({ lockGapIndices: [1], gapBeforeIndices: [2], overlap: [] });
  });

  it('leaves every gap in gaps when no lock intervals are supplied', () => {
    const block = blockFromIntervals([1000, 500_000, 1000]);

    expect(segmentByTimeGap(block, 30).gaps).toHaveLength(1);
    expect(segmentByTimeGap(block, 30, []).lockGapIndices).toEqual([]);
  });

  it('derives unlocked intervals from pointer_lock edges and closes an open one at untilMs', () => {
    const events: DrillEvent[] = [
      { type: 'pointer_lock', locked: false, t: 1100 },
      { type: 'pointer_lock', locked: false, t: 1150 },
      { type: 'pointer_lock', locked: true, t: 1400 },
      { type: 'pointer_lock', locked: true, t: 1500 },
      { type: 'pointer_lock', locked: false, t: 1800 },
    ];

    expect(deriveUnlockedIntervals(events, 2000)).toEqual([
      { startMs: 1100, endMs: 1400 },
      { startMs: 1800, endMs: 2000 },
    ]);
    expect(deriveUnlockedIntervals([], 2000)).toEqual([]);
  });

  it('feeds derived intervals back into segmentation end to end', () => {
    const block = blockFromIntervals([1000, 500_000, 1000]);
    const events: DrillEvent[] = [
      { type: 'pointer_lock', locked: false, t: 1050 },
      { type: 'pointer_lock', locked: true, t: 1400 },
    ];
    const result = segmentByTimeGap(block, 30, deriveUnlockedIntervals(events, 1502));

    expect(result.lockGapIndices).toEqual([1]);
    expect(result.gaps).toEqual([]);
  });
});

describe('WP-60 T3 — 型別邊界與 typed error', () => {
  it('returns an empty segmentation for an empty block and for a single sample', () => {
    const empty = { t0Ms: 0, dtUs: [], dx: [], dy: [] } as const;
    const single = { t0Ms: 1000, dtUs: [0], dx: [0], dy: [0] } as const;
    const emptySegmentation = { segments: [], gaps: [], lockGapIndices: [] };

    expect([segmentByTimeGap(empty, 30), segmentByTimeGap(single, 30)]).toEqual([
      emptySegmentation,
      emptySegmentation,
    ]);
  });

  it('throws a field-named error when the columnar arrays disagree in length', () => {
    const shortDx = { t0Ms: 1000, dtUs: [0, 1000], dx: [0], dy: [0, -1] };
    const shortDy = { t0Ms: 1000, dtUs: [0, 1000], dx: [0, 1], dy: [0] };

    expect(() => segmentByTimeGap(shortDx, 30)).toThrow(/block\.dx/);
    expect(() => segmentByTimeGap(shortDy, 30)).toThrow(/block\.dy/);
  });

  it('throws a field-named error when dtUs holds a negative or non-finite value', () => {
    const negative = { t0Ms: 1000, dtUs: [0, -1], dx: [0, 1], dy: [0, -1] };
    const nonFinite = { t0Ms: 1000, dtUs: [0, Number.NaN], dx: [0, 1], dy: [0, -1] };

    expect(() => segmentByTimeGap(negative, 30)).toThrow(/block\.dtUs\[1\]/);
    expect(() => segmentByTimeGap(nonFinite, 30)).toThrow(/block\.dtUs\[1\]/);
  });

  it('throws a field-named error when gapThresholdMs is not positive', () => {
    const block = blockFromIntervals(steady(4));

    expect(() => segmentByTimeGap(block, 0)).toThrow(/gapThresholdMs/);
    expect(() => segmentByTimeGap(block, -5)).toThrow(/gapThresholdMs/);
  });

  it('throws a field-named error when gapThresholdMs is not finite', () => {
    const block = blockFromIntervals(steady(4));

    expect(() => segmentByTimeGap(block, Number.NaN)).toThrow(/gapThresholdMs/);
    expect(() => segmentByTimeGap(block, Number.POSITIVE_INFINITY)).toThrow(/gapThresholdMs/);
  });

  it('throws a field-named error for a non-finite t0Ms or an inverted lock interval', () => {
    const block = blockFromIntervals(steady(4));

    expect(() => segmentByTimeGap({ ...block, t0Ms: Number.NaN }, 30)).toThrow(/block\.t0Ms/);
    expect(() => segmentByTimeGap(block, 30, [{ startMs: 1200, endMs: 1100 }])).toThrow(/lockIntervals\[0\]/);
    expect(() => segmentByTimeGap(block, 30, [{ startMs: 1200, endMs: Number.NaN }])).toThrow(/lockIntervals\[0\]/);
    expect(() => deriveUnlockedIntervals([], Number.NaN)).toThrow(/untilMs/);
  });
});

describe('WP-60 T3 — C-D4：不是既有停滯判準的第二定義（R6）', () => {
  const MODULE_PATH = fileURLToPath(new URL('./mouseSampleGaps.ts', import.meta.url));
  // 掃描對象是**程式碼**，不是註解 —— 沿用 WP-57 T5 boundary scan 的既有教訓：註解正當地「提到」
  // 禁用符號來解釋為什麼不用它們，拿 prose 當違規會逼人把說明刪掉。
  //
  // ⚠️ 反過來說，WP-57 那支 scan 的 importer 檢查是**不剝註解**的整檔 `includes()`，所以本檔連在
  // 註解裡拼出它的模組名都會被它判為 importer。那個粗糙度是它刻意的保守側，故此處改以 WP／task
  // 編號指路，不拼模組名 —— 修本檔比放寬一個既有的紅線便宜得多。
  const code = codeOnly(readFileSync(MODULE_PATH, 'utf-8'));

  it('touches none of the existing repositioning-suspicion machinery', () => {
    for (const pattern of [/omegaDegPerSec/, /deriveDetectionMetrics/, /deriveRepositioningSuspicion/]) {
      expect(code).not.toMatch(pattern);
    }
  });

  it('names nothing in the lift-off construct vocabulary', () => {
    // 構念歸屬屬 WP-61（OQ-60.4）。這個原語只可以用時序語彙說話。
    for (const pattern of [/lift/i, /reposition/i, /suspicion/i, /stall/i]) {
      expect(code).not.toMatch(pattern);
    }
  });

  it('stays a pure function: no DOM, three, node builtins, fs, clock or randomness', () => {
    for (const pattern of [
      /from ['"]three/,
      /from ['"]node:/,
      /readFileSync/,
      /Date\.now\s*\(/,
      /performance\.now\s*\(/,
      /Math\.random\s*\(/,
      /document\./,
      /window\./,
    ]) {
      expect(code).not.toMatch(pattern);
    }
  });
});

describe('WP-60 T3 — C-D3：時序原語不得進教練報告、診斷規則或 registry', () => {
  const MODULE_NAME = 'mouseSampleGaps';

  it('is imported by nothing in src/ other than its own test', () => {
    const importers = tsFilesUnder(fileURLToPath(new URL('..', import.meta.url))).filter((file) => {
      if (file.endsWith(`${MODULE_NAME}.ts`) || file.endsWith(`${MODULE_NAME}.test.ts`)) return false;
      return readFileSync(file, 'utf-8').includes(MODULE_NAME);
    });

    // 一個「未經構念驗證的東西不會說話」的宣稱，只有在**沒有任何生產模組看得到它**時才成立。
    expect(importers).toEqual([]);
  });

  it('uses no LOD abbreviation anywhere in src, tests or scripts (R7 — THREE.LOD collision)', () => {
    const root = fileURLToPath(new URL('../..', import.meta.url));
    const selfPath = fileURLToPath(new URL('./mouseSampleGaps.test.ts', import.meta.url));
    // 本檔自身必須排除：它在 describe 名稱裡正當地提到那個縮寫來說明為什麼不用它。
    const offenders = ['src', 'tests', 'scripts']
      .flatMap((dir) => tsFilesUnder(`${root}/${dir}`))
      .filter((file) => normalize(file) !== normalize(selfPath))
      .filter((file) => /\bLOD\b/.test(readFileSync(file, 'utf-8')));

    expect(offenders).toEqual([]);
  });
});

/** 去掉區塊與行註解，讓 boundary scan 只看得到程式碼。 */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** 統一分隔符並收掉重複斜線，讓 `readdirSync` 拼出的路徑與 `fileURLToPath` 的可比。 */
function normalize(path: string): string {
  return path.replaceAll('\\', '/').replace(/\/{2,}/g, '/');
}

function tsFilesUnder(root: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = `${root}/${entry}`;
    if (statSync(path).isDirectory()) {
      found.push(...tsFilesUnder(path));
      continue;
    }
    if (entry.endsWith('.ts')) found.push(path);
  }
  return found;
}
