import { describe, expect, it } from 'vitest';
import { SEG_V2_PARAMS, findPeakIndices, isKnownSegmentFlag, segmentSubmovements } from './submovement.ts';

describe('findPeakIndices', () => {
  it('matches scipy plateau midpoint rules and ignores endpoint plateaus', () => {
    expect(findPeakIndices([0, 3, 0])).toEqual([1]);
    expect(findPeakIndices([0, 3, 3, 0])).toEqual([1]);
    expect(findPeakIndices([0, 3, 3, 3, 0])).toEqual([2]);
    expect(findPeakIndices([3, 3, 0, 2, 0, 4, 4])).toEqual([3]);
    expect(findPeakIndices([0, 5, 0, 4, 0])).toEqual([1, 3]);
  });
});

describe('segmentSubmovements', () => {
  it('returns trace flags for empty and all-non-finite signals', () => {
    expect(segmentSubmovements([])).toEqual({ segments: [], traceFlags: ['empty_signal'] });
    expect(segmentSubmovements([Number.NaN, Number.POSITIVE_INFINITY])).toEqual({
      segments: [],
      traceFlags: ['non_finite_replaced', 'zero_motion', 'below_floor'],
    });
  });

  it('interpolates partial non-finite values before segmenting', () => {
    const actual = segmentSubmovements([0, Number.NaN, 300, 0]);

    expect(actual.traceFlags).toEqual(['non_finite_interpolated', 'sg_fallback_short_signal']);
    expect(actual.segments).toHaveLength(1);
    expect(actual.segments[0].flags).toEqual(['non_finite_interpolated', 'sg_fallback_short_signal']);
    expect(actual.segments[0]).toMatchObject({ kind: 'primary_flick', startIdx: 0, endIdx: 3, peakOmega: 300 });
  });

  it('distinguishes zero motion, below-floor peaks, and no-peak plateaus', () => {
    expect(segmentSubmovements([0, 0, 0]).traceFlags).toEqual([
      'zero_motion',
      'below_floor',
    ]);
    expect(segmentSubmovements([0, 10, 0]).traceFlags).toEqual([
      'sg_fallback_short_signal',
      'below_floor',
    ]);
    expect(segmentSubmovements(Array.from({ length: 32 }, () => 240)).traceFlags).toEqual(['no_peak']);
  });

  it('uses the short-signal SG fallback and carries trace flags onto segments', () => {
    const actual = segmentSubmovements([0, 300, 0]);

    expect(actual.traceFlags).toEqual(['sg_fallback_short_signal']);
    expect(actual.segments).toEqual([
      {
        kind: 'primary_flick',
        startIdx: 0,
        endIdx: 2,
        peakOmega: 300,
        flags: ['sg_fallback_short_signal'],
      },
    ]);
  });

  it('flags windows truncated at the signal edge', () => {
    const actual = segmentSubmovements([300, 500, 700, 500, 300, 200, 180]);

    expect(actual.segments).toHaveLength(1);
    expect(actual.segments[0].flags).toContain('truncated_at_window_edge');
  });

  it('merges overlapping adjacent peak candidates without promoting the larger later peak to primary order', () => {
    const signal = [0, 100, 300, 100, 250, 0];

    const actual = segmentSubmovements(signal);

    expect(actual.segments).toHaveLength(1);
    expect(actual.segments[0].kind).toBe('primary_flick');
    expect(actual.segments[0].flags).toContain('merged_adjacent_peaks');
  });

  it('keeps the seg-v2 params frozen and rejects unsupported contracts', () => {
    expect(SEG_V2_PARAMS).toEqual({
      sgWindow: 11,
      sgPoly: 3,
      peakSigmaK: 0.75,
      peakFloorDegPerSec: 60,
      lowRatio: 0.1,
      stopRatio: 0.2,
      version: 'seg-v2',
    });
    expect(() => segmentSubmovements([0, 300, 0], { ...SEG_V2_PARAMS, sgWindow: 7 })).toThrow(/SG_SEG_V2/);
    expect(() => segmentSubmovements([0, 300, 0], { ...SEG_V2_PARAMS, lowRatio: 0.3 })).toThrow(
      /less than or equal/,
    );
  });

  it('exposes the closed Python seg-v2 flag vocabulary', () => {
    for (const flag of [
      'below_floor',
      'empty_signal',
      'merged_adjacent_peaks',
      'no_peak',
      'non_finite_interpolated',
      'non_finite_replaced',
      'sg_fallback_short_signal',
      'truncated_at_window_edge',
      'zero_motion',
    ]) {
      expect(isKnownSegmentFlag(flag)).toBe(true);
    }
    expect(isKnownSegmentFlag('filter_degenerate')).toBe(false);
  });
});
