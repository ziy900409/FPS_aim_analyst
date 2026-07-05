import { describe, expect, it } from 'vitest';
import { createRan1, randomFloat } from './rng.ts';

describe('createRan1', () => {
  it('produces the same first 100 values for the same seed', () => {
    const a = createRan1(223);
    const b = createRan1(223);

    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it('produces a different stream for a different seed', () => {
    const a = createRan1(223);
    const b = createRan1(224);

    const aValues = Array.from({ length: 8 }, () => a());
    const bValues = Array.from({ length: 8 }, () => b());

    expect(aValues).not.toEqual(bValues);
  });

  it('returns values in [0, 1)', () => {
    const rng = createRan1(223);

    for (let i = 0; i < 1000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('maps randomFloat into the requested interval', () => {
    const rng = createRan1(223);

    for (let i = 0; i < 1000; i++) {
      const value = randomFloat(rng, -70, 70);
      expect(value).toBeGreaterThanOrEqual(-70);
      expect(value).toBeLessThan(70);
    }
  });

  it('rejects a non-finite seed', () => {
    expect(() => createRan1(Number.NaN)).toThrow('ran1 seed must be finite');
  });
});
