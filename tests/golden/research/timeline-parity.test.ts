import { readFileSync } from 'node:fs';
import type { DataRecorderSnapshot, DrillEvent } from '../../../src/data/DataRecorder';
import type { ExportPayload } from '../../../src/data/export';
import { computeMetrics } from '../../../src/metrics/compute';
import { describe, expect, it } from 'vitest';

interface ExpectedStat {
  mean: number;
  p50: number;
  sd: number;
  n: number;
}

interface TimelineParity {
  version: string;
  computeVersion: string;
  source: string;
  metrics: {
    counterReactionMs: ExpectedStat;
    fireTimingAlignmentMs: ExpectedStat;
    firstShotHitRate: number;
  };
  peeks: Array<{
    index: number;
    targetId: string;
    tVisible: number;
    tEnd: number | null;
    outcome: 'hit' | 'timeout' | 'no_shot';
    flags: string[];
  }>;
}

const fixtures = [
  {
    role: 'synthetic',
    exportPath: '../../../research/fixtures/exports/synthetic_timeline.json',
    parityPath: '../../../research/fixtures/parity/timeline-synthetic_timeline.json',
    expected: { counterN: 3, alignmentN: 3, hitRate: 75, peeks: 4 },
    antiVacuous: true,
  },
  {
    role: 'real-zero-0803',
    exportPath: '../../../research/fixtures/exports/counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json',
    parityPath:
      '../../../research/fixtures/parity/timeline-counterstrafe_ad_v1-2026-08-05T08_03_45.617Z.json',
    expected: { counterN: 0, alignmentN: 0, hitRate: 90, peeks: 20 },
    antiVacuous: false,
  },
  {
    role: 'real-validity-0939',
    exportPath: '../../../research/fixtures/exports/counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json',
    parityPath:
      '../../../research/fixtures/parity/timeline-counterstrafe_ad_v1-2026-08-05T09_39_06.031Z.json',
    expected: { counterN: 20, alignmentN: 20, hitRate: 90, peeks: 20 },
    antiVacuous: true,
  },
] as const;

describe('WP-29 T1 Python/TypeScript timeline parity', () => {
  for (const fixture of fixtures) {
    it(`${fixture.role} matches computeMetrics within 1e-9 relative error`, () => {
      const payload = loadJson<ExportPayload>(fixture.exportPath);
      const parity = loadJson<TimelineParity>(fixture.parityPath);
      const snapshot: DataRecorderSnapshot = {
        ticks: payload.ticks,
        events: payload.events,
        recorderOverflow: payload.meta.recorderOverflow,
      };
      const actual = computeMetrics(snapshot);

      expect(parity.version).toBe('timeline-v1');
      expect(parity.computeVersion).toBe('compute-v1');
      expect(parity.source).toBe(fixture.exportPath.split('/').at(-1));
      expect(parity.peeks).toHaveLength(fixture.expected.peeks);
      expectStatParity(actual.counterReactionMs, parity.metrics.counterReactionMs);
      expectStatParity(actual.fireTimingAlignmentMs, parity.metrics.fireTimingAlignmentMs);
      expectRelativeParity(actual.firstShotHitRate, parity.metrics.firstShotHitRate);

      expect(parity.metrics.counterReactionMs.n).toBe(fixture.expected.counterN);
      expect(parity.metrics.fireTimingAlignmentMs.n).toBe(fixture.expected.alignmentN);
      expect(parity.metrics.firstShotHitRate).toBe(fixture.expected.hitRate);
      const visible = payload.events.filter((event) => event.type === 'visible').sort((a, b) => a.t - b.t);
      expect(visible).toHaveLength(parity.peeks.length);
      parity.peeks.forEach((peek, index) => {
        expect(peek.index).toBe(index);
        expect(peek.targetId).toBe(visible[index].targetId);
        expect(peek.tVisible).toBe(visible[index].t);
        expect(peek.tEnd).toBe(visible[index + 1]?.t ?? null);
      });

      if (fixture.antiVacuous) {
        expect(parity.metrics.counterReactionMs.n).toBeGreaterThanOrEqual(2);
        expect(parity.metrics.fireTimingAlignmentMs.n).toBeGreaterThanOrEqual(2);
        const outcomes = firstShotOutcomes(payload.events);
        expect(outcomes).toContain(true);
        expect(outcomes).toContain(false);
      }
    });
  }
});

function loadJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as T;
}

function expectStatParity(actual: ExpectedStat, expected: ExpectedStat): void {
  expect(actual.n).toBe(expected.n);
  expectRelativeParity(actual.mean, expected.mean);
  expectRelativeParity(actual.p50, expected.p50);
  expectRelativeParity(actual.sd, expected.sd);
}

function expectRelativeParity(actual: number, expected: number): void {
  const absoluteError = Math.abs(actual - expected);
  if (expected === 0) {
    expect(absoluteError).toBeLessThanOrEqual(1e-12);
  } else {
    expect(absoluteError / Math.abs(expected)).toBeLessThanOrEqual(1e-9);
  }
}

function firstShotOutcomes(events: DrillEvent[]): boolean[] {
  const sorted = events.slice().sort((a, b) => a.t - b.t);
  const visible = sorted.filter((event): event is Extract<DrillEvent, { type: 'visible' }> => event.type === 'visible');
  const fires = sorted.filter((event): event is Extract<DrillEvent, { type: 'fire' }> => event.type === 'fire');
  const hitShotSeqs = new Set(
    sorted
      .filter((event): event is Extract<DrillEvent, { type: 'hit' }> => event.type === 'hit')
      .map((event) => event.shotSeq),
  );
  return visible.flatMap((event, index) => {
    const end = visible[index + 1]?.t ?? Number.POSITIVE_INFINITY;
    const fire = fires.find(
      (candidate) =>
        candidate.firstShot &&
        candidate.t >= event.t &&
        candidate.t < end &&
        (candidate.targetId === undefined || candidate.targetId === event.targetId),
    );
    if (fire === undefined) return [];
    return [fire.hit || (fire.shotSeq !== undefined && hitShotSeqs.has(fire.shotSeq))];
  });
}
