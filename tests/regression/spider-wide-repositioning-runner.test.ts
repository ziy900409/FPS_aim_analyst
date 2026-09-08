import { describe, expect, it } from 'vitest';
import type { DrillEvent } from '../../src/data/DataRecorder.ts';
import type { TickRecord } from '../../src/data/RingBuffer.ts';
import { makePayload, makeTick } from '../replay/fixtures.ts';
import {
  assessDirectionality,
  formatSpiderWideRepositioningSummary,
  MIN_SENSITIVITY_LEVELS,
  SPIDER_WIDE_DRILL_ID,
  summarizeSpiderWideRuns,
  type SpiderWideRunSummary,
} from '../../scripts/spiderWideRepositioningRunner.ts';

/**
 * WP-57 —— `analyze:spider-wide` 的純函式契約。
 *
 * 本檔**不**重測 `deriveMouseThrow()`／`deriveRepositioningSuspicion()`／`deriveDetectionMetrics()`
 * （各有自己的測試，C-D4 單一定義）。這裡測的是 runner 自己的三件事：
 * ① 資料品質 blocker 有沒有點名，② opaque `resolvedFrom.aspect` 讀不讀得到，
 * ③ **cohort 共線時方向性有沒有拒答** —— ③ 是本 runner 存在的理由（§T5-real 的教訓）。
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
    blockers: [],
    ...overrides,
  };
}

/** 最小的 wide-flick 形狀 payload：一顆周邊目標 + 靜止 aim。數值精度不是本檔的標的。 */
function widePayload(args: {
  readonly meta?: Record<string, unknown>;
  readonly peripheral?: boolean;
  readonly spiderShot?: unknown;
}) {
  const ticks: TickRecord[] = [];
  for (let i = 0; i < 60; i++) {
    ticks.push(makeTick({ t: i * 10, dYaw: 0, dPitch: 0, tx: 6.2, ty: 1.5, tz: -5 }));
  }
  const events: DrillEvent[] =
    args.peripheral === false
      ? [{ type: 'visible', targetId: 'c1', side: 'R', zone: 'center', t: 100, targetX: 0, targetY: 1.5, targetZ: -8 }]
      : [{ type: 'visible', targetId: 'p1', side: 'R', zone: 'peripheral', t: 300, targetX: 6.2, targetY: 1.5, targetZ: -5 }];

  return makePayload({
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
      ...args.meta,
    } as never,
    ticks,
    events,
  });
}
