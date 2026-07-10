import { describe, expect, it } from 'vitest';
import { loadDrill } from './DrillLoader.ts';
import { trackingLongrangeV1 } from './tracking_longrange_v1.ts';
import { targetHitboxToConfig, resolveTargetHitbox } from './DrillConfig.ts';
import { formatClearanceViolations, validateClearance } from '../scene/clearance.ts';
import { fieldLow } from '../scene/scenes/field-low.ts';

const EPS = 1e-9;
const DEG_TO_RAD = Math.PI / 180;

describe('tracking_longrange_v1 drill config', () => {
  it('encodes the T0 canonical 0.5deg x 5deg/s angular profile', () => {
    const cfg = loadDrill(trackingLongrangeV1.drill, fieldLow);
    const expectedDistance = 1 / (2 * Math.tan((0.5 * DEG_TO_RAD) / 2));
    const expectedSpeed = expectedDistance * 5 * DEG_TO_RAD;

    expect(trackingLongrangeV1.id).toBe('tracking_longrange_v1');
    expect(trackingLongrangeV1.sceneId).toBe('field-low');
    expect(cfg.drillId).toBe('tracking_longrange_v1');
    expect(cfg.targets.distance).toBeCloseTo(expectedDistance, 12);
    expect(cfg.targets.hitbox).toEqual({ widthU: 0.5, heightU: 1, depthU: 0.5 });
    expect(cfg.targets.motion).toEqual({
      type: 'pingpong',
      axis: 'horizontal',
      range: expectedSpeed / 2,
      speed: expectedSpeed,
    });
    expect(cfg.timing.presentationMs).toBe(2000);
    expect(cfg.timing.peekTimeoutMs).toBeUndefined();
  });

  it('uses a fixed field-low spawn lane while preserving radial distance', () => {
    const cfg = loadDrill(trackingLongrangeV1.drill, fieldLow);

    expect(cfg.targets.spawnArea).toEqual({
      yawDegRange: [110, 110],
      distanceURange: [cfg.targets.distance, cfg.targets.distance],
    });
    expect(Math.abs(cfg.targets.spawnArea!.distanceURange[0] - cfg.targets.distance)).toBeLessThan(EPS);
    expect(cfg.sequence.seed).toBe(23002);
  });

  it('exports the resolved small hitbox shape used by sim/render/offline metrics', () => {
    const cfg = loadDrill(trackingLongrangeV1.drill, fieldLow);

    expect(targetHitboxToConfig(resolveTargetHitbox(cfg))).toEqual({ widthU: 0.5, heightU: 1, depthU: 0.5 });
  });

  it('passes field-low clearance for the long-range moving envelope', () => {
    const cfg = loadDrill(trackingLongrangeV1.drill);
    const violations = validateClearance(fieldLow, cfg);

    expect(violations, formatClearanceViolations(violations)).toEqual([]);
    expect(() => loadDrill(trackingLongrangeV1.drill, fieldLow)).not.toThrow();
  });
});
