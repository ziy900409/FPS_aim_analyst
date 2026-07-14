import { describe, expect, it } from 'vitest';
import { sweptHitTest, type Aabb } from './sweptHit.ts';

const centeredTarget: Aabb = {
  min: { x: -0.5, y: -0.5, z: -10.5 },
  max: { x: 0.5, y: 0.5, z: -10 },
};

describe('swept projectile hit test', () => {
  it('returns null before the known hit tick and s on the first hit tick', () => {
    const unitsPerTick = 1;
    const hitDistance = 10;
    const expectedHitTick = Math.ceil(hitDistance / unitsPerTick);

    expect(expectedHitTick).toBe(10);
    expect(sweptHitTest(0, 0, -8, 0, 0, -9, centeredTarget)).toBeNull();
    expect(sweptHitTest(0, 0, -9, 0, 0, -10, centeredTarget)).toBe(1);
  });

  it('catches a high-speed segment through a thin AABB', () => {
    const thin: Aabb = {
      min: { x: -0.25, y: -0.25, z: -50.01 },
      max: { x: 0.25, y: 0.25, z: -50 },
    };

    expect(sweptHitTest(0, 0, 0, 0, 0, -100, thin)).toBe(0.5);
  });

  it('treats boundary tangency as a hit', () => {
    const aabb: Aabb = {
      min: { x: 1, y: -1, z: -1 },
      max: { x: 2, y: 1, z: 1 },
    };

    expect(sweptHitTest(0, 1, 0, 3, 1, 0, aabb)).toBe(1 / 3);
  });

  it('handles parallel zero-delta axes inside the slab', () => {
    expect(sweptHitTest(0, 0, -9, 0, 0, -11, centeredTarget)).toBe(0.5);
  });

  it('rejects parallel zero-delta axes outside the slab', () => {
    expect(sweptHitTest(2, 0, -9, 2, 0, -11, centeredTarget)).toBeNull();
  });

  it('returns 0 when the segment starts inside the AABB', () => {
    expect(sweptHitTest(0, 0, -10.25, 0, 0, -12, centeredTarget)).toBe(0);
  });

  it('returns null when the infinite ray would hit outside the segment interval', () => {
    expect(sweptHitTest(0, 0, 0, 0, 0, -5, centeredTarget)).toBeNull();
  });
});
