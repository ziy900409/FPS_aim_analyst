export const BULLET_DT_SEC = 1 / 128;

const DT_EPSILON = 1e-12;

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface BulletState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  ageTicks: number;
  alive: boolean;
}

export function spawnBullet(
  out: BulletState,
  origin: Vec3Like,
  dirUnit: Vec3Like,
  speedU: number,
): BulletState {
  out.x = origin.x;
  out.y = origin.y;
  out.z = origin.z;
  out.vx = dirUnit.x * speedU;
  out.vy = dirUnit.y * speedU;
  out.vz = dirUnit.z * speedU;
  out.ageTicks = 0;
  out.alive = true;
  return out;
}

export function stepBullet(b: BulletState, dtSec: number, gravityU: number): BulletState {
  if (Math.abs(dtSec - BULLET_DT_SEC) > DT_EPSILON) {
    throw new Error('stepBullet dtSec must be exactly 1/128');
  }
  if (!b.alive) return b;

  // Semi-implicit Euler: update velocity first, then advance position with the new velocity.
  b.vy -= gravityU * dtSec;
  b.x += b.vx * dtSec;
  b.y += b.vy * dtSec;
  b.z += b.vz * dtSec;
  b.ageTicks += 1;
  return b;
}
