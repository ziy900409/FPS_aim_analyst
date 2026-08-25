# KI-009 — Session Plan 誤用 QHD 資格閘門檻，FHD 面板無法測試選手

> 類型：資格閘（EligibilityGate）設定錯誤。
> 狀態：**✅ 已修**（2026-08-25）。
> 決策帳本：[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) BD-009。

## 1. 症狀

使用者以 QA/教練角色排查「測試實驗的效能地板解析度」時發現：Session Plan（WP-42，選手表現測試流程）
的資格閘要求原生解析度 ≥ 2560×1440（QHD），但 Session Plan 本身不操弄或比較任何解析度條件——只需要
高於 1920×1080（FHD）即可測試選手。QHD 門檻對只有 FHD 面板的測試環境是不必要的拒入。

## 2. 根因

`src/main.ts` 只建立**一個**共用的 `eligibilityGateScreen` 實例，供四種啟動模式共用：`實驗 session`、
`解析度 protocol`、`BR protocol`、`Session Plan`。建立時 `required` 寫死為
`resolutionDetectionProtocol.requiredDisplay`，也就是 `EXPERIMENT_MAX_CONDITION`
（`{minW:2560, minH:1440}`，[constants.ts](../../src/display/constants.ts)）。

`EXPERIMENT_MAX_CONDITION` 的門檻理由（GD-10 防線①）是「resolution/BR 兩個 protocol 會在同一面板上
操弄/比較解析度條件，FHD 面板權充 QHD 條件 = 方向性錯誤資料的統計必然」——這個理由只適用於這兩個會
真的切換 `fhd-1080`/`qhd-1440` render 模式的 protocol。Session Plan（`SessionRunner.ts`）四個家族全部
以 `native` 模式載入（見 `resolveFamilyDrillId`），不操弄、不比較任何解析度條件，套用同一把 QHD 尺
（研究效度用的門檻）沒有依據，純粹是接線時「沿用既有 `sessionSetupForm`→`eligibilityGate` 型式」
（WP-42 T0 §0-3 讀碼結論）把四種模式共用同一個 `required` 靜態值所致。

## 3. 修復決策

新增 `SESSION_PLAN_MIN_CONDITION = {minW:1920, minH:1080}`（`constants.ts`），與
`EXPERIMENT_MAX_CONDITION` 並列、語意分離：後者專屬 resolution/BR 兩個解析度操弄 protocol，前者專屬
Session Plan。`EligibilityGateScreenOptions.required` 型別放寬為
`EligibilityRequirement | (() => EligibilityRequirement)`；`main.ts` 改傳入函式，依當下
`pendingSessionMode` 動態解析：

```ts
required: () =>
  pendingSessionMode === 'session-plan'
    ? SESSION_PLAN_MIN_CONDITION
    : resolutionDetectionProtocol.requiredDisplay,
```

`EligibilityGate.ts` 內原本在建構時就把 `required.minW/minH` 寫入說明文字（`desc`），改為在 `open()`
當下才 resolve 並重繪文字，確保每次開啟資格閘都反映當時模式的正確門檻。

未採「Session Plan 另建一個獨立的 `createEligibilityGateScreen` 實例」——會複製 fullscreen/perf 探測
與 UI 邏輯，且與 WP-42 T0 §0-3 已拍板「沿用既有接線型式」的結論衝突；函式型 `required` 是最小改動。

## 4. 修改紀錄

| 檔案 | 修改 |
|---|---|
| `src/display/constants.ts` | 新增 `SESSION_PLAN_MIN_CONDITION = {minW:1920, minH:1080}`，並註記與 `EXPERIMENT_MAX_CONDITION` 的語意分工。 |
| `src/ui/EligibilityGate.ts` | `required` 選項型別放寬為可傳函式；新增 `resolveRequired()`；說明文字 (`desc`) 改在 `open()` 時依當下門檻重繪。 |
| `src/ui/EligibilityGate.test.ts` | 新增案：函式型 `required` 在每次 `open()` 都重新解析（門檻變動後文字同步更新）。 |
| `src/main.ts` | `eligibilityGateScreen` 的 `required` 改傳函式，`pendingSessionMode === 'session-plan'` 時回傳 `SESSION_PLAN_MIN_CONDITION`，其餘模式維持 `EXPERIMENT_MAX_CONDITION`。 |

## 5. 驗證證據

1. `src/ui/EligibilityGate.test.ts`：5 tests 全綠（含新增案）。
2. `src/display/eligibilityGate.test.ts`：14 tests 全綠（`runEligibilityGate` 純函式本體未改動）。
3. `npx tsc --noEmit`：exit 0。
4. `npx vitest run`：130 files / 968 tests 全綠（含既有 968-2=966 案 + 本次新增 2 案）。

## 6. 影響範圍

只影響 Session Plan 啟動路徑的資格閘門檻與其說明文字時機；`實驗 session`／`解析度 protocol`／
`BR protocol` 三個模式的門檻與行為逐位不變（`EXPERIMENT_MAX_CONDITION` 未修改）。不觸及
`runEligibilityGate` 判定邏輯、sim、輸入或匯出語意。
