import { describe, expect, it } from 'vitest';
import { loadDrill } from './DrillLoader.ts';
import { trackingBrV1, trackingBrVariants } from './tracking_br_v1.ts';
import { targetHitboxToConfig, resolveTargetHitbox } from './DrillConfig.ts';
import { formatClearanceViolations, validateClearance } from '../scene/clearance.ts';
import { brField } from '../scene/scenes/br-field.ts';
import { getWeapon } from '../weapon/weapons.ts';

const DEG_TO_RAD = Math.PI / 180;

function expectedDistance(angularHeightDeg: number): number {
  return 1 / (2 * Math.tan((angularHeightDeg * DEG_TO_RAD) / 2));
}

describe('tracking_br_v1 drill config', () => {
  it('declares the canonical BR tracking drill on br-field with ADS + projectile enabled', () => {
    const cfg = loadDrill(trackingBrV1.drill, brField);
    const weapon = getWeapon(cfg.weaponId ?? '');

    expect(trackingBrV1.id).toBe('tracking_br_v1');
    expect(trackingBrV1.sceneId).toBe('br-field');
    expect(trackingBrV1.axes).toEqual({
      ads: 'ads_on',
      ballistic: 'projectile',
      angularHeight: '0p5deg',
    });
    expect(cfg.drillId).toBe('tracking_br_v1');
    expect(cfg.weaponId).toBe('ak47_br_ads_projectile');
    expect(weapon.ads).toEqual({ fovDeg: 40, sensitivityRatio: 1.0 });
    expect(weapon.bullet).toEqual({ model: 'projectile', speedU: 916.73, gravityU: 32, maxRangeU: 143.24 });
    expect(cfg.targets.spawnArea).toEqual({
      yawDegRange: [0, 0],
      distanceURange: [cfg.targets.distance, cfg.targets.distance],
    });
    expect(targetHitboxToConfig(resolveTargetHitbox(cfg))).toEqual({
      widthU: 0.5,
      heightU: 1,
      depthU: 0.5,
      shape: 'box',
    });
  });

  it('covers the pre-registered 2 x 2 x 2 condition matrix with unique drill ids', () => {
    const ids = new Set(trackingBrVariants.map((variant) => variant.id));
    const axisKeys = trackingBrVariants.map(
      (variant) => `${variant.axes.ads}/${variant.axes.ballistic}/${variant.axes.angularHeight}`,
    );

    expect(trackingBrVariants).toHaveLength(8);
    expect(ids.size).toBe(8);
    expect(new Set(axisKeys).size).toBe(8);
    expect(axisKeys).toEqual([
      'ads_off/hitscan/0p5deg',
      'ads_on/hitscan/0p5deg',
      'ads_off/projectile/0p5deg',
      'ads_on/projectile/0p5deg',
      'ads_off/hitscan/2deg',
      'ads_on/hitscan/2deg',
      'ads_off/projectile/2deg',
      'ads_on/projectile/2deg',
    ]);
  });

  it('encodes the 0.5deg and 2deg angular-height profiles using WP-23 geometry', () => {
    for (const variant of trackingBrVariants) {
      const cfg = loadDrill(variant.drill, brField);
      const angularHeight = variant.axes.angularHeight === '0p5deg' ? 0.5 : 2.0;
      const distance = expectedDistance(angularHeight);
      const expectedSpeed = distance * 5 * DEG_TO_RAD;

      expect(cfg.targets.distance).toBeCloseTo(distance, 12);
      expect(cfg.targets.motion).toEqual({
        type: 'pingpong',
        axis: 'horizontal',
        range: expectedSpeed / 2,
        speed: expectedSpeed,
      });
      expect(cfg.timing.presentationMs).toBe(2000);
    }
  });

  it('uses ADS/projectile weapon gates only through variant weapon ids', () => {
    for (const variant of trackingBrVariants) {
      const cfg = loadDrill(variant.drill, brField);
      const weapon = getWeapon(cfg.weaponId ?? '');

      expect(weapon.ads !== undefined).toBe(variant.axes.ads === 'ads_on');
      expect(weapon.bullet !== undefined).toBe(variant.axes.ballistic === 'projectile');
    }
  });

  it('passes br-field clearance for every front-facing BR tracking envelope', () => {
    for (const variant of trackingBrVariants) {
      const cfg = loadDrill(variant.drill);
      const violations = validateClearance(brField, cfg);

      expect(violations, `${variant.id}: ${formatClearanceViolations(violations)}`).toEqual([]);
      expect(() => loadDrill(variant.drill, brField)).not.toThrow();
    }
  });
});
