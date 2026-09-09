/**
 * WP-61 T2 —— 感測器離地標註 cohort 的操作者入口。
 *
 * Usage:
 *   npm run analyze:lift-cohort -- <export.json | export-dir> [more...] --manifest <manifest.json>
 *                                  [--out <dir>]
 *
 * manifest 用 `spider-wide-recording-spec.md` §3.3 的**物件型**條目（`instructionClass` 與
 * `sessionId` 必填）。報告寫到 `--out`，預設 `.lift-cohort-analysis/` —— **gitignored**，因為它是由
 * 參與者匯出推導出來的產物（同 `.spider-wide-analysis/` 的紀律）。
 *
 * **退出碼**：0 = 判定為 `sufficient`；1 = 有檔案被拒收（操作者端的問題）。
 * `blocked-by-data` 與 `annotation-channel-unusable` **不退非零** —— 兩者都是正當的具名結果
 * （FR-61.8 / D-61.P7）。讓它們退非零會誘使人為了讓命令變綠而去湊一批「剛好夠」的資料。
 *
 * 所有 I/O 都在本檔；判定契約在 `liftCohortAudit.ts`，故它可以在沒有檔案系統的情況下被測試。
 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { parseExportPayload } from '../src/data/exportPayloadSchema.ts';
import { buildLiftCohortReport, formatLiftCohortReport, type LiftRunInput } from './liftCohortAudit.ts';
import { readLiftManifest } from './liftManifest.ts';

const DEFAULT_OUT_DIR = '.lift-cohort-analysis';

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
      'usage: npm run analyze:lift-cohort -- <export.json | export-dir> [more...] --manifest <manifest.json> [--out <dir>]',
    );
    process.exit(2);
  }

  const manifest =
    manifestPath === undefined ? undefined : readLiftManifest(readFileSync(resolve(manifestPath), 'utf8'), manifestPath);
  const files = collectFiles(positional);
  if (files.length === 0) {
    console.error(`no .json exports found under: ${positional.join(', ')}`);
    process.exit(2);
  }

  const inputs: LiftRunInput[] = [];
  const rejected: { readonly sourcePath: string; readonly reason: string }[] = [];

  for (const file of files) {
    const name = basename(file);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      rejected.push({ sourcePath: name, reason: `unreadable: ${(error as Error).message}` });
      continue;
    }
    const parsed = parseExportPayload(raw);
    if (!parsed.ok) {
      rejected.push({
        sourcePath: name,
        reason: `schema errors: ${parsed.errors.map((entry) => `${entry.path}: ${entry.message}`).join('; ')}`,
      });
      continue;
    }

    // manifest 條目缺席**不是**拒收 —— 它讓該 run 缺 `instructionClass`／`sessionId`，稽核會把它
    // 具名作廢並說出缺哪一項。拒收會讓那份 run 從報告裡消失，讀者就看不到它曾經存在。
    const entry = manifest?.get(name);
    inputs.push({
      sourcePath: name,
      payload: parsed.payload,
      ...(entry?.instructionClass !== undefined ? { instructionClass: entry.instructionClass } : {}),
      ...(entry?.sessionId !== undefined ? { sessionId: entry.sessionId } : {}),
      ...(entry?.recordedAt !== undefined ? { recordedAt: entry.recordedAt } : {}),
      ...(entry?.order !== undefined ? { order: entry.order } : {}),
    });
  }

  if (inputs.length === 0) {
    console.error(`no export parsed as a valid payload (${rejected.length} rejected):`);
    for (const rejection of rejected) console.error(`  ${rejection.sourcePath} — ${rejection.reason}`);
    process.exit(1);
  }

  const report = buildLiftCohortReport(inputs);
  const text = formatLiftCohortReport(report);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'lift-cohort-audit.md'), `${text}\n`, 'utf8');
  writeFileSync(join(outDir, 'lift-cohort-audit.json'), `${JSON.stringify({ ...report, rejected }, null, 2)}\n`, 'utf8');

  console.log(text);
  if (rejected.length > 0) {
    console.error(`\n${rejected.length} file(s) rejected:`);
    for (const rejection of rejected) console.error(`  ${rejection.sourcePath} — ${rejection.reason}`);
  }
  console.log(`\nwrote 2 files to ${outDir}`);
  if (rejected.length > 0) process.exit(1);
}

main();
