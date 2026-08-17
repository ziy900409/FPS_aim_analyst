import { describe, expect, it } from 'vitest';
import { SG_SEG_V2, sgSmooth, type SgCoefficients } from './savitzkyGolay.ts';

describe('sgSmooth', () => {
  it('preserves a cubic signal with the frozen seg-v2 coefficients', () => {
    const values = Array.from({ length: 21 }, (_, x) => x ** 3 - 2 * x ** 2 + 3 * x - 4);

    const actual = sgSmooth(values, SG_SEG_V2);

    actual.forEach((value, index) => expect(value).toBeCloseTo(values[index], 9));
  });

  it('rejects finite-contract violations', () => {
    expect(() => sgSmooth([1, 2, 3], SG_SEG_V2)).toThrow(/fewer than window/);
    expect(() => sgSmooth([1, 2, Number.NaN, 4, 5, 6, 7, 8, 9, 10, 11], SG_SEG_V2)).toThrow(/finite values/);
  });

  it('rejects coefficient-contract violations', () => {
    expect(() => sgSmooth([1, 2, 3, 4, 5], { ...SG_SEG_V2, window: 4 })).toThrow(/positive odd integer/);
    expect(() => sgSmooth([1, 2, 3, 4, 5], { ...SG_SEG_V2, window: 5, poly: 5 })).toThrow(
      /less than window/,
    );
    expect(() =>
      sgSmooth(
        Array.from({ length: 11 }, (_, index) => index),
        { ...SG_SEG_V2, interior: SG_SEG_V2.interior.slice(1) } satisfies SgCoefficients,
      ),
    ).toThrow(/interior/);
  });
});
