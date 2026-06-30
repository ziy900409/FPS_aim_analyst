import { defineConfig, devices } from '@playwright/test';

// WP-0 / T2（FR-0.2）— E2E：在真實瀏覽器斷言 crossOriginIsolated === true，不靠肉眼。
// dev 與 preview 兩個 server 都驗：只設 dev 會讓 vite preview（T4 部署前驗證）失去 isolation。
// 用 Playwright 內建 chromium（isolation 由標頭決定，與 WebGPU 無關，故不需 msedge channel）。
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  // channel 'msedge'：用系統安裝的 Edge（階段 A 鎖 Chrome/Edge 桌面版，與 T1 一致），
  // 免下載 Playwright 內建 chromium 二進位。
  projects: [{ name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } }],
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5173/',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run build && npm run preview',
      url: 'http://localhost:4173/',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
