import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ExportPayload } from '../data/export.ts';
import {
  SPIDER_WIDE_PITCH_MAG_DEG,
  SPIDER_WIDE_TARGET_ANGULAR_DIAMETER_DEG,
  resolveSpiderWideYawPitch,
  spiderWideResolveInput,
} from '../drill/spiderShotWide.ts';
import {
  deriveProjectedFootprint,
  footprintSpread,
  projectedSphereFootprint,
  type ProjectedFootprintPresentation,
} from './projectedFootprint.ts';

/**
 * WP-57 / OQ-57.8 —— 離軸球投影橢圓的可量測化。
 *
 * §A 驗閉式解本身（自洽 + 小角極限）。§B **把 OQ-57.8 記載的四組數字釘成測試** —— 它們原本只是
 * README 裡的敘述，且產生它們的四份真人匯出**不進 repo**（D-57.T5-8）。但這些量純粹是幾何：
 * 只要有 resolver 解出的 yaw 窗就能重算，**不需要那些匯出檔**。這一節因此把不可重現的敘述
 * 換成可重現的斷言。
 *
 * §C 驗 payload 層的接線與 C-D3／C-D4 邊界。
 */

/** 實錄參數：四份真人 run 的視窗形狀（aspect 2.0031），非 16:9。 */
const RECORDED_ASPECT = 2.0031;
const ANGULAR_RADIUS_DEG = SPIDER_WIDE_TARGET_ANGULAR_DIAMETER_DEG / 2;

describe('§A projectedSphereFootprint —— 閉式解自洽', () => {
  it('degenerates to the on-axis circle at theta = 0', () => {
    const footprint = projectedSphereFootprint({ offAxisDeg: 0, angularRadiusDeg: 1, fovDegVertical: 75 });

    expect(footprint.axisRatio).toBe(1);
    // 兩條半軸走不同的浮點路徑（`cosα·sinα/cos²α` vs `sinα/√(cos²α)`），θ = 0 時代數上相等但可差
    // 1 ULP。斷言到 1e-15 而非逐位 —— 逐位相等不是這個模組承諾的東西。
    expect(footprint.semiMajorScreen).toBeCloseTo(footprint.semiMinorScreen, 15);
    expect(footprint.areaRatioToOnAxis).toBeCloseTo(1, 12);
    expect(footprint.centroidOffsetShare).toBeCloseTo(0, 12);
    // 在軸球的半徑 = f·tan(alpha)，f = 1/tan(halfVFOV)。
    const expected = Math.tan((1 * Math.PI) / 180) / Math.tan((37.5 * Math.PI) / 180);
    expect(footprint.semiMajorScreen).toBeCloseTo(expected, 12);
  });

  it('approaches 1/cos(theta) and 1/cos^3(theta) as the target gets small', () => {
    const theta = 55;
    const cosTheta = Math.cos((theta * Math.PI) / 180);

    const tiny = projectedSphereFootprint({ offAxisDeg: theta, angularRadiusDeg: 0.01, fovDegVertical: 75 });
    expect(tiny.axisRatio).toBeCloseTo(1 / cosTheta, 6);
    expect(tiny.areaRatioToOnAxis).toBeCloseTo(1 / cosTheta ** 3, 5);

    // 2° 的真實目標偏離小角極限，但方向與量級相同 —— 這是「近似夠不夠好」的具體答案。
    const real = projectedSphereFootprint({ offAxisDeg: theta, angularRadiusDeg: 1, fovDegVertical: 75 });
    expect(real.axisRatio).toBeGreaterThan(1 / cosTheta);
    expect(real.axisRatio / (1 / cosTheta)).toBeLessThan(1.01);
  });

  it('grows monotonically with theta and is FOV-independent in shape', () => {
    const shapes = [40, 50, 60, 70].map((offAxisDeg) =>
      projectedSphereFootprint({ offAxisDeg, angularRadiusDeg: 1, fovDegVertical: 75 }),
    );
    for (let i = 1; i < shapes.length; i++) {
      expect(shapes[i].axisRatio).toBeGreaterThan(shapes[i - 1].axisRatio);
      expect(shapes[i].areaRatioToOnAxis).toBeGreaterThan(shapes[i - 1].areaRatioToOnAxis);
    }

    // FOV 只縮放絕對尺寸，不改形狀 —— FOV 之所以在 OQ-57.8 的表裡有影響，是因為它改的是 **yaw 窗**
    // （見 §B），不是因為它出現在投影公式裡。
    const narrow = projectedSphereFootprint({ offAxisDeg: 55, angularRadiusDeg: 1, fovDegVertical: 60 });
    const wide = projectedSphereFootprint({ offAxisDeg: 55, angularRadiusDeg: 1, fovDegVertical: 120 });
    expect(narrow.axisRatio).toBeCloseTo(wide.axisRatio, 12);
    expect(narrow.areaRatioToOnAxis).toBeCloseTo(wide.areaRatioToOnAxis, 12);
    expect(narrow.semiMajorScreen).toBeGreaterThan(wide.semiMajorScreen);
  });

  it('refuses a geometry whose tangent cone no longer projects to an ellipse', () => {
    expect(() => projectedSphereFootprint({ offAxisDeg: 89.5, angularRadiusDeg: 1, fovDegVertical: 75 })).toThrow(
      /below 90 degrees/,
    );
    expect(() => projectedSphereFootprint({ offAxisDeg: -1, angularRadiusDeg: 1, fovDegVertical: 75 })).toThrow(
      /offAxisDeg/,
    );
    expect(() => projectedSphereFootprint({ offAxisDeg: 50, angularRadiusDeg: 0, fovDegVertical: 75 })).toThrow(
      /angularRadiusDeg/,
    );
    expect(() => projectedSphereFootprint({ offAxisDeg: 50, angularRadiusDeg: 1, fovDegVertical: 180 })).toThrow(
      /below 180 degrees/,
    );
  });
});

describe('§B OQ-57.8 的四組數字（實錄 aspect 2.0031，純幾何、不需匯出檔）', () => {
  it('reproduces the FOV 75 window: axis ratio 1.57–1.75, footprint 5.4x, in-window spread 1.38x', () => {
    const corners = windowCorners(75);

    expect(corners.min.axisRatio).toBeCloseTo(1.57, 2);
    expect(corners.max.axisRatio).toBeCloseTo(1.75, 2);
    expect(corners.max.areaRatioToOnAxis).toBeCloseTo(5.4, 1);
    expect(corners.max.areaScreen / corners.min.areaScreen).toBeCloseTo(1.38, 2);
  });

  it('reproduces the FOV 120 window: axis ratio 2.51–3.31, footprint 36.4x, in-window spread 2.30x', () => {
    const corners = windowCorners(120);

    expect(corners.min.axisRatio).toBeCloseTo(2.51, 2);
    expect(corners.max.axisRatio).toBeCloseTo(3.31, 2);
    expect(corners.max.areaRatioToOnAxis).toBeCloseTo(36.4, 1);
    expect(corners.max.areaScreen / corners.min.areaScreen).toBeCloseTo(2.3, 2);
  });

  it('keeps the centroid offset small enough that "aim at the visual centre" is not misled', () => {
    // ⚠️ OQ-57.8 原文寫「長軸的 1.7–4.9%」——那組數字是用 **16:9** 算的，與同一句裡的軸比／足跡
    // （實錄 aspect 2.0031）不同源。實錄 aspect 下 FOV 120 外角其實是 **5.50%**，不是 4.9%。
    // 結論不變（仍遠小於長軸，「瞄視覺中心」不會被明顯誤導），但數字已於本切片更正。
    expect(windowCorners(75).min.centroidOffsetShare).toBeCloseTo(0.0212, 4);
    expect(windowCorners(75).max.centroidOffsetShare).toBeCloseTo(0.0251, 4);
    expect(windowCorners(120).min.centroidOffsetShare).toBeCloseTo(0.0402, 4);
    expect(windowCorners(120).max.centroidOffsetShare).toBeCloseTo(0.055, 4);

    // 全部四個 FOV 檔位的外角都仍在長軸的 6% 以內 —— 這才是那個論點需要的性質。
    for (const fovDeg of [60, 75, 90, 120]) {
      expect(windowCorners(fovDeg).max.centroidOffsetShare).toBeLessThan(0.06);
    }
  });

  it('shows the footprint co-varying with D_deg — the whole point of OQ-57.8', () => {
    // 同一個窗內，離軸角越大（= D_deg 越大）足跡就越大。這正是 switchReaction 的混淆因子：
    // 「偏心度越大反應越慢」與「目標越大越長」在這個刺激裡分不開。
    const corners = windowCorners(75);
    expect(corners.max.offAxisDeg).toBeGreaterThan(corners.min.offAxisDeg);
    expect(corners.max.areaScreen).toBeGreaterThan(corners.min.areaScreen);
  });
});

describe('§C payload 層的接線', () => {
  it('projects every center-to-peripheral transition and leaves the return legs out', () => {
    const presentations = deriveProjectedFootprint(widePayload());

    expect(presentations.map((presentation) => presentation.targetId)).toEqual(['p1', 'p2']);
    for (const presentation of presentations) {
      // theta 就是那一筆 transition 的 D_deg —— 不是本模組另算的角度（C-D4）。
      expect(presentation.footprint.offAxisDeg).toBe(presentation.angularDistanceDeg);
      expect(presentation.footprint.axisRatio).toBeGreaterThan(1);
    }
  });

  it('refuses to fall back to meta.fovDeg when the resolver provenance is missing', () => {
    const payload = widePayload();
    // resolvedFrom 拿掉、meta.fovDeg 仍在 —— 一個「看起來夠用」的 payload。
    (payload.meta.spawn as { spiderShot?: unknown }).spiderShot = {};

    expect(() => deriveProjectedFootprint(payload)).toThrow(/resolvedFrom\.fovDegVertical is required/);
  });

  it('summarises spread without inventing a comparable score', () => {
    const presentations = deriveProjectedFootprint(widePayload());
    const spread = footprintSpread(presentations);

    expect(spread?.count).toBe(2);
    expect(spread?.areaRatio).toBeCloseTo(
      (spread as { maxAreaScreen: number }).maxAreaScreen / (spread as { minAreaScreen: number }).minAreaScreen,
      12,
    );
    expect(footprintSpread([])).toBeUndefined();
    // 刻意沒有平均／標準差／分數（C-D3）。
    expect(Object.keys(spread as object).sort()).toEqual(
      ['areaRatio', 'count', 'maxAreaScreen', 'maxAxisRatio', 'minAreaScreen', 'minAxisRatio'].sort(),
    );
  });
});

describe('§C C-D3 —— 共變量不得進教練報告、診斷規則或 registry', () => {
  const SRC_ROOT = fileURLToPath(new URL('..', import.meta.url));
  const MODULE_NAME = 'projectedFootprint';

  it('is imported by nothing in src/ other than its own test', () => {
    const importers = tsFilesUnder(SRC_ROOT).filter((file) => {
      if (file.endsWith(`${MODULE_NAME}.ts`) || file.endsWith(`${MODULE_NAME}.test.ts`)) return false;
      return readFileSync(file, 'utf-8').includes(MODULE_NAME);
    });

    expect(importers).toEqual([]);
  });

  it('does not define a second eye origin, hitbox size, or angular size (C-D4)', () => {
    const code = codeOnly(readFileSync(fileURLToPath(new URL('./projectedFootprint.ts', import.meta.url)), 'utf-8'));
    for (const pattern of [/resolveEyeOrigin/, /angularEccentricityDeg/, /hitbox/i, /targetX|targetY|targetZ/, /\.ticks/]) {
      expect(code).not.toMatch(pattern);
    }
  });
});

/** 窗的內外兩角：最小 theta（yaw 下界、pitch 0）與最大 theta（yaw 上界、pitch 極值）。 */
function windowCorners(fovDegVertical: number) {
  const resolved = resolveSpiderWideYawPitch(spiderWideResolveInput(fovDegVertical, RECORDED_ASPECT));
  const [yawLo, yawHi] = resolved.yawMagDegRange;

  return {
    min: projectedSphereFootprint({
      offAxisDeg: offAxisDeg(yawLo, 0),
      angularRadiusDeg: ANGULAR_RADIUS_DEG,
      fovDegVertical,
    }),
    max: projectedSphereFootprint({
      offAxisDeg: offAxisDeg(yawHi, SPIDER_WIDE_PITCH_MAG_DEG),
      angularRadiusDeg: ANGULAR_RADIUS_DEG,
      fovDegVertical,
    }),
  };
}

/** cos(theta) = cos(yaw)·cos(pitch) —— 球面上的離軸角，與 spawn 的球面參數化同源。 */
function offAxisDeg(yawDeg: number, pitchDeg: number): number {
  const cosTheta = Math.cos((yawDeg * Math.PI) / 180) * Math.cos((pitchDeg * Math.PI) / 180);
  return (Math.acos(cosTheta) * 180) / Math.PI;
}

/**
 * 最小的兩顆周邊 payload。座標走球面解，使 `deriveSpiderShotTransitions()` 算出的 D_deg 就是
 * 我們要的離軸角；兩顆的 yaw 刻意不同，讓 spread 有東西可算。
 */
function widePayload(): ExportPayload {
  const distanceU = 8;
  const eyeY = 1.6;
  const point = (yawDeg: number, pitchDeg: number) => {
    const yaw = (yawDeg * Math.PI) / 180;
    const pitch = (pitchDeg * Math.PI) / 180;
    return {
      x: distanceU * Math.sin(yaw) * Math.cos(pitch),
      y: eyeY + distanceU * Math.sin(pitch),
      z: -distanceU * Math.cos(yaw) * Math.cos(pitch),
    };
  };

  const centre = point(0, 0);
  const first = point(50.5, 0);
  const second = point(54.8, 6.5);

  return {
    meta: {
      schemaVersion: 2,
      drillId: 'spider-shot-wide-v1',
      weaponId: 'usp_s_laser',
      weaponSeed: 1,
      rngSeed: 1,
      backend: 'webgpu',
      displayHz: 144,
      simHz: 128,
      browser: 'test-browser',
      sensitivity: 1,
      sensitivityModel: 'cs2-0.022deg',
      movementModel: 'cs2-source',
      crossOriginIsolated: true,
      startedAt: '2026-09-08T00:00:00.000Z',
      unit: 'source',
      vStrafe: 0,
      maxDrillSeconds: 60,
      lateEventCount: 0,
      bufferOverflow: false,
      recorderOverflow: false,
      suspect: false,
      fovDeg: 75,
      scene: { sceneId: 'wide-flick-arena', assetPackVersion: 'wide-flick-arena-v1', clutterTier: 'low', fallback: false },
      spawn: {
        seed: 57001,
        spiderShot: {
          resolvedFrom: {
            fovDegVertical: 75,
            aspect: RECORDED_ASPECT,
            screenMargin: 0.04,
            kLo: 0.92,
            targetAngularDiameterDeg: SPIDER_WIDE_TARGET_ANGULAR_DIAMETER_DEG,
          },
        },
      },
      targets: { hitbox: { widthU: 0.279281, heightU: 0.279281, depthU: 0.279281, shape: 'sphere' } },
    },
    ticks: [],
    events: [
      { type: 'visible', targetId: 'c1', side: 'R', zone: 'center', t: 0, targetX: centre.x, targetY: centre.y, targetZ: centre.z },
      { type: 'visible', targetId: 'p1', side: 'R', zone: 'peripheral', t: 100, targetX: first.x, targetY: first.y, targetZ: first.z },
      { type: 'visible', targetId: 'c2', side: 'R', zone: 'center', t: 200, targetX: centre.x, targetY: centre.y, targetZ: centre.z },
      { type: 'visible', targetId: 'p2', side: 'R', zone: 'peripheral', t: 300, targetX: second.x, targetY: second.y, targetZ: second.z },
    ],
  } as unknown as ExportPayload;
}

/** 去掉區塊與行註解，讓 boundary scan 只看得到程式碼。 */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function tsFilesUnder(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = `${root}/${entry}`;
    if (statSync(path).isDirectory()) files.push(...tsFilesUnder(path));
    else if (path.endsWith('.ts')) files.push(path);
  }
  return files;
}

/** 型別面的存在證明：聚合輸入就是逐筆輸出的陣列，不需要另一個形狀。 */
const _typeCheck: (p: readonly ProjectedFootprintPresentation[]) => unknown = footprintSpread;
void _typeCheck;
