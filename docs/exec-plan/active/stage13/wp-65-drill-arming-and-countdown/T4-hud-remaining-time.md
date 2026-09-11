# WP-65 T4 — HUD `Time` 卡的時限型倒數

> FR-65.7 / FR-65.8

## Objective

使用者需求 ②：時限型 drill 的 `Time` 卡從「00:00.0 往上加」改成「總時長往下減」。

範圍**刻意窄**：只有 `endCondition.type === 'timeLimit'` 的 drill 倒數（`spider_shot_v2`／`v3` = 60 s、`tracking_core_pr_pilot_v1` 與 `tracking_reversal_pilot_v1` 家族）；`targetCount` 型維持現行正計時（使用者 2026-09-11 拍板）。理由見 README §0.2：`targetCount` drill 沒有總時長，唯一的 `timing.timeLimitMs = 120 000` 是後援閘，實際多在 20–40 秒結束，顯示「還剩 118 秒」會誤導。

可與 T2／T3 並行。

## Steps

1. **`src/ui/HUD.ts`**：
   - `HUDStats` 增 `readonly timeLimitMs?: number`（additive optional，見 §2.3 契約）。
   - `createHUDStats(...)` 增第八個參數 `timeLimitMs: number | undefined`，寫入 `target.timeLimitMs`。**放在參數尾端**，避免既有呼叫端的位置參數整排位移。
   - `fillHUDSummary()` 改一行：
     ```ts
     target.timeText = stats.timeLimitMs === undefined
       ? formatElapsed(stats.elapsedMs)
       : formatElapsed(Math.max(0, stats.timeLimitMs - stats.elapsedMs));
     ```
     `formatElapsed()` 本身**不改**——它已經 clamp 負值（`Math.max(0, …)`）並處理非有限值，倒數只是換一個輸入。不另寫第二個格式化函式（C-D4 的精神：同一個顯示構念不開第二套實作）。
   - `createHUDSummary()` 的預設物件**不動**（`timeText: '00:00.0'`），additive optional 讓 replay 的呼叫路徑逐位不變。
2. **`src/main.ts`**：
   - 新增一個由 `activeDrillConfig` 推導的小函式，放在 `activeWeaponConfig()` 附近：
     ```ts
     function activeTimeLimitMs(): number | undefined {
       const ec = activeDrillConfig.endCondition;
       return ec.type === 'timeLimit' ? ec.value : undefined;
     }
     ```
     **讀 `endCondition` 而非 `timing.timeLimitMs`** —— 後者是後援閘，兩者語意不同，混用會讓 `targetCount` drill 顯示 120 秒倒數（正是要避免的）。
   - `liveFrame` 的 `hud.update(createHUDStats(...))` 呼叫（[main.ts:1836](../../../../../src/main.ts#L1836)）尾端補 `activeTimeLimitMs()`。
3. **FR-65.8（待命／倒數期的顯示值）**：`liveFrame` 現行在 `phase === 'countdown' || 'idle'` 時把 `hudElapsedMs = 0`（[main.ts:1777-1780](../../../../../src/main.ts#L1777-L1780)）。需把 `'armed'` 一併納入該分支，否則新相位落到 `else` 之外、`hudElapsedMs` 保留上一場殘值。
   ```ts
   } else if (phase === 'countdown' || phase === 'idle' || phase === 'armed') {
   ```
   `elapsedMs === 0` 時倒數型顯示 `timeLimitMs`（= `01:00.0`）、正計時型顯示 `00:00.0` ⇒ FR-65.8 自動滿足，**不需要額外分支**。
4. **測試** `src/ui/HUD.test.ts` 擴充：
   - `timeLimitMs` 省略 → `timeText` 與本 WP 前**逐字相同**（取 3 個既有案例的期望值直接複用，證明零回歸）。
   - `timeLimitMs: 60000, elapsedMs: 0` → `'01:00.0'`。
   - `timeLimitMs: 60000, elapsedMs: 12600` → `'00:47.4'`。
   - `timeLimitMs: 60000, elapsedMs: 60000` → `'00:00.0'`。
   - **超時 clamp**：`timeLimitMs: 60000, elapsedMs: 61000` → `'00:00.0'`（不得出現負值或 `NaN`）。超時真的會發生——`endCondition` 判定在 sim tick，HUD 讀 rAF 時鐘，兩者可差一幀。
   - `createHUDSummary()`（replay 路徑）不帶 `timeLimitMs` 時輸出逐位不變。
5. **drill 對照表驗證**（防 §0.2 的分類搞錯）：新增一條遍歷測試，對 `availableDrills` 的每個 config 斷言 `activeTimeLimitMs()` 的分類結果，並**寫死**目前的倒數型 drill id 集合。未來任何 drill 改 `endCondition` 型別，這條會紅。

## Invariants

- `formatElapsed()` 零修改。
- `HUDSummary`／`HUDHandle`／`createHUD()` 的簽名零變更。
- `targetCount` 型 drill 的 `timeText` 與本 WP 前逐字相同。
- 不讀 `timing.timeLimitMs`（後援閘），不新增任何時間常數。
- 不改 `endCondition` 的任何判定邏輯（`DrillRunner.ts` 本切片零修改）。

## Definition of Done

- [ ] `src/ui/HUD.test.ts` 新增 ≥ 7 條斷言全綠（省略、三個倒數值、超時 clamp、replay 路徑、遍歷分類）
- [ ] 遍歷測試寫死的倒數型 drill id 集合已記入 `progress.md`（本 WP 當下的名單）
- [ ] 實機：`spider_shot_v3` 跑一場，錄影確認 Time 卡自 `01:00.0` 單調遞減至 `00:00.0`，且歸零瞬間 drill 結束
- [ ] 實機：`counterstrafe_cued_v1` 跑一場，確認 Time 卡仍為 `00:00.0` 起算的正計時（零回歸）
- [ ] 實機：待命與倒數期間 Time 卡顯示起始值且**不閃動、不提早歸零**（FR-65.8），錄影佐證
- [ ] `npm run typecheck` ×2 exit 0；全量 `npx vitest run` exit 0
- [ ] `progress.md §T4` 記錄：為何讀 `endCondition` 而非 `timing.timeLimitMs`（兩者語意差異）

## Commit

```text
feat(ui): count the HUD time card down for time-limited drills
```
