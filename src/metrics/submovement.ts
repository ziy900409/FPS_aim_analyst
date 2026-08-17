import { SG_SEG_V2, sgSmooth } from './filters/savitzkyGolay.ts';

export type SegmentKind = 'primary_flick' | 'micro_adjustment';

export interface SegmentParams {
  readonly sgWindow: number;
  readonly sgPoly: number;
  readonly peakSigmaK: number;
  readonly peakFloorDegPerSec: number;
  readonly lowRatio: number;
  readonly stopRatio: number;
  readonly version: string;
}

// Frozen seg-v2 parameters from research/src/modules/segments/algorithms/submovement.py.
export const SEG_V2_PARAMS: SegmentParams = {
  sgWindow: 11,
  sgPoly: 3,
  peakSigmaK: 0.75,
  peakFloorDegPerSec: 60.0,
  lowRatio: 0.1,
  stopRatio: 0.2,
  version: 'seg-v2',
};

export interface Segment {
  readonly kind: SegmentKind;
  readonly startIdx: number;
  readonly endIdx: number;
  readonly peakOmega: number;
  readonly flags: readonly string[];
}

export interface SegmentResult {
  readonly segments: readonly Segment[];
  readonly traceFlags: readonly string[];
}

export const SEGMENT_FLAG_VOCABULARY = [
  'below_floor',
  'empty_signal',
  'merged_adjacent_peaks',
  'no_peak',
  'non_finite_interpolated',
  'non_finite_replaced',
  'sg_fallback_short_signal',
  'truncated_at_window_edge',
  'zero_motion',
] as const;

const KNOWN_SEGMENT_FLAGS = new Set<string>(SEGMENT_FLAG_VOCABULARY);

interface Candidate {
  startIdx: number;
  endIdx: number;
  peakOmega: number;
  flags: Set<string>;
}

export function segmentSubmovements(
  omega: readonly number[],
  params: SegmentParams = SEG_V2_PARAMS,
): SegmentResult {
  validateParams(params);
  if (omega.length === 0) return result([], ['empty_signal']);

  const { clean, traceFlags } = prepareSignal(omega);
  if (!clean.some((value) => value > 0)) {
    return result([], [...traceFlags, 'zero_motion', 'below_floor']);
  }

  let smoothed: number[];
  if (clean.length < params.sgWindow) {
    smoothed = clean.slice();
    traceFlags.push('sg_fallback_short_signal');
  } else {
    smoothed = sgSmooth(clean, SG_SEG_V2);
  }
  smoothed = smoothed.map((value) => Math.max(value, 0));

  const threshold = Math.max(mean(smoothed) + params.peakSigmaK * populationStd(smoothed), params.peakFloorDegPerSec);
  const peakIndices = findPeakIndices(smoothed).filter((index) => smoothed[index] >= threshold);
  if (peakIndices.length === 0) {
    const outcome = Math.max(...smoothed) < params.peakFloorDegPerSec ? 'below_floor' : 'no_peak';
    return result([], [...traceFlags, outcome]);
  }

  const candidates = peakIndices.map((index) => candidate(smoothed, index, traceFlags, params));
  const merged = mergeOverlapping(candidates);
  const segments = merged.map((item, index): Segment => {
    const flags = [...item.flags].sort();
    assertKnownFlags(flags);
    return {
      kind: index === 0 ? 'primary_flick' : 'micro_adjustment',
      startIdx: item.startIdx,
      endIdx: item.endIdx,
      peakOmega: item.peakOmega,
      flags,
    };
  });
  return result(segments, traceFlags);
}

/**
 * scipy.signal.find_peaks with no kwargs delegates local maxima detection to
 * _local_maxima_1d: endpoint plateaus are ignored and plateau peaks use
 * floor((leftEdge + rightEdge) / 2).
 */
export function findPeakIndices(values: readonly number[]): number[] {
  const peaks: number[] = [];
  let i = 1;
  while (i < values.length - 1) {
    if (values[i - 1] < values[i]) {
      const left = i;
      let right = i;
      while (right < values.length - 1 && values[right] === values[right + 1]) right++;
      if (right < values.length - 1 && values[right] > values[right + 1]) {
        peaks.push(Math.floor((left + right) / 2));
      }
      i = right + 1;
    } else {
      i++;
    }
  }
  return peaks;
}

export function isKnownSegmentFlag(flag: string): boolean {
  return KNOWN_SEGMENT_FLAGS.has(flag);
}

function prepareSignal(values: readonly number[]): { clean: number[]; traceFlags: string[] } {
  const finite = values.map((value) => Number.isFinite(value));
  if (!finite.some(Boolean)) {
    return { clean: values.map(() => 0), traceFlags: ['non_finite_replaced'] };
  }
  if (finite.every(Boolean)) {
    return { clean: values.slice(), traceFlags: [] };
  }

  const finiteIndices = finite.flatMap((isFiniteValue, index) => (isFiniteValue ? [index] : []));
  const firstFinite = finiteIndices[0];
  const lastFinite = finiteIndices[finiteIndices.length - 1];
  const clean = new Array<number>(values.length);
  let rightPointer = 0;
  for (let i = 0; i < values.length; i++) {
    if (i < firstFinite || i > lastFinite) {
      clean[i] = 0;
      continue;
    }
    if (finite[i]) {
      clean[i] = Math.max(values[i], 0);
      continue;
    }
    while (finiteIndices[rightPointer] < i) rightPointer++;
    const right = finiteIndices[rightPointer];
    const left = finiteIndices[rightPointer - 1];
    const ratio = (i - left) / (right - left);
    clean[i] = Math.max(values[left] * (1 - ratio) + values[right] * ratio, 0);
  }
  return { clean, traceFlags: ['non_finite_interpolated'] };
}

function candidate(
  smoothed: readonly number[],
  peakIdx: number,
  traceFlags: readonly string[],
  params: SegmentParams,
): Candidate {
  const peakOmega = smoothed[peakIdx];
  const flags = new Set(traceFlags);
  let start = peakIdx;
  const lowThreshold = params.lowRatio * peakOmega;
  while (start > 0 && smoothed[start] > lowThreshold) start--;
  if (start === 0 && smoothed[start] > lowThreshold) flags.add('truncated_at_window_edge');

  let end = peakIdx;
  const stopThreshold = params.stopRatio * peakOmega;
  const last = smoothed.length - 1;
  while (end < last && smoothed[end] > stopThreshold) end++;
  if (end === last && smoothed[end] > stopThreshold) flags.add('truncated_at_window_edge');

  return { startIdx: start, endIdx: end, peakOmega, flags };
}

function mergeOverlapping(candidates: readonly Candidate[]): Candidate[] {
  const merged: Candidate[] = [];
  for (const item of candidates) {
    const prior = merged[merged.length - 1];
    if (prior === undefined || item.startIdx > prior.endIdx) {
      merged.push({ startIdx: item.startIdx, endIdx: item.endIdx, peakOmega: item.peakOmega, flags: new Set(item.flags) });
      continue;
    }

    prior.endIdx = Math.max(prior.endIdx, item.endIdx);
    for (const flag of item.flags) prior.flags.add(flag);
    prior.flags.add('merged_adjacent_peaks');
    if (item.peakOmega > prior.peakOmega) prior.peakOmega = item.peakOmega;
  }
  return merged;
}

function result(segments: readonly Segment[], traceFlags: readonly string[]): SegmentResult {
  const uniqueTraceFlags = [...new Set(traceFlags)];
  assertKnownFlags(uniqueTraceFlags);
  return { segments, traceFlags: uniqueTraceFlags };
}

function validateParams(params: SegmentParams): void {
  if (!Number.isInteger(params.sgWindow) || params.sgWindow <= 0 || params.sgWindow % 2 === 0) {
    throw new Error('sgWindow must be a positive odd integer');
  }
  if (!Number.isInteger(params.sgPoly) || params.sgPoly < 0 || params.sgPoly >= params.sgWindow) {
    throw new Error('sgPoly must be a non-negative integer less than sgWindow');
  }
  finiteNonNegative(params.peakSigmaK, 'peakSigmaK');
  finitePositive(params.peakFloorDegPerSec, 'peakFloorDegPerSec');
  ratio(params.lowRatio, 'lowRatio');
  ratio(params.stopRatio, 'stopRatio');
  if (params.lowRatio > params.stopRatio) throw new Error('lowRatio must be less than or equal to stopRatio');
  if (!params.version.trim()) throw new Error('version must be a non-empty string');
  if (params.sgWindow !== SG_SEG_V2.window || params.sgPoly !== SG_SEG_V2.poly) {
    throw new Error('segmentSubmovements currently supports the frozen SG_SEG_V2 coefficients only');
  }
}

function finiteNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a finite non-negative number`);
}

function finitePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive finite number`);
}

function ratio(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error(`${name} must be a finite ratio in [0, 1)`);
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function populationStd(values: readonly number[]): number {
  const center = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - center) ** 2, 0) / values.length);
}

function assertKnownFlags(flags: readonly string[]): void {
  for (const flag of flags) {
    if (!isKnownSegmentFlag(flag)) throw new Error(`segmentSubmovements emitted an unknown flag: ${flag}`);
  }
}
