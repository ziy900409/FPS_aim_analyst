import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseExportPayload } from '../../src/data/exportPayloadSchema.ts';

/**
 * WP-66 / T5 —— 命中回饋是 **render-only**：環形格內容不得進入資料層或指標層（FR-66.12 / FM-5）。
 *
 * T1／T2／T3 各自以一次性 `grep` 確認過當下乾淨，但一次性指令守不住未來：後續 WP 只要在
 * `src/metrics/` 裡 `import { TargetHitRing }`，就能把「這一發判定命中」悄悄變成一個指標的輸入，
 * 而那正是 C-D3（未過構念驗證不得進教練報告）與 C-D4（既有構念不得有第二定義）的紅線——
 * 亮起只代表「這一發判定命中」，在 projectile 條件下與「準心現在在目標上」時間點完全不同
 * （README §3.1(4)）。本檔把那次 grep 變成常駐閘。
 *
 * 掃描對象為**版本庫內的原始檔**：`.venv`／`out`／`__pycache__` 皆為 gitignore 產物，不屬 repo
 * 表面積，故略過（`research/.gitignore` 即此二者）。每個 root 另斷言掃到的檔數下限，避免
 * 「因為根本沒掃到檔案而通過」的 vacuous 綠燈。
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** 命中回饋在 sim/render 側的全部具名符號（`src/state/SharedState.ts` + `src/render/TargetView.ts`）。 */
const FEEDBACK_SYMBOLS = [
  'targetHits',
  'TargetHitRing',
  'pushTargetHit',
  'createTargetHitRing',
  'resetTargetHitRing',
  'TARGET_HIT_CAP',
  'HIT_FEEDBACK_HOLD_MS',
] as const;

/** gitignore 產物與快取：不屬版本庫表面積。 */
const SKIP_DIRS = new Set(['.venv', 'out', '__pycache__', '.pytest_cache', 'node_modules']);

/** 掃描 root ⇒ 期望掃到的檔數下限（非 vacuous 保護；現況見各列註解）。 */
const SCAN_ROOTS: ReadonlyArray<{ root: string; minFiles: number }> = [
  { root: 'src/data', minFiles: 10 }, // 現況 13
  { root: 'src/metrics', minFiles: 50 }, // 現況 67
  { root: 'research', minFiles: 100 }, // 現況 320 tracked（src 114 py + fixtures 45 + …）
];

function walk(dir: string, out: string[]): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(join(dir, entry.name), out);
    } else if (entry.isFile()) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

describe('WP-66 / FR-66.12 — 命中回饋不得洩漏進資料層、指標層或 research/', () => {
  for (const { root, minFiles } of SCAN_ROOTS) {
    it(`${root}/ 對命中回饋的全部具名符號零出現`, () => {
      const files = walk(join(REPO_ROOT, root), []);
      expect(files.length).toBeGreaterThanOrEqual(minFiles); // 掃到東西才算數

      const hits: string[] = [];
      for (const file of files) {
        const source = readFileSync(file, 'utf8');
        for (const symbol of FEEDBACK_SYMBOLS) {
          if (source.includes(symbol)) hits.push(`${relative(REPO_ROOT, file).replaceAll('\\', '/')} :: ${symbol}`);
        }
      }
      expect(hits).toEqual([]);
    });
  }

  it('掃描確實會咬：對一個已知存在的符號跑同一條掃描必須命中 src/state/', () => {
    // 反證：上面三條「零出現」若因掃描壞掉（路徑錯／讀不到檔）而恆綠，本條會同時轉紅。
    const files = walk(join(REPO_ROOT, 'src/state'), []);
    const hits = files.filter((file) => readFileSync(file, 'utf8').includes('pushTargetHit'));
    expect(hits.length).toBeGreaterThan(0);
  });

  it('匯出事件 union 不含任何命中回饋事件型別（parser 層拒收）', () => {
    // 命中回饋沒有、也不得有自己的事件型別：`fire.hit` / `hit` 才是命中的權威表述（GD-7 單一來源）。
    for (const type of ['target_hit', 'hit_feedback', 'targetHits', 'flash']) {
      const result = parseExportPayload(payloadWithEventType(type));
      expect(result.ok, `event type '${type}' 不得被 parser 接受`).toBe(false);
    }
    // 同一形狀但用既有的 `hit` 型別必須通過 ⇒ 上面的 false 是被 discriminant 擋下，不是 payload 本身壞掉。
    const control = parseExportPayload(payloadWithEventType('hit'));
    expect(control.ok).toBe(true);
  });
});

/** 最小可通過 payload，事件僅一筆、型別由參數決定（其餘欄位為 `hit` 事件的必填集合）。 */
function payloadWithEventType(type: string): unknown {
  return {
    meta: {
      schemaVersion: 2,
      drillId: 'wp66_isolation_probe',
      weaponId: 'ak47',
      weaponSeed: 1,
      rngSeed: 1,
      backend: 'webgpu',
      displayHz: 144,
      simHz: 128,
      browser: 'test-browser',
      sensitivity: 1,
      sensitivityModel: 'cs2-0.022deg',
      movementModel: 'cs2-source',
      crossOriginIsolated: true,
      startedAt: '2026-09-12T00:00:00.000Z',
      unit: 'source',
      vStrafe: 250,
      maxDrillSeconds: 60,
      lateEventCount: 0,
      bufferOverflow: false,
      recorderOverflow: false,
      suspect: false,
    },
    ticks: [],
    events: [{ type, t: 1, targetId: 't0', timeOfFlightMs: 0, shotSeq: 0 }],
  };
}
