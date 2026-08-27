import { test, expect } from '@playwright/test';

/**
 * WP-49 T2 (FR-49.2/49.3, D-49.P3) — Participant search + exact-drill browser, end to end against
 * the real Node History API and its Playwright temp root (`.playwright-tmp/history-dev`,
 * playwright.config.ts).
 *
 * Fixtures are seeded through the same `__fpsTest.saveToHistory()` dev-only hook used by
 * `history-persistence.spec.ts` (WP-48 T5) — it drives the real `historyPersistence` instance
 * against the real HistoryClient -> Node API -> temp root path, so no filesystem/DB access from
 * the test itself. `spider-shot-v1`/`spider-shot-v2` are two real registered drills with a shared
 * prefix (`src/main.ts` availableDrills) — an exact-grouping negative case that doesn't require
 * inventing a fixture drill.
 */

const URL = 'http://localhost:5173/';

type HistorySaveState =
  | { kind: 'idle' }
  | { kind: 'excluded'; reason: 'practice' }
  | { kind: 'saving'; runKey: string }
  | { kind: 'saved'; run: { runId: string }; disposition: 'created' | 'existing' }
  | { kind: 'failed'; message: string; retryable: boolean };

type Harness = {
  startDrill(id: string): void;
  saveToHistory(overrides?: { participantId?: string; assessment?: boolean }): Promise<HistorySaveState>;
};

async function waitForHarness(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __fpsTest?: unknown }).__fpsTest)), { timeout: 15_000 })
    .toBe(true);
}

async function seedAssessmentRun(
  page: import('@playwright/test').Page,
  drillId: string,
  participantId: string,
): Promise<void> {
  const state = await page.evaluate(
    async ({ drillId, participantId }) => {
      const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;
      harness.startDrill(drillId);
      return harness.saveToHistory({ participantId, assessment: true });
    },
    { drillId, participantId },
  );
  expect(state.kind).toBe('saved');
}

async function openHistory(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: '歷史紀錄', exact: true }).click();
  await expect(page.locator('#history-screen')).toBeVisible();
}

test.describe('WP-49 T2 — Participant search and exact-drill browser', () => {
  test('a Participant with two similarly-prefixed exact drills shows two ungrouped drill cards', async ({ page }) => {
    await waitForHarness(page);
    const participantId = `t2-exact-${crypto.randomUUID()}`;
    await seedAssessmentRun(page, 'spider-shot-v1', participantId);
    await seedAssessmentRun(page, 'spider-shot-v2', participantId);

    await openHistory(page);
    const screen = page.locator('#history-screen');

    // Search narrows the participant list to this run's unique id (client-side substring filter).
    await screen.getByRole('searchbox', { name: '搜尋 Participant' }).fill(participantId);
    await expect(screen.getByRole('button', { name: new RegExp(participantId) })).toBeVisible();
    await screen.getByRole('button', { name: new RegExp(participantId) }).click();

    // The `drills` (plural, drill-list) route has no literal "drills" path segment — only the
    // singular `drill` route does (HistoryRoute.ts formatHistoryHash).
    await expect
      .poll(() => page.evaluate(() => window.location.hash))
      .toBe(`#/history/participants/${encodeURIComponent(participantId)}`);
    await expect(screen.getByRole('button', { name: /spider-shot-v1/ })).toBeVisible();
    await expect(screen.getByRole('button', { name: /spider-shot-v2/ })).toBeVisible();
  });

  test('a Practice run (no assessment) never appears in the Participant list', async ({ page }) => {
    await waitForHarness(page);
    const participantId = `t2-practice-${crypto.randomUUID()}`;

    const state = await page.evaluate(
      async ({ drillId, participantId }) => {
        const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;
        harness.startDrill(drillId);
        // No `assessment: true` override -> meta.assessment stays undefined (Practice).
        return harness.saveToHistory({ participantId });
      },
      { drillId: 'spider-shot-v1', participantId },
    );
    expect(state).toEqual({ kind: 'excluded', reason: 'practice' });

    await openHistory(page);
    const screen = page.locator('#history-screen');
    await screen.getByRole('searchbox', { name: '搜尋 Participant' }).fill(participantId);
    await expect(screen.getByText('搜尋無結果')).toBeVisible();
    await expect(screen.getByRole('button', { name: new RegExp(participantId) })).toHaveCount(0);
  });

  test('search filtering is client-side: clearing the query restores the full list without a new fetch round-trip freezing the UI', async ({
    page,
  }) => {
    await waitForHarness(page);
    const participantId = `t2-search-${crypto.randomUUID()}`;
    await seedAssessmentRun(page, 'spider-shot-v1', participantId);

    await openHistory(page);
    const screen = page.locator('#history-screen');
    const search = screen.getByRole('searchbox', { name: '搜尋 Participant' });

    await search.fill('no-such-participant-id-xyz');
    await expect(screen.getByText('搜尋無結果')).toBeVisible();

    await search.fill('');
    await expect(screen.getByRole('button', { name: new RegExp(participantId) })).toBeVisible();
  });
});
