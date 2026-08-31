import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import type { ExportPayload } from '../../src/data/export.ts';
import { buildRunId, buildRunIdentity } from '../../server/history/historyPaths.ts';
import { makePayload, makeTick } from '../replay/fixtures.ts';

/**
 * WP-51 T4 — real-browser resource-lifecycle and abort-timing gates (FR-51.12/13, NFR-51.4,
 * T4-scale-lifecycle-a11y.md Work item 4). `tests/replay/presentation-lifecycle.test.ts` (WP-50 T3)
 * already proves the 50x enter/leave contract at the Vitest level against a mocked renderer/DOM; this
 * file proves the same invariant survives a *real* browser + real `ReplayScreen`/`ReplayController`
 * wiring: exactly one `<canvas>` persists across the whole run (no duplicate/leaked surface), the net
 * count of `window`/`document` listeners returns to baseline after every cycle (no accumulating leak
 * from `ReplayScreen.show()/hide()`'s own `keydown`/`visibilitychange` listeners or
 * `mountReplayViewport()`'s `resize` listener), the total live DOM node count returns to baseline (no
 * detached-but-still-attached-elsewhere subtree survives teardown), and no `rAF` callback is ever left
 * pending once Replay is closed.
 *
 * Listener counting is deliberately scoped to `window`/`document` only, not every `EventTarget` —
 * `ReplayTransport`'s own per-render buttons/inputs are legitimately destroyed and recreated on every
 * `ReplayScreen.render()` call (its own doc comment: "Always rebuild the transport from scratch on
 * every render() call"), and `.remove()`-ing a whole subtree never fires `removeEventListener` on its
 * descendants (the browser instead garbage-collects the listeners along with the now-unreachable
 * nodes) — counting those as "growth" would be a false positive for a correctly-implemented
 * tear-and-rebuild pattern. `window`/`document` are the only targets that outlive every cycle, so
 * their listener count is the real signal for an actual accumulating leak; the DOM node count check
 * below independently catches the "detached subtree never actually GC'd/removed" failure mode that a
 * pure listener count could still miss. The counters are collected by a page-local `addInitScript()`
 * monkey-patch of `EventTarget`/`requestAnimationFrame` — test-owned instrumentation only, no
 * production source touched (README §2.6 "WP-51只可修acceptance harness、composition wiring").
 */

const URL = 'http://localhost:5173/';
const DRILL_ID = 'hold_click_v1';

interface Stage10Counters {
  readonly rafPending: number;
  /** Net `addEventListener`-minus-`removeEventListener` calls on `window`/`document` only — see file
   * header for why every other `EventTarget` is deliberately excluded. */
  readonly persistentListenerNet: number;
  readonly canvases: number;
  readonly domNodeCount: number;
}

async function installLifecycleInstrumentation(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const pendingRafIds = new Set<number>();
    const originalRaf = window.requestAnimationFrame.bind(window);
    const originalCaf = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = ((callback: FrameRequestCallback): number => {
      const id = originalRaf((time) => {
        pendingRafIds.delete(id);
        callback(time);
      });
      pendingRafIds.add(id);
      return id;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((id: number): void => {
      pendingRafIds.delete(id);
      originalCaf(id);
    }) as typeof window.cancelAnimationFrame;

    let persistentListenerNet = 0;
    const persistentTargets: readonly EventTarget[] = [window, document];
    const originalAdd = EventTarget.prototype.addEventListener;
    const originalRemove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function addEventListenerSpy(
      this: EventTarget,
      ...args: Parameters<typeof originalAdd>
    ): void {
      if ((persistentTargets as unknown[]).includes(this)) persistentListenerNet += 1;
      return originalAdd.apply(this, args);
    };
    EventTarget.prototype.removeEventListener = function removeEventListenerSpy(
      this: EventTarget,
      ...args: Parameters<typeof originalRemove>
    ): void {
      if ((persistentTargets as unknown[]).includes(this)) persistentListenerNet -= 1;
      return originalRemove.apply(this, args);
    };

    (window as unknown as { __stage10LifecycleCounters(): Stage10CountersBrowser }).__stage10LifecycleCounters = () => ({
      rafPending: pendingRafIds.size,
      persistentListenerNet,
      canvases: document.querySelectorAll('canvas').length,
      domNodeCount: document.querySelectorAll('*').length,
    });
  });
}

interface Stage10CountersBrowser {
  readonly rafPending: number;
  readonly persistentListenerNet: number;
  readonly canvases: number;
  readonly domNodeCount: number;
}

async function readCounters(page: Page): Promise<Stage10Counters> {
  return page.evaluate(() => (window as unknown as { __stage10LifecycleCounters(): Stage10Counters }).__stage10LifecycleCounters());
}

async function postRun(request: APIRequestContext, payload: ExportPayload): Promise<{ ok: boolean; error?: { code: string } }> {
  const res = await request.post('http://localhost:5173/api/history/runs', { data: payload });
  return res.json();
}

async function waitForHarnessReady(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __fpsTest?: unknown }).__fpsTest)), { timeout: 15_000 })
    .toBe(true);
}

function buildFixture(participantId: string, startedAt: string): { payload: ExportPayload; runId: string } {
  const payload = makePayload({
    meta: {
      drillId: DRILL_ID,
      session: { participantId },
      assessment: { protocolVersion: '1.0.0', assessmentFeedbackPolicy: 'minimal-end-of-block' },
      startedAt,
      vStrafe: 250,
    },
    ticks: [makeTick({ t: 0 }), makeTick({ t: 100 }), makeTick({ t: 200 })],
    events: [{ type: 'fire', t: 100, hit: true, firstShot: true, residualSpeed: 0, shotSeq: 0 }],
  });
  const runId = buildRunId(buildRunIdentity(payload.meta.schemaVersion, participantId, payload.meta.drillId, payload.meta.startedAt));
  return { payload, runId };
}

/** Navigates straight to the Run Detail via the real public UI (search box `.fill()` — this file
 * isn't proving keyboard-only operability, `stage10-accessibility.spec.ts` already does that; here a
 * single, fast, reliable route to Run Detail matters more so the 50-cycle budget is spent on the
 * enter/leave cycles themselves, not on 50x full re-navigations). */
async function openRunDetail(page: Page, participantId: string, drillId: string, runId: string): Promise<import('@playwright/test').Locator> {
  await page.getByRole('button', { name: '歷史紀錄', exact: true }).click();
  const screen = page.locator('#history-screen');
  await expect(screen).toBeVisible();
  await screen.getByRole('searchbox', { name: '搜尋 Participant' }).fill(participantId);
  await screen.getByRole('button', { name: new RegExp(participantId) }).click();
  await screen.getByRole('button', { name: new RegExp(drillId) }).click();
  await screen.getByRole('button', { name: new RegExp(runId) }).click();
  await expect(screen.locator('[data-section="result-detail-body"]')).toBeVisible();
  await expect(screen.locator('[data-history-action="replay"]')).toBeEnabled();
  return screen;
}

test.describe('WP-51 T4 — real-browser resource lifecycle (FR-51.12/NFR-51.4)', () => {
  test('50x History -> Replay -> Back cycles leave zero growth in listeners/rAF, and exactly one canvas persists', async ({ page, request }) => {
    await installLifecycleInstrumentation(page);
    const participantId = `stage10-lifecycle-${crypto.randomUUID()}`;
    const { payload, runId } = buildFixture(participantId, '2099-06-01T00:00:00.000Z');
    const seed = await postRun(request, payload);
    expect(seed.ok, `seed failed: ${JSON.stringify(seed)}`).toBe(true);

    await page.goto(URL, { waitUntil: 'networkidle' });
    await waitForHarnessReady(page); // KI-017 workaround (see stage10-accessibility.spec.ts header).
    const screen = await openRunDetail(page, participantId, DRILL_ID, runId);

    const replayButton = screen.locator('[data-history-action="replay"]');
    const replay = page.locator('#replay-screen');
    const backButton = replay.getByRole('button', { name: '返回', exact: true });

    // One full cycle before taking the baseline: the very first `enterReplay()` mounts the shared
    // canvas into the replay viewport for the first time (a one-time reparent, not a per-cycle
    // allocation) — comparing cycles 2..50 against a post-first-cycle baseline isolates the thing
    // this gate actually cares about (steady-state growth), not the expected one-time setup cost.
    await replayButton.click();
    await expect(replay.locator('[data-section="replay-ready"]')).toBeVisible({ timeout: 10_000 });
    await backButton.click();
    await expect(replay).toBeHidden();

    const baseline = await readCounters(page);
    expect(baseline.canvases).toBe(1);

    const CYCLES = 50;
    for (let i = 0; i < CYCLES; i++) {
      await replayButton.click();
      await expect(replay.locator('[data-section="replay-ready"]')).toBeVisible({ timeout: 10_000 });
      await expect(replay.locator('[data-section="replay-viewport"] canvas')).toHaveId('app');
      await backButton.click();
      await expect(replay).toBeHidden();
    }

    const after = await readCounters(page);
    expect(after.canvases, 'no duplicate/leaked <canvas> after 50 enter/leave cycles').toBe(1);
    expect(after.rafPending, 'no rAF callback left pending once Replay is closed').toBe(baseline.rafPending);
    expect(
      after.persistentListenerNet,
      'net window/document listener count must not grow across 50 cycles',
    ).toBe(baseline.persistentListenerNet);
    // Every per-render transport DOM node (buttons/inputs rebuilt on each ReplayScreen.render()) must
    // actually be gone, not merely detached-and-forgotten — total live node count returns to baseline.
    expect(after.domNodeCount, 'total live DOM node count must not grow across 50 cycles').toBe(baseline.domNodeCount);

    // The single shared canvas is restored to its live (full-window) position, not left parented
    // inside the now-hidden replay viewport — a real DOM-position proof, not just a counter.
    // `unmountReplayViewport()` (main.ts) restores it with `document.body.prepend(canvas)`.
    const canvasParentTag = await page.evaluate(() => document.querySelector('canvas')?.parentElement?.tagName);
    expect(canvasParentTag).toBe('BODY');
  });

  test('aborting a slow historical Replay load via Back settles within 100ms, not waiting for the in-flight load (NFR-51.4)', async ({
    page,
    request,
  }) => {
    const participantId = `stage10-abort-${crypto.randomUUID()}`;
    const { payload, runId } = buildFixture(participantId, '2099-06-02T00:00:00.000Z');
    const seed = await postRun(request, payload);
    expect(seed.ok, `seed failed: ${JSON.stringify(seed)}`).toBe(true);

    await page.goto(URL, { waitUntil: 'networkidle' });
    await waitForHarnessReady(page);
    const screen = await openRunDetail(page, participantId, DRILL_ID, runId);

    // Delay the historical run's own payload fetch (not the earlier list/detail navigation, which
    // must stay untouched) so there is a reliable window where the Replay screen is visibly
    // 'loading' and a Back/cancel click genuinely races an in-flight `historyClient.loadRun`.
    await page.route(`**/api/history/runs/${runId}`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.continue();
    });

    const replay = page.locator('#replay-screen');
    await screen.locator('[data-history-action="replay"]').click();
    await expect(replay).toBeVisible();
    await expect(replay.locator('[data-section="replay-loading"]')).toBeVisible();

    // Measured entirely inside the page via `performance.now()` bracketing a synthetic `.click()` —
    // `ReplayController.close()` (`resetForNewRequest()` + `setState({kind:'idle'})`) and
    // `ReplayScreen.hide()` are all synchronous, so the actual commit is a single JS call stack with
    // no `await` in it; a `Date.now()`-around-a-Playwright-action measurement (the first attempt
    // here) instead mostly captures Playwright's own IPC/action + assertion-polling overhead, which
    // has nothing to do with how fast the app itself commits the abort — this measures the thing
    // NFR-51.4 actually cares about, not the test harness's round-trip cost.
    const result = await page.evaluate(() => {
      const button = document.querySelector<HTMLButtonElement>('[data-replay-action="cancel-load"]')!;
      const root = document.querySelector<HTMLElement>('#replay-screen')!;
      const t0 = performance.now();
      button.click();
      const t1 = performance.now();
      return { elapsedMs: t1 - t0, hiddenImmediately: root.style.display === 'none' };
    });
    expect(result.hiddenImmediately, 'Replay must already be hidden by the end of the synchronous click handler').toBe(true);
    expect(result.elapsedMs, `abort commit took ${result.elapsedMs}ms in-page, budget is 100ms`).toBeLessThan(100);
    await expect(replay).toBeHidden();

    // The stale, still-in-flight load (which resolves ~600ms after cancel) must never commit a
    // late 'ready' state once it eventually completes.
    await page.waitForTimeout(700);
    await expect(replay).toBeHidden();
    await expect(screen.locator('[data-history-action="replay"]')).toBeEnabled();
  });
});
