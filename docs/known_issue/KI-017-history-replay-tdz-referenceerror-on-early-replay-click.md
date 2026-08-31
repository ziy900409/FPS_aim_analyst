# KI-017 — 過早點擊 Run Detail「3D 重播」丟出 TDZ ReferenceError（`replayController`）

> 類型：模組頂層初始化順序（top-level await 期間 UI 已可互動，但依賴的變數還沒賦值）——與
> [KI-013](KI-013-controls-tdz-referenceerror-on-early-researcher-click.md) 同一類根因，這次是不同的
> 頂層 `const`（`replayController`）。KI-013 §6 OQ-KI13-1 當時已預告「同一類結構性風險可能出現在其他
> 晚宣告的頂層 `const`」——本次即為該預告的具體重現。
> 狀態：🔴 診斷完成，修法待落地（發現於 WP-51 T4，非 WP-51 職權範圍——本 WP 只驗收，不修
> `main.ts` domain composition，見 [WP-51 README §2.6](../exec-plan/active/stage10/wp-51-m18-integration-and-acceptance/README.md)）。
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

## 3. 修復計畫（尚未落地，比照 KI-013/BD-013 的既有修法模式）

把 `replayController` 從尾端的 `const` 改為提早宣告的
`let replayController: ReplayController | undefined`（比照 KI-013 對 `controls` 的修法、以及本檔案
既有的 `researcherMenu`/`historyScreenHandle`/`replayScreenHandle` 慣例），並在 `onReplay(runId)`
開頭加 `if (replayController === undefined) return;`（或更友善地：呼叫
`replayScreenHandle?.render({ kind: 'error', message: '...尚未就緒，請稍後再試' })`，讓使用者至少看得到
明確訊息，而非靜默無反應——這點比 KI-013 的 `controls` guard 更值得做，因為那裡是「面板同步」，
使用者不會主動觸發；這裡是「使用者主動點擊一個看起來可互動的按鈕」，靜默無反應的使用者體感比
KI-013 更差）。`replayController = createReplayController(...)` 賦值完成後不需要額外補救呼叫（不像
KI-013 的 `syncControlsVisibility()` 有既有的無條件補救路徑）——使用者只需要再點一次「3D 重播」即可。

## 4. 影響面

- **受影響**：`main.ts` 的 `replayController` 變數宣告形式與 `onReplay` 內的存取寫法；`ReplayController`
  本身、`ReplayScreen`/`ReplayTransport` 元件、任何 replay domain 邏輯皆不受影響。
- **不受影響範圍已由 WP-50/WP-51 現有測試證明**：一旦 `replayController` 已初始化完成（本專案目前
  100% 的既有 E2E 覆蓋都是這個情境，因為都間接或直接等待 `__fpsTest`/多次網路往返），Replay 開啟/
  控制/導覽的既有行為逐位不變。
- **Ownership**：本 bug 位於 `main.ts` 的 replay 進入點接線（`feat(replay): wire current/historical
  replay entries into main.ts (WP-50 T6)` 一帶引入），依 WP-51 README §2.6 屬「WP-50
  support/seek/scene/ownership defect」，須回 WP-50 開 regression task 修復，WP-51 本身不得修改
  `main.ts` domain composition。

## 5. Definition of Done（修法落地時驗收）

- [ ] `replayController` 改為提早宣告的 `let replayController: ReplayController | undefined`；`onReplay`
      補 `undefined` guard（含使用者可見訊息，而非純靜默 return）。
- [ ] 新增回歸測試：History→Participant→drill→run 導覽完成後、**不等待** `__fpsTest`／任何 readiness
      信號，立即對「3D 重播」送出 `click`（或鍵盤 `Enter`/`Space`），斷言零 `pageerror`，且該次點擊
      要嘛成功開啟 Replay、要嘛顯示明確的「尚未就緒」訊息（不得靜默無反應）。
- [ ] `npx playwright test tests/e2e/replay.spec.ts tests/e2e/stage10-assessment.spec.ts
      tests/e2e/stage10-preview.spec.ts --project=edge` 零 regression。
- [ ] `npm run typecheck` exit 0。

## 6. Commit（落地時）

`fix(ki-017): replayController 提早宣告避免 TDZ ReferenceError`
