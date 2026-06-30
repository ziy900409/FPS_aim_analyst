import { test, expect } from '@playwright/test';

// WP-0 / T3（FR-0.3）— 在真實瀏覽器驗證 backend 偵測「實際讀到 renderer.backend」的路徑可跑通。
// createRenderer 會 console.info('[render backend]', backend)；此處攔截該訊息斷言值合法。
// 注意：divergence（gpu 存在但 renderer fallback）無法在真實瀏覽器穩定重現，
// 由 createRenderer.test.ts 的 resolveBackend 單元測試涵蓋；此 e2e 證明 renderer 實際 backend
// 讀取路徑（renderer.backend.isWebGPUBackend）端到端不丟例外且產出合法值。
test('dev server reports a valid render backend from the actual renderer', async ({
  page,
}) => {
  const backends: string[] = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.startsWith('[render backend]')) {
      backends.push(text.replace('[render backend]', '').trim());
    }
  });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await expect.poll(() => backends.length).toBeGreaterThan(0);

  const backend = backends[0];
  expect(['webgpu', 'webgl2']).toContain(backend);
  // 受測機 navigator.gpu === true（T0 記錄），且 WebGPU init 成功 → 應為 webgpu。
  expect(backend).toBe('webgpu');
});
