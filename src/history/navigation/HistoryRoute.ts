/**
 * WP-49 T1 — namespaced `#/history/...` route model (README §2.3). Pure parse/format: no DOM,
 * no `window`/`history` access (that lives in `HistoryNavigator.ts`).
 *
 * `parseHistoryHash` is total over the `#/history` namespace: a hash outside the namespace (e.g.
 * the existing dev-only `#pattern`) returns `undefined` so callers never intercept it (FM-49.1
 * table row "`#pattern`"); a hash *inside* the namespace with a malformed/empty logical id id
 * degrades to the deepest still-valid ancestor route rather than throwing or returning `undefined`
 * (README §2.3 "invalid encoding、未知 route 或不存在 entity 進 typed not-found state，不 throw" —
 * T0's route PoC found no case that requires a distinct "not-found" variant of `HistoryRoute`: the
 * nearest valid ancestor already is a typed, renderable route).
 */

export type HistoryRunFilter = 'all' | 'trend-eligible' | 'excluded';

export type HistoryRoute =
  | { readonly kind: 'participants'; readonly query: string }
  | { readonly kind: 'drills'; readonly participantId: string }
  | {
      readonly kind: 'drill';
      readonly participantId: string;
      readonly drillId: string;
      readonly metricId?: string;
      readonly cohortId?: string;
      readonly runFilter: HistoryRunFilter;
    }
  | { readonly kind: 'run'; readonly participantId: string; readonly drillId: string; readonly runId: string };

const NAMESPACE_ROOT = '#/history';
const RUN_FILTERS: ReadonlySet<string> = new Set<HistoryRunFilter>(['all', 'trend-eligible', 'excluded']);

function isRunFilter(value: string | undefined): value is HistoryRunFilter {
  return value !== undefined && RUN_FILTERS.has(value);
}

/** `decodeURIComponent` a single path segment; `undefined` (missing, empty, malformed %-escape, or
 * decodes to an empty string) signals "no usable id here" so the caller can fall back a level. */
function decodeSegment(segment: string | undefined): string | undefined {
  if (segment === undefined || segment.length === 0) return undefined;
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return undefined;
  }
  return decoded.length === 0 ? undefined : decoded;
}

function parseQuery(queryPart: string | undefined): URLSearchParams {
  // URLSearchParams never throws on malformed input — it just decodes leniently.
  return new URLSearchParams(queryPart ?? '');
}

function splitOnFirst(value: string, separator: string): readonly [string, string | undefined] {
  const index = value.indexOf(separator);
  if (index === -1) return [value, undefined];
  return [value.slice(0, index), value.slice(index + 1)];
}

/** Total for the `#/history` namespace: returns `undefined` only when `hash` is outside it. */
export function parseHistoryHash(hash: string): HistoryRoute | undefined {
  if (hash !== NAMESPACE_ROOT && !hash.startsWith(`${NAMESPACE_ROOT}/`) && !hash.startsWith(`${NAMESPACE_ROOT}?`)) {
    return undefined;
  }

  const body = hash.slice(1); // drop leading '#'
  const [pathPart, queryPart] = splitOnFirst(body, '?');
  const query = parseQuery(queryPart);
  const rootRoute: HistoryRoute = { kind: 'participants', query: query.get('q') ?? '' };
  // pathPart starts with '/history' per the guard above.
  const segments = pathPart
    .slice('/history'.length)
    .split('/')
    .filter((segment) => segment.length > 0);

  if (segments[0] !== 'participants') return rootRoute;

  const participantId = decodeSegment(segments[1]);
  if (participantId === undefined) return rootRoute;
  const drillsRoute: HistoryRoute = { kind: 'drills', participantId };
  if (segments[2] !== 'drills') return drillsRoute;

  const drillId = decodeSegment(segments[3]);
  if (drillId === undefined) {
    return { kind: 'drills', participantId };
  }

  const drillRoute = {
    kind: 'drill' as const,
    participantId,
    drillId,
    metricId: query.get('metricId') ?? undefined,
    cohortId: query.get('cohortId') ?? undefined,
    runFilter: isRunFilter(query.get('runFilter') ?? undefined) ? (query.get('runFilter') as HistoryRunFilter) : 'all',
  };
  if (segments.length === 4) return drillRoute;
  if (segments[4] !== 'runs') return drillRoute;

  const runId = decodeSegment(segments[5]);
  if (runId === undefined) return drillRoute;

  return { kind: 'run', participantId, drillId, runId };
}

export function formatHistoryHash(route: HistoryRoute): string {
  switch (route.kind) {
    case 'participants': {
      const params = new URLSearchParams();
      if (route.query.length > 0) params.set('q', route.query);
      const query = params.toString();
      return query.length > 0 ? `${NAMESPACE_ROOT}?${query}` : NAMESPACE_ROOT;
    }
    case 'drills':
      return `${NAMESPACE_ROOT}/participants/${encodeURIComponent(route.participantId)}`;
    case 'drill': {
      const params = new URLSearchParams();
      if (route.metricId !== undefined) params.set('metricId', route.metricId);
      if (route.cohortId !== undefined) params.set('cohortId', route.cohortId);
      if (route.runFilter !== 'all') params.set('runFilter', route.runFilter);
      const query = params.toString();
      const base = `${NAMESPACE_ROOT}/participants/${encodeURIComponent(route.participantId)}/drills/${encodeURIComponent(route.drillId)}`;
      return query.length > 0 ? `${base}?${query}` : base;
    }
    case 'run':
      return `${NAMESPACE_ROOT}/participants/${encodeURIComponent(route.participantId)}/drills/${encodeURIComponent(route.drillId)}/runs/${encodeURIComponent(route.runId)}`;
  }
}

/** Whether `hash` falls in the `#/history` namespace at all (parseable or not) — the signal
 * `main.ts` uses to gate Pointer Lock / canvas click without caring about the specific route. */
export function isHistoryHash(hash: string): boolean {
  return hash === NAMESPACE_ROOT || hash.startsWith(`${NAMESPACE_ROOT}/`) || hash.startsWith(`${NAMESPACE_ROOT}?`);
}

/** Breadcrumb ancestors from root to `route`, inclusive — used by `HistoryScreen` for both the
 * visible breadcrumb trail and "back to a usable upper level" links on error/not-found states. */
export function historyRouteAncestors(route: HistoryRoute): readonly HistoryRoute[] {
  const root: HistoryRoute = { kind: 'participants', query: '' };
  switch (route.kind) {
    case 'participants':
      return [route];
    case 'drills':
      return [root, route];
    case 'drill':
      return [root, { kind: 'drills', participantId: route.participantId }, route];
    case 'run':
      return [
        root,
        { kind: 'drills', participantId: route.participantId },
        { kind: 'drill', participantId: route.participantId, drillId: route.drillId, runFilter: 'all' },
        route,
      ];
  }
}
