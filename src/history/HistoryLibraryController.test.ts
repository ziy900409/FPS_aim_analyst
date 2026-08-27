import { describe, expect, it, vi } from 'vitest';
import { createHistoryLibraryController, type HistoryLibraryState } from './HistoryLibraryController.ts';
import { HistoryClientError, type HistoryClient } from './HistoryClient.ts';
import type { HistoryDrillSummary, HistoryIndexReport, HistoryParticipantSummary, HistoryRunSummary } from './contracts.ts';
import type { HistoryNavigator } from './navigation/HistoryNavigator.ts';
import type { HistoryRoute } from './navigation/HistoryRoute.ts';
import type { ExportPayload } from '../data/export.ts';
import { makeAssessmentPayload } from '../../tests/history/payloadFixtures.ts';

/** Controller tests only need `current` + `subscribe` — the rest of `HistoryNavigator` is exercised
 * by HistoryNavigator.test.ts. `setRoute` drives it the same way a real hash change would. */
function createFakeNavigator(initial: HistoryRoute | undefined): HistoryNavigator & { setRoute(route: HistoryRoute | undefined): void } {
  let current = initial;
  const listeners = new Set<(route: HistoryRoute | undefined) => void>();
  return {
    get current() {
      return current;
    },
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    close: vi.fn(),
    saveScroll: vi.fn(),
    consumeScroll: vi.fn(() => undefined),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose: vi.fn(),
    setRoute(route) {
      current = route;
      for (const listener of listeners) listener(route);
    },
  };
}

/** Drains pending microtasks (an `async () => Promise.reject(...)` mock needs more than one
 * `await Promise.resolve()` hop to reach the controller's `catch`) via a macrotask boundary. */
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** Deferred promise so tests can control exactly when a fake client call resolves — required to
 * reproduce the out-of-order "route A settles after route B" race (FM-49.1). */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const healthFixture: HistoryIndexReport = {
  validRunCount: 0,
  invalidFileCount: 0,
  unsupportedFileCount: 0,
  excludedPracticeFileCount: 0,
  rebuiltAt: '2026-01-01T00:00:00Z',
};

function fakeClient(overrides: Partial<HistoryClient> = {}): HistoryClient {
  return {
    health: vi.fn(async () => healthFixture),
    saveRun: vi.fn(),
    listParticipants: vi.fn(async () => []),
    listDrills: vi.fn(async () => []),
    listRuns: vi.fn(async () => []),
    loadRun: vi.fn(async () => ({ meta: {}, ticks: [], events: [] }) as unknown as ExportPayload),
    ...overrides,
  };
}

const participant: HistoryParticipantSummary = { participantId: 'p-1', drillCount: 1, runCount: 3, latestStartedAt: '2026-01-01T00:00:00Z' };
const drill: HistoryDrillSummary = { drillId: 'd-1', runCount: 3, latestStartedAt: '2026-01-01T00:00:00Z' };
const run: HistoryRunSummary = {
  runId: 'r-1',
  participantId: 'p-1',
  drillId: 'd-1',
  startedAt: '2026-01-01T00:00:00Z',
  schemaVersion: 1,
  suspect: false,
  byteLength: 100,
  replaySupport: 'unchecked',
};

describe('createHistoryLibraryController — happy path per route kind', () => {
  it('start() on a participants route loads participants into ready', async () => {
    const client = fakeClient({ listParticipants: vi.fn(async () => [participant]) });
    const navigator = createFakeNavigator({ kind: 'participants', query: '' });
    const controller = createHistoryLibraryController({ navigator, client });

    controller.start();
    expect(controller.state.participants).toEqual({ status: 'loading', previous: undefined });
    await flush();

    expect(controller.state.participants).toEqual({ status: 'ready', value: [participant] });
    expect(client.listParticipants).toHaveBeenCalledOnce();
  });

  it('empty list resolves to status "empty", not "ready" with an empty array', async () => {
    const client = fakeClient({ listParticipants: vi.fn(async () => []) });
    const navigator = createFakeNavigator({ kind: 'participants', query: '' });
    const controller = createHistoryLibraryController({ navigator, client });
    controller.start();
    await flush();
    expect(controller.state.participants).toEqual({ status: 'empty' });
  });

  it('a drills route loads that participant\'s drills', async () => {
    const client = fakeClient({ listDrills: vi.fn(async () => [drill]) });
    const navigator = createFakeNavigator({ kind: 'drills', participantId: 'p-1' });
    const controller = createHistoryLibraryController({ navigator, client });
    controller.start();
    await flush();
    expect(client.listDrills).toHaveBeenCalledWith('p-1', expect.any(AbortSignal));
    expect(controller.state.drills).toEqual({ status: 'ready', value: [drill] });
  });

  it('a drill route loads that exact drill\'s runs', async () => {
    const client = fakeClient({ listRuns: vi.fn(async () => [run]) });
    const navigator = createFakeNavigator({ kind: 'drill', participantId: 'p-1', drillId: 'd-1', runFilter: 'all' });
    const controller = createHistoryLibraryController({ navigator, client });
    controller.start();
    await flush();
    expect(client.listRuns).toHaveBeenCalledWith('p-1', 'd-1', expect.any(AbortSignal));
    expect(controller.state.runs).toEqual({ status: 'ready', value: [run] });
  });

  it('a run route loads the payload into runDetail, wrapped with a derived run summary and the shared ResultPresentation', async () => {
    const payload = makeAssessmentPayload({ participantId: 'p-1', drillId: 'd-1', startedAt: '2026-01-01T00:00:00.000Z' });
    const client = fakeClient({ loadRun: vi.fn(async () => payload) });
    const navigator = createFakeNavigator({ kind: 'run', participantId: 'p-1', drillId: 'd-1', runId: 'r-1' });
    const controller = createHistoryLibraryController({ navigator, client });
    controller.start();
    await flush();
    expect(client.loadRun).toHaveBeenCalledWith('r-1', expect.any(AbortSignal));
    expect(controller.state.runDetail.status).toBe('ready');
    const value = controller.state.runDetail.status === 'ready' ? controller.state.runDetail.value : undefined;
    expect(value?.payload).toBe(payload);
    expect(value?.run).toMatchObject({ runId: 'r-1', participantId: 'p-1', drillId: 'd-1', startedAt: '2026-01-01T00:00:00.000Z', replaySupport: 'unchecked' });
    expect(value?.run.byteLength).toBeGreaterThan(0);
    expect(value?.result.summary).toBeDefined();
  });

  it('does not clear runDetail when the shared ResultPresentation pipeline throws on a malformed payload — it surfaces as a scoped error', async () => {
    const malformed = { meta: { drillId: 'd-1', session: { participantId: 'p-1' } }, ticks: [{ t: Number.NaN }], events: [] } as unknown as ExportPayload;
    const client = fakeClient({ loadRun: vi.fn(async () => malformed) });
    const navigator = createFakeNavigator({ kind: 'run', participantId: 'p-1', drillId: 'd-1', runId: 'r-1' });
    const controller = createHistoryLibraryController({ navigator, client });
    controller.start();
    await flush();
    expect(controller.state.runDetail.status).toBe('error');
  });

  it('observations stays idle for the lifetime of T1 — no endpoint to call yet', async () => {
    const navigator = createFakeNavigator({ kind: 'drill', participantId: 'p-1', drillId: 'd-1', runFilter: 'all' });
    const controller = createHistoryLibraryController({ navigator, client: fakeClient() });
    controller.start();
    controller.loadNextObservationPage();
    controller.retry('observations');
    await Promise.resolve();
    expect(controller.state.observations).toEqual({ status: 'idle' });
  });
});

describe('createHistoryLibraryController — error handling', () => {
  it('a HistoryClientError becomes a typed error state with code/retryable preserved', async () => {
    const error = new HistoryClientError('HISTORY_UNAVAILABLE', 'server is down');
    const client = fakeClient({ listParticipants: vi.fn(async () => Promise.reject(error)) });
    const navigator = createFakeNavigator({ kind: 'participants', query: '' });
    const controller = createHistoryLibraryController({ navigator, client });
    controller.start();
    await flush();
    expect(controller.state.participants).toEqual({
      status: 'error',
      code: 'HISTORY_UNAVAILABLE',
      message: 'server is down',
      retryable: true,
    });
  });

  it('a plain Error becomes an UNKNOWN, non-retryable error state without throwing', async () => {
    const client = fakeClient({ listParticipants: vi.fn(async () => Promise.reject(new Error('boom'))) });
    const navigator = createFakeNavigator({ kind: 'participants', query: '' });
    const controller = createHistoryLibraryController({ navigator, client });
    controller.start();
    await flush();
    expect(controller.state.participants).toEqual({ status: 'error', code: 'UNKNOWN', message: 'boom', retryable: false });
  });
});

describe('createHistoryLibraryController — race safety (FM-49.1)', () => {
  it('a stale response for a superseded drill route is discarded; state reflects the newer route', async () => {
    const first = deferred<readonly HistoryRunSummary[]>();
    const second = deferred<readonly HistoryRunSummary[]>();
    const runsForDrill = { a: first.promise, b: second.promise };
    const client = fakeClient({
      listRuns: vi.fn((_participantId: string, drillId: string) => runsForDrill[drillId as 'a' | 'b']),
    });
    const navigator = createFakeNavigator({ kind: 'drill', participantId: 'p-1', drillId: 'a', runFilter: 'all' });
    const controller = createHistoryLibraryController({ navigator, client });
    controller.start();

    navigator.setRoute({ kind: 'drill', participantId: 'p-1', drillId: 'b', runFilter: 'all' });
    const runB: HistoryRunSummary = { ...run, drillId: 'b' };
    second.resolve([runB]);
    await flush();
    expect(controller.state.runs).toEqual({ status: 'ready', value: [runB] });

    // The now-superseded route-A request finally settles — must NOT overwrite route B's state.
    const runA: HistoryRunSummary = { ...run, drillId: 'a' };
    first.resolve([runA]);
    await flush();
    expect(controller.state.runs).toEqual({ status: 'ready', value: [runB] });
  });

  it('a stale ERROR for a superseded route is also discarded (not just a stale success)', async () => {
    const first = deferred<readonly HistoryRunSummary[]>();
    const second = deferred<readonly HistoryRunSummary[]>();
    const runsForDrill = { a: first.promise, b: second.promise };
    const client = fakeClient({
      listRuns: vi.fn((_participantId: string, drillId: string) => runsForDrill[drillId as 'a' | 'b']),
    });
    const navigator = createFakeNavigator({ kind: 'drill', participantId: 'p-1', drillId: 'a', runFilter: 'all' });
    const controller = createHistoryLibraryController({ navigator, client });
    controller.start();

    navigator.setRoute({ kind: 'drill', participantId: 'p-1', drillId: 'b', runFilter: 'all' });
    second.resolve([run]);
    await flush();

    first.reject(new HistoryClientError('TIMEOUT', 'request was aborted'));
    await flush();
    expect(controller.state.runs).toEqual({ status: 'ready', value: [run] });
  });

  it('navigating to a new drill route aborts the previous request\'s signal', async () => {
    let capturedSignal: AbortSignal | undefined;
    const client = fakeClient({
      listRuns: vi.fn((_p: string, _d: string, signal?: AbortSignal) => {
        capturedSignal = signal;
        return new Promise<readonly HistoryRunSummary[]>(() => {}); // never resolves
      }),
    });
    const navigator = createFakeNavigator({ kind: 'drill', participantId: 'p-1', drillId: 'a', runFilter: 'all' });
    const controller = createHistoryLibraryController({ navigator, client });
    controller.start();
    const signalForRouteA = capturedSignal;
    expect(signalForRouteA?.aborted).toBe(false);

    navigator.setRoute({ kind: 'drill', participantId: 'p-1', drillId: 'b', runFilter: 'all' });
    expect(signalForRouteA?.aborted).toBe(true);
  });
});

describe('createHistoryLibraryController — retry', () => {
  it('retry(scope) re-issues the fetch for the current route', async () => {
    const listParticipants = vi.fn(
      async (): Promise<readonly HistoryParticipantSummary[]> => Promise.reject(new HistoryClientError('STORAGE_IO', 'disk error')),
    );
    const client = fakeClient({ listParticipants });
    const navigator = createFakeNavigator({ kind: 'participants', query: '' });
    const controller = createHistoryLibraryController({ navigator, client });
    controller.start();
    await flush();
    expect(controller.state.participants.status).toBe('error');

    listParticipants.mockImplementation(async () => [participant]);
    controller.retry('participants');
    await flush();
    expect(controller.state.participants).toEqual({ status: 'ready', value: [participant] });
    expect(listParticipants).toHaveBeenCalledTimes(2);
  });

  it('retry(scope) is a no-op when the current route no longer matches that scope', async () => {
    const listDrills = vi.fn(async () => [drill]);
    const client = fakeClient({ listDrills });
    const navigator = createFakeNavigator({ kind: 'participants', query: '' });
    const controller = createHistoryLibraryController({ navigator, client });
    controller.start();
    controller.retry('drills');
    await Promise.resolve();
    expect(listDrills).not.toHaveBeenCalled();
  });
});

describe('createHistoryLibraryController — health banner (OQ-49.5)', () => {
  it('start() loads health into state.health independent of route', async () => {
    const report: HistoryIndexReport = { ...healthFixture, validRunCount: 3, invalidFileCount: 1 };
    const client = fakeClient({ health: vi.fn(async () => report) });
    const navigator = createFakeNavigator({ kind: 'participants', query: '' });
    const controller = createHistoryLibraryController({ navigator, client });
    controller.start();
    await flush();
    expect(controller.state.health).toEqual(report);
  });

  it('a failed health fetch leaves state.health unset without producing an error state', async () => {
    const client = fakeClient({ health: vi.fn(async () => Promise.reject(new Error('boom'))) });
    const navigator = createFakeNavigator({ kind: 'participants', query: '' });
    const controller = createHistoryLibraryController({ navigator, client });
    controller.start();
    await flush();
    expect(controller.state.health).toBeUndefined();
    expect(controller.state.participants).toEqual({ status: 'empty' });
  });
});

describe('createHistoryLibraryController — re-entering the same route identity does not re-fetch', () => {
  it('changing only `query` on a participants route does not re-issue listParticipants (client-side search)', async () => {
    const listParticipants = vi.fn(async () => [participant]);
    const client = fakeClient({ listParticipants });
    const navigator = createFakeNavigator({ kind: 'participants', query: '' });
    const controller = createHistoryLibraryController({ navigator, client });
    controller.start();
    await flush();
    expect(listParticipants).toHaveBeenCalledOnce();

    navigator.setRoute({ kind: 'participants', query: 'p-1' });
    await flush();
    expect(listParticipants).toHaveBeenCalledOnce();
    expect(controller.state.route).toEqual({ kind: 'participants', query: 'p-1' });
  });

  it('changing metricId/cohortId/runFilter on the same drill route does not re-issue listRuns', async () => {
    const listRuns = vi.fn(async () => [run]);
    const client = fakeClient({ listRuns });
    const navigator = createFakeNavigator({ kind: 'drill', participantId: 'p-1', drillId: 'd-1', runFilter: 'all' });
    const controller = createHistoryLibraryController({ navigator, client });
    controller.start();
    await flush();
    expect(listRuns).toHaveBeenCalledOnce();

    navigator.setRoute({ kind: 'drill', participantId: 'p-1', drillId: 'd-1', runFilter: 'trend-eligible', metricId: 'm' });
    await flush();
    expect(listRuns).toHaveBeenCalledOnce();
  });

  it('navigating to a different participantId on a drills route still re-fetches', async () => {
    const listDrills = vi.fn(async () => [drill]);
    const client = fakeClient({ listDrills });
    const navigator = createFakeNavigator({ kind: 'drills', participantId: 'p-1' });
    const controller = createHistoryLibraryController({ navigator, client });
    controller.start();
    await flush();
    expect(listDrills).toHaveBeenCalledOnce();

    navigator.setRoute({ kind: 'drills', participantId: 'p-2' });
    await flush();
    expect(listDrills).toHaveBeenCalledTimes(2);
    expect(listDrills).toHaveBeenLastCalledWith('p-2', expect.any(AbortSignal));
  });
});

describe('createHistoryLibraryController — dispose', () => {
  it('aborts in-flight requests and stops publishing further state updates', async () => {
    let capturedSignal: AbortSignal | undefined;
    const client = fakeClient({
      listParticipants: vi.fn((signal?: AbortSignal) => {
        capturedSignal = signal;
        return new Promise<readonly HistoryParticipantSummary[]>(() => {});
      }),
    });
    const navigator = createFakeNavigator({ kind: 'participants', query: '' });
    const controller = createHistoryLibraryController({ navigator, client });
    const states: HistoryLibraryState[] = [];
    controller.subscribe((s) => states.push(s));
    controller.start();
    const countBeforeDispose = states.length;

    controller.dispose();
    expect(capturedSignal?.aborted).toBe(true);

    navigator.setRoute({ kind: 'drills', participantId: 'p-1' });
    expect(states.length).toBe(countBeforeDispose);
  });
});
