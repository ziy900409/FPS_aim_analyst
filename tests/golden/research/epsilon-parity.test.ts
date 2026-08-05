import exportFixture from '../../../research/fixtures/exports/synthetic_counterstrafe.json';
import parityFixture from '../../../research/fixtures/parity/epsilon-synthetic_counterstrafe.json';
import type { ExportPayload } from '../../../src/data/export';
import { deriveTrackingMetrics } from '../../../src/metrics/trackingDerivation';
import { describe, expect, it } from 'vitest';

const numericFields = [
  'tAcquireMs',
  'totPercent',
  'rmsEpsilonDeg',
  'medianEpsilonDeg',
  'p95EpsilonDeg',
] as const;

describe('WP-28 T2 Python/TypeScript epsilon parity', () => {
  it('matches deriveTrackingMetrics presentation-by-presentation within 1e-9 relative error', () => {
    const payload = exportFixture as unknown as ExportPayload;
    const actual = deriveTrackingMetrics(payload, parityFixture.options);

    expect(parityFixture.source).toBe('synthetic_counterstrafe.json');
    expect(actual.options).toEqual(parityFixture.options);
    expect(actual.presentations).toHaveLength(parityFixture.presentations.length);

    actual.presentations.forEach((presentation, index) => {
      const expected = parityFixture.presentations[index];
      expect(presentation.targetId).toBe(expected.targetId);
      expect(presentation.tVisibleMs).toBe(expected.tVisibleMs);
      expect(presentation.acquisitionFailure).toBe(expected.acquisitionFailure);
      for (const field of numericFields) {
        expectRelativeParity(presentation[field], expected[field]);
      }
    });
  });
});

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
