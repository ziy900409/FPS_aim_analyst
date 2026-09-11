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
 *
 * WP-65 T6：待命／倒數 overlay（`#drill-start-overlay`，T3）加入同一張疊層表。它有兩條與眾不同
 * 的不變式：① 必須**高於** HUD（18）與 rest backdrop（20），否則提示被壓灰就失去作用；
 * ② `pointer-events:none` —— 它在待命相位覆蓋整個視窗（`inset:0`），若吃掉點擊，取鎖就永遠發不
 * 出去、待命閘再也解不開（DrillStartOverlay.ts 稱之為「本檔最關鍵的一行」）。
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

  const [exportZ, controlsZ, resultZ, startZ, hudZ, restZ] = await Promise.all([
    zIndexOf(page, '#export-panel'),
    zIndexOf(page, '#drill-controls'),
    zIndexOf(page, '#result-screen'),
    zIndexOf(page, '#drill-start-overlay'),
    zIndexOf(page, '#metrics-hud'),
    zIndexOf(page, '#rest-overlay'),
  ]);

  expect(Number.isFinite(resultZ)).toBe(true);
  // 互動 overlay 必須高於 backdrop，結果頁顯示時才可點。
  expect(exportZ).toBeGreaterThan(resultZ);
  expect(controlsZ).toBeGreaterThan(resultZ);

  // WP-65 T3/T6 — 待命／倒數 overlay 夾在 HUD/rest backdrop 之上、結果頁與控制項之下。
  expect(Number.isFinite(startZ)).toBe(true);
  expect(startZ).toBeGreaterThan(hudZ);
  expect(startZ).toBeGreaterThan(restZ);
  expect(startZ).toBeLessThan(resultZ);
  expect(startZ).toBeLessThan(controlsZ);
});

test('the arming overlay covers the viewport without ever swallowing the lock click', async ({ page }) => {
  await page.goto(URL, { waitUntil: 'networkidle' });

  const overlay = page.locator('#drill-start-overlay');
  // 開機即待命（WP-65 T2）⇒ overlay 此刻是可見的，這正是「它會不會吃掉點擊」有意義的時刻。
  await expect(overlay).toBeVisible({ timeout: 15_000 });
  await expect(overlay).toHaveCSS('pointer-events', 'none');

  // 不是讀樣式而已：實際在 overlay 覆蓋的正中央做 hit-test，topmost element 必須是 canvas
  // （點擊穿透），不是 overlay 自己。
  const topmost = await page.evaluate(() => {
    const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    return { id: el?.id ?? null, tag: el?.tagName ?? null };
  });
  expect(topmost.id).not.toBe('drill-start-overlay');
  expect(topmost.tag).toBe('CANVAS');
});

test('Drill Results keeps export, return, and confirmed re-test actions within the dialog', async ({ page }) => {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await expect
    .poll(() => page.evaluate(() => Boolean((window as unknown as { __fpsTest?: unknown }).__fpsTest)), {
      timeout: 15_000,
    })
    .toBe(true);

  await page.evaluate(() => {
    const harness = (window as unknown as {
      __fpsTest: { startDrill(id: string): void; showResult(): void };
    }).__fpsTest;
    harness.startDrill('counterstrafe_ad_v1');
    harness.showResult();
  });

  const results = page.locator('#result-screen');
  await expect(results.getByRole('button', { name: '再測目前 Drill' })).toBeVisible();
  await expect(results.getByRole('button', { name: '匯出 JSON' })).toBeVisible();
  await expect(results.getByRole('button', { name: '匯出 CSV' })).toBeVisible();
  await expect(results.getByRole('button', { name: '返回設定' })).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await results.getByRole('button', { name: '再測目前 Drill' }).click();
  await expect(results).toBeHidden();
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

  // WP-43 T1：兩個主入口 + WP-49 T1「歷史紀錄」入口 + 保留的 legacy「實驗 session」。
  await expect.poll(() => overlapsSettingsPanel(4), { timeout: 15_000 }).toEqual([]);

  // 展開研究員子選單後，top-left flex layout 仍須把 Settings panel 往下推開。
  // 子選單 append 進 `#session-launch-controls`，所以展開後的按鈕數 = 4 個啟動入口 + 研究員項目。
  // WP-54 T6（2026-09-03）新增第四個研究員入口「Tracking pilot」後這個守衛數字就過期了：它固定
  // 回 null、poll 只能逾時，因此本檔自 2026-09-03 起一直是紅的（WP-58 T6 對帳時發現）。
  await page.getByRole('button', { name: '研究員模式', exact: true }).click();
  await expect.poll(() => overlapsSettingsPanel(8), { timeout: 15_000 }).toEqual([]);
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
