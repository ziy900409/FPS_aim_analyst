import { readFileSync } from 'node:fs';
import type { ExportPayload } from '../../../src/data/export';
import { omegaDegPerSec } from '../../../src/metrics/angularKinematics';
import { SG_SEG_V2, sgSmooth, type SgCoefficients } from '../../../src/metrics/filters/savitzkyGolay';
import { describe, expect, it } from 'vitest';

interface OmegaGolden {
  version: string;
  source: string;
  omegaSource: 'tick-integral';
  sampleCount: number;
  finiteCount: number;
  maxOmegaDegPerSec: number;
  values: Array<number | null>;
  sg: {
    version: string;
    input: 'omega.values[1:]';
    values: number[];
  };
}

const FIXTURES = [
  { name: 'counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json', minFinite: 1000 },
  { name: 'counterstrafe_ad_v1-2026-08-07T09_24_18.148Z.json', minFinite: 1000 },
  { name: 'counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json', minFinite: 1000 },
  { name: 'synthetic_counterstrafe_t1_long.json', minFinite: 100 },
] as const;

const LEGACY_FIXTURES = [
  'counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json',
  'counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json',
] as const;

describe('WP-32 T1 Python/TypeScript promoted kinematics parity', () => {
  it('matches SG_SEG_V2 constants against committed golden within 1e-12', () => {
    const golden = loadJson<SgCoefficients>('../../../research/fixtures/golden/sg-coeffs-seg-v2.json');

    expect(SG_SEG_V2.version).toBe('sg-seg-v2');
    expect(SG_SEG_V2.window).toBe(golden.window);
    expect(SG_SEG_V2.poly).toBe(golden.poly);
    expectCoefficientParity(SG_SEG_V2.interior, golden.interior);
    SG_SEG_V2.leadingEdge.forEach((row, index) => expectCoefficientParity(row, golden.leadingEdge[index]));
    SG_SEG_V2.trailingEdge.forEach((row, index) => expectCoefficientParity(row, golden.trailingEdge[index]));
  });

  for (const fixture of FIXTURES) {
    it(`${fixture.name} omega and SG-smoothed omega match Python golden`, () => {
      const payload = loadJson<ExportPayload>(`../../../research/fixtures/exports/${fixture.name}`);
      const golden = loadOmega(fixture.name);
      const actual = omegaDegPerSec(payload.ticks);

      expect(golden.version).toBe('omega-v1');
      expect(golden.source).toBe(fixture.name);
      expect(golden.omegaSource).toBe('tick-integral');
      expect(actual.source).toBe(golden.omegaSource);
      expect(actual.values).toHaveLength(golden.sampleCount);
      expect(actual.values).toHaveLength(golden.values.length);
      expect(golden.finiteCount).toBeGreaterThanOrEqual(fixture.minFinite);
      expect(golden.maxOmegaDegPerSec).toBeGreaterThan(100);
      actual.values.forEach((value, index) => expectNullableParity(value, golden.values[index]));

      const smoothed = sgSmooth(actual.values.slice(1), SG_SEG_V2);
      expect(smoothed).toHaveLength(golden.sg.values.length);
      smoothed.forEach((value, index) => expectRelativeParity(value, golden.sg.values[index]));
    });
  }

  for (const fixture of LEGACY_FIXTURES) {
    it(`${fixture} raises instead of falling back to aim-diff-legacy`, () => {
      const payload = loadJson<ExportPayload>(`../../../research/fixtures/exports/${fixture}`);

      expect(() => omegaDegPerSec(payload.ticks)).toThrow(/dYaw\/dPitch|KI-005/);
    });
  }
});

function loadOmega(fixture: string): OmegaGolden {
  const stem = fixture.replace(/\.json$/, '');
  return loadJson<OmegaGolden>(`../../../research/fixtures/golden/omega-${stem}.json`);
}

function loadJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as T;
}

function expectCoefficientParity(actual: readonly number[], expected: readonly number[]): void {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((value, index) => {
    expect(Math.abs(value - expected[index])).toBeLessThanOrEqual(1e-12);
  });
}

function expectNullableParity(actual: number, expected: number | null): void {
  if (expected === null) {
    expect(Number.isNaN(actual)).toBe(true);
    return;
  }
  expectRelativeParity(actual, expected);
}

function expectRelativeParity(actual: number, expected: number): void {
  const absoluteError = Math.abs(actual - expected);
  if (expected === 0) {
    expect(absoluteError).toBeLessThanOrEqual(1e-12);
  } else {
    expect(absoluteError / Math.abs(expected)).toBeLessThanOrEqual(1e-9);
  }
}
