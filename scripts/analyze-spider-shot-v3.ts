/**
 * stage14 —— `spider-shot-v3` 真人 run 的操作者入口。
 *
 * Usage:
 *   npm run analyze:spider-v3 -- <export.json | export-dir> [more...] [--out <dir>]
 *
 * 報告寫到 `--out`,預設 `.spider-v3-analysis/` —— **gitignored**,因為它是由參與者匯出推導出來的
 * 產物（同 `.pilot-analysis/`／`.contact-analysis/`／`.spider-wide-analysis/` 的紀律）。三份
 * 2026-09-09 的真人匯出本身也依 D-57.T5-8 **不進 repo**;錄製條件見
 * `docs/exec-plan/active/stage14/HANDOFF-v3-real-data.md` §1。
 *
 * 所有 I/O 都在本檔;資料層在 `spiderShotV3CoachRunner.ts`、渲染層在 `spiderShotV3CoachReport.ts`,
 * 兩者皆為純函式,故可以在沒有檔案系統的情況下被測試（比照 `analyze-spider-wide-repositioning.ts`
 * ／`spiderWideRepositioningRunner.ts` 的分工）。
 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { parseExportPayload } from '../src/data/exportPayloadSchema.ts';
import { spiderShotV3 } from '../src/drill/spider_shot_v3.ts';
import {
  buildSpiderShotV3CoachReport,
  type SpiderShotV3RunInput,
} from './spiderShotV3CoachRunner.ts';
import {
  renderBinCsv,
  renderCoachReportHtml,
  renderPresentationCsv,
  renderRunCsv,
} from './spiderShotV3CoachReport.ts';

const DEFAULT_OUT_DIR = '.spider-v3-analysis';

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

interface Rejection {
  readonly sourcePath: string;
  readonly reason: string;
}

/** Schema 拒收、讀不到、以及**不是 v3** 的檔案一律點名跳過,不靜默丟掉、也不讓它中斷整批。 */
function load(files: readonly string[]): { inputs: SpiderShotV3RunInput[]; rejected: Rejection[] } {
  const inputs: SpiderShotV3RunInput[] = [];
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
    if (parsed.payload.meta.drillId !== spiderShotV3.drillId) {
      // 同一個 Downloads 目錄常常混著 `spider-shot-wide-v1`（WP-67 的範圍）。點名跳過而不是硬跑,
      // 因為 wide 的幾何與構念都不同,混進來的數字看起來完全合理但屬於另一支 drill。
      rejected.push({
        sourcePath: file,
        reason: `drillId '${parsed.payload.meta.drillId}' ≠ '${spiderShotV3.drillId}'（本入口只認 v3）`,
      });
      continue;
    }

    inputs.push({ sourcePath: basename(file), payload: parsed.payload });
  }

  // 報告的 rep 順序 = 錄製順序,不是命令列順序 —— 學習曲線的方向不該由操作者打字的順序決定。
  inputs.sort((a, b) => a.payload.meta.startedAt.localeCompare(b.payload.meta.startedAt));
  return { inputs, rejected };
}

function reportBasename(inputs: readonly SpiderShotV3RunInput[]): string {
  const last = inputs[inputs.length - 1].payload.meta.startedAt;
  return `coach-report-spider-shot-v3-${last.replaceAll(':', '_')}`;
}

function main(): void {
  const argv = process.argv.slice(2).filter((arg) => arg !== '--');

  const outIndex = argv.indexOf('--out');
  const outDir = resolve(outIndex >= 0 ? (argv[outIndex + 1] ?? DEFAULT_OUT_DIR) : DEFAULT_OUT_DIR);
  const consumed = new Set<number>(outIndex >= 0 ? [outIndex, outIndex + 1] : []);
  const positional = argv.filter((arg, index) => !consumed.has(index) && !arg.startsWith('--'));

  if (positional.length === 0) {
    console.error('usage: npm run analyze:spider-v3 -- <export.json | export-dir> [more...] [--out <dir>]');
    process.exit(2);
  }

  const files = collectFiles(positional);
  if (files.length === 0) {
    console.error(`no .json exports found under: ${positional.join(', ')}`);
    process.exit(2);
  }

  const { inputs, rejected } = load(files);
  if (inputs.length === 0) {
    console.error(`no ${spiderShotV3.drillId} export parsed as a valid payload (${rejected.length} rejected):`);
    for (const rejection of rejected) console.error(`  ${basename(rejection.sourcePath)} — ${rejection.reason}`);
    process.exit(1);
  }

  const report = buildSpiderShotV3CoachReport(inputs);
  const base = reportBasename(inputs);

  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  const write = (filename: string, content: string): void => {
    writeFileSync(join(outDir, filename), content, 'utf8');
    written.push(filename);
  };

  write(`${base}.html`, renderCoachReportHtml(report));
  write(`${base}-runs.csv`, renderRunCsv(report));
  write(`${base}-presentations.csv`, renderPresentationCsv(report));
  write(`${base}-bins.csv`, renderBinCsv(report));
  write(
    `${base}.json`,
    `${JSON.stringify({ ...report, rejected: rejected.map((entry) => ({ ...entry, sourcePath: basename(entry.sourcePath) })) }, null, 2)}\n`,
  );

  // 主控台摘要刻意只印**閘的結論**與降級,不印指標值 —— 指標值要在報告的脈絡裡讀。
  console.log(`spider-shot-v3 coach report — ${inputs.length} run(s), report version ${report.version}`);
  console.log('');
  for (const gate of report.gates) {
    console.log(`${gate.id}  ${gate.verdict}`);
    for (const degradation of gate.degradations) console.log(`      ↳ 降級：${stripMarkup(degradation)}`);
  }
  console.log('');
  console.log(`被資料推翻的設計假設：${report.overturned.length} 項`);
  for (const entry of report.overturned) console.log(`  - ${firstSentence(stripMarkup(entry))}`);

  if (rejected.length > 0) {
    console.error('');
    console.error(`${rejected.length} file(s) rejected:`);
    for (const rejection of rejected) console.error(`  ${basename(rejection.sourcePath)} — ${rejection.reason}`);
  }
  console.log('');
  console.log(`wrote ${written.length} files to ${outDir}`);
  for (const filename of written) console.log(`  ${filename}`);

  // 被拒收的輸入是操作者端的問題（挑錯檔、檔壞了）,值得非零 exit。**降級不是錯誤** —— 降級是
  // 這批資料的正當結果,拒答退非零會誘使人為了讓 CI 綠而去湊一個能答的 cohort。
  if (rejected.length > 0) process.exit(1);
}

function stripMarkup(text: string): string {
  return text.replaceAll('**', '').replaceAll('`', '');
}

function firstSentence(text: string): string {
  const index = text.indexOf('。');
  return index < 0 ? text : text.slice(0, index + 1);
}

main();
