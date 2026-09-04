/**
 * WP-54 / T7 — Gate B's cell-level criteria (`T7-difficulty-calibration-gate.md` §2.2/§2.3/§2.5).
 *
 * Layers 5 and 6 of the analysis runner report B-1 and B-3c **per run**. Gate B judges **per
 * cell**, and gate §5 forbids producing those numbers with a one-off script — so the criteria live
 * here as a pure function with regression tests, exactly like `trackingFrozenCrosshairRatio.ts`
 * (slice 1) and `trackingTimeOnTaskSlope.ts` (slice 7).
 *
 * This module is deliberately split in two:
 *
 *   - `aggregateTrackingGateB()` — the criteria themselves, over plain per-run records. No payload
 *     parsing, no I/O, no derivation. That is what lets the thresholds be tested against literal
 *     inputs instead of against synthesized 25 s exports.
 *   - `extractTrackingGateBRuns()` — the glue that turns `ExportPayload`s into those records by
 *     running the shipped derivations (evidence/eligibility, layer 5, layer 6). Lives in
 *     `trackingGateBExtract.ts` so this file stays free of them.
 *
 * **The thresholds below are frozen (§2.2, 2026-09-03) and must not be edited after data
 * collection** — README §5. A change is expressed as a new protocol version plus a decision row.
 *
 * **§2.5's operational definitions (frozen 2026-09-04, before any T7 human data):**
 *   - **A-1** — only seed family A runs feed B-1/B-2a/B-2b/B-3a/B-4. Family B exists to answer
 *     B-3b (seed equivalence); pooling before that is answered would presuppose the answer.
 *   - **A-2** — a participant with several eligible runs in one cell contributes the **median** of
 *     their RMS ε to the between-participant CV.
 *   - **A-3** — B-3b's TOST is paired, two one-sided, α = 0.05. Not implemented here: per §2.3
 *     rule 5 it is protocol-level and never changes a cell's retained/remove verdict.
 */

/** §2.2 B-1 — median frozen-crosshair ratio at or above this discriminates tracking from stillness. */
export const GATE_B1_MIN_MEDIAN_RATIO = 2.0;
/** §2.2 B-2a — at or above this median TOT the cell is a ceiling (cannot rank participants). */
export const GATE_B2A_MAX_MEDIAN_TOT_PERCENT = 80;
/** §2.2 B-2a — below this between-participant CV of RMS ε the cell is a ceiling. */
export const GATE_B2A_MIN_BETWEEN_PARTICIPANT_CV = 0.15;
/** §2.2 B-2b — at or above this share of acquisition failures the cell is a floor. */
export const GATE_B2B_MAX_ACQUISITION_FAILURE_RATE = 0.2;
/** §2.2 B-2b — at or below this median TOT the cell is a floor. */
export const GATE_B2B_MIN_MEDIAN_TOT_PERCENT = 5;
/** §2.2 B-3c — |mean Δ| above this means the 25 s block length needs revisiting (protocol-level). */
export const GATE_B3C_MAX_ABS_MEAN_DELTA = 0.2;
/** §2.2 B-4 — fewer eligible runs than this and the cell is not judged at all (§2.3 rule 1). */
export const GATE_B4_MIN_ELIGIBLE_RUNS = 10;

export type TrackingGateBCellFamily = 'core' | 'reversal' | 'calibration' | 'practice';

/** One run's contribution to Gate B. Every optional field is absent exactly when the shipped
 * derivation could not produce it (acquisition failure, too few ticks, a non-`ok` layer status) —
 * absent means "excluded from that statistic", never "zero". */
export interface TrackingGateBRun {
  /** `meta.drillId` — WP-54's single source for condition identity. */
  readonly condition: string;
  readonly participantId: string;
  /** `A` = `Session index 0` (primary seeds), `B` = `Session index 1` (alternate). §2.5 A-1 keeps
   * B out of every criterion except B-3b. */
  readonly seedFamily: 'A' | 'B';
  readonly cellFamily: TrackingGateBCellFamily;
  /** `evaluateTrackingRunEligibility()`'s verdict — FR-54-10: a blocked run never aggregates. */
  readonly eligible: boolean;
  readonly acquisitionFailure: boolean;
  /** P0 primary outcome over the tracking window; absent on acquisition failure. */
  readonly rmsEpsilonDeg?: number;
  /** P0 TOT% over the tracking window; absent on acquisition failure. */
  readonly totPercent?: number;
  /** Layer 5's B-1 ratio; absent unless that layer returned `ok`. */
  readonly frozenCrosshairRatio?: number;
  /** Layer 6's B-3c Δ; absent unless that layer returned `ok`. */
  readonly timeOnTaskDeltaFraction?: number;
  /** Delivered angular size, from `meta.targets.hitbox` — the size axis of the 2×2 (B-3a). */
  readonly targetAngularSizeDeg?: number;
  /** Nominal 2D RMS speed, from `meta.spawn.trackingTrajectory` — the speed axis of the 2×2. */
  readonly nominalSpeedDegPerSec?: number;
}

export type TrackingGateBVerdict = 'retained' | 'revise' | 'remove' | 'insufficient-data';

export interface TrackingGateBCellReport {
  readonly condition: string;
  readonly cellFamily: TrackingGateBCellFamily;
  /** Family A eligible runs only (§2.5 A-1) — the denominator of every criterion below. */
  readonly eligibleRunCount: number;
  readonly participantCount: number;
  /** B-1: median of the per-run ratios that layer 5 could compute. NaN when none could. */
  readonly medianFrozenCrosshairRatio: number;
  readonly b1Pass: boolean;
  /** B-2a/B-2b: median TOT% over the runs that acquired the target. NaN when none did. */
  readonly medianTotPercent: number;
  /** B-2a: SD/mean of the participants' RMS ε, each participant contributing their median (A-2).
   * Sample SD (n − 1). NaN with fewer than two participants. */
  readonly betweenParticipantCv: number;
  readonly b2aPass: boolean;
  readonly acquisitionFailureRate: number;
  readonly b2bPass: boolean;
  /** B-3c: mean Δ over the runs layer 6 could compute. NaN when none could. Protocol-level — it
   * never changes `verdict` (§2.3 rule 5). */
  readonly meanTimeOnTaskDelta: number;
  readonly b3cPass: boolean;
  readonly b4Pass: boolean;
  /** B-3a is judged across cells; this is that judgement's effect on *this* cell (§2.3 rule 4).
   * `true` for any cell outside the core 2×2. */
  readonly b3aPass: boolean;
  readonly verdict: TrackingGateBVerdict;
  /** Why `verdict` came out as it did, in §2.3's rule order — so the gate table can be filled in
   * without re-deriving the reasoning. */
  readonly reasons: readonly string[];
}

export interface TrackingGateBDirectionReport {
  /** `not-a-2x2` when the core cells do not form exactly two sizes × two speeds — B-3a cannot be
   * judged, and no core cell is failed for it. */
  readonly status: 'ok' | 'not-a-2x2';
  /** ①: at each speed, the smaller size has the lower median TOT. */
  readonly sizeEffectHolds: boolean;
  /** ②: at each size, 14 deg/s has the higher median RMS ε than 5 deg/s. */
  readonly speedEffectHolds: boolean;
  readonly pass: boolean;
  /** One human-readable line per comparison actually made. */
  readonly comparisons: readonly string[];
}

export interface TrackingGateBReport {
  readonly cells: readonly TrackingGateBCellReport[];
  readonly direction: TrackingGateBDirectionReport;
  /** Runs excluded before any criterion ran, and why — silent filtering would be worse than none. */
  readonly excluded: {
    readonly practice: number;
    readonly seedFamilyB: number;
    readonly ineligible: number;
  };
}

export function aggregateTrackingGateB(runs: readonly TrackingGateBRun[]): TrackingGateBReport {
  // FR-54-5: practice never aggregates. §2.5 A-1: family B is for B-3b only. FR-54-10: blocked
  // runs never reach a metric. Counted rather than silently dropped.
  const practice = runs.filter((run) => run.cellFamily === 'practice');
  const afterPractice = runs.filter((run) => run.cellFamily !== 'practice');
  const seedFamilyB = afterPractice.filter((run) => run.seedFamily === 'B');
  const afterFamily = afterPractice.filter((run) => run.seedFamily === 'A');
  const ineligible = afterFamily.filter((run) => !run.eligible);
  const included = afterFamily.filter((run) => run.eligible);

  const byCondition = new Map<string, TrackingGateBRun[]>();
  for (const run of included) {
    const bucket = byCondition.get(run.condition);
    if (bucket === undefined) byCondition.set(run.condition, [run]);
    else bucket.push(run);
  }

  const stats = [...byCondition.entries()]
    .map(([condition, cellRuns]) => cellStats(condition, cellRuns))
    .sort((a, b) => a.condition.localeCompare(b.condition));

  const direction = judgeDirection(stats);

  return {
    cells: stats.map((cell) => finalize(cell, direction)),
    direction,
    excluded: {
      practice: practice.length,
      seedFamilyB: seedFamilyB.length,
      ineligible: ineligible.length,
    },
  };
}

interface CellStats {
  readonly condition: string;
  readonly cellFamily: TrackingGateBCellFamily;
  readonly runs: readonly TrackingGateBRun[];
  readonly medianFrozenCrosshairRatio: number;
  readonly medianTotPercent: number;
  readonly betweenParticipantCv: number;
  readonly acquisitionFailureRate: number;
  readonly meanTimeOnTaskDelta: number;
  readonly participantCount: number;
  readonly sizeDeg?: number;
  readonly speedDegPerSec?: number;
}

function cellStats(condition: string, runs: readonly TrackingGateBRun[]): CellStats {
  // A-2: one value per participant — the median of their eligible runs in this cell.
  const byParticipant = new Map<string, number[]>();
  for (const run of runs) {
    if (run.rmsEpsilonDeg === undefined) continue;
    const bucket = byParticipant.get(run.participantId);
    if (bucket === undefined) byParticipant.set(run.participantId, [run.rmsEpsilonDeg]);
    else bucket.push(run.rmsEpsilonDeg);
  }
  const perParticipantRms = [...byParticipant.values()].map(median);

  return {
    condition,
    cellFamily: runs[0].cellFamily,
    runs,
    medianFrozenCrosshairRatio: median(defined(runs.map((run) => run.frozenCrosshairRatio))),
    // Acquisition failures carry no TOT; they are counted by B-2b instead of being folded in as
    // zeroes, which would let one criterion's failure mode leak into the other's number.
    medianTotPercent: median(defined(runs.map((run) => run.totPercent))),
    betweenParticipantCv: coefficientOfVariation(perParticipantRms),
    acquisitionFailureRate: runs.filter((run) => run.acquisitionFailure).length / runs.length,
    meanTimeOnTaskDelta: mean(defined(runs.map((run) => run.timeOnTaskDeltaFraction))),
    participantCount: new Set(runs.map((run) => run.participantId)).size,
    ...pickAxis(runs, (run) => run.targetAngularSizeDeg, 'sizeDeg'),
    ...pickAxis(runs, (run) => run.nominalSpeedDegPerSec, 'speedDegPerSec'),
  };
}

/** The cell's size/speed, present only when every run in it agrees — a cell whose runs disagree is
 * a cross-generation mix (the drillId reuse warned about in `analysis-tracking.md`) and must not
 * be placed on either axis of the 2×2. */
function pickAxis<K extends string>(
  runs: readonly TrackingGateBRun[],
  read: (run: TrackingGateBRun) => number | undefined,
  key: K,
): Partial<Record<K, number>> {
  const values = new Set(defined(runs.map(read)));
  return values.size === 1 ? ({ [key]: [...values][0] } as Record<K, number>) : {};
}

function judgeDirection(stats: readonly CellStats[]): TrackingGateBDirectionReport {
  const core = stats.filter(
    (cell) => cell.cellFamily === 'core' && cell.sizeDeg !== undefined && cell.speedDegPerSec !== undefined,
  );
  const sizes = [...new Set(core.map((cell) => cell.sizeDeg!))].sort((a, b) => a - b);
  const speeds = [...new Set(core.map((cell) => cell.speedDegPerSec!))].sort((a, b) => a - b);
  const complete =
    sizes.length === 2 && speeds.length === 2 && core.length === 4 &&
    sizes.every((size) => speeds.every((speed) => find(core, size, speed) !== undefined));
  if (!complete) {
    return { status: 'not-a-2x2', sizeEffectHolds: false, speedEffectHolds: false, pass: false, comparisons: [] };
  }

  const [smallSize, largeSize] = sizes;
  const [slowSpeed, fastSpeed] = speeds;
  const comparisons: string[] = [];

  // ① at each speed, the smaller target should be harder to stay on.
  let sizeEffectHolds = true;
  for (const speed of speeds) {
    const small = find(core, smallSize, speed)!;
    const large = find(core, largeSize, speed)!;
    const holds = small.medianTotPercent < large.medianTotPercent;
    sizeEffectHolds &&= holds;
    comparisons.push(
      `size@${speed}dps: ${smallSize}deg TOT ${fmt(small.medianTotPercent)}% ` +
        `${holds ? '<' : '>='} ${largeSize}deg TOT ${fmt(large.medianTotPercent)}% — ${holds ? 'ok' : 'REVERSED'}`,
    );
  }

  // ② at each size, the faster target should produce more tracking error.
  let speedEffectHolds = true;
  for (const size of sizes) {
    const slow = find(core, size, slowSpeed)!;
    const fast = find(core, size, fastSpeed)!;
    const slowRms = medianRms(slow);
    const fastRms = medianRms(fast);
    const holds = fastRms > slowRms;
    speedEffectHolds &&= holds;
    comparisons.push(
      `speed@${size}deg: ${fastSpeed}dps RMSeps ${fmt(fastRms, 3)} ` +
        `${holds ? '>' : '<='} ${slowSpeed}dps RMSeps ${fmt(slowRms, 3)} — ${holds ? 'ok' : 'REVERSED'}`,
    );
  }

  return {
    status: 'ok',
    sizeEffectHolds,
    speedEffectHolds,
    pass: sizeEffectHolds && speedEffectHolds,
    comparisons,
  };
}

function find(core: readonly CellStats[], size: number, speed: number): CellStats | undefined {
  return core.find((cell) => cell.sizeDeg === size && cell.speedDegPerSec === speed);
}

function medianRms(cell: CellStats): number {
  return median(defined(cell.runs.map((run) => run.rmsEpsilonDeg)));
}

function finalize(cell: CellStats, direction: TrackingGateBDirectionReport): TrackingGateBCellReport {
  const b4Pass = cell.runs.length >= GATE_B4_MIN_ELIGIBLE_RUNS;
  const b1Pass = cell.medianFrozenCrosshairRatio >= GATE_B1_MIN_MEDIAN_RATIO;
  const b2aPass =
    cell.medianTotPercent < GATE_B2A_MAX_MEDIAN_TOT_PERCENT &&
    cell.betweenParticipantCv >= GATE_B2A_MIN_BETWEEN_PARTICIPANT_CV;
  const b2bPass =
    cell.acquisitionFailureRate < GATE_B2B_MAX_ACQUISITION_FAILURE_RATE &&
    cell.medianTotPercent > GATE_B2B_MIN_MEDIAN_TOT_PERCENT;
  const b3cPass = Math.abs(cell.meanTimeOnTaskDelta) <= GATE_B3C_MAX_ABS_MEAN_DELTA;
  // B-3a only ever fails a cell inside the core 2×2, and only when the 2×2 could be judged.
  const inCore2x2 = cell.cellFamily === 'core' && direction.status === 'ok';
  const b3aPass = inCore2x2 ? direction.pass : true;

  const reasons: string[] = [];
  let verdict: TrackingGateBVerdict;
  // §2.3, in its stated order.
  if (!b4Pass) {
    verdict = 'insufficient-data';
    reasons.push(
      `B-4: ${cell.runs.length} eligible family-A runs < ${GATE_B4_MIN_ELIGIBLE_RUNS} — not judged (§2.3 rule 1)`,
    );
  } else if (!b1Pass && b2aPass && b2bPass && b3aPass) {
    verdict = 'remove';
    reasons.push(
      `B-1: median ratio ${fmt(cell.medianFrozenCrosshairRatio)} < ${GATE_B1_MIN_MEDIAN_RATIO} ` +
        `— diagnostic block only, must not reach a coach report (§2.3 rule 2, C-D3)`,
    );
  } else if (!b2aPass || !b2bPass) {
    verdict = 'revise';
    if (!b2aPass) reasons.push(`B-2a ceiling: median TOT ${fmt(cell.medianTotPercent)}%, between-participant CV ${fmt(cell.betweenParticipantCv, 3)}`);
    if (!b2bPass) reasons.push(`B-2b floor: acquisition failure ${fmt(100 * cell.acquisitionFailureRate)}%, median TOT ${fmt(cell.medianTotPercent)}%`);
    if (!b1Pass) reasons.push(`B-1 also failed (median ratio ${fmt(cell.medianFrozenCrosshairRatio)}) — §2.3 rule 2 needs every other criterion to pass, so this is revise, not remove`);
  } else if (!b3aPass) {
    verdict = 'revise';
    reasons.push('B-3a: the size × speed manipulation did not act in the expected direction (§2.3 rule 4)');
  } else {
    verdict = 'retained';
  }
  // §2.3 rule 5: protocol-level, recorded but never decisive for this cell.
  if (!b3cPass) {
    reasons.push(
      `B-3c (protocol-level, §2.3 rule 5): mean Δ ${fmt(100 * cell.meanTimeOnTaskDelta)}% ` +
        `exceeds ±${100 * GATE_B3C_MAX_ABS_MEAN_DELTA}% — record a suggested block length, do not change 25 s here`,
    );
  }

  return {
    condition: cell.condition,
    cellFamily: cell.cellFamily,
    eligibleRunCount: cell.runs.length,
    participantCount: cell.participantCount,
    medianFrozenCrosshairRatio: cell.medianFrozenCrosshairRatio,
    b1Pass,
    medianTotPercent: cell.medianTotPercent,
    betweenParticipantCv: cell.betweenParticipantCv,
    b2aPass,
    acquisitionFailureRate: cell.acquisitionFailureRate,
    b2bPass,
    meanTimeOnTaskDelta: cell.meanTimeOnTaskDelta,
    b3cPass,
    b4Pass,
    b3aPass,
    verdict,
    reasons,
  };
}

function defined(values: readonly (number | undefined)[]): number[] {
  return values.filter((value): value is number => value !== undefined && Number.isFinite(value));
}

/** Percentile convention mirrors `trackingDerivation`'s `percentile(values, 50)` — the same
 * definition of "median" the rest of WP-54 uses. NaN for an empty set, so "no data" can never be
 * mistaken for a value. */
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

/** SD/mean with the **sample** SD (n − 1) — these are a sample of participants, not the
 * population. NaN below two participants, where dispersion is undefined rather than zero. */
function coefficientOfVariation(values: readonly number[]): number {
  if (values.length < 2) return Number.NaN;
  const m = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance) / m;
}

function fmt(value: number, digits = 1): string {
  return Number.isFinite(value) ? value.toFixed(digits) : 'n/a';
}

/** Console rendering for the analysis runner's Gate B section. */
export function formatTrackingGateBReport(report: TrackingGateBReport): string {
  const lines: string[] = [
    `=== Gate B (§2.2/§2.3; family A only per §2.5 A-1) — excluded: ` +
      `${report.excluded.practice} practice, ${report.excluded.seedFamilyB} family-B, ` +
      `${report.excluded.ineligible} ineligible ===`,
  ];
  for (const cell of report.cells) {
    lines.push(
      `  ${cell.verdict.toUpperCase().padEnd(17)} ${cell.condition} ` +
        `[n=${cell.eligibleRunCount} p=${cell.participantCount}] ` +
        `B-1 ratio=${fmt(cell.medianFrozenCrosshairRatio, 2)}${mark(cell.b1Pass)} ` +
        `B-2 TOT=${fmt(cell.medianTotPercent)}% cv=${fmt(cell.betweenParticipantCv, 3)}${mark(cell.b2aPass)} ` +
        `acqFail=${fmt(100 * cell.acquisitionFailureRate)}%${mark(cell.b2bPass)} ` +
        `B-3c dΔ=${fmt(100 * cell.meanTimeOnTaskDelta)}%${mark(cell.b3cPass)}`,
    );
    for (const reason of cell.reasons) lines.push(`      · ${reason}`);
  }
  lines.push(`  B-3a direction (${report.direction.status}): ${report.direction.pass ? 'ok' : 'NOT ESTABLISHED'}`);
  for (const comparison of report.direction.comparisons) lines.push(`      · ${comparison}`);
  return lines.join('\n');
}

function mark(pass: boolean): string {
  return pass ? '' : '!!';
}
