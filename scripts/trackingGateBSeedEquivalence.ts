/**
 * WP-54 / T7 — B-3b: are the two seed families interchangeable? (gate §2.2, §2.5 A-3.)
 *
 * Everyone runs seed family A; 6–8 of them also run family B. B-3b asks whether the same
 * participant, in the same cell, performs the same against the alternate seeds. If not, the two
 * families are different stimuli wearing one condition label and must never be pooled (§2.3 rule
 * 5). This is the only criterion that reads family B at all (§2.5 A-1).
 *
 * **Frozen operationalization:**
 *   - §2.2 — |median paired difference| ≤ 10% of the cell's family-A median RMS ε, **and** TOST
 *     equivalence within ±15%.
 *   - §2.5 A-3 — TOST is **paired, two one-sided, α = 0.05**, which is exactly "the 90% CI of the
 *     mean paired difference lies inside ±15%". The CI form is what this module computes, because
 *     it is the form the gate table reports and needs only one critical value rather than a t CDF.
 *   - §2.5 A-2 — a participant with several runs in a cell contributes the **median** of their RMS
 *     ε within each family, so one busy participant cannot outvote the others.
 *
 * **The honesty requirement (gate §6).** With n = 6–8 this test is underpowered: failing to show
 * equivalence is the expected outcome even when the families are in fact interchangeable. So the
 * result is three-way — `equivalent`, `not-shown-equivalent`, `different` — and never collapses
 * the middle case into either end. Reporting "not equivalent" for an inconclusive result would
 * overstate the evidence; reporting "equivalent" for one would be the inversion §2.5 A-3 forbids.
 */
import type { TrackingGateBRun } from './trackingGateBAggregates.ts';

/** §2.2 B-3b — |median paired difference|, relative to the family-A median RMS ε. */
export const GATE_B3B_MAX_ABS_MEDIAN_RELATIVE_DIFF = 0.1;
/** §2.2 B-3b — TOST equivalence bounds, relative to the family-A median RMS ε. */
export const GATE_B3B_EQUIVALENCE_BOUND = 0.15;
/** §2.5 A-3 — one-sided α for each of the two tests; the reported interval is 1 − 2α = 90%. */
export const GATE_B3B_ALPHA = 0.05;
/** §2.2/§4 — the protocol asks 6–8 participants to run both families. Fewer is computable but is
 * flagged, because the interval widens fast below it. */
export const GATE_B3B_MIN_PLANNED_PAIRS = 6;

export type TrackingSeedEquivalenceConclusion =
  /** The 90% CI lies inside ±15%: the families are interchangeable for this cell. */
  | 'equivalent'
  /** The CI straddles a bound — underpowered or genuinely borderline. **Not** evidence of a
   * difference, and **not** evidence of equivalence. */
  | 'not-shown-equivalent'
  /** The CI lies wholly beyond a bound: the families really do differ by more than ±15%. */
  | 'different'
  /** Fewer than two paired participants — no interval exists. */
  | 'insufficient-pairs';

export interface TrackingSeedEquivalenceCell {
  readonly condition: string;
  readonly pairedParticipantCount: number;
  /** Denominator for every relative figure below: the cell's family-A median RMS ε. */
  readonly familyAMedianRmsEpsilonDeg: number;
  /** §2.2's first clause: median of (B − A)/familyA-median across paired participants. */
  readonly medianRelativeDiff: number;
  readonly medianDiffPass: boolean;
  readonly meanRelativeDiff: number;
  readonly ci90Lower: number;
  readonly ci90Upper: number;
  readonly tostPass: boolean;
  readonly conclusion: TrackingSeedEquivalenceConclusion;
  /** Both §2.2 clauses together. Never `true` for an inconclusive interval. */
  readonly pass: boolean;
  readonly notes: readonly string[];
}

export interface TrackingSeedEquivalenceReport {
  readonly cells: readonly TrackingSeedEquivalenceCell[];
  /** §2.3 rule 5 is protocol-level: `false` here means "do not pool across families", not that any
   * individual cell loses its retained verdict. `true` only when every judged cell is equivalent. */
  readonly pooledAcrossFamiliesPermitted: boolean;
}

export function evaluateTrackingSeedEquivalence(
  runs: readonly TrackingGateBRun[],
): TrackingSeedEquivalenceReport {
  // Practice never aggregates (FR-54-5); blocked runs never reach a metric (FR-54-10).
  const usable = runs.filter(
    (run) => run.cellFamily !== 'practice' && run.eligible && run.rmsEpsilonDeg !== undefined,
  );

  const byCondition = new Map<string, TrackingGateBRun[]>();
  for (const run of usable) {
    const bucket = byCondition.get(run.condition);
    if (bucket === undefined) byCondition.set(run.condition, [run]);
    else bucket.push(run);
  }

  const cells = [...byCondition.entries()]
    .map(([condition, cellRuns]) => evaluateCell(condition, cellRuns))
    .filter((cell): cell is TrackingSeedEquivalenceCell => cell !== undefined)
    .sort((a, b) => a.condition.localeCompare(b.condition));

  return {
    cells,
    pooledAcrossFamiliesPermitted: cells.length > 0 && cells.every((cell) => cell.conclusion === 'equivalent'),
  };
}

/** `undefined` for a cell nobody ran in both families — that is not a finding, just an absence. */
function evaluateCell(condition: string, runs: readonly TrackingGateBRun[]): TrackingSeedEquivalenceCell | undefined {
  // A-2: one value per participant per family.
  const perParticipant = new Map<string, { a: number[]; b: number[] }>();
  for (const run of runs) {
    const entry = perParticipant.get(run.participantId) ?? { a: [], b: [] };
    (run.seedFamily === 'A' ? entry.a : entry.b).push(run.rmsEpsilonDeg!);
    perParticipant.set(run.participantId, entry);
  }

  const familyAValues = [...perParticipant.values()].filter((entry) => entry.a.length > 0).map((entry) => median(entry.a));
  const paired = [...perParticipant.values()]
    .filter((entry) => entry.a.length > 0 && entry.b.length > 0)
    .map((entry) => ({ a: median(entry.a), b: median(entry.b) }));
  if (paired.length === 0) return undefined;

  const familyAMedianRmsEpsilonDeg = median(familyAValues);
  const notes: string[] = [];
  // The denominator is the cell's family-A median, not each participant's own value: §2.2 states
  // the bound "relative to that cell's family A median RMS ε", so every participant's difference
  // is expressed on one common scale rather than on their personal one.
  const relative = paired.map((pair) => (pair.b - pair.a) / familyAMedianRmsEpsilonDeg);
  const medianRelativeDiff = median(relative);
  const medianDiffPass = Math.abs(medianRelativeDiff) <= GATE_B3B_MAX_ABS_MEDIAN_RELATIVE_DIFF;

  if (paired.length < GATE_B3B_MIN_PLANNED_PAIRS) {
    notes.push(
      `only ${paired.length} paired participants — the protocol plans ${GATE_B3B_MIN_PLANNED_PAIRS}–8 (§4); ` +
        `the interval below is correspondingly wide`,
    );
  }

  if (paired.length < 2) {
    return {
      condition,
      pairedParticipantCount: paired.length,
      familyAMedianRmsEpsilonDeg,
      medianRelativeDiff,
      medianDiffPass,
      meanRelativeDiff: mean(relative),
      ci90Lower: Number.NaN,
      ci90Upper: Number.NaN,
      tostPass: false,
      conclusion: 'insufficient-pairs',
      pass: false,
      notes: [...notes, 'fewer than two pairs — no confidence interval exists, so B-3b is not judged'],
    };
  }

  const meanRelativeDiff = mean(relative);
  const standardError = sampleSd(relative) / Math.sqrt(relative.length);
  const halfWidth = tCritical(relative.length - 1) * standardError;
  const ci90Lower = meanRelativeDiff - halfWidth;
  const ci90Upper = meanRelativeDiff + halfWidth;

  const bound = GATE_B3B_EQUIVALENCE_BOUND;
  const tostPass = ci90Lower > -bound && ci90Upper < bound;
  const different = ci90Lower > bound || ci90Upper < -bound;
  const conclusion: TrackingSeedEquivalenceConclusion = tostPass
    ? 'equivalent'
    : different
      ? 'different'
      : 'not-shown-equivalent';

  if (conclusion === 'not-shown-equivalent') {
    notes.push(
      'inconclusive: the 90% CI straddles an equivalence bound. This is NOT evidence that the ' +
        'families differ — with 6–8 pairs it is the expected outcome even when they do not (§2.5 A-3). ' +
        'Report it as "equivalence not shown", never as "not equivalent".',
    );
  }
  if (!medianDiffPass) {
    notes.push(
      `median paired difference ${(100 * medianRelativeDiff).toFixed(1)}% exceeds ` +
        `±${100 * GATE_B3B_MAX_ABS_MEDIAN_RELATIVE_DIFF}% of the family-A median`,
    );
  }

  return {
    condition,
    pairedParticipantCount: paired.length,
    familyAMedianRmsEpsilonDeg,
    medianRelativeDiff,
    medianDiffPass,
    meanRelativeDiff,
    ci90Lower,
    ci90Upper,
    tostPass,
    conclusion,
    // §2.2 requires both clauses.
    pass: medianDiffPass && tostPass,
    notes,
  };
}

/**
 * One-sided t critical value at α = 0.05, i.e. t_{0.95, df} — the half-width multiplier for a 90%
 * two-sided interval. Tabulated rather than computed: df here is fixed by the protocol at 5–7
 * (6–8 pairs), and a table is auditable against any statistics text, which an inverse incomplete
 * beta is not. Values are the standard ones to 4 decimal places; beyond the table the normal
 * quantile 1.6449 is the exact limit and the error is under 0.5% by df 40.
 */
function tCritical(df: number): number {
  const table: Record<number, number> = {
    1: 6.3138, 2: 2.92, 3: 2.3534, 4: 2.1318, 5: 2.015, 6: 1.9432, 7: 1.8946, 8: 1.8595,
    9: 1.8331, 10: 1.8125, 11: 1.7959, 12: 1.7823, 13: 1.7709, 14: 1.7613, 15: 1.7531,
    16: 1.7459, 17: 1.7396, 18: 1.7341, 19: 1.7291, 20: 1.7247, 21: 1.7207, 22: 1.7171,
    23: 1.7139, 24: 1.7109, 25: 1.7081, 26: 1.7056, 27: 1.7033, 28: 1.7011, 29: 1.6991,
    30: 1.6973, 35: 1.6896, 40: 1.6839,
  };
  if (table[df] !== undefined) return table[df];
  if (df > 40) return 1.6449;
  // Between tabulated rows (31–39): the conservative neighbour, never an interpolation that could
  // narrow the interval below the true value.
  return df < 35 ? table[30] : table[35];
}

function median(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = values.slice().sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const rank = (sorted.length - 1) / 2;
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleSd(values: readonly number[]): number {
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1));
}

/** Console rendering for the analysis runner's Gate B section. */
export function formatTrackingSeedEquivalence(report: TrackingSeedEquivalenceReport): string {
  if (report.cells.length === 0) {
    return '  B-3b seed equivalence: no participant ran both seed families — not judged.';
  }
  const lines = [
    `  B-3b seed equivalence (paired TOST, α=${GATE_B3B_ALPHA}, bound ±${100 * GATE_B3B_EQUIVALENCE_BOUND}%) — ` +
      `pooling across families ${report.pooledAcrossFamiliesPermitted ? 'permitted' : 'NOT permitted'}:`,
  ];
  for (const cell of report.cells) {
    lines.push(
      `      ${cell.conclusion.padEnd(21)} ${cell.condition} [pairs=${cell.pairedParticipantCount}] ` +
        `medianDiff=${pct(cell.medianRelativeDiff)}${cell.medianDiffPass ? '' : '!!'} ` +
        `90%CI=[${pct(cell.ci90Lower)}, ${pct(cell.ci90Upper)}]`,
    );
    for (const note of cell.notes) lines.push(`          · ${note}`);
  }
  return lines.join('\n');
}

function pct(value: number): string {
  return Number.isFinite(value) ? `${(100 * value).toFixed(1)}%` : 'n/a';
}
