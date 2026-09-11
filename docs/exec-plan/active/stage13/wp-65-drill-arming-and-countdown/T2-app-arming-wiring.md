# WP-65 T2 — App 接線：取鎖解除待命、`start()` 前釋鎖、arena 歸零

> FR-65.4 / FR-65.5 · NFR-65.4 · FM-2 / FM-3 · D-65-1 / D-65-5

## Objective

把 T1 的待命閘接上真實 app：每一次 `drillRunner.start()` 都進入待命，並要求**一次新的取鎖動作**才解除。這是使用者需求 ①（「點擊左鍵以後，畫面開始倒數 3 秒」）的功能核心。

本 task 的難點不在寫，而在**四條 start 路徑必須一致**，且**不得讓系統自己的釋鎖被誤判為受試者掉鎖**。

## Steps

1. **建構期**（`src/main.ts`，`activeDrillRunner` 的兩個建構點）：
   - `createDrillRunner(sharedState, activeTargetManager, { requireArm: true })` —— 共**三處**：初始建構、`activateDrill()`（換 drill／Session Plan block）與 `loadSceneById()`（換場景）。**三處都要改**，漏一處會造成「換 drill／換場景後就不需要點擊」的情境性不一致。
   > 規劃期本步驟寫「兩處」並漏掉 `activateDrill()`；T2 實作時以五條路徑實測抓出，見 [progress.md §T2.3](progress.md)。
2. **釋鎖 + 進待命的單一入口**（D-65-1）：在 `main.ts` 的 `drillRunner` 包裝物件（[main.ts:1021-1035](../../../../../src/main.ts#L1021-L1035)）的 `start()` 內，於 `activeDrillRunner.start(config)` **之前**加入：
   ```ts
   sharedState.armRequested = false;                       // 顯式，不只依賴 resetState()
   if (document.pointerLockElement !== null) document.exitPointerLock();
   ```
   放這裡而非四條呼叫端，是因為 `restartActiveDrill` / `loadWeaponById` / `loadSceneById` / `activateDrill` 全部收斂到這一個 `start()`（已由 §0.1-4 確認）⇒ **一個地方改，四條路徑一致**。
   > **順序關鍵**（FM-3）：此時 `activeDrillRunner.phase` 尚未被設為 `'armed'`，但也已不是 `'countdown'`/`'running'`（上一場已 `ended`，或初次為 `idle`）。T5 的掉鎖偵測以 `phase === 'countdown' || 'running'` 為條件 ⇒ 本處的主動釋鎖恆不觸發旗標。此順序**必須**在 `progress.md` 明帳，並由 T5 的乾淨 run 實測反證。
3. **取鎖 → 解除待命**：擴充既有的 `pointerLock.onChange` 訂閱（[main.ts:991](../../../../../src/main.ts#L991) 附近，**新增一個訂閱者**而非改寫既有者）：
   ```ts
   pointerLock.onChange((locked) => {
     if (locked && drillRunner.phase === 'armed') {
       recorder.reset();                  // D-65-5：丟棄待命期累積的 arena 格（FM-2）
       hudRunStartMs = null;              // 待命期的 rAF 基準一併歸零
       sharedState.armRequested = true;   // input → SharedState → sim（ADR-2）
     }
   });
   ```
   `phase === 'armed'` 的條件讓「drill 進行中 ESC 後重新取鎖」**不會**重置 recorder（那一場的資料必須完整保留，只由 T5 標記）。
4. **FR-65.5 的具名驗證**（不需新增程式）：D-65-1 使取鎖那一下的 `mousedown` 天然被 `createInputSampler(sharedState, () => pointerLock.locked)` 的閘擋掉（取鎖**之前** `locked === false`）。本 task 不新增開火閘，但**必須**新增一條斷言證明它成立——見 DoD。
5. **`syncControlsVisibility()` 檢視**：[main.ts:1519](../../../../../src/main.ts#L1519) 目前以 `!pointerLock.locked || phase === 'ended'` 決定研究者 Controls 是否顯示。待命相位恆為未取鎖 ⇒ Controls 會顯示，**這是正確且想要的行為**（受試者在待命時可以換 drill）。確認無需修改並記入 `progress.md`；若實機發現 Controls 遮住待命提示，屬 T3 的 `z-index` 問題而非本 task。
6. **`resetRunPresentation()` 檢視**：既有函式已含 `recorder.reset()` 與 `hudRunStartMs = null`（[main.ts:1309-1320](../../../../../src/main.ts#L1309-L1320)），步驟 3 的兩行與其重複但**時機不同**（前者在 start 前、後者在 arm 時）。確認不要把步驟 3 併進 `resetRunPresentation()`——那會讓 `loadSceneById()` 等路徑在 arm 之前就重置，待命期的 tick 又會重新堆積。此判斷記入 `progress.md`。

## Invariants

- `PointerLock.ts` 零修改。
- `InputSampler.ts` 零修改（FR-65.5 由既有閘滿足）。
- `SimLoop.ts`／`DrillRunner.ts`／`TargetManager.ts` 零修改（T1 已完成 sim 側全部改動）。
- 既有 `pointerLock.onChange` 的三個訂閱者（`updateLockHint`、清 held 狀態、`syncControlsVisibility`）行為零變更。
- `drillRunner.start()` 的四條呼叫端（`restartActiveDrill` / `loadWeaponById` / `loadSceneById` / `activateDrill`）**呼叫點不改**，只改被呼叫的包裝實作。

## Definition of Done

- [x] `git grep -n "requireArm" src/main.ts` 回**三處** call site（`main.ts:1017` 初始、`main.ts:1454` `activateDrill()`、`main.ts:1496` `loadSceneById()`），無遺漏
  > **T2 實作更正**：本檔步驟 1 原寫「兩個建構點」，實際為三個——漏記的是 `activateDrill()`，即換 drill 與 **Session Plan 每個 block** 的路徑。詳見 [progress.md §T2.3](progress.md)。
- [ ] 實機：載入 app → 不點任何東西 → 目視確認**沒有任何目標出現**、HUD Time 不動；螢幕錄影或截圖存證並記入 `progress.md`
- [ ] 實機：點左鍵 → 3 秒後首目標出現。以 `performance.now()` 量測「取鎖 `pointerlockchange` → 首個 `visible` event 的 `t`」，記錄實測值並確認落在 `3000 ± 50 ms`（tick 量化 + rAF 對齊的合理窗）
- [ ] 實機：drill 結束 → Result → 「重新測試」 → 確認**再次回到待命**且需重新點擊（FR-65.4 / OQ-65.3）
- [ ] 實機：換武器、換場景、換 drill 三條路徑各跑一次，皆回到待命（四條 start 路徑一致性）
- [ ] **FR-65.5 斷言**：arm 的那一次點擊後匯出，`events` 中 `type === 'fire'` 的筆數為 0（在受試者未開火的前提下）；以 e2e 或實機匯出佐證，數值記入 `progress.md`
- [ ] **NFR-65.4 / FM-2**：待命 ≥ 10 分鐘後再 arm 並跑完一場 → 匯出的 `meta.recorderOverflow === false`，且 `ticks[0].t` 與 `meta.startedAt` 的關係與乾淨 run 一致。與 T0 步驟 4 的對照組數字並列記入 `progress.md`
- [ ] Session Plan 連續 block：以 custom program 排 2 個 item ×1 rep 實跑，確認**每個 block 都停在待命等點擊**（使用者 2026-09-11 拍板的第三條）
- [ ] `npm run typecheck` ×2 exit 0；全量 `npx vitest run` exit 0 且 passed 數 ≥ T1 之後的數字
- [ ] `progress.md §T2` 記錄：步驟 2 的順序為何不觸發 T5 旗標、步驟 5 的 Controls 判斷、步驟 6 的「不併入 `resetRunPresentation()`」理由

## Commit

```text
feat(app): require a fresh pointer lock before each drill starts
```
