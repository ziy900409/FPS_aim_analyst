import { describe, expect, it } from 'vitest';
import ak47Table from '../../tests/golden/recoil/ak47-table.json';
import { firstBulletSuppression, generateRecoilTable, type WeaponRecoilParams } from './recoilTable.ts';

const ak47Recoil: WeaponRecoilParams = {
  seed: 223,
  magnitude: 30,
  magnitudeVariance: 0,
  angleVariance: 70,
};

describe('generateRecoilTable', () => {
  it('generates exactly 64 entries', () => {
    expect(generateRecoilTable(ak47Recoil)).toHaveLength(64);
  });

  it('applies the AK-47 first-four-bullet suppression factors exactly', () => {
    const table = generateRecoilTable(ak47Recoil);

    expect(table[0].magnitude).toBe(22.5);
    expect(table[1].magnitude).toBe(24.375);
    expect(table[2].magnitude).toBe(26.25);
    expect(table[3].magnitude).toBe(28.125);
    expect(table[4].magnitude).toBe(30);
  });

  it('exposes first bullet suppression as a pure coefficient', () => {
    expect(firstBulletSuppression(0)).toBe(0.75);
    expect(firstBulletSuppression(1)).toBe(0.8125);
    expect(firstBulletSuppression(2)).toBe(0.875);
    expect(firstBulletSuppression(3)).toBe(0.9375);
    expect(firstBulletSuppression(4)).toBe(1);
  });

  it('matches the seed 223 AK-47 golden table for the first 8 bullets', () => {
    const table = generateRecoilTable(ak47Recoil);

    expect(table.slice(0, 8)).toEqual(ak47Table.slice(0, 8));
  });

  it('re-generates the same table bit-for-bit for the same seed', () => {
    expect(generateRecoilTable(ak47Recoil)).toEqual(generateRecoilTable(ak47Recoil));
  });

  it('rejects invalid recoil parameters', () => {
    expect(() => generateRecoilTable({ ...ak47Recoil, magnitudeVariance: -1 })).toThrow(
      'recoil magnitudeVariance must be >= 0',
    );
    expect(() => generateRecoilTable({ ...ak47Recoil, magnitude: 1, magnitudeVariance: 2 })).toThrow(
      'recoil magnitudeVariance must not exceed magnitude',
    );
    expect(() => generateRecoilTable({ ...ak47Recoil, angleVariance: Number.NaN })).toThrow(
      'recoil angleVariance must be finite',
    );
  });
});
