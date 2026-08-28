import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { runStage10Acceptance, type Stage10RunHandle, type Stage10ServerSpec } from './Stage10Runner.ts';
import { buildStage10Fixtures } from './Stage10FixtureFactory.ts';
import { createStage10EvidenceReporter, type M18EvidenceInput } from './Stage10EvidenceReporter.ts';
import type { ExportPayload } from '../../src/data/export.ts';
import type { HistoryApiErrorBody, HistoryApiSuccess, HistoryIndexReport, HistoryParticipantSummary } from '../../src/history/contracts.ts';

/**
 * WP-51 T1 — single Stage 10 acceptance entry point (`npm run test:stage10`, README §4 T1 DoD
 * "一個命令可fresh啟動dev與preview，且manifest證明root分離、server未reuse"). This proves the
 * harness itself: fresh dev/preview lifecycle on isolated roots, public-API-only seeding, and
 * bootstrap-only corrupt/unsupported fixtures discovered by preview at startup. The canonical
 * cross-WP journeys (completion→autosave→Result→History→Replay) are WP-51 T2's scope once WP-48~50
 * ship their exit evidence — this script does not stand in for them.
 */

const DEV: Stage10ServerSpec = { label: 'dev', command: 'npm run dev', args: [], port: 5173, healthPath: '/api/history/health' };
const PREVIEW: Stage10ServerSpec = {
  label: 'preview',
  command: 'npm run build && npm run preview',
  args: [],
  port: 4173,
  healthPath: '/api/history/health',
};

function gitCommit(workspaceRoot: string): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspaceRoot }).toString().trim();
  } catch {
    return 'unknown';
  }
}

async function postRun(baseUrl: string, payload: ExportPayload): Promise<HistoryApiSuccess<unknown> | HistoryApiErrorBody> {
  const res = await fetch(`${baseUrl}/api/history/runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return (await res.json()) as HistoryApiSuccess<unknown> | HistoryApiErrorBody;
}

async function getHealth(baseUrl: string): Promise<HistoryIndexReport> {
  const res = await fetch(`${baseUrl}/api/history/health`);
  const body = (await res.json()) as HistoryApiSuccess<HistoryIndexReport>;
  if (!body.ok) throw new Error(`health check failed for ${baseUrl}`);
  return body.data;
}

async function getParticipants(baseUrl: string): Promise<readonly HistoryParticipantSummary[]> {
  const res = await fetch(`${baseUrl}/api/history/participants`);
  const body = (await res.json()) as HistoryApiSuccess<readonly HistoryParticipantSummary[]>;
  if (!body.ok) throw new Error(`listParticipants failed for ${baseUrl}`);
  return body.data;
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Stage 10 acceptance assertion failed: ${message}`);
}

async function runScenario(handle: Stage10RunHandle, reporter: ReturnType<typeof createStage10EvidenceReporter>): Promise<number> {
  const devBase = `http://localhost:${DEV.port}`;
  const previewBase = `http://localhost:${PREVIEW.port}`;
  const devFixtures = buildStage10Fixtures(`${handle.env.runToken}-dev`);
  const previewFixtures = buildStage10Fixtures(`${handle.env.runToken}-preview`);

  function evidence(entry: M18EvidenceInput): void {
    reporter.record(entry);
  }

  // 1. Root separation: seed one fixture on dev only, one on preview only, and confirm neither
  // server can see the other's participant (proves FPS_HISTORY_ROOT actually isolated the two).
  const devSeedResult = await postRun(devBase, devFixtures.assessmentPayloads[0]!);
  assert(devSeedResult.ok, `dev seed failed: ${JSON.stringify(devSeedResult)}`);
  const previewSeedResult = await postRun(previewBase, previewFixtures.assessmentPayloads[0]!);
  assert(previewSeedResult.ok, `preview seed failed: ${JSON.stringify(previewSeedResult)}`);

  const devParticipants = await getParticipants(devBase);
  const previewParticipants = await getParticipants(previewBase);
  const devParticipantId = devFixtures.manifest.syntheticParticipantIds[0]!;
  const previewParticipantId = previewFixtures.manifest.syntheticParticipantIds[0]!;

  const devSeesOwnParticipant = devParticipants.some((p) => p.participantId === devParticipantId);
  const devSeesPreviewParticipant = devParticipants.some((p) => p.participantId === previewParticipantId);
  const previewSeesOwnParticipant = previewParticipants.some((p) => p.participantId === previewParticipantId);
  const previewSeesDevParticipant = previewParticipants.some((p) => p.participantId === devParticipantId);

  evidence({
    id: 'FR-51.2-root-separation',
    status: devSeesOwnParticipant && !devSeesPreviewParticipant && previewSeesOwnParticipant && !previewSeesDevParticipant ? 'pass' : 'fail',
    kind: 'automated',
    owner: 'wp-51',
    command: 'npm run test:stage10',
    artifact: 'tests/stage10/cli.ts#runScenario (root separation)',
    notes: 'dev and preview see only their own seeded synthetic participant',
  });
  assert(devSeesOwnParticipant, 'dev did not see its own seeded participant');
  assert(!devSeesPreviewParticipant, 'dev leaked the preview participant — history roots are not isolated');
  assert(previewSeesOwnParticipant, 'preview did not see its own seeded participant');
  assert(!previewSeesDevParticipant, 'preview leaked the dev participant — history roots are not isolated');

  // 2. Practice exclusion via the public API (both servers).
  const devPracticeResult = await postRun(devBase, devFixtures.practicePayload);
  const previewPracticeResult = await postRun(previewBase, previewFixtures.practicePayload);
  const practiceRejected =
    !devPracticeResult.ok &&
    (devPracticeResult as HistoryApiErrorBody).error.code === 'PRACTICE_NOT_ARCHIVABLE' &&
    !previewPracticeResult.ok &&
    (previewPracticeResult as HistoryApiErrorBody).error.code === 'PRACTICE_NOT_ARCHIVABLE';
  evidence({
    id: 'FR-51.6-practice-not-archivable',
    status: practiceRejected ? 'pass' : 'fail',
    kind: 'automated',
    owner: 'wp-51',
    command: 'npm run test:stage10',
    artifact: 'tests/stage10/cli.ts#runScenario (practice exclusion)',
  });
  assert(practiceRejected, 'a Practice payload was archived via the public API on dev or preview');

  // 3. Bootstrap-only corrupt/unsupported fixtures were written into the preview root before the
  // preview server started (beforeStart hook) — /health must have discovered them at initialize().
  const previewHealth = await getHealth(previewBase);
  const bootstrapDiscovered = previewHealth.unsupportedFileCount >= 1 && previewHealth.invalidFileCount >= 1;
  evidence({
    id: 'FR-51.9-bootstrap-corrupt-unsupported-discovered',
    status: bootstrapDiscovered ? 'pass' : 'fail',
    kind: 'automated',
    owner: 'wp-51',
    command: 'npm run test:stage10',
    artifact: 'tests/stage10/cli.ts#runScenario (bootstrap discovery)',
    notes: `preview health: unsupportedFileCount=${previewHealth.unsupportedFileCount}, invalidFileCount=${previewHealth.invalidFileCount}`,
  });
  assert(bootstrapDiscovered, 'preview did not discover the bootstrap corrupt/unsupported fixtures at initialize()');

  return 0;
}

async function main(): Promise<void> {
  const workspaceRoot = process.cwd();
  const environment = {
    commit: gitCommit(workspaceRoot),
    node: process.version,
    os: `${os.platform()} ${os.release()}`,
    browser: 'n/a (API-only smoke)',
    backend: 'n/a',
  };
  const reporter = createStage10EvidenceReporter({
    environment,
    forbiddenAbsolutePaths: [path.join(workspaceRoot, 'data', 'session-history')],
  });

  let outcome: { exitCode: number; cleanup: { ok: boolean; reason?: string } } | undefined;
  try {
    outcome = await runStage10Acceptance(
      {
        workspaceRoot,
        servers: [DEV, PREVIEW],
        beforeStart: async (env) => {
          const fixtures = buildStage10Fixtures(`${env.runToken}-preview`);
          for (const fixture of [...fixtures.corruptFixtures, ...fixtures.unsupportedFixtures]) {
            await fs.writeFile(path.join(env.previewHistoryRoot, fixture.relativePath), fixture.content, 'utf8');
          }
        },
      },
      (handle) => runScenario(handle, reporter),
    );
  } finally {
    const evidencePath = path.join(workspaceRoot, '.playwright-tmp', 'stage10-evidence', 'stage10-t1-evidence.json');
    await reporter.write(evidencePath);
    console.log(`Stage 10 evidence written to ${path.relative(workspaceRoot, evidencePath)}`);
  }

  if (!outcome.cleanup.ok) {
    console.error(`Stage 10 cleanup did not complete cleanly: ${outcome.cleanup.reason}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = outcome.exitCode;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
