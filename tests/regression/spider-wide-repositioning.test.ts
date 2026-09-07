import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { deriveSpiderShotMetrics } from '../../src/metrics/spiderShotMetrics.ts';
import { deriveRepositioningSuspicion } from '../../src/metrics/spiderShotRepositioning.ts';
import {
  buildWideFlickPayload,
  PERIPHERAL_ID,
  REPOSITIONING_OPTIONS,
} from './spiderWideRepositioningFixture.ts';

/**
 * WP-57 / T5（README §2.8）—— 抬滑鼠疑慮標註的分類、窗界對齊與 C-D3 邊界。
 *
 * 合成訊號全部出自 `spiderWideRepositioningFixture` 的單一產生器：四類只差在停滯的長度與位置。
 * 門檻敏感度與 `cm/360` 方向性另見 `spider-wide-repositioning-sensitivity.test.ts`。
 */

describe('WP-57 T5 — 四類合成訊號的分類', () => {
  it('flags a genuine mid-flick stall: long near-zero omega, then re-acceleration', () => {
    const payload = buildWideFlickPayload({ stall: { afterMovedMs: 100, durationMs: 250 } });
    const suspicions = deriveRepositioningSuspicion(payload, REPOSITIONING_OPTIONS);

    // 停滯注入於 onset(800ms) 後 100 ms、長 250 ms ⇒ 區段 [900, 1150]，tick 邊界上為精確值。
    expect(suspicions).toEqual([
      { targetId: PERIPHERAL_ID, suspected: true, stallStartMs: 900, stallDurationMs: 250 },
    ]);
  });

  it('does not flag a deliberate pause shorter than stallMinMs', () => {
    // 與上一組唯一的差別是 `durationMs`：60 ms < stallMinMs (150)。
    const payload = buildWideFlickPayload({ stall: { afterMovedMs: 100, durationMs: 60 } });
    expect(deriveRepositioningSuspicion(payload, REPOSITIONING_OPTIONS)).toEqual([
      { targetId: PERIPHERAL_ID, suspected: false },
    ]);
  });

  it('does not flag a single-shot flick that never stalls', () => {
    expect(deriveRepositioningSuspicion(buildWideFlickPayload({}), REPOSITIONING_OPTIONS)).toEqual([
      { targetId: PERIPHERAL_ID, suspected: false },
    ]);
  });

  it('does not flag stalls outside the window — before onset, or after first on-target', () => {
    // 窗左界外：`visible` 之後、movement onset 之前靜止 900 ms（遠長於 stallMinMs）。
    expect(
      deriveRepositioningSuspicion(buildWideFlickPayload({ reactionMs: 900 }), REPOSITIONING_OPTIONS),
    ).toEqual([{ targetId: PERIPHERAL_ID, suspected: false }]);

    // 窗右界外：抵達後停在目標上 900 ms。
    expect(
      deriveRepositioningSuspicion(buildWideFlickPayload({ dwellMs: 900 }), REPOSITIONING_OPTIONS),
    ).toEqual([{ targetId: PERIPHERAL_ID, suspected: false }]);
  });
});

describe('WP-57 T5 — 窗界沿用既有 canonical derivations（C-D4）', () => {
  it('keeps the flagged stall inside the interval movementTimeMs is measured over', () => {
    const payload = buildWideFlickPayload({ stall: { afterMovedMs: 100, durationMs: 250 } });
    const [suspicion] = deriveRepositioningSuspicion(payload, REPOSITIONING_OPTIONS);
    const [execution] = deriveSpiderShotMetrics(payload, REPOSITIONING_OPTIONS).movementExecution;

    // 兩者的窗界必須是同一對 anchors；這是「本旗標保護的正是這個指標」的可執行形式。
    expect(execution.movementTimeMs).toBe(540); // firstOnTarget(1350) − tDetect(810)
    expect(suspicion.stallDurationMs!).toBeLessThanOrEqual(execution.movementTimeMs!);
  });

  it('still evaluates an acquisition failure, extending the window to the presentation end', () => {
    // 抓不到目標又長時間近零正是抬滑鼠最強的訊號；當作「無窗」丟掉會剛好漏掉最該標的個案。
    const payload = buildWideFlickPayload({
      arrive: false,
      stall: { afterMovedMs: 100, durationMs: 400 },
    });
    const [suspicion] = deriveRepositioningSuspicion(payload, REPOSITIONING_OPTIONS);

    expect(deriveSpiderShotMetrics(payload, REPOSITIONING_OPTIONS).movementExecution[0].movementTimeMs)
      .toBeUndefined();
    expect(suspicion.suspected).toBe(true);
    expect(suspicion.stallDurationMs).toBe(400);
  });

  it('emits no row when movement onset is undefined — a missing row is not "clean"', () => {
    // 玩家整段沒往目標動 ⇒ detection timeout ⇒ 窗不存在。回 `suspected: false` 會把「沒量到」
    // 偽裝成「量過且乾淨」。
    expect(
      deriveRepositioningSuspicion(buildWideFlickPayload({ neverMoves: true }), REPOSITIONING_OPTIONS),
    ).toEqual([]);
  });

  it('rejects non-positive thresholds instead of silently returning false', () => {
    const payload = buildWideFlickPayload({});
    expect(() => deriveRepositioningSuspicion(payload, { ...REPOSITIONING_OPTIONS, stallMinMs: 0 })).toThrow(
      /stallMinMs/,
    );
    expect(() =>
      deriveRepositioningSuspicion(payload, { ...REPOSITIONING_OPTIONS, stallOmegaDegPerSec: Number.NaN }),
    ).toThrow(/stallOmegaDegPerSec/);
  });
});

/**
 * C-D3 / GD-20 過閘：未通過構念驗證的量不得進教練報告。本旗標是**資料品質標註**，且與刻意停頓
 * 在觀測上不可分離 ⇒ 它永遠不該出現在診斷規則、報告呈現或指標 registry 的 import 圖裡。
 *
 * 用靜態掃描而非行為測試：邊界要在「有人寫下那行 import」的當下就紅，而不是等到某條路徑剛好被
 * 執行到。`readFileSync` 對不存在的路徑會擲錯，故模組改名或搬家不會讓這個閘靜默通過。
 */
const COACH_REPORT_PATH_MODULES = [
  '../../src/metrics/diagnosisRules.ts',
  '../../src/results/ResultPresentation.ts',
  '../../src/ui/ResultDetailBody.ts',
  '../../src/metrics/sessionHistory.ts',
  '../../src/history/DrillMetricRegistry.ts',
] as const;

describe('WP-57 T5 — C-D3 邊界：不進教練報告／診斷規則／registry', () => {
  for (const relativePath of COACH_REPORT_PATH_MODULES) {
    it(`${relativePath} does not reference the repositioning flag`, () => {
      const source = readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
      expect(source).not.toMatch(/spiderShotRepositioning/);
      expect(source).not.toMatch(/RepositioningSuspicion/);
    });
  }

  it('is imported by no production module at all — only tests and offline analysis', () => {
    expect(productionImportersOf('spiderShotRepositioning')).toEqual([]);
  });

  it('keeps Suspicion semantics in its exported names — nothing that reads like a metric', () => {
    // 掃 **匯出符號**而非原始文字：模組的說明段落本來就必須指名 `repositioningCount` 這類禁用命名
    // 來解釋為什麼禁，對原始碼做文字比對會把那段說明本身判成違規。
    const source = readFileSync(
      fileURLToPath(new URL('../../src/metrics/spiderShotRepositioning.ts', import.meta.url)),
      'utf-8',
    );
    const exported = [...source.matchAll(/export (?:const|function|interface|type) (\w+)/g)].map((m) => m[1]);

    expect(exported).toContain('RepositioningSuspicion');
    expect(exported).toContain('deriveRepositioningSuspicion');
    for (const name of exported) {
      if (/repositioning/i.test(name)) expect(name).toMatch(/Suspicion/);
      expect(name).not.toMatch(/(Count|Rate|Score|Index)$/);
    }
  });
});

/** `src/` 內非測試檔中 import 指定模組者（相對 repo root，`/` 分隔）。 */
function productionImportersOf(moduleName: string): string[] {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const pattern = new RegExp(`from ['"][^'"]*${moduleName}\\.ts['"]`);
  const hits: string[] = [];
  for (const file of walkTypeScript(`${root}src`)) {
    if (file.endsWith('.test.ts') || file.endsWith(`${moduleName}.ts`)) continue;
    if (pattern.test(readFileSync(file, 'utf-8'))) hits.push(file.slice(root.length).replace(/\\/g, '/'));
  }
  return hits.sort();
}

function walkTypeScript(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walkTypeScript(full));
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}
