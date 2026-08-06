import { describe, expect, it } from 'vitest';
import { isOutsideCorridor } from './corridor.ts';

describe('isOutsideCorridor (KI-004 / S1 T3, FR-S1-3/4)', () => {
  const halfWidthU = 1; // world unit
  const simToWorld = 0.01; // world unit per source unit (SIM_TO_WORLD)

  it('stays inside the corridor at a value the legacy source-unit comparison would have flagged', () => {
    // Legacy bug: `50 > halfWidthU(1)` was true — 100x too tight.
    // World domain: 50 source unit * 0.01 = 0.5 world unit, inside the 1 world unit corridor.
    expect(isOutsideCorridor(50, halfWidthU, simToWorld)).toBe(false);
  });

  it('flips exactly at the world-domain boundary (100 source unit for halfWidthU=1)', () => {
    expect(isOutsideCorridor(99.9, halfWidthU, simToWorld)).toBe(false);
    expect(isOutsideCorridor(100, halfWidthU, simToWorld)).toBe(false); // boundary itself: strict `>`
    expect(isOutsideCorridor(100.1, halfWidthU, simToWorld)).toBe(true);
  });

  it('is symmetric for negative playerX', () => {
    expect(isOutsideCorridor(-100.1, halfWidthU, simToWorld)).toBe(true);
    expect(isOutsideCorridor(-99.9, halfWidthU, simToWorld)).toBe(false);
  });
});
