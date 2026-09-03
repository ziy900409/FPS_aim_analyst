/**
 * KI-022 regression — the analysis runner's console summary must describe an *eligible* run.
 *
 * P03's 2026-09-03 re-run had two conditions whose first attempt was blocked
 * (`protocol-violation`) and whose retry was eligible. The summary read `condition.runs[0]` and so
 * printed `p0=- p1=-` for both, while the evidence JSON it wrote in the same pass carried a full
 * metric set for the retry. The artifacts of record were never wrong — the human-facing summary
 * that a Gate A conclusion is read off was, and only in the normal operator flow
 * (block → Retry block → Continue).
 */
import { describe, expect, it } from 'vitest';
import { selectSummaryRun } from '../../scripts/trackingPilotSummary.ts';
import type { TrackingPilotRunEvidence } from '../../src/pilot/trackingPilotEvidence.ts';

const blocked: TrackingPilotRunEvidence = {
  runId: 'tracking_core_pr_pilot_v1_2deg_5dps@2026-09-03T11:33:16.541Z',
  seed: 54010,
  quality: { status: 'blocked', reasons: ['protocol-violation'] },
};

const eligible: TrackingPilotRunEvidence = {
  runId: 'tracking_core_pr_pilot_v1_2deg_5dps@2026-09-03T11:33:53.445Z',
  seed: 54010,
  quality: { status: 'eligible', validScoredTicks: 3203, durationMs: 25015.625 },
  p0: {
    targetId: 't0',
    tVisibleMs: 279300.965,
    windowEndMs: null,
    presentationTickCount: 3203,
    acquisitionFailure: false,
    tFirstOnTargetMs: 279300.965,
    tAcquireMs: 0,
    trackingWindowTickCount: 3203,
    onTargetTickCount: 1107,
    totPercent: 34.56134873556041,
    rmsEpsilonDeg: 0.873945014496626,
    medianEpsilonDeg: 0.6512576032607303,
    p95EpsilonDeg: 1.5990482012945788,
  },
};

describe('selectSummaryRun (KI-022)', () => {
  it('describes the eligible retry, not the blocked first attempt', () => {
    const chosen = selectSummaryRun([blocked, eligible]);
    expect(chosen?.runId).toBe(eligible.runId);
    expect(chosen?.p0?.rmsEpsilonDeg).toBeCloseTo(0.873945, 6);
  });

  it('keeps describing the first run when every attempt is blocked', () => {
    // A condition with no eligible run must still report *something* traceable — the summary's job
    // is to show what happened, and "all attempts blocked" is a finding, not an empty line.
    const chosen = selectSummaryRun([blocked]);
    expect(chosen?.runId).toBe(blocked.runId);
    expect(chosen?.p0).toBeUndefined();
  });

  it('returns undefined for a condition with no runs', () => {
    expect(selectSummaryRun([])).toBeUndefined();
  });
});
