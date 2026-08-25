import { describe, expect, it } from 'vitest';
import type { CompatibilityKey } from './compatibilityKey.ts';
import type { DiagnosisResult } from './diagnosisRules.ts';
import { buildSessionHistory, type SessionSummary } from './sessionHistory.ts';

const diagnosis: DiagnosisResult = { status: 'ok', recommendationVersion: 'recommendation-test-v1' };
const key: CompatibilityKey = {
  participantId: 'participant-1',
  taskId: 'hold-click-v1',
  protocolVersion: '1.0.0',
  gameMovementProfile: 'cs2-source',
  weaponId: 'rifle',
  weaponMode: 'rifle',
  sensitivityFovKey: 'sensitivity=1;fovDeg=90',
  targetConditionCell: 'default',
  assessmentFeedbackPolicy: 'minimal-end-of-block',
  qualityGateStatus: 'ok',
};

describe('buildSessionHistory', () => {
  it('uses only the newest compatible fixed window and reports medians with variability', () => {
    const current = session('current', '2026-08-25T12:00:00.000Z', 99, 99);
    const result = buildSessionHistory(
      current,
      [
        session('oldest', '2026-08-20T12:00:00.000Z', 10, 70),
        session('middle', '2026-08-21T12:00:00.000Z', 20, 80),
        session('newest', '2026-08-22T12:00:00.000Z', 30, 90),
      ],
      2,
      2,
    );

    expect(result).toMatchObject({
      status: 'ok',
      medianSpeed: 25,
      medianAccuracy: 85,
      variabilitySpeed: 5,
      variabilityAccuracy: 5,
    });
    expect(result.status === 'ok' && result.eligible.map((item) => item.sessionId)).toEqual(['middle', 'newest']);
  });

  it('excludes incompatible sessions before calculating the baseline', () => {
    const current = session('current', '2026-08-25T12:00:00.000Z', 99, 99);
    const incompatible = session('other-profile', '2026-08-24T12:00:00.000Z', 1, 1, {
      ...key,
      gameMovementProfile: 'other-profile',
    });
    const compatible = session('compatible', '2026-08-23T12:00:00.000Z', 20, 80);

    const result = buildSessionHistory(current, [incompatible, compatible], 5, 1);

    expect(result.status).toBe('ok');
    expect(result.status === 'ok' && result.eligible.map((item) => item.sessionId)).toEqual(['compatible']);
  });

  it('short-circuits when the compatible history does not meet minN', () => {
    const result = buildSessionHistory(session('current', '2026-08-25T12:00:00.000Z', 99, 99), [], 5, 1);

    expect(result).toEqual({ status: 'insufficient-data', reason: 'compatible history n=0 is below minN=1' });
  });

  it('does not aggregate a different speed or accuracy metric into the same baseline', () => {
    const incompatibleMetric = {
      ...session('other-metric', '2026-08-24T12:00:00.000Z', 10, 80),
      speedMetric: { id: 'spider-shot.rhythm-ms', value: 10 },
    };

    expect(buildSessionHistory(session('current', '2026-08-25T12:00:00.000Z', 99, 99), [incompatibleMetric], 5, 1)).toEqual({
      status: 'insufficient-data',
      reason: 'compatible history n=0 is below minN=1',
    });
  });

  it('does not build a baseline for a current session that failed its quality gate', () => {
    const current = session('current', '2026-08-25T12:00:00.000Z', 99, 99, { ...key, qualityGateStatus: 'suspect-run' });

    expect(buildSessionHistory(current, [session('past', '2026-08-24T12:00:00.000Z', 10, 80)], 5, 1)).toEqual({
      status: 'insufficient-data',
      reason: 'current quality gate status: suspect-run',
    });
  });
});

function session(
  sessionId: string,
  startedAt: string,
  speed: number,
  accuracy: number,
  compatibilityKey: CompatibilityKey = key,
): SessionSummary {
  return {
    compatibilityKey,
    sessionId,
    startedAt,
    diagnosis,
    speedMetric: { id: 'hold-click.acquisition-ms', value: speed },
    accuracyMetric: { id: 'hold-click.first-shot-hit-rate', value: accuracy },
  };
}
