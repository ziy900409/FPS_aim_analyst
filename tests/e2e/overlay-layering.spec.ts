import { test, expect } from '@playwright/test';

/**
 * WP-9 緩衝（FR-9.4）— overlay 疊層回歸：結果頁 backdrop 不得吃掉匯出/控制點擊。
 *
 * `#result-screen` 是 `position:fixed; inset:0; pointer-events:auto` 的全螢幕 backdrop
 * （drill 結束顯示 §5 指標）。匯出面板（`#export-panel`）與 drill 控制（`#drill-controls`）
 * 必須疊在此 backdrop **之上**，否則結果頁一顯示，JSON/CSV 與 Restart/Load 雖可見卻不可點
 * （backdrop 攔截點擊）。此為實際遇到的缺陷：export panel 曾為 z-index:11 < backdrop 30。
 *
 * 三個 overlay 皆於 startup 建立（result-screen 初始 display:none 仍在 DOM、z-index 可計算），
 * 故不需驅動到 ended 狀態即可斷言疊層不變式。
 */

const URL = 'http://localhost:5173/';

function zIndexOf(page: import('@playwright/test').Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el === null) return Number.NaN;
    return Number.parseInt(getComputedStyle(el).zIndex, 10);
  }, selector);
}

test('export panel and drill controls stack above the result-screen backdrop', async ({ page }) => {
  await page.goto(URL, { waitUntil: 'networkidle' });

  // 等 async bootstrap 建好三個 overlay。`#drill-controls` 於 main.ts 最後才 append（在 harness
  // 動態 import + measureDisplayHz 的 await 之後），故以它為就緒訊號——result-screen/export-panel
  // 更早建立，它在則三者皆在。
  await expect
    .poll(() => page.evaluate(() => document.querySelector('#drill-controls') !== null), { timeout: 15_000 })
    .toBe(true);

  const [exportZ, controlsZ, resultZ] = await Promise.all([
    zIndexOf(page, '#export-panel'),
    zIndexOf(page, '#drill-controls'),
    zIndexOf(page, '#result-screen'),
  ]);

  expect(Number.isFinite(resultZ)).toBe(true);
  // 互動 overlay 必須高於 backdrop，結果頁顯示時才可點。
  expect(exportZ).toBeGreaterThan(resultZ);
  expect(controlsZ).toBeGreaterThan(resultZ);
});
