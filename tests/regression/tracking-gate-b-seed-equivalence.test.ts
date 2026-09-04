/**
 * WP-54 / T7 — B-3b, seed-family equivalence (gate §2.2, §2.5 A-3).
 *
 * The clause that matters most here is not arithmetic but reporting discipline: with 6–8 pairs the
 * test is underpowered, so "we could not show equivalence" must never be reported as "the families
 * differ". Those two are separate `conclusion` values and the tests below pin the boundary between
 * them, alongside the paired-median clause and the 90% CI that A-3 defines.
 */
import { describe, expect, it } from 'vitest';
import {
  GATE_B3B_EQUIVALENCE_BOUND,
  evaluateTrackingSeedEquivalence,
} from '../../scripts/trackingGateBSeedEquivalence.ts';
import type { TrackingGateBRun } from '../../scripts/trackingGateBAggregates.ts';

function makeRun(overrides: Partial<TrackingGateBRun> & { participantId: string }): TrackingGateBRun {
  return {
    condition: 'cell_a',
    seedFamily: 'A',
    cellFamily: 'core',
    eligible: true,
    acquisitionFailure: false,
    rmsEpsilonDeg: 1,
    ...overrides,
  };
}

/** `n` participants, each with one family-A run at 1.0 deg and one family-B run at `1 + shift(i)`. */
function pairs(shift: (i: number) => number, n = 8, condition = 'cell_a'): TrackingGateBRun[] {
  return Array.from({ length: n }, (_unused, i) => [
    makeRun({ condition, participantId: `P${i}`, seedFamily: 'A', rmsEpsilonDeg: 1 }),
    makeRun({ condition, participantId: `P${i}`, seedFamily: 'B', rmsEpsilonDeg: 1 + shift(i) }),
  ]).flat();
}

function only(report: ReturnType<typeof evaluateTrackingSeedEquivalence>) {
  expect(report.cells).toHaveLength(1);
  return report.cells[0];
}

describe('evaluateTrackingSeedEquivalence — B-3b', () => {
  it('declares equivalence when the paired differences sit tightly inside ±15%', () => {
    // Differences of ±1%: mean ~0, interval far inside the bound.
    const report = evaluateTrackingSeedEquivalence(pairs((i) => (i % 2 === 0 ? 0.01 : -0.01)));
    const cell = only(report);

    expect(cell.pairedParticipantCount).toBe(8);
    expect(cell.familyAMedianRmsEpsilonDeg).toBeCloseTo(1, 9);
    expect(cell.conclusion).toBe('equivalent');
    expect(cell.tostPass).toBe(true);
    expect(cell.medianDiffPass).toBe(true);
    expect(cell.pass).toBe(true);
    expect(Math.abs(cell.ci90Upper)).toBeLessThan(GATE_B3B_EQUIVALENCE_BOUND);
    expect(report.pooledAcrossFamiliesPermitted).toBe(true);
  });

  it('reports "not shown" — never "different" — when the interval merely straddles a bound', () => {
    // A small mean shift with real scatter: the point estimate is well inside ±15%, but 8 pairs
    // cannot pin the interval inside it. This is the case §2.5 A-3 insists must not be inverted.
    const report = evaluateTrackingSeedEquivalence(pairs((i) => 0.02 + 0.3 * Math.sin(i)));
    const cell = only(report);

    expect(cell.conclusion).toBe('not-shown-equivalent');
    expect(cell.tostPass).toBe(false);
    expect(cell.pass).toBe(false);
    // The point estimate is inside the bound — calling this "not equivalent" would overstate it.
    expect(Math.abs(cell.meanRelativeDiff)).toBeLessThan(GATE_B3B_EQUIVALENCE_BOUND);
    expect(cell.notes.some((note) => note.includes('NOT evidence that the'))).toBe(true);
    expect(report.pooledAcrossFamiliesPermitted).toBe(false);
  });

  it('declares a real difference only when the whole interval clears the bound', () => {
    // Every participant is ~40% worse on family B: the families are not the same stimulus.
    const report = evaluateTrackingSeedEquivalence(pairs((i) => 0.4 + 0.01 * (i % 3)));
    const cell = only(report);

    expect(cell.conclusion).toBe('different');
    expect(cell.ci90Lower).toBeGreaterThan(GATE_B3B_EQUIVALENCE_BOUND);
    expect(cell.medianDiffPass).toBe(false);
    expect(cell.pass).toBe(false);
  });

  it('fails the median clause independently of the interval (§2.2 needs both)', () => {
    // A consistent 12% shift with almost no scatter: TOST passes, but the median clause (±10%)
    // does not — and §2.2 joins them with "and".
    const report = evaluateTrackingSeedEquivalence(pairs((i) => 0.12 + 0.001 * (i % 2)));
    const cell = only(report);

    expect(cell.tostPass).toBe(true);
    expect(cell.medianDiffPass).toBe(false);
    expect(cell.pass).toBe(false);
    expect(cell.notes.some((note) => note.includes('median paired difference'))).toBe(true);
  });

  it('uses each participant\'s median within a family, not one vote per run (§2.5 A-2)', () => {
    // P0 ran family B three times (1.0 / 1.5 / 2.0 → median 1.5); everyone else is flat. Counting
    // all three runs would triple P0's influence on the mean difference.
    const base = pairs(() => 0, 4);
    const extra = [
      makeRun({ participantId: 'P0', seedFamily: 'B', rmsEpsilonDeg: 1.5 }),
      makeRun({ participantId: 'P0', seedFamily: 'B', rmsEpsilonDeg: 2.0 }),
    ];
    const cell = only(evaluateTrackingSeedEquivalence([...base, ...extra]));

    expect(cell.pairedParticipantCount).toBe(4);
    // P0 contributes median(1.0, 1.5, 2.0) − 1.0 = +0.5; the other three contribute 0.
    expect(cell.meanRelativeDiff).toBeCloseTo(0.125, 9);
  });

  it('flags a short pairing rather than quietly judging on too few participants', () => {
    const cell = only(evaluateTrackingSeedEquivalence(pairs(() => 0.01, 3)));

    expect(cell.pairedParticipantCount).toBe(3);
    expect(cell.notes.some((note) => note.includes('the protocol plans'))).toBe(true);
  });

  it('does not judge at all with fewer than two pairs, or with no family B run', () => {
    const single = only(evaluateTrackingSeedEquivalence(pairs(() => 0.01, 1)));
    expect(single.conclusion).toBe('insufficient-pairs');
    expect(single.ci90Lower).toBeNaN();
    expect(single.pass).toBe(false);

    // Family A only: an absence, not a finding — the cell does not appear.
    const familyAOnly = evaluateTrackingSeedEquivalence([
      makeRun({ participantId: 'P0', seedFamily: 'A' }),
      makeRun({ participantId: 'P1', seedFamily: 'A' }),
    ]);
    expect(familyAOnly.cells).toEqual([]);
    expect(familyAOnly.pooledAcrossFamiliesPermitted).toBe(false);
  });

  it('excludes practice and blocked runs before pairing', () => {
    const report = evaluateTrackingSeedEquivalence([
      ...pairs(() => 0.01, 6),
      makeRun({ participantId: 'PP', condition: 'practice', cellFamily: 'practice', seedFamily: 'B' }),
      makeRun({ participantId: 'P0', seedFamily: 'B', rmsEpsilonDeg: 99, eligible: false }),
    ]);
    const cell = only(report);

    expect(cell.pairedParticipantCount).toBe(6);
    // The blocked 99 deg run never entered P0's family-B median.
    expect(cell.conclusion).toBe('equivalent');
  });

  it('permits pooling only when every judged cell is equivalent', () => {
    const report = evaluateTrackingSeedEquivalence([
      ...pairs(() => 0.01, 8, 'cell_a'),
      ...pairs((i) => 0.4 + 0.01 * (i % 3), 8, 'cell_b'),
    ]);

    expect(report.cells.map((cell) => cell.conclusion)).toEqual(['equivalent', 'different']);
    expect(report.pooledAcrossFamiliesPermitted).toBe(false);
  });
});
