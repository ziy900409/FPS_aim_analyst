import type { ExportPayload } from '../data/export.ts';
import type {
  HistoryApiErrorBody,
  HistoryApiErrorCode,
  HistoryApiSuccess,
  HistoryDrillSummary,
  HistoryIndexReport,
  HistoryObservationPage,
  HistoryParticipantSummary,
  HistoryRunSummary,
  SaveHistoryRunResult,
} from './contracts.ts';

/**
 * Typed browser client over the WP-48 T3 History API (README §2.4). Owns fetch/timeout/error
 * mapping so callers (T5 `main.ts`, `HistoryPersistence`) never see a URL, an HTTP status code, or
 * a raw `fetch` rejection — only a `HistoryClientError` with a stable `code` and `retryable` flag.
 * No `node:*` import: this module ships in the browser bundle (FR-48.10).
 */

const API_PREFIX = '/api/history';
const DEFAULT_TIMEOUT_MS = 5000;

/** Client-only codes added on top of the server's `HistoryApiErrorCode` for failures that never
 * reach a parsed server error body (network failure, timeout, or a 2xx/error body that doesn't
 * match the typed contract). */
export type HistoryClientErrorCode = HistoryApiErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'PROTOCOL_ERROR';

/** Codes that represent a transient condition worth retrying without changing the request:
 * client-side network/timeout failures, and the server's own transient-service codes (5xx/423).
 * Everything else (malformed input, size limit, policy rejection, not-found, conflict, or a
 * protocol mismatch) will fail the same way again on retry. */
const RETRYABLE_CODES: ReadonlySet<HistoryClientErrorCode> = new Set([
  'NETWORK_ERROR',
  'TIMEOUT',
  'STORAGE_IO',
  'HISTORY_UNAVAILABLE',
  'HISTORY_ROOT_LOCKED',
]);

export class HistoryClientError extends Error {
  readonly code: HistoryClientErrorCode;
  readonly retryable: boolean;
  readonly status: number | undefined;

  constructor(code: HistoryClientErrorCode, message: string, status?: number) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.retryable = RETRYABLE_CODES.has(code);
    this.status = status;
  }
}

export interface HistoryClient {
  health(signal?: AbortSignal): Promise<HistoryIndexReport>;
  saveRun(payload: ExportPayload, signal?: AbortSignal): Promise<SaveHistoryRunResult>;
  listParticipants(signal?: AbortSignal): Promise<readonly HistoryParticipantSummary[]>;
  listDrills(participantId: string, signal?: AbortSignal): Promise<readonly HistoryDrillSummary[]>;
  listRuns(participantId: string, drillId: string, signal?: AbortSignal): Promise<readonly HistoryRunSummary[]>;
  loadRun(runId: string, signal?: AbortSignal): Promise<ExportPayload>;
  observations(
    participantId: string,
    drillId: string,
    options?: { readonly limit?: number; readonly cursor?: string },
    signal?: AbortSignal,
  ): Promise<HistoryObservationPage>;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface HistoryClientOptions {
  /** Injectable for tests; defaults to the global `fetch`. */
  readonly fetch?: FetchLike;
  /** Prefixed onto every request path, e.g. `''` (same-origin) or `http://127.0.0.1:5173`. */
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSuccessBody(value: unknown): value is HistoryApiSuccess<unknown> {
  return isRecord(value) && value.ok === true && 'data' in value;
}

function isErrorBody(value: unknown): value is HistoryApiErrorBody {
  return (
    isRecord(value) &&
    value.ok === false &&
    isRecord(value.error) &&
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string'
  );
}

export function createHistoryClient(options: HistoryClientOptions = {}): HistoryClient {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const baseUrl = options.baseUrl ?? '';
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function request<T>(
    method: string,
    path: string,
    init: { readonly body?: unknown; readonly signal?: AbortSignal } = {},
  ): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onExternalAbort = (): void => controller.abort();
    if (init.signal?.aborted) controller.abort();
    init.signal?.addEventListener('abort', onExternalAbort);

    let response: Response;
    try {
      response = await doFetch(`${baseUrl}${API_PREFIX}${path}`, {
        method,
        headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new HistoryClientError('TIMEOUT', timedOut ? 'request timed out' : 'request was aborted');
      }
      throw new HistoryClientError('NETWORK_ERROR', error instanceof Error ? error.message : 'network request failed');
    } finally {
      clearTimeout(timer);
      init.signal?.removeEventListener('abort', onExternalAbort);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw response.ok
        ? new HistoryClientError('PROTOCOL_ERROR', 'response was not valid JSON', response.status)
        : new HistoryClientError(
            response.status >= 500 ? 'STORAGE_IO' : 'PROTOCOL_ERROR',
            'response was not valid JSON',
            response.status,
          );
    }

    if (response.ok) {
      if (!isSuccessBody(body)) {
        throw new HistoryClientError('PROTOCOL_ERROR', 'response body did not match the expected success shape', response.status);
      }
      return body.data as T;
    }

    if (isErrorBody(body)) {
      throw new HistoryClientError(body.error.code as HistoryClientErrorCode, body.error.message, response.status);
    }
    throw new HistoryClientError(
      response.status >= 500 ? 'STORAGE_IO' : 'PROTOCOL_ERROR',
      `unexpected error response (status ${response.status})`,
      response.status,
    );
  }

  return {
    health: (signal) => request('GET', '/health', { signal }),
    saveRun: (payload, signal) => request('POST', '/runs', { body: payload, signal }),
    listParticipants: (signal) => request('GET', '/participants', { signal }),
    listDrills: (participantId, signal) =>
      request('GET', `/participants/${encodeURIComponent(participantId)}/drills`, { signal }),
    listRuns: (participantId, drillId, signal) =>
      request(
        'GET',
        `/participants/${encodeURIComponent(participantId)}/drills/${encodeURIComponent(drillId)}/runs`,
        { signal },
      ),
    loadRun: (runId, signal) => request('GET', `/runs/${encodeURIComponent(runId)}`, { signal }),
    observations: (participantId, drillId, options = {}, signal) => {
      const params = new URLSearchParams();
      if (options.limit !== undefined) params.set('limit', String(options.limit));
      if (options.cursor !== undefined) params.set('cursor', options.cursor);
      const query = params.toString();
      return request(
        'GET',
        `/participants/${encodeURIComponent(participantId)}/drills/${encodeURIComponent(drillId)}/observations${
          query.length > 0 ? `?${query}` : ''
        }`,
        { signal },
      );
    },
  };
}
