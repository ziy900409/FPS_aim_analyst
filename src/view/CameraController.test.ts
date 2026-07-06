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
});
