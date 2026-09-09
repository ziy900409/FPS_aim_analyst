/**
 * WP-61 T2 —— 產生 Stage 1 切段的 committed golden（`research/fixtures/golden/lift-segments-*.json`）。
 *
 * Usage:
 *   npm run record:lift-golden -- <export.json | export-dir> [more...] --manifest <manifest.json>
 *                                 [--out <dir>]
 *
 * manifest 是 `spider-wide-recording-spec.md` §3.3 的**物件型**條目：
 *   { "<檔名>": { "instruction": "...", "instructionClass": "lift", "sessionId": "s1", ... } }
 * `instructionClass` 與 `sessionId` 必填 —— 沒有它們，golden 既不知道那些標註代表什麼，也無法支撐
 * FR-61.7 的 session 隔離。
 *
 * `runId` 一律取自 manifest 的 `runId`，缺席時取檔名（去副檔名）。**參與者識別資訊不進 golden**
 * （`meta.session.participantId` 完全不被讀取，D-57.T5-8／`research/README.md` 的匿名化要求）。
 *
 * 所有 I/O 都在本檔；golden 的內容契約在 `liftSegmentationGolden.ts`，故它可以在沒有檔案系統的
 * 情況下被測試（比照 `analyze-spider-wide-repositioning.ts` / `spiderWideRepositioningRunner.ts`）。
 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { parseExportPayload } from '../src/data/exportPayloadSchema.ts';
import { isInstructionClass } from './liftCohortAudit.ts';
import { buildLiftSegmentationGolden, verifyLiftSegmentationGolden } from './liftSegmentationGolden.ts';
import { readLiftManifest, type LiftManifestEntry } from './liftManifest.ts';

const DEFAULT_OUT_DIR = join('research', 'fixtures', 'golden');

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

  if (positional.length === 0 || manifestPath === undefined) {
    console.error(
      'usage: npm run record:lift-golden -- <export.json | export-dir> [more...] --manifest <manifest.json> [--out <dir>]',
    );
    process.exit(2);
  }

  const manifest = readLiftManifest(readFileSync(resolve(manifestPath), 'utf8'), manifestPath);
  const files = collectFiles(positional);
  const written: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const name = basename(file);
    const entry: LiftManifestEntry | undefined = manifest.get(name);
    if (entry === undefined) {
      skipped.push(`${name} — manifest 無此條目（golden 需要 instructionClass 與 sessionId）`);
      continue;
    }
    if (!isInstructionClass(entry.instructionClass) || entry.sessionId === undefined) {
      skipped.push(`${name} — manifest 條目缺 instructionClass 或 sessionId`);
      continue;
    }

    const parsed = parseExportPayload(JSON.parse(readFileSync(file, 'utf8')));
    if (!parsed.ok) {
      skipped.push(`${name} — schema errors: ${parsed.errors.map((error) => `${error.path}: ${error.message}`).join('; ')}`);
      continue;
    }
    if (parsed.payload.mouseSamples === undefined) {
      skipped.push(`${name} — 無 mouseSamples 區塊（錄製時未加 ?rawMouse=1）`);
      continue;
    }

    const runId = entry.runId ?? name.replace(/\.json$/, '');
    const golden = buildLiftSegmentationGolden({
      runId,
      sessionId: entry.sessionId,
      instructionClass: entry.instructionClass,
      payload: parsed.payload,
    });

    // 寫出去之前先自我覆驗 —— 一份寫得出來但重現不了的 golden 比沒有 golden 更糟。
    const mismatches = verifyLiftSegmentationGolden(golden);
    if (mismatches.length > 0) {
      skipped.push(`${name} — golden 無法自我重現: ${mismatches.join('; ')}`);
      continue;
    }

    mkdirSync(outDir, { recursive: true });
    const target = join(outDir, `lift-segments-${runId}.json`);
    writeFileSync(target, `${JSON.stringify(golden, null, 2)}\n`, 'utf8');
    written.push(
      `${basename(target)} — ${golden.sampleCount} samples, ` +
        golden.segmentationsByTheta.map((entry) => `θ=${entry.thetaMs}: ${entry.gaps.length} gaps`).join(', ') +
        `, ${golden.annotationIntervals.length} annotation intervals`,
    );
  }

  for (const line of written) console.log(line);
  if (skipped.length > 0) {
    console.error(`\n${skipped.length} file(s) skipped:`);
    for (const line of skipped) console.error(`  ${line}`);
  }
  console.log(`\nwrote ${written.length} golden file(s) to ${outDir}`);
  if (written.length === 0) process.exit(1);
}

main();
