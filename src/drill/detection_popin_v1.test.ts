import { describe, expect, it } from 'vitest';
import { loadDrill } from './DrillLoader.ts';
import { detectionPopinV1 } from './detection_popin_v1.ts';
import { fieldLow } from '../scene/scenes/field-low.ts';

describe('detection_popin_v1 drill config', () => {
  it('validates as a seeded pop-in detection drill', () => {
    const cfg = loadDrill(detectionPopinV1);

    expect(cfg.drillId).toBe('detection_popin_v1');
    expect(cfg.targets.count).toBe(20);
    expect(cfg.targets.spawnArea).toEqual({ yawDegRange: [-25, 25], distanceURange: [3.2, 4.4] });
    expect(cfg.sequence.seed).toBe(21021);
    expect(cfg.sequence.spawnDelayMsRange).toEqual([800, 2400]);
    expect(cfg.timing.peekTimeoutMs).toBe(1500);
    expect(cfg.endCondition).toEqual({ type: 'targetCount', value: 20 });
  });

  it('passes clearance in the default field-low scene used by app startup', () => {
    expect(() => loadDrill(detectionPopinV1, fieldLow)).not.toThrow();
  });
});
