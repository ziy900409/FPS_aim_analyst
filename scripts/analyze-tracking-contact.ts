/**
 * WP-55 / T7 — the operator entry point for tracking contact observability (closes OI-55-1).
 *
 * Usage:
 *   npm run analyze:contact -- <export.json | export-dir> [more...] [--out <dir>]
 *                                                        [--no-strict-eye-origin]
 *
 * Reads tracking exports, runs the shipped WP-55 pure functions over them, and writes the artifact
 * set (per-run contact artifact + replay trace HTML, plus the aggregate report JSON/HTML and a
 * manifest) to `--out`, default `.contact-analysis/` — gitignored, because a contact artifact is
 * derived from a participant export and must stay out of git (same rule as WP-54's
 * `.pilot-analysis/`).
 *
 * All I/O lives here; the output contract itself is in `trackingContactRunner.ts` so it can be
 * tested without a filesystem.
 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { parseExportPayload } from '../src/data/exportPayloadSchema.ts';
import {
  buildTrackingContactRunnerOutputs,
  formatTrackingContactRunnerSummary,
  type TrackingContactRunnerInput,
  type TrackingContactRunnerRejection,
} from './trackingContactRunner.ts';

const DEFAULT_OUT_DIR = '.contact-analysis';

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

/** Schema-rejected and unreadable files are named and skipped, never silently dropped and never
 * allowed to abort the rest of the batch (same precedent as `analyze-tracking-pilot.ts`). */
function load(files: readonly string[]): {
  inputs: TrackingContactRunnerInput[];
  rejected: TrackingContactRunnerRejection[];
} {
  const inputs: TrackingContactRunnerInput[] = [];
  const rejected: TrackingContactRunnerRejection[] = [];

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

    inputs.push({ sourcePath: file, payload: parsed.payload });
  }

  return { inputs, rejected };
}

function main(): void {
  const argv = process.argv.slice(2).filter((arg) => arg !== '--');

  const outIndex = argv.indexOf('--out');
  const outDir = resolve(outIndex >= 0 ? (argv[outIndex + 1] ?? DEFAULT_OUT_DIR) : DEFAULT_OUT_DIR);
  const strictEyeOrigin = !argv.includes('--no-strict-eye-origin');

  const positional = (
    outIndex >= 0 ? [...argv.slice(0, outIndex), ...argv.slice(outIndex + 2)] : argv
  ).filter((arg) => !arg.startsWith('--'));

  if (positional.length === 0) {
    console.error(
      'usage: npm run analyze:contact -- <export.json | export-dir> [more...] [--out <dir>] [--no-strict-eye-origin]',
    );
    process.exit(2);
  }

  const files = collectFiles(positional);
  if (files.length === 0) {
    console.error(`no .json exports found under: ${positional.join(', ')}`);
    process.exit(2);
  }

  const { inputs, rejected } = load(files);
  if (inputs.length === 0) {
    console.error(`no export parsed as a valid payload (${rejected.length} rejected):`);
    for (const rejection of rejected) console.error(`  ${basename(rejection.sourcePath)} — ${rejection.reason}`);
    process.exit(1);
  }

  const outputs = buildTrackingContactRunnerOutputs(inputs, { strictEyeOrigin, rejected });

  mkdirSync(outDir, { recursive: true });
  for (const file of outputs.files) writeFileSync(join(outDir, file.name), file.content, 'utf8');

  console.log(formatTrackingContactRunnerSummary(outputs));
  console.log(`\nwrote ${outputs.files.length} files to ${outDir}`);
  console.log(`  report: ${join(outDir, outputs.manifest.reportFiles.html)}`);

  // A rejected input file is an operator-side problem worth a non-zero exit; a blocked run is a
  // legitimate reason-coded result and is not.
  if (rejected.length > 0) process.exit(1);
}

main();
