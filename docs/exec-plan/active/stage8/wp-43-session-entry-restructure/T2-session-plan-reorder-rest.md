# T2 — Session Plan 排序清單 + 全域休息秒數(`SessionPlanSetup.ts`/`SessionRunner.ts`/`metadata.ts`)

> Part of [WP-43 session-entry-restructure](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(可與 T1 並行,檔案熱區不重疊) |
| **Risk / Cplx** | Med–High(移除 `buildFamilyOrder()` 呼叫需覆核既有測試斷言;型別變更影響 `SessionPlan`/`SessionPlanSelection` 兩處) |
| **Touches** | `src/ui/SessionPlanSetup.ts`(MODIFY)、`src/session/SessionRunner.ts`(MODIFY)、`src/data/metadata.ts`(ADD additive)、`src/main.ts`(MODIFY,Session Plan 接線段落) |
| **狀態** | ✅ 已完成(2026-08-26) |

## Objective

交付 FR-H2(家族清單依操作者排定順序執行,不再由 `buildFamilyOrder()` 覆寫)+ FR-H3(全域休息秒數自由輸入,取代具名 preset)。

## In scope

1. `SessionPlanSetup.ts`:家族 checkbox fieldset 改為可排序清單(依 T0 D-43.3 選定 native drag-and-drop 或升降序按鈕);移除 preset `<select>`,改為全域休息秒數 `<input type="number">` + 邊界驗證(OQ-S8-8,T2 自行定案,如 0–3600 秒)。
2. `SessionRunner.ts`:`start()` 移除 `buildFamilyOrder(plan.participantId, plan.sessionIndex)` 呼叫與其 `.filter()`;改為直接驗證並採用 `plan.families` 既有順序(非空、元素皆合法 `TestFamilyId`、無重複);`SessionPlan.presetId` 移除,新增 `restSeconds: number`;`presetRestMs = plan.restSeconds * 1000`,不再呼叫 `findSessionPlanPreset()`。
3. `metadata.ts`:additive 新增 `Meta.sessionPlanRestSeconds?: number`、`Meta.sessionPlanFamilyOrder?: readonly string[]`;既有 `sessionPlanPreset?: string` 欄位定義保留但加註解說明其僅供舊流程參考,本流程不再寫入。
4. `main.ts`:`startSessionPlan()` 改傳 `restSeconds`/(排定順序的)`families`;`collectMeta()` 呼叫點補上兩個新 additive 引數。
5. 依 T0 D-43.4(OQ-S8-7 回覆)決定 `sessionPlanPresets.ts` 是否保留原樣不動(初判:保留)。

## Out of scope

- `src/session/sessionSchedule.ts`(`buildFamilyOrder()` 本體)——不修改。
- `src/session/sessionPlanPresets.ts`——依 D-43.4,若保留則零改動。
- 任何單一 drill 的參數/trial 數表單化。
- `main.ts` 的 `appMode`/啟動按鈕群(T1 範圍)。

## Steps

- [x] 讀 `SessionRunner.test.ts`/`SessionRunnerPoll.test.ts`(T0 已列出的依賴斷言),先調整/新增測試釘住新語意(`plan.families` 順序即執行順序)。
- [x] 修改 `SessionRunner.ts`:型別變更 + `start()` 邏輯變更。
- [x] 修改 `SessionPlanSetup.ts`:排序清單 + 休息秒數輸入,對應調整 `SessionPlanSetup.test.ts`。
- [x] `metadata.ts` additive 新增兩欄位 + 驗證函式;`metadata.test.ts` 補測試(有值/缺值/邊界)。
- [x] `main.ts` 接線:`startSessionPlan()`、`collectMeta()` 呼叫點。
- [x] `rg "sessionPlanFamilyOrder|sessionPlanRestSeconds" src/sim src/metrics` 確認零命中(WP-43 紀律 2)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | `SessionPlan.families` 傳入順序與 `SessionRunner` 實際執行順序逐位相同(不經 `buildFamilyOrder` 重排) | 單元測試 |
| ② | 全域休息秒數可自由輸入且套用在清單每個家族之間;邊界外輸入被拒絕並顯示錯誤訊息 | 單元測試 + 手動驗證 |
| ③ | `Meta.sessionPlanRestSeconds`/`Meta.sessionPlanFamilyOrder` 有值/缺值情境皆正確;既有(無此兩欄位)匯出解析零改變 | `metadata.test.ts` |
| ④ | `buildFamilyOrder()`/`sessionSchedule.ts` 本體零修改;其既有測試全綠 | `git diff` 對該檔為空 + `npm run test:ci` |
| ⑤ | `rg "sessionPlanFamilyOrder\|sessionPlanRestSeconds" src/sim src/metrics` 零命中 | grep |

## Completion evidence(2026-08-26)

- ① `SessionRunner.test.ts`/`SessionRunnerPoll.test.ts`:12 tests 全綠;自訂順序逐位保持、17 秒休息、空/重複/未知 family 與非法 `restSeconds` 均有覆蓋。
- ② `SessionPlanSetup.test.ts`:8 tests 全綠;native drag-and-drop、自由小數秒數、0/3600 含端點與邊界錯誤訊息有覆蓋。Playwright 真 DOM Session Plan 接線 1/1 全綠。
- ③ `metadata.test.ts`:50 tests 全綠;兩欄位有值/缺值、非法秒數、未知 family 與非陣列皆有覆蓋。
- ④ `npm run test:ci`:TypeScript 通過、Vitest 131 files/989 tests、Playwright 24/24;`git diff` 確認 `sessionSchedule.ts`/`sessionPlanPresets.ts` 零修改。
- ⑤ `rg "sessionPlanFamilyOrder|sessionPlanRestSeconds" src/sim src/metrics` 無輸出(exit 1,即零命中)。

## Commits

依 `incremental-implementation` skill 拆為三個已獨立驗證的原子切片:

- `a4a0000 feat(wp-43): preserve session plan order and rest duration`
- `53a23bf feat(wp-43): add draggable session plan and free rest input`
- `feat(wp-43): record manual session plan audit metadata`(本 task 收尾提交)
