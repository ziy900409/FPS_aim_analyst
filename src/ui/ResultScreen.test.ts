import { describe, expect, it } from 'vitest';
import type { Metrics } from '../metrics/compute.ts';
import { classifyResidualSpeed, createResultSummary } from './ResultScreen.ts';

const metrics: Metrics = {
  counterReactionMs: { mean: 63.33, sd: 12.47, n: 3, values: [50, 80, 60] },
  residualSpeed: { mean: 62.5, sd: 108.25, n: 4, values: [0, 250, 0, 0] },
  fireTimingAlignmentMs: { mean: 13.33, sd: 4.71, n: 3, values: [20, 10, 10] },
  firstShotHitRate: 66.666,
  crosshairOffset: { mean: 1.125, sd: 0.74, n: 4, values: [0, 2, 1.5, 1] },
  switchTimeMs: { mean: 110, sd: 20, n: 2, values: [130, 90] },
  rhythmStability: 0.0834,
  leftRightSymmetry: {
    left: { mean: 80, sd: 0, n: 1, values: [80] },
    right: { mean: 55, sd: 5, n: 2, values: [50, 60] },
    diff: 25,
  },
};

describe('createResultSummary', () => {
  it('maps the eight WP-8 metrics to result cards and reaction distribution values', () => {
    const summary = createResultSummary(metrics);

    expect(summary.cards.map((card) => card.id)).toEqual([
      'counterReactionMs',
      'residualSpeed',
      'fireTimingAlignmentMs',
      'firstShotHitRate',
      'crosshairOffset',
      'switchTimeMs',
      'rhythmStability',
      'leftRightSymmetry',
    ]);
    expect(summary.reactionValues).toEqual([50, 80, 60]);
    expect(summary.cards.find((card) => card.id === 'firstShotHitRate')?.value).toBe('66.7%');
    expect(summary.cards.find((card) => card.id === 'leftRightSymmetry')?.value).toBe('25 ms');
    expect(summary.methodNote).toContain('Subject-relative');
  });

  it('keeps empty samples display-safe', () => {
    const empty = createResultSummary({
      ...metrics,
      counterReactionMs: { mean: 0, sd: 0, n: 0, values: [] },
      residualSpeed: { mean: 0, sd: 0, n: 0, values: [] },
      leftRightSymmetry: {
        left: { mean: 0, sd: 0, n: 0, values: [] },
        right: { mean: 0, sd: 0, n: 0, values: [] },
        diff: 0,
      },
    });

    expect(empty.cards.find((card) => card.id === 'counterReactionMs')?.value).toBe('N/A');
    expect(empty.cards.find((card) => card.id === 'residualSpeed')?.value).toBe('N/A');
    expect(empty.cards.find((card) => card.id === 'leftRightSymmetry')?.value).toBe('N/A');
  });
});

describe('classifyResidualSpeed', () => {
  it('classifies phase-A stop state without exposing continuous u/s as the headline', () => {
    expect(classifyResidualSpeed(metrics.residualSpeed)).toMatchObject({
      label: 'Moving / reverse seen',
      stopped: 3,
      moving: 1,
    });
  });
});
