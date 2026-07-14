import type { Vec3Like } from './bullet.ts';

export interface Aabb {
  min: Vec3Like;
  max: Vec3Like;
}

/**
 * Sweeps a projectile segment against the target AABB for the current sim tick.
 *
 * Projectile integration owns the segment endpoints: previous bullet position -> current bullet position.
 * Moving-target semantics are intentionally pinned here for determinism: callers must pass the target AABB
 * at the current tick position, not an interpolated target path. The returned `s` is the first segment
 * fraction in [0, 1] and can be used later to derive sub-tick hit time.
 */
export function sweptHitTest(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  aabb: Aabb,
): number | null {
  let enter = 0;
  let exit = 1;

  const dx = x1 - x0;
  const dy = y1 - y0;
  const dz = z1 - z0;

  const x = clipAxis(x0, dx, aabb.min.x, aabb.max.x, enter, exit);
  if (x === null) return null;
  enter = x.enter;
  exit = x.exit;

  const y = clipAxis(y0, dy, aabb.min.y, aabb.max.y, enter, exit);
  if (y === null) return null;
  enter = y.enter;
  exit = y.exit;

  const z = clipAxis(z0, dz, aabb.min.z, aabb.max.z, enter, exit);
  if (z === null) return null;
  enter = z.enter;
  exit = z.exit;

  return enter;
}

function clipAxis(
  start: number,
  delta: number,
  min: number,
  max: number,
  enter: number,
  exit: number,
): { enter: number; exit: number } | null {
  if (delta === 0) {
    if (start < min || start > max) return null;
    return { enter, exit };
  }

  const inv = 1 / delta;
  let t0 = (min - start) * inv;
  let t1 = (max - start) * inv;
  if (t0 > t1) {
    const tmp = t0;
    t0 = t1;
    t1 = tmp;
  }

  enter = Math.max(enter, t0);
  exit = Math.min(exit, t1);
  if (enter > exit) return null;
  return { enter, exit };
}
