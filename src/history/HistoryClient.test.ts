import { describe, expect, it, vi } from 'vitest';
import { createHistoryClient, HistoryClientError } from './HistoryClient.ts';
import type { HistoryClientErrorCode } from './HistoryClient.ts';
import { makeAssessmentPayload } from '../../tests/history/payloadFixtures.ts';

/**
 * WP-48 T4 client tests. `fetch` is always injected (never hits a real Node server) — README §2.4
 * / T4.md Step 1. Each test builds a purpose-specific fake `fetch` rather than a shared mock server,
 * matching the fine-grained per-status-code coverage the T4 DoD requires.
 */

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function rawResponse(status: number, text: string): Response {
  return new Response(text, { status, headers: { 'Content-Type': 'application/json' } });
}

/** A `fetch` fake with an explicit `(url, init)` signature, so `mock.calls[0]` is typed as
 * `[string, RequestInit | undefined]` instead of `vi.fn`'s inferred `[]` for a zero-arg callback.
 * The client always passes `init`, so callers destructure it with a non-null assertion. */
function fetchFake(handler: () => Promise<Response>) {
  return vi.fn(async (_url: string, _init?: RequestInit) => handler());
}

/** The client always passes `init`, so callers can drop the `| undefined` after grabbing a call. */
function requestInitOf(call: readonly [string, RequestInit?]): RequestInit {
  const init = call[1];
  if (init === undefined) throw new Error('expected fetch to have been called with an init object');
  return init;
}

/** A `fetch` fake that honors abort: it only settles when `responder()` settles or the request's
 * `AbortSignal` fires — matching real `fetch` abort semantics, which the client relies on for its
 * timeout implementation. */
function abortAwareFetch(responder: () => Promise<Response>) {
  return vi.fn((_url: string, init?: RequestInit) => {
    return new Promise<Response>((resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) {
        reject(new DOMException('aborted', 'AbortError'));
        return;
      }
      const onAbort = (): void => reject(new DOMException('aborted', 'AbortError'));
      signal?.addEventListener('abort', onAbort);
      responder().then(resolve, reject);
    });
  });
}

describe('HistoryClient — URL/method/body construction', () => {
  it('health() issues GET /api/history/health', async () => {
    const fetchSpy = fetchFake(async () => jsonResponse(200, { ok: true, data: { validRunCount: 0 } }));
    const client = createHistoryClient({ fetch: fetchSpy });
    await client.health();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url] = fetchSpy.mock.calls[0];
    const init = requestInitOf(fetchSpy.mock.calls[0]);
    expect(url).toBe('/api/history/health');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
  });

  it('saveRun() issues POST /api/history/runs with the JSON-serialized payload', async () => {
    const payload = makeAssessmentPayload();
    const fetchSpy = fetchFake(async () =>
      jsonResponse(201, {
        ok: true,
        data: {
          disposition: 'created',
          run: {
            runId: 'r1',
            participantId: 'P-001',
            drillId: payload.meta.drillId,
            startedAt: payload.meta.startedAt,
            schemaVersion: 2,
            suspect: false,
            byteLength: 10,
            replaySupport: 'unchecked',
          },
        },
      }),
    );
    const client = createHistoryClient({ fetch: fetchSpy });
    const result = await client.saveRun(payload);
    expect(result.disposition).toBe('created');
    const [url] = fetchSpy.mock.calls[0];
    const init = requestInitOf(fetchSpy.mock.calls[0]);
    expect(url).toBe('/api/history/runs');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual(payload);
  });

  it('listParticipants() issues GET /api/history/participants', async () => {
    const fetchSpy = fetchFake(async () => jsonResponse(200, { ok: true, data: [] }));
    const client = createHistoryClient({ fetch: fetchSpy });
    await client.listParticipants();
    const [url] = fetchSpy.mock.calls[0];
    const init = requestInitOf(fetchSpy.mock.calls[0]);
    expect(url).toBe('/api/history/participants');
    expect(init.method).toBe('GET');
  });

  it('listDrills() URL-encodes the participant id segment', async () => {
    const fetchSpy = fetchFake(async () => jsonResponse(200, { ok: true, data: [] }));
    const client = createHistoryClient({ fetch: fetchSpy });
    await client.listDrills('P 001/weird');
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/history/participants/P%20001%2Fweird/drills');
  });

  it('listRuns() URL-encodes both the participant id and drill id segments', async () => {
    const fetchSpy = fetchFake(async () => jsonResponse(200, { ok: true, data: [] }));
    const client = createHistoryClient({ fetch: fetchSpy });
    await client.listRuns('P 001', 'drill#1');
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/history/participants/P%20001/drills/drill%231/runs');
  });

  it('loadRun() URL-encodes the run id segment and returns typed success data', async () => {
    const payload = makeAssessmentPayload();
    const fetchSpy = fetchFake(async () => jsonResponse(200, { ok: true, data: payload }));
    const client = createHistoryClient({ fetch: fetchSpy });
    const result = await client.loadRun('run id/with slash');
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/history/runs/run%20id%2Fwith%20slash');
    expect(result).toEqual(payload);
  });

  it('observations() URL-encodes segments and omits the query string when no options are given', async () => {
    const fetchSpy = fetchFake(async () =>
      jsonResponse(200, { ok: true, data: { items: [], total: 0, registryVersion: '1.0.0' } }),
    );
    const client = createHistoryClient({ fetch: fetchSpy });
    await client.observations('P 001', 'drill#1');
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/history/participants/P%20001/drills/drill%231/observations');
  });

  it('observations() appends limit/cursor as a query string when given', async () => {
    const fetchSpy = fetchFake(async () =>
      jsonResponse(200, { ok: true, data: { items: [], total: 0, registryVersion: '1.0.0' } }),
    );
    const client = createHistoryClient({ fetch: fetchSpy });
    const result = await client.observations('P-1', 'D-1', { limit: 25, cursor: 'abc def' });
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/history/participants/P-1/drills/D-1/observations?limit=25&cursor=abc+def');
    expect(result).toEqual({ items: [], total: 0, registryVersion: '1.0.0' });
  });

  it('prefixes every request with the configured baseUrl', async () => {
    const fetchSpy = fetchFake(async () => jsonResponse(200, { ok: true, data: [] }));
    const client = createHistoryClient({ fetch: fetchSpy, baseUrl: 'http://127.0.0.1:5173' });
    await client.listParticipants();
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:5173/api/history/participants');
  });
});

describe('HistoryClient — abort behavior', () => {
  it('maps a caller-triggered abort to a HistoryClientError', async () => {
    const controller = new AbortController();
    const fetchSpy = abortAwareFetch(() => new Promise<Response>(() => {})); // never resolves on its own
    const client = createHistoryClient({ fetch: fetchSpy, timeoutMs: 10_000 });
    const promise = client.health(controller.signal);
    controller.abort();
    await expect(promise).rejects.toThrow(HistoryClientError);
    await promise.catch((error: HistoryClientError) => {
      expect(error.code satisfies HistoryClientErrorCode).toBe('TIMEOUT');
      expect(error.retryable).toBe(true);
    });
  });

  it('rejects immediately when the signal is already aborted before the call', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchSpy = abortAwareFetch(() => new Promise<Response>(() => {}));
    const client = createHistoryClient({ fetch: fetchSpy });
    await expect(client.health(controller.signal)).rejects.toThrow(HistoryClientError);
  });
});

describe('HistoryClient — network and timeout mapping (retryable)', () => {
  it('maps a rejected fetch to NETWORK_ERROR (retryable)', async () => {
    const fetchSpy = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const client = createHistoryClient({ fetch: fetchSpy });
    await expect(client.health()).rejects.toMatchObject({ code: 'NETWORK_ERROR', retryable: true });
  });

  it('maps an internal timeout to TIMEOUT (retryable)', async () => {
    const fetchSpy = abortAwareFetch(() => new Promise<Response>(() => {})); // hangs until our own timer aborts it
    const client = createHistoryClient({ fetch: fetchSpy, timeoutMs: 15 });
    await expect(client.health()).rejects.toMatchObject({ code: 'TIMEOUT', retryable: true });
  });
});

describe('HistoryClient — server error code mapping', () => {
  const cases: ReadonlyArray<{
    readonly status: number;
    readonly code: string;
    readonly retryable: boolean;
  }> = [
    { status: 400, code: 'MALFORMED_JSON', retryable: false },
    { status: 404, code: 'RUN_NOT_FOUND', retryable: false },
    { status: 409, code: 'RUN_CONFLICT', retryable: false },
    { status: 413, code: 'PAYLOAD_TOO_LARGE', retryable: false },
    { status: 422, code: 'INVALID_EXPORT', retryable: false },
    { status: 422, code: 'UNSUPPORTED_SCHEMA', retryable: false },
    { status: 422, code: 'PRACTICE_NOT_ARCHIVABLE', retryable: false },
    { status: 422, code: 'MISSING_PARTICIPANT', retryable: false },
    { status: 423, code: 'HISTORY_ROOT_LOCKED', retryable: true },
    { status: 500, code: 'STORAGE_IO', retryable: true },
    { status: 503, code: 'HISTORY_UNAVAILABLE', retryable: true },
  ];

  for (const { status, code, retryable } of cases) {
    it(`maps HTTP ${status}/${code} to retryable=${retryable}`, async () => {
      const fetchSpy = vi.fn(async () => jsonResponse(status, { ok: false, error: { code, message: `${code} happened` } }));
      const client = createHistoryClient({ fetch: fetchSpy });
      await expect(client.health()).rejects.toMatchObject({ code, retryable, status });
    });
  }
});

describe('HistoryClient — malformed response bodies', () => {
  it('rejects a 2xx body that does not match the success contract as PROTOCOL_ERROR', async () => {
    const fetchSpy = vi.fn(async () => jsonResponse(200, { unexpected: true }));
    const client = createHistoryClient({ fetch: fetchSpy });
    await expect(client.health()).rejects.toMatchObject({ code: 'PROTOCOL_ERROR', retryable: false });
  });

  it('rejects a non-JSON 2xx body as PROTOCOL_ERROR', async () => {
    const fetchSpy = vi.fn(async () => rawResponse(200, 'not json'));
    const client = createHistoryClient({ fetch: fetchSpy });
    await expect(client.health()).rejects.toMatchObject({ code: 'PROTOCOL_ERROR', retryable: false });
  });

  it('rejects an error body that does not match the error contract using the status as a fallback', async () => {
    const fetchSpy = vi.fn(async () => jsonResponse(500, { surprising: 'shape' }));
    const client = createHistoryClient({ fetch: fetchSpy });
    await expect(client.health()).rejects.toMatchObject({ code: 'STORAGE_IO', retryable: true });
  });
});
