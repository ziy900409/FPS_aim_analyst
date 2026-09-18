/**
 * `spider-shot-wide-v1` 機制層抽取的操作者入口 —— 產生研究側要左接的 per-trial CSV。
 *
 * Usage:
 *   npm run analyze:spider-wide-mech -- <export.json | export-dir> [more...] [--out <dir>]
 *
 * 遞迴掃描目錄下所有 `.json`，跳過不是 `spider-shot-wide-v1` 的匯出（不是錯誤，只是不在母體內），
 * 把每一次周邊呈現寫成一列。`run_id` 是該檔相對於掃描根目錄的路徑（POSIX 斜線），因此在 cohort
 * 目錄樹下天然唯一且可讀；研究側以 `run_id` + `target_id` 左接 `trial_metrics.csv`。
 *
 * 輸出預設落在 `.spider-wide-analysis/`（**gitignored**）—— 它是由參與者匯出推導的產物，與
 * `analyze-spider-wide-repositioning.ts` 同一紀律。參與者匯出本身也不進 repo。
 *
 * 所有 I/O 都在本檔；輸出契約在 `spiderWideMechanismRunner.ts`，故它可以在沒有檔案系統的情況下
 * 被測試（比照 `analyze-spider-wide-repositioning.ts` / `spiderWideRepositioningRunner.ts` 的分工）。
 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { parseExportPayload } from '../src/data/exportPayloadSchema.ts';
import {
  deriveSpiderWideMechanism,
  formatMechanismCsv,
  SPIDER_WIDE_DRILL_ID,
  type MechanismRunInput,
} from './spiderWideMechanismRunner.ts';

const DEFAULT_OUT_DIR = '.spider-wide-analysis';
const CSV_NAME = 'mechanism_metrics.csv';

interface Discovered {
  readonly path: string;
  /** Path relative to the scan root, POSIX separators — becomes `run_id`. */
  readonly runId: string;
}

function discover(input: string): Discovered[] {
  const root = resolve(input);
  if (!statSync(root).isDirectory()) {
    return [{ path: root, runId: root.split(sep).pop() ?? root }];
  }
  const found: Discovered[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir).sort()) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (entry.endsWith('.json')) {
        found.push({ path, runId: relative(root, path).split(sep).join('/') });
      }
    }
  };
  walk(root);
  return found;
}

function parseArgs(argv: readonly string[]): { inputs: string[]; out: string } {
  const inputs: string[] = [];
  let out = DEFAULT_OUT_DIR;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') {
      const value = argv[i + 1];
      if (value === undefined) throw new Error('--out requires a directory');
      out = value;
      i++;
    } else inputs.push(argv[i]);
  }
  if (inputs.length === 0) throw new Error('usage: analyze-spider-wide-mechanism <export.json | dir>...');
  return { inputs, out };
}

function main(argv: readonly string[]): number {
  const { inputs, out } = parseArgs(argv);
  const runs: MechanismRunInput[] = [];
  let scanned = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const input of inputs) {
    for (const { path, runId } of discover(input)) {
      scanned++;
      let parsed;
      try {
        parsed = parseExportPayload(JSON.parse(readFileSync(path, 'utf8')));
      } catch (error) {
        failures.push(`${runId}: ${(error as Error).message}`);
        continue;
      }
      if (!parsed.ok) {
        failures.push(`${runId}: schema errors: ${parsed.errors.map((e) => `${e.path}: ${e.message}`).join('; ')}`);
        continue;
      }
      const payload = parsed.payload;
      // Not an error — a cohort folder holds several drills and only one is in the population.
      if (payload.meta.drillId !== SPIDER_WIDE_DRILL_ID) {
        skipped++;
        continue;
      }
      try {
        runs.push({ runId, summary: deriveSpiderWideMechanism(payload) });
      } catch (error) {
        failures.push(`${runId}: ${(error as Error).message}`);
      }
    }
  }

  const outDir = resolve(out);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, CSV_NAME), formatMechanismCsv(runs), 'utf8');

  const presentations = runs.reduce((sum, run) => sum + run.summary.peripheralCount, 0);
  const detected = runs.reduce((sum, run) => sum + run.summary.detectedCount, 0);
  const baselineShort = runs.reduce((sum, run) => sum + run.summary.baselineInsufficientCount, 0);

  console.log(`scanned ${scanned} files · ${runs.length} wide runs · ${skipped} other drills skipped`);
  console.log(`peripheral presentations: ${presentations}`);
  // Tier 1 admissibility, printed before anyone reads a reaction time: detection coverage is the
  // KI-031 tell, baseline coverage the KI-034 one. Tier 0 is unaffected by both.
  console.log(
    `detector coverage:  ${detected}/${presentations}` +
      (presentations > 0 ? ` (${((100 * detected) / presentations).toFixed(1)}%)` : ''),
  );
  console.log(
    `baseline short:     ${baselineShort}/${presentations}` +
      (presentations > 0 ? ` (${((100 * baselineShort) / presentations).toFixed(1)}%)` : ''),
  );
  for (const failure of failures) console.log(`FAILED ${failure}`);
  console.log(`wrote ${join(outDir, CSV_NAME)}`);
  return failures.length > 0 ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
