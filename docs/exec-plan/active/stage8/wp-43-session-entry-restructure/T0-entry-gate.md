# T0 — entry-gate:覆核讀碼發現 + 五個決策拍板 + 兩個使用者缺口提交

> Part of [WP-43 session-entry-restructure](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | 無 |
| **Risk / Cplx** | Med(§2③ 的型別變更與 §0-5 的缺口直接決定 T1/T2 骨架,且需要使用者輸入,非工程可獨立拍板) |
| **Touches** | 無程式碼;決策記錄於 `progress.md` |
| **狀態** | ✅ 已完成(2026-08-25;決策與證據見 [progress.md](progress.md)) |

## Objective

在動筆前重新覆核 [README.md §0](README.md) 的讀碼發現在當下 `src/` 上仍然成立(尤其 `SessionRunner.ts`/`SessionPlanSetup.ts`/`main.ts` 若被其他並行工作改動);拍板 §2①②③④⑤ 五個決策(啟動畫面 `appMode` 設計、`ResearcherMenu.ts` 介面、`SessionPlan` 型別變更範圍、metadata 稽核欄位、拖曳排序元件選型);**正式向使用者提交 §7 OQ-S8-5(實驗 session 按鈕去向)與 OQ-S8-6/S8-7(拖曳元件選型/preset 保留)**,取得拍板後才能讓 T1/T2 有明確範圍。

## In scope

1. **重新 grep 覆核 §0 表格的行號與程式碼片段**:`main.ts` 的 `sessionLaunchControls`/`syncControlsVisibility()`/`experimentButton`、`SessionRunner.ts` 的 `start()`/`SessionPlan`、`SessionPlanSetup.ts` 的 `familyInputs`/`preset`、`metadata.ts` 的 `sessionPlanPreset`/`requireSessionPlanPreset()`——若行號或簽名已變動,更新 README §0/§6 對應內容並記錄差異。
2. **讀 `SessionRunner.test.ts`/`SessionRunnerPoll.test.ts`**,確認是否有測試斷言依賴 `buildFamilyOrder()` 產生的具體排列(README §3 失效模式首項);若有,記錄需要同步調整的測試清單。
3. **拍板 §2①**:`appMode: 'launch' | 'session' | 'researcher'` 的狀態管理是否新增為獨立變數,或有更貼合既有 `pendingSessionMode` 慣例的整合方式。
4. **拍板 §2③**:`SessionPlan.presetId` 移除、新增 `restSeconds: number`、`families` 語意變更為「順序即執行順序」——確認這個型別變更的影響半徑(呼叫端、測試 fixture)。
5. **拍板 §2⑤(OQ-S8-6)**:拖曳排序用 native drag-and-drop 或升降序按鈕。
6. **向使用者提交 OQ-S8-5**:「實驗 session」按鈕(`pendingSessionMode='session'`)的歸類,取得明確指示後才能定案 T1 範圍(若使用者未決,T1 預設保留原按鈕不歸類,見 task-checklist.md 紀律 4)。
7. **向使用者提交 OQ-S8-7**:`sessionPlanPresets.ts`/`SESSION_PLAN_PRESETS` 是否保留供未來使用。

## Out of scope

- 任何程式碼實作(T1/T2)。
- `docs/operational/*.md` 是否需要新增契約文件——留給 T-exit 判斷。
- OQ-S8-4(WP/GD 正式編號指派)——這是使用者對「是否現在正式開工」的決定,不是本 task 的技術決策,但需要在此明確詢問一次,避免懸而不決。

## Steps

- [x] 重新讀取 `src/main.ts`(`sessionLaunchControls`、`syncControlsVisibility`、`experimentButton`/`sessionPlanButton`)、`src/session/SessionRunner.ts`(`start()`、`SessionPlan`)、`src/ui/SessionPlanSetup.ts`(`familyInputs`、`preset`)、`src/data/metadata.ts`(`sessionPlanPreset`),確認 README §0 表格逐行仍成立。
- [x] 讀 `src/session/SessionRunner.test.ts`、`src/session/SessionRunnerPoll.test.ts`,列出是否有斷言依賴 `buildFamilyOrder()` 的具體排列。
- [x] 向使用者提出 OQ-S8-5(實驗 session 按鈕去向)、OQ-S8-6(拖曳元件選型)、OQ-S8-7(preset 保留)三個問題,記錄回覆/安全預設。
- [x] 寫決策記錄 `D-43.1`(§2①appMode 設計)、`D-43.2`(§2③型別變更範圍確認)、`D-43.3`(OQ-S8-6 拍板)、`D-43.4`(OQ-S8-7 拍板)、`D-43.5`(OQ-S8-5 使用者回覆記錄)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | README §0 讀碼發現已重新覆核(或明確記錄差異) | progress.md 記錄核對結果 |
| ② | §2①③⑤ 三項技術決策拍板 | Decision Log D-43.1~D-43.4 |
| ③ | OQ-S8-5(實驗 session 按鈕去向)已提交使用者並取得回覆,或明確記錄「使用者尚未回覆,T1 依預設處理」 | Decision Log D-43.5 |
| ④ | 零程式碼、零測試改動 | `git diff` 為空(僅 `docs/`) |

## Commit

`docs(wp-43): T0 — entry-gate(讀碼覆核 + 五個決策拍板 + 使用者缺口提交)`
