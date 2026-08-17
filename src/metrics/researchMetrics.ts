import type { ExportPayload } from '../data/export.ts';
import type { TickRecord } from '../data/RingBuffer.ts';
import { omegaDegPerSec } from './angularKinematics.ts';
import { stat, type Stat } from './compute.ts';
import { deriveDetectionMetrics } from './detectionDerivation.ts';
import { buildPeekWindows, type PeekWindowTs, WINDOW_EPSILON_MS } from './peekWindows.ts';
import { segmentSubmovements, type Segment } from './submovement.ts';

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

export interface PhaseMetrics {
  samples: readonly PhaseSample[];
  aggregate: PhaseAggregate;
}

export interface SyncMetrics {
  rows: readonly SyncRow[];
  aggregate: SyncAggregate;
}

export type PromotedMetrics =
  | { status: 'ok'; phase: PhaseAggregate; sync: SyncAggregate }
  | { status: 'blocked'; reason: string };

const PHASE_MIN_WINDOW_TICKS = 30;
const PHASE_VERSION = 'phase-v1';
const SYNC_VERSION = 'sync-v1';
const SYNC_MIN_SAMPLES = 10;
const SYNC_SD_RATIO_THRESHOLD = 1 / 3;

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
