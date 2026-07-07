import { test, expect } from '@playwright/test';

const URL = 'http://localhost:5173/';
const DRILL_ID = 'counterstrafe_ad_v1';
const SHOTS = 30;

async function waitForHarness(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __fpsTest?: unknown }).__fpsTest)), {
      timeout: 15_000,
    })
    .toBe(true);
}

test.describe('WP-17 T2 E2E - spray drill full chain', () => {
  test('COI + fire(30) -> export v2 -> metrics -> result recoil path DOM', async ({ page }) => {
    await waitForHarness(page);

    const r = await page.evaluate(
      ({ drillId, shots }) => {
        type Readout = {
          aimPunchPitchDeg: number;
          aimPunchYawDeg: number;
          rawPunchPitchDeg: number;
          rawPunchYawDeg: number;
          recoilIndex: number;
          shotsFired: number;
        };
        type Harness = {
          startDrill(id: string): void;
          fireRecoilBurst(shots: number): Readout;
          forceExportJSON(): unknown;
          getMetrics(): unknown;
          metricsFromExport(payload: unknown): unknown;
          showResult(): void;
        };
        type FireEvent = {
          type: 'fire';
          t: number;
          hit: boolean;
          firstShot: boolean;
          residualSpeed: number;
          viewYaw?: number;
          viewPitch?: number;
          aimPunchPitch?: number;
          aimPunchYaw?: number;
          spreadX?: number;
          spreadY?: number;
          recoilIndex?: number;
          ammo?: number;
        };

        const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;
        const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

        harness.startDrill(drillId);
        const readout = harness.fireRecoilBurst(shots);
        const payload = harness.forceExportJSON() as {
          meta: Record<string, unknown>;
          ticks: unknown[];
          events: Array<Record<string, unknown>>;
        };
        const fires = payload.events.filter((event): event is FireEvent => event.type === 'fire');
        const fireV2FieldsComplete = fires.every(
          (event) =>
            typeof event.hit === 'boolean' &&
            typeof event.firstShot === 'boolean' &&
            finite(event.residualSpeed) &&
            finite(event.viewYaw) &&
            finite(event.viewPitch) &&
            finite(event.aimPunchPitch) &&
            finite(event.aimPunchYaw) &&
            finite(event.spreadX) &&
            finite(event.spreadY) &&
            finite(event.recoilIndex) &&
            finite(event.ammo),
        );
        const recoilIndexes = fires.map((event) => event.recoilIndex);
        const ammoBefore = fires.map((event) => event.ammo);

        const metrics = harness.getMetrics() as {
          residualSpeed: { n: number };
          recoilCompensationError: { meanDeg: number; rmsDeg: number };
          recoilCompensationPath: { actual: unknown[]; ideal: unknown[] };
        };
        const roundTripped = JSON.parse(JSON.stringify(payload));
        const metricsFromExport = harness.metricsFromExport(roundTripped);
        const metricsMatchExport = JSON.stringify(metrics) === JSON.stringify(metricsFromExport);

        harness.showResult();
        const resultScreen = document.querySelector<HTMLElement>('#result-screen');
        const recoilPath = document.querySelector<HTMLElement>('#result-screen [data-metric-id="recoilCompensationPath"]');
        const recoilSvg = document.querySelector(
          '#result-screen svg[aria-label="Actual recoil compensation path compared with ideal path"]',
        );

        return {
          coi: window.crossOriginIsolated,
          readout,
          meta: payload.meta,
          ticksLen: payload.ticks.length,
          fireCount: fires.length,
          fireV2FieldsComplete,
          firstFire: fires[0] ?? null,
          lastFire: fires[fires.length - 1] ?? null,
          recoilIndexes,
          ammoBefore,
          metrics,
          metricsMatchExport,
          resultDisplay: resultScreen?.style.display ?? null,
          recoilPathExists: recoilPath !== null,
          recoilSvgExists: recoilSvg !== null,
          recoilPathText: recoilPath?.textContent ?? '',
        };
      },
      { drillId: DRILL_ID, shots: SHOTS },
    );

    expect(r.coi).toBe(true);

    expect(r.readout.shotsFired).toBe(SHOTS);
    expect(r.readout.recoilIndex).toBe(SHOTS);
    expect(r.readout.aimPunchPitchDeg).toBeLessThan(0);
    expect(r.readout.aimPunchYawDeg).toBeLessThan(0);
    expect(r.readout.rawPunchPitchDeg).toBeCloseTo(r.readout.aimPunchPitchDeg * 2, 9);
    expect(r.readout.rawPunchYawDeg).toBeCloseTo(r.readout.aimPunchYawDeg * 2, 9);

    expect(r.meta.schemaVersion).toBe(2);
    expect(r.meta.drillId).toBe(DRILL_ID);
    expect(r.meta.weaponId).toBe('ak47');
    expect(r.meta.weaponSeed).toBe(223);
    expect(r.meta.rngSeed).toBe(1);
    expect(r.meta.sensitivityModel).toBe('cs2-0.022deg');
    expect(r.meta.movementModel).toBe('cs2-source');
    expect(r.meta.crossOriginIsolated).toBe(true);
    expect(r.meta.bufferOverflow).toBe(false);
    expect(r.meta.recorderOverflow).toBe(false);
    expect(r.meta.suspect).toBe(false);
    expect(r.ticksLen).toBeGreaterThan(0);

    expect(r.fireCount).toBe(SHOTS);
    expect(r.fireV2FieldsComplete).toBe(true);
    expect(r.recoilIndexes).toEqual(Array.from({ length: SHOTS }, (_, index) => index));
    expect(r.ammoBefore).toEqual(Array.from({ length: SHOTS }, (_, index) => SHOTS - index));
    expect(r.firstFire).toMatchObject({ type: 'fire', recoilIndex: 0, ammo: 30 });
    expect(r.lastFire).toMatchObject({ type: 'fire', recoilIndex: 29, ammo: 1 });

    expect(r.metrics.residualSpeed.n).toBe(SHOTS);
    expect(r.metrics.recoilCompensationPath.actual).toHaveLength(SHOTS);
    expect(r.metrics.recoilCompensationPath.ideal).toHaveLength(SHOTS);
    expect(r.metrics.recoilCompensationError.rmsDeg).toBeGreaterThan(0);
    expect(r.metricsMatchExport).toBe(true);

    expect(r.resultDisplay).toBe('flex');
    expect(r.recoilPathExists).toBe(true);
    expect(r.recoilSvgExists).toBe(true);
    expect(r.recoilPathText).toContain('Actual aim');
    expect(r.recoilPathText).toContain('Ideal -aimPunch x2');
  });
});
