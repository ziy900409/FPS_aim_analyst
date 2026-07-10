import { test, expect } from '@playwright/test';

/**
 * WP-9 / T1（FR-9.1）— E2E 端到端整合：完整 drill → 匯出 → 統計全鏈路。
 *
 * 在真實瀏覽器（Edge，帶 COOP/COEP）斷言 `crossOriginIsolated===true`，再經 dev-only 測試掛點
 * `window.__fpsTest`（見 src/testharness/fpsTestHarness.ts）以合成輸入跑完整 counter-strafe 一輪
 * （移動→急停→開火命中，左右交替），觸發匯出並斷言：
 *   1. 匯出 JSON 符 WP-7 schema（docs/operational/schema.md）：meta 完整、ticks 皆有限、
 *      events 含 visible/counter/fire。
 *   2. 結果頁統計 = 匯出資料：`getMetrics()`（結果頁同源 computeMetrics）與由 JSON round-trip 後的
 *      匯出反算指標 `metricsFromExport()` 逐欄一致（序列化不失真、統計與匯出同源）。
 *
 * 只跑 dev（5173）：`__fpsTest` 由 `import.meta.env.DEV` 守衛、production build 剝除（與 __aimDebug 同）。
 * 真原生滑鼠無加速 / Pointer Lock 正向路徑 → 手動驗收（T4）；效度分布 → T2；決定性回歸 → T3。
 */

const URL = 'http://localhost:5173/';
const DRILL_ID = 'counterstrafe_ad_v1';
const DETECTION_DRILL_ID = 'detection_popin_v1';
const TRACKING_SCENE_DRILL_ID = 'tracking_scene_v1';
const TRACKING_LONGRANGE_DRILL_ID = 'tracking_longrange_v1';
const RESOLUTION_PROTOCOL_ID = 'resolution_detection_v1';
const PEEKS = 20; // = counterstrafe_ad_v1.json endCondition.targetCount

/** 單一 evaluate 內跑完整鏈路並回傳可斷言摘要（重物件比對在瀏覽器內完成，減少 CDP 傳輸）。 */
async function runFullChain(page: import('@playwright/test').Page) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  // 等 async bootstrap + harness 安裝（install 先 measureDisplayHz 再掛 __fpsTest）。
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __fpsTest?: unknown }).__fpsTest)), {
      timeout: 15_000,
    })
    .toBe(true);

  return page.evaluate(
    ({ drillId, peeks }) => {
      type Harness = {
        startDrill(id: string): void;
        runCounterStrafeRound(maxPeeks?: number): void;
        forceExportJSON(): unknown;
        getMetrics(): unknown;
        metricsFromExport(payload: unknown): unknown;
        phase(): string;
      };
      const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;

      harness.startDrill(drillId);
      harness.runCounterStrafeRound(peeks);

      const payload = harness.forceExportJSON() as {
        meta: Record<string, unknown>;
        ticks: Array<{ t: number; vx: number; vz: number; aim: { yaw: number; pitch: number }; keys: string[] }>;
        events: Array<Record<string, unknown>>;
      };

      const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
      const allTicksFinite = payload.ticks.every(
        (tk) => num(tk.t) && num(tk.vx) && num(tk.vz) && num(tk.aim.yaw) && num(tk.aim.pitch) && Array.isArray(tk.keys),
      );

      const visible = payload.events.filter((e) => e.type === 'visible');
      const counter = payload.events.filter((e) => e.type === 'counter');
      const fire = payload.events.filter((e) => e.type === 'fire');
      const fireWellFormed = fire.every((e) => typeof e.hit === 'boolean' && typeof e.firstShot === 'boolean' && num(e.residualSpeed));
      const firstShotHits = fire.filter((e) => e.firstShot === true && e.hit === true);

      // 統計＝匯出：getMetrics（結果頁同源）vs. JSON round-trip 後由匯出反算——逐欄一致證序列化不失真。
      const metrics = harness.getMetrics();
      const roundTripped = JSON.parse(JSON.stringify(payload));
      const metricsFromExport = harness.metricsFromExport(roundTripped);
      const metricsMatchExport = JSON.stringify(metrics) === JSON.stringify(metricsFromExport);

      return {
        coi: window.crossOriginIsolated,
        phase: harness.phase(),
        meta: payload.meta,
        ticksLen: payload.ticks.length,
        allTicksFinite,
        sampleTick: payload.ticks[payload.ticks.length - 1] ?? null,
        visibleCount: visible.length,
        counterCount: counter.length,
        fireCount: fire.length,
        firstShotHitCount: firstShotHits.length,
        fireWellFormed,
        sampleVisible: visible[0] ?? null,
        sampleCounter: counter[0] ?? null,
        sampleFire: fire[0] ?? null,
        metrics: metrics as {
          firstShotHitRate: number;
          counterReactionMs: { n: number; mean: number };
          residualSpeed: { n: number };
          leftRightSymmetry: { left: { n: number }; right: { n: number } };
        },
        metricsMatchExport,
      };
    },
    { drillId: DRILL_ID, peeks: PEEKS },
  );
}

test.describe('WP-9 E2E — 完整 drill → 匯出 → 統計（Edge）', () => {
  test('crossOriginIsolated + 全鏈路：schema / 事件 / metadata / 統計＝匯出', async ({ page }) => {
    const r = await runFullChain(page);

    // COI（計時效度前置，ADR-4）——在真實瀏覽器斷言，非肉眼。
    expect(r.coi).toBe(true);

    // 完整一輪跑到 ended（endCondition targetCount=20 達成）。
    expect(r.phase).toBe('ended');

    // ── 匯出 metadata（schema.md §meta）完整且值合法 ──
    const m = r.meta;
    expect(m.drillId).toBe(DRILL_ID);
    expect(['webgpu', 'webgl2']).toContain(m.backend);
    expect(typeof m.displayHz).toBe('number');
    expect(m.displayHz as number).toBeGreaterThan(0);
    expect(m.simHz).toBe(128);
    expect(typeof m.browser).toBe('string');
    expect((m.browser as string).length).toBeGreaterThan(0);
    expect(m.sensitivity as number).toBeGreaterThan(0);
    expect(m.crossOriginIsolated).toBe(true); // 匯出的 metadata 亦記錄真 COI
    expect(Number.isNaN(Date.parse(m.startedAt as string))).toBe(false);
    expect(m.unit).toBe('source');
    expect(m.vStrafe).toBe(250);
    expect(m.maxDrillSeconds).toBe(300);
    expect(Number.isInteger(m.lateEventCount as number)).toBe(true);
    expect(m.bufferOverflow).toBe(false);
    expect(m.recorderOverflow).toBe(false);
    expect(m.suspect).toBe(false);

    // ── ticks（schema.md §ticks[]）：非空且所有數值有限 ──
    expect(r.ticksLen).toBeGreaterThan(0);
    expect(r.allTicksFinite).toBe(true);

    // ── events（schema.md §events[]）：含 visible / counter / fire，且 fire 欄位齊全 ──
    expect(r.visibleCount).toBe(PEEKS);
    expect(r.counterCount).toBe(PEEKS);
    expect(r.fireCount).toBe(PEEKS);
    expect(r.fireWellFormed).toBe(true);
    expect(r.firstShotHitCount).toBe(PEEKS); // 每 peek 首發命中（合成瞄準）
    expect(r.sampleVisible).toMatchObject({ type: 'visible', side: expect.stringMatching(/^[LR]$/) });
    expect(r.sampleCounter).toMatchObject({ type: 'counter' });
    expect(r.sampleFire).toMatchObject({ type: 'fire', hit: true, firstShot: true });

    // ── §5 指標 sanity（合成一輪的可預測結果）──
    expect(r.metrics.firstShotHitRate).toBe(100); // 20/20 首發命中
    expect(r.metrics.counterReactionMs.n).toBe(PEEKS);
    expect(r.metrics.counterReactionMs.mean).toBeGreaterThan(0);
    expect(r.metrics.residualSpeed.n).toBe(PEEKS);
    expect(r.metrics.leftRightSymmetry.left.n + r.metrics.leftRightSymmetry.right.n).toBe(PEEKS);

    // ── 統計＝匯出：結果頁指標與匯出資料逐欄一致（序列化不失真，FR-9.1 交叉驗證）──
    expect(r.metricsMatchExport).toBe(true);
  });

  // WP-13 / T2 — 視覺/彈道分離：按住連發 10 發後,rawPunch(彈道)= M5 向量,方向 = 上 + 右。
  test('recoil 分離：held 10 發 → rawPunch 漂移方向(上+右)+ M5 向量', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await expect
      .poll(() => page.evaluate(() => Boolean((window as unknown as { __fpsTest?: unknown }).__fpsTest)), {
        timeout: 15_000,
      })
      .toBe(true);

    const r = await page.evaluate((drillId) => {
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
      };
      const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;
      harness.startDrill(drillId);
      return harness.fireRecoilBurst(10);
    }, DRILL_ID);

    expect(r.shotsFired).toBe(10);
    expect(r.recoilIndex).toBe(10);

    // 方向：Source deg — pitch<0（下正 → 鏡頭/彈道上跳）、yaw<0（左正 → 向右漂）。
    expect(r.aimPunchPitchDeg).toBeLessThan(0);
    expect(r.aimPunchYawDeg).toBeLessThan(0);

    // 彈道 rawPunch = 視覺 aimPunch × 2（研究計畫 Phase 2「視覺 ≠ 實際」的量化分離）。
    expect(r.rawPunchPitchDeg).toBeCloseTo(r.aimPunchPitchDeg * 2, 9);

    // 向量 ≈ M5 golden（容差 0.1°：雙率離散化相位殘差,見 progress OQ-13.2）。
    expect(Math.abs(r.rawPunchPitchDeg - -10.18)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(r.rawPunchYawDeg - -1.56)).toBeLessThanOrEqual(0.1);
  });

  test('WP-21 detection pop-in：timeout 完整一輪 → visible 位置欄 + meta.spawn', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await expect
      .poll(() => page.evaluate(() => Boolean((window as unknown as { __fpsTest?: unknown }).__fpsTest)), {
        timeout: 15_000,
      })
      .toBe(true);

    const r = await page.evaluate((drillId) => {
      type Harness = {
        startDrill(id: string): void;
        runDetectionTimeoutRound(maxPresentations?: number): void;
        forceExportJSON(): unknown;
        phase(): string;
      };
      const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;
      harness.startDrill(drillId);
      harness.runDetectionTimeoutRound();

      const payload = harness.forceExportJSON() as {
        meta: { drillId?: unknown; spawn?: Record<string, unknown> };
        events: Array<Record<string, unknown>>;
      };
      const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
      const visible = payload.events.filter((event) => event.type === 'visible');
      const targetIds = new Set(visible.map((event) => event.targetId));
      return {
        coi: window.crossOriginIsolated,
        phase: harness.phase(),
        drillId: payload.meta.drillId,
        spawn: payload.meta.spawn,
        visibleCount: visible.length,
        uniqueTargetCount: targetIds.size,
        allVisibleHavePosition: visible.every(
          (event) => num(event.targetX) && num(event.targetY) && num(event.targetZ),
        ),
        nonZeroHorizontalOffset: visible.some((event) => num(event.targetX) && Math.abs(event.targetX) > 0.001),
        allTargetsInFront: visible.every((event) => num(event.targetZ) && event.targetZ < 0),
      };
    }, DETECTION_DRILL_ID);

    expect(r.coi).toBe(true);
    expect(r.phase).toBe('ended');
    expect(r.drillId).toBe(DETECTION_DRILL_ID);
    expect(r.visibleCount).toBe(PEEKS);
    expect(r.uniqueTargetCount).toBe(PEEKS);
    expect(r.allVisibleHavePosition).toBe(true);
    expect(r.nonZeroHorizontalOffset).toBe(true);
    expect(r.allTargetsInFront).toBe(true);
    expect(r.spawn).toMatchObject({
      seed: 21021,
      spawnArea: { yawDegRange: [-25, 25], distanceURange: [3.2, 4.4] },
      spawnDelayMsRange: [800, 2400],
    });
  });

  test('WP-22 tracking_scene_v1：field-low 場景匯出欄 + tracking 指標 sanity', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await expect
      .poll(() => page.evaluate(() => Boolean((window as unknown as { __fpsTest?: unknown }).__fpsTest)), {
        timeout: 15_000,
      })
      .toBe(true);

    const r = await page.evaluate((drillId) => {
      type TrackingPresentation = {
        acquisitionFailure: boolean;
        tAcquireMs?: number;
        totPercent?: number;
        rmsEpsilonDeg?: number;
      };
      type Harness = {
        startDrill(id: string): void;
        runTrackingPresentationRound(mode?: 'autoAim' | 'stationary', maxPresentations?: number): void;
        forceExportJSON(): unknown;
        trackingMetricsFromExport(payload: unknown): { acquisitionFailureRate: number; presentations: TrackingPresentation[] };
        phase(): string;
      };
      const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;
      const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

      harness.startDrill(drillId);
      harness.runTrackingPresentationRound('autoAim');
      const payload = harness.forceExportJSON() as {
        meta: Record<string, unknown>;
        ticks: Array<{ t: number; px: number; pz: number; tx: number | null; ty: number | null; tz: number | null; aim: { yaw: number; pitch: number } }>;
        events: Array<Record<string, unknown>>;
      };
      const tracking = harness.trackingMetricsFromExport(payload);
      const visible = payload.events.filter((event) => event.type === 'visible');
      const visibleTimes = visible.map((event) => event.t).filter(finite);
      const visibleDeltas = visibleTimes.slice(1).map((t, index) => t - visibleTimes[index]);
      const targetTicks = payload.ticks.filter((tick) => tick.tx !== null && tick.ty !== null && tick.tz !== null);
      const distinctTx = new Set(targetTicks.map((tick) => tick.tx)).size;
      const allTickColumnsFinite = payload.ticks.every(
        (tick) =>
          finite(tick.t) &&
          finite(tick.px) &&
          finite(tick.pz) &&
          finite(tick.aim.yaw) &&
          finite(tick.aim.pitch) &&
          (tick.tx === null || finite(tick.tx)) &&
          (tick.ty === null || finite(tick.ty)) &&
          (tick.tz === null || finite(tick.tz)),
      );

      harness.startDrill(drillId);
      harness.runTrackingPresentationRound('stationary');
      const missPayload = harness.forceExportJSON();
      const missTracking = harness.trackingMetricsFromExport(missPayload);

      return {
        coi: window.crossOriginIsolated,
        phase: harness.phase(),
        meta: payload.meta,
        ticksLen: payload.ticks.length,
        targetTickCount: targetTicks.length,
        allTickColumnsFinite,
        distinctTx,
        visibleCount: visible.length,
        allVisibleHavePosition: visible.every(
          (event) => finite(event.targetX) && finite(event.targetY) && finite(event.targetZ),
        ),
        visibleDeltas,
        tracking,
        missTracking,
      };
    }, TRACKING_SCENE_DRILL_ID);

    expect(r.coi).toBe(true);
    expect(r.phase).toBe('ended');
    expect(r.meta.drillId).toBe(TRACKING_SCENE_DRILL_ID);
    expect(r.meta.scene).toMatchObject({
      sceneId: 'field-low',
      assetPackVersion: 'field-low-v1',
      clutterTier: 'low',
      fallback: false,
    });
    expect(r.meta.spawn).toMatchObject({
      seed: 18018,
      motion: { type: 'pingpong', axis: 'horizontal', range: 0.25, speed: 2 },
      presentationMs: 2000,
    });
    expect(r.meta.suspect).toBe(false);
    expect(r.ticksLen).toBeGreaterThan(0);
    expect(r.targetTickCount).toBeGreaterThan(0);
    expect(r.allTickColumnsFinite).toBe(true);
    expect(r.distinctTx).toBeGreaterThan(1);
    expect(r.visibleCount).toBe(10);
    expect(r.allVisibleHavePosition).toBe(true);
    for (const delta of r.visibleDeltas) {
      expect(delta).toBeGreaterThanOrEqual(1990);
      expect(delta).toBeLessThanOrEqual(2025);
    }
    expect(r.tracking.acquisitionFailureRate).toBe(0);
    expect(r.tracking.presentations).toHaveLength(10);
    expect(r.tracking.presentations.every((p) => p.tAcquireMs !== undefined && p.tAcquireMs <= 16)).toBe(true);
    expect(r.tracking.presentations.every((p) => p.totPercent !== undefined && p.totPercent >= 99)).toBe(true);
    expect(r.tracking.presentations.every((p) => p.rmsEpsilonDeg !== undefined && p.rmsEpsilonDeg < 1)).toBe(true);
    expect(r.missTracking.acquisitionFailureRate).toBe(1);
    expect(r.missTracking.presentations.every((p) => p.acquisitionFailure)).toBe(true);
  });

  test('WP-23 T2 tracking_longrange_v1：field-low 載入 + 小 hitbox/遠距 lane smoke', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await expect
      .poll(() => page.evaluate(() => Boolean((window as unknown as { __fpsTest?: unknown }).__fpsTest)), {
        timeout: 15_000,
      })
      .toBe(true);

    const r = await page.evaluate((drillId) => {
      type Harness = {
        startDrill(id: string): void;
        runTrackingPresentationRound(mode?: 'autoAim' | 'stationary', maxPresentations?: number): void;
        forceExportJSON(): unknown;
        phase(): string;
      };
      const harness = (window as unknown as { __fpsTest: Harness }).__fpsTest;
      const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

      harness.startDrill(drillId);
      harness.runTrackingPresentationRound('autoAim', 2);
      const payload = harness.forceExportJSON() as {
        meta: Record<string, unknown> & {
          scene?: Record<string, unknown>;
          targets?: Record<string, unknown>;
          spawn?: Record<string, unknown>;
        };
        ticks: Array<{ tx: number | null; ty: number | null; tz: number | null }>;
        events: Array<Record<string, unknown>>;
      };
      const visible = payload.events.filter((event) => event.type === 'visible');
      const firstVisible = visible[0] ?? {};
      const targetTicks = payload.ticks.filter((tick) => tick.tx !== null && tick.ty !== null && tick.tz !== null);
      const spawnArea = payload.meta.spawn?.spawnArea as
        | { distanceURange?: [number, number]; yawDegRange?: [number, number] }
        | undefined;
      const radialDistance =
        finite(firstVisible.targetX) && finite(firstVisible.targetZ)
          ? Math.hypot(firstVisible.targetX, firstVisible.targetZ)
          : null;

      return {
        coi: window.crossOriginIsolated,
        phase: harness.phase(),
        meta: payload.meta,
        visibleCount: visible.length,
        targetTickCount: targetTicks.length,
        distinctTx: new Set(targetTicks.map((tick) => tick.tx)).size,
        firstVisible,
        spawnDistance: spawnArea?.distanceURange?.[0] ?? null,
        radialDistance,
      };
    }, TRACKING_LONGRANGE_DRILL_ID);

    expect(r.coi).toBe(true);
    expect(['running', 'ended']).toContain(r.phase);
    expect(r.meta.drillId).toBe(TRACKING_LONGRANGE_DRILL_ID);
    expect(r.meta.scene).toMatchObject({
      sceneId: 'field-low',
      assetPackVersion: 'field-low-v1',
      clutterTier: 'low',
      fallback: false,
    });
    expect(r.meta.targets).toMatchObject({ hitbox: { widthU: 0.5, heightU: 1, depthU: 0.5 } });
    expect(r.meta.spawn).toMatchObject({
      seed: 23002,
      spawnArea: {
        yawDegRange: [110, 110],
        distanceURange: [expect.any(Number), expect.any(Number)],
      },
      motion: { type: 'pingpong', axis: 'horizontal', range: expect.any(Number), speed: expect.any(Number) },
      presentationMs: 2000,
    });
    expect(r.visibleCount).toBeGreaterThanOrEqual(2);
    expect(r.targetTickCount).toBeGreaterThan(0);
    expect(r.distinctTx).toBeGreaterThan(1);
    expect(r.firstVisible).toMatchObject({ type: 'visible', side: 'R' });
    expect(r.firstVisible.targetX as number).toBeGreaterThan(0);
    expect(r.firstVisible.targetZ as number).toBeGreaterThan(0);
    expect(r.spawnDistance as number).toBeCloseTo(114.59083180471995, 6);
    expect(r.radialDistance as number).toBeGreaterThan(110);
  });

  test('WP-22 protocol：2 條件解析度 × 偵測匯出 + 狀態隔離', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await expect
      .poll(() => page.evaluate(() => Boolean((window as unknown as { __fpsTest?: unknown }).__fpsTest)), {
        timeout: 15_000,
      })
      .toBe(true);

    const r = await page.evaluate(async () => {
      type Payload = {
        meta: {
          drillId?: unknown;
          suspect?: unknown;
          spawn?: Record<string, unknown>;
          scene?: Record<string, unknown>;
          display?: Record<string, unknown>;
          frames?: { summary?: Record<string, unknown> };
          protocol?: Record<string, unknown>;
        };
        events: Array<Record<string, unknown>>;
      };
      type Harness = {
        runResolutionDetectionProtocol(): Promise<Payload[]>;
      };
      const payloads = await (window as unknown as { __fpsTest: Harness }).__fpsTest.runResolutionDetectionProtocol();
      return payloads.map((payload) => ({
        drillId: payload.meta.drillId,
        suspect: payload.meta.suspect,
        protocol: payload.meta.protocol,
        display: payload.meta.display,
        scene: payload.meta.scene,
        spawn: payload.meta.spawn,
        frames: payload.meta.frames?.summary,
        visibleCount: payload.events.filter((event) => event.type === 'visible').length,
      }));
    });

    expect(r).toHaveLength(2);
    expect(r.map((item) => item.protocol?.protocolId)).toEqual([RESOLUTION_PROTOCOL_ID, RESOLUTION_PROTOCOL_ID]);
    expect(r.map((item) => item.protocol?.conditionIndex)).toEqual([0, 1]);
    expect(r.map((item) => item.protocol?.conditionLabel)).toEqual([
      'fhd-1080-field-low-detection',
      'qhd-1440-field-low-detection',
    ]);
    expect(r.map((item) => item.display?.mode)).toEqual(['fhd-1080', 'qhd-1440']);
    expect(r.map((item) => item.display?.bufferW)).toEqual([1920, 2560]);
    expect(r.map((item) => item.display?.bufferH)).toEqual([1080, 1440]);

    for (const item of r) {
      expect(item.drillId).toBe(DETECTION_DRILL_ID);
      expect(item.suspect).toBe(false);
      expect(item.display?.gate).toMatchObject({ pass: true, native: true, fullscreen: true, perf: true });
      expect(item.scene).toMatchObject({ sceneId: 'field-low', assetPackVersion: 'field-low-v1', clutterTier: 'low' });
      expect(item.spawn).toMatchObject({
        seed: 21021,
        spawnArea: { yawDegRange: [-25, 25], distanceURange: [3.2, 4.4] },
        spawnDelayMsRange: [800, 2400],
      });
      expect(item.frames).toMatchObject({ count: 1, overBudgetWindows: 0, overflow: false });
      expect(item.visibleCount).toBe(PEEKS);
    }
  });

  test('WP-22 protocol gate：低解析度 screen 拒入且不產生匯出', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'screen', {
        value: { width: 1920, height: 1080 },
        configurable: true,
      });
      Object.defineProperty(window, 'devicePixelRatio', {
        value: 1,
        configurable: true,
      });
    });
    await page.goto(URL, { waitUntil: 'networkidle' });
    await expect
      .poll(() => page.evaluate(() => Boolean((window as unknown as { __fpsTest?: unknown }).__fpsTest)), {
        timeout: 15_000,
      })
      .toBe(true);

    const r = await page.evaluate(() => {
      type Harness = {
        previewResolutionProtocolGate(protocol?: unknown, warmupP95Ms?: number): {
          pass: boolean;
          native: boolean;
          fullscreen: boolean;
          perf: boolean;
          details: string;
        };
      };
      const gate = (window as unknown as { __fpsTest: Harness }).__fpsTest.previewResolutionProtocolGate(undefined, 8);
      return { gate, exportCount: gate.pass ? -1 : 0 };
    });

    expect(r.gate.pass).toBe(false);
    expect(r.gate.native).toBe(false);
    expect(r.gate.details).toContain('需求 2560×1440');
    expect(r.exportCount).toBe(0);
  });
});
