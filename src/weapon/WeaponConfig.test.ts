import { describe, expect, it } from 'vitest';
import { validateWeapon, type WeaponConfig } from './WeaponConfig.ts';
import { ak47, getWeapon, m4a1s, m4a4, WEAPONS } from './weapons.ts';

function validWeapon(overrides: Partial<WeaponConfig> = {}): WeaponConfig {
  return {
    id: 'test_weapon',
    cycletimeSec: 0.1,
    magSize: 30,
    recoil: {
      seed: 223,
      magnitude: 30,
      magnitudeVariance: 0,
      angleVariance: 70,
    },
    inaccuracy: {
      stand: 0.00641,
      crouch: 0.00481,
      fire: 0.0078,
      move: 0.02,
      recoveryTimeStand: 0.4,
      recoveryTimeCrouch: 0.3,
    },
    ...overrides,
  };
}

describe('validateWeapon', () => {
  it('accepts the minimal weapon config and narrows the type', () => {
    const cfg: WeaponConfig = validateWeapon(validWeapon());

    expect(cfg.id).toBe('test_weapon');
    expect(cfg.cycletimeSec).toBe(0.1);
    expect(cfg.magSize).toBe(30);
    expect(cfg.recoil.seed).toBe(223);
    expect(cfg.inaccuracy.fire).toBe(0.0078);
  });

  it('preserves optional recoveryTransition when present', () => {
    const cfg = validateWeapon(validWeapon({ recoveryTransition: { startBullet: 5, endBullet: 10 } }));

    expect(cfg.recoveryTransition).toEqual({ startBullet: 5, endBullet: 10 });
  });

  it('rejects missing fields with field paths', () => {
    const bad = validWeapon() as unknown as Record<string, unknown>;
    delete bad.id;

    expect(() => validateWeapon(bad)).toThrow(/id/);
  });

  it('rejects zero cycletime', () => {
    expect(() => validateWeapon(validWeapon({ cycletimeSec: 0 }))).toThrow(/cycletimeSec/);
  });

  it('rejects invalid magazine sizes', () => {
    expect(() => validateWeapon(validWeapon({ magSize: 30.5 }))).toThrow(/magSize/);
    expect(() => validateWeapon(validWeapon({ magSize: -1 }))).toThrow(/magSize/);
  });

  it('rejects invalid recoil ranges', () => {
    expect(() =>
      validateWeapon(validWeapon({ recoil: { seed: 223, magnitude: 1, magnitudeVariance: 2, angleVariance: 70 } })),
    ).toThrow(/recoil\.magnitudeVariance/);
  });

  it('rejects invalid recovery transitions', () => {
    expect(() => validateWeapon(validWeapon({ recoveryTransition: { startBullet: 11, endBullet: 10 } }))).toThrow(
      /recoveryTransition\.startBullet/,
    );
  });

  // ── WP-24 / T2：ADS 光學欄（FR-E5） ──

  it('omits ads when not present (weapon cannot ADS)', () => {
    expect(validateWeapon(validWeapon())).not.toHaveProperty('ads');
  });

  it('preserves optional ads when present', () => {
    const cfg = validateWeapon(validWeapon({ ads: { fovDeg: 40, sensitivityRatio: 1.0 } }));

    expect(cfg.ads).toEqual({ fovDeg: 40, sensitivityRatio: 1.0 });
  });

  it('rejects non-positive ads.fovDeg with field path', () => {
    expect(() => validateWeapon(validWeapon({ ads: { fovDeg: 0, sensitivityRatio: 1.0 } }))).toThrow(/ads\.fovDeg/);
  });

  it('rejects non-positive ads.sensitivityRatio with field path', () => {
    expect(() => validateWeapon(validWeapon({ ads: { fovDeg: 40, sensitivityRatio: 0 } }))).toThrow(
      /ads\.sensitivityRatio/,
    );
  });

  // ── WP-25 / T3：projectile bullet gate（FR-E9） ──

  it('omits bullet when not present (hitscan default)', () => {
    expect(validateWeapon(validWeapon())).not.toHaveProperty('bullet');
  });

  it('preserves projectile bullet config when present', () => {
    const bullet = { model: 'projectile' as const, speedU: 916.73, gravityU: 32, maxRangeU: 143.24 };
    const cfg = validateWeapon(validWeapon({ bullet }));

    expect(cfg.bullet).toEqual(bullet);
  });

  it('rejects invalid projectile bullet fields with field paths', () => {
    expect(() =>
      validateWeapon(
        validWeapon({
          bullet: { model: 'hitscan' as 'projectile', speedU: 916.73, gravityU: 32, maxRangeU: 143.24 },
        }),
      ),
    ).toThrow(/bullet\.model/);
    expect(() =>
      validateWeapon(validWeapon({ bullet: { model: 'projectile', speedU: 0, gravityU: 32, maxRangeU: 143.24 } })),
    ).toThrow(/bullet\.speedU/);
    expect(() =>
      validateWeapon(validWeapon({ bullet: { model: 'projectile', speedU: 916.73, gravityU: 0, maxRangeU: 143.24 } })),
    ).toThrow(/bullet\.gravityU/);
    expect(() =>
      validateWeapon(validWeapon({ bullet: { model: 'projectile', speedU: 916.73, gravityU: 32, maxRangeU: 0 } })),
    ).toThrow(/bullet\.maxRangeU/);
  });

  it('warns when projectile reaches engagement distance in less than two ticks', () => {
    const warnings: { path: string; message: string }[] = [];

    validateWeapon(
      validWeapon({ bullet: { model: 'projectile', speedU: 1833.45, gravityU: 51.2, maxRangeU: 143.24 } }),
      { engagementDistanceU: 20, warnings },
    );

    expect(warnings).toContainEqual({
      path: 'bullet.speedU',
      message: 'projectile reaches engagement distance in < 2 ticks',
    });
  });

  it('does not warn for GD-17 canonical sixteen-tick projectile config', () => {
    const warnings: { path: string; message: string }[] = [];

    validateWeapon(
      validWeapon({ bullet: { model: 'projectile', speedU: 916.73, gravityU: 32, maxRangeU: 143.24 } }),
      { engagementDistanceU: 114.59, warnings },
    );

    expect(warnings).toEqual([]);
  });
});

describe('built-in weapons', () => {
  it('validates every built-in weapon', () => {
    expect(validateWeapon(ak47)).toEqual(ak47);
    expect(validateWeapon(m4a4)).toEqual(m4a4);
    expect(validateWeapon(m4a1s)).toEqual(m4a1s);
  });

  it('locks CS2 vdata values used by WP-11 scheduling and recoil', () => {
    expect(WEAPONS.ak47).toMatchObject({
      id: 'ak47',
      cycletimeSec: 0.1,
      magSize: 30,
      recoil: { seed: 223, magnitude: 30, magnitudeVariance: 0, angleVariance: 70 },
      inaccuracy: { fire: 0.0078 },
    });
    expect(WEAPONS.m4a4).toMatchObject({
      cycletimeSec: 0.09,
      magSize: 30,
      recoil: { seed: 38965, magnitude: 23, magnitudeVariance: 0, angleVariance: 70 },
      inaccuracy: { fire: 0.007 },
    });
    expect(WEAPONS.m4a1s).toMatchObject({
      cycletimeSec: 0.1,
      magSize: 20,
      recoil: { seed: 38965, magnitude: 25, magnitudeVariance: 3, angleVariance: 65 },
      inaccuracy: { fire: 0.012 },
    });
  });

  it('carries the WP-24 demo ADS optics on ak47 (default drill weapon)', () => {
    expect(WEAPONS.ak47.ads).toEqual({ fovDeg: 40, sensitivityRatio: 1.0 });
  });

  it('returns known weapons by id and reports available ids for unknown weapons', () => {
    expect(getWeapon('ak47').recoil.seed).toBe(223);
    expect(() => getWeapon('awp')).toThrow(/Available weapons: ak47, m4a4, m4a1s/);
  });
});
