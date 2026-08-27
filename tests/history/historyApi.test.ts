import { createServer, request as httpRequest } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  closeHistoryApiState,
  createHistoryApiMiddleware,
  createHistoryApiState,
  handleHistoryApiRequest,
  matchHistoryRoute,
} from '../../server/history/historyApi.ts';
import type { HistoryApiState } from '../../server/history/historyApi.ts';
import { createHistoryAnalysisService } from '../../server/history/HistoryAnalysisService.ts';
import type { HistoryRepository } from '../../server/history/HistoryRepository.ts';
import { createDrillMetricRegistry } from '../../src/history/DrillMetricRegistry.ts';
import type {
  HistoryIndexReport,
  HistoryApiErrorBody,
  HistoryApiSuccess,
  HistoryObservationPage,
} from '../../src/history/contracts.ts';
import { makeAssessmentPayload, makeTempRoot, removeTempRoot } from './testHelpers.ts';

/**
 * WP-48 T3 route contract tests. Most cases run against a real `HistoryRepository` on a disposable
 * temp root (higher fidelity, and T2 already proved the repository itself) via a plain Node
 * `http.Server` wrapping the middleware — the same transport shape `historyPlugin.ts` mounts into
 * Vite. A couple of edge cases (500 STORAGE_IO, non-loopback rejection) use a fake repository/req
 * per T3.md's suggested approach, since they're impractical to trigger through the real filesystem.
 */

const MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;

interface HttpResult {
  readonly status: number;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly body: unknown;
}

function startServer(state: HistoryApiState): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const middleware = createHistoryApiMiddleware(state, { maxPayloadBytes: MAX_PAYLOAD_BYTES });
      middleware(req, res, () => {
        res.statusCode = 404;
        res.end();
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') throw new Error('expected a bound TCP address');
      resolve({ server, port: address.port });
    });
  });
}

function request(
  port: number,
  method: string,
  urlPath: string,
  options: { readonly body?: string | Buffer; readonly headers?: Record<string, string> } = {},
): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    // `settled` guards against a benign race: a request that trips the server's early-abort path
    // (413 before/while the body is still being sent) can surface a write-side ECONNRESET on the
    // client *after* the small error response has already fully arrived — that's not a real
    // failure, so only reject on an error the caller never got a response for.
    let settled = false;
    // agent: false — a socket that got reset mid-body (the early-abort tests below) must never be
    // pooled and reused by a later request; each request gets its own fresh connection.
    const req = httpRequest(
      { host: '127.0.0.1', port, method, path: urlPath, headers: options.headers, agent: false },
      (res: IncomingMessage) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          settled = true;
          const raw = Buffer.concat(chunks).toString('utf8');
          let body: unknown;
          try {
            body = raw.length > 0 ? JSON.parse(raw) : undefined;
          } catch {
            body = raw;
          }
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body });
        });
      },
    );
    req.on('error', (e) => {
      if (!settled) reject(e);
    });
    if (options.body !== undefined) req.end(options.body);
    else req.end();
  });
}

describe('matchHistoryRoute', () => {
  it('matches all seven documented routes and rejects everything else', () => {
    expect(matchHistoryRoute('GET', '/api/history/health')).toEqual({ kind: 'health' });
    expect(matchHistoryRoute('POST', '/api/history/runs')).toEqual({ kind: 'saveRun' });
    expect(matchHistoryRoute('GET', '/api/history/participants')).toEqual({ kind: 'listParticipants' });
    expect(matchHistoryRoute('GET', '/api/history/participants/P-1/drills')).toEqual({
      kind: 'listDrills',
      participantId: 'P-1',
    });
    expect(matchHistoryRoute('GET', '/api/history/participants/P-1/drills/D-1/runs')).toEqual({
      kind: 'listRuns',
      participantId: 'P-1',
      drillId: 'D-1',
    });
    expect(matchHistoryRoute('GET', '/api/history/runs/abc')).toEqual({ kind: 'loadRun', runId: 'abc' });

    expect(matchHistoryRoute('GET', '/')).toBeUndefined();
    expect(matchHistoryRoute('GET', '/index.html')).toBeUndefined();
    expect(matchHistoryRoute('DELETE', '/api/history/runs/abc')).toBeUndefined();
    expect(matchHistoryRoute('GET', '/api/history/unknown')).toBeUndefined();
    expect(matchHistoryRoute('GET', '/api/history/runs/%')).toBeUndefined();
  });

  it('matches the observations route and parses its query params only when given (WP-49 T4)', () => {
    expect(matchHistoryRoute('GET', '/api/history/participants/P-1/drills/D-1/observations')).toEqual({
      kind: 'observations',
      participantId: 'P-1',
      drillId: 'D-1',
      limitRaw: undefined,
      cursor: undefined,
    });
    expect(
      matchHistoryRoute(
        'GET',
        '/api/history/participants/P-1/drills/D-1/observations',
        new URLSearchParams('limit=10&cursor=abc'),
      ),
    ).toEqual({ kind: 'observations', participantId: 'P-1', drillId: 'D-1', limitRaw: '10', cursor: 'abc' });
    expect(matchHistoryRoute('POST', '/api/history/participants/P-1/drills/D-1/observations')).toBeUndefined();
  });
});

describe('history API — ready repository (real filesystem, temp root)', () => {
  let root: string;
  let state: HistoryApiState;
  let server: Server;
  let port: number;

  beforeEach(async () => {
    root = await makeTempRoot();
    state = await createHistoryApiState({ root, maxPayloadBytes: MAX_PAYLOAD_BYTES });
    ({ server, port } = await startServer(state));
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeHistoryApiState(state);
    await removeTempRoot(root);
  });

  it('GET /health returns the empty index report and never sets a permissive CORS header', async () => {
    const res = await request(port, 'GET', '/api/history/health');
    expect(res.status).toBe(200);
    const body = res.body as HistoryApiSuccess<HistoryIndexReport>;
    expect(body.ok).toBe(true);
    expect(body.data.validRunCount).toBe(0);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('GET /participants, /drills, /runs are empty on a fresh root', async () => {
    expect((await request(port, 'GET', '/api/history/participants')).body).toEqual({ ok: true, data: [] });
    expect((await request(port, 'GET', '/api/history/participants/P-001/drills')).body).toEqual({
      ok: true,
      data: [],
    });
    expect((await request(port, 'GET', '/api/history/participants/P-001/drills/counterstrafe_reversal_v1/runs')).body).toEqual({
      ok: true,
      data: [],
    });
  });

  it('GET /runs/:runId returns 404 RUN_NOT_FOUND when unknown', async () => {
    const res = await request(port, 'GET', '/api/history/runs/does-not-exist');
    expect(res.status).toBe(404);
    expect((res.body as HistoryApiErrorBody).error.code).toBe('RUN_NOT_FOUND');
  });

  it('POST /runs with malformed JSON returns 400 MALFORMED_JSON', async () => {
    const res = await request(port, 'POST', '/api/history/runs', {
      body: '{not json',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(400);
    expect((res.body as HistoryApiErrorBody).error.code).toBe('MALFORMED_JSON');
  });

  it('POST /runs with an empty body returns 400 MALFORMED_JSON', async () => {
    const res = await request(port, 'POST', '/api/history/runs');
    expect(res.status).toBe(400);
    expect((res.body as HistoryApiErrorBody).error.code).toBe('MALFORMED_JSON');
  });

  it('POST /runs with a valid Assessment payload: created -> existing -> conflict', async () => {
    const payload = makeAssessmentPayload();

    const created = await request(port, 'POST', '/api/history/runs', {
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(created.status).toBe(201);
    const createdBody = created.body as HistoryApiSuccess<{ disposition: string; run: { runId: string } }>;
    expect(createdBody.data.disposition).toBe('created');

    const existing = await request(port, 'POST', '/api/history/runs', {
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(existing.status).toBe(200);
    expect((existing.body as HistoryApiSuccess<{ disposition: string }>).data.disposition).toBe('existing');

    const conflicting = makeAssessmentPayload({ suspect: true });
    const conflict = await request(port, 'POST', '/api/history/runs', {
      body: JSON.stringify(conflicting),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(conflict.status).toBe(409);
    expect((conflict.body as HistoryApiErrorBody).error.code).toBe('RUN_CONFLICT');

    const loaded = await request(port, 'GET', `/api/history/runs/${createdBody.data.run.runId}`);
    expect(loaded.status).toBe(200);
  });

  it('POST /runs with a Practice payload returns 422 PRACTICE_NOT_ARCHIVABLE and writes nothing', async () => {
    const payload = makeAssessmentPayload({ assessment: false });
    const res = await request(port, 'POST', '/api/history/runs', {
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(422);
    expect((res.body as HistoryApiErrorBody).error.code).toBe('PRACTICE_NOT_ARCHIVABLE');
    expect((await request(port, 'GET', '/api/history/participants')).body).toEqual({ ok: true, data: [] });
  });

  it('POST /runs missing meta.session.participantId returns 422 MISSING_PARTICIPANT', async () => {
    const payload = makeAssessmentPayload() as unknown as { meta: { session?: unknown } };
    delete payload.meta.session;
    const res = await request(port, 'POST', '/api/history/runs', {
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(422);
    expect((res.body as HistoryApiErrorBody).error.code).toBe('MISSING_PARTICIPANT');
  });

  it('POST /runs with schemaVersion !== 2 returns 422 UNSUPPORTED_SCHEMA', async () => {
    const payload = makeAssessmentPayload() as unknown as { meta: { schemaVersion: number } };
    payload.meta.schemaVersion = 1;
    const res = await request(port, 'POST', '/api/history/runs', {
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(422);
    expect((res.body as HistoryApiErrorBody).error.code).toBe('UNSUPPORTED_SCHEMA');
  });

  it('POST /runs with a structurally invalid payload returns 422 INVALID_EXPORT', async () => {
    const payload = { ...makeAssessmentPayload(), ticks: 'not-an-array' };
    const res = await request(port, 'POST', '/api/history/runs', {
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(422);
    expect((res.body as HistoryApiErrorBody).error.code).toBe('INVALID_EXPORT');
  });

  it('POST /runs with a Content-Length over 16 MiB returns 413 without ever reading the body', async () => {
    // The fast path only inspects the header — it never waits for/reads any body bytes — so a
    // tiny actual body with a spoofed oversized Content-Length exercises it deterministically,
    // without the TCP RST that a real 16 MiB+ transfer would race against server-side early close.
    const res = await request(port, 'POST', '/api/history/runs', {
      body: Buffer.from('{}'),
      headers: { 'Content-Type': 'application/json', 'Content-Length': String(MAX_PAYLOAD_BYTES + 1) },
    });
    expect(res.status).toBe(413);
    expect((res.body as HistoryApiErrorBody).error.code).toBe('PAYLOAD_TOO_LARGE');
    expect((await request(port, 'GET', '/api/history/participants')).body).toEqual({ ok: true, data: [] });
  });

  it(
    'POST /runs streamed (chunked, no Content-Length) over 16 MiB is rejected and never saved',
    async () => {
      // Without a Content-Length header the server only learns the body is oversized once its
      // streaming byte counter crosses the limit (the backstop for chunked encoding). At that
      // point it closes the connection immediately, which a client still mid-upload commonly
      // observes as ECONNRESET rather than a clean response (ordinary TCP behavior, not a bug) —
      // so this test accepts either outcome and instead asserts the property that actually
      // matters: no run was ever written.
      await new Promise<void>((resolve) => {
        const req = httpRequest(
          {
            host: '127.0.0.1',
            port,
            method: 'POST',
            path: '/api/history/runs',
            headers: { 'Content-Type': 'application/json' },
            agent: false,
          },
          (res: IncomingMessage) => {
            res.resume();
            res.on('end', () => resolve());
          },
        );
        req.on('error', () => resolve());
        const chunk = Buffer.alloc(4 * 1024 * 1024, 'a');
        let written = 0;
        const writeMore = (): void => {
          if (written >= MAX_PAYLOAD_BYTES + chunk.length) {
            req.end();
            return;
          }
          written += chunk.length;
          req.write(chunk, (writeErr) => {
            if (writeErr) return; // expected once the server closes the socket early
            writeMore();
          });
        };
        writeMore();
      });

      const participants = await request(port, 'GET', '/api/history/participants');
      expect(participants.body).toEqual({ ok: true, data: [] });
    },
    15_000,
  );

  it('GET .../observations returns a paginated projection page for a registered exact drill', async () => {
    const payload = makeAssessmentPayload({ drillId: 'spider-shot-v2' });
    const saved = await request(port, 'POST', '/api/history/runs', {
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(saved.status).toBe(201);

    const res = await request(
      port,
      'GET',
      `/api/history/participants/${payload.meta.session!.participantId}/drills/spider-shot-v2/observations`,
    );
    expect(res.status).toBe(200);
    const body = res.body as HistoryApiSuccess<HistoryObservationPage>;
    expect(body.ok).toBe(true);
    expect(body.data.total).toBe(1);
    expect(body.data.registryVersion).toBe('1.0.0');
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].run.drillId).toBe('spider-shot-v2');
    expect(body.data.nextCursor).toBeUndefined();
  });

  it('GET .../observations on an unregistered drill still returns 200 with a typed unregistered-drill item', async () => {
    const payload = makeAssessmentPayload({ drillId: 'hold-click-v1' });
    await request(port, 'POST', '/api/history/runs', {
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await request(
      port,
      'GET',
      `/api/history/participants/${payload.meta.session!.participantId}/drills/hold-click-v1/observations`,
    );
    expect(res.status).toBe(200);
    const body = res.body as HistoryApiSuccess<HistoryObservationPage>;
    expect(body.data.items[0].projection).toEqual({ status: 'unregistered-drill', drillId: 'hold-click-v1' });
    expect(body.data.registryVersion).toBe('unregistered');
  });

  it('GET .../observations rejects an out-of-range limit or an invalid cursor with 400 INVALID_QUERY', async () => {
    const tooBig = await request(port, 'GET', '/api/history/participants/P-1/drills/D-1/observations?limit=101');
    expect(tooBig.status).toBe(400);
    expect((tooBig.body as HistoryApiErrorBody).error.code).toBe('INVALID_QUERY');

    const notInt = await request(port, 'GET', '/api/history/participants/P-1/drills/D-1/observations?limit=abc');
    expect(notInt.status).toBe(400);
    expect((notInt.body as HistoryApiErrorBody).error.code).toBe('INVALID_QUERY');

    const badCursor = await request(
      port,
      'GET',
      '/api/history/participants/P-1/drills/D-1/observations?cursor=not-a-real-cursor',
    );
    expect(badCursor.status).toBe(400);
    expect((badCursor.body as HistoryApiErrorBody).error.code).toBe('INVALID_QUERY');
  });
});

describe('history API — non-loopback caller', () => {
  it('falls through to next() instead of serving a non-loopback request', () => {
    const state: HistoryApiState = { kind: 'locked' }; // any state — rejection happens before dispatch
    const middleware = createHistoryApiMiddleware(state, { maxPayloadBytes: MAX_PAYLOAD_BYTES });
    const req = { method: 'GET', url: '/api/history/health', socket: { remoteAddress: '203.0.113.5' } } as unknown as IncomingMessage;
    let ended = false;
    const res = { end: () => { ended = true; }, setHeader: () => {} } as unknown as ServerResponse;
    let nextCalled = false;
    middleware(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
    expect(ended).toBe(false);
  });
});

describe('history API — locked / unavailable states', () => {
  it('GET /health returns 423 HISTORY_ROOT_LOCKED when another process owns the root, for every route', async () => {
    const root = await makeTempRoot();
    const owner = await createHistoryApiState({ root, maxPayloadBytes: MAX_PAYLOAD_BYTES });
    expect(owner.kind).toBe('ready');
    try {
      const locked = await createHistoryApiState({ root, maxPayloadBytes: MAX_PAYLOAD_BYTES });
      expect(locked.kind).toBe('locked');

      const { server, port } = await startServer(locked);
      try {
        const health = await request(port, 'GET', '/api/history/health');
        expect(health.status).toBe(423);
        expect((health.body as HistoryApiErrorBody).error.code).toBe('HISTORY_ROOT_LOCKED');

        const participants = await request(port, 'GET', '/api/history/participants');
        expect(participants.status).toBe(423);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    } finally {
      await closeHistoryApiState(owner);
      await removeTempRoot(root);
    }
  });

  it('GET /health returns 503 HISTORY_UNAVAILABLE without leaking the root path when init fails for another reason', async () => {
    const root = await makeTempRoot();
    const notADirectory = path.join(root, 'blocked-by-a-file');
    await fs.writeFile(notADirectory, 'x');
    try {
      const state = await createHistoryApiState({ root: notADirectory, maxPayloadBytes: MAX_PAYLOAD_BYTES });
      expect(state.kind).toBe('unavailable');

      const { server, port } = await startServer(state);
      try {
        const res = await request(port, 'GET', '/api/history/health');
        expect(res.status).toBe(503);
        const body = res.body as HistoryApiErrorBody;
        expect(body.error.code).toBe('HISTORY_UNAVAILABLE');
        expect(body.error.message).not.toContain(root);
        expect(body.error.message).not.toContain(notADirectory);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    } finally {
      await removeTempRoot(root);
    }
  });
});

describe('history API — repository failure mapped to 500 STORAGE_IO', () => {
  it('does not leak the underlying error message when saveRun throws unexpectedly', async () => {
    const fakeRepository: HistoryRepository = {
      initialize: async () => ({
        validRunCount: 0,
        invalidFileCount: 0,
        unsupportedFileCount: 0,
        excludedPracticeFileCount: 0,
        rebuiltAt: new Date(0).toISOString(),
      }),
      saveRun: async () => {
        throw new Error('ENOENT: no such file or directory, open \'C:\\Users\\someone\\data\\session-history\\x.json.tmp\'');
      },
      listParticipants: () => [],
      listDrills: () => [],
      listRuns: () => [],
      loadRun: async () => undefined,
      close: async () => {},
    };
    const state: HistoryApiState = {
      kind: 'ready',
      repository: fakeRepository,
      report: await fakeRepository.initialize(),
      analysisService: createHistoryAnalysisService({ repository: fakeRepository, registry: createDrillMetricRegistry() }),
    };
    const payload = makeAssessmentPayload();
    const response = await handleHistoryApiRequest(
      { kind: 'saveRun' },
      state,
      { kind: 'json', value: payload },
    );
    expect(response.status).toBe(500);
    const body = response.body as HistoryApiErrorBody;
    expect(body.error.code).toBe('STORAGE_IO');
    expect(body.error.message).not.toMatch(/[A-Za-z]:\\|ENOENT/);
  });
});
