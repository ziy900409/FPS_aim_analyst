/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import type { ServerResponse } from 'node:http';
import { historyPlugin } from './server/history/historyPlugin.ts';

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
  // WP-48 T3：history API middleware（Vite dev/preview adapter, D-48.P8）。root/maxPayloadBytes 使用
  // 預設值——正式路徑 data/session-history/（D-48.P9），Playwright 用 FPS_HISTORY_ROOT 覆寫成 temp root。
  plugins: [coopCoep(), historyPlugin()],
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
  // Vitest 收單元/整合測試（`*.test.ts`）：src 下的元件測試 + tests 下的跨模組驗證測試
  // （如 WP-9 T2 `tests/validity/*.test.ts` 計時效度）；e2e（`tests/e2e/*.spec.ts`）交給
  // Playwright（見 playwright.config.ts 的 testDir=tests/e2e，不收 validity）。無此設定時
  // Vitest 預設 glob 會誤收 Playwright specs → `test()` 不相容而紅燈（OQ-T5.1）。
  // 副檔名分工：單元/驗證 .test.ts / e2e .spec.ts。
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
