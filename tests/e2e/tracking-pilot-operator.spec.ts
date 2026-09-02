import { test, expect, type Page } from '@playwright/test';

/**
 * WP-54 T5 — keyboard-only walkthrough of the tracking-pilot operator screen (task-checklist T5
 * "keyboard-only/focus/status text walkthrough 完成，品質狀態不只靠顏色表達"; NFR-54-8).
 *
 * Same convention as `stage10-accessibility.spec.ts`: drives the UI with only
 * `.focus()`/`page.keyboard.press()` (no `.click()`), and this project treats such a real-browser
 * Playwright walkthrough as its accepted automated a11y/keyboard evidence.
 *
 * Runs against `/tracking-pilot-harness.html` (`src/pilot/trackingPilotOperatorHarness.ts`) — a
 * dev-only mount that wires the real `TrackingPilotManifest`/`TrackingPilotRunner`/
 * `TrackingPilotOperatorScreen` modules together with a fake `loadDrillConfig`/`exportBlock` (no
 * 3-loop sim runtime). Never imported by `src/main.ts`. Wiring the real runner into the live app
 * (a real `DrillConfig` load, a real `ExportPayload` export) and administering it to real testers
 * is T6 "Instrumentation pilot" scope (README §4 T6), not duplicated here — this spec proves the
 * operator screen mechanism itself: keyboard reachability, and that every state (running block,
 * eligible outcome, blocked outcome, rest countdown, done) renders as text, never colour-only.
 */

const URL = 'http://localhost:5173/tracking-pilot-harness.html';

async function waitForHarnessReady(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __trackingPilotHarnessReady?: boolean }).__trackingPilotHarnessReady)))
    .toBe(true);
}

async function tabUntilButton(page: Page, needle: string, maxPresses = 15): Promise<void> {
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

test.describe('WP-54 T5 — tracking pilot operator screen keyboard-only walkthrough', () => {
  test('start -> practice (no gate) -> eligible block -> blocked block -> retry -> abort, all via keyboard, all status as text', async ({
    page,
  }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await waitForHarnessReady(page);

    // ---- 1. Start manifest form, keyboard-only -------------------------------------------------
    const participantInput = page.locator('input[name="participantId"]');
    await participantInput.focus();
    await page.keyboard.type('P-KEYBOARD-1');

    await page.keyboard.press('Tab'); // -> sessionIndex select
    await page.keyboard.press('Tab'); // -> restSeconds input
    await expect(page.locator('input[name="restSeconds"]')).toBeFocused();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('1'); // 1s rest so the harness's poll() driver advances quickly

    await page.keyboard.press('Tab'); // -> Start manifest button
    await expect(page.getByRole('button', { name: 'Start manifest' })).toBeFocused();
    await page.keyboard.press('Enter');

    const blockText = page.locator('#tracking-pilot-block-text');
    await expect(blockText).toContainText('role: practice');
    await expect(blockText).toContainText('attempt 1');

    // ---- 2. Practice block: complete via keyboard, no quality banner (no capability number) ----
    await tabUntilButton(page, 'Complete block');
    await page.keyboard.press('Enter');
    const outcomeText = page.locator('#tracking-pilot-outcome-text');
    await expect(outcomeText).toContainText('role: practice');
    await expect(page.locator('#tracking-pilot-quality-banner')).toBeHidden();

    await tabUntilButton(page, 'Continue');
    await page.keyboard.press('Enter');

    // ---- 3. Rest countdown renders as text, then the next block starts automatically -----------
    // `blockText` keeps its previous block's stale text while blockPanel is display:none during
    // rest (only `renderPhase()` overwrites it, synchronously with showing the panel again) — wait
    // for the panel to become visible first, or a "role: calibration" substring check would
    // false-positive-match the *previous* calibration block's leftover text while still resting.
    await expect(page.locator('#tracking-pilot-rest-text')).toContainText('Rest');
    await expect(blockText).toBeVisible({ timeout: 5_000 });
    await expect(blockText).toContainText('role: calibration');

    // ---- 4. First scored/gated block: eligible -> shown as text (never colour-only), Continue --
    await tabUntilButton(page, 'Complete block');
    await page.keyboard.press('Enter');
    const qualityBanner = page.locator('#tracking-pilot-quality-banner');
    await expect(qualityBanner).toContainText('Eligible');
    await expect(qualityBanner).toHaveAttribute('role', 'alert');
    await expect(qualityBanner).toHaveAttribute('data-quality', 'eligible');

    await tabUntilButton(page, 'Continue');
    await page.keyboard.press('Enter');
    await expect(blockText).toBeHidden(); // rest panel now showing instead
    await expect(blockText).toBeVisible({ timeout: 5_000 });
    await expect(blockText).toContainText('role: calibration');

    // ---- 5. Second calibration block: blocked -> retry with a typed reason, keyboard-only ------
    await tabUntilButton(page, 'Complete block');
    await page.keyboard.press('Enter');
    await expect(qualityBanner).toContainText('Blocked');
    await expect(qualityBanner).toContainText('insufficient-scored-coverage');
    await expect(qualityBanner).toHaveAttribute('data-quality', 'blocked');

    await tabUntilButton(page, 'Retry block');
    await page.keyboard.press('Enter');
    const reasonInput = page.locator('input[name="reason"]');
    await expect(reasonInput).toBeFocused(); // showReasonPanel() moves focus in for the operator
    await page.keyboard.type('quality gate looked wrong on this attempt, retrying');
    await tabUntilButton(page, 'Confirm');
    await page.keyboard.press('Enter');

    // Retry re-runs the same block (attempt 2); it stays gated until Complete/Continue again.
    await expect(blockText).toContainText('attempt 2');
    await tabUntilButton(page, 'Complete block');
    await page.keyboard.press('Enter');
    await expect(qualityBanner).toContainText('Eligible');

    // ---- 6. Abort the next running block via keyboard, with a typed reason ---------------------
    await tabUntilButton(page, 'Continue');
    await page.keyboard.press('Enter');
    await expect(blockText).toBeVisible({ timeout: 5_000 });

    await tabUntilButton(page, 'Abort block');
    await page.keyboard.press('Enter');
    await expect(reasonInput).toBeFocused();
    await page.keyboard.type('participant needs a break');
    await tabUntilButton(page, 'Confirm');
    await page.keyboard.press('Enter');

    // Abort logs an entry and advances to rest — visible as text in the block log, not a score.
    const recordsList = page.locator('#tracking-pilot-records-list');
    await expect(recordsList).toContainText('aborted (participant needs a break)');
  });
});
