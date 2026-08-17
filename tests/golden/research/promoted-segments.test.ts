import { readFileSync } from 'node:fs';
import type { DrillEvent } from '../../../src/data/DataRecorder';
import type { ExportPayload } from '../../../src/data/export';
import type { TickRecord } from '../../../src/data/RingBuffer';
import { omegaDegPerSec } from '../../../src/metrics/angularKinematics';
import { findPeakIndices, segmentSubmovements, type Segment } from '../../../src/metrics/submovement';
import { describe, expect, it } from 'vitest';

interface SegmentGolden {
  version: string;
  segmentVersion: string;
  source: string;
  indexFrame: 'tick';
  peekCount: number;
  primaryCount: number;
  peeks: GoldenPeek[];
}

interface SyntheticGolden {
  version: string;
  segmentVersion: string;
  source: string;
  indexFrame: 'signal';
  peakCases: Array<{ name: string; values: Array<number | null>; peaks: number[] }>;
  segmentCases: Array<{
    name: string;
    omega: Array<number | null>;
    segments: GoldenSegment[];
    traceFlags: string[];
  }>;
}

interface GoldenPeek {
  peekIndex: number;
  targetId: string;
  side: 'L' | 'R';
  tickRange: { start: number; end: number };
  tickCount: number;
  indexFrame: 'tick';
  segments: GoldenSegment[];
  traceFlags: string[];
}

interface GoldenSegment {
  kind: Segment['kind'];
  startIdx: number;
  endIdx: number;
  peakOmega: number;
  flags: string[];
  peekIndex?: number;
}

type VisibleEvent = Extract<DrillEvent, { type: 'visible' }>;

const REAL_FIXTURES = [
  'counterstrafe_ad_v1-2026-08-07T09_18_05.631Z.json',
  'counterstrafe_ad_v1-2026-08-07T09_24_18.148Z.json',
  'counterstrafe_ad_v1-2026-08-07T09_37_24.351Z.json',
] as const;

describe('WP-32 T2 Python/TypeScript promoted seg-v2 parity', () => {
  for (const fixture of REAL_FIXTURES) {
    it(`${fixture} segment indices, flags, and peak omega match Python golden`, () => {
      const payload = loadJson<ExportPayload>(`../../../research/fixtures/exports/${fixture}`);
      const golden = loadSegments(fixture);
      const actual = segmentPeeks(payload);

      expect(golden.version).toBe('segments-v1');
      expect(golden.segmentVersion).toBe('seg-v2');
      expect(golden.source).toBe(fixture);
      expect(golden.indexFrame).toBe('tick');
      expect(actual).toHaveLength(golden.peekCount);
      expect(actual).toHaveLength(golden.peeks.length);
      expect(countPrimary(actual)).toBe(golden.primaryCount);

      actual.forEach((peek, index) => expectPeekParity(peek, golden.peeks[index]));
    });
  }

  it('has the pre-registered pooled real primary count of 59', () => {
    const pooledPrimary = REAL_FIXTURES.reduce((total, fixture) => total + loadSegments(fixture).primaryCount, 0);

    expect(pooledPrimary).toBe(59);
  });

  it('matches scipy find_peaks plateau cases and synthetic segment cases', () => {
    const golden = loadJson<SyntheticGolden>(
      '../../../research/fixtures/golden/segments-synthetic_submovement_cases.json',
    );

    expect(golden.version).toBe('segments-v1');
    expect(golden.segmentVersion).toBe('seg-v2');
    expect(golden.indexFrame).toBe('signal');
    for (const peakCase of golden.peakCases) {
      expect(findPeakIndices(toNumbers(peakCase.values))).toEqual(peakCase.peaks);
    }
    for (const segmentCase of golden.segmentCases) {
      const actual = segmentSubmovements(toNumbers(segmentCase.omega));
      expect(actual.traceFlags).toEqual(segmentCase.traceFlags);
      expectSegmentsParity(actual.segments, segmentCase.segments);
    }
  });
});

function segmentPeeks(payload: ExportPayload): GoldenPeek[] {
  const ticks = payload.ticks.slice().sort((a, b) => a.t - b.t);
  const visibleEvents = payload.events
    .filter((event): event is VisibleEvent => event.type === 'visible')
    .sort((a, b) => a.t - b.t);

  return visibleEvents.map((visible, index) => {
    const nextVisible = visibleEvents[index + 1];
    const endMs = nextVisible?.t ?? Infinity;
    const start = firstTickAtOrAfter(ticks, visible.t - 1e-9);
    const end = firstTickAtOrAfter(ticks, endMs - 1e-9);
    const windowTicks = ticks.slice(start, end);
    const omega = omegaDegPerSec(windowTicks).values;
    const result = omega.length > 1 ? segmentSubmovements(omega.slice(1)) : { segments: [], traceFlags: [] };
    return {
      peekIndex: index,
      targetId: visible.targetId,
      side: visible.side,
      tickRange: { start, end },
      tickCount: windowTicks.length,
      indexFrame: 'tick',
      segments: result.segments.map((segment) => ({
        kind: segment.kind,
        startIdx: segment.startIdx + 1,
        endIdx: segment.endIdx + 1,
        peakOmega: segment.peakOmega,
        flags: [...segment.flags],
        peekIndex: index,
      })),
      traceFlags: [...result.traceFlags],
    };
  });
}

function firstTickAtOrAfter(ticks: readonly TickRecord[], tMs: number): number {
  let low = 0;
  let high = ticks.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (ticks[mid].t < tMs) low = mid + 1;
    else high = mid;
  }
  return low;
}

function expectPeekParity(actual: GoldenPeek, expected: GoldenPeek): void {
  expect(actual.peekIndex).toBe(expected.peekIndex);
  expect(actual.targetId).toBe(expected.targetId);
  expect(actual.side).toBe(expected.side);
  expect(actual.tickRange).toEqual(expected.tickRange);
  expect(actual.tickCount).toBe(expected.tickCount);
  expect(actual.indexFrame).toBe(expected.indexFrame);
  expect(actual.traceFlags).toEqual(expected.traceFlags);
  expectSegmentsParity(actual.segments, expected.segments);
}

function expectSegmentsParity(actual: readonly GoldenSegment[], expected: readonly GoldenSegment[]): void {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((segment, index) => {
    const golden = expected[index];
    expect(segment.kind).toBe(golden.kind);
    expect(segment.startIdx).toBe(golden.startIdx);
    expect(segment.endIdx).toBe(golden.endIdx);
    expect(segment.flags).toEqual(golden.flags);
    expectRelativeParity(segment.peakOmega, golden.peakOmega);
    if (golden.peekIndex !== undefined) expect(segment.peekIndex).toBe(golden.peekIndex);
  });
}

function countPrimary(peeks: readonly GoldenPeek[]): number {
  return peeks.reduce(
    (total, peek) => total + peek.segments.filter((segment) => segment.kind === 'primary_flick').length,
    0,
  );
}

function loadSegments(fixture: string): SegmentGolden {
  const stem = fixture.replace(/\.json$/, '');
  return loadJson<SegmentGolden>(`../../../research/fixtures/golden/segments-${stem}.json`);
}

function loadJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as T;
}

function toNumbers(values: readonly (number | null)[]): number[] {
  return values.map((value) => (value === null ? Number.NaN : value));
}

function expectRelativeParity(actual: number, expected: number): void {
  const absoluteError = Math.abs(actual - expected);
  if (expected === 0) {
    expect(absoluteError).toBeLessThanOrEqual(1e-12);
  } else {
    expect(absoluteError / Math.abs(expected)).toBeLessThanOrEqual(1e-9);
  }
}
