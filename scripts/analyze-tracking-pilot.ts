/**
 * WP-54 / T6 — reproducible analysis runner for a collected tracking pilot session.
 *
 * Runs the *shipped* TS implementations (never a re-implementation) over a directory of exported
 * pilot blocks, so a Gate A/B/C conclusion can always be regenerated from the same inputs:
 *
 *   1. `parseExportPayload()`      — schema v2 validation of the raw JSON (traceability layer 1)
 *   2. `evaluateTrackingRunEligibility()` — the run-level quality gate the operator saw (layer 2)
 *   3. stimulus reconstruction     — rebuild `createTrackingTrajectory()` from the export's own
 *                                    `meta.spawn.trackingTrajectory` and reconcile the recorded
 *                                    `target_motion_change` events against the precomputed
 *                                    schedule (layer 3: event 對表)
 *   3b. `checkTrackingStimulusFidelity()` — the recorded target positions vs the same
 *                                    reconstruction, so a payload recorded by an older stimulus
 *                                    generation cannot pass as current (gate §12.3, D-54.43;
 *                                    `band-limited-2d-v1` has no events for the layer-3 check)
 *   4. `buildTrackingPilotEvidence()` + `renderTrackingPilotReportHtml()` (layer 4: report)
 *
 * Usage (participant data lives OUTSIDE the repo — never commit exports):
 *
 *   npx vite-node scripts/analyze-tracking-pilot.ts -- <dir|file...> [--out <dir>]
 *
 * `--out` defaults to `.pilot-analysis/` (gitignored). Console output is the summary table; the
 * evidence JSON and self-contained HTML report land in the out dir.
 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { parseExportPayload } from '../src/data/exportPayloadSchema.ts';
import type { ExportPayload } from '../src/data/export.ts';
import { evaluateTrackingRunEligibility } from '../src/pilot/trackingRunEligibility.ts';
import { buildTrackingPilotEvidence } from '../src/pilot/trackingPilotEvidence.ts';
import { renderTrackingPilotReportHtml } from '../src/pilot/trackingPilotReport.ts';
import { selectSummaryRun } from './trackingPilotSummary.ts';
import {
  checkTrackingStimulusFidelity,
  formatTrackingStimulusFidelity,
} from './trackingStimulusFidelity.ts';
import {
  computeTrackingFrozenCrosshairRatio,
  formatTrackingFrozenCrosshairRatio,
} from './trackingFrozenCrosshairRatio.ts';
import {
  createTrackingTrajectory,
  type TrackingTrajectoryConfig,
  type TrackingTrajectorySample,
} from '../src/sim/trackingTrajectory.ts';

const STILL_SPEED_DEG_PER_SEC = 0.5; // below this a reversal target reads as "not moving"
const EVENT_MATCH_TOLERANCE_DEG_PER_SEC = 1e-6;

interface LoadedRun {
  readonly file: string;
  readonly payload: ExportPayload;
}

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

function load(files: readonly string[]): { runs: LoadedRun[]; rejected: string[] } {
  const runs: LoadedRun[] = [];
  const rejected: string[] = [];
  for (const file of files) {
    const parsed = parseExportPayload(JSON.parse(readFileSync(file, 'utf8')));
    if (!parsed.ok) {
      rejected.push(`${basename(file)} — schema errors: ${parsed.errors.map((e) => `${e.path}: ${e.message}`).join('; ')}`);
      continue;
    }
    runs.push({ file, payload: parsed.payload });
  }
  return { runs, rejected };
}

/** Rebuilds the stimulus from the export's own metadata and reports how much of the scored window
 * the target was effectively stationary — the observable signature of a degenerate schedule. */
function stimulusCheck(payload: ExportPayload): string {
  const config = payload.meta.spawn?.trackingTrajectory as TrackingTrajectoryConfig | undefined;
  if (config === undefined) return 'no trajectory config in meta';
  const trajectory = createTrackingTrajectory(config);
  const out: TrackingTrajectorySample = {
    yawDeg: 0,
    pitchDeg: 0,
    yawVelocityDegPerSec: 0,
    pitchVelocityDegPerSec: 0,
  };
  const simHz = payload.meta.simHz;
  const tickCount = Math.round((config.durationMs / 1000) * simHz);
  let still = 0;
  let maxAbsYaw = 0;
  let maxAbsPitch = 0;
  let sumSpeedSquared = 0;
  for (let i = 0; i < tickCount; i++) {
    trajectory.sample(i / simHz, out);
    const speed = Math.hypot(out.yawVelocityDegPerSec, out.pitchVelocityDegPerSec);
    if (speed < STILL_SPEED_DEG_PER_SEC) still += 1;
    sumSpeedSquared += speed * speed;
    maxAbsYaw = Math.max(maxAbsYaw, Math.abs(out.yawDeg));
    maxAbsPitch = Math.max(maxAbsPitch, Math.abs(out.pitchDeg));
  }
  // Delivered vs nominal RMS angular speed: `band-limited-2d-v1` scales its coefficients down
  // whenever the requested speed cannot fit inside the angular envelope (bound safety wins), so a
  // config can silently deliver far less motion than its metadata claims.
  const rmsSpeed = tickCount === 0 ? 0 : Math.sqrt(sumSpeedSquared / tickCount);
  const nominalSpeed = (config as { targetRmsSpeedDegPerSec?: number }).targetRmsSpeedDegPerSec;
  const recorded = payload.events.filter((event) => event.type === 'target_motion_change');
  const scheduled = trajectory.changes;
  // Event 對表: the recorder emits one event per scheduled change (both in schedule order), so a
  // mismatch in count or in the before/after velocity pairs means the export cannot reconstruct
  // the stimulus it claims to describe.
  let mismatched = 0;
  for (let i = 0; i < Math.min(recorded.length, scheduled.length); i++) {
    const event = recorded[i];
    if (event.type !== 'target_motion_change') continue;
    const change = scheduled[i];
    const delta = Math.max(
      Math.abs(event.yawVelocityBeforeDegPerSec - change.yawVelocityBeforeDegPerSec),
      Math.abs(event.yawVelocityAfterDegPerSec - change.yawVelocityAfterDegPerSec),
      Math.abs(event.pitchVelocityBeforeDegPerSec - change.pitchVelocityBeforeDegPerSec),
      Math.abs(event.pitchVelocityAfterDegPerSec - change.pitchVelocityAfterDegPerSec),
    );
    if (delta > EVENT_MATCH_TOLERANCE_DEG_PER_SEC) mismatched += 1;
  }
  const stillPct = tickCount === 0 ? 0 : (100 * still) / tickCount;
  const speedNote =
    nominalSpeed === undefined
      ? `rmsSpeed=${rmsSpeed.toFixed(2)}deg/s`
      : `rmsSpeed=${rmsSpeed.toFixed(2)}/${nominalSpeed}deg/s (${((100 * rmsSpeed) / nominalSpeed).toFixed(0)}% of nominal)`;
  return (
    `changes rec/sched=${recorded.length}/${scheduled.length} mismatched=${mismatched} ` +
    `still=${stillPct.toFixed(1)}% maxAbs=${maxAbsYaw.toFixed(2)}/${maxAbsPitch.toFixed(2)}deg ${speedNote}`
  );
}

function main(): void {
  const argv = process.argv.slice(2).filter((arg) => arg !== '--');
  const outIndex = argv.indexOf('--out');
  const outDir = resolve(outIndex >= 0 ? (argv[outIndex + 1] ?? '.pilot-analysis') : '.pilot-analysis');
  const inputs = (outIndex >= 0 ? [...argv.slice(0, outIndex), ...argv.slice(outIndex + 2)] : argv).filter(
    (arg) => arg.length > 0,
  );
  if (inputs.length === 0) {
    console.error('usage: npx vite-node scripts/analyze-tracking-pilot.ts -- <dir|file...> [--out <dir>]');
    process.exit(2);
  }

  const { runs, rejected } = load(collectFiles(inputs));
  for (const line of rejected) console.error(`REJECTED  ${line}`);
  if (runs.length === 0) {
    console.error('no parseable exports found');
    process.exit(1);
  }

  console.log(`\n=== Runs (${runs.length}) ===`);
  for (const { file, payload } of runs) {
    const eligibility = evaluateTrackingRunEligibility(payload);
    const violations = payload.events.filter((event) => event.type === 'protocol_violation').length;
    const quality =
      eligibility.status === 'eligible'
        ? `eligible ticks=${eligibility.validScoredTicks} duration=${eligibility.durationMs.toFixed(0)}ms`
        : `BLOCKED ${eligibility.reasons.join(',')}`;
    console.log(
      [
        basename(file),
        `drill=${payload.meta.drillId}`,
        `participant=${payload.meta.session?.participantId ?? '-'}`,
        `cell=${payload.meta.session?.sessionLabel ?? '-'}`,
        `seed=${String((payload.meta.spawn?.trackingTrajectory as { seed?: number } | undefined)?.seed ?? '-')}`,
        `ticks=${payload.ticks.length}`,
        `suspect=${payload.meta.suspect}`,
        `perfFloor=${payload.meta.validity?.perfFloor ?? '-'}`,
        `displayHz=${payload.meta.displayHz.toFixed(1)}`,
        `violations=${violations}`,
        quality,
      ].join(' | '),
    );
    console.log(`    stimulus: ${stimulusCheck(payload)}`);
    // Layer 3b: the reconstruction above is what the CURRENT code makes of this payload's
    // metadata; this asks whether the payload was actually recorded by that code.
    const fidelity = checkTrackingStimulusFidelity(payload);
    console.log(`    ${formatTrackingStimulusFidelity(fidelity)}`);
    if (fidelity.status === 'mismatch') {
      console.error(
        `!!  STIMULUS FIDELITY MISMATCH — ${basename(file)} was not recorded by the current ` +
          `stimulus code (max position error ${fidelity.maxPositionErrorU.toExponential(2)}u). ` +
          `Its metrics must not be pooled with payloads that match; see gate §12.3.`,
      );
    }
    // Layer 5: could this condition have told tracking from not-tracking at all? A faithfully
    // recorded run of a stimulus that leaves ε no dynamic range still measures nothing (gate
    // §12.8 / T7). Reported per run because the frozen baseline is the participant's own median.
    console.log(`    ${formatTrackingFrozenCrosshairRatio(computeTrackingFrozenCrosshairRatio(payload))}`);
  }

  const payloads = runs.map((run) => run.payload);
  const evidence = buildTrackingPilotEvidence(payloads, { includeTrace: true });
  console.log(`\n=== Evidence (${evidence.conditions.length} conditions, practice excluded: ${evidence.excludedPracticeRunCount}) ===`);
  for (const condition of evidence.conditions) {
    // KI-022: never `runs[0]` — a retried condition keeps its blocked first attempt, which by
    // contract carries no p0/p1.
    const run = selectSummaryRun(condition.runs);
    const p0 =
      run?.p0 === undefined
        ? 'p0=-'
        : `rmsEps=${run.p0.rmsEpsilonDeg?.toFixed(3) ?? '-'}deg tot=${run.p0.totPercent?.toFixed(1) ?? '-'}% ` +
          `tAcquire=${run.p0.tAcquireMs?.toFixed(0) ?? '-'}ms acqFail=${run.p0.acquisitionFailure} ` +
          `p95Eps=${run.p0.p95EpsilonDeg?.toFixed(3) ?? '-'}deg`;
    const p1 =
      run?.p1 === undefined
        ? 'p1=-'
        : run.p1.status === 'ok'
          ? `lag=${run.p1.lagMs.toFixed(1)}ms gain=${run.p1.velocityGain.toFixed(3)} drops/s=${run.p1.dropRatePerSec.toFixed(3)}`
          : `p1 BLOCKED ${run.p1.reason}`;
    // `TrackingReversalWindowsResult` has no status field — every change event yields a window
    // that is either evaluated or marked `excluded` with a closed reason.
    let reversal = '';
    if (run?.reversal !== undefined && run.reversal.windows.length > 0) {
      const windows = run.reversal.windows;
      const evaluated = windows.filter((w) => !w.excluded);
      const byReason = new Map<string, number>();
      for (const w of windows) {
        if (!w.excluded) continue;
        const key = w.excludedReason ?? 'unknown';
        byReason.set(key, (byReason.get(key) ?? 0) + 1);
      }
      const excludedNote = [...byReason.entries()].map(([reason, n]) => `${reason}=${n}`).join(',');
      reversal =
        ` | reversal windows=${windows.length} evaluated=${evaluated.length}` +
        (excludedNote === '' ? '' : ` excluded[${excludedNote}]`);
    }
    console.log(
      `${condition.condition} | n=${condition.runCount} eligible=${condition.eligibleRunCount} ` +
        `seeds=[${condition.seeds.join(',')}] | ${p0} | ${p1}${reversal}`,
    );
  }

  mkdirSync(outDir, { recursive: true });
  const evidenceJson = join(outDir, 'tracking-pilot-evidence.json');
  const reportHtml = join(outDir, 'tracking-pilot-report.html');
  writeFileSync(evidenceJson, JSON.stringify(evidence, null, 2), 'utf8');
  writeFileSync(reportHtml, renderTrackingPilotReportHtml(evidence), 'utf8');
  // Parity check on the artifact actually written (not a fresh in-memory object).
  const embedded = /<script type="application\/json" id="evidence-data">([\s\S]*?)<\/script>/.exec(
    readFileSync(reportHtml, 'utf8'),
  );
  const parity =
    embedded === null
      ? 'FAILED (no embedded evidence block)'
      : JSON.stringify(JSON.parse(embedded[1].replace(/\\u003c/g, '<'))) === JSON.stringify(evidence)
        ? 'ok (HTML embeds the same evidence object byte-for-byte)'
        : 'FAILED (embedded JSON differs from the evidence object)';
  console.log(`\nJSON/HTML parity: ${parity}`);
  console.log(`wrote ${evidenceJson}`);
  console.log(`wrote ${reportHtml}`);
}

main();
