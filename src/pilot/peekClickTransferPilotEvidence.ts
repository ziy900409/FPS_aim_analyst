import type { PeekClickTransferMetrics, PeekClickTransferPresentation } from '../metrics/peekClickTransferMetrics.ts';

/**
 * WP-52 / T3 — aggregates one or more derived `PeekClickTransferMetrics` results (pilot v2 sessions)
 * into the evidence summary the manual pilot gate (T4) and WP-53 go/no-go decision read. Pure
 * aggregation only; never derives a composite score and never touches I/O (C-D2/C-D3).
 */
export interface PeekClickTransferPilotEvidenceReport {
  readonly presentationCount: number;
  readonly completionRate: number;
  readonly timeoutRate: number;
  readonly validFirstShotRate: number;
  readonly leftRightBalance: { readonly left: number; readonly right: number };
  readonly flagCounts: Readonly<Record<string, number>>;
}

export function buildPeekClickTransferPilotEvidenceReport(
  metrics: readonly PeekClickTransferMetrics[],
): PeekClickTransferPilotEvidenceReport {
  const presentations = metrics.flatMap((m) => m.presentations);
  const presentationCount = presentations.length;
  const timeoutCount = countByFlag(presentations, 'timeout');
  const validFirstShotCount = presentations.filter((presentation) => presentation.validFirstShot).length;
  const left = presentations.filter((presentation) => presentation.side === 'L').length;
  const right = presentations.filter((presentation) => presentation.side === 'R').length;

  return {
    presentationCount,
    completionRate: rate(presentationCount - timeoutCount, presentationCount),
    timeoutRate: rate(timeoutCount, presentationCount),
    validFirstShotRate: rate(validFirstShotCount, presentationCount),
    leftRightBalance: { left, right },
    flagCounts: countFlags(presentations),
  };
}

function rate(count: number, total: number): number {
  return total > 0 ? count / total : 0;
}

function countByFlag(presentations: readonly PeekClickTransferPresentation[], flag: string): number {
  return presentations.filter((presentation) => presentation.flags.includes(flag)).length;
}

function countFlags(presentations: readonly PeekClickTransferPresentation[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const presentation of presentations) {
    for (const flag of presentation.flags) counts[flag] = (counts[flag] ?? 0) + 1;
  }
  return counts;
}
