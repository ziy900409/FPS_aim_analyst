import { test, expect, type Page } from '@playwright/test';

/**
 * WP-53 T5 — E2E acceptance for the formal `peek_click_transfer_v1` Assessment release (GD-29).
 *
 * Unlike the pilot's own `peek-click-transfer.spec.ts` (WP-45 T-exit, `runDetectionTimeoutRound()`,
 * no fire needed), this file needs real hit data for the trend chart, so it drives
 * `runCounterStrafeRound()` — the same generic move→counter-strafe→aim→fire driver already proven
 * for `counterstrafe-reversal-v1`/`counterstrafe-free-v1` (`history-persistence.spec.ts`,
 * `full-drill.spec.ts`). It was not previously exercised against `peek-ad-corridor-v1`'s real
 * occlusion geometry; a manual probe (`harness.startDrill('peek_click_transfer_v1');
 * harness.runCounterStrafeRound()`) confirmed it reaches `ended` with 20/20 targets killed and real
 * hits registering through the corridor's cover-wall occlusion, so no new round-runner was needed —
 * the "no dedicated round-runner exists" gap flagged in T3's progress.md turned out not to block T5.
 */

const URL = 'http://localhost:5173/';
const FORMAL_DRILL_ID = 'peek_click_transfer_v1';
const PILOT_DRILL_ID = 'peek_click_transfer_pilot_v1_2deg';

type HistorySaveState =
  | { kind: 'idle' }
  | { kind: 'excluded'; reason: 'practice' }
  | { kind: 'saving'; runKey: string }
  | { kind: 'saved'; run: { runId: string; startedAt: string }; disposition: 'created' | 'existing' }
  | { kind: 'failed'; message: string; retryable: boolean };

type Harness = {
  startDrill(id: string): void;
  runCounterStrafeRound(maxPeeks?: number): void;
  saveToHistory(overrides?: { participantId?: string; assessment?: boolean }): Promise<HistorySaveState>;
  showResultAndSaveToHistory(overrides?: { participantId?: string; assessment?: boolean }): Promise<HistorySaveState>;
  phase(): string;
};

async function waitForHarness(page: Page): Promise<void> {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __fpsTest?: unknown }).__fpsTest)), {
      timeout: 15_000,
    })
    .toBe(true);
}

/** Drives a full real round (real counter-strafe/hit data, not a synthetic override) to `ended`. */
async function runFormalTransferToEnded(
  page: Page,
  participantId: string,
): Promise<{ phase: string; state: HistorySaveState }> {
  return page.evaluate(
    async ({ drillId, participantId }) => {
      const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;
      harness.startDrill(drillId);
      harness.runCounterStrafeRound();
      const phase = harness.phase();
      const state = await harness.showResultAndSaveToHistory({ participantId, assessment: true });
      return { phase, state };
    },
    { drillId: FORMAL_DRILL_ID, participantId },
  );
}

async function seedFormalAssessmentRun(page: Page, participantId: string): Promise<void> {
  const state = await page.evaluate(
    async ({ drillId, participantId }) => {
      const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;
      harness.startDrill(drillId);
      harness.runCounterStrafeRound();
      return harness.saveToHistory({ participantId, assessment: true });
    },
    { drillId: FORMAL_DRILL_ID, participantId },
  );
  expect(state.kind).toBe('saved');
}

async function openHistory(page: Page): Promise<void> {
  await page.getByRole('button', { name: '歷史紀錄', exact: true }).click();
  await expect(page.locator('#history-screen')).toBeVisible();
}

test.describe('WP-53 T5 — formal peek_click_transfer_v1 Assessment acceptance', () => {
  test('a completed formal transfer run auto-saves and appears in the exact-drill history list', async ({ page }) => {
    await waitForHarness(page);
    const participantId = `wp53-t5-save-${crypto.randomUUID()}`;

    const { phase, state } = await runFormalTransferToEnded(page, participantId);
    expect(phase).toBe('ended');
    if (state.kind !== 'saved') throw new Error(`expected a saved run, got ${JSON.stringify(state)}`);

    // showResultAndSaveToHistory forces the Result dialog open; close it before navigating away,
    // same as stage10-assessment.spec.ts.
    const result = page.locator('#result-screen');
    await expect(result).toBeVisible();
    await result.getByRole('button', { name: '返回設定' }).click();
    await expect(result).toBeHidden();

    await openHistory(page);
    const screen = page.locator('#history-screen');
    await screen.getByRole('searchbox', { name: '搜尋 Participant' }).fill(participantId);
    await screen.getByRole('button', { name: new RegExp(participantId) }).click();
    // 'peek_click_transfer_v1' is not a substring of any 'peek_click_transfer_pilot_*' id, so a
    // plain substring match here can never be confused with the pilot cohort.
    await expect(screen.getByRole('button', { name: new RegExp(FORMAL_DRILL_ID) })).toBeVisible();
  });

  test("the exact peek_click_transfer_v1 drill's trend registry renders the primary metric from real saved runs", async ({
    page,
  }) => {
    await waitForHarness(page);
    const participantId = `wp53-t5-trend-${crypto.randomUUID()}`;
    await seedFormalAssessmentRun(page, participantId);
    await seedFormalAssessmentRun(page, participantId);

    await openHistory(page);
    const screen = page.locator('#history-screen');
    await screen.getByRole('searchbox', { name: '搜尋 Participant' }).fill(participantId);
    await screen.getByRole('button', { name: new RegExp(participantId) }).click();
    await screen.getByRole('button', { name: new RegExp(FORMAL_DRILL_ID) }).click();

    const trend = screen.locator('[data-section="drill-trend"]');
    await expect(trend.locator('button[data-metric-id]').first()).toBeVisible();
    await expect(trend.locator('[data-section="trend-progress"]')).toContainText('已載入 2／2 筆');
    await expect(trend.locator('[data-section="trend-chart"] table')).toBeVisible();
  });

  test('a genuine Practice pilot v1 run never appears in history, and a forced pilot save never merges into the formal trend cohort (FR-53-6)', async ({
    page,
  }) => {
    await waitForHarness(page);

    // Part 1 (literal DoD): a real, unforced practice run of the pilot is excluded outright — the
    // pilot never sets mode:'assessment', so the practice-only guard short-circuits before ever
    // calling the API, exactly like any other Practice run (HistoryPersistence.test.ts).
    const practiceParticipantId = `wp53-t5-pilot-practice-${crypto.randomUUID()}`;
    const practiceState = await page.evaluate(
      async ({ drillId, participantId }) => {
        const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;
        harness.startDrill(drillId);
        return harness.saveToHistory({ participantId }); // no assessment override -> real practice mode
      },
      { drillId: PILOT_DRILL_ID, participantId: practiceParticipantId },
    );
    expect(practiceState).toEqual({ kind: 'excluded', reason: 'practice' });

    // Part 2 (cohort isolation, the deeper guarantee): even a *forced* pilot save (assessment
    // override, same escape hatch history-library.spec.ts uses to seed an "unregistered drill" case)
    // must never merge into peek_click_transfer_v1's exact-id history/trend cohort — it stays its own
    // separate, unregistered card under the same participant as a real formal run.
    const participantId = `wp53-t5-isolation-${crypto.randomUUID()}`;
    await seedFormalAssessmentRun(page, participantId);
    const forcedPilotState = await page.evaluate(
      async ({ drillId, participantId }) => {
        const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;
        harness.startDrill(drillId);
        return harness.saveToHistory({ participantId, assessment: true });
      },
      { drillId: PILOT_DRILL_ID, participantId },
    );
    expect(forcedPilotState.kind).toBe('saved');

    await openHistory(page);
    const screen = page.locator('#history-screen');
    await screen.getByRole('searchbox', { name: '搜尋 Participant' }).fill(participantId);
    await screen.getByRole('button', { name: new RegExp(participantId) }).click();

    // Two separate drill cards, never grouped.
    await expect(screen.getByRole('button', { name: new RegExp(FORMAL_DRILL_ID) })).toBeVisible();
    await expect(screen.getByRole('button', { name: new RegExp(PILOT_DRILL_ID) })).toBeVisible();

    // Formal: registered trend with a real primary metric.
    await screen.getByRole('button', { name: new RegExp(FORMAL_DRILL_ID) }).click();
    const formalTrend = screen.locator('[data-section="drill-trend"]');
    await expect(formalTrend.locator('button[data-metric-id]').first()).toBeVisible();

    // Pilot: still unregistered, even though it was forced into Assessment history (FM-49.6/FR-53-6).
    // Close and reopen History rather than reusing the in-drill-view search box, which isn't the
    // active element once inside a drill's trend page.
    await screen.getByRole('button', { name: '關閉歷史紀錄' }).click();
    await expect(screen).toBeHidden();
    await openHistory(page);
    await screen.getByRole('searchbox', { name: '搜尋 Participant' }).fill(participantId);
    await screen.getByRole('button', { name: new RegExp(participantId) }).click();
    await screen.getByRole('button', { name: new RegExp(PILOT_DRILL_ID) }).click();
    const pilotTrend = screen.locator('[data-section="drill-trend"]');
    await expect(pilotTrend).toContainText('尚未註冊歷史指標');
    await expect(pilotTrend.locator('button[data-metric-id]')).toHaveCount(0);
  });
});
