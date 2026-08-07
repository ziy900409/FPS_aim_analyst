import { readFileSync } from 'node:fs';
import type { ExportPayload } from '../../../src/data/export';
import { deriveDetectionMetrics } from '../../../src/metrics/detectionDerivation';
import { describe, expect, it } from 'vitest';

interface DetectParityPresentation {
  targetId: string;
  tVisibleMs: number;
  status: 'detected' | 'timeout';
  tDetectMs: number | null;
  eccentricityAtSpawnDeg: number;
  baselineInsufficient: boolean;
  anticipation: boolean;
  flags: string[];
}

interface DetectParity {
  source: string;
  version: string;
  options: {
    preStimulusMs: number;
    thresholdSdMultiplier: number;
    sustainedTicks: number;
    anticipationMs: number;
    eyeOrigin: { base: { x: number; y: number; z: number }; simToWorld: number; source: string };
  };
  presentations: DetectParityPresentation[];
}

// T0 / D-30.2 frozen roster: only these carry `meta.scene.eye` + `tick-integral` omega, so they are the
// only exports WP-30 may derive ω/ε-based metrics from.
const FIXTURES = [
  'synthetic_counterstrafe.json',
  'counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json',
  'counterstrafe_ad_v1-2026-08-07T09_24_18.148Z.json',
  'counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json',
] as const;

// Banned roster (§0.2): pre-S1 `aim-diff-legacy` exports with no `meta.scene.eye`. Used only to pin the
// negative case -- strict eye-origin resolution must raise, not silently fall back to a guess.
const LEGACY_FIXTURES = [
  'counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json',
  'counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json',
] as const;

// T0 §3.1 pre-registration: the REC/t_detect consistency check (T2) needs >=10 `detected` samples or it
// must report `blocked-by-data` (OQ-S4-15) instead of a vacuous "consistent".
const MIN_DETECTED_SAMPLES = 10;

describe('WP-30 T1 Python/TypeScript t_detect parity', () => {
  for (const fixture of FIXTURES) {
    it(`${fixture} matches deriveDetectionMetrics within 1e-9 relative error`, () => {
      const payload = loadExport(fixture);
      const parity = loadParity(fixture);
      const actual = deriveDetectionMetrics(payload);

      expect(parity.source).toBe(fixture);
      expect(parity.version).toBe('detect-v1');
      expect(actual.options.preStimulusMs).toBe(parity.options.preStimulusMs);
      expect(actual.options.thresholdSdMultiplier).toBe(parity.options.thresholdSdMultiplier);
      expect(actual.options.sustainedTicks).toBe(parity.options.sustainedTicks);
      expect(actual.options.anticipationMs).toBe(parity.options.anticipationMs);
      expect(actual.options.eyeOrigin).toEqual(parity.options.eyeOrigin);
      expect(actual.presentations).toHaveLength(parity.presentations.length);

      actual.presentations.forEach((presentation, index) => {
        const expected = parity.presentations[index];
        expect(presentation.targetId).toBe(expected.targetId);
        expect(presentation.tVisibleMs).toBe(expected.tVisibleMs);
        expect(presentation.status).toBe(expected.status);
        expect(presentation.baselineInsufficient).toBe(expected.baselineInsufficient);
        expect(presentation.anticipation).toBe(expected.anticipation);
        expectRelativeParity(presentation.tDetectMs, expected.tDetectMs);
        expectRelativeParity(presentation.eccentricityAtSpawnDeg, expected.eccentricityAtSpawnDeg);
      });
    });
  }

  it('has enough detected samples to avoid a vacuous t_detect consistency check (OQ-S4-15)', () => {
    const detected = FIXTURES.flatMap((fixture) => loadParity(fixture).presentations).filter(
      (presentation) => presentation.status === 'detected',
    ).length;

    expect(detected).toBeGreaterThanOrEqual(MIN_DETECTED_SAMPLES);
  });

  for (const fixture of LEGACY_FIXTURES) {
    it(`${fixture} raises under strict eye origin resolution (banned roster, §0.2)`, () => {
      const payload = loadExport(fixture);

      expect(() => deriveDetectionMetrics(payload, { strictEyeOrigin: true })).toThrow(/meta\.scene\.eye/);
    });
  }
});

function loadExport(fixture: string): ExportPayload {
  return loadJson<ExportPayload>(`../../../research/fixtures/exports/${fixture}`);
}

function loadParity(fixture: string): DetectParity {
  const stem = fixture.replace(/\.json$/, '');
  return loadJson<DetectParity>(`../../../research/fixtures/parity/detect-${stem}.json`);
}

function loadJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as T;
}

function expectRelativeParity(actual: number | undefined, expected: number | null): void {
  if (expected === null) {
    expect(actual).toBeUndefined();
    return;
  }
  expect(actual).toBeDefined();
  const absoluteError = Math.abs((actual as number) - expected);
  if (expected === 0) {
    expect(absoluteError).toBeLessThanOrEqual(1e-12);
  } else {
    expect(absoluteError / Math.abs(expected)).toBeLessThanOrEqual(1e-9);
  }
}
