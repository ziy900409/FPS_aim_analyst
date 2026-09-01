# KI-017 — 過早點擊 Run Detail「3D 重播」丟出 TDZ ReferenceError（`replayController`）

> 類型：模組頂層初始化順序（top-level await 期間 UI 已可互動，但依賴的變數還沒賦值）——與
> [KI-013](KI-013-controls-tdz-referenceerror-on-early-researcher-click.md) 同一類根因，這次是不同的
> 頂層 `const`（`replayController`）。KI-013 §6 OQ-KI13-1 當時已預告「同一類結構性風險可能出現在其他
> 晚宣告的頂層 `const`」——本次即為該預告的具體重現。
> 狀態：✅ 已修復（2026-09-01，WP-50 owner 修復；發現於 WP-51 T4，依
> [WP-51 README §2.6](../exec-plan/active/stage10/wp-51-m18-integration-and-acceptance/README.md)
> 回流到 WP-50）。
> 決策帳本：[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) BD-017。
> 發現脈絡：WP-51 T4 撰寫 History→Replay keyboard-only 驗收測試（`tests/e2e/stage10-accessibility.spec.ts`）時，
> 因測試未先等待 dev-only `window.__fpsTest` 掛上（其餘既有 dev-mode E2E spec 皆有此等待，唯獨這支新測試漏了），
> 比一般測試更快地走完 History→Participant→drill→run→「3D 重播」，意外重現。

## 1. 症狀

真實瀏覽器 console（`page.on('pageerror', ...)` 捕捉）：

```
ReferenceError: Cannot access 'replayController' before initialization
    at Object.onReplay (http://localhost:5173/src/main.ts:532:5)
    at HTMLButtonElement.<anonymous> (http://localhost:5173/src/ui/history/HistoricalRunDetail.ts:59:13)
```

使用者體驗上：點擊「3D 重播」（無論滑鼠 click 或鍵盤 Enter/Space——兩者觸發同一個 DOM `click` 事件、
同一個 handler）沒有任何反應，Replay 畫面不會打開，也沒有任何可見的錯誤訊息或狀態變化——例外被拋在
事件 handler 內，不會中斷模組其餘頂層程式碼的執行，肉眼幾乎不可能察覺（與 KI-013 §2 最後一段描述的
「表面上看起來功能正常，例外訊息只安靜留在 console」是同一種隱蔽性）。

## 2. 根因

`main.ts` 頂層依序：

1. `historyScreenHandle = createHistoryScreen({ ..., onReplay(runId) { ...
   replayController.open(...); } })`（約 main.ts:691-703）——`onReplay` 這個 closure 在此處就已經
   建立並傳入 `HistoryScreen`，而 `HistoryScreen` 內部的 `HistoricalRunDetail` 早在使用者一路
   History→Participant→drill→run 導覽完成時就已經把「3D 重播」按鈕建立、`disabled` 解除並掛上
   `click` listener（`HistoricalRunDetail.ts:96-99` `replayButton?.addEventListener('click', () => {
   ...options.onReplay(currentRunId); })`）——此時按鈕**已存在且可點擊**。
2. `onReplay` 內讀取的 `replayController`，其 `const replayController = createReplayController({...})`
   要到檔案尾端（約 main.ts:1491）才執行——中間隔著 WebGPU renderer 與其他 async 初始化的 top-level
   `await`（ADR-1「bootstrap 必須 async，`await renderer.init()`」），期間會把控制權交還給
   event loop，讓已掛好的按鈕點擊得以被派發、處理。
3. `const` 綁定在其初始化陳述式執行前處於 **temporal dead zone（TDZ）**——此期間任何存取都會拋
   `ReferenceError`，與 KI-013 根因逐字相同（那次是 `controls`，這次是 `replayController`）。
4. 若使用者（或自動化測試）在上述 await 懸置期間點擊「3D 重播」，`onReplay` 存取仍在 TDZ 的
   `replayController` → 拋出未捕捉的 `ReferenceError`，Replay 畫面不會開啟。

**為何既有測試從未踩到**：本 repo 目前所有 dev-mode E2E spec（`replay.spec.ts`／
`stage10-assessment.spec.ts`／`history-navigation.spec.ts` 等）在互動前都會先
`await expect.poll(() => page.evaluate(() => Boolean(window.__fpsTest))).toBe(true)`——`__fpsTest`
是 dev-only 測試掛鉤，於 `main.ts` 模組**尾端**（`replayController` 賦值之後）才掛上 `window`，因此
這個等待**意外地**同時保證了 `replayController` 已初始化完成。這是巧合的保護，不是刻意的 guard；
production bundle 完全沒有 `__fpsTest`，真實使用者若在 WebGPU/資產初始化尚未完成時就快速導覽到
Run Detail 並點擊「3D 重播」（例如較慢的裝置、較快的網路，兩者時間差恰好夠使用者手速追上），一樣會
撞到這個例外。`tests/e2e/stage10-preview.spec.ts`（WP-51 T2，preview production bundle，無
`__fpsTest` 可等）之所以沒有觸發，推測是因為該測試在互動前有多次真實 API `POST` 往返
（`await request.post(...)`）與後續多個 `expect().toBeVisible()` 重試輪詢，意外提供了足夠的
wall-clock 時間讓 `replayController` 早已初始化完成——同樣是巧合，不是刻意設計的保護，換一台更慢的
機器或更快的 API mock 就可能露餡。

## 3. 修法（2026-09-01，已落地）

`src/main.ts` 已比照 KI-013 模式，把 `replayController` 從尾端的 TDZ `const` 改成檔案前段的
`let replayController: ReplayController | undefined`。尾端 `createReplayController(...)` 完成後再賦值，
並以 local `initializedReplayController` 訂閱 state，維持初始化完成後的既有 Replay flow。

History Run Detail 的 `onReplay(runId)` 先讀 local `controller` 並 guard：

- `controller === undefined` 時不丟 exception，回傳 `Replay 尚未就緒，請稍後再試。`
- `HistoricalRunDetail` 只在 `onReplay` 回傳字串時，把訊息顯示在既有
  `[data-section="historical-run-status"]` 狀態區；正常 replay 開啟仍不回傳字串、不改 UI。
- 初始化完成後，historical/current Replay 仍呼叫同一 `ReplayController.open(...)` path；未修改
  Replay domain semantics、sampling、seek 或 renderer lifecycle。

## 4. 影響面

- **受影響**：`main.ts` 的 `replayController` 變數宣告形式與 `onReplay` guard；`HistoricalRunDetail`
  的 typed action port 允許回傳一段使用者可見訊息。`ReplayController` 本身、`ReplayScreen`/
  `ReplayTransport` 元件、任何 replay domain 邏輯皆不受影響。
- **不受影響範圍已由 WP-50/WP-51 現有測試證明**：一旦 `replayController` 已初始化完成（本專案目前
  100% 的既有 E2E 覆蓋都是這個情境，因為都間接或直接等待 `__fpsTest`/多次網路往返），Replay 開啟/
  控制/導覽的既有行為逐位不變。
- **Ownership**：本 bug 位於 `main.ts` 的 replay 進入點接線（`feat(replay): wire current/historical
  replay entries into main.ts (WP-50 T6)` 一帶引入），已依 WP-51 README §2.6 回流到 WP-50 修復。

## 5. Definition of Done（修法落地時驗收）

- [x] `replayController` 改為提早宣告的 `let replayController: ReplayController | undefined`；`onReplay`
      補 `undefined` guard（含使用者可見訊息，而非純靜默 return）。
- [x] 新增回歸測試：History→Participant→drill→run 導覽完成後、**不等待** `__fpsTest`／任何 readiness
      信號，立即對「3D 重播」送出 `click`（或鍵盤 `Enter`/`Space`），斷言零 `pageerror`，且該次點擊
      要嘛成功開啟 Replay、要嘛顯示明確的「尚未就緒」訊息（不得靜默無反應）。
- [x] `npx playwright test tests/e2e/replay.spec.ts tests/e2e/stage10-assessment.spec.ts
      tests/e2e/stage10-preview.spec.ts --project=edge` 零 regression。
- [x] `npm run typecheck` exit 0。

驗證結果（2026-09-01）：

- 修補前新增 regression 先失敗：同一 early-click path 進入 `no-feedback` 狀態，重現使用者體感。
- 修補後 `npx.cmd playwright test tests/e2e/replay.spec.ts --project=edge -g "KI-017"`：1 passed。
- `npm.cmd run typecheck`：exit 0。
- `npx.cmd playwright test tests/e2e/replay.spec.ts tests/e2e/stage10-assessment.spec.ts tests/e2e/stage10-preview.spec.ts --project=edge`：12 passed。
- `npm.cmd run test:e2e`：73 passed。

## 6. Commit（落地時）

`fix(ki-017): replayController 提早宣告避免 TDZ ReferenceError`
