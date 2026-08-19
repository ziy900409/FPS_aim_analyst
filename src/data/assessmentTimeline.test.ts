import { describe, expect, it } from 'vitest';
import type { AssessmentTimelinePoint, VisibleFractionSeries } from './assessmentTimeline.ts';

describe('assessment timeline contract', () => {
  it('accepts an empty point and optional frozen timeline fields', () => {
    const empty: AssessmentTimelinePoint = {};
    const full: AssessmentTimelinePoint = {
      tFirstVisible: 10,
      tMeasurementOnset: 18,
      tFullExposure: 24,
      tStop: 120,
    };

    expect(empty).toEqual({});
    expect(full).toEqual({
      tFirstVisible: 10,
      tMeasurementOnset: 18,
      tFullExposure: 24,
      tStop: 120,
    });
  });

  it('accepts a readonly visible fraction series', () => {
    const series: VisibleFractionSeries = [0, 0.5, 1] as const;

    expect(series).toEqual([0, 0.5, 1]);
  });
});
