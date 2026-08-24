import type { ExportPayload } from '../data/export.ts';
import { CS2_PROFILE } from '../sim/MovementController.ts';
import { stat, type Stat } from './compute.ts';
import { deriveBrakingSamples } from './brakingDerivation.ts';
import { buildPeekWindows } from './peekWindows.ts';
import { computeSyncMetrics } from './researchMetrics.ts';

export interface SidedStat {
  readonly left: Stat;
  readonly right: Stat;
  readonly diff: number;
}

export interface CounterstrafeMetrics {
  readonly cueToKeyMs?: SidedStat;
  readonly releaseToFireMs: SidedStat;
  readonly counterHoldMs: SidedStat;
  readonly counterToFireMs: SidedStat;
  readonly timeToAccuracyGateMs: SidedStat;
  readonly zeroCrossingMs: SidedStat;
  readonly stopDistanceU: SidedStat;
  readonly overReversalUPerS: SidedStat;
  readonly fireBeforeGateRate: number;
  readonly firstShotHitRate: number;
}

/** Assemble protocol-neutral counter-strafe measurements without a composite score. */
export function deriveCounterstrafeMetrics(payload: ExportPayload): CounterstrafeMetrics {
  const peeks = buildPeekWindows(payload);
  const syncRows = computeSyncMetrics(payload).rows;
  const brakingSamples = deriveBrakingSamples(payload);
  const brakingByPeek = new Map(brakingSamples.map((sample) => [sample.peekIndex, sample]));
  const hasCue = peeks.some((peek) => peek.cues.length > 0);
  const firstFires = peeks.flatMap((peek) => (peek.firstFire === undefined ? [] : [peek.firstFire]));

  return {
    ...(hasCue
      ? {
          cueToKeyMs: sidedStat(
            peeks.map((peek) => ({
              side: peek.side,
              value: peek.tCounter !== undefined && peek.cues[0] !== undefined ? peek.tCounter - peek.cues[0].t : undefined,
            })),
          ),
        }
      : {}),
    releaseToFireMs: sidedStat(syncRows.map((row) => ({ side: row.side, value: row.releaseToFireMs }))),
    counterHoldMs: sidedStat(syncRows.map((row) => ({ side: row.side, value: row.counterHoldMs }))),
    counterToFireMs: sidedStat(syncRows.map((row) => ({ side: row.side, value: row.counterToFireMs }))),
    timeToAccuracyGateMs: sidedStat(
      peeks.map((peek) => ({ side: peek.side, value: brakingByPeek.get(peek.index)?.timeToAccuracyGateMs })),
    ),
    zeroCrossingMs: sidedStat(
      peeks.map((peek) => ({ side: peek.side, value: brakingByPeek.get(peek.index)?.zeroCrossingMs })),
    ),
    stopDistanceU: sidedStat(
      peeks.map((peek) => ({ side: peek.side, value: brakingByPeek.get(peek.index)?.stopDistanceU })),
    ),
    overReversalUPerS: sidedStat(
      peeks.map((peek) => ({ side: peek.side, value: brakingByPeek.get(peek.index)?.overReversalUPerS })),
    ),
    fireBeforeGateRate:
      firstFires.length === 0
        ? 0
        : firstFires.filter((fire) => fire.residualSpeed >= CS2_PROFILE.accuracyThreshold).length / firstFires.length,
    firstShotHitRate: peeks.length === 0 ? 0 : peeks.filter((peek) => peek.outcome === 'hit').length / peeks.length,
  };
}

function sidedStat(samples: readonly { readonly side: 'L' | 'R'; readonly value: number | undefined }[]): SidedStat {
  const left = stat(samples.filter((sample) => sample.side === 'L').map((sample) => sample.value).filter(isFiniteNumber));
  const right = stat(samples.filter((sample) => sample.side === 'R').map((sample) => sample.value).filter(isFiniteNumber));
  return { left, right, diff: left.n > 0 && right.n > 0 ? Math.abs(left.mean - right.mean) : 0 };
}

function isFiniteNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value);
}
