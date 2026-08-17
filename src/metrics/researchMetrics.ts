import type { ExportPayload } from '../data/export.ts';
import type { TickRecord } from '../data/RingBuffer.ts';
import { omegaDegPerSec } from './angularKinematics.ts';
import { stat, type Stat } from './compute.ts';
import { deriveDetectionMetrics } from './detectionDerivation.ts';
import { buildPeekWindows, type PeekWindowTs, WINDOW_EPSILON_MS } from './peekWindows.ts';
import { segmentSubmovements, type Segment } from './submovement.ts';
import { deriveTrackingSamples } from './trackingDerivation.ts';

export interface PromotedStat {
  mean: number;
  p50: number;
  sd: number;
  n: number;
}

export interface PhaseSample {
  peekIndex: number;
  side: 'L' | 'R';
  tOnset?: number;
  tMrEnd?: number;
  tAnchor?: number;
  recMs?: number;
  mrMs?: number;
  vMs?: number;
  peakOmegaDegPerSec?: number;
  tDetect?: number;
  recMinusDetectMs?: number;
  flags: readonly string[];
}

export interface PhaseAggregate {
  recMs: PromotedStat;
  mrMs: PromotedStat;
  vMs: PromotedStat;
  peakOmegaDegPerSec: PromotedStat;
  flagCounts: Readonly<Record<string, number>>;
  version: 'phase-v1';
}

export interface SyncRow {
  peekIndex: number;
  releaseToFireMs?: number;
  counterHoldMs?: number;
  counterToFireMs?: number;
  side: 'L' | 'R';
  ads?: boolean;
  weaponMode: 'hitscan' | 'projectile';
  flags: readonly string[];
}

export interface PrecisionVerdict {
  metric: 'release_to_fire_ms' | 'counter_hold_ms';
  n: number;
  sampleSdMs?: number;
  quantizationSdMs: number;
  verdict: 'sufficient' | 'insufficient' | 'blocked-by-data';
  reason: string;
}

export interface SyncAggregate {
  releaseToFireMs: PromotedStat;
  counterHoldMs: PromotedStat;
  counterToFireMs: PromotedStat;
  verdicts: readonly PrecisionVerdict[];
  flagCounts: Readonly<Record<string, number>>;
  version: 'sync-v1';
}

export type CurveSignal = 'omega' | 'epsilon';

export interface CurveRow {
  peekIndex: number;
  side: 'L' | 'R';
  ads?: boolean;
  signal: CurveSignal;
  values: readonly number[];
  flags: readonly string[];
}

export interface NormalizedCurve {
  readonly mean: readonly number[];
  readonly lower: readonly number[];
  readonly upper: readonly number[];
  readonly n: number;
}

export interface CurveAggregate {
  omega: { left: NormalizedCurve; right: NormalizedCurve };
  epsilon: { left: NormalizedCurve; right: NormalizedCurve };
  flagCounts: Readonly<Record<string, number>>;
  version: 'curve-v1';
}

export interface PhaseMetrics {
  samples: readonly PhaseSample[];
  aggregate: PhaseAggregate;
}

export interface SyncMetrics {
  rows: readonly SyncRow[];
  aggregate: SyncAggregate;
}

export interface CurveMetrics {
  rows: readonly CurveRow[];
  aggregate: CurveAggregate;
}

export type PromotedMetrics =
  | { status: 'ok'; phase: PhaseAggregate; sync: SyncAggregate; curve: CurveAggregate }
  | { status: 'blocked'; reason: string };

const PHASE_MIN_WINDOW_TICKS = 30;
const PHASE_VERSION = 'phase-v1';
const SYNC_VERSION = 'sync-v1';
const SYNC_MIN_SAMPLES = 10;
const SYNC_SD_RATIO_THRESHOLD = 1 / 3;
const CURVE_VERSION = 'curve-v1';
const CURVE_POINTS = 101;
const CURVE_MIN_TICKS = 3;

export function computePromotedMetrics(payload: ExportPayload): PromotedMetrics {
  if (payload.meta.mouseIntegration === undefined) {
    return {
      status: 'blocked',
      reason: 'meta.mouseIntegration is missing; promoted phase metrics require tick-integral omega (KI-005)',
    };
  }

  return {
    status: 'ok',
    phase: computePhaseMetrics(payload).aggregate,
    sync: computeSyncMetrics(payload).aggregate,
    curve: computeCurveMetrics(payload).aggregate,
  };
}

export function computePhaseMetrics(payload: ExportPayload): PhaseMetrics {
  const ticks = sortedTicks(payload);
  const peeks = buildPeekWindows(payload);
  const detections = deriveDetectionMetrics(payload).presentations;
  const samples = peeks.map((peek) => {
    const windowTicks = ticks.slice(peek.tickRange.start, peek.tickRange.end);
    const omega = omegaDegPerSec(windowTicks).values;
    const segments = omega.length > 1 ? segmentSubmovements(omega.slice(1)).segments.map(toTickFrame) : [];
    return phaseSample(peek, windowTicks, omega, segments, detections[peek.index]?.tDetectMs);
  });

  return { samples, aggregate: aggregatePhase(samples) };
}

export function computeSyncMetrics(payload: ExportPayload): SyncMetrics {
  const ticks = sortedTicks(payload);
  const peeks = buildPeekWindows(payload);
  const rows = peeks.map((peek) => syncRow(peek, ticks.slice(peek.tickRange.start, peek.tickRange.end)));
  return { rows, aggregate: aggregateSync(rows, payload.meta.simHz) };
}

export function computeCurveMetrics(payload: ExportPayload): CurveMetrics {
  const ticks = sortedTicks(payload);
  const peeks = buildPeekWindows(payload);
  const tracking = deriveTrackingSamples(payload).presentations;
  const rows = peeks.flatMap((peek) => {
    const windowTicks = ticks.slice(peek.tickRange.start, peek.tickRange.end);
    const omega = omegaDegPerSec(windowTicks).values;
    const epsilonSamples = tracking[peek.index]?.samples;
    const epsilon =
      epsilonSamples !== undefined && epsilonSamples.length === windowTicks.length
        ? epsilonSamples.map((sample) => sample.epsilonDeg)
        : undefined;
    return curveRows(peek, windowTicks, omega, epsilon);
  });
  return { rows, aggregate: aggregateCurve(rows) };
}

export function normalize101(
  values: readonly number[],
  t: readonly number[],
  t0: number,
  t1: number,
  points = CURVE_POINTS,
): number[] {
  if (values.length !== t.length) throw new Error('values and t must have the same shape');
  if (!Number.isInteger(points) || points < 2) throw new Error('points must be an integer >= 2');
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) throw new Error('t0 and t1 must be finite');
  if (t1 <= t0) throw new Error('t1 must be greater than t0 (degenerate window)');

  const finite = values
    .map((value, index) => ({ value, t: t[index] }))
    .filter((sample) => Number.isFinite(sample.value) && Number.isFinite(sample.t))
    .sort((a, b) => a.t - b.t);
  if (finite.length < 2) throw new Error('normalize101 requires at least two finite samples');

  const result: number[] = [];
  let cursor = 0;
  for (let index = 0; index < points; index++) {
    const fraction = index / (points - 1);
    const target = t0 + fraction * (t1 - t0);
    while (cursor < finite.length - 2 && finite[cursor + 1].t < target) cursor++;
    if (target <= finite[0].t) {
      result.push(finite[0].value);
    } else if (target >= finite[finite.length - 1].t) {
      result.push(finite[finite.length - 1].value);
    } else {
      const left = finite[cursor];
      const right = finite[cursor + 1];
      const weight = (target - left.t) / (right.t - left.t);
      result.push(left.value * (1 - weight) + right.value * weight);
    }
  }
  return result;
}

function phaseSample(
  peek: PeekWindowTs,
  ticks: readonly TickRecord[],
  omega: readonly number[],
  segments: readonly Segment[],
  tDetect: number | undefined,
): PhaseSample {
  const tickTimes = ticks.map((tick) => tick.t);
  if (tickTimes.length < PHASE_MIN_WINDOW_TICKS) {
    return finalizePhase(peek, { tDetect, flags: ['window_too_short'] });
  }

  const flags: string[] = [];
  if (!isLocallyUniform(tickTimes)) flags.push('non_uniform_dt');

  const primary = segments.find((segment) => segment.kind === 'primary_flick');
  if (primary === undefined) {
    flags.push('no_primary_flick');
    return finalizePhase(peek, { tDetect, flags });
  }

  const tOnset = tickTimes[primary.startIdx];
  const tMrEnd = tickTimes[primary.endIdx];
  const peakOmegaDegPerSec = peakOmega(omega, primary.startIdx, primary.endIdx);
  const tAnchor = peek.tFirstShot;
  if (tAnchor === undefined) flags.push('no_first_shot');
  else if (tAnchor < tMrEnd) flags.push('anchor_before_onset');

  const degenerate = flags.includes('anchor_before_onset');
  const recMs = degenerate ? undefined : tOnset - peek.tVisible;
  const mrMs = degenerate ? undefined : tMrEnd - tOnset;
  const vMs = degenerate || tAnchor === undefined ? undefined : tAnchor - tMrEnd;
  const recMinusDetectMs = recMs !== undefined && tDetect !== undefined ? tOnset - tDetect : undefined;

  return finalizePhase(peek, {
    tOnset,
    tMrEnd,
    tAnchor,
    recMs,
    mrMs,
    vMs,
    peakOmegaDegPerSec,
    tDetect,
    recMinusDetectMs,
    flags,
  });
}

function syncRow(peek: PeekWindowTs, windowTicks: readonly TickRecord[]): SyncRow {
  const flags = [...peek.flags];
  if (peek.tRelease === undefined) flags.push('missing_release');
  if (peek.tCounter === undefined) flags.push('missing_counter');
  if (peek.tFirstShot === undefined) flags.push('missing_first_shot');

  const [counterHoldMs, counterHoldTruncated] = counterHoldMsForPeek(peek, windowTicks);
  if (counterHoldTruncated) flags.push('counter_hold_truncated');
  else if (peek.tCounter !== undefined && peek.counterKey !== undefined && counterHoldMs === undefined) {
    flags.push('no_key_transition');
  }

  return {
    peekIndex: peek.index,
    releaseToFireMs: delta(peek.tFirstShot, peek.tRelease),
    counterHoldMs,
    counterToFireMs: delta(peek.tFirstShot, peek.tCounter),
    side: peek.side,
    ads: peek.ads,
    weaponMode: 'hitscan',
    flags: unique(flags),
  };
}

function aggregatePhase(samples: readonly PhaseSample[]): PhaseAggregate {
  const unflagged = samples.filter((sample) => sample.flags.length === 0);
  return {
    recMs: toPromotedStat(statFinite(unflagged.map((sample) => sample.recMs))),
    mrMs: toPromotedStat(statFinite(unflagged.map((sample) => sample.mrMs))),
    vMs: toPromotedStat(statFinite(unflagged.map((sample) => sample.vMs))),
    peakOmegaDegPerSec: toPromotedStat(statFinite(unflagged.map((sample) => sample.peakOmegaDegPerSec))),
    flagCounts: flagCounts(samples),
    version: PHASE_VERSION,
  };
}

function aggregateSync(rows: readonly SyncRow[], simHz: number): SyncAggregate {
  const unflagged = rows.filter((row) => row.flags.length === 0);
  return {
    releaseToFireMs: toPromotedStat(statFinite(unflagged.map((row) => row.releaseToFireMs))),
    counterHoldMs: toPromotedStat(statFinite(unflagged.map((row) => row.counterHoldMs))),
    counterToFireMs: toPromotedStat(statFinite(unflagged.map((row) => row.counterToFireMs))),
    verdicts: evaluateReleasePrecision(rows, simHz),
    flagCounts: flagCounts(rows),
    version: SYNC_VERSION,
  };
}

function curveRows(
  peek: PeekWindowTs,
  ticks: readonly TickRecord[],
  omega: readonly number[],
  epsilon: readonly number[] | undefined,
): CurveRow[] {
  const tickTimes = ticks.map((tick) => tick.t);
  const baseFlags: string[] = [];
  let windowOk = true;

  if (peek.tFirstShot === undefined) {
    baseFlags.push('no_first_shot');
    windowOk = false;
  } else if (peek.tFirstShot <= peek.tVisible) {
    baseFlags.push('degenerate_window');
    windowOk = false;
  } else if (tickTimes.filter((t) => t >= peek.tVisible && t <= peek.tFirstShot!).length < CURVE_MIN_TICKS) {
    baseFlags.push('window_too_short');
    windowOk = false;
  }

  if (!isLocallyUniform(tickTimes)) baseFlags.push('non_uniform_dt');

  const omegaValues = windowOk ? resolveCurveSignal(omega, tickTimes, peek.tVisible, peek.tFirstShot!) : undefined;
  const omegaFlags = unique([...baseFlags, ...(omegaValues?.extraFlag !== undefined ? [omegaValues.extraFlag] : [])]);

  const epsilonValues =
    epsilon !== undefined && windowOk ? resolveCurveSignal(epsilon, tickTimes, peek.tVisible, peek.tFirstShot!) : undefined;
  const epsilonFlags = unique([
    ...baseFlags,
    ...(epsilon === undefined ? ['missing_epsilon'] : []),
    ...(epsilonValues?.extraFlag !== undefined ? [epsilonValues.extraFlag] : []),
  ]);

  return [
    curveRow(peek, 'omega', omegaValues?.values, omegaFlags),
    curveRow(peek, 'epsilon', epsilonValues?.values, epsilonFlags),
  ];
}

function resolveCurveSignal(
  values: readonly number[],
  tickTimes: readonly number[],
  t0: number,
  t1: number,
): { values?: readonly number[]; extraFlag?: string } {
  try {
    return { values: normalize101(values, tickTimes, t0, t1, CURVE_POINTS) };
  } catch {
    return { extraFlag: 'degenerate_window' };
  }
}

function curveRow(
  peek: PeekWindowTs,
  signal: CurveSignal,
  values: readonly number[] | undefined,
  flags: readonly string[],
): CurveRow {
  return {
    peekIndex: peek.index,
    side: peek.side,
    ads: peek.ads,
    signal,
    values: values ?? new Array<number>(CURVE_POINTS).fill(Number.NaN),
    flags: unique(flags),
  };
}

function aggregateCurve(rows: readonly CurveRow[]): CurveAggregate {
  return {
    omega: {
      left: normalizedCurve(rows, 'omega', 'L'),
      right: normalizedCurve(rows, 'omega', 'R'),
    },
    epsilon: {
      left: normalizedCurve(rows, 'epsilon', 'L'),
      right: normalizedCurve(rows, 'epsilon', 'R'),
    },
    flagCounts: flagCounts(rows),
    version: CURVE_VERSION,
  };
}

function normalizedCurve(rows: readonly CurveRow[], signal: CurveSignal, side: 'L' | 'R'): NormalizedCurve {
  const matrix = rows
    .filter((row) => row.signal === signal && row.side === side && row.flags.length === 0)
    .map((row) => row.values)
    .filter((values) => values.length === CURVE_POINTS && values.every(Number.isFinite));

  if (matrix.length === 0) {
    const empty = new Array<number>(CURVE_POINTS).fill(0);
    return { mean: empty, lower: empty, upper: empty, n: 0 };
  }

  const mean: number[] = [];
  const lower: number[] = [];
  const upper: number[] = [];
  for (let point = 0; point < CURVE_POINTS; point++) {
    const column = matrix.map((row) => row[point]);
    mean.push(column.reduce((sum, value) => sum + value, 0) / column.length);
    lower.push(percentile(column, 0.25));
    upper.push(percentile(column, 0.75));
  }
  return { mean, lower, upper, n: matrix.length };
}

function evaluateReleasePrecision(rows: readonly SyncRow[], simHz: number): PrecisionVerdict[] {
  const quantizationSdMs = (1000 / simHz) / Math.sqrt(12);
  return [
    precisionVerdict('release_to_fire_ms', validMetricValues(rows, (row) => row.releaseToFireMs), quantizationSdMs),
    precisionVerdict('counter_hold_ms', validMetricValues(rows, (row) => row.counterHoldMs), quantizationSdMs),
  ];
}

function precisionVerdict(
  metric: PrecisionVerdict['metric'],
  values: readonly number[],
  quantizationSdMs: number,
): PrecisionVerdict {
  const n = values.length;
  const sampleSdMs = n >= 2 ? sampleStandardDeviation(values) : undefined;
  if (n < SYNC_MIN_SAMPLES) {
    return {
      metric,
      n,
      sampleSdMs,
      quantizationSdMs,
      verdict: 'blocked-by-data',
      reason: `n=${n} < min_samples=${SYNC_MIN_SAMPLES}; collect ${SYNC_MIN_SAMPLES - n} more unflagged samples`,
    };
  }
  if (sampleSdMs === undefined) {
    throw new Error('sampleSdMs must be defined when n >= min_samples');
  }
  const threshold = sampleSdMs * SYNC_SD_RATIO_THRESHOLD;
  if (quantizationSdMs >= threshold) {
    return {
      metric,
      n,
      sampleSdMs,
      quantizationSdMs,
      verdict: 'insufficient',
      reason: `quantization_sd_ms=${formatPythonG(quantizationSdMs)} >= sample_sd_ms=${formatPythonG(
        sampleSdMs,
      )} * sd_ratio_threshold=${formatPythonG(SYNC_SD_RATIO_THRESHOLD)}`,
    };
  }
  return {
    metric,
    n,
    sampleSdMs,
    quantizationSdMs,
    verdict: 'sufficient',
    reason: `quantization_sd_ms=${formatPythonG(quantizationSdMs)} < sample_sd_ms=${formatPythonG(
      sampleSdMs,
    )} * sd_ratio_threshold=${formatPythonG(SYNC_SD_RATIO_THRESHOLD)}`,
  };
}

function counterHoldMsForPeek(peek: PeekWindowTs, windowTicks: readonly TickRecord[]): [number | undefined, boolean] {
  if (peek.tCounter === undefined || peek.counterKey === undefined || windowTicks.length === 0) {
    return [undefined, false];
  }

  let lastHeldMs: number | undefined;
  for (const tick of windowTicks) {
    if (tick.t < peek.tCounter - WINDOW_EPSILON_MS) continue;
    const held = tick.keys.map(String).includes(peek.counterKey);
    if (held) lastHeldMs = tick.t;
    else if (lastHeldMs !== undefined) return [Math.max(0, lastHeldMs - peek.tCounter), false];
  }
  return lastHeldMs === undefined ? [undefined, false] : [Math.max(0, lastHeldMs - peek.tCounter), true];
}

function toTickFrame(segment: Segment): Segment {
  return { ...segment, startIdx: segment.startIdx + 1, endIdx: segment.endIdx + 1 };
}

function finalizePhase(peek: PeekWindowTs, sample: Omit<PhaseSample, 'peekIndex' | 'side'>): PhaseSample {
  return {
    peekIndex: peek.index,
    side: peek.side,
    ...sample,
    flags: unique(sample.flags),
  };
}

function isLocallyUniform(tickTimes: readonly number[]): boolean {
  if (tickTimes.length < 2) return true;
  const intervals: number[] = [];
  for (let i = 1; i < tickTimes.length; i++) intervals.push(tickTimes[i] - tickTimes[i - 1]);
  const median = stat(intervals).p50;
  return intervals.every((interval) => Math.abs(interval - median) <= 1e-6);
}

function peakOmega(omega: readonly number[], startIdx: number, endIdx: number): number | undefined {
  const finite = omega.slice(startIdx, endIdx + 1).filter((value) => Number.isFinite(value));
  return finite.length > 0 ? Math.max(...finite) : undefined;
}

function validMetricValues(rows: readonly SyncRow[], select: (row: SyncRow) => number | undefined): number[] {
  return rows
    .filter((row) => row.flags.length === 0)
    .map(select)
    .filter((value): value is number => value !== undefined && Number.isFinite(value));
}

function statFinite(values: readonly (number | undefined)[]): Stat {
  return stat(values.filter((value): value is number => value !== undefined && Number.isFinite(value)));
}

function toPromotedStat(summary: Stat): PromotedStat {
  return { mean: summary.mean, p50: summary.p50, sd: summary.sd, n: summary.n };
}

function flagCounts(rows: readonly { readonly flags: readonly string[] }[]): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    for (const flag of row.flags) counts[flag] = (counts[flag] ?? 0) + 1;
  }
  return counts;
}

function percentile(values: readonly number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = (sorted.length - 1) * ratio;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function delta(later: number | undefined, earlier: number | undefined): number | undefined {
  return later === undefined || earlier === undefined ? undefined : later - earlier;
}

function sampleStandardDeviation(values: readonly number[]): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function sortedTicks(payload: ExportPayload): TickRecord[] {
  return payload.ticks.slice().sort((a, b) => a.t - b.t);
}

function unique(flags: readonly string[]): string[] {
  return [...new Set(flags)];
}

function formatPythonG(value: number): string {
  const formatted = value.toPrecision(12);
  if (!formatted.includes('e')) {
    return formatted.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
  }
  return formatted.replace(/(\.\d*?[1-9])0+e/, '$1e').replace(/\.0+e/, 'e');
}
