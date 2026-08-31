import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { chromium, type Page } from '@playwright/test';
import { startStage10Run, type Stage10RunHandle, type Stage10ServerSpec } from './Stage10Runner.ts';
import { createStage10EvidenceReporter, type M18EvidenceInput } from './Stage10EvidenceReporter.ts';
import { buildIdentitySegment, buildRunFilename, buildRunId, buildRunIdentity } from '../../server/history/historyPaths.ts';
import { makeAssessmentPayload } from '../history/payloadFixtures.ts';
import type { ExportPayload } from '../../src/data/export.ts';
import type { TickRecord } from '../../src/data/RingBuffer.ts';
import type { DrillEvent } from '../../src/data/DataRecorder.ts';
import type { Stage10AcceptanceEnvironment } from './Stage10AcceptanceEnvironment.ts';

/**
 * WP-51 T4 — real-browser scale/performance evidence for the matrix rows T4-scale-lifecycle-a11y.md
 * does not already have Node-level evidence for (README §2.5 "measurement" grade): History-list
 * first-100-rows P95 against a >100-participant corpus, 100-run drill analysis cold vs warm open, and
 * a 42,000-tick Replay's cached-first-frame reopen time. `tests/history/historyRepository.perf.test.ts`
 * (WP-48, opt-in) already covers the 5,000-run cold-rebuild / warm-list Node-level half of NFR-51.1;
 * `tests/replay/replay-perf.test.ts` (WP-50) already covers `normalizeReplayRecording`/`sampleReplay`
 * pure-function P95 at 42,000-tick scale. This script is the missing cross-layer half: driving the
 * real dev bundle in a real browser against fixtures written straight to a *dedicated, freshly
 * allocated* isolated root (via `Stage10Runner`, the same fresh dev/preview lifecycle T1 built —
 * never the shared `.playwright-tmp/history-dev` root every other Playwright spec in this suite
 * writes into and never resets, which would make P95 numbers meaningless here).
 *
 * Opt-in (`RUN_STAGE10_SCALE_BENCHMARK=1`), like `RUN_HISTORY_PERF_BENCHMARK` — writing/serving
 * thousands of fixture files and launching a real browser on every `npm run test:stage10` would blow
 * past NFR-51.5's 10-minute acceptance-command budget, which explicitly excludes this kind of opt-in
 * benchmark. `npm run test:stage10:scale` runs it directly.
 */

const RUN_BENCHMARK = process.env.RUN_STAGE10_SCALE_BENCHMARK === '1';

const DEV: Stage10ServerSpec = { label: 'dev', command: 'npm run dev', args: [], port: 5173, healthPath: '/api/history/health' };

const PARTICIPANT_LIST_SIZE = 150; // > ParticipantBrowser's CHUNK_SIZE=100, so the first-100-rows gate is real
const HUNDRED_RUN_DRILL_ID = 'spider-shot-v2'; // the one DrillMetricRegistry-registered drill (real trend render, not just a run list)
const HUNDRED_RUN_COUNT = 100;
const REPLAY_TICK_COUNT = 42_000; // matches capacityForDrill(128, 300), same as replay-perf.test.ts's own NFR-50.1 fixture
const TICK_MS = 1000 / 128;

function p95(durationsMs: readonly number[]): number {
  const sorted = [...durationsMs].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index]!;
}

async function writePayload(devRoot: string, participantId: string, drillId: string, payload: ExportPayload): Promise<string> {
  const participantSeg = buildIdentitySegment(participantId);
  const drillSeg = buildIdentitySegment(drillId);
  const dir = path.join(devRoot, participantSeg, drillSeg);
  await fs.mkdir(dir, { recursive: true });
  const identity = buildRunIdentity(payload.meta.schemaVersion, participantId, drillId, payload.meta.startedAt);
  const runId = buildRunId(identity);
  const filename = buildRunFilename(payload.meta.startedAt, runId);
  await fs.writeFile(path.join(dir, filename), JSON.stringify(payload), 'utf8');
  return runId;
}

function buildLargeReplayPayload(participantId: string, startedAt: string): ExportPayload {
  const ticks: TickRecord[] = new Array(REPLAY_TICK_COUNT);
  const events: DrillEvent[] = [];
  for (let i = 0; i < REPLAY_TICK_COUNT; i++) {
    const t = i * TICK_MS;
    ticks[i] = {
      t,
      vx: Math.sin(i * 0.01) * 250,
      vz: Math.cos(i * 0.01) * 250,
      px: Math.sin(i * 0.001) * 500,
      pz: Math.cos(i * 0.001) * 500,
      tx: null,
      ty: null,
      tz: null,
      aim: { yaw: ((i * 0.013) % (2 * Math.PI)) - Math.PI, pitch: Math.sin(i * 0.007) * 0.5 },
      keys: i % 4 === 0 ? ['A'] : i % 4 === 1 ? ['D'] : [],
      ads: i % 50 < 10,
    };
    if (i % 20 === 0) events.push({ type: 'fire', t, hit: i % 3 === 0, firstShot: i % 20 === 0, residualSpeed: 0, shotSeq: i });
  }
  return {
    meta: {
      schemaVersion: 2,
      drillId: 'hold_click_v1',
      weaponId: 'ak47',
      weaponSeed: 1,
      rngSeed: 1,
      backend: 'webgpu',
      displayHz: 144,
      simHz: 128,
      browser: 'chrome',
      sensitivity: 1,
      sensitivityModel: 'cs2-0.022deg',
      movementModel: 'cs2-source',
      crossOriginIsolated: true,
      startedAt,
      unit: 'source',
      vStrafe: 250,
      maxDrillSeconds: 300,
      lateEventCount: 0,
      bufferOverflow: false,
      recorderOverflow: false,
      suspect: false,
      session: { participantId },
      assessment: { protocolVersion: '1.0.0', assessmentFeedbackPolicy: 'minimal-end-of-block' },
      // Must match the real installed `peek-corridor` scene's `assetPackVersion` exactly (see
      // src/scene/scenes/peek-corridor.ts) or `resolveSessionScene` degrades this to `partial`
      // (SCENE_ASSET_VERSION_MISMATCH) — a real defect this benchmark hit and fixed once already in
      // stage10-accessibility.spec.ts's own fixture, same root cause here.
      scene: { sceneId: 'peek-corridor', assetPackVersion: 'peek-corridor-v1', clutterTier: 'low', fallback: false },
      replay: { replaySchemaVersion: 1 },
    },
    ticks,
    events,
  };
}

interface FixtureManifest {
  readonly listParticipantIds: readonly string[];
  readonly hundredRunParticipantId: string;
  readonly hundredRunRunIds: readonly string[];
  readonly replayParticipantId: string;
  readonly replayRunId: string;
  readonly replayDrillId: string;
}

async function seedFixtures(devRoot: string): Promise<FixtureManifest> {
  const runToken = `scale-${Date.now()}`;

  const listParticipantIds: string[] = [];
  for (let p = 0; p < PARTICIPANT_LIST_SIZE; p++) {
    const participantId = `${runToken}-list-${String(p).padStart(4, '0')}`;
    listParticipantIds.push(participantId);
    const startedAt = new Date(Date.UTC(2026, 0, 1, 0, 0, 0, p)).toISOString();
    const payload = makeAssessmentPayload({ participantId, drillId: 'hold_click_v1', startedAt });
    await writePayload(devRoot, participantId, 'hold_click_v1', payload);
  }

  const hundredRunParticipantId = `${runToken}-hundred`;
  const hundredRunRunIds: string[] = [];
  for (let r = 0; r < HUNDRED_RUN_COUNT; r++) {
    const startedAt = new Date(Date.UTC(2026, 0, 2, 0, 0, 0, r)).toISOString();
    const payload = makeAssessmentPayload({ participantId: hundredRunParticipantId, drillId: HUNDRED_RUN_DRILL_ID, startedAt });
    const runId = await writePayload(devRoot, hundredRunParticipantId, HUNDRED_RUN_DRILL_ID, payload);
    hundredRunRunIds.push(runId);
  }

  const replayParticipantId = `${runToken}-replay42k`;
  const replayStartedAt = new Date(Date.UTC(2026, 0, 3)).toISOString();
  const replayPayload = buildLargeReplayPayload(replayParticipantId, replayStartedAt);
  const replayRunId = await writePayload(devRoot, replayParticipantId, replayPayload.meta.drillId, replayPayload);

  return {
    listParticipantIds,
    hundredRunParticipantId,
    hundredRunRunIds,
    replayParticipantId,
    replayRunId,
    replayDrillId: replayPayload.meta.drillId,
  };
}

async function waitForHarnessReady(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean((window as unknown as { __fpsTest?: unknown }).__fpsTest), undefined, { timeout: 15_000 });
}

async function timeAction(page: Page, action: () => Promise<void>): Promise<number> {
  const start = Date.now();
  await action();
  return Date.now() - start;
}

async function measureHistoryFirstRowsP95(page: Page, manifest: FixtureManifest, samples: number): Promise<number> {
  const durations: number[] = [];
  for (let i = 0; i < samples; i++) {
    // Close (if open) then reopen — each iteration is a fresh 'participants' route render, not a
    // cached DOM the first render already paid for.
    const closeButton = page.getByRole('button', { name: '關閉歷史紀錄' });
    if (await closeButton.isVisible().catch(() => false)) await closeButton.click();
    const elapsed = await timeAction(page, async () => {
      await page.getByRole('button', { name: '歷史紀錄', exact: true }).click();
      await page.waitForFunction(
        () => document.querySelectorAll('[data-section="participant-status"] li button').length >= 100,
        undefined,
        { timeout: 5_000 },
      );
    });
    durations.push(elapsed);
  }
  return p95(durations);
}

/** "Cold": starting from launch/closed-History, the full History->search->participant->drill chain —
 * this is what "opening the 100-run analysis" means for a user who hasn't visited History yet this
 * session. */
async function openDrillOverviewCold(page: Page, participantId: string, drillId: string): Promise<number> {
  return timeAction(page, async () => {
    const closeButton = page.getByRole('button', { name: '關閉歷史紀錄' });
    if (await closeButton.isVisible().catch(() => false)) await closeButton.click();
    await page.getByRole('button', { name: '歷史紀錄', exact: true }).click();
    const screen = page.locator('#history-screen');
    await screen.getByRole('searchbox', { name: '搜尋 Participant' }).fill(participantId);
    await screen.getByRole('button', { name: new RegExp(participantId) }).click();
    await screen.getByRole('button', { name: new RegExp(drillId) }).click();
    await screen.locator('[data-section="drill-overview"]').waitFor({ state: 'visible' });
    await page.waitForFunction(
      () => document.querySelectorAll('[data-section="run-list-status"] li button').length >= 100,
      undefined,
      { timeout: 10_000 },
    );
  });
}

/** "Warm": revisiting the *same* drill overview a second time without leaving History or re-running
 * the Participant search — via the breadcrumb's "drills" crumb (`data-history-crumb`, same locator
 * `stage10-preview.spec.ts` already uses), not a second full close/reopen/search cycle. Measuring
 * "warm" as a second full History close+reopen+150-participant-search cycle (this file's first draft)
 * mostly re-measures the participant list gate above, not the drill-overview route itself, and came
 * back *slower* than "cold" — an artifact of the measurement, not a real regression. */
async function reopenDrillOverviewWarm(page: Page, drillId: string): Promise<number> {
  return timeAction(page, async () => {
    const screen = page.locator('#history-screen');
    await screen.locator('[data-history-crumb="drills"]').click();
    await screen.getByRole('button', { name: new RegExp(drillId) }).click();
    await screen.locator('[data-section="drill-overview"]').waitFor({ state: 'visible' });
    await page.waitForFunction(
      () => document.querySelectorAll('[data-section="run-list-status"] li button').length >= 100,
      undefined,
      { timeout: 10_000 },
    );
  });
}

/**
 * `coldMs` is a single sample (the very first-ever open — by definition not repeatable without
 * re-seeding, and not gated: NFR-50.3 only budgets the *cached* reopen). `cachedReopenP95Ms` takes
 * several repeated close->reopen samples of the *same* run, matching this file's own established
 * multi-sample discipline (`measureHistoryFirstRowsP95` above) — a single-shot "cached reopen"
 * sample this file's first draft took came back *slower* than cold (1502ms vs 562ms, backwards from
 * what "already-resident scene assets" should produce) purely from run-to-run noise, which a single
 * sample can't distinguish from a real regression.
 */
async function measureReplayCachedReopen(
  page: Page,
  manifest: FixtureManifest,
  reopenSamples: number,
): Promise<{ coldMs: number; cachedReopenDurationsMs: readonly number[]; cachedReopenP95Ms: number }> {
  const closeButton = page.getByRole('button', { name: '關閉歷史紀錄' });
  if (await closeButton.isVisible().catch(() => false)) await closeButton.click();
  await page.getByRole('button', { name: '歷史紀錄', exact: true }).click();
  const screen = page.locator('#history-screen');
  await screen.getByRole('searchbox', { name: '搜尋 Participant' }).fill(manifest.replayParticipantId);
  await screen.getByRole('button', { name: new RegExp(manifest.replayParticipantId) }).click();
  await screen.getByRole('button', { name: new RegExp(manifest.replayDrillId) }).click();
  await screen.getByRole('button', { name: new RegExp(manifest.replayRunId) }).click();
  await screen.locator('[data-section="result-detail-body"]').waitFor({ state: 'visible' });

  const replay = page.locator('#replay-screen');
  const coldMs = await timeAction(page, async () => {
    await screen.locator('[data-history-action="replay"]').click();
    await replay.locator('[data-section="replay-ready"]').waitFor({ state: 'visible', timeout: 15_000 });
  });
  await replay.getByRole('button', { name: '返回', exact: true }).click();
  await replay.waitFor({ state: 'hidden' });

  const reopenDurations: number[] = [];
  for (let i = 0; i < reopenSamples; i++) {
    const ms = await timeAction(page, async () => {
      await screen.locator('[data-history-action="replay"]').click();
      await replay.locator('[data-section="replay-ready"]').waitFor({ state: 'visible', timeout: 15_000 });
    });
    reopenDurations.push(ms);
    await replay.getByRole('button', { name: '返回', exact: true }).click();
    await replay.waitFor({ state: 'hidden' });
  }

  return { coldMs, cachedReopenDurationsMs: reopenDurations, cachedReopenP95Ms: p95(reopenDurations) };
}

function gitCommit(workspaceRoot: string): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspaceRoot }).toString().trim();
  } catch {
    return 'unknown';
  }
}

async function main(): Promise<void> {
  if (!RUN_BENCHMARK) {
    console.log('[stage10 scale perf] skipped — set RUN_STAGE10_SCALE_BENCHMARK=1 to run (opt-in, NFR-51.5 excludes it from the acceptance command budget).');
    return;
  }

  const workspaceRoot = process.cwd();
  const reporter = createStage10EvidenceReporter({
    environment: {
      commit: gitCommit(workspaceRoot),
      node: process.version,
      os: `${os.platform()} ${os.release()}`,
      browser: 'msedge (channel)',
      backend: 'n/a (History API only, no WebGPU render needed for these gates)',
    },
    forbiddenAbsolutePaths: [path.join(workspaceRoot, 'data', 'session-history')],
  });

  let handle: Stage10RunHandle | undefined;
  let manifest: FixtureManifest | undefined;
  try {
    handle = await startStage10Run({
      workspaceRoot,
      servers: [DEV],
      beforeStart: async (env: Stage10AcceptanceEnvironment) => {
        manifest = await seedFixtures(env.devHistoryRoot);
      },
    });
    if (manifest === undefined) throw new Error('fixture seeding did not run');

    const browser = await chromium.launch({ channel: 'msedge' });
    try {
      const page = await browser.newPage();
      await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
      await waitForHarnessReady(page);

      const historyP95 = await measureHistoryFirstRowsP95(page, manifest, 10);
      console.log(`[stage10 scale perf] History first-100-rows P95 over 10 samples (${PARTICIPANT_LIST_SIZE} participants): ${historyP95.toFixed(1)}ms`);
      reporter.record({
        id: 'NFR-51.1-history-first-100-rows-p95',
        status: historyP95 < 500 ? 'pass' : 'fail',
        kind: 'measurement',
        owner: 'wp-51',
        command: 'npm run test:stage10:scale',
        artifact: 'tests/stage10/stage10-scale.perf.ts#measureHistoryFirstRowsP95',
        notes: `P95=${historyP95.toFixed(1)}ms over 10 samples, ${PARTICIPANT_LIST_SIZE} synthetic participants, budget <500ms`,
      });

      const coldAnalysisMs = await openDrillOverviewCold(page, manifest.hundredRunParticipantId, HUNDRED_RUN_DRILL_ID);
      const warmAnalysisMs = await reopenDrillOverviewWarm(page, HUNDRED_RUN_DRILL_ID);
      console.log(`[stage10 scale perf] 100-run analysis open: cold=${coldAnalysisMs}ms, warm=${warmAnalysisMs}ms`);
      reporter.record({
        id: 'NFR-51.1-100-run-analysis-cold',
        status: coldAnalysisMs < 2000 ? 'pass' : 'fail',
        kind: 'measurement',
        owner: 'wp-51',
        command: 'npm run test:stage10:scale',
        artifact: 'tests/stage10/stage10-scale.perf.ts#openDrillOverviewCold',
        notes: `cold=${coldAnalysisMs}ms, budget <2000ms, drill=${HUNDRED_RUN_DRILL_ID}, ${HUNDRED_RUN_COUNT} runs`,
      });
      reporter.record({
        id: 'NFR-51.1-100-run-analysis-warm',
        status: warmAnalysisMs < 300 ? 'pass' : 'fail',
        kind: 'measurement',
        owner: 'wp-51',
        command: 'npm run test:stage10:scale',
        artifact: 'tests/stage10/stage10-scale.perf.ts#reopenDrillOverviewWarm',
        notes: `warm=${warmAnalysisMs}ms, budget <300ms`,
      });

      const REPLAY_REOPEN_SAMPLES = 15;
      const { coldMs: replayColdMs, cachedReopenDurationsMs, cachedReopenP95Ms } = await measureReplayCachedReopen(
        page,
        manifest,
        REPLAY_REOPEN_SAMPLES,
      );
      console.log(
        `[stage10 scale perf] 42k-tick Replay open: cold=${replayColdMs}ms, cached-reopen P95 over ${REPLAY_REOPEN_SAMPLES} samples=${cachedReopenP95Ms}ms (samples: ${cachedReopenDurationsMs.join(', ')}ms)`,
      );
      reporter.record({
        id: 'NFR-51.1-42k-tick-replay-cached-reopen',
        status: cachedReopenP95Ms < 1500 ? 'pass' : 'fail',
        kind: 'measurement',
        owner: 'wp-51',
        command: 'npm run test:stage10:scale',
        artifact: 'tests/stage10/stage10-scale.perf.ts#measureReplayCachedReopen',
        notes: `cold=${replayColdMs}ms (not gated — first-ever scene/asset load), cached-reopen P95 over ${REPLAY_REOPEN_SAMPLES} samples=${cachedReopenP95Ms}ms, budget <1500ms, ${REPLAY_TICK_COUNT} ticks, raw samples ms: [${cachedReopenDurationsMs.join(', ')}]`,
      });
    } finally {
      await browser.close();
    }
  } finally {
    const evidencePath = path.join(workspaceRoot, '.playwright-tmp', 'stage10-evidence', 'stage10-scale-perf-evidence.json');
    await reporter.write(evidencePath);
    console.log(`Stage 10 scale-perf evidence written to ${path.relative(workspaceRoot, evidencePath)}`);
    if (handle !== undefined) {
      await handle.stopServers();
      const cleanup = await handle.cleanup();
      if (!cleanup.ok) {
        console.error(`Stage 10 scale-perf cleanup did not complete cleanly: ${cleanup.reason}`);
        process.exitCode = 1;
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
});
