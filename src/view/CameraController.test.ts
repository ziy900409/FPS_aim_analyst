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
});
