import type { TrackingSample } from './trackingDerivation.ts';

export interface TrackingTransitions {
  targetId: string;
  /** on-target → off-target count after the first acquisition in this presentation. */
  dropCount: number;
  /** Drop-to-reacquisition intervals in ms; terminal unrecovered drops are deliberately excluded. */
  reacquireMs: number[];
}

/**
 * Aggregate transition timing from the canonical tracking samples. Geometry and sampling stay owned
 * by trackingDerivation; this function only scans its onTarget state changes.
 */
export function deriveTrackingTransitions(
  samples: readonly TrackingSample[],
  targetId = '',
): TrackingTransitions {
  const firstOnTarget = samples.findIndex((sample) => sample.onTarget);
  if (firstOnTarget < 0) return { targetId, dropCount: 0, reacquireMs: [] };

  let dropCount = 0;
  let droppedAtMs: number | undefined;
  const reacquireMs: number[] = [];

  for (let index = firstOnTarget + 1; index < samples.length; index++) {
    const previous = samples[index - 1];
    const current = samples[index];
    if (previous.onTarget && !current.onTarget) {
      dropCount++;
      droppedAtMs = current.t;
    } else if (!previous.onTarget && current.onTarget && droppedAtMs !== undefined) {
      reacquireMs.push(current.t - droppedAtMs);
      droppedAtMs = undefined;
    }
  }

  return { targetId, dropCount, reacquireMs };
}
