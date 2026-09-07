import { expect, test } from '@playwright/test';

const URL = 'http://localhost:5173/';

type AimDebug = {
  state: {
    player: { x: number; z: number; vx: number; vz: number; stopped: boolean };
    targets: Array<{
      id: string;
      alive: boolean;
      visible: boolean;
    }>;
  };
};

type HarnessInputEvent = { type: 'fire'; down: boolean; t: number };

type FpsTestHarness = {
  startDrill(id: string): void;
  feedInput(seq: HarnessInputEvent[]): void;
  forceExportJSON(): { events: Array<{ type: string; targetId?: string; hit?: boolean }> };
  phase(): string;
};

async function gotoAppReady(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __aimDebug?: unknown }).__aimDebug)), {
      timeout: 15_000,
    })
    .toBe(true);
}

async function waitForHarness(page: import('@playwright/test').Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __fpsTest?: unknown }).__fpsTest)), {
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

async function loadMicroFlick(page: import('@playwright/test').Page): Promise<void> {
  await enterResearcherDrillControls(page);
  await page.locator('#drill-select').selectOption('micro_flick_three_target_test_v1');
  await expect(page.locator('#scene-select')).toHaveValue('micro-flick-room', { timeout: 20_000 });
  await expect
    .poll(async () => (await debugState(page)).targets.filter((target) => target.alive && target.visible).length, {
      timeout: 10_000,
    })
    .toBe(3);
}

function percentile95(samples: readonly number[]): number {
  const ordered = [...samples].sort((left, right) => left - right);
  return ordered[Math.ceil(ordered.length * 0.95) - 1] ?? 0;
}

test('WP-56 T4: researcher micro-flick keeps a fixed player while its live HUD and centered crosshair remain active', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await gotoAppReady(page);
  await loadMicroFlick(page);

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

  await page.setViewportSize({ width: 1920, height: 1080 });
  const fullHdCrosshairCenter = await page.locator('#crosshair').evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  expect(fullHdCrosshairCenter).toEqual({ x: 960, y: 540 });

  const hud = page.locator('#metrics-hud');
  await expect(hud).toContainText('Score');
  await expect(hud).toContainText('Time');
  await expect(hud).toContainText('Hit rate');
  await expect(hud).toContainText('STOP');
});

test('WP-56 T5: researcher selection reaches the live three-target scene and the browser harness records an exact hitscan replacement', async ({ page }) => {
  await gotoAppReady(page);
  await loadMicroFlick(page);
  await waitForHarness(page);
  const events = await page.evaluate(() => {
    const harness = (window as unknown as { __fpsTest: FpsTestHarness }).__fpsTest;
    harness.startDrill('micro_flick_three_target_test_v1');
    harness.feedInput([
      { type: 'fire', down: true, t: 0 },
      { type: 'fire', down: false, t: 8 },
    ]);
    return harness.forceExportJSON().events;
  });
  expect(events.filter((event) => event.type === 'visible').map((event) => event.targetId)).toEqual(['t0', 't1', 't2', 't3']);
  expect(events.filter((event) => event.type === 'fire' && event.hit).map((event) => event.targetId)).toEqual(['t0']);
});

test('WP-56 T5: the browser harness completes the real 60-target budget and recreates the exact opening sequence', async ({ page }) => {
  await gotoAppReady(page);
  await waitForHarness(page);
  const first = await page.evaluate(() => {
    const harness = (window as unknown as { __fpsTest: FpsTestHarness }).__fpsTest;
    harness.startDrill('micro_flick_three_target_test_v1');
    const sequence: HarnessInputEvent[] = Array.from({ length: 60 }, (_, index) => {
      const t = index * 120;
      return [
        { type: 'fire' as const, down: true, t },
        { type: 'fire' as const, down: false, t: t + 8 },
      ];
    }).flat();
    harness.feedInput(sequence);
    return { phase: harness.phase(), events: harness.forceExportJSON().events };
  });
  expect(first.phase).toBe('ended');
  expect(first.events.filter((event) => event.type === 'fire' && event.hit)).toHaveLength(60);

  const openings = await page.evaluate(() => {
    const harness = (window as unknown as { __fpsTest: FpsTestHarness }).__fpsTest;
    const visibleIds = (): string[] =>
      harness
        .forceExportJSON()
        .events.filter((event) => event.type === 'visible')
        .slice(0, 3)
        .map((event) => event.targetId ?? '');
    harness.startDrill('micro_flick_three_target_test_v1');
    const firstOpening = visibleIds();
    harness.startDrill('micro_flick_three_target_test_v1');
    return { firstOpening, restartOpening: visibleIds() };
  });
  expect(openings.restartOpening).toEqual(openings.firstOpening);
});

test('WP-56 T5: cached researcher drill selection reaches the first three visible targets within the 1,500 ms P95 budget', async ({ page }) => {
  test.setTimeout(60_000);
  await gotoAppReady(page);
  await enterResearcherDrillControls(page);
  const samples: number[] = [];

  for (let iteration = 0; iteration < 20; iteration++) {
    await page.locator('#scene-select').selectOption('field-low');
    await expect(page.locator('#scene-select')).toHaveValue('field-low', { timeout: 10_000 });
    // Selecting the same option does not emit a DOM change event.  Re-select a registered field
    // drill before each measured Micro Flick selection so every sample drives the real transaction.
    await page.locator('#drill-select').selectOption('counterstrafe_ad_v1');
    await expect(page.locator('#drill-select')).toHaveValue('counterstrafe_ad_v1');
    await expect
      .poll(async () => (await debugState(page)).targets.filter((target) => target.alive && target.visible).length, {
        timeout: 10_000,
      })
      .toBe(1);

    const startedAt = performance.now();
    await page.locator('#drill-select').selectOption('micro_flick_three_target_test_v1');
    await expect(page.locator('#scene-select')).toHaveValue('micro-flick-room', { timeout: 20_000 });
    await expect
      .poll(async () => (await debugState(page)).targets.filter((target) => target.alive && target.visible).length, {
        timeout: 10_000,
      })
      .toBe(3);
    samples.push(performance.now() - startedAt);
  }

  const p95Ms = percentile95(samples);
  console.info(
    `[WP-56 T5 perf] cached researcher selection: samples=20 p50=${[...samples].sort((a, b) => a - b)[9].toFixed(1)}ms p95=${p95Ms.toFixed(1)}ms max=${Math.max(...samples).toFixed(1)}ms`,
  );
  expect(p95Ms).toBeLessThan(1_500);
});
