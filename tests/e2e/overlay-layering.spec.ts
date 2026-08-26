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

test('session launch controls do not overlap the settings panel', async ({ page }) => {
  await page.goto(URL, { waitUntil: 'networkidle' });

  const overlapsSettingsPanel = (expectedVisibleButtons: number) =>
    page.evaluate((expectedCount) => {
      const settingsPanel = document.querySelector('#settings-panel');
      const launchButtons = [...document.querySelectorAll<HTMLButtonElement>('#session-launch-controls button')]
        .filter((button) => button.getBoundingClientRect().height > 0);
      if (settingsPanel === null || launchButtons.length !== expectedCount) return null;

      const panelRect = settingsPanel.getBoundingClientRect();
      return launchButtons
        .filter((button) => {
          const buttonRect = button.getBoundingClientRect();
          return !(
            buttonRect.right <= panelRect.left ||
            buttonRect.left >= panelRect.right ||
            buttonRect.bottom <= panelRect.top ||
            buttonRect.top >= panelRect.bottom
          );
        })
        .map((button) => button.textContent);
    }, expectedVisibleButtons);

  // WP-43 T1：兩個主入口 + 保留的 legacy「實驗 session」。
  await expect.poll(() => overlapsSettingsPanel(3), { timeout: 15_000 }).toEqual([]);

  // 展開研究員三項子選單後，top-left flex layout 仍須把 Settings panel 往下推開。
  await page.getByRole('button', { name: '研究員模式', exact: true }).click();
  await expect.poll(() => overlapsSettingsPanel(6), { timeout: 15_000 }).toEqual([]);
});

test('KI-013：切換研究員模式 / 單一 Drill 調整不拋 TDZ ReferenceError', async ({ page }) => {
  // controls（main.ts 的 drill-select 控制面板）建於檔案尾端，其前有兩個 top-level await
  // （measureDisplayRefresh/measureDisplayHz）；此測試模擬使用者在 controls 建好前就點擊
  // 「研究員模式」→「單一 Drill 調整」，兩者的 click handler 皆會呼叫 syncControlsVisibility()。
  // 修復前（KI-013）controls 是 const，這個時間窗內存取會撞 TDZ 丟出未捕捉的
  // ReferenceError: Cannot access 'controls' before initialization。
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '研究員模式', exact: true }).click();
  await page.getByRole('button', { name: '單一 Drill 調整' }).click();
  await expect.poll(() => page.evaluate(() => document.querySelector('#drill-select') !== null), { timeout: 15_000 }).toBe(true);

  expect(pageErrors).toEqual([]);
});
