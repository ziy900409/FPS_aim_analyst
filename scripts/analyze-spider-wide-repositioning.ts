/**
 * WP-57 —— `spider-shot-wide-v1` 真人 run 的操作者入口（OQ-57.5 ③ `cm/360` 方向性）。
 *
 * Usage:
 *   npm run analyze:spider-wide -- <export.json | export-dir> [more...]
 *                                  [--manifest <labels.json>] [--out <dir>]
 *
 * `--manifest` 是一份 `{ "<檔名>": "<指示>" }` 的 JSON —— 指示即 ground truth，方向性檢查靠它
 * 分組。沒有 manifest 也能跑（逐 run 表照印），但方向性一律拒答。
 *
 * 報告寫到 `--out`，預設 `.spider-wide-analysis/` —— **gitignored**，因為它是由參與者匯出推導出來的
 * 產物（同 `.pilot-analysis/`／`.contact-analysis/` 的紀律）。四份 2026-09-08 的真人匯出本身也
 * 依使用者決定**不進 repo**（D-57.T5-8），錄製規格見
 * `docs/operational/spider-wide-recording-spec.md`。
 *
 * 所有 I/O 都在本檔；輸出契約在 `spiderWideRepositioningRunner.ts`，故它可以在沒有檔案系統的情況下
 * 被測試（比照 `analyze-tracking-contact.ts` / `trackingContactRunner.ts` 的分工）。
 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { parseExportPayload } from '../src/data/exportPayloadSchema.ts';
import {
  assessDirectionality,
  formatSpiderWideRepositioningSummary,
  summarizeSpiderWideRuns,
  type SpiderWideRunInput,
} from './spiderWideRepositioningRunner.ts';

const DEFAULT_OUT_DIR = '.spider-wide-analysis';

function collectFiles(inputs: readonly string[]): string[] {
  const files: string[] = [];
  for (const input of inputs) {
    const path = resolve(input);
    if (statSync(path).isDirectory()) {
      for (const entry of readdirSync(path).sort()) {
        if (extname(entry) === '.json') files.push(join(path, entry));
      }
    } else {
      files.push(path);
    }
  }
  return files;
}

/** `{ "<檔名或路徑尾碼>": "<指示>" }`。比對用 basename，讓 manifest 不綁絕對路徑。 */
function loadManifest(path: string): Map<string, string> {
  const raw: unknown = JSON.parse(readFileSync(resolve(path), 'utf8'));
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`manifest must be a JSON object of { "<filename>": "<instruction>" }: ${path}`);
  }
  const labels = new Map<string, string>();
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`manifest entry '${key}' must be a non-empty string instruction`);
    }
    labels.set(basename(key), value);
  }
  return labels;
}

interface Rejection {
  readonly sourcePath: string;
  readonly reason: string;
}

/** Schema 拒收與讀不到的檔案一律**點名跳過**，不靜默丟掉、也不讓它中斷整批。 */
function load(
  files: readonly string[],
  labels: ReadonlyMap<string, string>,
): { inputs: SpiderWideRunInput[]; rejected: Rejection[] } {
  const inputs: SpiderWideRunInput[] = [];
  const rejected: Rejection[] = [];

  for (const file of files) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      rejected.push({ sourcePath: file, reason: `unreadable: ${(error as Error).message}` });
      continue;
    }

    const parsed = parseExportPayload(raw);
    if (!parsed.ok) {
      const errors = parsed.errors.map((entry) => `${entry.path}: ${entry.message}`).join('; ');
      rejected.push({ sourcePath: file, reason: `schema errors: ${errors}` });
      continue;
    }

    const instruction = labels.get(basename(file));
    inputs.push({
      sourcePath: basename(file),
      payload: parsed.payload,
      ...(instruction !== undefined ? { instruction } : {}),
    });
  }

  return { inputs, rejected };
}

function main(): void {
  const argv = process.argv.slice(2).filter((arg) => arg !== '--');

  const outIndex = argv.indexOf('--out');
  const outDir = resolve(outIndex >= 0 ? (argv[outIndex + 1] ?? DEFAULT_OUT_DIR) : DEFAULT_OUT_DIR);
  const manifestIndex = argv.indexOf('--manifest');
  const manifestPath = manifestIndex >= 0 ? argv[manifestIndex + 1] : undefined;

  const consumed = new Set<number>();
  for (const index of [outIndex, manifestIndex]) {
    if (index >= 0) {
      consumed.add(index);
      consumed.add(index + 1);
    }
  }
  const positional = argv.filter((arg, index) => !consumed.has(index) && !arg.startsWith('--'));

  if (positional.length === 0) {
    console.error(
      'usage: npm run analyze:spider-wide -- <export.json | export-dir> [more...] [--manifest <labels.json>] [--out <dir>]',
    );
    process.exit(2);
  }

  const files = collectFiles(positional);
  if (files.length === 0) {
    console.error(`no .json exports found under: ${positional.join(', ')}`);
    process.exit(2);
  }

  const labels = manifestPath === undefined ? new Map<string, string>() : loadManifest(manifestPath);
  const { inputs, rejected } = load(files, labels);
  if (inputs.length === 0) {
    console.error(`no export parsed as a valid payload (${rejected.length} rejected):`);
    for (const rejection of rejected) console.error(`  ${basename(rejection.sourcePath)} — ${rejection.reason}`);
    process.exit(1);
  }

  const summaries = summarizeSpiderWideRuns(inputs);
  const directionality = assessDirectionality(summaries);
  const report = formatSpiderWideRepositioningSummary(summaries, directionality);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'spider-wide-repositioning.md'), `${report}\n`, 'utf8');
  writeFileSync(
    join(outDir, 'spider-wide-repositioning.json'),
    `${JSON.stringify({ summaries, directionality, rejected }, null, 2)}\n`,
    'utf8',
  );

  console.log(report);
  if (rejected.length > 0) {
    console.error(`\n${rejected.length} file(s) rejected:`);
    for (const rejection of rejected) console.error(`  ${basename(rejection.sourcePath)} — ${rejection.reason}`);
  }
  console.log(`\nwrote 2 files to ${outDir}`);

  // 被拒收的輸入是操作者端的問題，值得非零 exit;有 blocker 的 run 與「方向性拒答」都是**正當的
  // 具名結果**，不是錯誤 —— 拒答就退非零會誘使人為了讓 CI 綠而去湊一個能答的 cohort。
  if (rejected.length > 0) process.exit(1);
}

main();
