import type { ExportPayload } from '../../src/data/export.ts';
import type { DrillMetricRegistry, HistoryProjectionResult } from '../../src/history/DrillMetricRegistry.ts';
import type { HistoryObservationPage, HistoryRunProjection, HistoryRunSummary } from '../../src/history/contracts.ts';

/**
 * WP-49 T4 (README §2.6) — bounded, cached, paginated metric projection over the WP-48 repository.
 * Node-only: `HistoryRunSummary`/`HistoryProjectionResult` (compact) cross the wire; the full
 * `ExportPayload` (hundreds of KiB–low MiB, T0 benchmark) never leaves this process for a page
 * request (D-49.P6).
 */

const DEFAULT_CONCURRENCY = 4;

export interface HistoryAnalysisRepositoryPort {
  listRuns(participantId: string, drillId: string): readonly HistoryRunSummary[];
  loadRun(runId: string): Promise<ExportPayload | undefined>;
}

export interface HistoryAnalysisServiceOptions {
  readonly repository: HistoryAnalysisRepositoryPort;
  readonly registry: DrillMetricRegistry;
  /** Global bound on concurrent load+project jobs across all callers (README §2.11). */
  readonly concurrency?: number;
}

export type HistoryObservationsResult =
  | { readonly ok: true; readonly page: HistoryObservationPage }
  | { readonly ok: false; readonly reason: 'invalid-cursor' | 'invalid-limit' };

export interface HistoryAnalysisService {
  observations(
    participantId: string,
    drillId: string,
    limit: number,
    cursor?: string,
  ): Promise<HistoryObservationsResult>;
}

interface CursorPayload {
  readonly startedAt: string;
  readonly runId: string;
}

function encodeCursor(run: HistoryRunSummary): string {
  const payload: CursorPayload = { startedAt: run.startedAt, runId: run.runId };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): CursorPayload | undefined {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as Record<string, unknown>).startedAt === 'string' &&
      typeof (parsed as Record<string, unknown>).runId === 'string'
    ) {
      return parsed as CursorPayload;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** Simple async semaphore — gates concurrent `loadRun`+`project` jobs at `limit` regardless of how
 * many pages/callers are in flight (README §2.11 "全域 bounded worker queue"). */
function createSemaphore(limit: number): <T>(task: () => Promise<T>) => Promise<T> {
  let active = 0;
  const queue: (() => void)[] = [];

  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= limit) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active++;
    try {
      return await task();
    } finally {
      active--;
      const next = queue.shift();
      if (next !== undefined) next();
    }
  };
}

export function createHistoryAnalysisService(options: HistoryAnalysisServiceOptions): HistoryAnalysisService {
  const { repository, registry } = options;
  const acquire = createSemaphore(options.concurrency ?? DEFAULT_CONCURRENCY);

  // Cache keyed by `${runId}:${registryVersion}` — a projection is a pure function of
  // (payload content, registry version), and run content is immutable once saved (README §2.11),
  // so a successful result can be cached forever within this process lifetime. Only successful
  // completions are cached; a rejected `loadRun` (I/O failure) is never cached, so the next request
  // retries the read (README §2.11 "failed I/O不永久cache").
  const successCache = new Map<string, HistoryProjectionResult>();
  const inFlight = new Map<string, Promise<HistoryProjectionResult>>();

  function loadAndProject(run: HistoryRunSummary, registryVersion: string): Promise<HistoryRunProjection> {
    const cacheKey = `${run.runId}:${registryVersion}`;
    const cached = successCache.get(cacheKey);
    if (cached !== undefined) return Promise.resolve({ run, projection: cached });

    let pending = inFlight.get(cacheKey);
    if (pending === undefined) {
      pending = acquire(async () => {
        let result: HistoryProjectionResult;
        try {
          const payload = await repository.loadRun(run.runId);
          result =
            payload === undefined ? { status: 'invalid-metric', reasonCode: 'run-not-found' } : registry.project(payload);
        } catch {
          // I/O failure (FM-49.7 risk row) — never cached (README §2.11), so the next request
          // retries the read; surfaced as a safe per-item status so the rest of the page still
          // returns 2xx instead of failing the whole request.
          return { status: 'invalid-metric', reasonCode: 'load-failed' };
        }
        successCache.set(cacheKey, result);
        return result;
      });
      inFlight.set(cacheKey, pending);
      // Two concurrent requests for the same (runId, registryVersion) share this one execution and
      // receive the same immutable result (README §2.6 risk row).
      void pending.finally(() => inFlight.delete(cacheKey));
    }
    return pending.then((projection) => ({ run, projection }));
  }

  return {
    async observations(participantId, drillId, limit, cursor): Promise<HistoryObservationsResult> {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        return { ok: false, reason: 'invalid-limit' };
      }

      const runs = repository.listRuns(participantId, drillId);
      const registryVersion = registry.registrationForExactDrill(drillId)?.version ?? 'unregistered';

      let startIndex = 0;
      if (cursor !== undefined) {
        const decoded = decodeCursor(cursor);
        if (decoded === undefined) return { ok: false, reason: 'invalid-cursor' };
        const boundary = runs.findIndex((run) => run.startedAt === decoded.startedAt && run.runId === decoded.runId);
        if (boundary < 0) return { ok: false, reason: 'invalid-cursor' };
        startIndex = boundary + 1;
      }

      // Bounded (NFR-49.4): never `Promise.all()` an unbounded slice — the semaphore above caps
      // concurrent load+project jobs at 4 regardless of how large `slice` is.
      const slice = runs.slice(startIndex, startIndex + limit);
      const items = await Promise.all(slice.map((run) => loadAndProject(run, registryVersion)));
      const nextIndex = startIndex + slice.length;
      const nextCursor = nextIndex < runs.length ? encodeCursor(runs[nextIndex - 1]) : undefined;

      return {
        ok: true,
        page: { items, total: runs.length, ...(nextCursor !== undefined ? { nextCursor } : {}), registryVersion },
      };
    },
  };
}
