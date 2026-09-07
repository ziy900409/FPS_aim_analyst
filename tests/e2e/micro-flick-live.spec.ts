import { expect, test } from '@playwright/test';

const URL = 'http://localhost:5173/';

type AimDebug = {
  state: {
    player: { x: number; z: number; vx: number; vz: number; stopped: boolean };
    targets: Array<{ id: string; alive: boolean; visible: boolean }>;
  };
};

async function gotoAppReady(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __aimDebug?: unknown }).__aimDebug)), {
      timeout: 15_000,
    })
    .toBe(true);
}

async function enterResearcherDrillControls(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: '研究員模式', exact: true }).click();
  await page.locator('#researcher-menu').getByRole('button', { name: '單一 Drill 調整', exact: true }).click();
  await expect(page.locator('#drill-controls')).toBeVisible();
}

function debugState(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const debugState = (window as unknown as { __aimDebug: AimDebug }).__aimDebug.state;
    return {
      player: { ...debugState.player },
      targets: debugState.targets.map((target) => ({ ...target })),
    };
  });
}

test('WP-56 T4: researcher micro-flick keeps a fixed player while its live HUD and centered crosshair remain active', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await gotoAppReady(page);
  await enterResearcherDrillControls(page);

  await page.locator('#drill-select').selectOption('micro_flick_three_target_test_v1');
  await expect(page.locator('#scene-select')).toHaveValue('micro-flick-room', { timeout: 20_000 });
  await expect
    .poll(async () => (await debugState(page)).targets.filter((target) => target.alive && target.visible).length, {
      timeout: 10_000,
    })
    .toBe(3);

  const initial = await debugState(page);
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', bubbles: true })));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD', bubbles: true })));
  await page.waitForTimeout(100);

  const afterInput = await debugState(page);
  expect(afterInput.player).toEqual({ ...initial.player, vx: 0, vz: 0, stopped: true });
  expect(afterInput.targets.filter((target) => target.alive && target.visible)).toHaveLength(3);

  const crosshairCenter = await page.locator('#crosshair').evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  expect(crosshairCenter).toEqual({ x: 640, y: 360 });

  const hud = page.locator('#metrics-hud');
  await expect(hud).toContainText('Score');
  await expect(hud).toContainText('Time');
  await expect(hud).toContainText('Hit rate');
  await expect(hud).toContainText('STOP');
});
