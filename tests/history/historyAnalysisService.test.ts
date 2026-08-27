import { describe, expect, it } from 'vitest';
import type { ExportPayload } from '../../src/data/export.ts';
import { createDrillMetricRegistry, type DrillMetricRegistry } from '../../src/history/DrillMetricRegistry.ts';
import type { HistoryRunSummary } from '../../src/history/contracts.ts';
import {
  createHistoryAnalysisService,
  type HistoryAnalysisRepositoryPort,
} from '../../server/history/HistoryAnalysisService.ts';
import { makeAssessmentPayload } from './payloadFixtures.ts';

function makeRunSummary(index: number, overrides: Partial<HistoryRunSummary> = {}): HistoryRunSummary {
  const startedAt = `2026-08-${String(10 + index).padStart(2, '0')}T00:00:00.000Z`;
  return {
    runId: `run-${index}`,
    participantId: 'P-1',
    drillId: 'spider-shot-v2',
    startedAt,
    schemaVersion: 2,
    suspect: false,
    byteLength: 1000,
    replaySupport: 'unchecked',
    ...overrides,
  };
}

/** Runs already sorted newest-first (`startedAt` desc), matching `HistoryRepository.listRuns()`. */
function makeSortedRuns(count: number): HistoryRunSummary[] {
  return Array.from({ length: count }, (_, i) => makeRunSummary(i)).reverse();
}

interface FakeRepositoryOptions {
  readonly runs: readonly HistoryRunSummary[];
  readonly payloadFor?: (runId: string) => ExportPayload | undefined;
  readonly onLoadStart?: (runId: string) => void;
  readonly onLoadEnd?: (runId: string) => void;
  readonly delayMs?: number;
  readonly rejectRunIds?: ReadonlySet<string>;
}

function makeFakeRepository(options: FakeRepositoryOptions): HistoryAnalysisRepositoryPort & { loadCount: Map<string, number> } {
  const loadCount = new Map<string, number>();
  return {
    loadCount,
    listRuns: () => options.runs,
    async loadRun(runId: string): Promise<ExportPayload | undefined> {
      loadCount.set(runId, (loadCount.get(runId) ?? 0) + 1);
      options.onLoadStart?.(runId);
      if (options.delayMs !== undefined) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      options.onLoadEnd?.(runId);
      if (options.rejectRunIds?.has(runId) === true) throw new Error(`simulated I/O failure for ${runId}`);
      return options.payloadFor?.(runId) ?? makeAssessmentPayload({ drillId: 'spider-shot-v2', startedAt: '2026-08-10T00:00:00.000Z' });
    },
  };
}

function realRegistry(): DrillMetricRegistry {
  return createDrillMetricRegistry();
}

describe('HistoryAnalysisService', () => {
  it('paginates newest-first runs with a stable cursor and reports loaded/total via nextCursor', async () => {
    const runs = makeSortedRuns(5);
    const repository = makeFakeRepository({ runs });
    const service = createHistoryAnalysisService({ repository, registry: realRegistry() });

    const page1 = await service.observations('P-1', 'spider-shot-v2', 2);
    expect(page1.ok).toBe(true);
    if (!page1.ok) return;
    expect(page1.page.total).toBe(5);
    expect(page1.page.items.map((item) => item.run.runId)).toEqual(['run-4', 'run-3']);
    expect(page1.page.nextCursor).toBeDefined();
    expect(page1.page.registryVersion).toBe('1.0.0');

    const page2 = await service.observations('P-1', 'spider-shot-v2', 2, page1.page.nextCursor);
    expect(page2.ok).toBe(true);
    if (!page2.ok) return;
    expect(page2.page.items.map((item) => item.run.runId)).toEqual(['run-2', 'run-1']);

    const page3 = await service.observations('P-1', 'spider-shot-v2', 2, page2.page.nextCursor);
    expect(page3.ok).toBe(true);
    if (!page3.ok) return;
    expect(page3.page.items.map((item) => item.run.runId)).toEqual(['run-0']);
    expect(page3.page.nextCursor).toBeUndefined();
  });

  it('rejects an out-of-range or non-integer limit as invalid-limit without touching the repository', async () => {
    const repository = makeFakeRepository({ runs: makeSortedRuns(3) });
    const service = createHistoryAnalysisService({ repository, registry: realRegistry() });

    for (const limit of [0, -1, 101, 1.5, NaN]) {
      const result = await service.observations('P-1', 'spider-shot-v2', limit);
      expect(result).toEqual({ ok: false, reason: 'invalid-limit' });
    }
  });

  it('rejects a malformed or unknown cursor as invalid-cursor', async () => {
    const repository = makeFakeRepository({ runs: makeSortedRuns(3) });
    const service = createHistoryAnalysisService({ repository, registry: realRegistry() });

    expect(await service.observations('P-1', 'spider-shot-v2', 10, 'not-base64url-json')).toEqual({
      ok: false,
      reason: 'invalid-cursor',
    });
    const foreignCursor = Buffer.from(JSON.stringify({ startedAt: '2000-01-01T00:00:00.000Z', runId: 'nope' }), 'utf8').toString(
      'base64url',
    );
    expect(await service.observations('P-1', 'spider-shot-v2', 10, foreignCursor)).toEqual({
      ok: false,
      reason: 'invalid-cursor',
    });
  });

  it('caps concurrent load+project jobs at the configured limit', async () => {
    const runs = makeSortedRuns(10);
    let active = 0;
    let maxActive = 0;
    const repository = makeFakeRepository({
      runs,
      delayMs: 10,
      onLoadStart: () => {
        active++;
        maxActive = Math.max(maxActive, active);
      },
      onLoadEnd: () => {
        active--;
      },
    });
    const service = createHistoryAnalysisService({ repository, registry: realRegistry(), concurrency: 4 });

    const result = await service.observations('P-1', 'spider-shot-v2', 10);
    expect(result.ok).toBe(true);
    expect(maxActive).toBeLessThanOrEqual(4);
    expect(maxActive).toBeGreaterThan(1); // proves it actually ran concurrently, not serially
  });

  it('coalesces concurrent requests for the same run into a single load+project execution', async () => {
    const runs = makeSortedRuns(1);
    const repository = makeFakeRepository({ runs, delayMs: 10 });
    const service = createHistoryAnalysisService({ repository, registry: realRegistry() });

    const [a, b] = await Promise.all([
      service.observations('P-1', 'spider-shot-v2', 1),
      service.observations('P-1', 'spider-shot-v2', 1),
    ]);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.page.items[0].projection).toEqual(b.page.items[0].projection);
    expect(repository.loadCount.get('run-0')).toBe(1);
  });

  it('caches a successful projection and does not re-load the payload on a later request', async () => {
    const runs = makeSortedRuns(1);
    const repository = makeFakeRepository({ runs });
    const service = createHistoryAnalysisService({ repository, registry: realRegistry() });

    await service.observations('P-1', 'spider-shot-v2', 1);
    await service.observations('P-1', 'spider-shot-v2', 1);
    expect(repository.loadCount.get('run-0')).toBe(1);
  });

  it('surfaces a load failure as a safe per-item status without caching it, so a retry re-reads', async () => {
    const runs = makeSortedRuns(1);
    const repository = makeFakeRepository({ runs, rejectRunIds: new Set(['run-0']) });
    const service = createHistoryAnalysisService({ repository, registry: realRegistry() });

    const first = await service.observations('P-1', 'spider-shot-v2', 1);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.page.items[0].projection).toEqual({ status: 'invalid-metric', reasonCode: 'load-failed' });

    const second = await service.observations('P-1', 'spider-shot-v2', 1);
    expect(second.ok).toBe(true);
    expect(repository.loadCount.get('run-0')).toBe(2);
  });

  it('keeps an unregistered drill 2xx with a typed per-item status instead of failing the whole page', async () => {
    const runs = makeSortedRuns(1, ).map((run) => ({ ...run, drillId: 'hold-click-v1' }));
    const repository = makeFakeRepository({
      runs,
      payloadFor: () => makeAssessmentPayload({ drillId: 'hold-click-v1' }),
    });
    const service = createHistoryAnalysisService({ repository, registry: realRegistry() });

    const result = await service.observations('P-1', 'hold-click-v1', 10);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.page.items[0].projection).toEqual({ status: 'unregistered-drill', drillId: 'hold-click-v1' });
    expect(result.page.registryVersion).toBe('unregistered');
  });
});
