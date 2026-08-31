import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * WP-51 T2 — Dev canonical Assessment journey (FR-51.3/51.5). `history-library.spec.ts` (WP-49) and
 * `replay.spec.ts` (WP-50) already prove completion→autosave→History→exact-drill browsing and
 * History/current→Replay→Back end to end on dev; this file's genuinely new contribution is the one
 * assertion neither of them makes: that the live current-Result and the historical Run Detail for
 * the *same* saved run render identical metric cards (`ResultDetailBody.ts`'s own header claims this
 * "current/historical presentation parity" by construction, D-49.P4 — this proves it holds through
 * the real UI, not just by reading the shared component code).
 */

const URL = 'http://localhost:5173/';
const FULL_DRILL_ID = 'hold_click_v1';

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
};

/** Same shape as replay.spec.ts's SAMPLE_INPUT — enough real ticks/events for a `full` replay
 * classification and a non-empty metrics grid, without needing the drill to reach `ended`. */
const SAMPLE_INPUT: HarnessInputEvent[] = [
  { type: 'key', code: 'KeyD', down: true, t: 0 },
  { type: 'fire', down: true, t: 80 },
  { type: 'fire', down: false, t: 130 },
  { type: 'key', code: 'KeyD', down: false, t: 200 },
  { type: 'key', code: 'KeyA', down: true, t: 220 },
  { type: 'key', code: 'KeyA', down: false, t: 500 },
];

async function waitForHarness(page: Page): Promise<void> {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __fpsTest?: unknown }).__fpsTest)), { timeout: 15_000 })
    .toBe(true);
}

/** Every `article[data-metric-id]` rendered anywhere inside `ResultDetailBody` (summary grid, and —
 * when present — promoted/diagnosis/quality-flag cards), keyed by metric id. A "blocked"/
 * "insufficient-data" placeholder never goes through `renderCard`, so it simply contributes no keys
 * on either side — parity still holds without special-casing that branch. */
async function captureMetricCards(scope: Locator): Promise<Record<string, string>> {
  const cards = scope.locator('[data-section="result-detail-body"] article[data-metric-id]');
  const count = await cards.count();
  const values: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    const id = await card.getAttribute('data-metric-id');
    const value = await card.getAttribute('data-metric-value');
    if (id !== null) values[id] = value ?? '';
  }
  return values;
}

async function waitReplayReady(page: Page): Promise<Locator> {
  const replay = page.locator('#replay-screen');
  await expect(replay).toBeVisible();
  await expect(replay.locator('[data-section="replay-ready"]')).toBeVisible({ timeout: 10_000 });
  return replay;
}

test.describe('WP-51 T2 — Dev canonical Assessment: current/historical parity (FR-51.5)', () => {
  test('a completed Assessment autosaves, and the live Result and the historical Run Detail render identical metric cards and full Replay', async ({
    page,
  }) => {
    await waitForHarness(page);
    const participantId = `stage10-t2-parity-${crypto.randomUUID()}`;

    const state = await page.evaluate(
      async ({ drillId, participantId, input }) => {
        const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;
        harness.startDrill(drillId);
        harness.feedInput(input);
        return harness.showResultAndSaveToHistory({ participantId, assessment: true });
      },
      { drillId: FULL_DRILL_ID, participantId, input: SAMPLE_INPUT },
    );
    if (state.kind !== 'saved') throw new Error(`expected a saved run, got ${JSON.stringify(state)}`);
    const run = state.run;

    const result = page.locator('#result-screen');
    await expect(result).toBeVisible();
    const liveCards = await captureMetricCards(result);
    expect(Object.keys(liveCards).length).toBeGreaterThan(0);

    // Full Replay from the live (current) Result.
    await result.getByRole('button', { name: '3D 重播', exact: true }).click();
    const replayFromResult = await waitReplayReady(page);
    await expect(replayFromResult.locator('[data-section="replay-support-badge"]')).toHaveAttribute('data-support-status', 'full');
    await replayFromResult.getByRole('button', { name: '返回', exact: true }).click();
    await expect(replayFromResult).toBeHidden();
    await expect(result).toBeVisible();

    // Close the live Result, then reach the very same run through History.
    await result.getByRole('button', { name: '返回設定' }).click();
    await expect(result).toBeHidden();

    await page.getByRole('button', { name: '歷史紀錄', exact: true }).click();
    const screen = page.locator('#history-screen');
    await expect(screen).toBeVisible();
    await screen.getByRole('searchbox', { name: '搜尋 Participant' }).fill(participantId);
    await screen.getByRole('button', { name: new RegExp(participantId) }).click();
    await screen.getByRole('button', { name: new RegExp(FULL_DRILL_ID) }).click();
    await screen.getByRole('button', { name: new RegExp(run.runId) }).click();
    await expect(screen.locator('[data-section="result-detail-body"]')).toBeVisible();

    const historicalCards = await captureMetricCards(screen);
    expect(historicalCards).toEqual(liveCards);

    // Full Replay from History, for the same run — Back returns to this Run Detail, not stale state.
    await expect(screen.locator('[data-history-action="replay"]')).toBeEnabled();
    await screen.locator('[data-history-action="replay"]').click();
    const replayFromHistory = await waitReplayReady(page);
    await expect(replayFromHistory.locator('[data-section="replay-source-label"]')).toHaveText(`${FULL_DRILL_ID} · ${run.runId}`);
    await expect(replayFromHistory.locator('[data-section="replay-support-badge"]')).toHaveAttribute('data-support-status', 'full');
    await replayFromHistory.getByRole('button', { name: '返回', exact: true }).click();
    await expect(replayFromHistory).toBeHidden();
    await expect(screen.locator('[data-history-action="replay"]')).toBeEnabled();
  });
});
