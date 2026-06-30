import { defineConfig, type Plugin } from 'vite';
import type { ServerResponse } from 'node:http';

// WP-0 / T1：階段 A 鎖 Chrome/Edge 桌面版，故 build target 用 esnext，
// 以支援 src/main.ts 的 top-level await（WebGPURenderer 需 async init，ADR-1）。

// WP-0 / T2（FR-0.2/0.4）：對 dev 與 preview server 注入 COOP/COEP，
// 使 crossOriginIsolated === true（把 performance.now() 解析度提升到 ~5 µs，ADR-4）。
// 只設 dev 會讓 vite preview（T4 部署前驗證）失去 isolation，故兩者都設。
function coopCoep(): Plugin {
  const setHeaders = (res: ServerResponse): void => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  };
  return {
    name: 'coop-coep',
    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        setHeaders(res);
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((_req, res, next) => {
        setHeaders(res);
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [coopCoep()],
  // strictPort：固定埠號，讓 Playwright 的 baseURL 斷言可靠（埠被占用時 fail-fast 而非漂移）。
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: {
    target: 'esnext',
  },
  esbuild: {
    target: 'esnext',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
});
