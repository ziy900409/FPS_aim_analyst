import { describe, expect, it } from 'vitest';
import { loadDrill } from './DrillLoader.ts';
import { trackingSceneV1 } from './tracking_scene_v1.ts';
import { trackingV1 } from './tracking_v1.ts';
import { formatClearanceViolations, validateClearance } from '../scene/clearance.ts';
import { fieldLow } from '../scene/scenes/field-low.ts';
import { urbanHigh } from '../scene/scenes/urban-high.ts';

describe('tracking_scene_v1 scene-drill config', () => {
  it('wraps tracking_v1 with the required field-low scene', () => {
    const cfg = loadDrill(trackingSceneV1.drill, fieldLow);

    expect(trackingSceneV1.id).toBe('tracking_scene_v1');
    expect(trackingSceneV1.sceneId).toBe('field-low');
    expect(cfg.drillId).toBe('tracking_scene_v1');
    expect(cfg.targets).toEqual({
      ...trackingV1.targets,
      motion: { ...trackingV1.targets.motion, range: 0.25 },
    });
    expect(cfg.sequence).toEqual(trackingV1.sequence);
    expect(cfg.timing).toEqual(trackingV1.timing);
    expect(cfg.endCondition).toEqual(trackingV1.endCondition);
  });

  it('passes moving-envelope clearance in the required field-low scene', () => {
    const cfg = loadDrill(trackingSceneV1.drill);
    const violations = validateClearance(fieldLow, cfg);

    expect(violations, formatClearanceViolations(violations)).toEqual([]);
    expect(() => loadDrill(trackingSceneV1.drill, fieldLow)).not.toThrow();
  });

  it('also passes the urban-high clutter scene envelope check', () => {
    const cfg = loadDrill(trackingSceneV1.drill);
    const violations = validateClearance(urbanHigh, cfg);

    expect(violations, formatClearanceViolations(violations)).toEqual([]);
    expect(() => loadDrill(trackingSceneV1.drill, urbanHigh)).not.toThrow();
  });
});
