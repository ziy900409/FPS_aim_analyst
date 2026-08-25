import { describe, expect, it } from 'vitest';
import type { CounterstrafeMetrics, SidedStat } from './counterstrafeMetrics.ts';
import {
  evaluateDiagnosis,
  type DiagnosisThresholds,
} from './diagnosisRules.ts';
import type { HoldClickMetrics } from './holdClickMetrics.ts';
import type { SpiderShotMetrics } from './spiderShotMetrics.ts';

const thresholds: DiagnosisThresholds = {
  version: 'test-recommendation-v1',
  preAimHighDeg: 2,
  onsetSlowMs: 200,
  acquisitionSlowMs: 300,
  overshootHighDeg: 2,
  firstShotSlowMs: 150,
  totLowPercent: 70,
  residualSpeedHighUPerS: 100,
  fireCommitmentSlowMs: 250,
};

describe('evaluateDiagnosis', () => {
  it.each([
    ['preaim-placement', { holdClick: hold({ preAimDeg: 3 }) }],
    ['visual-motor-onset', { holdClick: hold({ onsetMs: 250 }) }],
    ['flick-control', { holdClick: hold({ acquisitionMs: 350 }), spiderShot: spider({ overshootDeg: 3 }) }],
    ['click-timing', { holdClick: hold({ firstShotMs: 200 }) }],
    ['tracking-maintenance', { holdClick: hold(), holdTrack: { totPercent: 60, dropCount: 2 } }],
    ['counterstrafe-braking', { counterstrafe: counter({ overReversal: 150 }) }],
    ['fire-commitment', { counterstrafe: counter({ counterToFire: 300 }) }],
  ] as const)('returns %s when its complete evidence chain is present', (label, inputs) => {
    const result = evaluateDiagnosis(inputs, thresholds, 'ok');

    expect(result).toMatchObject({ status: 'ok', recommendationVersion: thresholds.version, primary: { label } });
    if (result.status === 'ok') {
      expect(result.primary?.evidence.every((item) => item.n > 0)).toBe(true);
      expect(result.primary?.evidence.every((item) => Number.isFinite(item.value))).toBe(true);
    }
  });

  it('uses framework table order as the deterministic primary-only tie break', () => {
    const result = evaluateDiagnosis(
      { holdClick: hold({ preAimDeg: 3, acquisitionMs: 350, firstShotMs: 200 }), spiderShot: spider({ overshootDeg: 3 }) },
      thresholds,
      'ok',
    );

    expect(result).toMatchObject({ status: 'ok', primary: { label: 'preaim-placement' } });
    expect(result.status === 'ok' && result.secondary).toBeUndefined();
  });

  it('short-circuits non-ok quality gates before evaluating otherwise qualifying values', () => {
    expect(evaluateDiagnosis({ holdClick: hold({ preAimDeg: 3 }) }, thresholds, 'suspect-run')).toEqual({
      status: 'insufficient-data',
      reason: 'quality gate status: suspect-run',
    });
  });

  it('can identify flick-control from Spider Shot alone', () => {
    const result = evaluateDiagnosis(
      { spiderShot: spider({ reactionMs: 100, movementTimeMs: 350, overshootDeg: 3 }) },
      thresholds,
      'ok',
    );

    expect(result).toMatchObject({ status: 'ok', primary: { label: 'flick-control' } });
    expect(result.status === 'ok' && result.primary?.evidence.map((item) => item.metricId)).toEqual([
      'spider-shot.switch-reaction-ms',
      'spider-shot.movement-execution-ms',
      'spider-shot.stop-control-overshoot-deg',
    ]);
  });

  it('keeps source flags and aggregates every valid presentation instead of selecting a best value', () => {
    const result = evaluateDiagnosis(
      {
        holdClick: {
          anticipationRate: 0,
          presentations: [
            presentation({ preAimDeg: 4, flags: ['no_first_shot'] }),
            presentation({ preAimDeg: 2, flags: ['no_acquisition'] }),
          ],
        },
      },
      thresholds,
      'ok',
    );

    expect(result).toMatchObject({ status: 'ok', primary: { label: 'preaim-placement' } });
    expect(result.status === 'ok' && result.primary?.evidence[0]).toEqual({
      metricId: 'hold-click.pre-aim-eccentricity-deg',
      value: 3,
      n: 2,
      flags: ['no_first_shot', 'no_acquisition'],
    });
  });

  it('does not classify a strict high threshold at its boundary value', () => {
    const result = evaluateDiagnosis({ holdClick: hold({ preAimDeg: thresholds.preAimHighDeg }) }, thresholds, 'ok');

    expect(result).toEqual({ status: 'ok', recommendationVersion: thresholds.version });
  });
});

function hold({
  preAimDeg = 1,
  onsetMs = 100,
  acquisitionMs = 100,
  firstShotMs = 100,
}: {
  readonly preAimDeg?: number;
  readonly onsetMs?: number;
  readonly acquisitionMs?: number;
  readonly firstShotMs?: number;
} = {}): HoldClickMetrics {
  return { anticipationRate: 0, presentations: [presentation({ preAimDeg, onsetMs, acquisitionMs, firstShotMs })] };
}

function presentation({
  preAimDeg = 1,
  onsetMs = 100,
  acquisitionMs = 100,
  firstShotMs = 100,
  flags = [],
}: {
  readonly preAimDeg?: number;
  readonly onsetMs?: number;
  readonly acquisitionMs?: number;
  readonly firstShotMs?: number;
  readonly flags?: readonly string[];
}) {
  return {
    targetId: 'target-1',
    tVisibleMs: 0,
    preAim: { tMs: 0, eccentricityDeg: preAimDeg, yawErrorDeg: 0, pitchErrorDeg: 0 },
    detectionLatencyFromOnsetMs: onsetMs,
    acquisitionFromDetectMs: acquisitionMs,
    firstShotAfterOnTargetMs: firstShotMs,
    anticipation: false,
    fireBeforeFirstVisible: false,
    fireBeforeMeasurementOnset: false,
    flags,
  };
}

function spider({ reactionMs = 100, movementTimeMs = 100, overshootDeg = 1 }: { readonly reactionMs?: number; readonly movementTimeMs?: number; readonly overshootDeg?: number } = {}): SpiderShotMetrics {
  return {
    switchReaction: [{ targetId: 'target-1', reactionMs }],
    movementExecution: [{ targetId: 'target-1', movementTimeMs }],
    stopControl: [{ targetId: 'target-1', overshootDeg }],
    firstShot: [],
    rhythm: { transitionIntervalMs: [], medianMs: 0, p95Ms: 0 },
  };
}

function counter({ overReversal = 50, counterToFire = 100, accuracyGate = 100 }: { readonly overReversal?: number; readonly counterToFire?: number; readonly accuracyGate?: number } = {}): CounterstrafeMetrics {
  return {
    releaseToFireMs: sided(0),
    counterHoldMs: sided(0),
    counterToFireMs: sided(counterToFire),
    timeToAccuracyGateMs: sided(accuracyGate),
    zeroCrossingMs: sided(0),
    stopDistanceU: sided(0),
    overReversalUPerS: sided(overReversal),
    fireBeforeGateRate: 0,
    firstShotHitRate: 1,
  };
}

function sided(mean: number): SidedStat {
  const stat = { mean, p50: mean, sd: 0, n: 1 };
  return { left: stat, right: stat, diff: 0 };
}
