import * as THREE from 'three/webgpu';

/**
 * WP-27 muzzle tracer offsets.
 *
 * This module owns render-only constants. SimLoop's import is an intentional one-way dependency:
 * these values may feed tracer origins only and must never enter hit detection or projectile physics.
 * Hip/ADS selection is a step at fire time: the captured sim value must not depend on render-frame interpolation.
 */

/** View-space muzzle offset. THREE camera-local: +X right, +Y up, -Z forward. */
export interface MuzzleOffset {
  readonly rightU: number;
  readonly upU: number;
  /** Positive values move forward; internally this maps to camera-local -Z. */
  readonly forwardU: number;
}

export interface MuzzleOffsets {
  readonly hip: MuzzleOffset;
  readonly ads: MuzzleOffset;
}

export const DEFAULT_MUZZLE_OFFSETS = {
  hip: { rightU: 0.15, upU: -0.12, forwardU: 0.6 },
  ads: { rightU: 0, upU: -0.065, forwardU: 0.6 },
} as const satisfies MuzzleOffsets;

/** Deterministic, allocation-free `out = origin + quat * viewOffset`. */
export function computeMuzzleOrigin(
  origin: THREE.Vector3,
  quat: THREE.Quaternion,
  ads: boolean,
  offsets: MuzzleOffsets,
  out: THREE.Vector3,
): THREE.Vector3 {
  const offset = ads ? offsets.ads : offsets.hip;
  return out
    .set(offset.rightU, offset.upU, -offset.forwardU)
    .applyQuaternion(quat)
    .add(origin);
}
