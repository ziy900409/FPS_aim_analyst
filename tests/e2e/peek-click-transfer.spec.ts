import { expect, test } from '@playwright/test';

const URL = 'http://localhost:5173/';
const DRILL_ID = 'peek_click_transfer_pilot_v1_2deg';

test.describe('WP-45 T-exit — peek-click transfer pilot', () => {
  test('runs a complete Practice timeout block and exports its auditable scene/visibility contract', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await expect
      .poll(() => page.evaluate(() => Boolean((window as unknown as { __fpsTest?: unknown }).__fpsTest)), {
        timeout: 15_000,
      })
      .toBe(true);

    const result = await page.evaluate((drillId) => {
      type Harness = {
        startDrill(id: string): void;
        runDetectionTimeoutRound(): void;
        forceExportJSON(): {
          meta: Record<string, unknown>;
          events: Array<{ type?: unknown; side?: unknown; targetId?: unknown }>;
        };
        phase(): string;
      };
      const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;
      harness.startDrill(drillId);
      harness.runDetectionTimeoutRound();
      const payload = harness.forceExportJSON();
      const visible = payload.events.filter((event) => event.type === 'visible');

      return {
        coi: window.crossOriginIsolated,
        phase: harness.phase(),
        meta: payload.meta,
        visibleCount: visible.length,
        uniqueTargetCount: new Set(visible.map((event) => event.targetId)).size,
        sides: visible.map((event) => event.side),
      };
    }, DRILL_ID);

    expect(result.coi).toBe(true);
    expect(result.phase).toBe('ended');
    expect(result.visibleCount).toBe(20);
    expect(result.uniqueTargetCount).toBe(20);
    expect(result.sides.filter((side) => side === 'L')).toHaveLength(10);
    expect(result.sides.filter((side) => side === 'R')).toHaveLength(10);
    expect(result.meta).toMatchObject({
      drillId: DRILL_ID,
      rngSeed: 94020,
      scene: { sceneId: 'peek-ad-corridor-v1', fallback: false },
      targets: { hitbox: { depthU: 1 } },
      visibility: { sampleCount: 9, onsetThreshold: 0.5 },
    });
    expect(result.meta.assessment).toBeUndefined();
  });
});
