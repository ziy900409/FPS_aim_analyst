import { describe, expect, it } from 'vitest';
import { buildExportPayload, serializeJSON, type ExportPayload } from '../../src/data/export.ts';
import { parseExportPayload } from '../../src/data/exportPayloadSchema.ts';
import { collectMeta } from '../../src/data/metadata.ts';
import { resolveTargetHitbox, targetHitboxToConfig } from '../../src/drill/DrillConfig.ts';
import {
  SPIDER_SHOT_WIDE_PITCH_BANDS,
  SPIDER_SHOT_WIDE_SEED,
} from '../../src/drill/spider_shot_wide_v1.ts';
import {
  SPIDER_WIDE_DISTANCE_U,
  SPIDER_WIDE_SCREEN_MARGIN,
  SPIDER_WIDE_TARGET_ANGULAR_DIAMETER_DEG,
  SPIDER_WIDE_YAW_EDGE_FACTOR,
} from '../../src/drill/spiderShotWide.ts';
import { deriveSpiderShotTransitions } from '../../src/metrics/spiderShotConditions.ts';
import { resolveEyeWorldBase } from '../../src/scene/eyePose.ts';
import { wideFlickArena } from '../../src/scene/scenes/wide-flick-arena.ts';
import { spiderWideEyeAngles } from '../../src/sim/spiderEyeFrame.ts';
import {
  FIXTURE_ASPECT,
  FIXTURE_FOV_DEG,
  canonicalWideFrames,
  runWide,
  wideDrillConfig,
} from './spiderWideDeterminismFixture.ts';

/**
 * WP-57 / T4（FR-57.10／57.11）—— 匯出 metadata round-trip 與 `side`。
 *
 * **這個測試證明什麼**：離線分析可以在**零額外假設**下重建刺激幾何。`aspect` 是唯一一個原本不在任何
 * 匯出欄位裡的量（README §0 discovery item 5），它現在經由 `spiderShot.resolvedFrom` 落進
 * `meta.spawn.spiderShot`，因此「這個 yaw 窗是怎麼算出來的」不需要反推。
 *
 * **管線是既有的，不是本 task 新增的**：`main.ts` 早已把 `activeDrillConfig.spiderShot` **整塊**
 * 複製進 `meta.spawn.spiderShot`（opaque `unknown`），`parseExportPayload` 亦原樣 pass-through。
 * 故 resolved 參數只要在 resolved config 裡就會自動落匯出 —— 本 task 要做的是**證明**而非擴充 schema。
 * 下方的 meta 組裝逐行對齊 `src/main.ts` 的 `spawn` / `targets` / `scene` 三段。
 *
 * 註：payload 來自 `spiderWideDeterminismFixture` 的真實 run（`SimLoop` + `TargetManager` +
 * `DrillRunner` + `HitDetector` + `DataRecorder`），不是手寫事件序列 —— round-trip 若只驗合成資料，
 * 就證明不了生產路徑真的把這些欄位寫出去。
 *
 * ⚠️ **frame 語意**：`deriveSpiderShotTransitions()` 已於 KI-026／BD-026（GD-32 ④）改為 **eye-frame**
 * （payload eye + 逐 tick 玩家位置）。本檔的期望值一律以 eye-frame 為準；README §2.5.1 記載的
 * origin-frame 偏差數字（27.937°／43.6%／2.408°／4.0%）是拍板**前**的量測，只有歷史意義，不得
 * 拿來當期望值。
 */

const run = runWide(canonicalWideFrames());
const config = wideDrillConfig();
const payload = buildRoundTripPayload();

describe('WP-57 T4 — FR-57.10：resolved 刺激幾何的匯出 round-trip', () => {
  it('parses back through the strict export boundary with the spiderShot block intact', () => {
    const parsed = parseExportPayload(JSON.parse(serializeJSON(payload)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.payload.meta.spawn?.spiderShot).toEqual(config.spiderShot);
    // seed 的單一權威：`meta.spawn.seed` 與排程內的 seed 同值（GD-5）。
    expect(parsed.payload.meta.spawn?.seed).toBe(SPIDER_SHOT_WIDE_SEED);
  });

  it('restores yawMagDegRange / pitchDegRange / distanceU / grid / seed bit-for-bit', () => {
    const source = config.spiderShot;
    const restored = parseSpiderShot();
    if (source?.kind !== 'center-peripheral-yawpitch') throw new Error('fixture drill must be the yawpitch schedule');

    expect(restored.kind).toBe('center-peripheral-yawpitch');
    expectBitIdenticalPair(restored.peripheral.yawMagDegRange, source.peripheral.yawMagDegRange);
    expectBitIdenticalPair(restored.peripheral.pitchDegRange, source.peripheral.pitchDegRange);
    expect(Object.is(restored.distanceU, source.distanceU)).toBe(true);
    expect(restored.grid).toEqual({ pitchBands: SPIDER_SHOT_WIDE_PITCH_BANDS });
    expect(Object.is(restored.seed, source.seed)).toBe(true);
    expect(restored.centerExemptFromTimeout).toBe(true);
  });

  it('restores the five resolvedFrom provenance fields, including the otherwise-unexported aspect', () => {
    const restored = parseSpiderShot().resolvedFrom;

    expect(Object.is(restored.fovDegVertical, FIXTURE_FOV_DEG)).toBe(true);
    // aspect 在 WP-57 之前完全不在匯出裡（README §0 item 5）；沒有它就無法離線重建 yaw 窗。
    expect(Object.is(restored.aspect, FIXTURE_ASPECT)).toBe(true);
    expect(Object.is(restored.screenMargin, SPIDER_WIDE_SCREEN_MARGIN)).toBe(true);
    expect(Object.is(restored.kLo, SPIDER_WIDE_YAW_EDGE_FACTOR)).toBe(true);
    expect(Object.is(restored.targetAngularDiameterDeg, SPIDER_WIDE_TARGET_ANGULAR_DIAMETER_DEG)).toBe(true);
  });

  it('lets an offline reader re-derive the exact yaw window from resolvedFrom alone', () => {
    const restored = parseSpiderShot();
    const { fovDegVertical, aspect, screenMargin, kLo, targetAngularDiameterDeg } = restored.resolvedFrom;

    // README §2.4 的閉式，逐字重算（實作走 `resolveSpiderWideYawPitch()`，這裡走匯出欄位）。
    const halfHFov = Math.atan(Math.tan(((fovDegVertical / 2) * Math.PI) / 180) * aspect);
    const angularRadiusRad = ((targetAngularDiameterDeg / 2) * Math.PI) / 180;
    const yawMaxDeg = ((Math.atan((1 - screenMargin) * Math.tan(halfHFov)) - angularRadiusRad) * 180) / Math.PI;

    expect(restored.peripheral.yawMagDegRange[1]).toBeCloseTo(yawMaxDeg, 12);
    expect(restored.peripheral.yawMagDegRange[0]).toBeCloseTo(kLo * yawMaxDeg, 12);
  });

  it('reconstructs every recorded spawn from the restored parameters alone', () => {
    const restored = parseSpiderShot();
    const [yawLo, yawHi] = restored.peripheral.yawMagDegRange;
    const [pitchLo, pitchHi] = restored.peripheral.pitchDegRange;
    const peripheral = run.spawnPositions.filter((pos) => Math.abs(pos.x) > 1e-9);
    expect(peripheral.length).toBeGreaterThan(0);

    for (const pos of peripheral) {
      const angles = spiderWideEyeAngles(pos);
      expect(angles.distanceU).toBeCloseTo(restored.distanceU, 9);
      expect(Math.abs(angles.yawDeg)).toBeGreaterThanOrEqual(yawLo - 1e-9);
      expect(Math.abs(angles.yawDeg)).toBeLessThanOrEqual(yawHi + 1e-9);
      expect(angles.pitchDeg).toBeGreaterThanOrEqual(pitchLo - 1e-9);
      expect(angles.pitchDeg).toBeLessThanOrEqual(pitchHi + 1e-9);
    }
  });
});

describe('WP-57 T4 — GD-7：hitbox 單一來源與 W_deg 對帳', () => {
  it('exports the same hitbox the simulator resolved, with no second size constant', () => {
    const resolved = targetHitboxToConfig(resolveTargetHitbox(config));

    expect(payload.meta.targets?.hitbox).toEqual(resolved);
    expect(payload.meta.targets?.hitbox?.shape).toBe('sphere');
    // sphere 的三軸必須同值（`W_deg` 只讀 width，三軸不同會讓角徑與命中判定分家）。
    expect(resolved.widthU).toBe(resolved.heightU);
    expect(resolved.widthU).toBe(resolved.depthU);
  });

  it('derives W_deg from the exported hitbox back to the 2.0 degree design angular diameter', () => {
    const transitions = deriveSpiderShotTransitions(payload, { strictEyeOrigin: true });
    expect(transitions.length).toBeGreaterThan(0);

    for (const transition of transitions) {
      // translation locked ⇒ 眼睛恆在 `(0, 1.6, 0)`，距離恆為 config distance。
      expect(transition.worldDistanceU).toBeCloseTo(SPIDER_WIDE_DISTANCE_U, 9);
      // eye-frame 修正（KI-026／GD-32 ④）之後，匯出角徑就是設計值本身，不再有 origin-frame 漂移。
      expect(transition.angularSizeDeg).toBeCloseTo(SPIDER_WIDE_TARGET_ANGULAR_DIAMETER_DEG, 9);
      expect(transition.hitbox.width).toBe(payload.meta.targets?.hitbox?.widthU);
    }
  });

  it('reports eye-frame D_deg in the wide-flick band rather than a v2-scale displacement', () => {
    const outbound = deriveSpiderShotTransitions(payload, { strictEyeOrigin: true }).filter(
      (transition) => transition.direction === 'center-to-peripheral',
    );
    const restored = parseSpiderShot();
    const [yawLo, yawHi] = restored.peripheral.yawMagDegRange;

    expect(outbound.length).toBeGreaterThan(0);
    for (const transition of outbound) {
      // 中心目標在 yaw = pitch = 0，故 D_deg 恆 >= yaw 幅度（pitch 只讓夾角更大）。
      expect(transition.angularDistanceDeg).toBeGreaterThanOrEqual(yawLo - 1e-9);
      expect(transition.angularDistanceDeg).toBeLessThanOrEqual(Math.hypot(yawHi, 6.5) + 1e-9);
    }
  });
});

describe('WP-57 T4 — FR-57.11：真實 run 的 side 與記錄的 spawn side 同源', () => {
  it('matches the recorded visible-event side on every peripheral arrival', () => {
    const outbound = deriveSpiderShotTransitions(payload, { strictEyeOrigin: true }).filter(
      (transition) => transition.direction === 'center-to-peripheral',
    );
    const recorded = new Map(
      payload.events
        .filter(
          (event): event is Extract<ExportPayload['events'][number], { type: 'visible' }> => event.type === 'visible',
        )
        .map((event) => [event.targetId, event.side]),
    );

    expect(outbound.length).toBeGreaterThan(0);
    for (const transition of outbound) {
      // 離線推導（eye-frame x 符號）與 sim 端寫入的分層佇列 cell side 必須一致 —— 若兩者會分歧,
      // 「左右」就有兩套定義。
      expect(transition.side).toBe(recorded.get(transition.targetId));
    }
    expect(outbound.some((transition) => transition.side === 'L')).toBe(true);
    expect(outbound.some((transition) => transition.side === 'R')).toBe(true);
  });

  it('leaves center returns without a side and keeps the condition cell free of side and pitch', () => {
    const transitions = deriveSpiderShotTransitions(payload, { strictEyeOrigin: true });
    const returns = transitions.filter((transition) => transition.direction === 'peripheral-to-center');

    expect(returns.length).toBeGreaterThan(0);
    for (const transition of returns) expect('side' in transition).toBe(false);
    // FR-57.5：pitch 是干擾項；`targetConditionCell` 只帶 d 與 w（格式不因本 WP 變動）。
    for (const transition of transitions) {
      expect(transition.targetConditionCell).toMatch(/^spider:d=-?\d+\.\d{6};w=-?\d+\.\d{6}$/);
      expect(transition.targetConditionCell).not.toContain('side');
      expect(transition.targetConditionCell).not.toContain('pitch');
    }
  });
});

/** `meta.spawn.spiderShot` 是 opaque `unknown`；round-trip 後在測試側顯式收斂型別。 */
interface RestoredSpiderShot {
  readonly kind: string;
  readonly seed: number;
  readonly distanceU: number;
  readonly peripheral: {
    readonly yawMagDegRange: readonly [number, number];
    readonly pitchDegRange: readonly [number, number];
  };
  readonly grid: { readonly pitchBands: number };
  readonly centerExemptFromTimeout?: boolean;
  readonly resolvedFrom: {
    readonly fovDegVertical: number;
    readonly aspect: number;
    readonly screenMargin: number;
    readonly kLo: number;
    readonly targetAngularDiameterDeg: number;
  };
}

function parseSpiderShot(): RestoredSpiderShot {
  const parsed = parseExportPayload(JSON.parse(serializeJSON(payload)));
  if (!parsed.ok) throw new Error(`export payload failed to parse: ${JSON.stringify(parsed.errors)}`);
  return parsed.payload.meta.spawn?.spiderShot as RestoredSpiderShot;
}

function expectBitIdenticalPair(actual: readonly number[], expected: readonly number[]): void {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((value, index) => {
    expect(Object.is(value, expected[index])).toBe(true);
  });
}

/**
 * 逐行對齊 `src/main.ts` 的匯出組裝（`spawn` / `targets` / `scene` 三段）：spiderShot 整塊複製、
 * hitbox 走 `targetHitboxToConfig(resolveTargetHitbox(config))`、eye 走 `resolveEyeWorldBase()`。
 */
function buildRoundTripPayload(): ExportPayload {
  const spiderShot = config.spiderShot;
  if (spiderShot === undefined) throw new Error('fixture drill must carry a resolved spiderShot schedule');

  const meta = collectMeta({
    drillId: config.drillId,
    weaponId: 'usp_s_laser',
    weaponSeed: 0,
    rngSeed: spiderShot.seed,
    backend: 'webgpu',
    displayHz: 144,
    browser: 'test-browser',
    sensitivity: 2,
    dpi: 800,
    fovDeg: FIXTURE_FOV_DEG,
    crossOriginIsolated: true,
    startedAt: '2026-09-07T00:00:00.000Z',
    targets: { hitbox: targetHitboxToConfig(resolveTargetHitbox(config)) },
    spawn: { seed: spiderShot.seed, spiderShot },
    scene: {
      sceneId: wideFlickArena.sceneId,
      assetPackVersion: wideFlickArena.assetPackVersion,
      clutterTier: wideFlickArena.clutterTier,
      fallback: false,
      eye: resolveEyeWorldBase(wideFlickArena),
    },
  });
  return buildExportPayload(meta, run.snapshot);
}
