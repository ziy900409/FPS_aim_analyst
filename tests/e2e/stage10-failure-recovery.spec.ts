import { promises as fs } from 'node:fs';
import path from 'node:path';
import { test, expect, type APIRequestContext } from '@playwright/test';
import type { ExportPayload } from '../../src/data/export.ts';
import { buildRunId, buildRunIdentity } from '../../server/history/historyPaths.ts';
import { makeAssessmentPayload } from '../history/payloadFixtures.ts';
import { writeOutsideSentinel, verifyOutsideSentinelUnchanged } from '../stage10/Stage10AcceptanceEnvironment.ts';

/**
 * WP-51 T3 — Failure, recovery, and data-safety acceptance (FR-51.9/51.10, T3-failure-recovery-
 * safety.md failure matrix). Runs against the same dev server/root every other `tests/e2e/*.spec.ts`
 * file shares (`.playwright-tmp/history-dev`, playwright.config.ts) — no separate Stage10Runner
 * lifecycle needed for these cases, since none of them require restarting the server mid-test.
 *
 * Scope discipline (README §2.6 "未核准的新產品語意" / T2 precedent for `invalid` Replay): several
 * failure-matrix rows already have real, non-duplicable evidence elsewhere and are deliberately NOT
 * re-derived here —
 *  - traversal/symlink/root-escape: `tests/history/historyRepository.test.ts` ("a symlink/junction
 *    planted at the participant segment is rejected before any write") already proves the on-disk
 *    defense at the Node/repository level; `sanitizeSegmentPrefix`/`buildIdentitySegment`
 *    (`server/history/historyPaths.ts`) hash every segment regardless of content, so no malicious
 *    string can escape. This file's "path-traversal participantId" case below adds one thing that
 *    isn't proven anywhere else — the *whole* real public-API round trip staying contained, with an
 *    explicit outside-sentinel proof — without re-deriving WP-48's unit-level defense.
 *  - scene asset failure/mismatch (loading→error→retry/back): already proven at the DOM level in
 *    `src/ui/replay/ReplayScreen.test.ts` ("error shows the message, a retry action ... and always a
 *    back action").
 *  - rapid navigation (A→B→Back during load, stale-content/generation races): already proven in a
 *    real browser by `tests/e2e/replay.spec.ts` ("Back then re-entering Replay on a different run
 *    never shows the previous run's stale content", WP-50 A-50.11) and `history-navigation.spec.ts`.
 *  - replay ownership race (Pointer Lock isolation while Replay owns the canvas): already proven in
 *    a real browser by `tests/e2e/replay.spec.ts` ("Replay never lets a viewport click reach Pointer
 *    Lock ...").
 * `progress.md` records these citations plus a `--repeat-each=5 --retries=0` rerun of the cited specs
 * as this task's evidence for those rows, instead of duplicating already-proven coverage.
 */

const URL = 'http://localhost:5173/';
const API_BASE = 'http://localhost:5173';

type HistorySaveState =
  | { kind: 'idle' }
  | { kind: 'excluded'; reason: 'practice' }
  | { kind: 'saving'; runKey: string }
  | { kind: 'saved'; run: { runId: string; startedAt: string }; disposition: 'created' | 'existing' }
  | { kind: 'failed'; message: string; retryable: boolean };

type HarnessInputEvent =
  | { type: 'key'; code: string; down: boolean; t: number }
  | { type: 'fire'; down: boolean; t: number }
  | { type: 'ads'; down: boolean; t: number };

type Harness = {
  startDrill(id: string): void;
  feedInput(seq: HarnessInputEvent[]): void;
  showResultAndSaveToHistory(overrides?: { participantId?: string; assessment?: boolean }): Promise<HistorySaveState>;
  retryHistorySave(): Promise<HistorySaveState>;
};

const SAMPLE_INPUT: HarnessInputEvent[] = [
  { type: 'key', code: 'KeyD', down: true, t: 0 },
  { type: 'fire', down: true, t: 80 },
  { type: 'fire', down: false, t: 130 },
  { type: 'key', code: 'KeyD', down: false, t: 200 },
];

async function waitForHarness(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __fpsTest?: unknown }).__fpsTest)), { timeout: 15_000 })
    .toBe(true);
}

async function postRun(
  request: APIRequestContext,
  payload: ExportPayload,
): Promise<{ status: number; body: { ok: true; data: { disposition: string; run: { runId: string } } } | { ok: false; error: { code: string } } }> {
  const res = await request.post(`${API_BASE}/api/history/runs`, { data: payload });
  return { status: res.status(), body: await res.json() };
}

async function getRun(
  request: APIRequestContext,
  runId: string,
): Promise<{ status: number; body: { ok: true; data: ExportPayload } | { ok: false; error: { code: string } } }> {
  const res = await request.get(`${API_BASE}/api/history/runs/${encodeURIComponent(runId)}`);
  return { status: res.status(), body: await res.json() };
}

test.describe('WP-51 T3 — Failure, recovery, and data safety (public API)', () => {
  test('a duplicate same-content save is idempotent; a same-identity different-content save is a 409 conflict and the original is unchanged (FR-51.9)', async ({
    request,
  }) => {
    const participantId = `stage10-t3-dup-${crypto.randomUUID()}`;
    const payload = makeAssessmentPayload({ participantId, drillId: 'hold_click_v1', startedAt: '2026-08-31T09:00:00.000Z' });
    const runId = buildRunId(buildRunIdentity(payload.meta.schemaVersion, participantId, payload.meta.drillId, payload.meta.startedAt));

    const first = await postRun(request, payload);
    expect(first.status).toBe(201);
    if (!first.body.ok) throw new Error('unreachable');
    expect(first.body.data.disposition).toBe('created');
    expect(first.body.data.run.runId).toBe(runId);

    const second = await postRun(request, payload);
    expect(second.status).toBe(200);
    if (!second.body.ok) throw new Error('unreachable');
    expect(second.body.data.disposition).toBe('existing');
    expect(second.body.data.run.runId).toBe(runId);

    // Same identity (participant/drill/startedAt), different content (`suspect` flipped) — must be
    // rejected as a conflict, never silently overwrite the original.
    const conflicting: ExportPayload = { ...payload, meta: { ...payload.meta, suspect: true } };
    const third = await postRun(request, conflicting);
    expect(third.status).toBe(409);
    if (third.body.ok) throw new Error('unreachable');
    expect(third.body.error.code).toBe('RUN_CONFLICT');

    const loaded = await getRun(request, runId);
    expect(loaded.status).toBe(200);
    if (!loaded.body.ok) throw new Error('unreachable');
    expect(loaded.body.data.meta.suspect).toBe(false);
  });

  test('a well-formed but unknown runId under a real participant/drill shows a stable, non-retryable not-found state, and Back stays usable (FR-51.9/51.10)', async ({
    page,
    request,
  }) => {
    const participantId = `stage10-t3-notfound-${crypto.randomUUID()}`;
    const drillId = 'hold_click_v1';
    const payload = makeAssessmentPayload({ participantId, drillId, startedAt: '2026-08-31T09:05:00.000Z' });
    const seed = await postRun(request, payload);
    expect(seed.status).toBe(201);

    const fakeRunId = 'f'.repeat(64); // well-formed sha256-length hex, never saved
    await page.goto(`${URL}#/history/participants/${encodeURIComponent(participantId)}/drills/${drillId}/runs/${fakeRunId}`, {
      waitUntil: 'networkidle',
    });

    const screen = page.locator('#history-screen');
    await expect(screen).toBeVisible();
    const status = screen.locator('[data-section="historical-run-status"]');
    await expect(status).toHaveAttribute('data-history-status', 'error');
    await expect(status).toContainText('讀取失敗');
    await expect(status.getByRole('button', { name: '重試' })).toHaveCount(0);

    await screen.locator('[data-history-action="back"]').click();
    await expect(screen.locator('[data-section="drill-overview"]')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.location.hash)).not.toContain('/runs/');
  });

  test('a participantId containing path-traversal characters stays contained through the real public API, and the real history root is untouched (FR-51.9, NFR-51.3)', async ({
    request,
  }) => {
    const workspaceRoot = process.cwd();
    const realHistoryRoot = path.join(workspaceRoot, 'data', 'session-history');
    const sentinelPath = path.join(workspaceRoot, '.playwright-tmp', `stage10-t3-sentinel-${crypto.randomUUID()}.json`);
    await writeOutsideSentinel(sentinelPath, realHistoryRoot);

    try {
      const maliciousParticipantId = `../../../../etc/passwd-${crypto.randomUUID()}`;
      const payload = makeAssessmentPayload({
        participantId: maliciousParticipantId,
        drillId: 'hold_click_v1',
        startedAt: '2026-08-31T09:10:00.000Z',
      });
      const runId = buildRunId(
        buildRunIdentity(payload.meta.schemaVersion, maliciousParticipantId, payload.meta.drillId, payload.meta.startedAt),
      );

      const result = await postRun(request, payload);
      expect(result.status).toBe(201);
      if (!result.body.ok) throw new Error('unreachable');
      expect(result.body.data.run.runId).toBe(runId);

      const loaded = await getRun(request, runId);
      expect(loaded.status).toBe(200);
      if (!loaded.body.ok) throw new Error('unreachable');
      expect(loaded.body.data.meta.session?.participantId).toBe(maliciousParticipantId);

      const check = await verifyOutsideSentinelUnchanged(sentinelPath);
      expect(check.ok, check.reason).toBe(true);
    } finally {
      await fs.rm(sentinelPath, { force: true });
    }
  });
});

test.describe('WP-51 T3 — Failure, recovery, and data safety (network faults)', () => {
  test('the History API becoming unreachable shows a retryable error in the History UI, not a crash, and Retry recovers once it comes back (API unavailable, FR-51.9)', async ({
    page,
    request,
  }) => {
    const participantId = `stage10-t3-apidown-${crypto.randomUUID()}`;
    const drillId = 'hold_click_v1';
    const seeded = await postRun(
      request,
      makeAssessmentPayload({ participantId, drillId, startedAt: '2026-08-31T09:15:00.000Z' }),
    );
    expect(seeded.status).toBe(201);

    let blocked = true;
    await page.route('**/api/history/**', (route) => (blocked ? route.abort('connectionrefused') : route.continue()));

    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '歷史紀錄', exact: true }).click();
    const screen = page.locator('#history-screen');
    await expect(screen).toBeVisible();

    const status = screen.locator('[data-section="participant-status"]');
    await expect(status).toContainText('讀取失敗');
    const retryButton = status.getByRole('button', { name: '重試' });
    await expect(retryButton).toBeVisible();

    blocked = false;
    await retryButton.click();
    await expect(status).not.toContainText('讀取失敗');
    await screen.getByRole('searchbox', { name: '搜尋 Participant' }).fill(participantId);
    await expect(screen.getByRole('button', { name: new RegExp(participantId) })).toBeVisible();
  });

  test('a live Assessment save that fails while the API is unreachable stays retryable and the current Result stays usable; a successful retry creates exactly one run (save failure, FR-51.9)', async ({
    page,
    request,
  }) => {
    await waitForHarness(page);
    const participantId = `stage10-t3-saveretry-${crypto.randomUUID()}`;
    const drillId = 'hold_click_v1';

    let blocked = true;
    await page.route('**/api/history/runs', (route) => {
      if (blocked && route.request().method() === 'POST') return route.abort('connectionrefused');
      return route.continue();
    });

    const failedState = await page.evaluate(
      async ({ drillId, participantId, input }) => {
        const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;
        harness.startDrill(drillId);
        harness.feedInput(input);
        return harness.showResultAndSaveToHistory({ participantId, assessment: true });
      },
      { drillId, participantId, input: SAMPLE_INPUT },
    );
    expect(failedState.kind).toBe('failed');
    if (failedState.kind !== 'failed') throw new Error('unreachable');
    expect(failedState.retryable).toBe(true);

    const resultScreen = page.locator('#result-screen');
    await expect(resultScreen).toBeVisible();
    await expect(resultScreen.locator('[data-result-action="export-json"]')).toBeEnabled();
    await expect(resultScreen.locator('[data-section="history-save-status"]')).toContainText('Save to history failed');

    blocked = false;
    const retried = await page.evaluate(() => (window as unknown as { __fpsTest: Harness }).__fpsTest.retryHistorySave());
    expect(retried.kind).toBe('saved');
    if (retried.kind !== 'saved') throw new Error('unreachable');
    expect(retried.disposition).toBe('created');

    const runsResponse = await request.get(
      `${API_BASE}/api/history/participants/${encodeURIComponent(participantId)}/drills/${encodeURIComponent(drillId)}/runs`,
    );
    const runsBody = (await runsResponse.json()) as { data: readonly unknown[] };
    expect(runsBody.data).toHaveLength(1);
  });
});
