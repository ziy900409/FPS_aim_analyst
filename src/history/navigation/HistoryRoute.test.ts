import { describe, expect, it } from 'vitest';
import { formatHistoryHash, historyRouteAncestors, isHistoryHash, parseHistoryHash, type HistoryRoute } from './HistoryRoute.ts';

describe('parseHistoryHash — outside the #/history namespace', () => {
  it.each(['#pattern', '', '#', '#/other', '#/historyx', '#/history-extra'])('returns undefined for %s', (hash) => {
    expect(parseHistoryHash(hash)).toBeUndefined();
    expect(isHistoryHash(hash)).toBe(false);
  });
});

describe('parseHistoryHash — four route kinds round-trip', () => {
  it('parses the bare root as participants with empty query', () => {
    expect(parseHistoryHash('#/history')).toEqual({ kind: 'participants', query: '' });
    expect(isHistoryHash('#/history')).toBe(true);
  });

  it('parses a participants search query', () => {
    expect(parseHistoryHash('#/history?q=alice')).toEqual({ kind: 'participants', query: 'alice' });
  });

  it('parses a drills route', () => {
    expect(parseHistoryHash('#/history/participants/p-1')).toEqual({ kind: 'drills', participantId: 'p-1' });
  });

  it('parses a drill route with no query', () => {
    expect(parseHistoryHash('#/history/participants/p-1/drills/spider-shot-v2')).toEqual({
      kind: 'drill',
      participantId: 'p-1',
      drillId: 'spider-shot-v2',
      metricId: undefined,
      cohortId: undefined,
      runFilter: 'all',
    });
  });

  it('parses a drill route with metric/cohort/runFilter query params', () => {
    expect(
      parseHistoryHash('#/history/participants/p-1/drills/spider-shot-v2?metricId=m1&cohortId=c1&runFilter=trend-eligible'),
    ).toEqual({
      kind: 'drill',
      participantId: 'p-1',
      drillId: 'spider-shot-v2',
      metricId: 'm1',
      cohortId: 'c1',
      runFilter: 'trend-eligible',
    });
  });

  it('falls back to runFilter "all" for an unknown runFilter value', () => {
    const route = parseHistoryHash('#/history/participants/p-1/drills/spider-shot-v2?runFilter=bogus');
    expect(route).toMatchObject({ kind: 'drill', runFilter: 'all' });
  });

  it('parses a run route', () => {
    expect(parseHistoryHash('#/history/participants/p-1/drills/spider-shot-v2/runs/r-1')).toEqual({
      kind: 'run',
      participantId: 'p-1',
      drillId: 'spider-shot-v2',
      runId: 'r-1',
    });
  });
});

describe('parseHistoryHash — Unicode, space, slash-in-id, hash-in-id, percent-encoded ids', () => {
  it('round-trips a participant id with Unicode, spaces, and reserved characters', () => {
    const route: HistoryRoute = { kind: 'drills', participantId: '受試者 A/B#1 100%' };
    const hash = formatHistoryHash(route);
    expect(parseHistoryHash(hash)).toEqual(route);
  });

  it('round-trips a drillId containing a literal slash once encoded', () => {
    const route: HistoryRoute = {
      kind: 'drill',
      participantId: 'p-1',
      drillId: 'family/variant',
      runFilter: 'all',
    };
    const hash = formatHistoryHash(route);
    expect(hash).not.toContain('family/variant');
    expect(parseHistoryHash(hash)).toEqual(route);
  });

  it('round-trips a runId with Unicode and percent signs', () => {
    const route: HistoryRoute = { kind: 'run', participantId: 'p-1', drillId: 'd-1', runId: '執行 100%✓' };
    expect(parseHistoryHash(formatHistoryHash(route))).toEqual(route);
  });
});

describe('parseHistoryHash — malformed encoding degrades to the deepest valid ancestor, never throws', () => {
  it('malformed percent-escape in participantId falls back to participants root', () => {
    expect(() => parseHistoryHash('#/history/participants/%zz')).not.toThrow();
    expect(parseHistoryHash('#/history/participants/%zz')).toEqual({ kind: 'participants', query: '' });
  });

  it('a lone percent sign in participantId falls back to participants root', () => {
    expect(() => parseHistoryHash('#/history/participants/%')).not.toThrow();
    expect(parseHistoryHash('#/history/participants/%')).toEqual({ kind: 'participants', query: '' });
  });

  it('truncated UTF-8 escape in drillId falls back to the drills route', () => {
    expect(() => parseHistoryHash('#/history/participants/p-1/drills/%e4%bd')).not.toThrow();
    expect(parseHistoryHash('#/history/participants/p-1/drills/%e4%bd')).toEqual({
      kind: 'drills',
      participantId: 'p-1',
    });
  });

  it('malformed runId falls back to the drill route', () => {
    expect(parseHistoryHash('#/history/participants/p-1/drills/d-1/runs/%zz')).toEqual({
      kind: 'drill',
      participantId: 'p-1',
      drillId: 'd-1',
      metricId: undefined,
      cohortId: undefined,
      runFilter: 'all',
    });
  });

  it('an unknown segment after participantId falls back to the drills route (does not assume "drills")', () => {
    expect(parseHistoryHash('#/history/participants/p-1/unknown-segment')).toEqual({ kind: 'drills', participantId: 'p-1' });
  });

  it('an unknown segment after drillId falls back to the drill route', () => {
    const result = parseHistoryHash('#/history/participants/p-1/drills/d-1/unknown-segment');
    expect(result).toMatchObject({ kind: 'drill', participantId: 'p-1', drillId: 'd-1' });
  });

  it('an empty-string participantId segment (double slash) falls back to participants root', () => {
    expect(parseHistoryHash('#/history//drills/d-1')).toEqual({ kind: 'participants', query: '' });
  });
});

describe('formatHistoryHash — canonical output', () => {
  it('omits the query string entirely when the participants query is empty', () => {
    expect(formatHistoryHash({ kind: 'participants', query: '' })).toBe('#/history');
  });

  it('omits metricId/cohortId/runFilter when they are absent/default', () => {
    expect(
      formatHistoryHash({ kind: 'drill', participantId: 'p-1', drillId: 'd-1', runFilter: 'all' }),
    ).toBe('#/history/participants/p-1/drills/d-1');
  });

  it('is idempotent: formatting an already-canonical hash round-trips byte for byte', () => {
    const route: HistoryRoute = {
      kind: 'drill',
      participantId: 'p-1',
      drillId: 'd-1',
      metricId: 'm1',
      runFilter: 'excluded',
    };
    const hash = formatHistoryHash(route);
    expect(formatHistoryHash(parseHistoryHash(hash)!)).toBe(hash);
  });
});

describe('historyRouteAncestors', () => {
  it('returns just the root for a participants route', () => {
    expect(historyRouteAncestors({ kind: 'participants', query: 'x' })).toEqual([{ kind: 'participants', query: 'x' }]);
  });

  it('returns root -> drills for a drills route', () => {
    expect(historyRouteAncestors({ kind: 'drills', participantId: 'p-1' })).toEqual([
      { kind: 'participants', query: '' },
      { kind: 'drills', participantId: 'p-1' },
    ]);
  });

  it('returns root -> drills -> drill for a drill route', () => {
    const route: HistoryRoute = { kind: 'drill', participantId: 'p-1', drillId: 'd-1', runFilter: 'all' };
    expect(historyRouteAncestors(route)).toEqual([
      { kind: 'participants', query: '' },
      { kind: 'drills', participantId: 'p-1' },
      route,
    ]);
  });

  it('returns root -> drills -> drill -> run for a run route', () => {
    const route: HistoryRoute = { kind: 'run', participantId: 'p-1', drillId: 'd-1', runId: 'r-1' };
    expect(historyRouteAncestors(route)).toEqual([
      { kind: 'participants', query: '' },
      { kind: 'drills', participantId: 'p-1' },
      { kind: 'drill', participantId: 'p-1', drillId: 'd-1', runFilter: 'all' },
      route,
    ]);
  });
});
