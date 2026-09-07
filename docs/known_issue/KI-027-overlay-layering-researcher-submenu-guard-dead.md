# KI-027 — overlay-layering 的「研究員子選單展開」重疊守衛已失效（過期按鈕數常數）

> 類型：E2E 回歸守衛失效（test-only defect，**production 無缺陷**）。
> 狀態：🔴 **未修（已診斷，含量測）**。發現於 2026-09-07 WP-56 T-exit 全量 Playwright。
> 決策帳本：[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) §1 已列索引；尚無 `BD-027`——本 KI 只有診斷與修改計畫，尚未落地修復。
> 相關：[KI-003](KI-003-top-left-controls-overlap.md)（本守衛的來源）· [KI-013](KI-013-controls-tdz-referenceerror-on-early-researcher-click.md)（同一顆「研究員模式」按鈕）

## 1. 症狀

`npm run test:e2e` 有 **1 個穩定失敗**（2026-09-07：86 passed／1 failed）：

```text
tests/e2e/overlay-layering.spec.ts:74
  › session launch controls do not overlap the settings panel

Error: expect(received).toEqual(expected)
  Expected: []
  Received: null
  Timeout 15000ms exceeded while waiting on the predicate
  at overlay-layering.spec.ts:103
```

失敗點是該 test 的**第二個**斷言（展開研究員子選單之後）；第一個斷言（收合狀態、4 顆按鈕）通過。

此失敗**不是新的**：WP-56 T0（2026-09-04）在 `production code diff = 0` 的條件下就記錄過它（見 [WP-56 progress.md](../exec-plan/active/stage12/wp-56-micro-flick-test-scene/progress.md) T0 Evidence Log：「overlay helper 回 `null` 1 項」），當時判定為既存 baseline failure、未越界修。

## 2. 根因

錯誤訊息**描述的不是它實際檢查到的東西**。helper 在算重疊之前先做數量檢查並 short-circuit：

```ts
// tests/e2e/overlay-layering.spec.ts
const launchButtons = [...document.querySelectorAll<HTMLButtonElement>('#session-launch-controls button')]
  .filter((button) => button.getBoundingClientRect().height > 0);
if (settingsPanel === null || launchButtons.length !== expectedCount) return null;   // ← 這裡就回 null
```

而斷言仍寫死 7：

```ts
// WP-43 T1：兩個主入口 + WP-49 T1「歷史紀錄」入口 + 保留的 legacy「實驗 session」。
await expect.poll(() => overlapsSettingsPanel(4), { timeout: 15_000 }).toEqual([]);   // ✅ 4 顆，通過
await page.getByRole('button', { name: '研究員模式', exact: true }).click();
await expect.poll(() => overlapsSettingsPanel(7), { timeout: 15_000 }).toEqual([]);   // ❌ 實際 8 顆
```

實際數量是 **8**，因為 `ResearcherMenu` 有 **4** 個子選單按鈕、且整個 `#researcher-menu` 被掛進 `#session-launch-controls` 之內：

- [`src/ui/ResearcherMenu.ts`](../../src/ui/ResearcherMenu.ts)：`單一 Drill 調整`、`解析度 protocol`、`BR protocol`、**`Tracking pilot`**。第 4 顆由 **WP-54 / T6** 加入（`onSelectTrackingPilot`），該 WP 沒有同步更新此常數。
- [`src/main.ts`](../../src/main.ts)：`createResearcherMenu({ parent: sessionLaunchControls, ... })` ⇒ 展開後 `#session-launch-controls button` = 4（頂層）+ 4（子選單）= **8**。

`8 !== 7` ⇒ helper 恆回 `null` ⇒ `expect.poll(...).toEqual([])` 永不滿足 ⇒ 15 s timeout。

**真正的危害不是這一個紅燈，而是這個守衛已經死了**：`return null` 發生在 bounding-box 相交過濾**之前**，所以自 WP-54 加入第 4 個子選單項起，「研究員子選單展開時，flex 版面仍把 SettingsPanel 推開」這條 KI-003 不變式**一直沒有被真正驗證過**。紅燈是唯一提示，但它的訊息（`Expected [] Received null`）看起來像是重疊判定的結果，把讀者導向錯誤方向。

## 2.1 量測：不變式其實仍然成立（2026-09-07）

以 throwaway probe 用**正確**數量重跑同一段 bounding-box 邏輯（Edge、Playwright `Desktop Edge` 預設 viewport，與原 test 同條件）：

| 狀態 | 可見按鈕數 | `#settings-panel` top | 相交按鈕 |
|---|---|---|---|
| 收合 | 4（`選手測試 Session`／`研究員模式`／`歷史紀錄`／`實驗 session`） | 188 | **`[]`** |
| 展開 | **8**（上列 + `單一 Drill 調整`／`解析度 protocol`／`BR protocol`／`Tracking pilot`） | 405.5 | **`[]`** |

SettingsPanel 的 top 由 188 被推到 405.5，證明 KI-003 建立的 `#top-left-controls` column-flex 容器在 4 個子選單項下**仍正常把面板往下推開**。

⇒ **結論：layout 沒有回歸，錯的是常數。** 修法是把 7 改成 8，而不是改版面。（此結論來自 probe 量測；落地時仍須由轉綠的 test 本身複驗。）

## 3. 修改計畫

### 3.1 必要修正

把展開狀態的期望值由 `7` 改為 `8`。

### 3.2 建議一併消除這個失效模式（否則下一次加選單項會重演）

問題的本質是「數量不符」與「發生重疊」共用 `null` / `[]` 這一個回傳通道，導致守衛可以在無人察覺下停止檢查。建議兩者之一：

- **Option A（推薦）**：讓 helper 回傳結構化結果（例如 `{ count, overlapping }`），斷言分成兩句——`expect(count).toBe(8)` 與 `expect(overlapping).toEqual([])`。數量漂移時錯誤訊息會直接說出「預期 8 顆、實際 N 顆」，且**重疊檢查照樣執行**，不會被短路掉。
- **Option B**：不寫死數量，改由 DOM 推導（頂層按鈕數 + 子選單按鈕數），只斷言重疊為空。缺點：失去「選單項數意外變動」這個附帶偵測能力，故不優先。

**不採**：只把 `7` 改成 `8` 而不動回傳通道——這會讓同一個陷阱留在原地等著下一個加選單項的 WP。

### 3.3 落地紀律

依 [BUGFIX-DECISIONS.md §寫入慣例](BUGFIX-DECISIONS.md)（承 BD-001 的偏離決議）：先在工作區證實 test 為**紅**（重現本 KI），再修正並轉綠，測試與修法合併為單一已驗證綠的 commit。

## 4. 影響範圍

- **production code：0 改動。** `ResearcherMenu`、`main.ts` 的版面與可見性行為皆正確、無需變更。
- 只動 `tests/e2e/overlay-layering.spec.ts`。
- 不涉及 sim tick、輸入、recorder、匯出資料語意或任何研究構念。
- 修好之後 `npm run test:e2e` 才會真正 exit 0；在此之前該指令的「1 failed」屬本 KI，不應歸因給其他 WP。

## 5. 驗證計畫

1. **RED**：現況即紅（`Expected [] Received null`）。
2. **GREEN**：`npx playwright test tests/e2e/overlay-layering.spec.ts --project=edge` 全綠，且展開狀態的相交清單為 `[]`（而非因短路而未檢查）。
3. `npm run test:e2e` exit 0。
4. `npm run typecheck` exit 0。

## 6. 遺留 Open Questions

- **OQ-KI27-1**：按鈕數是否該完全不寫死？目前 `4` 與 `8` 兩個常數都需要在每次增刪左上角入口時手動同步；WP-43／WP-49／WP-54 已各發生一次漂移（WP-54 那次沒被同步）。若採 Option A，至少數量漂移會有可讀訊息；是否進一步改為 DOM 推導由 UI owner 決定。
- **OQ-KI27-2**：本 test 只在 Playwright `Desktop Edge` 預設 viewport 驗證。子選單展開後 SettingsPanel 被推到 top≈405.5、bottom≈585，在較矮的 viewport（例如 720p 以下或瀏覽器縮放）可能溢出視窗底部。這是**本 KI 未涵蓋**的另一個問題，需要時應另立 KI，不要塞進本次修正。

## 7. 帳本狀態

[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) §1 的 Known Issues 索引已加入本 KI（狀態 🔴 修法待落地）。依該帳本的寫入慣例，`BD-027` 於修復**落地時**才寫入（記錄實際選定的修法、理由與偏離），落地時同步翻新：(a) 本 doc 的狀態列、(b) 帳本條目、(c) §1 索引列狀態。
