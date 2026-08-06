import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { RAD_PER_COUNT, MAX_PITCH, resolveMouseGain, createAimIntegrator } from './mouseGain.ts';

describe('RAD_PER_COUNT / MAX_PITCH', () => {
  it('RAD_PER_COUNT = CS2 0.022 deg/count via THREE.MathUtils.degToRad(逐位)', () => {
    expect(RAD_PER_COUNT).toBe(THREE.MathUtils.degToRad(0.022));
  });

  it('MAX_PITCH = π/2 - 0.01（±89° 明確專案級夾角）', () => {
    expect(MAX_PITCH).toBe(Math.PI / 2 - 0.01);
  });
});

describe('resolveMouseGain', () => {
  it('無 ads：adsStep === hipStep === sensitivity × RAD_PER_COUNT（逐位）', () => {
    const gain = resolveMouseGain({ sensitivity: 2, hipFovDeg: 90 });
    expect(gain.hipStep).toBe(2 * RAD_PER_COUNT);
    expect(gain.adsStep).toBe(gain.hipStep);
  });

  it('有 ads：adsStep = hipStep × (ratio × (adsFov/hipFov))（先除後乘，逐位對齊 CameraController.setAds）', () => {
    const gain = resolveMouseGain({
      sensitivity: 1,
      hipFovDeg: 90,
      ads: { fovDeg: 45, sensitivityRatio: 0.8 },
    });
    const hipStep = 1 * RAD_PER_COUNT;
    const adsGain = 0.8 * (45 / 90);
    expect(gain.hipStep).toBe(hipStep);
    expect(gain.adsStep).toBe(hipStep * adsGain);
  });

  it('sensitivity 非正有限拋錯', () => {
    expect(() => resolveMouseGain({ sensitivity: 0, hipFovDeg: 90 })).toThrow();
    expect(() => resolveMouseGain({ sensitivity: -1, hipFovDeg: 90 })).toThrow();
    expect(() => resolveMouseGain({ sensitivity: NaN, hipFovDeg: 90 })).toThrow();
    expect(() => resolveMouseGain({ sensitivity: Infinity, hipFovDeg: 90 })).toThrow();
  });

  it('hipFovDeg 非正有限拋錯', () => {
    expect(() => resolveMouseGain({ sensitivity: 1, hipFovDeg: 0 })).toThrow();
    expect(() => resolveMouseGain({ sensitivity: 1, hipFovDeg: -90 })).toThrow();
  });

  it('ads.fovDeg / ads.sensitivityRatio 非正有限拋錯', () => {
    expect(() =>
      resolveMouseGain({ sensitivity: 1, hipFovDeg: 90, ads: { fovDeg: 0, sensitivityRatio: 1 } }),
    ).toThrow();
    expect(() =>
      resolveMouseGain({ sensitivity: 1, hipFovDeg: 90, ads: { fovDeg: 45, sensitivityRatio: -1 } }),
    ).toThrow();
  });
});

describe('AimIntegrator', () => {
  it('yaw 無界遞減：yaw -= dx × step', () => {
    const integrator = createAimIntegrator();
    const step = 0.01;
    const { dYaw, dPitch } = integrator.applyDelta(100, 0, step);
    expect(dYaw).toBe(-100 * step);
    expect(dPitch).toBe(0);
    expect(integrator.yaw).toBe(-100 * step);
  });

  it('pitch 在 ±MAX_PITCH 夾住', () => {
    const integrator = createAimIntegrator();
    integrator.applyDelta(0, -1e9, 1);
    expect(integrator.pitch).toBe(MAX_PITCH);
    integrator.applyDelta(0, 1e9, 1);
    expect(integrator.pitch).toBe(-MAX_PITCH);
  });

  it('夾住後 dPitch 為 0（已在邊界，再往同方向推不再變化）', () => {
    const integrator = createAimIntegrator();
    integrator.applyDelta(0, -1e9, 1); // 撞上 +MAX_PITCH
    const { dPitch } = integrator.applyDelta(0, -1e9, 1); // 再往同方向推
    expect(dPitch).toBe(0);
  });

  it('Σ dPitch ≡ Δpitch（D-A2：即使多次夾角，逐次生效量之和仍等於淨變化量）', () => {
    const integrator = createAimIntegrator();
    const deltas = [-1000, 500, -1e9, 300, -200, 1e9, 50];
    let sumDPitch = 0;
    const pitchBefore = integrator.pitch;
    for (const dy of deltas) {
      const { dPitch } = integrator.applyDelta(0, dy, 0.001);
      sumDPitch += dPitch;
    }
    expect(sumDPitch).toBeCloseTo(integrator.pitch - pitchBefore, 15);
  });

  it('reset 恢復指定 yaw/pitch（省略時回到 0,0）', () => {
    const integrator = createAimIntegrator();
    integrator.applyDelta(100, 100, 0.01);
    integrator.reset();
    expect(integrator.yaw).toBe(0);
    expect(integrator.pitch).toBe(0);

    integrator.reset(0.3, -0.2);
    expect(integrator.yaw).toBe(0.3);
    expect(integrator.pitch).toBe(-0.2);
  });
});
