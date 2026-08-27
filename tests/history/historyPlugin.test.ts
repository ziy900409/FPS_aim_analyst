import type { ViteDevServer } from 'vite';
import { createServer as createViteDevServer } from 'vite';
import { describe, expect, it } from 'vitest';
import { historyPlugin } from '../../server/history/historyPlugin.ts';
import { makeTempRoot, removeTempRoot } from './testHelpers.ts';

/**
 * WP-48 T3: exercises the real Vite `configureServer` lifecycle (not just the framework-neutral
 * dispatcher) — mirrors T0 PoC4's proven pattern of acquiring the root lease inside
 * `configureServer` and releasing it on the underlying `httpServer`'s `'close'` event. Every
 * instance uses `configFile: false` so this never touches the project's real `vite.config.ts`
 * (which points at the production `data/session-history/` root, D-48.P9) — NFR-48.6.
 */

// Fixed, far-from-default ports with an explicit IPv4 host: this project's real `npm run dev`
// (port 5173, `::1`) may legitimately be running alongside these tests, and Vite's own
// `strictPort: false` port-hunting starts from its configured default (5173) rather than asking
// the OS for a free one — so `port: 0` is not a reliable way to dodge that collision here.
async function bootDevServer(root: string, port: number): Promise<ViteDevServer> {
  const server = await createViteDevServer({
    configFile: false,
    root: process.cwd(),
    logLevel: 'silent',
    plugins: [historyPlugin({ root })],
    server: { host: '127.0.0.1', port, strictPort: true, middlewareMode: false },
  });
  await server.listen();
  return server;
}

function baseUrl(server: ViteDevServer): string {
  const address = server.httpServer?.address();
  if (address === null || address === undefined || typeof address === 'string') {
    throw new Error('expected a bound TCP address');
  }
  return `http://127.0.0.1:${address.port}`;
}

describe('historyPlugin — Vite dev server lifecycle', () => {
  it(
    'acquires the root lease on configureServer and releases it on close, so a second server can reacquire it',
    async () => {
      const root = await makeTempRoot();
      let serverA: ViteDevServer | undefined;
      let serverB: ViteDevServer | undefined;
      let serverC: ViteDevServer | undefined;
      try {
        serverA = await bootDevServer(root, 18173);
        const healthA = await fetch(`${baseUrl(serverA)}/api/history/health`);
        expect(healthA.status).toBe(200);

        // Same root, still owned by serverA -> locked. Different port: A is still up.
        serverB = await bootDevServer(root, 18174);
        const healthB = await fetch(`${baseUrl(serverB)}/api/history/health`);
        expect(healthB.status).toBe(423);
        await serverB.close();
        serverB = undefined;

        await serverA.close();
        serverA = undefined;

        // Lease released -> a fresh server can acquire it immediately (reusing A's port is fine —
        // A already closed).
        serverC = await bootDevServer(root, 18173);
        const healthC = await fetch(`${baseUrl(serverC)}/api/history/health`);
        expect(healthC.status).toBe(200);
      } finally {
        await serverA?.close();
        await serverB?.close();
        await serverC?.close();
        await removeTempRoot(root);
      }
    },
    20_000,
  );
});
