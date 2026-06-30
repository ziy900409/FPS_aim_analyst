import { defineConfig } from 'vite';

// WP-0 / T1：階段 A 鎖 Chrome/Edge 桌面版，故 build target 用 esnext，
// 以支援 src/main.ts 的 top-level await（WebGPURenderer 需 async init，ADR-1）。
// COOP/COEP headers plugin 於 T2 加入本檔（FR-0.2/0.4）。
export default defineConfig({
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
