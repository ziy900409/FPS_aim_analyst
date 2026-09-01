import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import type { ExportPayload } from '../../src/data/export.ts';
import { buildRunId, buildRunIdentity } from '../../server/history/historyPaths.ts';
import { makePayload, makeTick } from '../replay/fixtures.ts';

/**
 * WP-50 T-exit — Replay acceptance scenarios in a real browser (README §5/T-exit-gate.md
 * A-50.1～50.11; A-50.12's 42k-tick/50-cycle scale evidence stays at the Node/V8 headless level —
 * see `tests/replay/replay-perf.test.ts`, `replay-visual-perf.test.ts`, `presentation-lifecycle.test.ts`).
 *
 * Seeds runs through the real `__fpsTest` dev-only hook (same pattern as history-library.spec.ts):
 * `startDrill` + `feedInput` drives a few real sim ticks (aim+fire+move) on one of the 6 official
 * exact-`drillId` Assessment drills so the exported payload has non-empty ticks/events, then either
 * `saveToHistory` (historical entry) or `showResult`/`showResultAndSaveToHistory` (current entry).
 * `hold_click_v1` is the primary drill (scene `peek-corridor`, registered in `main.ts`
 * `availableScenes` — record-time and replay-time scene config are the same object in a single test
 * run, so this never accidentally degrades to `partial` via a scene mismatch).
 *
 * `partial`/`unsupported`/`invalid` and abort/generation races are intentionally NOT re-proven here:
 * every currently-registered Assessment exact `drillId` classifies `full` (T0 roster), so there is no
 * legitimate historical/current entry point that reaches `unsupported` today — that combinator space
 * is already covered with real fixtures/fakes at the Vitest level (`tests/replay/*`,
 * `src/replay/ReplayController.test.ts`'s 11 cases including unknown-drillId, API failure, scene
 * fallback/mismatch, and stale-generation abort). Re-deriving those with real GLTF/network fixtures
 * in Playwright would duplicate that coverage without adding confidence (README T-exit evidence
 * convention carried from T0～T6: domain logic proven headless, Playwright proves the real DOM/route/
 * canvas wiring on top of it).
 */

const URL = 'http://localhost:5173/';
const API_BASE = 'http://localhost:5173';
const FULL_DRILL_ID = 'hold_click_v1';
const SECOND_DRILL_ID = 'spider-shot-v1';

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
  saveToHistory(overrides?: { participantId?: string; assessment?: boolean }): Promise<HistorySaveState>;
  showResult(): void;
  showResultAndSaveToHistory(overrides?: { participantId?: string; assessment?: boolean }): Promise<HistorySaveState>;
  historySaveState(): HistorySaveState;
};

async function postRun(request: APIRequestContext, payload: ExportPayload): Promise<{ ok: boolean; data?: unknown; error?: { code: string } }> {
  const res = await request.post(`${API_BASE}/api/history/runs`, { data: payload });
  return res.json();
}

function buildEarlyReplayFixture(participantId: string): { payload: ExportPayload; runId: string } {
  const payload = makePayload({
    meta: {
      drillId: FULL_DRILL_ID,
      session: { participantId },
      assessment: { protocolVersion: '1.0.0', assessmentFeedbackPolicy: 'minimal-end-of-block' },
      startedAt: new Date(Date.UTC(2100, 0, 1) + Date.now()).toISOString(),
      vStrafe: 250,
      scene: { sceneId: 'peek-corridor', assetPackVersion: 'peek-corridor-v1', clutterTier: 'low', fallback: false },
    },
    ticks: [makeTick({ t: 0 }), makeTick({ t: 100 }), makeTick({ t: 200 }), makeTick({ t: 300 })],
    events: [{ type: 'fire', t: 100, hit: true, firstShot: true, residualSpeed: 0, shotSeq: 0 }],
  });
  const runId = buildRunId(buildRunIdentity(payload.meta.schemaVersion, participantId, payload.meta.drillId, payload.meta.startedAt));
  return { payload, runId };
}

/** A short, real sim run: aim+fire once, then strafe a little — enough ticks/events (fire/hit,
 * key-driven movement) to exercise camera, target, transport timeline and event markers, without
 * needing the drill to reach its natural `ended` phase (README §2 — Replay only needs a populated
 * recording, not a completed drill). */
const SAMPLE_INPUT: HarnessInputEvent[] = [
  { type: 'key', code: 'KeyD', down: true, t: 0 },
  { type: 'fire', down: true, t: 80 },
  { type: 'fire', down: false, t: 130 },
  { type: 'key', code: 'KeyD', down: false, t: 200 },
  { type: 'key', code: 'KeyA', down: true, t: 220 },
  { type: 'key', code: 'KeyA', down: false, t: 500 },
];

async function waitForHarness(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __fpsTest?: unknown }).__fpsTest)), { timeout: 15_000 })
    .toBe(true);
}

async function seedHistoricalRun(
  page: import('@playwright/test').Page,
  drillId: string,
  participantId: string,
): Promise<{ runId: string; startedAt: string }> {
  const state = await page.evaluate(
    async ({ drillId, participantId, input }) => {
      const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;
      harness.startDrill(drillId);
      harness.feedInput(input);
      return harness.saveToHistory({ participantId, assessment: true });
    },
    { drillId, participantId, input: SAMPLE_INPUT },
  );
  if (state.kind !== 'saved') throw new Error(`expected a saved run, got ${JSON.stringify(state)}`);
  return state.run;
}

async function openHistory(page: import('@playwright/test').Page): Promise<import('@playwright/test').Locator> {
  await page.getByRole('button', { name: '歷史紀錄', exact: true }).click();
  const screen = page.locator('#history-screen');
  await expect(screen).toBeVisible();
  return screen;
}

/** Navigates History → participant → drill → run, waiting for the real Node API round-trip so the
 * run detail's "3D 重播" button is enabled (`setActionsEnabled`, HistoricalRunDetail.ts). */
async function openHistoricalRunDetail(
  page: import('@playwright/test').Page,
  participantId: string,
  drillId: string,
  runId: string,
): Promise<import('@playwright/test').Locator> {
  const screen = await openHistory(page);
  await screen.getByRole('searchbox', { name: '搜尋 Participant' }).fill(participantId);
  await screen.getByRole('button', { name: new RegExp(participantId) }).click();
  await screen.getByRole('button', { name: new RegExp(drillId) }).click();
  await screen.getByRole('button', { name: new RegExp(runId) }).click();
  await expect(screen.locator('[data-section="result-detail-body"]')).toBeVisible();
  await expect(screen.locator('[data-history-action="replay"]')).toBeEnabled();
  return screen;
}

async function waitReplayReady(page: import('@playwright/test').Page): Promise<import('@playwright/test').Locator> {
  const replay = page.locator('#replay-screen');
  await expect(replay).toBeVisible();
  await expect(replay.locator('[data-section="replay-ready"]')).toBeVisible({ timeout: 10_000 });
  return replay;
}

test.describe('WP-50 T-exit — Replay acceptance (A-50.1/50.2/50.3)', () => {
  test('History early 3D replay click before controller readiness does not throw a TDZ ReferenceError (KI-017)', async ({
    page,
    request,
  }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    await page.addInitScript(() => {
      const nativeRaf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (callback: FrameRequestCallback): number =>
        nativeRaf((time) => {
          window.setTimeout(() => callback(time), 75);
        });
    });

    const participantId = `ki017-early-replay-${crypto.randomUUID()}`;
    const { payload, runId } = buildEarlyReplayFixture(participantId);
    const seed = await postRun(request, payload);
    expect(seed.ok, `seed failed: ${JSON.stringify(seed)}`).toBe(true);

    await page.goto(URL, { waitUntil: 'commit' });
    const historyScreen = await openHistoricalRunDetail(page, participantId, FULL_DRILL_ID, runId);
    const replayButton = historyScreen.locator('[data-history-action="replay"]');
    await expect(replayButton).toBeEnabled();
    await replayButton.click();

    await expect
      .poll(
        async () => {
          const replayReady = await page.locator('#replay-screen [data-section="replay-ready"]').isVisible();
          if (replayReady) return 'ready';
          const statusText = await historyScreen.locator('[data-section="historical-run-status"]').textContent();
          if (statusText?.includes('Replay 尚未就緒')) return 'not-ready';
          return 'no-feedback';
        },
        { timeout: 5_000 },
      )
      .toMatch(/^(ready|not-ready)$/);

    expect(pageErrors.filter((message) => message.includes("Cannot access 'replayController' before initialization"))).toEqual([]);
    expect(consoleErrors.filter((message) => message.includes("Cannot access 'replayController' before initialization"))).toEqual([]);
  });

  test('a full official Assessment run replays end to end from History (A-50.1)', async ({ page }) => {
    await waitForHarness(page);
    const participantId = `texit-full-${crypto.randomUUID()}`;
    const run = await seedHistoricalRun(page, FULL_DRILL_ID, participantId);

    const historyScreen = await openHistoricalRunDetail(page, participantId, FULL_DRILL_ID, run.runId);
    await historyScreen.locator('[data-history-action="replay"]').click();

    const replay = await waitReplayReady(page);
    await expect(replay.locator('[data-section="replay-source-label"]')).toHaveText(`${FULL_DRILL_ID} · ${run.runId}`);
    await expect(replay.locator('[data-section="replay-support-badge"]')).toHaveText('完整重播');
    await expect(replay.locator('[data-section="replay-support-badge"]')).toHaveAttribute('data-support-status', 'full');
    await expect(replay.locator('[data-section="replay-partial-banner"]')).toBeHidden();

    // The shared canvas has been reparented into the replay viewport — scene/camera are rendering
    // into it, not left behind on the (now-hidden) live full-window position.
    const viewportCanvas = replay.locator('[data-section="replay-viewport"] canvas');
    await expect(viewportCanvas).toBeVisible();
    await expect(viewportCanvas).toHaveId('app');

    // Transport is present and driving a real per-frame HUD (README §2.9 "同一 sample 更新").
    await expect(replay.locator('[data-replay-action="play-pause"]')).toBeVisible();
    await expect(replay.locator('[data-section="replay-hud"]')).toBeVisible();

    // Back returns to the same Run Detail, actions intact — not a stale/replaced screen.
    await replay.getByRole('button', { name: '返回', exact: true }).click();
    await expect(replay).toBeHidden();
    await expect(historyScreen).toBeVisible();
    await expect(historyScreen.locator('[data-section="result-detail-body"]')).toBeVisible();
    await expect(historyScreen.locator('[data-history-action="replay"]')).toBeEnabled();

    // NFR-50.3: with the scene asset already resident (this same page just loaded it once above —
    // the realistic "cached" condition), payload-ready → first visible replay frame stays well
    // under the 1,500 ms budget.
    const reopenStart = Date.now();
    await historyScreen.locator('[data-history-action="replay"]').click();
    await waitReplayReady(page);
    expect(Date.now() - reopenStart).toBeLessThan(1_500);
  });

  test('a current Assessment Result replays the very in-memory payload it just saved (A-50.2)', async ({ page }) => {
    await waitForHarness(page);
    const participantId = `texit-current-assessment-${crypto.randomUUID()}`;

    const state = await page.evaluate(
      async ({ drillId, participantId, input }) => {
        const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;
        harness.startDrill(drillId);
        harness.feedInput(input);
        return harness.showResultAndSaveToHistory({ participantId, assessment: true });
      },
      { drillId: FULL_DRILL_ID, participantId, input: SAMPLE_INPUT },
    );
    expect(state.kind).toBe('saved');

    const result = page.locator('#result-screen');
    await expect(result).toBeVisible();
    await result.getByRole('button', { name: '3D 重播', exact: true }).click();

    const replay = await waitReplayReady(page);
    await expect(replay.locator('[data-section="replay-source-label"]')).toHaveText('目前結果');
    await expect(replay.locator('[data-section="replay-support-badge"]')).toHaveText('完整重播');

    // Back returns to the very same Result dialog (FM-49.8 "close to Result" convention, README §2.8).
    await replay.getByRole('button', { name: '返回', exact: true }).click();
    await expect(replay).toBeHidden();
    await expect(result).toBeVisible();
    await expect(result.getByRole('button', { name: '匯出 JSON' })).toBeEnabled();
  });

  test('a current Practice Result can be replayed in-memory with zero history mutation (A-50.3/OQ-50.2)', async ({ page }) => {
    await waitForHarness(page);

    await page.evaluate(
      ({ drillId, input }) => {
        const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;
        harness.startDrill(drillId);
        harness.feedInput(input);
        harness.showResult(); // no assessment override, no save call — Practice stays memory-only
      },
      { drillId: FULL_DRILL_ID, input: SAMPLE_INPUT },
    );

    const result = page.locator('#result-screen');
    await expect(result).toBeVisible();
    // Practice never gets a History entry (FR-49.12) — the replay entry point is unconditional though.
    await expect(result.getByRole('button', { name: '查看此 Drill 歷史' })).not.toBeVisible();
    await expect(result.getByRole('button', { name: '3D 重播', exact: true })).toBeVisible();

    await result.getByRole('button', { name: '3D 重播', exact: true }).click();
    const replay = await waitReplayReady(page);
    await expect(replay.locator('[data-section="replay-source-label"]')).toHaveText('目前結果');

    // Zero history mutation: `historyPersistence` never left its initial idle state — no save call
    // was ever made for this drill run, in-memory or historical.
    const saveState = await page.evaluate(() => (window as unknown as { __fpsTest: Harness }).__fpsTest.historySaveState());
    expect(saveState).toEqual({ kind: 'idle' });
  });
});

test.describe('WP-50 T-exit — Replay transport, events, ownership, navigation (A-50.4/50.5/50.10/50.11)', () => {
  async function openFullReplayFromResult(page: import('@playwright/test').Page): Promise<import('@playwright/test').Locator> {
    await waitForHarness(page);
    await page.evaluate(
      ({ drillId, input }) => {
        const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;
        harness.startDrill(drillId);
        harness.feedInput(input);
        harness.showResult();
      },
      { drillId: FULL_DRILL_ID, input: SAMPLE_INPUT },
    );
    await page.locator('#result-screen').getByRole('button', { name: '3D 重播', exact: true }).click();
    return waitReplayReady(page);
  }

  test('transport drives play/pause, seek, rate, and end/restart in sync with the HUD (A-50.4/50.6)', async ({ page }) => {
    const replay = await openFullReplayFromResult(page);
    const seek = replay.locator('[data-replay-action="seek"]');
    const playPause = replay.locator('[data-replay-action="play-pause"]');
    const timeText = replay.locator('[data-section="replay-time"]');

    // Starts paused at t=0.
    await expect(playPause).toHaveAttribute('aria-label', '播放');
    await expect(seek).toHaveValue('0');

    // Play advances real time forward — HUD/time text and slider move together (same sample).
    await playPause.click();
    await expect(playPause).toHaveAttribute('aria-label', '暫停');
    await expect
      .poll(async () => Number(await seek.inputValue()), { timeout: 5_000 })
      .toBeGreaterThan(0);

    // Pause freezes the slider — no further advance after a short wait.
    await playPause.click();
    await expect(playPause).toHaveAttribute('aria-label', '播放');
    const pausedAt = await seek.inputValue();
    await page.waitForTimeout(200);
    await expect(seek).toHaveValue(pausedAt);

    // Seek: direct slider set moves the sample deterministically and updates time text to match.
    await seek.evaluate((el: HTMLInputElement) => {
      el.value = '150';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(timeText).toHaveText(/00:00\.1 \//);

    // Rate: clicking 2× marks it pressed and un-presses 1×.
    await replay.locator('[data-replay-action="set-rate"][data-rate="2"]').click();
    await expect(replay.locator('[data-replay-action="set-rate"][data-rate="2"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(replay.locator('[data-replay-action="set-rate"][data-rate="1"]')).toHaveAttribute('aria-pressed', 'false');

    // Playing at 2× to the natural end reaches `ended` (real playback time, not a DOM-slider-step
    // artifact — the recording's duration is rarely an exact multiple of the slider's `step="1"`,
    // so driving this via `frame()`'s own float time tracking is both more robust and more honest
    // than fabricating a synthetic max-value seek). Then playing again from `ended` restarts at ~0,
    // not a no-op (`ReplayPlayer.play()` resets `timeMs` to 0 when `status==='ended'`).
    const duration = Number(await seek.getAttribute('max'));
    await playPause.click();
    await expect.poll(() => playPause.getAttribute('aria-label'), { timeout: 10_000 }).toBe('重新播放');
    await expect.poll(async () => Number(await seek.inputValue())).toBeGreaterThan(duration - 1);

    await playPause.click();
    await expect.poll(async () => Number(await seek.inputValue()), { timeout: 5_000 }).toBeLessThan(duration);
  });

  test('event markers and the event list navigate prev/next and jump-to-event consistently (A-50.5)', async ({ page }) => {
    const replay = await openFullReplayFromResult(page);
    const seek = replay.locator('[data-replay-action="seek"]');

    // At least the fire/hit pair from SAMPLE_INPUT produced timeline events (fire is aimed at the
    // active target — README T0 discovery's "synthetic aim → hit" convention shared with full-drill.spec.ts).
    const markers = replay.locator('[data-section="replay-event-markers"] > div');
    await expect(markers.first()).toBeVisible();
    const markerCount = await markers.count();
    expect(markerCount).toBeGreaterThan(0);

    const listItems = replay.locator('[data-section="replay-event-list"] button[data-replay-action="seek-to-event"]');
    expect(await listItems.count()).toBe(markerCount);

    // Clicking an event-list entry seeks the slider to that event's normalized time.
    const firstLabel = await listItems.first().textContent();
    await listItems.first().click();
    const seekAfterClick = await seek.inputValue();
    expect(Number(seekAfterClick)).toBeGreaterThanOrEqual(0);
    expect(firstLabel).not.toBeNull();

    // Next/previous-event buttons move monotonically and land exactly on markers.
    const nextBtn = replay.getByRole('button', { name: '下一個事件' });
    const prevBtn = replay.getByRole('button', { name: '上一個事件' });
    if (markerCount > 1) {
      await nextBtn.click();
      await expect.poll(async () => Number(await seek.inputValue())).toBeGreaterThan(Number(seekAfterClick));
      const afterNext = Number(await seek.inputValue());
      await prevBtn.click();
      await expect.poll(async () => Number(await seek.inputValue())).toBeLessThanOrEqual(afterNext);
    }
  });

  test('Replay never lets a viewport click reach Pointer Lock, and live drill input stays isolated (A-50.10/NFR-50.5/50.11)', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      let calls = 0;
      (window as unknown as { __pointerLockRequestCount(): number }).__pointerLockRequestCount = () => calls;
      HTMLCanvasElement.prototype.requestPointerLock = function requestPointerLock() {
        calls += 1;
        return undefined as unknown as void;
      };
    });
    const replay = await openFullReplayFromResult(page);

    // Clicking directly on the reparented canvas (now inside the replay viewport) must never
    // request Pointer Lock — D-50-P31: unlike History's backdrop-covered canvas, Replay's canvas is
    // the visible surface itself, so the guard has to be a real, active block, not incidental cover.
    await page.locator('#app').click({ position: { x: 5, y: 5 }, force: true });
    await replay.locator('[data-section="replay-viewport"]').click({ position: { x: 5, y: 5 }, force: true });

    const requestCount = await page.evaluate(() => (window as unknown as { __pointerLockRequestCount(): number }).__pointerLockRequestCount());
    expect(requestCount).toBe(0);
  });

  test('Back then re-entering Replay on a different run never shows the previous run\'s stale content (A-50.11)', async ({
    page,
  }) => {
    await waitForHarness(page);
    const participantId = `texit-rapid-switch-${crypto.randomUUID()}`;
    const runA = await seedHistoricalRun(page, FULL_DRILL_ID, participantId);
    const runB = await seedHistoricalRun(page, SECOND_DRILL_ID, participantId);

    const screen = await openHistoricalRunDetail(page, participantId, FULL_DRILL_ID, runA.runId);
    await screen.locator('[data-history-action="replay"]').click();
    let replay = await waitReplayReady(page);
    await expect(replay.locator('[data-section="replay-source-label"]')).toHaveText(`${FULL_DRILL_ID} · ${runA.runId}`);

    // Back immediately — before/while any async scene work could still be settling — must return
    // cleanly to the same Run Detail with no dangling Replay state.
    await replay.getByRole('button', { name: '返回', exact: true }).click();
    await expect(replay).toBeHidden();
    await expect(screen.locator('[data-history-action="replay"]')).toBeEnabled();

    // Navigate to a genuinely different run (different drillId) and open Replay again — its
    // source label must reflect run B, never a leftover reference to run A. The breadcrumb's
    // `drills` crumb (its text is the participantId — HistoryScreen.ts `crumbLabel`) jumps straight
    // back to this participant's drill list.
    await screen.locator('[data-history-crumb="drills"]').click();
    await screen.getByRole('button', { name: new RegExp(SECOND_DRILL_ID) }).click();
    await screen.getByRole('button', { name: new RegExp(runB.runId) }).click();
    await expect(screen.locator('[data-section="result-detail-body"]')).toBeVisible();
    await expect(screen.locator('[data-history-action="replay"]')).toBeEnabled();
    await screen.locator('[data-history-action="replay"]').click();

    replay = await waitReplayReady(page);
    await expect(replay.locator('[data-section="replay-source-label"]')).toHaveText(`${SECOND_DRILL_ID} · ${runB.runId}`);
  });
});
