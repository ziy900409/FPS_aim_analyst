import type { PeekClickTransferPresentation } from '../metrics/peekClickTransferMetrics.ts';

/**
 * WP-52 / T3-T5 — aggregates one or more derived `PeekClickTransferMetrics` results (pilot v2
 * sessions) into the evidence summary the manual pilot gate (T4) and WP-53 go/no-go decision read.
 * Pure aggregation only; never derives a composite score and never touches I/O (C-D2/C-D3).
 */
export interface PeekClickTransferPilotEvidenceBreakdown {
  readonly presentationCount: number;
  readonly completionRate: number;
  readonly timeoutRate: number;
  readonly validFirstShotRate: number;
  readonly leftRightBalance: { readonly left: number; readonly right: number };
  readonly flagCounts: Readonly<Record<string, number>>;
}

export interface PeekClickTransferPilotEvidenceReport extends PeekClickTransferPilotEvidenceBreakdown {
  /**
   * WP-52 T5: per-candidate breakdown, keyed by `candidateLabelForWidth(hitboxWidthU)` (or the raw
   * width when omitted). Empty when no presentation carries `hitboxWidthU` — i.e. every session used
   * a single fixed-hitbox drill, not `hitboxCandidates`.
   */
  readonly byCandidate: Readonly<Record<string, PeekClickTransferPilotEvidenceBreakdown>>;
}

export interface PeekClickTransferPilotEvidenceOptions {
  readonly candidateLabelForWidth?: (hitboxWidthU: number) => string;
}

export function buildPeekClickTransferPilotEvidenceReport(
  sessions: readonly { readonly presentations: readonly PeekClickTransferPresentation[] }[],
  options: PeekClickTransferPilotEvidenceOptions = {},
): PeekClickTransferPilotEvidenceReport {
  const presentations = sessions.flatMap((session) => session.presentations);

  const groups = new Map<string, PeekClickTransferPresentation[]>();
  for (const presentation of presentations) {
    if (presentation.hitboxWidthU === undefined) continue;
    const label = options.candidateLabelForWidth?.(presentation.hitboxWidthU) ?? String(presentation.hitboxWidthU);
    const group = groups.get(label);
    if (group !== undefined) group.push(presentation);
    else groups.set(label, [presentation]);
  }
  const byCandidate: Record<string, PeekClickTransferPilotEvidenceBreakdown> = {};
  for (const [label, group] of groups) byCandidate[label] = summarize(group);

  return { ...summarize(presentations), byCandidate };
}

function summarize(presentations: readonly PeekClickTransferPresentation[]): PeekClickTransferPilotEvidenceBreakdown {
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
