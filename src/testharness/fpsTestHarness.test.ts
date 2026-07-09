import { describe, expect, it } from 'vitest';
import { createFpsTestHarness } from './fpsTestHarness.ts';
import drillSource from '../../drills/counterstrafe_ad_v1.json';
import { detectionPopinV1 } from '../drill/detection_popin_v1.ts';
import { trackingSceneV1 } from '../drill/tracking_scene_v1.ts';
import { fieldLow } from '../scene/scenes/field-low.ts';
import { urbanHigh } from '../scene/scenes/urban-high.ts';
import type { SceneConfig } from '../scene/SceneConfig.ts';

/**
 * WP-13 / T2 — fpsTestHarness 整合（node 層,對應瀏覽器 E2E full-drill.spec.ts）
 *
 * 因彈道改走 `state.aim + rawPunch`（非 camera 中心）,harness 的合成瞄準 + 連發行為必須配合,
 * 否則 recoil 累積會使首發脫靶。此 node 測試在無瀏覽器下驗證兩件 E2E 依賴的核心行為：
 *   ① tap-fire counter-strafe 一輪 → 20/20 首發命中（分離後補償瞄準仍準）;
 *   ② 按住連發 10 發 → rawPunch = M5 向量（視覺/彈道分離的 punch readout,方向 = 上 + 右）。
 * 真瀏覽器 COI / 真 metadata 仍交 Playwright（見 tests/e2e/full-drill.spec.ts）。
 */

function makeHarness() {
  return createFpsTestHarness({
    availableDrills: [{ id: 'counterstrafe_ad_v1', source: drillSource }],
    backend: 'webgl2',
    crossOriginIsolated: true,
    displayHz: 240,
    sensitivity: 1,
  });
}

function makeDetectionHarness() {
  return createFpsTestHarness({
    availableDrills: [
      { id: 'counterstrafe_ad_v1', source: drillSource },
      { id: detectionPopinV1.drillId, source: detectionPopinV1 },
    ],
    backend: 'webgl2',
    crossOriginIsolated: true,
    displayHz: 240,
    sensitivity: 1,
  });
}

function makeTrackingHarness(scene: SceneConfig = fieldLow) {
  return createFpsTestHarness({
    availableDrills: [{ id: trackingSceneV1.id, source: trackingSceneV1.drill, scene }],
    backend: 'webgl2',
    crossOriginIsolated: true,
    displayHz: 240,
    sensitivity: 1,
  });
}

describe('WP-13 / T2 — harness 整合(分離後仍命中 + recoil 漂移讀數)', () => {
  it('① tap-fire counter-strafe 一輪 → 跑到 ended 且 20/20 首發命中', () => {
    const harness = makeHarness();
    harness.startDrill('counterstrafe_ad_v1');
    harness.runCounterStrafeRound(20);

    expect(harness.phase()).toBe('ended');
    const m = harness.getMetrics();
    // 補償瞄準（state.aim = 目標方向 − rawPunch）使彈道回正 → 每 peek 首發命中。
    expect(m.firstShotHitRate).toBe(100);
    expect(m.residualSpeed.n).toBe(20); // tap-fire：每 peek 恰 1 發 → 20 發（對齊 full-drill fireCount）
  });

  it('② 按住連發 10 發 → rawPunch 重現 M5 向量(pitch −10.18 / yaw −1.56,方向 上+右)', () => {
    const harness = makeHarness();
    harness.startDrill('counterstrafe_ad_v1');
    const r = harness.fireRecoilBurst(10);

    expect(r.shotsFired).toBe(10);
    expect(r.recoilIndex).toBe(10);

    // 方向：aimPunch pitch<0（Source 下正 → 上跳）、yaw<0（左正 → 向右）。
    expect(r.aimPunchPitchDeg).toBeLessThan(0);
    expect(r.aimPunchYawDeg).toBeLessThan(0);

    // 向量：rawPunch = aimPunch×2 ≈ M5 golden。容差 0.1°（E2E 級）：burst 的產彈 tick parity 與 T1
    // recoil-wiring golden 相位不同(此相位殘差 ~0.063°,即 progress OQ-13.2「奇數 tick 衰減」量級),
    // 屬雙率離散化設計固有;0.1° = 目標 1%,仍遠緊於任何真實接線錯誤(錯表/漏 kick/漏 ×2/翻號 >>1°)。
    expect(Math.abs(r.rawPunchPitchDeg - -10.18)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(r.rawPunchYawDeg - -1.56)).toBeLessThanOrEqual(0.1);
  });

  it('② 決定性：同 seed 兩次 burst → rawPunch 位元一致', () => {
    const a = makeHarness();
    a.startDrill('counterstrafe_ad_v1');
    const ra = a.fireRecoilBurst(10);

    const b = makeHarness();
    b.startDrill('counterstrafe_ad_v1');
    const rb = b.fireRecoilBurst(10);

    expect(ra.rawPunchPitchDeg).toBe(rb.rawPunchPitchDeg);
    expect(ra.rawPunchYawDeg).toBe(rb.rawPunchYawDeg);
  });

  it('WP-21 / T2 detection drill：timeout 跑完後匯出 visible 位置欄與 meta.spawn', () => {
    const harness = makeDetectionHarness();
    harness.startDrill('detection_popin_v1');
    harness.runDetectionTimeoutRound();

    expect(harness.phase()).toBe('ended');
    const payload = harness.forceExportJSON();
    const visible = payload.events.filter((event) => event.type === 'visible');
    const targetIds = new Set(visible.map((event) => event.targetId));

    expect(visible).toHaveLength(detectionPopinV1.targets.count);
    expect(targetIds.size).toBe(detectionPopinV1.targets.count);
    expect(visible.some((event) => Math.abs(event.targetX ?? 0) > 0)).toBe(true);
    for (const event of visible) {
      expect(event.targetY).toBe(1.5);
      expect(event.targetZ).toBeLessThan(0);
    }
    expect(payload.meta.spawn).toMatchObject({
      seed: detectionPopinV1.sequence.seed,
      spawnArea: detectionPopinV1.targets.spawnArea,
      spawnDelayMsRange: detectionPopinV1.sequence.spawnDelayMsRange,
    });
  });

  it('WP-22 / T1 tracking_scene_v1：timed presentations export scene + tracking sanity', () => {
    const harness = makeTrackingHarness();
    harness.startDrill(trackingSceneV1.id);
    harness.runTrackingPresentationRound('autoAim');

    expect(harness.phase()).toBe('ended');
    const payload = harness.forceExportJSON();
    const visible = payload.events.filter((event) => event.type === 'visible');
    const targetTx = payload.ticks
      .map((tick) => tick.tx)
      .filter((value): value is number => value !== null);
    const tracking = harness.trackingMetricsFromExport(payload);

    expect(payload.meta.drillId).toBe(trackingSceneV1.id);
    expect(payload.meta.suspect).toBe(false);
    expect(payload.meta.scene).toMatchObject({
      sceneId: 'field-low',
      assetPackVersion: fieldLow.assetPackVersion,
      clutterTier: 'low',
      fallback: false,
    });
    expect(payload.meta.spawn).toMatchObject({
      seed: trackingSceneV1.drill.sequence.seed,
      motion: trackingSceneV1.drill.targets.motion,
      presentationMs: trackingSceneV1.drill.timing.presentationMs,
    });
    expect(visible).toHaveLength(trackingSceneV1.drill.targets.count);
    expect(new Set(targetTx).size).toBeGreaterThan(1);
    expect(tracking.acquisitionFailureRate).toBe(0);
    expect(tracking.presentations.every((p) => p.totPercent !== undefined && p.totPercent >= 99)).toBe(true);

    const miss = makeTrackingHarness();
    miss.startDrill(trackingSceneV1.id);
    miss.runTrackingPresentationRound('stationary');
    const missTracking = miss.trackingMetricsFromExport(miss.forceExportJSON());
    expect(missTracking.acquisitionFailureRate).toBe(1);
    expect(missTracking.presentations.every((p) => p.acquisitionFailure)).toBe(true);
  });

  it('WP-22 / T1 urban-high probe：tracking presentations complete without recorder suspect', () => {
    const harness = makeTrackingHarness(urbanHigh);
    harness.startDrill(trackingSceneV1.id);
    harness.runTrackingPresentationRound('autoAim');

    const payload = harness.forceExportJSON();
    expect(harness.phase()).toBe('ended');
    expect(payload.meta.suspect).toBe(false);
    expect(payload.meta.recorderOverflow).toBe(false);
    expect(payload.meta.scene).toMatchObject({
      sceneId: 'urban-high',
      assetPackVersion: urbanHigh.assetPackVersion,
      clutterTier: 'high',
      fallback: false,
    });
    expect(payload.events.filter((event) => event.type === 'visible')).toHaveLength(trackingSceneV1.drill.targets.count);
    expect(harness.trackingMetricsFromExport(payload).acquisitionFailureRate).toBe(0);
  });
});
