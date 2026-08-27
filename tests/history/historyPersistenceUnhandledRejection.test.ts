import process from 'node:process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHistoryPersistence } from '../../src/history/HistoryPersistence.ts';
import { HistoryClientError } from '../../src/history/HistoryClient.ts';
import type { HistoryClient } from '../../src/history/HistoryClient.ts';
import { makeAssessmentPayload } from './payloadFixtures.ts';

/**
 * WP-48 T4 DoD: "rejected save promise 不產生 unhandled rejection；test 明確監聽並斷言為 0". This
 * needs `node:process`'s `unhandledRejection` event, which is why it lives under `tests/` (Node
 * typecheck boundary) rather than `src/history/*.test.ts` (browser `tsconfig.json`, no `node:*`).
 * `HistoryPersistence.test.ts` already proves `save()` resolves rather than rejects for every
 * failure shape; this test proves that structurally-correct behavior also produces zero
 * process-level unhandled-rejection events, not just an awaited promise that happens to resolve.
 */

function fakeClient(saveRun: HistoryClient['saveRun']): HistoryClient {
  return {
    health: vi.fn(),
    saveRun,
    listParticipants: vi.fn(),
    listDrills: vi.fn(),
    listRuns: vi.fn(),
    loadRun: vi.fn(),
  };
}

describe('HistoryPersistence — process-level unhandled rejection', () => {
  const unhandled: unknown[] = [];
  const onUnhandledRejection = (reason: unknown): void => {
    unhandled.push(reason);
  };

  afterEach(() => {
    process.off('unhandledRejection', onUnhandledRejection);
    unhandled.length = 0;
  });

  it('produces zero unhandledRejection events for a rejected client call', async () => {
    process.on('unhandledRejection', onUnhandledRejection);

    const saveRun = vi.fn(async () => {
      throw new HistoryClientError('STORAGE_IO', 'disk failure');
    });
    const persistence = createHistoryPersistence(fakeClient(saveRun));

    // Fire-and-forget on purpose: the point is that even an unawaited save() must never surface
    // as a process-level unhandled rejection.
    void persistence.save(makeAssessmentPayload());

    // Let the rejection (and any unhandledRejection event Node would emit for it) propagate
    // through the microtask/event-loop queue before asserting.
    await new Promise((resolve) => setImmediate(resolve));

    expect(unhandled).toHaveLength(0);
    expect(persistence.state).toEqual({ kind: 'failed', message: 'disk failure', retryable: true });
  });
});
