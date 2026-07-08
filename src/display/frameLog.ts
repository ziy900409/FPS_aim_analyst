import { MAX_DISPLAY_HZ, PERF_FLOOR_MS } from './constants.ts';

export interface FrameLogSummary {
  count: number;
  p50: number;
  p95: number;
  p99: number;
  overBudgetWindows: number;
  overflow: boolean;
}

export interface FrameLogExport {
  series: number[];
  summary: FrameLogSummary;
}

export interface FrameLogRefreshEstimate {
  refreshEstimateHz: number;
  medianDeltaMs: number;
}

export interface FrameLog {
  readonly capacity: number;
  readonly count: number;
  readonly overflow: boolean;
  readonly frozen: boolean;
  push(tMs: number): boolean;
  reset(): void;
  freeze(): void;
  series(): number[];
  summary(budgetMs?: number): FrameLogSummary;
  export(budgetMs?: number): FrameLogExport;
  refreshEstimate(): FrameLogRefreshEstimate | null;
}

export interface FrameLogSink {
  push(tMs: number): void;
}

export function frameLogCapacity(maxDrillSeconds: number, maxDisplayHz = MAX_DISPLAY_HZ): number {
  if (!Number.isFinite(maxDrillSeconds) || maxDrillSeconds <= 0) {
    throw new Error('maxDrillSeconds must be a positive finite number');
  }
  if (!Number.isFinite(maxDisplayHz) || maxDisplayHz <= 0) {
    throw new Error('maxDisplayHz must be a positive finite number');
  }
  return Math.ceil(maxDrillSeconds * maxDisplayHz);
}

export function createFrameLog(capacity: number): FrameLog {
  if (!Number.isInteger(capacity) || capacity <= 0) throw new Error('capacity must be a positive integer');

  const deltas = new Float64Array(capacity);
  let count = 0;
  let overflow = false;
  let frozen = false;
  let lastTimestamp: number | null = null;

  function sortedSeries(): number[] {
    const values = new Array<number>(count);
    for (let i = 0; i < count; i++) values[i] = deltas[i];
    values.sort((a, b) => a - b);
    return values;
  }

  return {
    capacity,
    get count(): number {
      return count;
    },
    get overflow(): boolean {
      return overflow;
    },
    get frozen(): boolean {
      return frozen;
    },
    push(tMs: number): boolean {
      if (frozen) return false;
      if (!Number.isFinite(tMs)) return false;

      if (lastTimestamp === null) {
        lastTimestamp = tMs;
        return true;
      }

      const delta = tMs - lastTimestamp;
      lastTimestamp = tMs;
      if (!Number.isFinite(delta) || delta <= 0) return false;

      if (count >= capacity) {
        overflow = true;
        frozen = true;
        return false;
      }

      deltas[count] = delta;
      count++;
      return true;
    },
    reset(): void {
      count = 0;
      overflow = false;
      frozen = false;
      lastTimestamp = null;
    },
    freeze(): void {
      frozen = true;
    },
    series(): number[] {
      const values = new Array<number>(count);
      for (let i = 0; i < count; i++) values[i] = deltas[i];
      return values;
    },
    summary(budgetMs = PERF_FLOOR_MS): FrameLogSummary {
      if (!Number.isFinite(budgetMs) || budgetMs <= 0) {
        throw new Error('budgetMs must be a positive finite number');
      }
      if (count === 0) {
        return { count: 0, p50: 0, p95: 0, p99: 0, overBudgetWindows: 0, overflow };
      }

      let overBudgetWindows = 0;
      for (let i = 0; i < count; i++) {
        if (deltas[i] > budgetMs) overBudgetWindows++;
      }

      const sorted = sortedSeries();
      return {
        count,
        p50: median(sorted),
        p95: nearestRank(sorted, 0.95),
        p99: nearestRank(sorted, 0.99),
        overBudgetWindows,
        overflow,
      };
    },
    export(budgetMs = PERF_FLOOR_MS): FrameLogExport {
      return {
        series: this.series(),
        summary: this.summary(budgetMs),
      };
    },
    refreshEstimate(): FrameLogRefreshEstimate | null {
      if (count === 0) return null;
      const medianDeltaMs = median(sortedSeries());
      return {
        refreshEstimateHz: Math.round(1000 / medianDeltaMs),
        medianDeltaMs,
      };
    },
  };
}

function median(sorted: readonly number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function nearestRank(sorted: readonly number[], percentile: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * percentile) - 1));
  return sorted[index];
}
