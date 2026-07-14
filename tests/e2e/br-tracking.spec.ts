import { test, expect } from '@playwright/test';
import { deriveLeadError } from '../../src/metrics/leadDerivation.ts';
import type { ExportPayload } from '../../src/data/export.ts';

const URL = 'http://localhost:5173/';
const BR_PROTOCOL_ID = 'br_tracking_v1';
const CANONICAL_BR_DRILL_ID = 'tracking_br_v1';
const HITSCAN_HIT_SMOKE_ID = 'tracking_br_v1__ads_on__hitscan__2deg';
const PRESENTATIONS = 10;

async function waitForHarness(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __fpsTest?: unknown }).__fpsTest)), {
      timeout: 15_000,
    })
    .toBe(true);
}

test.describe('WP-26 T4 BR tracking E2E acceptance', () => {
  test('tracking_br_v1 canonical projectile condition exports BR scene, ADS, tracking, and lead data', async ({
    page,
  }) => {
    await waitForHarness(page);

    const r = await page.evaluate((drillId) => {
      type TrackingPresentation = {
        acquisitionFailure: boolean;
        tAcquireMs?: number;
        totPercent?: number;
        rmsEpsilonDeg?: number;
      };
      type Harness = {
        startDrill(id: string): void;
        feedInput(seq: Array<{ type: 'ads' | 'fire'; down: boolean; t: number }>): void;
        runTrackingPresentationRound(mode?: 'autoAim' | 'stationary', maxPresentations?: number): void;
        forceExportJSON(): ExportPayload;
        trackingMetricsFromExport(payload: ExportPayload): {
          acquisitionFailureRate: number;
          presentations: TrackingPresentation[];
        };
        phase(): string;
      };
      const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;
      const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

      harness.startDrill(drillId);
      harness.feedInput([
        { type: 'ads', down: true, t: 0 },
        { type: 'fire', down: true, t: 20 },
        { type: 'fire', down: false, t: 30 },
      ]);
      harness.runTrackingPresentationRound('autoAim');
      harness.feedInput([{ type: 'ads', down: false, t: 0 }]);

      const payload = harness.forceExportJSON();
      const tracking = harness.trackingMetricsFromExport(payload);
      const adsEvents = payload.events.filter((event) => event.type === 'ads');
      const fireEvents = payload.events.filter((event) => event.type === 'fire');
      const visibleEvents = payload.events.filter((event) => event.type === 'visible');
      const targetTicks = payload.ticks.filter((tick) => tick.tx !== null && tick.ty !== null && tick.tz !== null);

      return {
        coi: window.crossOriginIsolated,
        phase: harness.phase(),
        payload,
        tracking,
        adsEvents,
        fireEvents,
        visibleCount: visibleEvents.length,
        targetTickCount: targetTicks.length,
        allTickColumnsFinite: payload.ticks.every(
          (tick) =>
            finite(tick.t) &&
            finite(tick.px) &&
            finite(tick.pz) &&
            finite(tick.aim.yaw) &&
            finite(tick.aim.pitch) &&
            typeof tick.ads === 'boolean' &&
            (tick.tx === null || finite(tick.tx)) &&
            (tick.ty === null || finite(tick.ty)) &&
            (tick.tz === null || finite(tick.tz)),
        ),
        hasMovingTargetSamples: new Set(targetTicks.map((tick) => tick.tx)).size > 1,
      };
    }, CANONICAL_BR_DRILL_ID);

    expect(r.coi).toBe(true);
    expect(r.phase).toBe('ended');
    expect(r.payload.meta.drillId).toBe(CANONICAL_BR_DRILL_ID);
    expect(r.payload.meta.scene).toMatchObject({
      sceneId: 'br-field',
      assetPackVersion: 'br-field-v1',
      clutterTier: 'low',
      fallback: false,
    });
    expect(r.payload.meta.weapon).toMatchObject({
      id: 'ak47_br_ads_projectile',
      ads: { fovDeg: 40, sensitivityRatio: 1 },
      bullet: { model: 'projectile', speedU: 916.73, gravityU: 32, maxRangeU: 143.24 },
      projectileOverflow: false,
    });
    expect(r.payload.meta.targets).toMatchObject({ hitbox: { widthU: 0.5, heightU: 1, depthU: 0.5 } });
    expect(r.payload.meta.spawn).toMatchObject({
      spawnArea: { yawDegRange: [0, 0], distanceURange: [expect.any(Number), expect.any(Number)] },
      motion: { type: 'pingpong', axis: 'horizontal', range: expect.any(Number), speed: expect.any(Number) },
      presentationMs: 2000,
    });
    expect(r.payload.meta.suspect).toBe(false);
    expect(r.payload.ticks.length).toBeGreaterThan(0);
    expect(r.allTickColumnsFinite).toBe(true);
    expect(r.targetTickCount).toBeGreaterThan(0);
    expect(r.hasMovingTargetSamples).toBe(true);
    expect(r.visibleCount).toBe(PRESENTATIONS);
    expect(r.adsEvents).toEqual([
      expect.objectContaining({ type: 'ads', down: true }),
      expect.objectContaining({ type: 'ads', down: false }),
    ]);
    expect(r.payload.ticks.some((tick) => tick.ads)).toBe(true);
    expect(r.fireEvents).toHaveLength(1);
    expect(r.fireEvents[0]).toMatchObject({ type: 'fire', firstShot: true, shotSeq: 1 });
    expect(r.tracking.acquisitionFailureRate).toBe(0);
    expect(r.tracking.presentations).toHaveLength(PRESENTATIONS);
    expect(r.tracking.presentations.every((p) => p.tAcquireMs !== undefined && p.tAcquireMs <= 16)).toBe(true);
    expect(r.tracking.presentations.every((p) => p.totPercent !== undefined && p.totPercent >= 99)).toBe(true);
    expect(r.tracking.presentations.every((p) => p.rmsEpsilonDeg !== undefined && p.rmsEpsilonDeg < 0.1)).toBe(true);

    const lead = deriveLeadError(r.payload);
    expect(lead.samples).toHaveLength(1);
    expect(lead.samples[0]).toMatchObject({ shotSeq: 1, timeOfFlightSource: expect.any(String) });
    expect(Number.isFinite(lead.samples[0].timeOfFlightMs)).toBe(true);
    expect(Number.isFinite(lead.samples[0].leadErrorDeg)).toBe(true);
  });

  test('BR protocol exports condition metadata and a BR ADS hitscan condition can record a hit', async ({ page }) => {
    await waitForHarness(page);

    const r = await page.evaluate(
      async ({ protocolId, hitDrillId }) => {
        type Harness = {
          runBrTrackingProtocol(): Promise<ExportPayload[]>;
          startDrill(id: string): void;
          feedInput(seq: Array<{ type: 'ads' | 'fire'; down: boolean; t: number }>): void;
          forceExportJSON(): ExportPayload;
        };
        const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;
        const protocolPayloads = await harness.runBrTrackingProtocol();

        harness.startDrill(hitDrillId);
        harness.feedInput([
          { type: 'ads', down: true, t: 0 },
          { type: 'fire', down: true, t: 20 },
          { type: 'fire', down: false, t: 30 },
          { type: 'ads', down: false, t: 50 },
        ]);
        const hitPayload = harness.forceExportJSON();
        const hitFires = hitPayload.events.filter((event) => event.type === 'fire');

        return {
          protocol: protocolPayloads.map((payload) => ({
            drillId: payload.meta.drillId,
            scene: payload.meta.scene,
            protocol: payload.meta.protocol,
            display: payload.meta.display,
            weapon: payload.meta.weapon,
            suspect: payload.meta.suspect,
            visibleCount: payload.events.filter((event) => event.type === 'visible').length,
            anyAdsTick: payload.ticks.some((tick) => tick.ads),
          })),
          hitPayload,
          hitFires,
          protocolId,
        };
      },
      { protocolId: BR_PROTOCOL_ID, hitDrillId: HITSCAN_HIT_SMOKE_ID },
    );

    expect(r.protocol).toHaveLength(8);
    expect(r.protocol.map((item) => item.protocol?.protocolId)).toEqual(Array(8).fill(BR_PROTOCOL_ID));
    expect(r.protocol.map((item) => item.protocol?.conditionIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(r.protocol.map((item) => item.protocol?.conditionLabel)).toEqual([
      'br-ads_off-hitscan-0p5deg',
      'br-ads_on-hitscan-0p5deg',
      'br-ads_off-projectile-0p5deg',
      'br-ads_on-projectile-0p5deg',
      'br-ads_off-hitscan-2deg',
      'br-ads_on-hitscan-2deg',
      'br-ads_off-projectile-2deg',
      'br-ads_on-projectile-2deg',
    ]);
    for (const item of r.protocol) {
      expect(item.scene).toMatchObject({ sceneId: 'br-field', fallback: false });
      expect(item.display?.mode).toBe('native');
      expect(item.suspect).toBe(false);
      expect(item.visibleCount).toBe(PRESENTATIONS);
    }
    expect(r.protocol.map((item) => item.weapon?.bullet !== undefined)).toEqual([
      false,
      false,
      true,
      true,
      false,
      false,
      true,
      true,
    ]);
    expect(r.protocol.map((item) => item.anyAdsTick)).toEqual([
      false,
      true,
      false,
      true,
      false,
      true,
      false,
      true,
    ]);

    expect(r.hitPayload.meta.drillId).toBe(HITSCAN_HIT_SMOKE_ID);
    expect(r.hitPayload.meta.scene).toMatchObject({ sceneId: 'br-field', fallback: false });
    expect(r.hitPayload.meta.weapon).toMatchObject({ id: 'ak47_br_ads_hitscan', ads: { fovDeg: 40 } });
    expect(r.hitFires.some((event) => event.type === 'fire' && event.hit === true)).toBe(true);
  });
});
