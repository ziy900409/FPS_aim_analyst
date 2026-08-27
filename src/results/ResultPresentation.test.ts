import { describe, expect, it } from 'vitest';
import type { Metrics } from '../metrics/compute.ts';
import type { ExportPayload } from '../data/export.ts';
import { makeAssessmentPayload } from '../../tests/history/payloadFixtures.ts';
import {
  buildResultPresentation,
  createResultSummary,
  diagnosisForPayload,
  exportBasename,
  qualityFlagsForPayload,
  snapshotFromExportPayload,
  summarizeResidualSpeed,
} from './ResultPresentation.ts';

const metrics: Metrics = {
  counterReactionMs: { mean: 63.33, p50: 60, sd: 12.47, n: 3, values: [50, 80, 60] },
  residualSpeed: { mean: 62.5, p50: 0, sd: 108.25, n: 4, values: [0, 250, 0, 0] },
  fireTimingAlignmentMs: { mean: 13.33, p50: 10, sd: 4.71, n: 3, values: [20, 10, 10] },
  firstShotHitRate: 66.666,
  crosshairOffset: { mean: 1.125, p50: 1.25, sd: 0.74, n: 4, values: [0, 2, 1.5, 1] },
  recoilCompensationError: { meanDeg: 0.42, rmsDeg: 0.55 },
  recoilCompensationPath: {
    actual: [
      { pitchDeg: 0, yawDeg: 0 },
      { pitchDeg: -0.8, yawDeg: 0.4 },
      { pitchDeg: -1.7, yawDeg: -0.6 },
    ],
    ideal: [
      { pitchDeg: 0, yawDeg: 0 },
      { pitchDeg: -1, yawDeg: 0.5 },
      { pitchDeg: -2, yawDeg: -1 },
    ],
  },
  switchTimeMs: { mean: 110, p50: 110, sd: 20, n: 2, values: [130, 90] },
  rhythmStability: 0.0834,
  leftRightSymmetry: {
    left: { mean: 80, p50: 80, sd: 0, n: 1, values: [80] },
    right: { mean: 55, p50: 55, sd: 5, n: 2, values: [50, 60] },
    diff: 25,
  },
};

describe('createResultSummary', () => {
  it('maps the eight WP-8 metrics to result cards and reaction distribution values', () => {
    const summary = createResultSummary(metrics);

    expect(summary.cards.map((card) => card.id)).toEqual([
      'counterReactionMs',
      'residualSpeed',
      'fireTimingAlignmentMs',
      'firstShotHitRate',
      'crosshairOffset',
      'switchTimeMs',
      'rhythmStability',
      'leftRightSymmetry',
    ]);
    expect(summary.reactionValues).toEqual([50, 80, 60]);
    expect(summary.recoilCompensation).toEqual({
      error: { meanDeg: 0.42, rmsDeg: 0.55 },
      path: metrics.recoilCompensationPath,
    });
    expect(summary.cards.find((card) => card.id === 'residualSpeed')?.value).toBe('62.5 u/s');
    expect(summary.cards.find((card) => card.id === 'firstShotHitRate')?.value).toBe('66.7%');
    expect(summary.methodNote).toContain('Subject-relative');
  });

  it('keeps empty samples display-safe', () => {
    const empty = createResultSummary({
      ...metrics,
      counterReactionMs: { mean: 0, p50: 0, sd: 0, n: 0, values: [] },
      residualSpeed: { mean: 0, p50: 0, sd: 0, n: 0, values: [] },
    });

    expect(empty.cards.find((card) => card.id === 'counterReactionMs')?.value).toBe('N/A');
    expect(empty.cards.find((card) => card.id === 'residualSpeed')?.value).toBe('N/A');
  });
});

describe('summarizeResidualSpeed', () => {
  it('keeps the velocity gate as detail derived from continuous u/s samples', () => {
    expect(summarizeResidualSpeed(metrics.residualSpeed)).toMatchObject({
      detail: 'p50 0.0 u/s · SD 108.3 u/s · n=4 · 3/4 under 88 u/s gate',
      withinGate: 3,
      overGate: 1,
    });
  });
});

describe('exportBasename', () => {
  it('includes the drill id and startedAt with no protocol condition', () => {
    const payload = makeAssessmentPayload({ drillId: 'spider-shot-v2', startedAt: '2026-01-02T03:04:05.000Z' });
    expect(exportBasename(payload)).toBe('spider-shot-v2-2026-01-02T03:04:05.000Z');
  });

  it('includes protocol condition index and label when present', () => {
    const payload: ExportPayload = {
      ...makeAssessmentPayload({ drillId: 'd', startedAt: '2026-01-01T00:00:00.000Z' }),
    };
    const withProtocol: ExportPayload = {
      ...payload,
      meta: { ...payload.meta, protocol: { protocolId: 'p', conditionIndex: 2, conditionLabel: 'high-dpi' } },
    };
    expect(exportBasename(withProtocol)).toBe('d-3-high-dpi-2026-01-01T00:00:00.000Z');
  });
});

describe('snapshotFromExportPayload', () => {
  it('projects ticks/events/recorderOverflow off the payload', () => {
    const payload = makeAssessmentPayload();
    expect(snapshotFromExportPayload(payload)).toEqual({
      ticks: payload.ticks,
      events: payload.events,
      recorderOverflow: payload.meta.recorderOverflow,
    });
  });
});

describe('qualityFlagsForPayload', () => {
  it('maps meta fields verbatim and omits validity when absent', () => {
    const payload = makeAssessmentPayload({ suspect: true });
    expect(qualityFlagsForPayload(payload)).toEqual({
      lateEventCount: 0,
      bufferOverflow: false,
      recorderOverflow: false,
      suspect: true,
    });
  });

  it('carries corridorExceeded/perfFloor through when validity is present', () => {
    const base = makeAssessmentPayload();
    const payload: ExportPayload = {
      ...base,
      meta: { ...base.meta, validity: { corridorExceeded: true, perfFloor: false, recorderOverflow: false, bufferOverflow: false } },
    };
    expect(qualityFlagsForPayload(payload).validity).toEqual({ corridorExceeded: true, perfFloor: false });
  });
});

describe('diagnosisForPayload', () => {
  it('returns insufficient-data (not a throw) for a drill with no registered diagnosis mapping', () => {
    const payload = makeAssessmentPayload({ drillId: 'spider-shot-v2' });
    expect(diagnosisForPayload(payload).status).toBe('insufficient-data');
  });
});

describe('buildResultPresentation', () => {
  it('assembles summary/promoted/diagnosis/qualityFlags from a single payload without throwing', () => {
    const payload = makeAssessmentPayload({ drillId: 'counterstrafe_reversal_v1', suspect: false });
    const result = buildResultPresentation(payload);

    expect(result.summary.cards.length).toBeGreaterThan(0);
    expect(result.promoted).toEqual({
      status: 'blocked',
      reason: 'meta.mouseIntegration is missing; promoted phase metrics require tick-integral omega (KI-005)',
    });
    expect(result.diagnosis?.status).toBe('insufficient-data');
    expect(result.qualityFlags).toEqual({
      lateEventCount: 0,
      bufferOverflow: false,
      recorderOverflow: false,
      suspect: false,
    });
  });

  it('produces the same qualityFlags/diagnosis for two independently-built payloads with identical meta (current/historical parity)', () => {
    const a = makeAssessmentPayload({ participantId: 'P-1', drillId: 'd', startedAt: '2026-01-01T00:00:00.000Z' });
    const b = makeAssessmentPayload({ participantId: 'P-1', drillId: 'd', startedAt: '2026-01-01T00:00:00.000Z' });

    expect(buildResultPresentation(a)).toEqual(buildResultPresentation(b));
  });
});
