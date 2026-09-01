import { describe, expect, it } from 'vitest';
import type { PeekClickTransferPresentation } from '../metrics/peekClickTransferMetrics.ts';
import { buildPeekClickTransferPilotEvidenceReport } from './peekClickTransferPilotEvidence.ts';

/**
 * WP-52 / T3 — synthetic presentation fixture covering the four scenarios FM-52-3 cares about:
 * a spawn-anchored timeout, a first-miss-then-second-hit refire, a pre-onset fire, and a
 * no-counter (wrong-direction strafe) presentation — plus one clean valid-first-shot hit so every
 * report field has a non-degenerate value to assert on.
 */
const SYNTHETIC_PRESENTATIONS: readonly PeekClickTransferPresentation[] = [
  { targetId: 't0', side: 'L', firstShotHit: false, validFirstShot: false, flags: ['timeout'] },
  { targetId: 't1', side: 'R', firstShotHit: false, validFirstShot: false, shotsToKill: 2, flags: [] },
  {
    targetId: 't2',
    side: 'L',
    firstShotHit: false,
    validFirstShot: false,
    flags: ['fire_before_measurement_onset'],
  },
  { targetId: 't3', side: 'R', firstShotHit: true, validFirstShot: false, flags: ['no_counter'] },
  { targetId: 't4', side: 'L', firstShotHit: true, validFirstShot: true, shotsToKill: 1, flags: [] },
];

describe('buildPeekClickTransferPilotEvidenceReport (WP-52 T3)', () => {
  it('derives completion/timeout/valid-first-shot rates, L/R balance, and flag counts from presentations', () => {
    const report = buildPeekClickTransferPilotEvidenceReport([{ presentations: SYNTHETIC_PRESENTATIONS }]);

    expect(report.presentationCount).toBe(5);
    expect(report.timeoutRate).toBeCloseTo(1 / 5, 12);
    expect(report.completionRate).toBeCloseTo(4 / 5, 12);
    expect(report.validFirstShotRate).toBeCloseTo(1 / 5, 12);
    expect(report.leftRightBalance).toEqual({ left: 3, right: 2 });
    expect(report.flagCounts).toEqual({
      timeout: 1,
      fire_before_measurement_onset: 1,
      no_counter: 1,
    });
  });

  it('aggregates across multiple sessions without double-counting or dropping presentations', () => {
    const report = buildPeekClickTransferPilotEvidenceReport([
      { presentations: SYNTHETIC_PRESENTATIONS.slice(0, 2) },
      { presentations: SYNTHETIC_PRESENTATIONS.slice(2) },
    ]);

    expect(report.presentationCount).toBe(5);
    expect(report.flagCounts).toEqual({
      timeout: 1,
      fire_before_measurement_onset: 1,
      no_counter: 1,
    });
  });

  it('returns zero rates and empty flag counts for an empty pilot sample rather than dividing by zero', () => {
    const report = buildPeekClickTransferPilotEvidenceReport([]);

    expect(report).toEqual({
      presentationCount: 0,
      completionRate: 0,
      timeoutRate: 0,
      validFirstShotRate: 0,
      leftRightBalance: { left: 0, right: 0 },
      flagCounts: {},
    });
  });
});
