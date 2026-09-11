# WP-65 T1 — `'armed'` 相位、`armRequested` 與 `countdownRemainingMs`（sim 層）

> FR-65.1 / FR-65.2 / FR-65.3 · NFR-65.1 / 65.2 / 65.3 · FM-1 / FM-6 · D-65-2

## Objective

在 `DrillRunner` 的相位機插入一個**選擇性**的待命相位，並開出兩條唯一的對外接縫：input 層寫入的 `SharedState.armRequested`（sim 唯讀）與 render 層唯讀的 `countdownRemainingMs`。本 task **完全不碰 `main.ts`**——它的成敗只由單元測試判定，這樣「舊行為逐位不變」這件事在接上 app 之前就已經被證明。

這是全 WP 唯一觸及 sim 狀態機的切片，也是唯一的 High risk 切片。

## Steps

1. **`src/state/SharedState.ts`**：
   - `SharedState` 增 `armRequested: boolean`，附註「input 寫 / sim 唯讀（ADR-2）」。
   - `SharedState.validity` 暫**不動**（`pointerLockLostDuringRun` 屬 T5，避免本切片混入兩個構念）。
   - `createSharedState()` 初始 `armRequested: false`。
   - `resetState()` 原地設 `state.armRequested = false`（重用既有物件，不 realloc；GC 紀律 §4）。放在 `state.firstShotPeekId = null` 附近，與其他 per-drill 旗標同區。
2. **`src/drill/DrillRunner.ts`**：
   - `DrillPhase` 改為 `'idle' | 'armed' | 'countdown' | 'running' | 'ended'`。
   - 新增 `export interface DrillRunnerOptions { readonly requireArm?: boolean }`。
   - `createDrillRunner(state, targetManager, options?)` —— 第三參數 optional，**既有 35 個 caller 不需修改**。
   - `start(cfg)`：`phase = options?.requireArm === true ? 'armed' : 'countdown'`。
   - `tick(s, nowMs)` 新增待命分支，置於既有 `if (phase === 'idle' || phase === 'ended' || config === null) return;` 之後、`if (phase === 'countdown')` 之前：
     ```ts
     if (phase === 'armed') {
       if (!s.armRequested) return;   // 待命中：不推進目標、不起算倒數
       phase = 'countdown';           // 落入下方 countdown 區塊，同 tick 起算（不浪費一個 tick）
     }
     ```
     這個「同 tick 落入下一區塊」的寫法**刻意比照**既有 `countdown → running` 的既有註解與結構（[DrillRunner.ts:186-191](../../../../../src/drill/DrillRunner.ts#L186-L191)），不另立慣例。
   - 新增 `get countdownRemainingMs(): number`：`phase === 'countdown' && countdownStartMs !== null && config !== null` 時回 `Math.max(0, config.timing.countdownMs - (lastTickMs - countdownStartMs))`，其餘一律回 `0`。`lastTickMs` 為 `tick()` 內記下的最近一次 `nowMs`（sim clock，**不讀時鐘**）。
   - `resetAll()` 增 `lastTickMs = 0`。
3. **窮舉檢查**（FM-6）：全 repo 搜 `DrillPhase` 的消費點，對每個 `switch`／if-chain 補 `'armed'` 分支或 `never` 斷言。已知消費點：`src/ui/HUD.ts`（`HUDStats.phase`，僅型別不分支）、`src/main.ts`（`liveFrame` 與 `fullscreenchange` 的 `phase === 'countdown' || 'running'` 判斷——**本 task 不改 `main.ts`**，但必須確認 `'armed'` 落在該判斷之外，並在 `progress.md` 記錄此確認）。
4. **測試**（`src/drill/DrillRunner.test.ts`，新增或擴充）：
   - **FM-1 反證（最重要的一條）**：`createDrillRunner(state, tm)` 無第三參數 → `start(cfg)` 後 `phase === 'countdown'`；第一個 `tick()` 即起算倒數。
   - `requireArm: true` → `start()` 後 `phase === 'armed'`；連續 `tick()` 100 次（> countdownMs）後 `phase` 仍為 `'armed'`。
   - 待命期間的**污染反證**：上述 100 tick 後斷言 `state.targets.length === 0`、`state.tVisible.size === 0`、`state.tStop.size === 0`、`state.tScoredStart.size === 0`、`state.cues.length === 0`（效度風險 §3.1-2）。
   - `armRequested = true` 後的第一個 tick → `phase === 'countdown'`；再經 `countdownMs` → `'running'` 且首目標 spawn。
   - `restart()` → `phase === 'idle'`；其後 `start()` → `'armed'`（`resetState()` 已把 `armRequested` 清回 false，故不會沿用上一場的解除）。
   - `countdownRemainingMs`：`armed` 回 0；`countdown` 首 tick 回 `countdownMs`（或 `countdownMs - tickMs`，以實作為準並在測試寫死期望值）；`running`／`ended` 回 0；**單調遞減**（連續 tick 的回傳值不遞增）。
5. **決定性測試**（新檔 `src/loop/__tests__/wp65-arm-determinism.test.ts`）：以 `requireArm: true` 建兩條管線，於**同一 tick index** 設 `armRequested = true`，餵同一輸入序列，在 ≥ 4 種 render FPS（比照既有 `wp22-determinism.test.ts` 的 FPS 集合）下斷言 `recorder.snapshot().ticks` **逐位一致**。
6. **`fpsTestHarness` 結構斷言**：在既有 harness 測試補一條「`createDrillRunner` 的呼叫不帶 `requireArm`」的斷言（可以是 `startDrill()` 後 `phase !== 'armed'` 的行為斷言，不需反射）。FM-1 的第二道防線。

## Invariants

- `createDrillRunner` 的前兩個參數、`start`／`tick`／`restart`／`phase` 的既有簽名與語意零變更。
- `requireArm` 省略時，`DrillRunner.tick()` 的控制流與本 WP 前**逐位相同**（`'armed'` 分支恆不進入）。
- `targetManager`／`endCondition`／`peekTimeoutMs`／`presentationMs`／`tickHoldReversal`／`tickProtocolGuard` 全數零修改。
- 不新增任何時鐘讀取、不新增 `Math.random()`、不新增堆配置。
- `src/main.ts` **本切片零修改**。

## Definition of Done

- [ ] `DrillPhase` 為五成員 union；`DrillRunnerOptions` 已匯出且 `requireArm` 為 optional
- [ ] FM-1 反證測試存在且綠：無第三參數的 `createDrillRunner` 在 `start()` 後 `phase === 'countdown'`
- [ ] 待命污染反證測試存在且綠：100 tick 後 `targets` / `tVisible` / `tStop` / `tScoredStart` / `cues` 五者皆空
- [ ] `countdownRemainingMs` 的四相位回傳值 + 單調遞減共 ≥ 5 條斷言全綠
- [ ] `src/loop/__tests__/wp65-arm-determinism.test.ts` 在 ≥ 4 種 render FPS 下 `ticks` 逐位一致斷言通過
- [ ] `tests/regression/` 下全部 determinism / golden fixture **零修改**通過（`npx vitest run tests/regression` exit 0），通過數與 T0 基線一致
- [ ] `fpsTestHarness` 永不待命的斷言存在且綠
- [ ] `npm run typecheck` ×2 exit 0（FM-6 的窮舉檢查由此保證）
- [ ] 全量 `npx vitest run` exit 0，passed 數 ≥ T0 基線（新增測試使其只增不減），差額逐條說明於 `progress.md`
- [ ] `progress.md §T1` 記錄：`DrillPhase` 消費點清單 + 每處如何處理 `'armed'`；`git diff --stat` 顯示 `src/main.ts` 零改動

## Commit

```text
feat(drill): add an opt-in armed phase before countdown
```
