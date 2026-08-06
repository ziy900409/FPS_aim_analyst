import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { CameraController, type AimState } from './CameraController.ts';

describe('CameraController', () => {
  it('uses the CS2 0.022 degrees/count sensitivity model for yaw', () => {
    const aim: AimState = { yaw: 0, pitch: 0 };
    const controller = new CameraController(new THREE.PerspectiveCamera(), aim);

    controller.setSensitivity(1);
    controller.applyDelta(1000, 0);

    expect(aim.yaw).toBeCloseTo(-THREE.MathUtils.degToRad(22), 12);
  });

  it('scales the CS2 sensitivity model linearly', () => {
    const aim: AimState = { yaw: 0, pitch: 0 };
    const controller = new CameraController(new THREE.PerspectiveCamera(), aim);

    controller.setSensitivity(2);
    controller.applyDelta(1000, 0);

    expect(aim.yaw).toBeCloseTo(-THREE.MathUtils.degToRad(44), 12);
  });

  // ── WP-13 / T2：recoil 視覺 punch compose ──

  it('setViewPunch 疊加於使用者 yaw/pitch：camera quaternion = 手組 q(yaw+punchYaw)·q(pitch+punchPitch)', () => {
    const camera = new THREE.PerspectiveCamera();
    const controller = new CameraController(camera);

    const yaw = 0.3;
    const pitch = -0.2;
    const punchYaw = -0.05;
    const punchPitch = 0.08;

    // 使用者視角：以 sensitivity=1 反推所需 delta（dx = -yaw/step、dy = -pitch/step）。
    const step = THREE.MathUtils.degToRad(0.022);
    controller.applyDelta(-yaw / step, -pitch / step);
    controller.setViewPunch(punchYaw, punchPitch);

    const expected = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw + punchYaw)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch + punchPitch));

    expect(camera.quaternion.x).toBeCloseTo(expected.x, 10);
    expect(camera.quaternion.y).toBeCloseTo(expected.y, 10);
    expect(camera.quaternion.z).toBeCloseTo(expected.z, 10);
    expect(camera.quaternion.w).toBeCloseTo(expected.w, 10);
  });

  it('punch 不受 pitch 夾角限制：使用者 pitch 已頂 +89°，punch 再往上把有效 pitch 推過夾角上限', () => {
    const camera = new THREE.PerspectiveCamera();
    const controller = new CameraController(camera);
    const MAX_PITCH = Math.PI / 2 - 0.01; // 對齊 CameraController 常數

    // 巨量向上 delta → 使用者 pitch 夾在 +MAX_PITCH（+89°）。yaw=0 → 朝向純繞 X。
    controller.applyDelta(0, -1e9);
    controller.setViewPunch(0, 0.2); // 再加 +0.2 rad 向上 punch

    // 由朝向反算有效 pitch：forward = (0, sinθ, −cosθ) → θ = atan2(y, −z)。
    const f = camera.getWorldDirection(new THREE.Vector3());
    const effectivePitch = Math.atan2(f.y, -f.z);

    // 若 punch 也被夾角吃掉，effectivePitch 會停在 MAX_PITCH；未夾 → 明顯超過。
    expect(effectivePitch).toBeGreaterThan(MAX_PITCH + 0.1);
  });

  it('setViewPunch 不寫回 aimSink（state.aim = 使用者視角，不含 punch）', () => {
    const aim: AimState = { yaw: 0, pitch: 0 };
    const controller = new CameraController(new THREE.PerspectiveCamera(), aim);

    controller.setViewPunch(-0.05, 0.08);

    expect(aim.yaw).toBe(0); // punch 不污染 aimSink
    expect(aim.pitch).toBe(0);
  });

  // ── WP-24 / T2：ADS 開鏡 zoom/gain（GD-16，FR-E5） ──

  it('ADS gain = sensitivity × sensitivityRatio × (adsFov/hipFov)（GD-16 逐位）', () => {
    const aim: AimState = { yaw: 0, pitch: 0 };
    const camera = new THREE.PerspectiveCamera(90); // hipFov = 90
    const controller = new CameraController(camera, aim);
    controller.setSensitivity(1);
    controller.setAdsConfig({ fovDeg: 45, sensitivityRatio: 0.8 });

    // 開鏡：gain = 1 × 0.8 × (45/90) = 0.4。同 delta → yaw 增量 × 0.4。
    controller.setAds(true, 1000); // t=0，gain 立即階躍
    controller.applyDelta(1000, 0);

    const step = THREE.MathUtils.degToRad(0.022);
    expect(aim.yaw).toBeCloseTo(-1000 * step * 0.4, 12);
  });

  it('hip 態 gain = 1（開鏡前後感度可分：階躍非漸變）', () => {
    const aim: AimState = { yaw: 0, pitch: 0 };
    const controller = new CameraController(new THREE.PerspectiveCamera(90), aim);
    controller.setSensitivity(1);
    controller.setAdsConfig({ fovDeg: 45, sensitivityRatio: 0.8 });

    // 尚未開鏡 → 全感度。
    controller.applyDelta(1000, 0);
    const step = THREE.MathUtils.degToRad(0.022);
    expect(aim.yaw).toBeCloseTo(-1000 * step, 12);
  });

  it('gain 於開鏡瞬間即階躍，不隨 FOV 內插中值變化', () => {
    const aim: AimState = { yaw: 0, pitch: 0 };
    const controller = new CameraController(new THREE.PerspectiveCamera(90), aim);
    controller.setSensitivity(1);
    controller.setAdsConfig({ fovDeg: 45, sensitivityRatio: 1.0 });

    // FOV 過渡進行到一半（t≈0.5），gain 仍為完整目標態 0.5（45/90），非按內插比例。
    controller.setAds(true, 0);
    controller.setAds(true, 60); // 120ms 過渡的中點
    controller.applyDelta(1000, 0);

    const step = THREE.MathUtils.degToRad(0.022);
    expect(aim.yaw).toBeCloseTo(-1000 * step * 0.5, 12);
  });

  it('setAds 切換 FOV 目標並以 render 幀線性內插（render-only）', () => {
    const camera = new THREE.PerspectiveCamera(90);
    const controller = new CameraController(camera, { yaw: 0, pitch: 0 });
    controller.setAdsConfig({ fovDeg: 30, sensitivityRatio: 1.0 });

    controller.setAds(true, 0);
    expect(camera.fov).toBeCloseTo(90, 6); // t=0 仍在起點

    controller.setAds(true, 60); // 過渡中點 → lerp(90,30,0.5)=60
    expect(camera.fov).toBeCloseTo(60, 6);

    controller.setAds(true, 120); // 過渡完成 → 30
    expect(camera.fov).toBeCloseTo(30, 6);

    controller.setAds(true, 1000); // clamp：不超過目標
    expect(camera.fov).toBeCloseTo(30, 6);
  });

  it('放開鏡 FOV 由當前值趨回 hip（起點=當前內插值，反向不跳變）', () => {
    const camera = new THREE.PerspectiveCamera(90);
    const controller = new CameraController(camera, { yaw: 0, pitch: 0 });
    controller.setAdsConfig({ fovDeg: 30, sensitivityRatio: 1.0 });

    controller.setAds(true, 0);
    controller.setAds(true, 120); // 到達 ads 30
    controller.setAds(false, 120); // 起點=30
    controller.setAds(false, 180); // lerp(30,90,0.5)=60
    expect(camera.fov).toBeCloseTo(60, 6);
    controller.setAds(false, 240);
    expect(camera.fov).toBeCloseTo(90, 6);
  });

  it('無 ads config 的武器：開鏡為 no-op（FOV 與 gain 皆不變）', () => {
    const aim: AimState = { yaw: 0, pitch: 0 };
    const camera = new THREE.PerspectiveCamera(90);
    const controller = new CameraController(camera, aim);
    controller.setSensitivity(1);
    // 未 setAdsConfig → ads = undefined。

    controller.setAds(true, 0);
    controller.setAds(true, 120);
    expect(camera.fov).toBeCloseTo(90, 6); // FOV 不動

    controller.applyDelta(1000, 0);
    const step = THREE.MathUtils.degToRad(0.022);
    expect(aim.yaw).toBeCloseTo(-1000 * step, 12); // gain=1
  });

  it('setFov 更新 hip 基準；非 ADS 時直接生效', () => {
    const camera = new THREE.PerspectiveCamera(90);
    const controller = new CameraController(camera, { yaw: 0, pitch: 0 });
    controller.setFov(103);
    expect(camera.fov).toBeCloseTo(103, 6);
  });

  // ── KI-005 / A · T1：mouseGain 抽取為純重構,camera quaternion 逐位不變（FM-3） ──

  it('T1：hip→ADS→hip 混合序列下,camera quaternion 與 aimSink 逐位不變(手算 golden)', () => {
    const aim: AimState = { yaw: 0, pitch: 0 };
    const camera = new THREE.PerspectiveCamera(90); // hipFov = 90
    const controller = new CameraController(camera, aim);
    controller.setSensitivity(1);
    controller.setAdsConfig({ fovDeg: 45, sensitivityRatio: 0.8 });

    const hipStep = THREE.MathUtils.degToRad(0.022);
    const adsStep = hipStep * (0.8 * (45 / 90));
    const MAX_PITCH_LOCAL = Math.PI / 2 - 0.01;

    let expectedYaw = 0;
    let expectedPitch = 0;
    const accumulate = (dx: number, dy: number, step: number) => {
      expectedYaw -= dx * step;
      expectedPitch = THREE.MathUtils.clamp(expectedPitch - dy * step, -MAX_PITCH_LOCAL, MAX_PITCH_LOCAL);
    };

    // 段 1：hip 態。
    controller.applyDelta(500, -300);
    accumulate(500, -300, hipStep);

    // 段 2：切到 ADS,gain 立即階躍(t=0,不受 FOV 內插中值影響)。
    controller.setAds(true, 0);
    controller.applyDelta(200, 150);
    accumulate(200, 150, adsStep);

    // 段 3：放開鏡回 hip(FOV 過渡完成後才推進,不影響 gain 已是階躍)。
    controller.setAds(false, 120);
    controller.applyDelta(-400, 100);
    accumulate(-400, 100, hipStep);

    const expected = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 1, 0), expectedYaw)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), expectedPitch));

    expect(camera.quaternion.x).toBeCloseTo(expected.x, 12);
    expect(camera.quaternion.y).toBeCloseTo(expected.y, 12);
    expect(camera.quaternion.z).toBeCloseTo(expected.z, 12);
    expect(camera.quaternion.w).toBeCloseTo(expected.w, 12);
    expect(aim.yaw).toBeCloseTo(expectedYaw, 12);
    expect(aim.pitch).toBeCloseTo(expectedPitch, 12);
  });

  it('T1：pitch 撞上 ±MAX_PITCH 後再同向推,aimSink 保持貼在夾角(dPitch 語意的外顯行為)', () => {
    const aim: AimState = { yaw: 0, pitch: 0 };
    const controller = new CameraController(new THREE.PerspectiveCamera(), aim);
    const MAX_PITCH_LOCAL = Math.PI / 2 - 0.01;

    controller.applyDelta(0, -1e9); // 巨量向上 → 撞上 +MAX_PITCH
    expect(aim.pitch).toBeCloseTo(MAX_PITCH_LOCAL, 12);

    controller.applyDelta(0, -1e9); // 再往同方向推,已在邊界不再變化
    expect(aim.pitch).toBeCloseTo(MAX_PITCH_LOCAL, 12);
  });
});
