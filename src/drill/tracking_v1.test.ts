import { describe, expect, it } from 'vitest';
import { loadDrill } from './DrillLoader.ts';
import { trackingV1 } from './tracking_v1.ts';

describe('tracking_v1 drill config', () => {
  it('validates as a pure tracking drill with motion + timed presentation', () => {
    const cfg = loadDrill(trackingV1);

    expect(cfg.drillId).toBe('tracking_v1');
    expect(cfg.targets.count).toBe(10);
    // Motion is a T1-driven type with the field-low-compatible envelope fixed in T0 OQ-18.1.
    expect(cfg.targets.motion).toEqual({ type: 'pingpong', axis: 'horizontal', range: 1, speed: 2 });
    // timed presentation (T3): drives advance, not kill-to-advance; no peekTimeoutMs.
    expect(cfg.timing.presentationMs).toBe(2000);
    expect(cfg.timing.peekTimeoutMs).toBeUndefined();
    // seed recorded for reproducibility (metadata).
    expect(cfg.sequence.seed).toBe(18018);
    expect(cfg.endCondition).toEqual({ type: 'targetCount', value: 10 });
  });

  it('keeps the T0 OQ-18.1 field-low-compatible motion envelope bounds', () => {
    const motion = trackingV1.targets.motion!;
    expect(motion.axis).toBe('horizontal');
    expect(motion.range).toBeGreaterThanOrEqual(0.5);
    expect(motion.range).toBeLessThanOrEqual(1.5);
    expect(motion.speed).toBeGreaterThanOrEqual(1);
    expect(motion.speed).toBeLessThanOrEqual(4);
  });
});
