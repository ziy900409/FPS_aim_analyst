import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseExportPayload } from '../../src/data/exportPayloadSchema.ts';
import { createDrillMetricRegistry } from '../../src/history/DrillMetricRegistry.ts';
import type {
  HistoryApiErrorBody,
  HistoryApiErrorCode,
  HistoryApiSuccess,
  HistoryIndexReport,
} from '../../src/history/contracts.ts';
import type { CreateHistoryRepositoryOptions, HistoryRepository } from './HistoryRepository.ts';
import {
  MissingParticipantError,
  PayloadTooLargeError,
  PracticeNotArchivableError,
  createHistoryRepository,
  HistoryRootLockedError,
} from './HistoryRepository.ts';
import { createHistoryAnalysisService, type HistoryAnalysisService } from './HistoryAnalysisService.ts';

/**
 * Loopback/same-origin HTTP surface over the T2 `HistoryRepository` (WP-48 T3, README §2.4). Pure
 * routing/transport/error-mapping — no repository domain logic lives here (task-checklist §3). The
 * dispatcher (`handleHistoryApiRequest`) is framework-neutral; `createHistoryApiMiddleware` is the
 * Node/Connect adapter consumed by `historyPlugin.ts`.
 */

const API_PREFIX = '/api/history';
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

export type HistoryRoute =
  | { readonly kind: 'health' }
  | { readonly kind: 'saveRun' }
  | { readonly kind: 'listParticipants' }
  | { readonly kind: 'listDrills'; readonly participantId: string }
  | { readonly kind: 'listRuns'; readonly participantId: string; readonly drillId: string }
  | { readonly kind: 'loadRun'; readonly runId: string }
  | {
      readonly kind: 'observations';
      readonly participantId: string;
      readonly drillId: string;
      /** Raw query values, unparsed — `handleHistoryApiRequest` owns limit/cursor validation
       * (README §2.6), matching how `saveRun`'s body is validated in the handler, not here. */
      readonly limitRaw: string | undefined;
      readonly cursor: string | undefined;
    };

export function isHistoryApiPath(pathname: string): boolean {
  return pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`);
}

/** Route params are opaque logical IDs compared against the in-memory index — never joined into a
 * filesystem path (FR-48.6) — so no containment/sanitization is needed here, only shape matching.
 * `searchParams` is only consulted for the `observations` route; every other route ignores it, so
 * existing callers that omit it (tests, and every other route match) are unaffected. */
export function matchHistoryRoute(
  method: string,
  pathname: string,
  searchParams?: URLSearchParams,
): HistoryRoute | undefined {
  if (!isHistoryApiPath(pathname)) return undefined;
  const rest = pathname.slice(API_PREFIX.length);
  const rawSegments = rest.split('/').filter((s) => s.length > 0);

  let segments: string[];
  try {
    segments = rawSegments.map((s) => decodeURIComponent(s));
  } catch {
    return undefined;
  }

  if (method === 'GET' && segments.length === 1 && segments[0] === 'health') {
    return { kind: 'health' };
  }
  if (method === 'POST' && segments.length === 1 && segments[0] === 'runs') {
    return { kind: 'saveRun' };
  }
  if (method === 'GET' && segments.length === 1 && segments[0] === 'participants') {
    return { kind: 'listParticipants' };
  }
  if (method === 'GET' && segments.length === 3 && segments[0] === 'participants' && segments[2] === 'drills') {
    return { kind: 'listDrills', participantId: segments[1] as string };
  }
  if (
    method === 'GET' &&
    segments.length === 5 &&
    segments[0] === 'participants' &&
    segments[2] === 'drills' &&
    segments[4] === 'runs'
  ) {
    return { kind: 'listRuns', participantId: segments[1] as string, drillId: segments[3] as string };
  }
  if (
    method === 'GET' &&
    segments.length === 5 &&
    segments[0] === 'participants' &&
    segments[2] === 'drills' &&
    segments[4] === 'observations'
  ) {
    return {
      kind: 'observations',
      participantId: segments[1] as string,
      drillId: segments[3] as string,
      limitRaw: searchParams?.get('limit') ?? undefined,
      cursor: searchParams?.get('cursor') ?? undefined,
    };
  }
  if (method === 'GET' && segments.length === 2 && segments[0] === 'runs') {
    return { kind: 'loadRun', runId: segments[1] as string };
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Lifecycle state (health/423/503 gating, README §2.4 routes table)
// ---------------------------------------------------------------------------

export type HistoryApiState =
  | {
      readonly kind: 'ready';
      readonly repository: HistoryRepository;
      readonly report: HistoryIndexReport;
      readonly analysisService: HistoryAnalysisService;
    }
  | { readonly kind: 'locked' }
  | { readonly kind: 'unavailable' };

/** Never throws — a failed repository init degrades the History API to locked/unavailable instead
 * of taking down the whole dev/preview server (FM-48.4: other app routes must keep working). */
export async function createHistoryApiState(options: CreateHistoryRepositoryOptions): Promise<HistoryApiState> {
  const repository = createHistoryRepository(options);
  try {
    const report = await repository.initialize();
    const analysisService = createHistoryAnalysisService({ repository, registry: createDrillMetricRegistry() });
    return { kind: 'ready', repository, report, analysisService };
  } catch (err) {
    if (err instanceof HistoryRootLockedError) return { kind: 'locked' };
    return { kind: 'unavailable' };
  }
}

export async function closeHistoryApiState(state: HistoryApiState): Promise<void> {
  if (state.kind === 'ready') await state.repository.close();
}

// ---------------------------------------------------------------------------
// Pure dispatcher
// ---------------------------------------------------------------------------

export type HistoryApiBodyResult =
  | { readonly kind: 'json'; readonly value: unknown }
  | { readonly kind: 'too_large' }
  | { readonly kind: 'malformed_json' };

export interface HistoryApiResponse {
  readonly status: number;
  readonly body: HistoryApiSuccess<unknown> | HistoryApiErrorBody;
}

function ok(status: number, data: unknown): HistoryApiResponse {
  return { status, body: { ok: true, data } };
}

function err(
  status: number,
  code: HistoryApiErrorCode,
  message: string,
  details?: readonly { readonly path: string; readonly code: string }[],
): HistoryApiResponse {
  return { status, body: { ok: false, error: { code, message, ...(details !== undefined ? { details } : {}) } } };
}

export async function handleHistoryApiRequest(
  route: HistoryRoute,
  state: HistoryApiState,
  body?: HistoryApiBodyResult,
): Promise<HistoryApiResponse> {
  if (state.kind === 'locked') {
    return err(423, 'HISTORY_ROOT_LOCKED', 'history root is owned by another process');
  }
  if (state.kind === 'unavailable') {
    return err(503, 'HISTORY_UNAVAILABLE', 'history storage is unavailable');
  }
  const { repository, analysisService } = state;

  switch (route.kind) {
    case 'health':
      return ok(200, state.report);
    case 'listParticipants':
      return ok(200, repository.listParticipants());
    case 'listDrills':
      return ok(200, repository.listDrills(route.participantId));
    case 'listRuns':
      return ok(200, repository.listRuns(route.participantId, route.drillId));
    case 'loadRun': {
      const payload = await repository.loadRun(route.runId);
      if (payload === undefined) return err(404, 'RUN_NOT_FOUND', 'run not found');
      return ok(200, payload);
    }
    case 'observations':
      return handleObservations(analysisService, route);
    case 'saveRun':
      return handleSaveRun(repository, body);
  }
}

const DEFAULT_OBSERVATIONS_LIMIT = 100;

async function handleObservations(
  analysisService: HistoryAnalysisService,
  route: Extract<HistoryRoute, { kind: 'observations' }>,
): Promise<HistoryApiResponse> {
  const limit = route.limitRaw === undefined ? DEFAULT_OBSERVATIONS_LIMIT : Number(route.limitRaw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return err(400, 'INVALID_QUERY', 'limit must be an integer between 1 and 100');
  }
  const result = await analysisService.observations(route.participantId, route.drillId, limit, route.cursor);
  if (!result.ok) {
    return result.reason === 'invalid-cursor'
      ? err(400, 'INVALID_QUERY', 'cursor is invalid or does not match this participant/drill')
      : err(400, 'INVALID_QUERY', 'limit must be an integer between 1 and 100');
  }
  return ok(200, result.page);
}

async function handleSaveRun(
  repository: HistoryRepository,
  body: HistoryApiBodyResult | undefined,
): Promise<HistoryApiResponse> {
  if (body === undefined || body.kind === 'malformed_json') {
    return err(400, 'MALFORMED_JSON', 'request body must be valid JSON');
  }
  if (body.kind === 'too_large') {
    return err(413, 'PAYLOAD_TOO_LARGE', 'request body exceeds the size limit');
  }

  const parsed = parseExportPayload(body.value);
  if (!parsed.ok) {
    const details = parsed.errors.map((e) => ({ path: e.path, code: e.code }));
    const unsupported = parsed.errors.some((e) => e.code === 'unsupported_schema');
    return err(422, unsupported ? 'UNSUPPORTED_SCHEMA' : 'INVALID_EXPORT', 'export payload failed validation', details);
  }

  try {
    const result = await repository.saveRun(parsed.payload);
    if (result.disposition === 'conflict') {
      return err(409, 'RUN_CONFLICT', 'a run with the same identity but different content already exists');
    }
    return ok(result.disposition === 'created' ? 201 : 200, result);
  } catch (error) {
    if (error instanceof PracticeNotArchivableError) return err(422, 'PRACTICE_NOT_ARCHIVABLE', error.message);
    if (error instanceof MissingParticipantError) return err(422, 'MISSING_PARTICIPANT', error.message);
    if (error instanceof PayloadTooLargeError) return err(413, 'PAYLOAD_TOO_LARGE', 'payload exceeds the size limit');
    if (error instanceof HistoryRootLockedError) {
      return err(423, 'HISTORY_ROOT_LOCKED', 'history root is owned by another process');
    }
    // Any other failure (e.g. a filesystem error) may carry an absolute path in its message
    // (FR-48.6/48.11 forbid that leaking) — always respond with a fixed, path-free message.
    return err(500, 'STORAGE_IO', 'failed to save run');
  }
}

// ---------------------------------------------------------------------------
// Node/Connect adapter
// ---------------------------------------------------------------------------

export type HistoryApiMiddleware = (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void;

export interface HistoryApiOptions {
  readonly maxPayloadBytes: number;
}

function isLoopbackAddress(address: string | undefined): boolean {
  return address !== undefined && LOOPBACK_ADDRESSES.has(address);
}

function contentLengthExceeds(req: IncomingMessage, maxBytes: number): boolean {
  const header = req.headers['content-length'];
  if (typeof header !== 'string') return false;
  const value = Number(header);
  return Number.isFinite(value) && value > maxBytes;
}

/** Streams the body and counts bytes as they arrive — never buffers past `maxBytes` (NFR-48.1: "不可
 * 先無界限 buffer"). This is the backstop for chunked-encoding requests that skip Content-Length;
 * `contentLengthExceeds` above is the fast path that avoids reading anything at all when the header
 * is present and already too large. */
function readJsonBody(req: IncomingMessage, maxBytes: number): Promise<HistoryApiBodyResult> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;

    const finish = (result: HistoryApiBodyResult): void => {
      if (settled) return;
      settled = true;
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('error', onError);
      resolve(result);
    };

    const onData = (chunk: Buffer): void => {
      if (settled) return;
      total += chunk.length;
      if (total > maxBytes) {
        req.pause();
        finish({ kind: 'too_large' });
        return;
      }
      chunks.push(chunk);
    };

    const onEnd = (): void => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw.trim() === '') {
        finish({ kind: 'malformed_json' });
        return;
      }
      try {
        finish({ kind: 'json', value: JSON.parse(raw) });
      } catch {
        finish({ kind: 'malformed_json' });
      }
    };

    const onError = (): void => finish({ kind: 'malformed_json' });

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
  });
}

function writeResponse(res: ServerResponse, response: HistoryApiResponse, closeConnection: boolean): void {
  const text = JSON.stringify(response.body);
  res.statusCode = response.status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (closeConnection) res.setHeader('Connection', 'close');
  res.end(text);
}

async function dispatch(
  route: HistoryRoute,
  req: IncomingMessage,
  res: ServerResponse,
  state: HistoryApiState,
  options: HistoryApiOptions,
): Promise<void> {
  let body: HistoryApiBodyResult | undefined;
  if (route.kind === 'saveRun') {
    if (contentLengthExceeds(req, options.maxPayloadBytes)) {
      writeResponse(res, err(413, 'PAYLOAD_TOO_LARGE', 'request body exceeds the size limit'), true);
      req.resume();
      return;
    }
    body = await readJsonBody(req, options.maxPayloadBytes);
    if (body.kind === 'too_large') {
      writeResponse(res, err(413, 'PAYLOAD_TOO_LARGE', 'request body exceeds the size limit'), true);
      return;
    }
  }

  const response = await handleHistoryApiRequest(route, state, body);
  writeResponse(res, response, false);
}

/** Connect-style middleware: requests outside `/api/history`, from non-loopback callers, or that
 * don't match one of the six routes all fall through to `next()` (never intercepts Vite
 * assets/HMR — same policy for "not our route" and "not a trusted caller", so an unrecognized
 * caller learns nothing beyond a generic 404, NFR-48.5). */
export function createHistoryApiMiddleware(state: HistoryApiState, options: HistoryApiOptions): HistoryApiMiddleware {
  return (req, res, next) => {
    const method = req.method ?? 'GET';
    const url = req.url ?? '/';
    const [pathnamePart, queryPart] = url.split('?');
    const pathname = pathnamePart ?? '/';

    if (!isHistoryApiPath(pathname)) {
      next();
      return;
    }
    if (!isLoopbackAddress(req.socket.remoteAddress ?? undefined)) {
      next();
      return;
    }
    const searchParams = new URLSearchParams(queryPart ?? '');
    const route = matchHistoryRoute(method, pathname, searchParams);
    if (route === undefined) {
      next();
      return;
    }

    void dispatch(route, req, res, state, options);
  };
}
