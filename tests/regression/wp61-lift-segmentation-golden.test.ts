import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildLiftSegmentationGolden,
  LIFT_SEGMENTATION_GOLDEN_VERSION,
  verifyLiftSegmentationGolden,
  type LiftSegmentationGolden,
} from '../../scripts/liftSegmentationGolden.ts';
import { parseExportPayload } from '../../src/data/exportPayloadSchema.ts';

/**
 * WP-61 T2 —— Stage 1 切段 golden 的**逐位重現**斷言（T2 DoD）。
 *
 * **它防的是靜默過期**：`research/` 的 Python 側只讀 golden，不重算切段（D-61.P4）。若 `segmentByTimeGap()`
 * 的語意日後變動，golden 只是一份 JSON —— 它不會自己變紅，而 T3 會拿著一份與現行原語不一致的切段
 * 去跑消融，結果無從歸因。有了本檔，變動當下就有一個具名的紅燈。
 *
 * 掃描整個 `research/fixtures/golden/lift-segments-*.json`，**不寫死檔名** —— 日後真人 cohort 的
 * golden 一 commit 進來就自動納入，不需要有人記得回來改測試。
 */

const GOLDEN_DIR = join(process.cwd(), 'research', 'fixtures', 'golden');
const EXPORT_DIR = join(process.cwd(), 'research', 'fixtures', 'exports');

function goldenFiles(): readonly string[] {
  return readdirSync(GOLDEN_DIR)
    .filter((name) => name.startsWith('lift-segments-') && name.endsWith('.json'))
    .sort();
}

function readGolden(name: string): LiftSegmentationGolden {
  return JSON.parse(readFileSync(join(GOLDEN_DIR, name), 'utf8')) as LiftSegmentationGolden;
}

describe('WP-61 T2 —— Stage 1 切段 golden', () => {
  it('has at least one committed golden to verify against', () => {
    // 零個 golden 時本檔會「全部通過」而什麼都沒驗 —— 那是最糟的綠燈。
    expect(goldenFiles().length).toBeGreaterThan(0);
  });

  it.each(goldenFiles())('%s reproduces bit-for-bit under the current segmentByTimeGap()', (name) => {
    const golden = readGolden(name);

    expect(golden.version).toBe(LIFT_SEGMENTATION_GOLDEN_VERSION);
    expect(verifyLiftSegmentationGolden(golden)).toEqual([]);
  });

  it.each(goldenFiles())('%s carries no participant-identifying field', (name) => {
    // 真人 run 的 golden 一律匿名化（D-57.T5-8 / research/README.md）。合成 fixture 也照同一條規則
    // 走 —— 規則要在真資料到達**之前**就有偵測力。
    const raw = readFileSync(join(GOLDEN_DIR, name), 'utf8');

    expect(raw).not.toContain('participantId');
    expect(raw).not.toContain('"dx"');
    expect(raw).not.toContain('"dy"');
  });

  it('rebuilds the synthetic golden from its committed export, byte for byte', () => {
    // 產生腳本與 committed 產物之間的對表：`generate_synthetic_lift_fixture.py` → export →
    // `buildLiftSegmentationGolden()` → 這份 JSON。任何一環改了而沒有重跑，這裡就紅。
    const parsed = parseExportPayload(JSON.parse(readFileSync(join(EXPORT_DIR, 'synthetic_sensor_lift.json'), 'utf8')));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const rebuilt = buildLiftSegmentationGolden({
      runId: 'synthetic-lift',
      sessionId: 'synthetic-s1',
      instructionClass: 'lift',
      payload: parsed.payload,
    });

    expect(rebuilt).toEqual(readGolden('lift-segments-synthetic-lift.json'));
  });

  it('detects a golden whose recorded segmentation no longer matches its own input', () => {
    // 突變驗證：把一個 gap 的長度改掉，重現斷言必須立刻指名 θ 與欄位。一份「寫得出來但重現不了」的
    // golden 比沒有 golden 更糟 —— 它看起來像證據。
    const golden = readGolden('lift-segments-synthetic-lift.json');
    const tampered: LiftSegmentationGolden = {
      ...golden,
      segmentationsByTheta: golden.segmentationsByTheta.map((entry, index) =>
        index !== 0 ? entry : { ...entry, gaps: entry.gaps.map((gap, i) => (i !== 0 ? gap : { ...gap, durationMs: gap.durationMs + 1 })) },
      ),
    };

    expect(verifyLiftSegmentationGolden(tampered)).toEqual(['theta=18.gaps: 8 recorded vs 8 recomputed']);
  });
});
