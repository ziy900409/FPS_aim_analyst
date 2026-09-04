/**
 * WP-55 / T7 — turns loaded tracking exports into the WP-55 contact artifact set.
 *
 * This is glue, deliberately thin. T1-T5 already froze every construct
 * (`tracking-contact-v1` / `-artifact-v1` / `-report-v1` / `replay-contact-trace-v1`); T-exit found
 * that none of them had an operator entry point (OI-55-1), which is the only reason this file
 * exists. So nothing here re-derives contact, epsilon, TOT, acquisition or blocked semantics
 * (C-D4) — every number is read back out of the shipped pure functions.
 *
 * Kept apart from `analyze-tracking-contact.ts` so the output contract is testable against literal
 * payloads with no filesystem in the way.
 */
import type { ExportPayload } from '../src/data/export.ts';
import {
  buildTrackingContactCoverageReport,
  type TrackingContactCoverageOptions,
  type TrackingContactCoverageReport,
} from '../src/metrics/trackingContactCoverage.ts';
import {
  buildTrackingContactReport,
  renderTrackingContactReportHtml,
  serializeTrackingContactReport,
  type TrackingContactReportArtifact,
} from '../src/metrics/trackingContactReport.ts';
import {
  buildReplayContactTrace,
  renderReplayContactTraceHtml,
  type ReplayContactTrace,
} from '../src/replay/replayContact.ts';

export const TRACKING_CONTACT_RUNNER_MANIFEST_VERSION = 'tracking-contact-runner-manifest-v1' as const;

export const REPORT_JSON_FILENAME = 'tracking-contact-report.json';
export const REPORT_HTML_FILENAME = 'tracking-contact-report.html';
export const MANIFEST_FILENAME = 'manifest.json';

/** One export that parsed. `sourcePath` is kept only so the manifest can point back at it. */
export interface TrackingContactRunnerInput {
  readonly sourcePath: string;
  readonly payload: ExportPayload;
}

/** An input file that never became a payload — schema-rejected or unreadable. Named, never dropped. */
export interface TrackingContactRunnerRejection {
  readonly sourcePath: string;
  readonly reason: string;
}

export interface TrackingContactRunnerOptions extends TrackingContactCoverageOptions {
  readonly rejected?: readonly TrackingContactRunnerRejection[];
}

export interface TrackingContactRunnerFile {
  readonly name: string;
  readonly content: string;
}

export interface TrackingContactRunnerManifestRun {
  readonly sourcePath: string;
  readonly sourceId: string | null;
  readonly drillId: string;
  readonly status: 'included' | 'excluded';
  readonly reasons?: readonly string[];
  readonly sampleCount: number;
  readonly artifactFile: string;
  readonly replayTraceFile?: string;
}

export interface TrackingContactRunnerManifest {
  readonly manifestVersion: typeof TRACKING_CONTACT_RUNNER_MANIFEST_VERSION;
  readonly generatedFrom: 'tracking-contact-coverage';
  readonly reportSchemaVersion: TrackingContactReportArtifact['reportSchemaVersion'];
  readonly runCount: number;
  readonly includedRunCount: number;
  readonly excludedRunCount: number;
  readonly rejectedFileCount: number;
  readonly reportFiles: { readonly json: string; readonly html: string };
  readonly runs: readonly TrackingContactRunnerManifestRun[];
  readonly rejectedFiles: readonly TrackingContactRunnerRejection[];
}

export interface TrackingContactRunnerOutputs {
  readonly coverage: TrackingContactCoverageReport;
  readonly report: TrackingContactReportArtifact;
  readonly replayTraces: readonly ReplayContactTrace[];
  readonly manifest: TrackingContactRunnerManifest;
  readonly files: readonly TrackingContactRunnerFile[];
}

export function buildTrackingContactRunnerOutputs(
  inputs: readonly TrackingContactRunnerInput[],
  options: TrackingContactRunnerOptions = {},
): TrackingContactRunnerOutputs {
  const { rejected = [], ...coverageOptions } = options;

  // One coverage call for the whole batch: a second per-file derivation could disagree with this
  // one about the same file (see T7 task doc, design decision 1), so there is exactly one verdict.
  const coverage = buildTrackingContactCoverageReport(
    inputs.map((input) => input.payload),
    coverageOptions,
  );

  const replayTraces: ReplayContactTrace[] = [];
  const files: TrackingContactRunnerFile[] = [];
  const manifestRuns: TrackingContactRunnerManifestRun[] = [];

  coverage.runs.forEach((run, index) => {
    const artifact = run.contactArtifact;
    const sourceId = artifact.sourceId ?? null;
    const stem = fileStem(index, sourceId, run.drillId);
    const artifactFile = `${stem}.contact-artifact.json`;

    // Blocked runs get an artifact too — the closed reason code is the result, not an error.
    files.push({ name: artifactFile, content: `${JSON.stringify(artifact, null, 2)}\n` });

    let replayTraceFile: string | undefined;
    if (run.status === 'included') {
      replayTraces.push(buildReplayContactTrace(artifact));
      replayTraceFile = `${stem}.replay-trace.html`;
      files.push({ name: replayTraceFile, content: renderReplayContactTraceHtml(artifact) });
    }

    manifestRuns.push({
      sourcePath: inputs[index].sourcePath,
      sourceId,
      drillId: run.drillId,
      status: run.status,
      ...(run.status === 'excluded' ? { reasons: run.reasons } : {}),
      sampleCount: artifact.sampleCount,
      artifactFile,
      ...(replayTraceFile !== undefined ? { replayTraceFile } : {}),
    });
  });

  const report = buildTrackingContactReport(coverage, { replayTraces });
  files.push({ name: REPORT_JSON_FILENAME, content: serializeTrackingContactReport(report) });
  files.push({ name: REPORT_HTML_FILENAME, content: renderTrackingContactReportHtml(report) });

  const manifest: TrackingContactRunnerManifest = {
    manifestVersion: TRACKING_CONTACT_RUNNER_MANIFEST_VERSION,
    generatedFrom: 'tracking-contact-coverage',
    reportSchemaVersion: report.reportSchemaVersion,
    runCount: coverage.runCount,
    includedRunCount: coverage.includedRunCount,
    excludedRunCount: coverage.excludedRunCount,
    rejectedFileCount: rejected.length,
    reportFiles: { json: REPORT_JSON_FILENAME, html: REPORT_HTML_FILENAME },
    runs: manifestRuns,
    rejectedFiles: rejected.slice(),
  };
  files.push({ name: MANIFEST_FILENAME, content: `${JSON.stringify(manifest, null, 2)}\n` });

  return { coverage, report, replayTraces, manifest, files };
}

export function formatTrackingContactRunnerSummary(outputs: TrackingContactRunnerOutputs): string {
  const { coverage, manifest } = outputs;
  const lines: string[] = [];

  lines.push(
    `runs: ${coverage.runCount} (included ${coverage.includedRunCount}, excluded ${coverage.excludedRunCount})`,
  );

  const reasonCounts = Object.entries(coverage.exclusionReasonCounts);
  if (reasonCounts.length > 0) {
    lines.push(`exclusion reasons: ${reasonCounts.map(([reason, count]) => `${reason}=${count}`).join(', ')}`);
  }

  for (const run of manifest.runs) {
    const detail =
      run.status === 'included'
        ? `samples=${run.sampleCount}`
        : `blocked: ${(run.reasons ?? []).join(', ')}`;
    lines.push(`  [${run.status}] ${run.drillId} ${run.sourceId ?? '(no source id)'} — ${detail}`);
  }

  if (manifest.rejectedFiles.length > 0) {
    lines.push(`rejected files: ${manifest.rejectedFiles.length}`);
    for (const rejection of manifest.rejectedFiles) {
      lines.push(`  [rejected] ${rejection.sourcePath} — ${rejection.reason}`);
    }
  }

  return lines.join('\n');
}

/** Deterministic, filesystem-safe stem. Index prefix keeps two runs with the same `sourceId`
 * (same drill, same `startedAt`) from overwriting each other. */
function fileStem(index: number, sourceId: string | null, drillId: string): string {
  const label = sourceId ?? drillId;
  const safe = label.replace(/[^A-Za-z0-9._@-]+/g, '-').replace(/^-+|-+$/g, '');
  return `${String(index + 1).padStart(3, '0')}-${safe === '' ? 'run' : safe}`;
}
