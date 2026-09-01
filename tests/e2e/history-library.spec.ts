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
  | { kind: 'saved'; run: { runId: string; startedAt: string }; disposition: 'created' | 'existing' }
  | { kind: 'failed'; message: string; retryable: boolean };

type Harness = {
  startDrill(id: string): void;
  saveToHistory(overrides?: { participantId?: string; assessment?: boolean }): Promise<HistorySaveState>;
  showResultAndSaveToHistory(overrides?: { participantId?: string; assessment?: boolean }): Promise<HistorySaveState>;
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

/** Same as `seedAssessmentRun` but also returns the saved run's identity (runId + startedAt) so a
 * T3 test can navigate straight to it and assert the downloaded content matches this specific run,
 * not whichever run happened to load. */
async function seedAssessmentRunAndCapture(
  page: import('@playwright/test').Page,
  drillId: string,
  participantId: string,
): Promise<{ runId: string; startedAt: string }> {
  const state = await page.evaluate(
    async ({ drillId, participantId }) => {
      const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;
      harness.startDrill(drillId);
      return harness.saveToHistory({ participantId, assessment: true });
    },
    { drillId, participantId },
  );
  if (state.kind !== 'saved') throw new Error(`expected a saved run, got ${state.kind}`);
  return { runId: state.run.runId, startedAt: state.run.startedAt };
}

async function downloadJSONPayload(
  page: import('@playwright/test').Page,
  trigger: () => Promise<void>,
): Promise<{ meta: { startedAt: string; drillId: string } }> {
  const downloadPromise = page.waitForEvent('download');
  await trigger();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
}

async function openHistory(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: '歷史紀錄', exact: true }).click();
  await expect(page.locator('#history-screen')).toBeVisible();
}

async function revealParticipantInChunkedList(screen: import('@playwright/test').Locator, participantId: string): Promise<void> {
  const participant = screen.getByRole('button', { name: new RegExp(participantId) });
  for (let i = 0; i < 30 && (await participant.count()) === 0; i++) {
    const loadMore = screen.getByRole('button', { name: /顯示更多/ });
    if ((await loadMore.count()) === 0) break;
    await loadMore.click();
  }
  await expect(participant).toBeVisible();
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
    // The restored full list is still chunked to 100 rows. In a shared dev root, Stage10 future
    // fixtures from other specs can sort ahead of this freshly seeded 2026 run, so reveal more rows
    // before asserting the participant is present.
    await revealParticipantInChunkedList(screen, participantId);
  });
});

test.describe('WP-49 T3 — run list and historical result detail', () => {
  test('opens two different Assessment runs from the same drill\'s run list; each download carries that run\'s own content, not the other\'s (FM-49.8)', async ({ page }) => {
    await waitForHarness(page);
    const participantId = `t3-runs-${crypto.randomUUID()}`;
    const drillId = 'spider-shot-v1';

    const runA = await seedAssessmentRunAndCapture(page, drillId, participantId);
    const runB = await seedAssessmentRunAndCapture(page, drillId, participantId);
    expect(runA.runId).not.toBe(runB.runId);
    expect(runA.startedAt).not.toBe(runB.startedAt);

    await openHistory(page);
    const screen = page.locator('#history-screen');
    await screen.getByRole('searchbox', { name: '搜尋 Participant' }).fill(participantId);
    await screen.getByRole('button', { name: new RegExp(participantId) }).click();
    await screen.getByRole('button', { name: new RegExp(drillId) }).click();

    // drill route — both runs listed (default runFilter=all).
    await expect(screen.getByRole('button', { name: new RegExp(runA.runId) })).toBeVisible();
    await expect(screen.getByRole('button', { name: new RegExp(runB.runId) })).toBeVisible();

    await screen.getByRole('button', { name: new RegExp(runA.runId) }).click();
    await expect(screen.locator('[data-section="result-detail-body"]')).toBeVisible();
    const payloadA = await downloadJSONPayload(page, () => screen.getByRole('button', { name: '匯出 JSON' }).click());
    expect(payloadA.meta.startedAt).toBe(runA.startedAt);
    expect(payloadA.meta.drillId).toBe(drillId);

    // Back returns to the same drill's run list, not the participant/drill roots.
    await screen.getByRole('button', { name: '返回 Run 列表' }).click();
    await expect(screen.getByRole('button', { name: new RegExp(runB.runId) })).toBeVisible();

    await screen.getByRole('button', { name: new RegExp(runB.runId) }).click();
    const payloadB = await downloadJSONPayload(page, () => screen.getByRole('button', { name: '匯出 JSON' }).click());
    expect(payloadB.meta.startedAt).toBe(runB.startedAt);
    expect(payloadB.meta.startedAt).not.toBe(payloadA.meta.startedAt);
  });

  test('a historical run detail has no restart/current-save affordances (FM-49.8)', async ({ page }) => {
    await waitForHarness(page);
    const participantId = `t3-no-restart-${crypto.randomUUID()}`;
    const drillId = 'spider-shot-v1';
    const run = await seedAssessmentRunAndCapture(page, drillId, participantId);

    await openHistory(page);
    const screen = page.locator('#history-screen');
    await screen.getByRole('searchbox', { name: '搜尋 Participant' }).fill(participantId);
    await screen.getByRole('button', { name: new RegExp(participantId) }).click();
    await screen.getByRole('button', { name: new RegExp(drillId) }).click();
    await screen.getByRole('button', { name: new RegExp(run.runId) }).click();

    await expect(screen.locator('[data-section="result-detail-body"]')).toBeVisible();
    await expect(screen.getByRole('button', { name: '再測目前 Drill' })).toHaveCount(0);
    await expect(screen.getByRole('button', { name: /^Replay/ })).toHaveCount(0);
  });
});

test.describe('WP-49 T5 — drill trend and "查看此 Drill 歷史" entry', () => {
  test('a registered drill (spider-shot-v2) renders a metric selector and a trend chart from real saved runs', async ({ page }) => {
    await waitForHarness(page);
    const participantId = `t5-trend-${crypto.randomUUID()}`;
    await seedAssessmentRun(page, 'spider-shot-v2', participantId);
    await seedAssessmentRun(page, 'spider-shot-v2', participantId);

    await openHistory(page);
    const screen = page.locator('#history-screen');
    await screen.getByRole('searchbox', { name: '搜尋 Participant' }).fill(participantId);
    await screen.getByRole('button', { name: new RegExp(participantId) }).click();
    await screen.getByRole('button', { name: /spider-shot-v2/ }).click();

    const trend = screen.locator('[data-section="drill-trend"]');
    await expect(trend.locator('button[data-metric-id]').first()).toBeVisible();
    await expect(trend.locator('[data-section="trend-progress"]')).toContainText('已載入 2／2 筆');
    await expect(trend.locator('[data-section="trend-chart"] table')).toBeVisible();
  });

  test('an unregistered drill (spider-shot-v1) shows an explicit "not registered" trend message, not silent emptiness (FM-49.6)', async ({ page }) => {
    await waitForHarness(page);
    const participantId = `t5-unregistered-${crypto.randomUUID()}`;
    await seedAssessmentRun(page, 'spider-shot-v1', participantId);

    await openHistory(page);
    const screen = page.locator('#history-screen');
    await screen.getByRole('searchbox', { name: '搜尋 Participant' }).fill(participantId);
    await screen.getByRole('button', { name: new RegExp(participantId) }).click();
    await screen.getByRole('button', { name: /spider-shot-v1/ }).click();

    const trend = screen.locator('[data-section="drill-trend"]');
    await expect(trend).toContainText('尚未註冊歷史指標');
    await expect(trend.locator('button[data-metric-id]')).toHaveCount(0);
    // The run list itself is unaffected by the missing registry (FR-49.11).
    await expect(screen.locator('[data-section="run-list-status"]')).toContainText('共 1 筆');
  });

  test('a saved Assessment Result shows "查看此 Drill 歷史" and it opens the correct Participant/drill (FR-49.12)', async ({ page }) => {
    await waitForHarness(page);
    const participantId = `t5-open-history-${crypto.randomUUID()}`;
    const drillId = 'spider-shot-v2';

    await page.evaluate(
      async ({ drillId, participantId }) => {
        const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;
        harness.startDrill(drillId);
        const state = await harness.showResultAndSaveToHistory({ participantId, assessment: true });
        if (state.kind !== 'saved') throw new Error(`expected a saved run, got ${state.kind}`);
      },
      { drillId, participantId },
    );

    const result = page.locator('#result-screen');
    await expect(result).toBeVisible();
    const historyEntry = result.getByRole('button', { name: '查看此 Drill 歷史' });
    await expect(historyEntry).toBeVisible();
    await historyEntry.click();

    const screen = page.locator('#history-screen');
    await expect(screen).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.location.hash))
      .toBe(`#/history/participants/${encodeURIComponent(participantId)}/drills/${encodeURIComponent(drillId)}`);

    // Closing History leaves the original Result dialog intact underneath (FM-49.8 "close to Result").
    await screen.getByRole('button', { name: '關閉歷史紀錄' }).click();
    await expect(screen).toBeHidden();
    await expect(result).toBeVisible();
    await expect(result.getByRole('button', { name: '匯出 JSON' })).toBeEnabled();
  });

  test('a Practice Result never shows "查看此 Drill 歷史" (FR-49.12)', async ({ page }) => {
    await waitForHarness(page);
    const participantId = `t5-practice-no-entry-${crypto.randomUUID()}`;

    await page.evaluate(
      async ({ participantId }) => {
        const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;
        harness.startDrill('spider-shot-v2');
        // No `assessment: true` -> meta.assessment stays undefined (Practice); historyPersistence
        // short-circuits to `excluded` without ever calling the History API.
        const state = await harness.showResultAndSaveToHistory({ participantId });
        if (state.kind !== 'excluded') throw new Error(`expected excluded, got ${state.kind}`);
      },
      { participantId },
    );

    const result = page.locator('#result-screen');
    await expect(result).toBeVisible();
    await expect(result.getByRole('button', { name: '查看此 Drill 歷史' })).not.toBeVisible();
  });

  test('the selected metric persists in the URL across a reload (FR-49.6)', async ({ page }) => {
    await waitForHarness(page);
    const participantId = `t5-metric-persist-${crypto.randomUUID()}`;
    const drillId = 'spider-shot-v2';
    await seedAssessmentRun(page, drillId, participantId);

    await openHistory(page);
    const screen = page.locator('#history-screen');
    await screen.getByRole('searchbox', { name: '搜尋 Participant' }).fill(participantId);
    await screen.getByRole('button', { name: new RegExp(participantId) }).click();
    await screen.getByRole('button', { name: new RegExp(drillId) }).click();

    const secondaryMetricButton = screen.locator('[data-section="drill-trend"] button[data-metric-id]').nth(1);
    const secondaryMetricId = await secondaryMetricButton.getAttribute('data-metric-id');
    await secondaryMetricButton.click();
    await expect
      .poll(() => page.evaluate(() => window.location.hash))
      .toContain(`metricId=${encodeURIComponent(secondaryMetricId!)}`);

    await page.reload({ waitUntil: 'networkidle' });
    const reloadedScreen = page.locator('#history-screen');
    await expect(reloadedScreen).toBeVisible();
    const reselected = reloadedScreen.locator(`[data-section="drill-trend"] button[data-metric-id="${secondaryMetricId}"]`);
    await expect(reselected).toHaveAttribute('aria-pressed', 'true');
  });
});
