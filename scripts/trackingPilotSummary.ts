/**
 * WP-54 / T6 — which run of a condition the analysis runner's console summary describes.
 *
 * Split out of `analyze-tracking-pilot.ts` so the choice is testable: the script itself runs
 * `main()` on import and takes a directory of participant exports, neither of which a unit test
 * can supply.
 */
import type { TrackingPilotRunEvidence } from '../src/pilot/trackingPilotEvidence.ts';

/**
 * The run whose P0/P1 the console summary prints for a condition.
 *
 * KI-022: a retried block keeps its blocked first attempt in the evidence (append-only,
 * FR-54-10), so `runs[0]` describes the attempt that by contract carries no metrics. Prefer the
 * first eligible run; fall back to the first run so a condition whose every attempt was blocked
 * still prints a traceable run id rather than an empty line.
 */
export function selectSummaryRun(
  runs: readonly TrackingPilotRunEvidence[],
): TrackingPilotRunEvidence | undefined {
  return runs.find((run) => run.quality.status === 'eligible') ?? runs[0];
}
