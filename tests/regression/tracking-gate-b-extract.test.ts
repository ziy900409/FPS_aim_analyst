/**
 * WP-54 / T7 — the glue that turns exports into Gate B run records.
 *
 * The criteria themselves are pinned by `tracking-gate-b-aggregates.test.ts`; what needs guarding
 * here is the reading of the payload: which seed family a run belongs to (§2.5 A-1 hinges on it),
 * which cell family it is (B-3a's 2×2 hinges on it), and the angular size the 2×2 is indexed by.
 * Expectations are derived from the shipped configs rather than written as literals, so a future
 * candidate-value revise cannot make this file fail spuriously (the lesson of T7 slice 6).
 */
import { describe, expect, it } from 'vitest';
import { extractTrackingGateBRuns } from '../../scripts/trackingGateBExtract.ts';
import {
  CORE_PR_PILOT_V1_SIZE_CANDIDATES_DEG,
  TRACKING_CORE_PR_PILOT_V1_CANDIDATES,
  trackingCorePrPilotV1CalibrationHorizontal,
  trackingCorePrPilotV1Practice,
} from '../../src/drill/tracking_core_pr_pilot_v1.ts';
import { TRACKING_REVERSAL_PILOT_V1_CANDIDATES } from '../../src/drill/tracking_reversal_pilot_v1.ts';
import { makePayload } from '../replay/fixtures.ts';
import type { DrillConfig } from '../../src/drill/types.ts';

/** A payload carrying only what the extractor reads — no ticks, so every derivation reports its
 * own "cannot compute" status and the optional fields stay absent. That is the point: the
 * classification and session fields must be right even for a run with nothing to measure. */
function payloadFor(config: DrillConfig, sessionIndex: 0 | 1, participantId = 'P01') {
  return makePayload({
    meta: {
      drillId: config.drillId,
      startedAt: `2026-09-05T00:0${sessionIndex}:00.000Z`,
      session: {
        participantId,
        sessionLabel: `tracking-pilot-v1:${participantId}:session-${sessionIndex}`,
      },
      ...(config.targets?.hitbox !== undefined ? { targets: { hitbox: config.targets.hitbox } } : {}),
    },
    ticks: [],
  });
}

const coreFirst = TRACKING_CORE_PR_PILOT_V1_CANDIDATES[0];
const reversalFirst = TRACKING_REVERSAL_PILOT_V1_CANDIDATES[0];

describe('extractTrackingGateBRuns', () => {
  it('classifies each block against the single-source role registry (D-54.23)', () => {
    const { runs, unknownDrillIds } = extractTrackingGateBRuns([
      payloadFor(trackingCorePrPilotV1Practice, 0),
      payloadFor(trackingCorePrPilotV1CalibrationHorizontal, 0),
      payloadFor(coreFirst, 0),
      payloadFor(reversalFirst, 0),
    ]);

    expect(unknownDrillIds).toEqual([]);
    expect(runs.map((run) => run.cellFamily)).toEqual(['practice', 'calibration', 'core', 'reversal']);
  });

  it('reads the seed family from the session label — the only place it survives into an export', () => {
    const { runs } = extractTrackingGateBRuns([payloadFor(coreFirst, 0), payloadFor(coreFirst, 1)]);

    expect(runs.map((run) => run.seedFamily)).toEqual(['A', 'B']);
    expect(runs.every((run) => run.participantId === 'P01')).toBe(true);
  });

  it('treats a payload with no pilot session label as family A rather than guessing', () => {
    // A run exported outside the pilot operator screen has no counterbalance label. Calling it
    // family B would quietly drop it from every criterion (§2.5 A-1); family A keeps it visible.
    const { runs } = extractTrackingGateBRuns([
      makePayload({ meta: { drillId: coreFirst.drillId, session: { participantId: 'P09' } }, ticks: [] }),
    ]);

    expect(runs[0].seedFamily).toBe('A');
  });

  it('recovers the delivered angular size from the hitbox, round-tripping the shipped geometry', () => {
    const { runs } = extractTrackingGateBRuns([payloadFor(coreFirst, 0)]);

    // `coreFirst` is the first core candidate, so its size is the first candidate value — asserted
    // against the constant, never against a literal degree figure.
    expect(runs[0].targetAngularSizeDeg).toBeCloseTo(CORE_PR_PILOT_V1_SIZE_CANDIDATES_DEG[0], 9);
  });

  it('reports a foreign drillId instead of silently dropping or misclassifying it', () => {
    // Exactly what an older generation's block looks like now: `0p5deg_*` left the registry with
    // the G5 size revise, and pooling it with G5 data would be a cross-generation merge.
    const stale = makePayload({
      meta: { drillId: 'tracking_core_pr_pilot_v1_0p5deg_5dps', session: { participantId: 'P05' } },
      ticks: [],
    });

    const { runs, unknownDrillIds } = extractTrackingGateBRuns([stale, payloadFor(coreFirst, 0)]);

    expect(unknownDrillIds).toEqual(['tracking_core_pr_pilot_v1_0p5deg_5dps']);
    expect(runs).toHaveLength(1);
    expect(runs[0].condition).toBe(coreFirst.drillId);
  });

  it('marks a run with nothing measurable as ineligible without inventing values', () => {
    const { runs } = extractTrackingGateBRuns([payloadFor(coreFirst, 0)]);

    expect(runs[0].eligible).toBe(false);
    expect(runs[0].rmsEpsilonDeg).toBeUndefined();
    expect(runs[0].totPercent).toBeUndefined();
    expect(runs[0].frozenCrosshairRatio).toBeUndefined();
    expect(runs[0].timeOnTaskDeltaFraction).toBeUndefined();
  });
});
