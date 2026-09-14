import { test, expect } from '@playwright/test';

// WP-0 / T3（FR-0.3）— 在真實瀏覽器驗證 backend 偵測「實際讀到 renderer.backend」的路徑可跑通。
// createRenderer 會 console.info('[render backend]', backend)；此處攔截該訊息斷言值合法。
// 注意：divergence（gpu 存在但 renderer fallback）無法在真實瀏覽器穩定重現，
// 由 createRenderer.test.ts 的 resolveBackend 單元測試涵蓋；此 e2e 證明 renderer 實際 backend
// 讀取路徑（renderer.backend.isWebGPUBackend）端到端不丟例外且產出合法值。
test('dev server reports a valid render backend from the actual renderer', async (
  { page },
  testInfo,
) => {
  // createRenderer 以同一個 '[render backend]' 前綴發兩種訊息：console.info 帶 backend 值，
  // console.warn 帶 divergence 警告（navigator.gpu 存在但實際 fallback）。只比對前綴會把警告
  // 全文也收進 backends，讓 backends[0] 變成警告字串 —— 在有 GPU 的機器上警告從不觸發，
  // 所以這個缺陷一直沒被打到；Playwright 內建 chromium 會（有 navigator.gpu、取不到 adapter）。
  // 依 msg.type() 分流，divergence 因此變成可觀測的訊號，而不是污染斷言。
  const backends: string[] = [];
  const divergenceWarnings: string[] = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (!text.startsWith('[render backend]')) return;
    const rest = text.replace('[render backend]', '').trim();
    if (msg.type() === 'warning') divergenceWarnings.push(rest);
    else backends.push(rest);
  });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await expect
    .poll(() => backends.length, { timeout: 20_000, intervals: [100, 250, 500, 1_000] })
    .toBeGreaterThan(0);

  const backend = backends[0];
  expect(['webgpu', 'webgl2']).toContain(backend);

  // divergence（gpu 存在但 renderer fallback）本身不是失敗條件——resolveBackend 的契約就是
  // 「以實際 backend 為準」。但它必須與實際 backend 一致，否則警告與回報值在說兩件事。
  if (divergenceWarnings.length > 0) expect(backend).toBe('webgl2');

  // 受測機 navigator.gpu === true（T0 記錄），且 WebGPU init 成功 → 應為 webgpu。
  // 這條只在**有真實 GPU** 的機器上成立：無 GPU 時 WebGPURenderer 會依 createRenderer.ts 的
  // 設計 fallback 成 WebGL2（那正是 resolveBackend 要抓的情況）。原本這個前提是隱含的
  // 「受測機 = 研究者桌機」；Tier 1 的 cloud runner 沒有 GPU，故改由 project metadata 明寫。
  // 注意這不是放寬斷言：webgpu 證據仍然必須由 Tier 2（`edge` project，真 GPU + Edge）產生。
  test.skip(
    testInfo.project.metadata?.realGpu !== true,
    'backend === "webgpu" 需要真實 GPU；此 project 標記為無 GPU（Tier 1 cloud runner）。',
  );
  expect(backend).toBe('webgpu');
});
