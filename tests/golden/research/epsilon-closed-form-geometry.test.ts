import { describe, expect, it } from 'vitest';
import { angularEccentricityDeg, type ResolvedEyeOrigin } from '../../../src/metrics/eyeOrigin.ts';

/**
 * KI-004 / S1 T4 — 閘 ②(閉式幾何 fixture)。現行 WP-28 T2 幾何 fixture 全為原點 `(0,·,0)` 的靜態
 * 情境,結構上看不見 D2a(base.z 遺漏)/ D2b(SIM_TO_WORLD 遺漏)這類 bug;此閘刻意構造
 * `eyeBase.z ≠ 0` **且** `px ≠ 0` 的交叉情境封住該盲區。
 *
 * `expected` 為閉式解(向量夾角公式)以獨立腳本手算後寫死的常數,而非呼叫 SUT 重算 —— 兩側
 * (TS 這裡 + T5 的 Python `test_angular.py`)各自對同一組寫死常數斷言,而不是互相對表
 * (FM-3:parity 是一致性閘,無法發現兩側一起錯)。
 */
const RELATIVE_TOLERANCE = 1e-9;

describe('KI-004 / S1 T4 — gate ②: closed-form geometry (eyeBase.z ≠ 0 ∧ px ≠ 0)', () => {
  it('matches the closed-form angle when pz = 0 (px-only offset)', () => {
    const resolved: ResolvedEyeOrigin = { base: { x: 0, y: 1.6, z: 4 }, simToWorld: 0.01, source: 'explicit' };
    const tick = { px: 169.25, pz: 0, aim: { yaw: 0.1, pitch: -0.05 } };
    const target = { x: 2, y: 1.5, z: -4 };

    expectRelativeParity(angularEccentricityDeg(tick, target, resolved), 8.2126491400431885);
  });

  it('matches the closed-form angle when both px and pz are non-zero', () => {
    const resolved: ResolvedEyeOrigin = { base: { x: 0, y: 1.6, z: 4 }, simToWorld: 0.01, source: 'explicit' };
    const tick = { px: 169.25, pz: -50, aim: { yaw: 0.2, pitch: 0.03 } };
    const target = { x: 2, y: 1.5, z: -4 };

    expectRelativeParity(angularEccentricityDeg(tick, target, resolved), 14.026766041343230);
  });

  it('degenerates to the legacy px-only-scaled formula when eyeBase.z = 0', () => {
    const resolved: ResolvedEyeOrigin = { base: { x: 0, y: 1.6, z: 0 }, simToWorld: 0.01, source: 'explicit' };
    const tick = { px: 169.25, pz: 0, aim: { yaw: 0.1, pitch: -0.05 } };
    const target = { x: 2, y: 1.5, z: -4 };

    expectRelativeParity(angularEccentricityDeg(tick, target, resolved), 10.219676013510679);
  });
});

function expectRelativeParity(actual: number, expected: number): void {
  const relativeError = Math.abs(actual - expected) / Math.abs(expected);
  expect(relativeError).toBeLessThanOrEqual(RELATIVE_TOLERANCE);
}
