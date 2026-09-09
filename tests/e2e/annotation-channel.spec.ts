import { test, expect } from '@playwright/test';

const DEV_URL = 'http://localhost:5173/';

type AnnotationEvent = {
  type: 'annotation';
  kind: 'sensor_lift';
  code: string;
  down: boolean;
  t: number;
};

type AimDebug = {
  recorder: {
    recordAnnotationEvents: boolean;
    snapshot: () => {
      ticks: Array<{ t: number }>;
      events: Array<{ type: string; kind?: string; code?: string; down?: boolean; t: number }>;
    };
  };
};

async function gotoAppReady(page: import('@playwright/test').Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'networkidle' });
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __aimDebug?: unknown }).__aimDebug)))
    .toBe(true);
}

async function pressAnnotationKey(page: import('@playwright/test').Page): Promise<void> {
  await page.keyboard.down('L');
  await page.keyboard.up('L');
}

test.describe('WP-61 T1 — operator annotation channel app wiring (Edge, dev)', () => {
  test('default load keeps the formal recorder opt-in disabled', async ({ page }) => {
    await gotoAppReady(page, DEV_URL);
    await pressAnnotationKey(page);

    const result = await page.evaluate(() => {
      const debug = (window as unknown as { __aimDebug: AimDebug }).__aimDebug;
      return {
        recordAnnotationEvents: debug.recorder.recordAnnotationEvents,
        annotations: debug.recorder.snapshot().events.filter((event) => event.type === 'annotation'),
      };
    });

    expect(result.recordAnnotationEvents).toBe(false);
    expect(result.annotations).toEqual([]);
  });

  test('`?annotation=1` records paired KeyL annotation events in the export clock domain', async ({ page }) => {
    await gotoAppReady(page, `${DEV_URL}?annotation=1`);

    await pressAnnotationKey(page);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { __aimDebug: AimDebug }).__aimDebug.recorder
              .snapshot()
              .events.filter((event) => event.type === 'annotation').length,
        ),
      )
      .toBe(2);

    const result = await page.evaluate(() => {
      const debug = (window as unknown as { __aimDebug: AimDebug }).__aimDebug;
      const snapshot = debug.recorder.snapshot();
      const annotations = snapshot.events.filter((event): event is AnnotationEvent => event.type === 'annotation');
      const tickTimes = snapshot.ticks.map((tick) => tick.t);
      return {
        recordAnnotationEvents: debug.recorder.recordAnnotationEvents,
        annotations,
        minTickT: Math.min(...tickTimes),
        maxTickT: Math.max(...tickTimes),
      };
    });

    expect(result.recordAnnotationEvents).toBe(true);
    expect(result.annotations.map((event) => event.down)).toEqual([true, false]);
    expect(result.annotations.map((event) => event.code)).toEqual(['KeyL', 'KeyL']);
    expect(result.annotations.map((event) => event.kind)).toEqual(['sensor_lift', 'sensor_lift']);
    for (const event of result.annotations) {
      expect(Number.isFinite(event.t)).toBe(true);
      expect(event.t).toBeGreaterThanOrEqual(result.minTickT);
      expect(event.t).toBeLessThanOrEqual(result.maxTickT);
    }
  });
});
