import { describe, expect, it } from 'vitest';
import { BULLET_DT_SEC, spawnBullet, stepBullet, type BulletState } from './bullet.ts';

function emptyBullet(): BulletState {
  return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, ageTicks: 0, alive: false };
}

function snapshot(b: BulletState): BulletState {
  return {
    x: b.x,
    y: b.y,
    z: b.z,
    vx: b.vx,
    vy: b.vy,
    vz: b.vz,
    ageTicks: b.ageTicks,
    alive: b.alive,
  };
}

describe('projectile bullet dynamics', () => {
  it('spawns into the provided reusable state object', () => {
    const out = emptyBullet();

    const returned = spawnBullet(out, { x: 1, y: 2, z: 3 }, { x: 0, y: 0, z: -1 }, 916.73);

    expect(returned).toBe(out);
    expect(out).toEqual({
      x: 1,
      y: 2,
      z: 3,
      vx: 0,
      vy: 0,
      vz: -916.73,
      ageTicks: 0,
      alive: true,
    });
  });

  it('rejects non-128Hz projectile ticks', () => {
    const b = spawnBullet(emptyBullet(), { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, 1);

    expect(() => stepBullet(b, 1 / 64, 0)).toThrow('stepBullet dtSec must be exactly 1/128');
  });

  it('keeps flat flight bit-exact against origin + direction * speed * n / 128', () => {
    const b = spawnBullet(emptyBullet(), { x: 1, y: 2, z: 3 }, { x: 0, y: 0, z: -1 }, 458.36);

    for (let i = 0; i < 32; i++) stepBullet(b, BULLET_DT_SEC, 0);

    expect(snapshot(b)).toEqual({
      x: 1,
      y: 2,
      z: -111.59000000000005,
      vx: 0,
      vy: 0,
      vz: -458.36,
      ageTicks: 32,
      alive: true,
    });
  });

  it('matches the GD-17 16-tick gravity golden sequence for the first 32 ticks', () => {
    const b = spawnBullet(emptyBullet(), { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -1 }, 916.73);
    const samples: Array<{ tick: number; y: number; z: number; vy: number }> = [];

    for (let tick = 1; tick <= 32; tick++) {
      stepBullet(b, BULLET_DT_SEC, 32);
      samples.push({ tick, y: b.y, z: b.z, vy: b.vy });
    }

    expect(samples).toEqual([
      { tick: 1, y: 0.998046875, z: -7.161953125, vy: -0.25 },
      { tick: 2, y: 0.994140625, z: -14.32390625, vy: -0.5 },
      { tick: 3, y: 0.98828125, z: -21.485859375, vy: -0.75 },
      { tick: 4, y: 0.98046875, z: -28.6478125, vy: -1 },
      { tick: 5, y: 0.970703125, z: -35.809765625, vy: -1.25 },
      { tick: 6, y: 0.958984375, z: -42.971718749999994, vy: -1.5 },
      { tick: 7, y: 0.9453125, z: -50.13367187499999, vy: -1.75 },
      { tick: 8, y: 0.9296875, z: -57.29562499999999, vy: -2 },
      { tick: 9, y: 0.912109375, z: -64.45757812499998, vy: -2.25 },
      { tick: 10, y: 0.892578125, z: -71.61953124999998, vy: -2.5 },
      { tick: 11, y: 0.87109375, z: -78.78148437499998, vy: -2.75 },
      { tick: 12, y: 0.84765625, z: -85.94343749999997, vy: -3 },
      { tick: 13, y: 0.822265625, z: -93.10539062499997, vy: -3.25 },
      { tick: 14, y: 0.794921875, z: -100.26734374999997, vy: -3.5 },
      { tick: 15, y: 0.765625, z: -107.42929687499996, vy: -3.75 },
      { tick: 16, y: 0.734375, z: -114.59124999999996, vy: -4 },
      { tick: 17, y: 0.701171875, z: -121.75320312499996, vy: -4.25 },
      { tick: 18, y: 0.666015625, z: -128.91515624999997, vy: -4.5 },
      { tick: 19, y: 0.62890625, z: -136.07710937499996, vy: -4.75 },
      { tick: 20, y: 0.58984375, z: -143.23906249999996, vy: -5 },
      { tick: 21, y: 0.548828125, z: -150.40101562499996, vy: -5.25 },
      { tick: 22, y: 0.505859375, z: -157.56296874999995, vy: -5.5 },
      { tick: 23, y: 0.4609375, z: -164.72492187499995, vy: -5.75 },
      { tick: 24, y: 0.4140625, z: -171.88687499999995, vy: -6 },
      { tick: 25, y: 0.365234375, z: -179.04882812499994, vy: -6.25 },
      { tick: 26, y: 0.314453125, z: -186.21078124999994, vy: -6.5 },
      { tick: 27, y: 0.26171875, z: -193.37273437499994, vy: -6.75 },
      { tick: 28, y: 0.20703125, z: -200.53468749999993, vy: -7 },
      { tick: 29, y: 0.150390625, z: -207.69664062499993, vy: -7.25 },
      { tick: 30, y: 0.091796875, z: -214.85859374999993, vy: -7.5 },
      { tick: 31, y: 0.03125, z: -222.02054687499992, vy: -7.75 },
      { tick: 32, y: -0.03125, z: -229.18249999999992, vy: -8 },
    ]);
  });

  it('does not advance inactive reusable slots', () => {
    const b = emptyBullet();
    b.x = 5;

    expect(stepBullet(b, BULLET_DT_SEC, 32)).toBe(b);
    expect(b).toEqual({ x: 5, y: 0, z: 0, vx: 0, vy: 0, vz: 0, ageTicks: 0, alive: false });
  });
});
