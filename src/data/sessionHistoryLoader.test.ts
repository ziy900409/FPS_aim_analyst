import { describe, expect, it } from 'vitest';
import type { ExportPayload } from './export.ts';
import { loadAssessmentSessionSummaries, type SessionHistoryFile } from './sessionHistoryLoader.ts';
import type { SessionSummary } from '../metrics/sessionHistory.ts';

describe('loadAssessmentSessionSummaries', () => {
  it('loads Assessment exports and excludes Practice exports before summary construction', async () => {
    const assessment = file('assessment.json', { meta: { assessment: { protocolVersion: '1.0.0' } }, ticks: [], events: [] });
    const practice = file('practice.json', { meta: {}, ticks: [], events: [] });
    const converted: ExportPayload[] = [];

    const summaries = await loadAssessmentSessionSummaries([assessment, practice], (payload) => {
      converted.push(payload);
      return summary(payload.meta.assessment?.protocolVersion ?? 'missing');
    });

    expect(converted).toHaveLength(1);
    expect(summaries.map((item) => item.sessionId)).toEqual(['1.0.0']);
  });

  it('rejects a selected file that is not a JSON export', async () => {
    await expect(loadAssessmentSessionSummaries([file('invalid.json', '{not-json')], () => summary('unused'))).rejects.toThrow(
      'invalid.json is not valid JSON',
    );
  });
});

function file(name: string, contents: unknown): SessionHistoryFile {
  return {
    name,
    text: async () => (typeof contents === 'string' ? contents : JSON.stringify(contents)),
  };
}

function summary(sessionId: string): SessionSummary {
  return {
    compatibilityKey: {
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
    },
    sessionId,
    startedAt: '2026-08-25T12:00:00.000Z',
    diagnosis: { status: 'ok', recommendationVersion: 'recommendation-test-v1' },
    speedMetric: { id: 'hold-click.acquisition-ms', value: 100 },
    accuracyMetric: { id: 'hold-click.first-shot-hit-rate', value: 90 },
  };
}
