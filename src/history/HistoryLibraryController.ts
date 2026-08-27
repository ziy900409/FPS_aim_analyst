/**
 * WP-49 T1 — single owner of History route-driven async data (README §2.4). DOM views never
 * fetch: they send navigation/retry intent here and render the immutable `state` snapshot this
 * controller publishes. Each scope (participants/drills/runs/run-detail) is generation-tracked so
 * a response for a route the user has since navigated away from is discarded instead of clobbering
 * newer state (FM-49.1).
 *
 * `observations` (drill-level metric trend data) stays `idle` for the lifetime of T1: it depends on
 * the paged analysis endpoint README §2.6 defines, which does not exist until WP-49 T4. Wiring it
 * up is explicitly T4's job (WP-49 README task table); `retry('observations')` and
 * `loadNextObservationPage()` are present here only to satisfy the full T1 interface shape and are
 * no-ops until then.
 */

import type { ExportPayload } from '../data/export.ts';
import { serializeJSON } from '../data/export.ts';
import { buildResultPresentation, type ResultPresentation } from '../results/ResultPresentation.ts';
import { HistoryClientError, type HistoryClient } from './HistoryClient.ts';
import type { HistoryDrillSummary, HistoryIndexReport, HistoryParticipantSummary, HistoryRunSummary } from './contracts.ts';
import type { HistoryNavigator } from './navigation/HistoryNavigator.ts';
import type { HistoryRoute } from './navigation/HistoryRoute.ts';

export type AsyncState<T> =
  | { readonly status: 'idle' }
  | { readonly status: 'loading'; readonly previous?: T }
  | { readonly status: 'ready'; readonly value: T }
  | { readonly status: 'empty' }
  | { readonly status: 'error'; readonly code: string; readonly message: string; readonly retryable: boolean };

const IDLE: AsyncState<never> = { status: 'idle' };

/** T4 replaces this with the real paged collection derived from `HistoryObservationPage`
 * (README §2.6). The slot exists now so `HistoryLibraryState`'s shape matches the spec; nothing in
 * T1 ever constructs a `'ready'` value for it. */
export type HistoryObservationCollection = never;

/** README §2.8 — the full historical run view: the raw payload, a `HistoryRunSummary` derived
 * from it (byte-identical run identity to what WP-48's repository would report; see
 * `historyRunSummaryFromPayload` below), and the same `ResultPresentation` the current in-session
 * Result renders (D-49.P4). Built once when the payload loads, not recomputed per render. */
export interface HistoricalRunPresentation {
  readonly run: HistoryRunSummary;
  readonly payload: ExportPayload;
  readonly result: ResultPresentation;
}

/** `HistoryClient.loadRun(runId)` only returns the raw `ExportPayload` (README §2.6 — the list
 * endpoints carry `HistoryRunSummary`, not a single-run lookup); every field below is either the
 * requested `runId` itself (the repository already verifies it matches the payload's derived
 * identity before returning it — an unrelated payload/runId pairing 404s instead) or read straight
 * off `payload.meta`. `byteLength` mirrors what `downloadJSON` would actually write, computed from
 * the same `serializeJSON` — no network round-trip needed, so this also works after a direct
 * reload of a `run` route where the parent `runs` list was never fetched. */
function historyRunSummaryFromPayload(runId: string, payload: ExportPayload): HistoryRunSummary {
  return {
    runId,
    participantId: payload.meta.session?.participantId ?? '',
    drillId: payload.meta.drillId,
    startedAt: payload.meta.startedAt,
    schemaVersion: payload.meta.schemaVersion,
    suspect: payload.meta.suspect,
    byteLength: new TextEncoder().encode(serializeJSON(payload)).length,
    replaySupport: 'unchecked',
  };
}

export type HistoryLibraryScope = 'participants' | 'drills' | 'runs' | 'observations' | 'run-detail';

export interface HistoryLibraryState {
  readonly route?: HistoryRoute;
  readonly participants: AsyncState<readonly HistoryParticipantSummary[]>;
  readonly drills: AsyncState<readonly HistoryDrillSummary[]>;
  readonly runs: AsyncState<readonly HistoryRunSummary[]>;
  readonly observations: AsyncState<HistoryObservationCollection>;
  readonly runDetail: AsyncState<HistoricalRunPresentation>;
  readonly health?: HistoryIndexReport;
}

export interface HistoryLibraryController {
  readonly state: HistoryLibraryState;
  start(): void;
  retry(scope: HistoryLibraryScope): void;
  loadNextObservationPage(): void;
  subscribe(listener: (state: HistoryLibraryState) => void): () => void;
  dispose(): void;
}

export interface HistoryLibraryControllerOptions {
  readonly navigator: HistoryNavigator;
  readonly client: HistoryClient;
}

const INITIAL_STATE: HistoryLibraryState = {
  route: undefined,
  participants: IDLE,
  drills: IDLE,
  runs: IDLE,
  observations: IDLE,
  runDetail: IDLE,
};

function previousValue<T>(current: AsyncState<T>): T | undefined {
  if (current.status === 'ready') return current.value;
  if (current.status === 'loading') return current.previous;
  return undefined;
}

function errorState(error: unknown): AsyncState<never> {
  if (error instanceof HistoryClientError) {
    return { status: 'error', code: error.code, message: error.message, retryable: error.retryable };
  }
  return {
    status: 'error',
    code: 'UNKNOWN',
    message: error instanceof Error ? error.message : 'unknown error',
    retryable: false,
  };
}

type FetchableScope = Exclude<HistoryLibraryScope, 'observations'>;

export function createHistoryLibraryController(options: HistoryLibraryControllerOptions): HistoryLibraryController {
  const { navigator, client } = options;
  let state: HistoryLibraryState = INITIAL_STATE;
  let disposed = false;
  const listeners = new Set<(state: HistoryLibraryState) => void>();

  // Per-scope generation counter: a response is only applied if the generation captured when its
  // request started still matches when it resolves — a superseded request's outcome (success,
  // error, or abort) is silently dropped (FM-49.1).
  const generations: Record<FetchableScope, number> = { participants: 0, drills: 0, runs: 0, 'run-detail': 0 };
  const controllers: Partial<Record<FetchableScope, AbortController>> = {};

  function setState(patch: Partial<HistoryLibraryState>): void {
    if (disposed) return;
    state = { ...state, ...patch };
    for (const listener of listeners) listener(state);
  }

  function beginRequest(scope: FetchableScope): { readonly generation: number; readonly signal: AbortSignal } {
    controllers[scope]?.abort();
    const controller = new AbortController();
    controllers[scope] = controller;
    const generation = generations[scope] + 1;
    generations[scope] = generation;
    return { generation, signal: controller.signal };
  }

  function isCurrent(scope: FetchableScope, generation: number): boolean {
    return !disposed && generations[scope] === generation;
  }

  async function loadParticipants(): Promise<void> {
    const { generation, signal } = beginRequest('participants');
    setState({ participants: { status: 'loading', previous: previousValue(state.participants) } });
    try {
      const items = await client.listParticipants(signal);
      if (!isCurrent('participants', generation)) return;
      setState({ participants: items.length === 0 ? { status: 'empty' } : { status: 'ready', value: items } });
    } catch (error) {
      if (!isCurrent('participants', generation)) return;
      setState({ participants: errorState(error) });
    }
  }

  async function loadDrills(participantId: string): Promise<void> {
    const { generation, signal } = beginRequest('drills');
    setState({ drills: { status: 'loading', previous: previousValue(state.drills) } });
    try {
      const items = await client.listDrills(participantId, signal);
      if (!isCurrent('drills', generation)) return;
      setState({ drills: items.length === 0 ? { status: 'empty' } : { status: 'ready', value: items } });
    } catch (error) {
      if (!isCurrent('drills', generation)) return;
      setState({ drills: errorState(error) });
    }
  }

  async function loadRuns(participantId: string, drillId: string): Promise<void> {
    const { generation, signal } = beginRequest('runs');
    setState({ runs: { status: 'loading', previous: previousValue(state.runs) } });
    try {
      const items = await client.listRuns(participantId, drillId, signal);
      if (!isCurrent('runs', generation)) return;
      setState({ runs: items.length === 0 ? { status: 'empty' } : { status: 'ready', value: items } });
    } catch (error) {
      if (!isCurrent('runs', generation)) return;
      setState({ runs: errorState(error) });
    }
  }

  async function loadRunDetail(runId: string): Promise<void> {
    const { generation, signal } = beginRequest('run-detail');
    setState({ runDetail: { status: 'loading', previous: previousValue(state.runDetail) } });
    try {
      const payload = await client.loadRun(runId, signal);
      if (!isCurrent('run-detail', generation)) return;
      // A malformed/edge-case payload throwing inside `buildResultPresentation` is caught by this
      // same try/catch and surfaces as a scoped, retryable run-detail error (FM-49.5's item-level
      // isolation applies to T4's registry projector; this is the equivalent guard for T3's shared
      // presentation path) — it never clears the run list or crashes the screen.
      const value: HistoricalRunPresentation = {
        run: historyRunSummaryFromPayload(runId, payload),
        payload,
        result: buildResultPresentation(payload),
      };
      setState({ runDetail: { status: 'ready', value } });
    } catch (error) {
      if (!isCurrent('run-detail', generation)) return;
      setState({ runDetail: errorState(error) });
    }
  }

  function reactToRoute(route: HistoryRoute | undefined): void {
    // Re-entering the *same* logical route (participantId/drillId/runId unchanged) must not
    // re-fetch — `query` on a participants route and `metricId`/`cohortId`/`runFilter` on a drill
    // route are client-side filters over already-loaded data (README §1.4 Assumptions), not fetch
    // parameters. Only a genuinely different identity (or arriving from a different route kind)
    // starts a new request.
    const previousRoute = state.route;
    setState({ route });
    if (route === undefined) return;
    switch (route.kind) {
      case 'participants':
        if (previousRoute?.kind !== 'participants') void loadParticipants();
        return;
      case 'drills':
        if (previousRoute?.kind !== 'drills' || previousRoute.participantId !== route.participantId) {
          void loadDrills(route.participantId);
        }
        return;
      case 'drill':
        if (
          previousRoute?.kind !== 'drill' ||
          previousRoute.participantId !== route.participantId ||
          previousRoute.drillId !== route.drillId
        ) {
          void loadRuns(route.participantId, route.drillId);
        }
        return;
      case 'run':
        if (previousRoute?.kind !== 'run' || previousRoute.runId !== route.runId) void loadRunDetail(route.runId);
        return;
    }
  }

  let healthController: AbortController | undefined;

  /** Fire-and-forget: the health/exclusion-count banner (OQ-49.5) is a non-blocking diagnostic, not
   * part of any route's async state — a failed fetch just leaves `state.health` unset rather than
   * producing an error state anywhere. */
  function loadHealth(): void {
    healthController?.abort();
    const controller = new AbortController();
    healthController = controller;
    client.health(controller.signal).then(
      (report) => {
        if (disposed) return;
        setState({ health: report });
      },
      () => {
        // non-blocking — intentionally swallowed.
      },
    );
  }

  const unsubscribeNavigator = navigator.subscribe(reactToRoute);

  return {
    get state() {
      return state;
    },
    start(): void {
      loadHealth();
      reactToRoute(navigator.current);
    },
    retry(scope: HistoryLibraryScope): void {
      const route = state.route;
      if (route === undefined) return;
      if (scope === 'participants' && route.kind === 'participants') void loadParticipants();
      else if (scope === 'drills' && route.kind === 'drills') void loadDrills(route.participantId);
      else if (scope === 'runs' && route.kind === 'drill') void loadRuns(route.participantId, route.drillId);
      else if (scope === 'run-detail' && route.kind === 'run') void loadRunDetail(route.runId);
      // 'observations': no-op until T4 (see module doc comment).
    },
    loadNextObservationPage(): void {
      // No-op until T4 wires cursor-paged fetches against the not-yet-built analysis endpoint.
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose(): void {
      disposed = true;
      unsubscribeNavigator();
      healthController?.abort();
      for (const scope of Object.keys(controllers) as FetchableScope[]) controllers[scope]?.abort();
      listeners.clear();
    },
  };
}
