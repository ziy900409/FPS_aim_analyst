import path from 'node:path';
import process from 'node:process';
import type { Plugin } from 'vite';
import { closeHistoryApiState, createHistoryApiMiddleware, createHistoryApiState } from './historyApi.ts';
import type { HistoryApiMiddleware } from './historyApi.ts';

/**
 * Vite dev + preview adapter for the History API (WP-48 T3, OQ-48.1 default / D-48.P8). Mirrors the
 * T0 PoC4 lifecycle: acquire the repository/lease inside `configureServer`/`configurePreviewServer`,
 * release on the underlying `httpServer`'s `'close'` event (both hooks share the same close-then-
 * emit-'close' path in Vite's internals, so one release strategy covers dev and preview).
 */

export interface HistoryPluginOptions {
  readonly root?: string;
  readonly maxPayloadBytes?: number;
}

const DEFAULT_MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;

function resolveRoot(options: HistoryPluginOptions): string {
  if (options.root !== undefined) return path.resolve(options.root);
  return path.resolve(process.cwd(), process.env.FPS_HISTORY_ROOT ?? 'data/session-history');
}

interface HistoryPluginHost {
  readonly middlewares: { use: (fn: HistoryApiMiddleware) => void };
  readonly httpServer: { once: (event: 'close', listener: () => void) => void } | null;
}

async function mountHistoryApi(server: HistoryPluginHost, root: string, maxPayloadBytes: number): Promise<void> {
  const state = await createHistoryApiState({ root, maxPayloadBytes });
  server.middlewares.use(createHistoryApiMiddleware(state, { maxPayloadBytes }));
  server.httpServer?.once('close', () => {
    void closeHistoryApiState(state);
  });
}

export function historyPlugin(options: HistoryPluginOptions = {}): Plugin {
  const root = resolveRoot(options);
  const maxPayloadBytes = options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES;

  return {
    name: 'fps-history-api',
    configureServer(server) {
      return mountHistoryApi(server, root, maxPayloadBytes);
    },
    configurePreviewServer(server) {
      return mountHistoryApi(server, root, maxPayloadBytes);
    },
  };
}
