# T1 — `availableDrills` 缺口補齊 + `SessionPlan`/`SessionRunner` + Session Plan UI

> Part of [WP-42 session-orchestrator](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0 |
| **Risk / Cplx** | **Med–High**(本 WP 工作量與風險集中點:涵蓋可達性缺口接線 + 新狀態機 + 新 UI 三件事) |
| **Touches** | `src/main.ts`(additive)、`src/session/SessionRunner.ts`(新)、`src/session/sessionPlanPresets.ts`(新)、`src/ui/SessionPlanSetup.ts`(新)、`src/data/metadata.ts`(additive) |
| **狀態** | 🟡 已實作並提交，待實機驗證新增 drill 完整流程(2026-08-25) |

## Objective

交付 FR-G3(排程模組驅動既有 `loadDrillById()`)+ FR-G4(熱身步驟含降級語意)+ FR-G8(具名 preset 常數)+ FR-G9(家族子集自由勾選 + preset 封閉選單 + additive metadata)。家族順序在本 task 用手動固定順序(`TEST_FAMILY_IDS` 陣列 literal 順序或 T0 拍板的等價常數),不等待 WP-41——T3 才接入真正的 `buildFamilyOrder()`。

## In scope

1. **`availableDrills` additive 補齊**(README §2②,依 T0 `D-42.3` 拍板的項目數):在 `main.ts` 新增 import + 陣列項目,不修改既有 9 個項目。
2. **`SessionPlan`/`SessionRunnerPhase`/`SessionRunnerHandle` 型別 + 狀態機本體**(`src/session/SessionRunner.ts`):`idle → warmup? → family[0] → (rest →) family[1] → … → done`,每個 family phase 呼叫既有 `loadDrillById()`。
3. **`resolveWarmupDrillId()`/`resolveFamilyDrillId()`**:封閉對照表,不得讀 `src/drill/*.ts` 之外未涉及的 config。
4. **`sessionPlanPresets.ts`**:`SESSION_PLAN_PRESETS` 具名常數(比照 `pilotConfigs.ts` 紀律),`perFamilyTrialShape` discriminated union(§2④)。
5. **`SessionPlanSetup.ts`**:獨立於 `SessionSetup.ts` 的新 UI 單元,家族子集 checkbox(自由)+ preset `<select>`(封閉清單,不得渲染數字輸入)。
6. **`main.ts` 接線**:`pendingSessionMode` 新增第 4 分支(比照 `'resolution-protocol'`/`'br-tracking-protocol'` 既有型式)+ 一顆新啟動按鈕 + `SessionPlanSetup` 開啟時機(在 `sessionSetupForm`/`eligibilityGateScreen` 之後或之前,T1 執行時依實際 UX 流順序拍板並記錄)。
7. **`metadata.ts` additive `sessionPlanPreset`**:比照既有 `dpi` 型式(`Meta`/`CollectMetaArgs` 選填欄位 + 驗證 + 條件式 spread)。

## Out of scope

- `RestOverlay.ts`(T2)。
- WP-41 `buildFamilyOrder()` 的實際接線(T3)。
- `SessionSetup.ts` 既有欄位的任何修改。
- `ProtocolRunner.ts`/兩個既有 protocol 消費者的任何修改(即使 T0 判定重用其引擎,也只能新增一個消費者用法)。

## Steps

- [ ] `main.ts` 新增 import(`spiderShotV1`/`counterstrafeReversalV1`/`counterstrafeFreeV1`[/`counterstrafeCuedV1`,依 `D-42.3`])+ `availableDrills` 陣列 additive 項目。
- [ ] **手動驗證**三個(或四個)新增項目各自能完整走一次「選單/程式選取 → 倒數 → 目標出現 → 可擊殺 → ended → 匯出」(README §3 失效模式首項,不得只憑 TypeScript 編譯通過就視為完成)。
- [ ] 建立 `src/session/SessionRunner.ts`:型別 + 狀態機 + `resolveWarmupDrillId()`/`resolveFamilyDrillId()`;熱身 `'unavailable'` 分支的 UI 訊息接線。
- [ ] 建立 `src/session/sessionPlanPresets.ts`:`pilot-default` preset(`perFamilyTrialShape` 數值來源依 T0/OQ-S7-13 判定,若未阻塞則本 task 讀碼確認並記錄)。
- [ ] 建立 `src/ui/SessionPlanSetup.ts`:家族勾選 + preset 選單,`onSubmit` 回呼組出 `SessionPlan`(不含 `sessionIndex`/家族順序——那是狀態機與 T3 的職責)。
- [ ] `main.ts` 接線:`pendingSessionMode` 新分支 + 啟動按鈕 + `SessionPlanSetup`/`SessionRunner` 實例化;`collectMeta()` 呼叫點補 `sessionPlanPreset`。
- [ ] `metadata.ts` additive `Meta.sessionPlanPreset?: string` + `CollectMetaArgs.sessionPlanPreset?: string` + 驗證(封閉字串列舉,對照 `SESSION_PLAN_PRESETS` 的 id 清單)。
- [ ] 單元測試:`SessionRunner` 狀態機推進順序(含熱身降級分支)、`resolveFamilyDrillId()` 封閉對照表、`sessionPlanPreset` additive 驗證(既有無此欄位的 fixture 零重錄)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 三/四個新增 `availableDrills` 項目各自手動驗證完整流程成功一次 | progress.md 記錄手動驗證證據 |
| ② | `SessionRunner` 狀態機測試覆蓋:手動固定順序下依序推進四家族、熱身 `'unavailable'` 分支觸發 UI 訊息 | 測試檔案:行號引用 |
| ③ | `sessionPlanPreset` additive 驗證通過,`rg "sessionPlanPreset" src/sim src/metrics` 零命中 | 測試 + grep 結果記錄 |
| ④ | preset 選單只能選、不能填數字(`rg "type=.number." src/ui/SessionPlanSetup.ts` 零命中) | grep 結果記錄 |
| ⑤ | 既有 `availableDrills`/`Controls.ts`/既有匯出決定性回歸零修改全綠 | `npm run test:ci` |

## Commit

`feat(wp-42): T1 — SessionPlan/SessionRunner + availableDrills 缺口補齊(FR-G3/G4/G8/G9)`
