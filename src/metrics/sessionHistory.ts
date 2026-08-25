import { checkCompatibility, type CompatibilityKey } from './compatibilityKey.ts';
import type { DiagnosisResult } from './diagnosisRules.ts';

export interface SessionMetric {
  readonly id: string;
  readonly value: number;
}

/** A previously evaluated Assessment session that may participate in a personal baseline. */
export interface SessionSummary {
  readonly compatibilityKey: CompatibilityKey;
  readonly sessionId: string;
  readonly startedAt: string;
  readonly diagnosis: DiagnosisResult;
  readonly speedMetric: SessionMetric;
  readonly accuracyMetric: SessionMetric;
}

export type SessionHistoryResult =
  | {
      readonly status: 'ok';
      /** Compatible recent sessions, ordered from oldest to newest for presentation. */
      readonly eligible: readonly SessionSummary[];
      readonly medianSpeed: number;
      readonly medianAccuracy: number;
      /** Population standard deviation across the eligible fixed window. */
      readonly variabilitySpeed: number;
      readonly variabilityAccuracy: number;
    }
  | { readonly status: 'insufficient-data'; readonly reason: string };

/**
 * Builds a fixed recent-window baseline from prior Assessment sessions. The current session is
 * used only as the compatibility reference; it is intentionally not included in its own baseline.
 */
export function buildSessionHistory(
  current: SessionSummary,
  past: readonly SessionSummary[],
  windowSize: number,
  minN: number,
): SessionHistoryResult {
  requirePositiveInteger(windowSize, 'windowSize');
  requirePositiveInteger(minN, 'minN');

  if (current.compatibilityKey.qualityGateStatus !== 'ok') {
    return { status: 'insufficient-data', reason: `current quality gate status: ${current.compatibilityKey.qualityGateStatus}` };
  }

  const eligible = past
    .filter((session) => checkCompatibility(current.compatibilityKey, session.compatibilityKey))
    .filter((session) => session.speedMetric.id === current.speedMetric.id)
    .filter((session) => session.accuracyMetric.id === current.accuracyMetric.id)
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
    .slice(0, windowSize)
    .reverse();

  if (eligible.length < minN) {
    return {
      status: 'insufficient-data',
      reason: `compatible history n=${eligible.length} is below minN=${minN}`,
    };
  }

  const speeds = eligible.map((session) => session.speedMetric.value);
  const accuracies = eligible.map((session) => session.accuracyMetric.value);
  return {
    status: 'ok',
    eligible,
    medianSpeed: median(speeds),
    medianAccuracy: median(accuracies),
    variabilitySpeed: populationStandardDeviation(speeds),
    variabilityAccuracy: populationStandardDeviation(accuracies),
  };
}

function median(values: readonly number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function populationStandardDeviation(values: readonly number[]): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

function requirePositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
}
