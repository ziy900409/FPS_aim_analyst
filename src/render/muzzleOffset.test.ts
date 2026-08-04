import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import {
  computeMuzzleOrigin,
  DEFAULT_MUZZLE_OFFSETS,
  type MuzzleOffsets,
} from './muzzleOffset.ts';

const FORWARD_ONLY: MuzzleOffsets = {
  hip: { rightU: 0, upU: 0, forwardU: 1 },
  ads: { rightU: 0, upU: 0, forwardU: 1 },
};

describe('computeMuzzleOrigin', () => {
  it('maps positive forwardU to camera-local -Z for an identity quaternion', () => {
    const out = computeMuzzleOrigin(
      new THREE.Vector3(1, 2, 3),
      new THREE.Quaternion(),
      false,
      DEFAULT_MUZZLE_OFFSETS,
      new THREE.Vector3(),
    );

    expect(out.toArray()).toEqual([1.15, 1.88, 2.4]);
  });

  it('rotates the hip offset by +90 degrees of yaw', () => {
    const quat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      Math.PI / 2,
    );
    const out = computeMuzzleOrigin(
      new THREE.Vector3(),
      quat,
      false,
      DEFAULT_MUZZLE_OFFSETS,
      new THREE.Vector3(),
    );

    expect(out.x).toBeCloseTo(-0.6, 15);
    expect(out.y).toBeCloseTo(-0.12, 15);
    expect(out.z).toBeCloseTo(-0.15, 15);
  });

  it('rotates camera-local forward correctly for pitch +45 and -45 degrees', () => {
    const axis = new THREE.Vector3(1, 0, 0);
    const up = computeMuzzleOrigin(
      new THREE.Vector3(),
      new THREE.Quaternion().setFromAxisAngle(axis, Math.PI / 4),
      false,
      FORWARD_ONLY,
      new THREE.Vector3(),
    );
    const down = computeMuzzleOrigin(
      new THREE.Vector3(),
      new THREE.Quaternion().setFromAxisAngle(axis, -Math.PI / 4),
      false,
      FORWARD_ONLY,
      new THREE.Vector3(),
    );

    expect(up.x).toBe(0);
    expect(up.y).toBeCloseTo(Math.SQRT1_2, 15);
    expect(up.z).toBeCloseTo(-Math.SQRT1_2, 15);
    expect(down.x).toBe(0);
    expect(down.y).toBeCloseTo(-Math.SQRT1_2, 15);
    expect(down.z).toBeCloseTo(-Math.SQRT1_2, 15);
  });

  it('is bitwise deterministic and returns the caller-provided output vector', () => {
    const origin = new THREE.Vector3(4, 5, 6);
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25, -0.5, 0));
    const first = new THREE.Vector3();
    const second = new THREE.Vector3();

    const returned = computeMuzzleOrigin(origin, quat, false, DEFAULT_MUZZLE_OFFSETS, first);
    computeMuzzleOrigin(origin, quat, false, DEFAULT_MUZZLE_OFFSETS, second);

    expect(returned).toBe(first);
    expect(first.toArray()).toEqual(second.toArray());
  });
});
