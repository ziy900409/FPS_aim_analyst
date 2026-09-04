/**
 * WP-54 / T7 — Gate B's cell-level criteria (gate §2.2 thresholds, §2.3 decision rules, §2.5
 * aggregation definitions; all frozen before any T7 human data).
 *
 * These fixtures are literal per-run records rather than synthesized exports: the point is to pin
 * the *criteria and their decision order*, not the derivations that feed them (those are pinned by
 * `tracking-frozen-crosshair-ratio.test.ts` and `tracking-time-on-task-slope.test.ts`). Each test
 * names the gate clause it guards, because after data collection these numbers may not be edited
 * — a failure here means either a real regression or a change that requires a new protocol
 * version (README §5).
 */
import { describe, expect, it } from 'vitest';
import {
  GATE_B2A_MIN_BETWEEN_PARTICIPANT_CV,
  GATE_B4_MIN_ELIGIBLE_RUNS,
  aggregateTrackingGateB,
  type TrackingGateBRun,
} from '../../scripts/trackingGateBAggregates.ts';

function makeRun(overrides: Partial<TrackingGateBRun> = {}): TrackingGateBRun {
  return {
    condition: 'cell_a',
    participantId: 'P01',
    seedFamily: 'A',
    cellFamily: 'core',
    eligible: true,
    acquisitionFailure: false,
    rmsEpsilonDeg: 1,
    totPercent: 40,
    frozenCrosshairRatio: 3,
    timeOnTaskDeltaFraction: 0,
    targetAngularSizeDeg: 2,
    nominalSpeedDegPerSec: 5,
    ...overrides,
  };
}

/**
 * `n` runs from `n` distinct participants. RMS ε fans out around `rmsEpsilonDeg` so the
 * between-participant CV clears B-2a's 15% floor by default — a cell that is *meant* to look like
 * a ceiling opts out by passing a constant RMS.
 */
function makeCell(
  condition: string,
  overrides: Partial<TrackingGateBRun> = {},
  n = GATE_B4_MIN_ELIGIBLE_RUNS,
): TrackingGateBRun[] {
  const base = overrides.rmsEpsilonDeg ?? 1;
  return Array.from({ length: n }, (_unused, i) =>
    makeRun({
      condition,
      participantId: `P${String(i + 1).padStart(2, '0')}`,
      ...overrides,
      // Always last: the fan-out is what gives the cell its between-participant spread, so an
      // `rmsEpsilonDeg` override sets the level, never flattens the spread.
      rmsEpsilonDeg: base * (0.7 + (0.6 * i) / Math.max(1, n - 1)),
    }),
  );
}

function cellNamed(report: ReturnType<typeof aggregateTrackingGateB>, condition: string) {
  const cell = report.cells.find((candidate) => candidate.condition === condition);
  if (cell === undefined) throw new Error(`no cell ${condition} in report`);
  return cell;
}

describe('aggregateTrackingGateB — §2.3 decision rules', () => {
  it('retains a cell that clears every criterion', () => {
    const report = aggregateTrackingGateB(makeCell('cell_a'));
    const cell = cellNamed(report, 'cell_a');

    expect(cell.verdict).toBe('retained');
    expect(cell.eligibleRunCount).toBe(GATE_B4_MIN_ELIGIBLE_RUNS);
    expect(cell.participantCount).toBe(GATE_B4_MIN_ELIGIBLE_RUNS);
    expect(cell.medianFrozenCrosshairRatio).toBeCloseTo(3, 9);
    expect(cell.reasons).toEqual([]);
    // Pinned so a later fixture change cannot make these tests pass by accident: the default cell
    // clears B-2a's CV floor with room to spare, rather than sitting on it.
    expect(cell.betweenParticipantCv).toBeGreaterThan(GATE_B2A_MIN_BETWEEN_PARTICIPANT_CV);
    expect(cell.betweenParticipantCv).toBeCloseTo(0.20184335693983274, 9);
  });

  it('rule 1 — fewer than 10 eligible runs is not judged, however good the numbers look', () => {
    const report = aggregateTrackingGateB(makeCell('cell_a', {}, GATE_B4_MIN_ELIGIBLE_RUNS - 1));
    const cell = cellNamed(report, 'cell_a');

    // The red line: 9 excellent runs must not be reported as retained (README §5/§6).
    expect(cell.verdict).toBe('insufficient-data');
    expect(cell.b1Pass).toBe(true);
    expect(cell.reasons[0]).toContain('B-4');
  });

  it('rule 2 — B-1 alone failing removes the cell from the capability set (C-D3)', () => {
    const report = aggregateTrackingGateB(makeCell('cell_a', { frozenCrosshairRatio: 1.4 }));
    const cell = cellNamed(report, 'cell_a');

    expect(cell.verdict).toBe('remove');
    expect(cell.b1Pass).toBe(false);
    expect(cell.reasons[0]).toContain('B-1');
  });

  it('rule 2 does not apply when something else also failed — that is a revise, not a remove', () => {
    // A cell that cannot discriminate AND sits at the ceiling: §2.3 rule 2 requires every other
    // criterion to pass, so rule 3 takes it.
    const report = aggregateTrackingGateB(
      makeCell('cell_a', { frozenCrosshairRatio: 1.4, totPercent: 92 }),
    );
    const cell = cellNamed(report, 'cell_a');

    expect(cell.verdict).toBe('revise');
    expect(cell.reasons.some((reason) => reason.includes('rule 2 needs every other criterion'))).toBe(true);
  });

  it('rule 3 — B-2a ceiling: too high a median TOT, or too little spread between participants', () => {
    const tooEasy = cellNamed(aggregateTrackingGateB(makeCell('cell_a', { totPercent: 85 })), 'cell_a');
    expect(tooEasy.verdict).toBe('revise');
    expect(tooEasy.b2aPass).toBe(false);

    // Everyone scores the same: the cell cannot rank participants even though TOT looks sane.
    const noSpread = cellNamed(
      aggregateTrackingGateB(
        Array.from({ length: GATE_B4_MIN_ELIGIBLE_RUNS }, (_unused, i) =>
          makeRun({ condition: 'cell_a', participantId: `P${i}`, rmsEpsilonDeg: 1 }),
        ),
      ),
      'cell_a',
    );
    expect(noSpread.betweenParticipantCv).toBeCloseTo(0, 12);
    expect(noSpread.b2aPass).toBe(false);
    expect(noSpread.verdict).toBe('revise');
  });

  it('rule 3 — B-2b floor: too many acquisition failures, or too low a median TOT', () => {
    const tooHard = cellNamed(aggregateTrackingGateB(makeCell('cell_a', { totPercent: 3 })), 'cell_a');
    expect(tooHard.verdict).toBe('revise');
    expect(tooHard.b2bPass).toBe(false);

    // 3 of 10 never acquired the target at all.
    const runs = makeCell('cell_a');
    const withFailures = runs.map((run, i) =>
      i < 3 ? { ...run, acquisitionFailure: true, totPercent: undefined, rmsEpsilonDeg: undefined } : run,
    );
    const floored = cellNamed(aggregateTrackingGateB(withFailures), 'cell_a');
    expect(floored.acquisitionFailureRate).toBeCloseTo(0.3, 9);
    expect(floored.b2bPass).toBe(false);
    expect(floored.verdict).toBe('revise');
    // The failures are counted by B-2b, not folded into B-2a's median as zeroes.
    expect(floored.medianTotPercent).toBeCloseTo(40, 9);
  });

  it('rule 5 — B-3c is recorded but never decides a cell', () => {
    const report = aggregateTrackingGateB(makeCell('cell_a', { timeOnTaskDeltaFraction: 0.3 }));
    const cell = cellNamed(report, 'cell_a');

    expect(cell.b3cPass).toBe(false);
    expect(cell.verdict).toBe('retained');
    expect(cell.reasons.some((reason) => reason.includes('protocol-level'))).toBe(true);
  });
});

describe('aggregateTrackingGateB — §2.5 aggregation definitions', () => {
  it('A-1 — seed family B never reaches B-1/B-2/B-4, only B-3b (not computed here)', () => {
    const familyA = makeCell('cell_a', {}, 6);
    const familyB = makeCell('cell_a', { seedFamily: 'B', totPercent: 95, frozenCrosshairRatio: 1 }, 6).map(
      (run, i) => ({ ...run, participantId: `Q${i}` }),
    );

    const report = aggregateTrackingGateB([...familyA, ...familyB]);
    const cell = cellNamed(report, 'cell_a');

    // Pooling would have reached B-4's 10 and dragged the ratio and TOT with it.
    expect(cell.eligibleRunCount).toBe(6);
    expect(cell.verdict).toBe('insufficient-data');
    expect(cell.medianFrozenCrosshairRatio).toBeCloseTo(3, 9);
    expect(report.excluded.seedFamilyB).toBe(6);
  });

  it('A-2 — a participant with several runs contributes one median, not one vote per run', () => {
    // Nine participants at 1.0 plus one who ran the cell three times at 4/5/6: their median (5)
    // is one observation. Counting all three would understate the between-participant CV.
    const singles = Array.from({ length: 9 }, (_unused, i) =>
      makeRun({ condition: 'cell_a', participantId: `P${i}`, rmsEpsilonDeg: 1 }),
    );
    const repeated = [4, 5, 6].map((rms) =>
      makeRun({ condition: 'cell_a', participantId: 'PX', rmsEpsilonDeg: rms }),
    );

    const cell = cellNamed(aggregateTrackingGateB([...singles, ...repeated]), 'cell_a');

    expect(cell.eligibleRunCount).toBe(12);
    expect(cell.participantCount).toBe(10);
    // Ten values: nine 1.0s and a single 5.0. mean 1.4, sample SD sqrt(16*9/10/9)=1.2649.
    expect(cell.betweenParticipantCv).toBeCloseTo(1.2649110640673518 / 1.4, 9);
  });

  it('excludes practice and blocked runs, and says how many of each', () => {
    const report = aggregateTrackingGateB([
      ...makeCell('cell_a'),
      makeRun({ condition: 'practice', cellFamily: 'practice' }),
      makeRun({ condition: 'cell_a', participantId: 'PZ', eligible: false, frozenCrosshairRatio: 0.1 }),
    ]);

    expect(report.excluded.practice).toBe(1);
    expect(report.excluded.ineligible).toBe(1);
    expect(report.cells.map((cell) => cell.condition)).toEqual(['cell_a']);
    // FR-54-10: the blocked run's ratio never touched the median.
    expect(cellNamed(report, 'cell_a').medianFrozenCrosshairRatio).toBeCloseTo(3, 9);
  });
});

describe('aggregateTrackingGateB — B-3a size × speed direction', () => {
  /** A complete core 2×2: 2 deg and 3 deg targets at 5 and 14 deg/s. */
  function core2x2(spec: {
    readonly tot: (size: number, speed: number) => number;
    readonly rms: (size: number, speed: number) => number;
  }): TrackingGateBRun[] {
    const runs: TrackingGateBRun[] = [];
    for (const size of [2, 3]) {
      for (const speed of [5, 14]) {
        runs.push(
          ...makeCell(`core_${size}deg_${speed}dps`, {
            targetAngularSizeDeg: size,
            nominalSpeedDegPerSec: speed,
            totPercent: spec.tot(size, speed),
            rmsEpsilonDeg: spec.rms(size, speed),
          }),
        );
      }
    }
    return runs;
  }

  it('passes when smaller targets lower TOT and faster targets raise RMS ε', () => {
    const report = aggregateTrackingGateB(
      core2x2({ tot: (size) => (size === 2 ? 30 : 60), rms: (_size, speed) => (speed === 5 ? 1 : 2) }),
    );

    expect(report.direction.status).toBe('ok');
    expect(report.direction.sizeEffectHolds).toBe(true);
    expect(report.direction.speedEffectHolds).toBe(true);
    expect(report.direction.pass).toBe(true);
    expect(report.direction.comparisons).toHaveLength(4);
    expect(report.cells.every((cell) => cell.verdict === 'retained')).toBe(true);
  });

  it('rule 4 — a reversed manipulation makes every core cell a revise', () => {
    // Bigger targets score *worse* on TOT: the manipulation did not act as designed.
    const report = aggregateTrackingGateB(
      core2x2({ tot: (size) => (size === 2 ? 60 : 30), rms: (_size, speed) => (speed === 5 ? 1 : 2) }),
    );

    expect(report.direction.sizeEffectHolds).toBe(false);
    expect(report.direction.pass).toBe(false);
    expect(report.direction.comparisons.some((line) => line.includes('REVERSED'))).toBe(true);
    expect(report.cells.every((cell) => cell.verdict === 'revise')).toBe(true);
    expect(cellNamed(report, 'core_2deg_5dps').reasons.some((reason) => reason.includes('B-3a'))).toBe(true);
  });

  it('reports the speed effect separately from the size effect', () => {
    // Size behaves; speed does not.
    const report = aggregateTrackingGateB(
      core2x2({ tot: (size) => (size === 2 ? 30 : 60), rms: (_size, speed) => (speed === 5 ? 2 : 1) }),
    );

    expect(report.direction.sizeEffectHolds).toBe(true);
    expect(report.direction.speedEffectHolds).toBe(false);
    expect(report.direction.pass).toBe(false);
  });

  it('does not fail cells for B-3a when the core cells are not a 2×2', () => {
    // Only two of the four core cells were run: B-3a cannot be judged, and §2.3 rule 4 must not
    // punish cells for a comparison that was never possible.
    const partial = [
      ...makeCell('core_2deg_5dps', { targetAngularSizeDeg: 2, nominalSpeedDegPerSec: 5 }),
      ...makeCell('core_3deg_5dps', { targetAngularSizeDeg: 3, nominalSpeedDegPerSec: 5 }),
    ];
    const report = aggregateTrackingGateB(partial);

    expect(report.direction.status).toBe('not-a-2x2');
    expect(report.cells.every((cell) => cell.b3aPass)).toBe(true);
    expect(report.cells.every((cell) => cell.verdict === 'retained')).toBe(true);
  });

  it('keeps a cross-generation cell off the 2×2 axes rather than mixing it in', () => {
    // The drillId reuse trap: `2deg_*` was the LARGE size layer before G5. A cell whose runs
    // disagree about the delivered size has no place on either axis.
    const mixed = makeCell('core_2deg_5dps', { nominalSpeedDegPerSec: 5 }).map((run, i) => ({
      ...run,
      targetAngularSizeDeg: i < 5 ? 2 : 3,
    }));
    const report = aggregateTrackingGateB([
      ...mixed,
      ...makeCell('core_3deg_5dps', { targetAngularSizeDeg: 3, nominalSpeedDegPerSec: 5 }),
      ...makeCell('core_2deg_14dps', { targetAngularSizeDeg: 2, nominalSpeedDegPerSec: 14 }),
      ...makeCell('core_3deg_14dps', { targetAngularSizeDeg: 3, nominalSpeedDegPerSec: 14 }),
    ]);

    expect(report.direction.status).toBe('not-a-2x2');
  });
});
