import { describe, expect, it } from 'vitest';
import type { ExportPayload } from '../data/export.ts';
import type { Meta } from '../data/metadata.ts';
import { CM_PER_INCH, deriveMouseThrow } from './mouseThrow.ts';

/**
 * WP-57 / T4 步驟 6 —— `counts/360` 與 `cm/360` 的離線推導。期望值一律以**手算閉式**表示
 * （`360 ÷ (sensitivity × 0.022)`），而不是把實作再抄一次：兩條路徑（實作走 `RAD_PER_COUNT`
 * 與 `2π`；測試走度數）獨立到同一個數字，才算真的驗到公式而非驗到自己。
 */

/** CS2 counts→度的固定線性係數（GD-5）。手算式的唯一輸入。 */
const DEG_PER_COUNT = 0.022;

/** 手算：轉一整圈需要幾個 count。 */
function handCountsPer360(sensitivity: number): number {
  return 360 / (sensitivity * DEG_PER_COUNT);
}

describe('deriveMouseThrow', () => {
  it('derives hip counts/360 and cm/360 that match the hand-computed values', () => {
    const throwValues = deriveMouseThrow(payload({ sensitivity: 2, dpi: 800 }));

    // sensitivity 2 @ 0.022°/count → 360 / 0.044 = 8181.8181… counts
    expect(throwValues.countsPer360).toBeCloseTo(handCountsPer360(2), 9);
    expect(throwValues.countsPer360).toBeCloseTo(8181.818181818182, 9);
    // 8181.8181… counts ÷ 800 dpi × 2.54 = 25.9772… cm
    expect(throwValues.cmPer360).toBeCloseTo((handCountsPer360(2) / 800) * CM_PER_INCH, 9);
    expect(throwValues.cmPer360).toBeCloseTo(25.977272727272727, 9);
    expect(throwValues.dpi).toBe(800);
  });

  it('scales inversely with sensitivity and inversely with DPI', () => {
    const base = deriveMouseThrow(payload({ sensitivity: 1, dpi: 800 }));
    const doubleSens = deriveMouseThrow(payload({ sensitivity: 2, dpi: 800 }));
    const doubleDpi = deriveMouseThrow(payload({ sensitivity: 1, dpi: 1600 }));

    expect(doubleSens.countsPer360).toBeCloseTo(base.countsPer360 / 2, 9);
    expect(doubleSens.cmPer360!).toBeCloseTo(base.cmPer360! / 2, 9);
    // DPI 不改角度換算，只改實體行程。
    expect(doubleDpi.countsPer360).toBeCloseTo(base.countsPer360, 12);
    expect(doubleDpi.cmPer360!).toBeCloseTo(base.cmPer360! / 2, 9);
  });

  it('returns undefined cm/360 when meta.dpi is absent instead of guessing a DPI', () => {
    const throwValues = deriveMouseThrow(payload({ sensitivity: 2 }));

    expect(throwValues.cmPer360).toBeUndefined();
    expect(throwValues.adsCmPer360).toBeUndefined();
    expect(throwValues.dpi).toBeUndefined();
    // counts/360 不需要 DPI ⇒ 仍然成立（不因缺一個欄位就整組放棄）。
    expect(throwValues.countsPer360).toBeCloseTo(handCountsPer360(2), 9);
  });

  it('derives the ADS throw from the KI-005 gain model', () => {
    const throwValues = deriveMouseThrow(
      payload({ sensitivity: 2, dpi: 800, fovDeg: 75, ads: { fovDeg: 60, sensitivityRatio: 0.8 } }),
    );

    // adsGain = 0.8 × (60 / 75) = 0.64 ⇒ ADS 每 count 轉得更少 ⇒ 一圈需要更多 counts。
    const expectedAdsCounts = handCountsPer360(2) / 0.64;
    expect(throwValues.adsCountsPer360).toBeCloseTo(expectedAdsCounts, 9);
    expect(throwValues.adsCountsPer360).toBeCloseTo(12784.090909090908, 9);
    expect(throwValues.adsCmPer360).toBeCloseTo((expectedAdsCounts / 800) * CM_PER_INCH, 9);
    // hip 一欄不受 ADS 影響。
    expect(throwValues.countsPer360).toBeCloseTo(handCountsPer360(2), 9);
  });

  it('leaves the ADS throw undefined when the weapon has no optic or meta.fovDeg is missing', () => {
    const noOptic = deriveMouseThrow(payload({ sensitivity: 2, dpi: 800, fovDeg: 75 }));
    expect(noOptic.adsCountsPer360).toBeUndefined();
    expect(noOptic.adsCmPer360).toBeUndefined();

    // `meta.fovDeg` 是 ADS gain 的分母；缺席 = 該匯出的 ADS 感度鏈不可稽核（metadata.ts）。
    const noFov = deriveMouseThrow(payload({ sensitivity: 2, dpi: 800, ads: { fovDeg: 60, sensitivityRatio: 0.8 } }));
    expect(noFov.adsCountsPer360).toBeUndefined();
    expect(noFov.adsCmPer360).toBeUndefined();
    // 且 hip 一欄與有 FOV 的匯出逐位相同 —— 證明缺 FOV 時填入的佔位值確實對結果無影響。
    expect(noFov.countsPer360).toBe(noOptic.countsPer360);
  });

  it('throws instead of returning a fabricated throw when the sensitivity is unusable', () => {
    expect(() => deriveMouseThrow(payload({ sensitivity: 0, dpi: 800 }))).toThrow(/sensitivity/);
  });
});

interface PayloadOptions {
  sensitivity: number;
  dpi?: number;
  fovDeg?: number;
  ads?: { fovDeg: number; sensitivityRatio: number };
}

function payload(options: PayloadOptions): ExportPayload {
  const meta: Meta = {
    schemaVersion: 2,
    drillId: 'spider-shot-wide-v1',
    weaponId: 'ak47',
    weaponSeed: 223,
    rngSeed: 57001,
    backend: 'webgl2',
    displayHz: 144,
    simHz: 128,
    browser: 'test-browser',
    sensitivity: options.sensitivity,
    ...(options.dpi !== undefined ? { dpi: options.dpi } : {}),
    sensitivityModel: 'cs2-0.022deg',
    movementModel: 'cs2-source',
    ...(options.fovDeg !== undefined ? { fovDeg: options.fovDeg } : {}),
    crossOriginIsolated: true,
    startedAt: '2026-09-07T00:00:00.000Z',
    unit: 'source',
    vStrafe: 250,
    maxDrillSeconds: 300,
    lateEventCount: 0,
    bufferOverflow: false,
    recorderOverflow: false,
    suspect: false,
    ...(options.ads !== undefined ? { weapon: { id: 'ak47', ads: options.ads } } : {}),
  };
  return { meta, ticks: [], events: [] };
}
