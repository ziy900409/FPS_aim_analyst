import { describe, expect, it } from 'vitest';
import type { DrillEvent } from '../../src/data/DataRecorder.ts';
import type { ExportPayload, MouseSampleBlock } from '../../src/data/export.ts';
import type { TickRecord } from '../../src/data/RingBuffer.ts';
import { makePayload, makeTick } from '../replay/fixtures.ts';
import {
  assessDirectionality,
  formatSpiderWideRepositioningSummary,
  MIN_OBSERVED_RATE_HZ,
  MIN_SENSITIVITY_LEVELS,
  REPORTED_GAP_THRESHOLD_MS,
  SPIDER_WIDE_DRILL_ID,
  summarizeSpiderWideRuns,
  type SpiderWideRunSummary,
} from '../../scripts/spiderWideRepositioningRunner.ts';

/**
 * WP-57 —— `analyze:spider-wide` 的純函式契約。
 *
 * 本檔**不**重測 `deriveMouseThrow()`／`deriveRepositioningSuspicion()`／`deriveDetectionMetrics()`
 * ／`segmentByTimeGap()`（各有自己的測試，C-D4 單一定義）。這裡測的是 runner 自己的四件事：
 * ① 資料品質 blocker 有沒有點名，② opaque `resolvedFrom.aspect` 讀不讀得到，
 * ③ **cohort 共線時方向性有沒有拒答** —— ③ 是本 runner 存在的理由（§T5-real 的教訓），
 * ④ **WP-60 T4**：原始取樣的四種靜默失效有沒有變成 blocker，而缺該區塊**沒有**變成 blocker。
 */

/** §T5-real 那四份真人 run 的形狀：每個指示各一個感度 ⇒ 條件與 cm/360 完全共線。 */
const COLLINEAR_COHORT: readonly SpiderWideRunSummary[] = [
  summary({ instruction: '全程不抬滑鼠', cmPer360: 34.6, suspectedRate: 0.03 }),
  summary({ instruction: '刻意短停頓', cmPer360: 34.6, suspectedRate: 0.17 }),
  summary({ instruction: '照平常打', cmPer360: 52.0, suspectedRate: 0 }),
  summary({ instruction: '每次都抬滑鼠', cmPer360: 103.9, suspectedRate: 0.78 }),
];

describe('assessDirectionality —— 共線 cohort 必須拒答', () => {
  it('refuses the 2026-09-08 four-run cohort and names what is missing', () => {
    const assessment = assessDirectionality(COLLINEAR_COHORT);

    expect(assessment.answerable).toBe(false);
    expect(assessment.points).toEqual([]);
    expect(assessment.monotonicIncreasing).toBeUndefined();
    // 四個指示各自只有一個感度 ⇒ 四條理由 + 一條總結。
    expect(assessment.reasons.filter((reason) => reason.includes('相異 cm/360'))).toHaveLength(4);
    expect(assessment.reasons.some((reason) => reason.includes('共線'))).toBe(true);
  });

  it('answers once one instruction carries several sensitivities, sorted by cm/360', () => {
    const assessment = assessDirectionality([
      summary({ instruction: '照平常打', cmPer360: 103.9, suspectedRate: 0.6 }),
      summary({ instruction: '照平常打', cmPer360: 34.6, suspectedRate: 0.05 }),
      summary({ instruction: '照平常打', cmPer360: 52.0, suspectedRate: 0.2 }),
    ]);

    expect(assessment.answerable).toBe(true);
    expect(assessment.points.map((point) => point.cmPer360)).toEqual([34.6, 52.0, 103.9]);
    expect(assessment.monotonicIncreasing).toBe(true);
  });

  it('reports a non-monotonic cohort as such instead of smoothing it', () => {
    const assessment = assessDirectionality([
      summary({ instruction: '照平常打', cmPer360: 34.6, suspectedRate: 0.4 }),
      summary({ instruction: '照平常打', cmPer360: 103.9, suspectedRate: 0.1 }),
    ]);

    expect(assessment.answerable).toBe(true);
    expect(assessment.monotonicIncreasing).toBe(false);
  });

  it('drops runs without an instruction, without DPI, or without an evaluable rate, and says so', () => {
    const assessment = assessDirectionality([
      summary({ instruction: '照平常打', cmPer360: 34.6, suspectedRate: 0.05 }),
      summary({ instruction: '照平常打', cmPer360: 52.0, suspectedRate: 0.2 }),
      summary({ instruction: undefined, cmPer360: 70, suspectedRate: 0.5 }),
      summary({ instruction: '照平常打', cmPer360: undefined, suspectedRate: 0.5 }),
      summary({ instruction: '照平常打', cmPer360: 90, suspectedRate: undefined }),
    ]);

    expect(assessment.answerable).toBe(true);
    expect(assessment.points).toHaveLength(2);
    expect(assessment.reasons.some((reason) => reason.startsWith('3 份 run 缺'))).toBe(true);
  });

  it('needs at least MIN_SENSITIVITY_LEVELS distinct throws — the same value twice is not two levels', () => {
    const assessment = assessDirectionality([
      summary({ instruction: '照平常打', cmPer360: 52.0, suspectedRate: 0.1 }),
      summary({ instruction: '照平常打', cmPer360: 52.0, suspectedRate: 0.3 }),
    ]);

    expect(MIN_SENSITIVITY_LEVELS).toBe(2);
    expect(assessment.answerable).toBe(false);
    expect(assessment.reasons.some((reason) => reason.includes('只有 1 個相異 cm/360'))).toBe(true);
  });
});

describe('summarizeSpiderWideRuns —— 資料品質 blocker', () => {
  it('reads cm/360 and the opaque resolvedFrom.aspect off a well-formed run', () => {
    const [row] = summarizeSpiderWideRuns([
      { sourcePath: 'ok.json', instruction: '照平常打', payload: widePayload({}) },
    ]);

    expect(row.aspect).toBeCloseTo(2.0031, 6);
    expect(row.dpi).toBe(800);
    // 52.0 cm/360 @ sens 1.0 / dpi 800 —— 與 §T5-real 的 baseline run 同一組設定。
    expect(row.cmPer360).toBeCloseTo(51.95, 1);
    // metadata 面全綠：drill／DPI／suspect／指示四個 blocker 都不該出現。此 payload 的 aim 全程
    // 靜止，故必然帶 KI-031 那一條（由下方專屬測試覆蓋）——它不是 metadata 問題。
    expect(row.blockers.filter((blocker) => !blocker.includes('KI-031'))).toEqual([]);
  });

  it('names a missing DPI as an auditability blocker rather than guessing 800', () => {
    const [row] = summarizeSpiderWideRuns([
      { sourcePath: 'no-dpi.json', instruction: '照平常打', payload: widePayload({ meta: { dpi: undefined } }) },
    ]);

    expect(row.dpi).toBeUndefined();
    expect(row.cmPer360).toBeUndefined();
    expect(row.blockers.some((blocker) => blocker.includes('meta.dpi'))).toBe(true);
  });

  it('names the wrong drill, a suspect run, and a missing instruction separately', () => {
    const [row] = summarizeSpiderWideRuns([
      { sourcePath: 'wrong.json', payload: widePayload({ meta: { drillId: 'spider-shot-v2', suspect: true } }) },
    ]);

    expect(row.blockers.some((blocker) => blocker.includes(SPIDER_WIDE_DRILL_ID))).toBe(true);
    expect(row.blockers.some((blocker) => blocker.includes('suspect'))).toBe(true);
    expect(row.blockers.some((blocker) => blocker.includes('指示標籤'))).toBe(true);
  });

  it('reports an empty peripheral population instead of a 0% flag rate', () => {
    const [row] = summarizeSpiderWideRuns([
      { sourcePath: 'center-only.json', instruction: '照平常打', payload: widePayload({ peripheral: false }) },
    ]);

    expect(row.peripheralCount).toBe(0);
    expect(row.suspectedRate).toBeUndefined();
    expect(row.timeoutRate).toBeUndefined();
    expect(row.blockers.some((blocker) => blocker.includes('母體為空'))).toBe(true);
  });

  it('names the KI-031 cliff when canonical defaults detect nothing at all', () => {
    // 全程不動的 aim ⇒ 沒有任何離心率下降 ⇒ 兩個 sustainedTicks 設定下都是 0 detected。
    const [row] = summarizeSpiderWideRuns([
      { sourcePath: 'ki031.json', instruction: '照平常打', payload: widePayload({}) },
    ]);

    expect(row.peripheralCount).toBe(1);
    expect(row.detectedAtDefault).toBe(0);
    expect(row.evaluableCount).toBe(0);
    expect(row.suspectedRate).toBeUndefined();
    expect(row.blockers.some((blocker) => blocker.includes('KI-031'))).toBe(true);
  });

  it('returns undefined aspect when the opaque schedule has no usable provenance', () => {
    const rows = summarizeSpiderWideRuns([
      { sourcePath: 'a.json', payload: widePayload({ spiderShot: undefined }) },
      { sourcePath: 'b.json', payload: widePayload({ spiderShot: { resolvedFrom: { aspect: 'wide' } } }) },
    ]);

    expect(rows.map((row) => row.aspect)).toEqual([undefined, undefined]);
  });
});

describe('formatSpiderWideRepositioningSummary', () => {
  it('puts the refusal and the recording spec in front of the reader', () => {
    const report = formatSpiderWideRepositioningSummary(COLLINEAR_COHORT, assessDirectionality(COLLINEAR_COHORT));

    expect(report).toContain('**拒答**');
    expect(report).toContain('docs/operational/spider-wide-recording-spec.md');
  });
});

/**
 * WP-60 T4 —— 一段最小的原始取樣：4 筆樣本，中間夾一個 50 ms 的空洞。
 * 絕對時間為 100 / 101 / 151 / 152 ms，故那個空洞是 `[101, 151]`。
 */
const GAP_BLOCK: MouseSampleBlock = {
  t0Ms: 100,
  dtUs: [0, 1000, 50_000, 1000],
  dx: [1, 2, 3, 4],
  dy: [0, 0, 0, 0],
};

const SAMPLING_META = {
  recorded: GAP_BLOCK.dtUs.length,
  capacity: 360_000,
  overflow: false,
  timeSource: 'event.timeStamp',
  deltaUnit: 'counts',
  observedRateHz: 1005,
} as const;

/**
 * WP-60 T-exit —— 1000 Hz 的連續取樣中間夾一段 5 s 的停頓（受測者手不動或抬起）。
 * 平均事件率被那段停頓拉到 ~40 Hz，但**連續期間**仍是 1000 Hz。D-60.X1 的判別對照組。
 */
const PAUSED_BLOCK: MouseSampleBlock = {
  t0Ms: 100,
  dtUs: [0, ...Array.from({ length: 99 }, () => 1000), 5_000_000, ...Array.from({ length: 100 }, () => 1000)],
  dx: Array.from({ length: 201 }, (_, i) => (i % 3) - 1),
  dy: Array.from({ length: 201 }, () => 0),
};

/**
 * 真正退化的取樣：144 Hz（dt ≈ 6.944 ms），**一個空洞都沒有**。這才是 F1 要抓的形狀
 * —— 瀏覽器退回 rAF 率交付事件。連續期間事件率 = 144 Hz < 500 Hz ⇒ blocker 必須出現。
 */
const RAF_RATE_BLOCK: MouseSampleBlock = {
  t0Ms: 100,
  dtUs: [0, ...Array.from({ length: 200 }, () => 6944)],
  dx: Array.from({ length: 201 }, () => 1),
  dy: Array.from({ length: 201 }, () => 0),
};

/** 七個取樣欄位單獨拉出來比 —— 一個 `toEqual` 就涵蓋「有 block」與「沒 block」兩種輸入。 */
function samplingFields(row: SpiderWideRunSummary) {
  return {
    sampleCount: row.sampleCount,
    observedRateHz: row.observedRateHz,
    activeRateHz: row.activeRateHz,
    sampleOverflow: row.sampleOverflow,
    lockBreakCount: row.lockBreakCount,
    gapCountAtThreshold: row.gapCountAtThreshold,
    longestGapMs: row.longestGapMs,
  };
}

const SAMPLING_BLOCKER_MARKERS = ['事件率不足', '原始取樣溢位', 'crossOriginIsolated', 'Pointer Lock 中斷'] as const;

function samplingBlockers(row: SpiderWideRunSummary): readonly string[] {
  return row.blockers.filter((blocker) => SAMPLING_BLOCKER_MARKERS.some((marker) => blocker.includes(marker)));
}

describe('WP-60 T4 —— 原始取樣健康度（FR-60.8）', () => {
  it('fills all six sampling fields when the block is present and leaves them undefined when it is absent', () => {
    const [withBlock, withoutBlock] = summarizeSpiderWideRuns([
      { sourcePath: 'raw.json', instruction: '照平常打', payload: widePayload({ mouseSamples: GAP_BLOCK }) },
      { sourcePath: 'legacy.json', instruction: '照平常打', payload: widePayload({}) },
    ]);

    expect(REPORTED_GAP_THRESHOLD_MS).toBe(30);
    expect(samplingFields(withBlock)).toEqual({
      sampleCount: 4,
      observedRateHz: 1005,
      // 兩個 segment 各一個 1 ms 間隔 ⇒ 連續期間 1000 Hz。那個 50 ms 空洞不計入（D-60.X1）。
      activeRateHz: 1000,
      sampleOverflow: false,
      lockBreakCount: 0,
      gapCountAtThreshold: 1,
      longestGapMs: 50,
    });
    // 缺席即七欄全 `undefined` —— **不是 0**。「沒錄原始取樣」與「錄了但一個間隙都沒有」是兩件事。
    expect(samplingFields(withoutBlock)).toEqual({
      sampleCount: undefined,
      observedRateHz: undefined,
      activeRateHz: undefined,
      sampleOverflow: undefined,
      lockBreakCount: undefined,
      gapCountAtThreshold: undefined,
      longestGapMs: undefined,
    });
  });

  it('blocks a stream that degraded to rAF rate, and stays silent at 1000 Hz', () => {
    const [slow, fast] = summarizeSpiderWideRuns([
      { sourcePath: 'raf-rate.json', instruction: '照平常打', payload: widePayload({ mouseSamples: RAF_RATE_BLOCK }) },
      { sourcePath: 'fast.json', instruction: '照平常打', payload: widePayload({ mouseSamples: GAP_BLOCK }) },
    ]);

    expect(slow.activeRateHz).toBeCloseTo(144, 0);
    expect(slow.blockers.some((blocker) => blocker.includes('事件率不足'))).toBe(true);
    expect(fast.blockers.some((blocker) => blocker.includes('事件率不足'))).toBe(false);
  });

  it('does not block a 1000 Hz capture just because the participant paused (D-60.X1)', () => {
    // T0 R2 的三組實機摘要平均率為 417／494／412 Hz —— 全部低於 500 Hz 下限，而同一支滑鼠在 R1 的
    // 連續移動期間量到 1005 Hz。以平均率當閘會把三組真人 run 全部誤判為「事件率不足」。
    const [paused] = summarizeSpiderWideRuns([
      {
        sourcePath: 'paused.json',
        instruction: '照平常打',
        payload: widePayload({
          mouseSamples: PAUSED_BLOCK,
          // provenance 欄位照實回報整段平均率（含停頓）—— 它是匯出的事實，不是閘的輸入。
          meta: { mouseSampling: { ...SAMPLING_META, recorded: PAUSED_BLOCK.dtUs.length, observedRateHz: 40 } },
        }),
      },
    ]);

    expect(paused.observedRateHz).toBe(40);
    expect(paused.activeRateHz).toBeCloseTo(1000, 6);
    expect(paused.blockers.some((blocker) => blocker.includes('事件率不足'))).toBe(false);
    // 那段 5 s 停頓仍然是一個被看見的空洞 —— 修掉誤判不等於把它藏起來。
    expect(paused.gapCountAtThreshold).toBe(1);
    expect(paused.longestGapMs).toBe(5000);
  });

  it('blocks an overflowed capture without touching meta.suspect (FR-60.9)', () => {
    const [overflowed, ok] = summarizeSpiderWideRuns([
      {
        sourcePath: 'overflow.json',
        instruction: '照平常打',
        payload: widePayload({
          mouseSamples: GAP_BLOCK,
          meta: { mouseSampling: { ...SAMPLING_META, capacity: 4, overflow: true } },
        }),
      },
      { sourcePath: 'ok.json', instruction: '照平常打', payload: widePayload({ mouseSamples: GAP_BLOCK }) },
    ]);

    expect(overflowed.blockers.some((blocker) => blocker.includes('原始取樣溢位'))).toBe(true);
    expect(ok.blockers.some((blocker) => blocker.includes('原始取樣溢位'))).toBe(false);
    // 溢位是**獨立**旗標：既有的 `suspect` blocker 不得因此出現（D-60.P5）。
    expect(overflowed.blockers.some((blocker) => blocker.includes('suspect'))).toBe(false);
  });

  it('blocks a run recorded without cross-origin isolation (F4)', () => {
    const [dull, sharp] = summarizeSpiderWideRuns([
      {
        sourcePath: 'no-coi.json',
        instruction: '照平常打',
        payload: widePayload({ mouseSamples: GAP_BLOCK, meta: { crossOriginIsolated: false } }),
      },
      { sourcePath: 'coi.json', instruction: '照平常打', payload: widePayload({ mouseSamples: GAP_BLOCK }) },
    ]);

    expect(dull.blockers.some((blocker) => blocker.includes('crossOriginIsolated'))).toBe(true);
    expect(sharp.blockers.some((blocker) => blocker.includes('crossOriginIsolated'))).toBe(false);
  });

  it('blocks a Pointer Lock break and drops the gap it explains from the count (FR-60.6)', () => {
    // 未取鎖區間 `[100.5, 151.5]` 覆蓋那個 50 ms 空洞 ⇒ 它被歸因給中斷，不留在 `gaps`。
    const [broken, intact] = summarizeSpiderWideRuns([
      {
        sourcePath: 'lock-break.json',
        instruction: '照平常打',
        payload: widePayload({
          mouseSamples: GAP_BLOCK,
          extraEvents: [
            { type: 'pointer_lock', locked: false, t: 100.5 },
            { type: 'pointer_lock', locked: true, t: 151.5 },
          ],
        }),
      },
      { sourcePath: 'locked.json', instruction: '照平常打', payload: widePayload({ mouseSamples: GAP_BLOCK }) },
    ]);

    expect(broken.blockers.some((blocker) => blocker.includes('Pointer Lock 中斷'))).toBe(true);
    expect(intact.blockers.some((blocker) => blocker.includes('Pointer Lock 中斷'))).toBe(false);
    expect(broken.lockBreakCount).toBe(1);
    // 被中斷解釋掉的空洞**不再**是候選；`longestGapMs` 隨之回到 0（有錄到、沒有未解釋的間隙）。
    expect(broken.gapCountAtThreshold).toBe(0);
    expect(broken.longestGapMs).toBe(0);
  });

  it('adds no sampling blocker to a legacy export, even one that would trip every one of them', () => {
    // 這份 run 沒有 COI、沒有原始取樣，還帶著 Pointer Lock 中斷事件 —— 四個 blocker 一個都不該出現：
    // 缺 `mouseSamples` 是**合法**狀態，不是資料有問題（T4 invariant）。
    const [row] = summarizeSpiderWideRuns([
      {
        sourcePath: 'legacy.json',
        instruction: '照平常打',
        payload: widePayload({
          meta: { crossOriginIsolated: false },
          extraEvents: [{ type: 'pointer_lock', locked: false, t: 100 }],
        }),
      },
    ]);

    expect(samplingBlockers(row)).toEqual([]);
  });

  it('prints the sampling table only when some run carries a block, and says so when none does', () => {
    const rows = summarizeSpiderWideRuns([
      { sourcePath: 'raw.json', instruction: '照平常打', payload: widePayload({ mouseSamples: GAP_BLOCK }) },
    ]);
    const withBlock = formatSpiderWideRepositioningSummary(rows, assessDirectionality(rows));
    const withoutBlock = formatSpiderWideRepositioningSummary(COLLINEAR_COHORT, assessDirectionality(COLLINEAR_COHORT));

    expect(withBlock).toContain('### 原始取樣健康度（WP-60）');
    expect(withBlock).toContain('| raw.json | 4 | 1005 | 1000 | 否 | 0 | 1 | 50.0 |');
    expect(withoutBlock).toContain('本批**沒有任何** run 帶 `mouseSamples` 區塊');
    // 三段結構不變 —— 取樣健康度是「逐 run」段裡的第二張表，不是第四段。
    expect(withBlock.match(/^## /gm)).toHaveLength(3);
  });
});

describe('WP-61 T2 —— 標註完整性的可見度（step 8）', () => {
  it('reports annotation intervals, pair violations and trials for a healthy and a deficient run', () => {
    const healthy: readonly DrillEvent[] = [
      { type: 'annotation', kind: 'sensor_lift', code: 'KeyL', down: true, t: 310 },
      { type: 'annotation', kind: 'sensor_lift', code: 'KeyL', down: false, t: 480 },
    ];
    // 殘缺：一個沒有 up 的 down ⇒ 零個成對區間 + 一次違規。
    const deficient: readonly DrillEvent[] = [{ type: 'annotation', kind: 'sensor_lift', code: 'KeyL', down: true, t: 310 }];

    const [ok, broken] = summarizeSpiderWideRuns([
      { sourcePath: 'ok.json', instruction: '照平常打', payload: widePayload({ mouseSamples: GAP_BLOCK, extraEvents: healthy }) },
      {
        sourcePath: 'broken.json',
        instruction: '照平常打',
        payload: widePayload({ mouseSamples: GAP_BLOCK, extraEvents: deficient }),
      },
    ]);

    expect([ok.annotationIntervalCount, ok.annotationPairViolations, ok.annotationExpectedTrials]).toEqual([1, 0, 1]);
    expect([broken.annotationIntervalCount, broken.annotationPairViolations, broken.annotationExpectedTrials]).toEqual([0, 1, 1]);
    // ⚠️ 標註品質**不是**本 runner 的 blocker —— 它不影響 `cm/360` 方向性。作廢判定在 analyze:lift-cohort。
    expect(broken.blockers.some((blocker) => blocker.includes('標註'))).toBe(false);
  });

  it('reports zero — not a dash — for a run recorded without the annotation channel', () => {
    // 取樣七欄缺席時是 `—`（沒錄原始取樣）；標註三欄則是確定的 0（沒有標註就是沒有標註）。
    const [row] = summarizeSpiderWideRuns([
      { sourcePath: 'no-annotation.json', instruction: '照平常打', payload: widePayload({ mouseSamples: GAP_BLOCK }) },
    ]);
    const report = formatSpiderWideRepositioningSummary([row], assessDirectionality([row]));

    expect(row.annotationIntervalCount).toBe(0);
    expect(report).toContain('| no-annotation.json | 4 | 1005 | 1000 | 否 | 0 | 1 | 50.0 | 0 | 0 | 1 |');
    expect(report).toContain('analyze:lift-cohort');
    // 三段結構仍然不變 —— 新欄位長在既有子表裡，不是第四段。
    expect(report.match(/^## /gm)).toHaveLength(3);
  });
});

function summary(overrides: Partial<SpiderWideRunSummary>): SpiderWideRunSummary {
  return {
    sourcePath: 'run.json',
    instruction: '照平常打',
    sensitivity: 1,
    dpi: 800,
    fovDeg: 75,
    aspect: 2.0031,
    countsPer360: 16363.6,
    cmPer360: 52,
    peripheralCount: 30,
    detectedAtDefault: 0,
    detectedAtWorkaround: 30,
    timeoutRate: 0,
    evaluableCount: 30,
    suspectedCount: 0,
    suspectedRate: 0,
    // 預設為「這份 run 沒錄原始取樣」—— 方向性測試的 cohort 全部沿用這個形狀，與 WP-60 之前逐位相同。
    sampleCount: undefined,
    observedRateHz: undefined,
    activeRateHz: undefined,
    sampleOverflow: undefined,
    lockBreakCount: undefined,
    gapCountAtThreshold: undefined,
    longestGapMs: undefined,
    // WP-61 T2：標註三欄**永遠有值** —— 沒開標註通道就是 0，而不是 `undefined`。與上面的取樣七欄
    // 相反：那七欄的缺席代表「沒錄原始取樣」，而「沒有標註」本身就是一個確定的讀數。
    annotationIntervalCount: 0,
    annotationPairViolations: 0,
    annotationExpectedTrials: 30,
    blockers: [],
    ...overrides,
  };
}

/**
 * 最小的 wide-flick 形狀 payload：一顆周邊目標 + 靜止 aim。數值精度不是本檔的標的。
 *
 * `mouseSamples` 省略時**整個頂層欄位不存在**（不是空 block）—— 那正是 pre-WP-60 匯出的形狀，
 * 也是既有 12 個案例走的路徑。給了 block 就自動補上成對的 `meta.mouseSampling`（parser 要求成對，
 * D-60.T1-2），呼叫端可用 `meta.mouseSampling` 覆寫它。
 */
function widePayload(args: {
  readonly meta?: Record<string, unknown>;
  readonly peripheral?: boolean;
  readonly spiderShot?: unknown;
  readonly mouseSamples?: MouseSampleBlock;
  readonly extraEvents?: readonly DrillEvent[];
}): ExportPayload {
  const ticks: TickRecord[] = [];
  for (let i = 0; i < 60; i++) {
    ticks.push(makeTick({ t: i * 10, dYaw: 0, dPitch: 0, tx: 6.2, ty: 1.5, tz: -5 }));
  }
  const events: DrillEvent[] =
    args.peripheral === false
      ? [{ type: 'visible', targetId: 'c1', side: 'R', zone: 'center', t: 100, targetX: 0, targetY: 1.5, targetZ: -8 }]
      : [{ type: 'visible', targetId: 'p1', side: 'R', zone: 'peripheral', t: 300, targetX: 6.2, targetY: 1.5, targetZ: -5 }];

  const payload = makePayload({
    meta: {
      drillId: SPIDER_WIDE_DRILL_ID,
      sensitivity: 1,
      dpi: 800,
      fovDeg: 75,
      displayHz: 60,
      spawn: {
        seed: 57001,
        spiderShot:
          'spiderShot' in args
            ? args.spiderShot
            : { resolvedFrom: { fovDegVertical: 75, aspect: 2.0031, screenMargin: 0.04, kLo: 0.92, targetAngularDiameterDeg: 2 } },
      },
      ...(args.mouseSamples !== undefined ? { mouseSampling: SAMPLING_META } : {}),
      ...args.meta,
    } as never,
    ticks,
    events: [...events, ...(args.extraEvents ?? [])],
  });

  return args.mouseSamples === undefined ? payload : { ...payload, mouseSamples: args.mouseSamples };
}
