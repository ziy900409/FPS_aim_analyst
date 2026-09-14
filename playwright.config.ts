import { defineConfig, devices } from '@playwright/test';

// WP-0 / T2（FR-0.2）— E2E：在真實瀏覽器斷言 crossOriginIsolated === true，不靠肉眼。
// dev 與 preview 兩個 server 都驗：只設 dev 會讓 vite preview（T4 部署前驗證）失去 isolation。
// 用 Playwright 內建 chromium（isolation 由標頭決定，與 WebGPU 無關，故不需 msedge channel）。
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // CI 的 Tier 1 跑在無 GPU 的 hosted runner 上，每個頁面走 SwiftShader 軟體算繪，
  // 單一測試的耗時遠高於本機真 GPU。固定 2 workers（而非依賴 cpus()/2 的預設）並放寬
  // 單測逾時，避免把「機器被灌爆」誤報成功能迴歸 —— 實測本機以較高 worker 數跑
  // chromium-ci 會出現 23 個純逾時失敗，但逐一單獨重跑全部通過。
  workers: process.env.CI ? 2 : undefined,
  timeout: process.env.CI ? 90_000 : 30_000,
  reporter: 'list',
  // 失敗重試時保留 trace：KI-030（history e2e 在多 worker 下 flaky）的根因至今未定，
  // 正是因為「失敗當下的錯誤文字未被保存」。retries 只在 CI 開啟，故這裡也只在 CI 產出 trace。
  use: { trace: 'on-first-retry' },
  // channel 'msedge'：用系統安裝的 Edge（階段 A 鎖 Chrome/Edge 桌面版，與 T1 一致），
  // 免下載 Playwright 內建 chromium 二進位。
  projects: [
    // Tier 2（定版閘）：系統安裝的 Edge + 真實 GPU。階段 A 鎖 Chrome/Edge 桌面版，
    // 這個 project 才是量測效度宣稱所在的環境，`metadata.realGpu` 把這個前提寫明。
    {
      name: 'edge',
      metadata: { realGpu: true },
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    // Tier 1（cloud CI）：Playwright 內建 chromium，跑在無 GPU 的 hosted runner 上。
    // --enable-unsafe-swiftshader 讓 SwiftShader 軟體路徑可用，否則無 GPU 時 WebGL2 也起不來。
    // 這個 project 不具 GPU，故不承擔「backend === 'webgpu'」那條斷言（見 backend.spec.ts）。
    {
      name: 'chromium-ci',
      metadata: { realGpu: false },
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--enable-unsafe-swiftshader'] },
      },
    },
  ],
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5173/',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // WP-48 T3 (NFR-48.6): dev and preview must never share the real data/session-history/ root —
      // distinct temp roots also avoid the two servers racing for the same history root lease (FM-48.4).
      env: { FPS_HISTORY_ROOT: '.playwright-tmp/history-dev' },
    },
    {
      command: 'npm run build && npm run preview',
      url: 'http://localhost:4173/',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { FPS_HISTORY_ROOT: '.playwright-tmp/history-preview' },
    },
  ],
});
