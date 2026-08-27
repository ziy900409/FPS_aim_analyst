import { test, expect } from '@playwright/test';

/**
 * WP-49 T1（FR-49.1/49.6, FM-49.10）— History navigation/controller shell: launch entry,
 * Back/Forward/reload/close round-trip the `#/history` route, and the full-screen shell never
 * lets a background canvas click reach Pointer Lock while it is open.
 *
 * Real Pointer Lock ACQUISITION is manual-only in this repo (full-drill.spec.ts header — Playwright
 * synthetic gestures don't reliably satisfy it headless). The negative assertion here doesn't need
 * that: `HTMLCanvasElement.prototype.requestPointerLock` is monkey-patched via `addInitScript`
 * before the app boots, so the call itself is counted regardless of whether the browser would have
 * granted the lock.
 */

const URL = 'http://localhost:5173/';

async function installPointerLockSpy(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    let calls = 0;
    (window as unknown as { __pointerLockRequestCount(): number }).__pointerLockRequestCount = () => calls;
    HTMLCanvasElement.prototype.requestPointerLock = function requestPointerLock() {
      calls += 1;
      return undefined as unknown as void;
    };
  });
}

async function waitForApp(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: '歷史紀錄', exact: true })).toBeVisible({ timeout: 15_000 });
}

test('launch → History entry opens the shell at the participants root', async ({ page }) => {
  await waitForApp(page);

  await page.getByRole('button', { name: '歷史紀錄', exact: true }).click();

  const screen = page.locator('#history-screen');
  await expect(screen).toBeVisible();
  await expect(screen.getByRole('navigation', { name: '歷史紀錄路徑' }).getByRole('button', { name: '歷史紀錄' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/history');
});

test('Back hides the shell and clears the route; Forward restores it', async ({ page }) => {
  await waitForApp(page);
  await page.getByRole('button', { name: '歷史紀錄', exact: true }).click();
  await expect(page.locator('#history-screen')).toBeVisible();

  await page.goBack();
  await expect(page.locator('#history-screen')).toBeHidden();

  await page.goForward();
  await expect(page.locator('#history-screen')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/history');
});

test('reload on a history route restores the same route and breadcrumb', async ({ page }) => {
  await waitForApp(page);
  await page.getByRole('button', { name: '歷史紀錄', exact: true }).click();
  await expect(page.locator('#history-screen')).toBeVisible();

  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('#history-screen')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/history');
});

test('Close returns to the launch state and clears the hash', async ({ page }) => {
  await waitForApp(page);
  await page.getByRole('button', { name: '歷史紀錄', exact: true }).click();
  const screen = page.locator('#history-screen');
  await expect(screen).toBeVisible();

  await screen.getByRole('button', { name: '關閉歷史紀錄' }).click();
  await expect(screen).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.location.hash)).not.toContain('/history');
  // Launch controls are usable again — same-session regression, not just a visual check.
  await expect(page.getByRole('button', { name: '歷史紀錄', exact: true })).toBeVisible();
});

test('a background canvas click while History is open never requests Pointer Lock (FM-49.10)', async ({ page }) => {
  await installPointerLockSpy(page);
  await waitForApp(page);

  await page.getByRole('button', { name: '歷史紀錄', exact: true }).click();
  await expect(page.locator('#history-screen')).toBeVisible();

  // position:{x:5,y:5} avoids the shell's own header controls in case stacking ever regresses;
  // the shell backdrop still covers this point (README §2.9 full-screen surface).
  await page.locator('#app').click({ position: { x: 5, y: 5 }, force: true });

  const requestCount = await page.evaluate(() => (window as unknown as { __pointerLockRequestCount(): number }).__pointerLockRequestCount());
  expect(requestCount).toBe(0);
});
