import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import type { ExportPayload } from '../../src/data/export.ts';
import { buildRunId, buildRunIdentity } from '../../server/history/historyPaths.ts';
import { makePayload, makeTick } from '../replay/fixtures.ts';

/**
 * WP-51 T4 — keyboard-only History→Replay journey and automated accessibility gates
 * (FR-51.13/NFR-51.6, T4-scale-lifecycle-a11y.md Work items 5/6). No existing spec drives this
 * journey with real keyboard events end to end; `history-navigation.spec.ts`/`replay.spec.ts` all
 * use `.click()`. This file seeds a `full`-classified run with real timeline events (fire/hit) through
 * the public `POST /api/history/runs` API — same pattern as `stage10-preview.spec.ts` — then drives
 * launch→History→Participant→drill→run→Replay controls/events→Back using only `.focus()` +
 * `page.keyboard.press()`, never `.click()`. `.focus()` moves the DOM focus the same way a real Tab
 * traversal would land on a natively-focusable control (button/input) in that DOM position — this
 * file additionally proves two genuine Tab-order segments (History's `main` region → the top
 * Participant row, and Replay's `main` region → seek slider) rather than only ever jumping focus
 * programmatically, so the keyboard path is not merely "these elements are focusable in isolation"
 * but "Tab actually reaches them in this order".
 *
 * Two real upstream defects were found and root-caused while building this spec (both logged, not
 * patched here — WP-51 may only fix its own harness, never WP-49/WP-50 domain UI, README §2.6):
 *
 * - KI-018 (`docs/known_issue/KI-018-history-search-keystroke-focus-steal.md`, WP-49): typing more
 *   than one real character into "搜尋 Participant" loses every keystroke after the first, because
 *   `HistoryScreen.render()`'s focus-on-navigation guard (`route !== lastRoute`, reference equality)
 *   cannot tell a same-route `navigator.replace()` (search-as-you-type) apart from a real navigation,
 *   and steals focus back to `<main>` after every keystroke. This spec avoids exercising that broken
 *   control at all — the fixture's `startedAt` is set far in the future so it always sorts to the very
 *   top of the (unfiltered, un-searched) Participant list, and Tab reaches it directly.
 * - KI-017 (`docs/known_issue/KI-017-history-replay-tdz-referenceerror-on-early-replay-click.md`,
 *   WP-50): clicking/activating "3D 重播" before `main.ts`'s `replayController` (a top-level `const`
 *   assigned only near the end of the module, after an async initialization gap) has finished
 *   initializing throws an uncaught `ReferenceError` and silently no-ops the button — same class of
 *   bug as the already-fixed KI-013 (`controls`), just a different variable. Every existing dev-mode
 *   spec avoids this by coincidence: they all wait for the dev-only `window.__fpsTest` hook to appear,
 *   which happens to be set at the very end of the same module, after `replayController` is safe. This
 *   spec adopts that same wait (`waitForHarnessReady`) for the same reason, matching established
 *   convention elsewhere in this suite — it sidesteps the race in this test without hiding the finding.
 */

const URL = 'http://localhost:5173/';
const DRILL_ID = 'hold_click_v1';
// Deliberately far in the future (KI-018 workaround, see file header): `listParticipants` sorts
// descending by `latestStartedAt`, so this fixture is always the very first row in the unfiltered
// list regardless of how many other synthetic participants this shared dev root has accumulated —
// no search-box typing needed to find it. Keep this later than the other Stage10 E2E future fixtures
// (`stage10-projection-shape` uses 2099-02 and `stage10-lifecycle-scale` uses fixed 2099-06 dates).
// A *fixed* future literal would still tie with every past run of this same spec against this same
// never-reset shared root (`listParticipants` tie-breaks by `participantId` ascending, silently
// pushing this run's row down past a fixed Tab-press budget as the shared root accumulates
// identical-timestamp rows) — folding in the real current time keeps every invocation's `startedAt`
// strictly greater than all previous ones.
function fixtureStartedAt(): string {
  return new Date(Date.UTC(2100, 0, 1) + Date.now()).toISOString();
}

async function postRun(request: APIRequestContext, payload: ExportPayload): Promise<{ ok: boolean; data?: unknown; error?: { code: string } }> {
  const res = await request.post('http://localhost:5173/api/history/runs', { data: payload });
  return res.json();
}

async function activeElementDataset(page: Page, key: string): Promise<string | undefined> {
  return page.evaluate((k) => (document.activeElement as HTMLElement | null)?.dataset[k], key);
}

/** Matches every other dev-mode Stage10/WP-49/WP-50 spec's own convention (see file header, KI-017):
 * waiting for the dev-only completion harness to appear also happens to guarantee `main.ts`'s
 * `replayController` has finished initializing, since both are set at the very end of the same
 * module evaluation. */
async function waitForHarnessReady(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __fpsTest?: unknown }).__fpsTest)), { timeout: 15_000 })
    .toBe(true);
}

function buildFixture(participantId: string): { payload: ExportPayload; runId: string } {
  const payload = makePayload({
    meta: {
      drillId: DRILL_ID,
      session: { participantId },
      assessment: { protocolVersion: '1.0.0', assessmentFeedbackPolicy: 'minimal-end-of-block' },
      startedAt: fixtureStartedAt(),
      vStrafe: 250,
      // `makeMeta()`'s own default scene (`assetPackVersion: '1'`) does not match the real
      // `peek-corridor` scene actually registered in `main.ts` (`peek-corridor-v1`,
      // src/scene/scenes/peek-corridor.ts) — left at the default, `resolveSessionScene` correctly
      // detects a `SCENE_ASSET_VERSION_MISMATCH` and degrades to `partial`. This fixture wants a
      // `full` classification, so it must match the real installed scene's version exactly.
      scene: { sceneId: 'peek-corridor', assetPackVersion: 'peek-corridor-v1', clutterTier: 'low', fallback: false },
    },
    ticks: [makeTick({ t: 0 }), makeTick({ t: 100 }), makeTick({ t: 200 }), makeTick({ t: 300 }), makeTick({ t: 400 })],
    events: [
      { type: 'fire', t: 100, hit: true, firstShot: true, residualSpeed: 0, shotSeq: 0 },
      { type: 'hit', t: 100, timeOfFlightMs: 5, shotSeq: 0 },
      { type: 'fire', t: 300, hit: false, firstShot: false, residualSpeed: 0, shotSeq: 1 },
    ],
  });
  const runId = buildRunId(buildRunIdentity(payload.meta.schemaVersion, participantId, payload.meta.drillId, payload.meta.startedAt));
  return { payload, runId };
}

/** Polls Tab presses forward until the focused element is a `<button>` whose text matches `needle`
 * — used instead of a fixed press count because `<input type="search">`'s built-in shadow-DOM
 * cancel affordance can absorb a Tab in Chromium without moving `document.activeElement` off the
 * host input. Deliberately checks `tagName === 'BUTTON'`, not just `textContent.includes(needle)`:
 * `<main>` itself (the tabindex=-1 host `HistoryScreen`/`ReplayScreen` focus on navigation) has a
 * `textContent` that recursively concatenates every descendant's text — including any row already
 * rendered underneath it — so a substring-only check would false-positive on `<main>` itself before
 * a single Tab is ever pressed. */
async function tabUntilButton(page: Page, needle: string, maxPresses = 12): Promise<void> {
  async function onTarget(): Promise<boolean> {
    const el = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      return { tag: active?.tagName, text: active?.textContent ?? '' };
    });
    return el.tag === 'BUTTON' && el.text.includes(needle);
  }
  for (let i = 0; i < maxPresses; i++) {
    if (await onTarget()) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`tabUntilButton: no focused <button> containing ${JSON.stringify(needle)} within the press budget`);
}

test.describe('WP-51 T4 — keyboard-only History -> Replay journey (FR-51.13/NFR-51.6)', () => {
  test('launch -> History -> Participant -> drill -> run -> Replay controls/events -> Back is completable with only Tab/Enter/Space/Arrow keys', async ({
    page,
    request,
  }) => {
    const participantId = `stage10-a11y-${crypto.randomUUID()}`;
    const { payload, runId } = buildFixture(participantId);
    const seed = await postRun(request, payload);
    expect(seed.ok, `seed failed: ${JSON.stringify(seed)}`).toBe(true);

    await page.goto(URL, { waitUntil: 'networkidle' });
    await waitForHarnessReady(page); // KI-017 workaround — see file header.

    // ---- 1. launch -> History --------------------------------------------------------------
    const historyButton = page.getByRole('button', { name: '歷史紀錄', exact: true });
    await historyButton.focus();
    await page.keyboard.press('Enter');

    const history = page.locator('#history-screen');
    await expect(history).toBeVisible();
    await expect(history).toHaveAttribute('role', 'dialog');
    await expect(history).toHaveAttribute('aria-label', '歷史紀錄');
    // HistoryScreen's own focus-on-navigation contract: entering a new route moves focus into the
    // shell's <main> region, not left behind on the (now covered) launch button.
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('MAIN');
    await expect.poll(() => page.evaluate(() => document.activeElement?.closest('#history-screen') !== null)).toBe(true);

    // ---- 2. Participant select (genuine Tab-order proof; no search typing — KI-018) ---------
    const participantRow = history.getByRole('button', { name: new RegExp(participantId) });
    await expect(participantRow).toBeVisible();

    // Tab order from the just-focused <main>: search box -> (清除搜尋 is display:none while the
    // query is empty, so it's skipped) -> the first participant row, which is this fixture
    // (fixtureStartedAt() sorts it to the top — see file header).
    await tabUntilButton(page, participantId);
    await page.keyboard.press('Enter');

    // ---- 3. drill select ---------------------------------------------------------------------
    const drillButton = history.getByRole('button', { name: new RegExp(DRILL_ID) });
    await drillButton.press('Enter');

    // ---- 4. run select -----------------------------------------------------------------------
    const runButton = history.getByRole('button', { name: new RegExp(runId) });
    await runButton.press('Enter');
    await expect(history.locator('[data-section="result-detail-body"]')).toBeVisible({ timeout: 10_000 });

    // ---- 5. Replay (keyboard) ----------------------------------------------------------------
    const replayButton = history.locator('[data-history-action="replay"]');
    await expect(replayButton).toBeEnabled();
    await replayButton.press('Enter');

    const replay = page.locator('#replay-screen');
    await expect(replay).toBeVisible();
    await expect(replay).toHaveAttribute('role', 'dialog');
    await expect(replay.locator('[data-section="replay-ready"]')).toBeVisible({ timeout: 10_000 });
    await expect(replay.locator('[data-section="replay-support-badge"]')).toHaveAttribute('data-support-status', 'full');
    // Opening Replay moves focus into it (ReplayScreen's focus-on-state-change contract).
    await expect.poll(() => page.evaluate(() => document.activeElement?.closest('#replay-screen') !== null)).toBe(true);

    // ---- 6. transport keyboard interactions --------------------------------------------------
    // Genuine Tab-order proof #2: from the just-focused main region, the very next Tab stop is the
    // seek slider (readyPanel's first focusable descendant in DOM order).
    await page.keyboard.press('Tab');
    await expect.poll(() => activeElementDataset(page, 'replayAction')).toBe('seek');
    const seek = replay.locator('[data-replay-action="seek"]');
    await expect(seek).toHaveAttribute('aria-label', '播放進度');

    // ArrowRight nudges by `step="1"` (1ms) — real, but too fine to show up in `aria-valuetext`'s
    // tenths-of-a-second display over this short fixture's ~400ms duration, so assert the precise
    // underlying value instead.
    const valueBefore = Number(await seek.inputValue());
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => Number(await seek.inputValue())).toBeGreaterThan(valueBefore);

    // Keep nudging with ArrowRight (never `End` — jumping to the exact max flips `ReplayPlayer`
    // into its real `ended` status, which would also flip the play/pause button's label the next
    // step below relies on) until the value crosses a tenths-of-a-second boundary, so this also
    // verifies `aria-valuetext`'s live announcement actually updates, not just the raw value.
    const valueTextBefore = await seek.getAttribute('aria-valuetext');
    for (let i = 0; i < 150 && (await seek.getAttribute('aria-valuetext')) === valueTextBefore; i++) {
      await page.keyboard.press('ArrowRight');
    }
    await expect.poll(async () => seek.getAttribute('aria-valuetext')).not.toBe(valueTextBefore);

    // Play/pause: a native <button>, so Enter and Space both activate it exactly like a click would.
    const playPause = replay.locator('[data-replay-action="play-pause"]');
    await playPause.focus();
    await expect(playPause).toHaveAttribute('aria-label', '播放');
    await page.keyboard.press('Enter');
    await expect(playPause).toHaveAttribute('aria-label', '暫停');
    await page.keyboard.press(' ');
    await expect(playPause).toHaveAttribute('aria-label', '播放');

    // Rate group: role="group" with a labelled set of aria-pressed toggle buttons.
    const rateGroup = replay.locator('[data-section="replay-rate-group"]');
    await expect(rateGroup).toHaveAttribute('role', 'group');
    await expect(rateGroup).toHaveAttribute('aria-label', '播放速度');
    const rate2Button = replay.locator('[data-replay-action="set-rate"][data-rate="2"]');
    await rate2Button.focus();
    await page.keyboard.press('Enter');
    await expect(rate2Button).toHaveAttribute('aria-pressed', 'true');
    await expect(replay.locator('[data-replay-action="set-rate"][data-rate="1"]')).toHaveAttribute('aria-pressed', 'false');

    // Event list: reachable via keyboard, activating an item seeks to its normalized time.
    const eventList = replay.locator('[data-section="replay-event-list"]');
    await expect(eventList).toHaveAttribute('aria-label', '事件列表');
    const firstEventButton = eventList.locator('button[data-replay-action="seek-to-event"]').first();
    await expect(firstEventButton).toBeVisible();
    await firstEventButton.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => seek.getAttribute('aria-valuetext')).toContain('00:00.1');

    // ---- 7. Back (keyboard) -------------------------------------------------------------------
    const backButton = replay.getByRole('button', { name: '返回', exact: true });
    await backButton.focus();
    await page.keyboard.press('Enter');
    await expect(replay).toBeHidden();
    await expect(history.locator('[data-history-action="replay"]')).toBeEnabled();
  });
});
