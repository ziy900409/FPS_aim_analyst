# KI-018 — History「搜尋 Participant」逐字輸入時焦點被搶走，遺失除首字元外的所有按鍵

> 類型：accessibility/keyboard-usability latent bug（`route !== lastRoute` 用參考相等比對，無法區分
> 「同路由 in-place 精煉」與「真正導覽」）。
> 狀態：🟢 已修復（2026-09-01，WP-49 owner）。發現於 WP-51 T4（非 WP-51 職權範圍——WP-51 只驗收，不修
> `HistoryScreen.ts`/`ParticipantBrowser.ts` domain UI，見 [WP-51 README §2.6](../exec-plan/active/stage10/wp-51-m18-integration-and-acceptance/README.md)）；修復回流由 WP-49 owner 落地。
> 決策帳本：[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) BD-018。
> 發現脈絡：WP-51 T4 撰寫 History→Replay keyboard-only 驗收測試時，用真實
> `page.keyboard.type(participantId)`（而非既有 spec 慣用的 `locator.fill()`）在「搜尋 Participant」
> 欄位逐字輸入，發現輸入框最終只留下第一個字元。

## 1. 症狀

於真實瀏覽器（Edge，`page.keyboard.type('stage10-a11y-...')`）逐字輸入 History 的「搜尋 Participant」
欄位後，`searchbox` 的值只剩下**第一個字元**（例如輸入 `stage10-a11y-...` 最終欄位顯示 `s`）；此後
按鍵完全沒有進入輸入框（`document.activeElement` 已離開 `<input>`，落在 History 畫面的 `<main>` 容器
上）。這不是本測試獨有的行為——任何真人用實體鍵盤打字進這個欄位都會遇到一模一樣的問題，因為焦點
搶奪發生在瀏覽器層級的同步事件鏈中，與輸入來源（真人按鍵、螢幕閱讀器輸入法、或 Playwright 合成事件）
無關。既有 spec 全部使用 `locator.fill()`（一次性設值＋單一 `input` 事件，不逐字元）才意外避開了
這個問題，從未真正驗證過逐字輸入的使用者體驗。

## 2. 根因

`src/ui/history/ParticipantBrowser.ts` 的 `pushSearch(nextQuery)`：

```ts
function pushSearch(nextQuery: string): void {
  const current = navigator.current;
  if (current === undefined || current.kind !== 'participants') return;
  if (current.query === nextQuery) return;
  navigator.replace({ kind: 'participants', query: nextQuery });
}
searchInput.addEventListener('input', () => pushSearch(searchInput.value));
```

每次 `input` 事件（每個字元）都呼叫一次 `navigator.replace(...)`。`src/history/navigation/
HistoryNavigator.ts` 的 `replace(route)` 每次都建立並指派一個**全新的物件字面量**當 `current`：

```ts
function replace(route: HistoryRoute): void {
  win.history.replaceState(win.history.state, '', formatHistoryHash(route));
  current = route;
  notify();
}
```

`src/ui/history/HistoryScreen.ts` 的 `render()` 用**參考相等**判斷「是否為真正的導覽」以決定要不要
搶焦點：

```ts
if (visible && route !== lastRoute) {
  main.focus();
}
lastRoute = route;
```

由於 `replace()` 每次都給一個新物件（即使 `kind`/`query` 語意上是「同一種畫面、只是精煉了搜尋詞」），
`route !== lastRoute` **每次逐字輸入都成立**，於是 `main.focus()` 在每個字元的 `input` 事件之後都被
呼叫一次——把焦點從使用者正在打字的 `searchInput` 搶回 `<main>`，導致第二個字元以後全部打進了
`<main>`（沒有任何作用，也不會出現在畫面上）。

這個猜測已用真實瀏覽器逐字輸入驗證兩次（見 WP-51 T4 progress.md 的 Surprises 條目），並非讀碼臆測。

## 3. 修復（已落地，2026-09-01）

採用當初列出的候選 1：**語意比較取代參考比較**，未改 `HistoryNavigator` public 介面。

`src/ui/history/HistoryScreen.ts` 新增 `isSameNavigationTarget(a, b)`：

```ts
function isSameNavigationTarget(a: HistoryRoute | undefined, b: HistoryRoute | undefined): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'participants':
      return true; // 只有 `query` 可能不同——同路由 in-place 搜尋精煉，不是導覽
    case 'drills':
      return a.participantId === (b as typeof a).participantId;
    case 'drill':
      return a.participantId === (b as typeof a).participantId && a.drillId === (b as typeof a).drillId;
    case 'run':
      return (
        a.participantId === (b as typeof a).participantId &&
        a.drillId === (b as typeof a).drillId &&
        a.runId === (b as typeof a).runId
      );
  }
}
```

`render()` 的 focus guard 由 `route !== lastRoute` 改為 `!isSameNavigationTarget(route, lastRoute)`。
`kind` 不同（含 `undefined` ↔ 有值）一律視為導覽；同 `kind` 只比對身分性欄位鏈
（`participantId`/`drillId`/`runId`），`query`/`metricId`/`cohortId`/`runFilter` 等精煉欄位變化不算
導覽。因為 `HistoryScreen.render()` 是唯一呼叫 `main.focus()` 的地方，這個修法同時涵蓋了 §4 提到的
`DrillOverview.ts` metric/cohort/run-filter 按鈕（同樣經 `navigator.replace()`）——不需要在
`DrillOverview.ts` 另外改動。

未採候選 2（`HistoryNavigator.subscribe` 帶 `via: 'push' | 'replace' | 'popstate'`）：影響面更大
（需改 public 介面與所有 caller/test），而候選 1 已能用 `HistoryRoute` 既有的判別聯集型別精確表達
「身分性欄位 vs 精煉欄位」的界線，不需臆測。

## 4. 影響面

- **受影響**：History 全域的「搜尋 Participant」逐字輸入（`ParticipantBrowser.ts`）；`DrillOverview.ts`
  的 metric/cohort/run-filter 按鈕點擊（同樣經 `navigator.replace()`，理論上有同一類但較低感知的
  焦點搶奪，未逐一驗證）。
- **不受影響**：`navigator.push()` 觸發的真正導覽（Participant→drill→run 等）——這是既有
  「focus-on-navigation」設計本來就要的行為，不應改變。
- **NFR-51.6 relevance**：WP-51 M18 acceptance 要求「History→Replay 主要流程只用 keyboard 可完成」；
  本 bug 意味著「用鍵盤打字搜尋 Participant」目前不算完全可行——WP-51 T4 的驗收測試改用「不依賴
  搜尋輸入的清單直接 Tab 選取」路徑驗證其餘流程，並將此列為 NFR-51.6 尚未完全達標的已知缺口，直到
  WP-49 修復此處。
- **Ownership**：`ParticipantBrowser.ts`/`HistoryScreen.ts` 為 WP-49 domain UI，依 WP-51 README §2.6
  屬「WP-49 navigation/metric/trend defect」，須回 WP-49 開 regression task 修復，WP-51 本身不得修改。

## 5. Definition of Done（修法落地時驗收）

- [x] `HistoryScreen.ts` 的 focus-on-navigation guard 改用語意判斷，使同路由 in-place 精煉
      （search query／metric／cohort／run filter 變化）不再搶焦點；真正導覽（`push()`/kind 或
      身分性欄位改變）維持既有搶焦點行為不變。
- [x] 新增回歸測試（Playwright，真實 `page.keyboard.type()`，非 `.fill()`）：
      `tests/e2e/history-library.spec.ts` 新增 `KI-018 — Participant search keeps focus through
      real keystroke-by-keystroke typing`，在「搜尋 Participant」欄位逐字輸入完整
      participantId，斷言欄位最終值等於完整輸入字串、`document.activeElement` 停留在該輸入框、
      且能找到該 participant。既有 `.fill()` 測試全數保留未動。
- [x] 補單元測試：`HistoryScreen.test.ts` 新增 4 個 `isSameNavigationTarget` 語意比較案例
      （participants query replace 不 focus main、drill metric/cohort/runFilter replace 不
      focus main、kind 改變仍 focus main、participantId/drillId/runId 改變仍 focus main）。
- [x] 既有 `HistoryScreen.test.ts`/`ParticipantBrowser.test.ts`/`history-navigation.spec.ts`/
      `history-library.spec.ts` 零 regression（`npm run test` 1672 passed / 2 skipped；
      `playwright test history-library.spec.ts history-navigation.spec.ts
      stage10-accessibility.spec.ts --project=edge` 17/17 passed）。
- [x] `npm run typecheck` exit 0。

## 6. Commit（落地時）

`fix(ki-018): History 搜尋輸入改用語意化 focus-on-navigation guard`
