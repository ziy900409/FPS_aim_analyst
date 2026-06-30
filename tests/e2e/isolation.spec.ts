import { test, expect } from '@playwright/test';

// WP-0 / T2（FR-0.2）— dev 與 preview 兩個本機 server 都必須 crossOriginIsolated === true。
// 硬斷言只放在標頭與 crossOriginIsolated（布林、可靠）；解析度量測屬 sanity，記入 progress 不在此斷言。
const targets = [
  { name: 'dev', url: 'http://localhost:5173/' },
  { name: 'preview', url: 'http://localhost:4173/' },
] as const;

for (const { name, url } of targets) {
  test(`${name} server emits COOP/COEP and is cross-origin isolated`, async ({ page }) => {
    const response = await page.goto(url);

    expect(response?.headers()['cross-origin-opener-policy']).toBe('same-origin');
    expect(response?.headers()['cross-origin-embedder-policy']).toBe('require-corp');

    const isolated = await page.evaluate(() => self.crossOriginIsolated);
    expect(isolated).toBe(true);
  });
}
