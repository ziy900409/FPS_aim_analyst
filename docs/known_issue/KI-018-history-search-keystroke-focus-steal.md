# KI-018 — History「搜尋 Participant」逐字輸入時焦點被搶走，遺失除首字元外的所有按鍵

> 類型：accessibility/keyboard-usability latent bug（`route !== lastRoute` 用參考相等比對，無法區分
> 「同路由 in-place 精煉」與「真正導覽」）。
> 狀態：🔴 診斷完成，修法待落地（發現於 WP-51 T4，非 WP-51 職權範圍——本 WP 只驗收，不修
> `HistoryScreen.ts`/`ParticipantBrowser.ts` domain UI，見 [WP-51 README §2.6](../exec-plan/active/stage10/wp-51-m18-integration-and-acceptance/README.md)）。
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

## 3. 修復計畫（尚未落地）

`HistoryScreen.ts` 的 focus-on-navigation guard 需要把「真正的導覽」（`push()`/hash 變化/Back-Forward，
路由的 `kind` 或身分性欄位改變）與「同路由 in-place 精煉」（`replace()` 只改變 `query`/`metricId`/
`cohortId`/`runFilter` 等篩選欄位，`kind` 與身分性欄位不變）區分開來，只在前者才 `main.focus()`。
候選作法（尚未拍板，留給 WP-49 決定）：

1. **語意比較取代參考比較**：把 `route !== lastRoute` 換成「`kind` 不同，或同 `kind` 下的身分性欄位
   （`participantId`/`drillId`/`runId`，視 `kind` 而定）不同」——`query`/`metricId`/`cohortId`/
   `runFilter` 的變化不算「導覽」。
2. **由 `HistoryNavigator` 分辨 push vs replace**：`subscribe` 的 callback 多帶一個
   `{ via: 'push' | 'replace' | 'popstate' }` 標記，`HistoryScreen` 只在 `via !== 'replace'` 時才
   `main.focus()`。這個作法更明確（不用臆測「這次 replace 算不算導覽」），但要改
   `HistoryNavigator` 的 public 介面，影響面比選項 1 大。

兩者都需要確認不會破壞 T1 既有的「focus-on-navigation」既有測試（`HistoryScreen.test.ts`）與 Back/
Forward、metric/cohort 選擇器切換（`DrillOverview.ts` 同樣透過 `navigator.replace()` driving
metric/cohort 篩選，可能有同一類但影響較小的表現——切按鈕本身在點擊後通常不需要保留焦點在按鈕上，
但仍建議一併檢查該路徑是否也不必要地搶焦點）。

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

- [ ] `HistoryScreen.ts` 的 focus-on-navigation guard 改用語意判斷（或 `HistoryNavigator` 的
      push/replace 標記），使同路由 in-place 精煉（search query／metric／cohort／run filter 變化）
      不再搶焦點；真正導覽（`push()`）維持既有搶焦點行為不變。
- [ ] 新增回歸測試（Playwright，真實 `page.keyboard.type()`，非 `.fill()`）：在「搜尋 Participant」
      欄位連續輸入多個字元，斷言欄位最終值等於完整輸入字串、且過程中 `document.activeElement`
      始終停留在該輸入框。
- [ ] 既有 `HistoryScreen.test.ts`/`ParticipantBrowser.test.ts`/`history-navigation.spec.ts`/
      `history-library.spec.ts` 零 regression。
- [ ] `npm run typecheck` exit 0。

## 6. Commit（落地時）

`fix(ki-018): History 搜尋輸入改用語意化 focus-on-navigation guard`
