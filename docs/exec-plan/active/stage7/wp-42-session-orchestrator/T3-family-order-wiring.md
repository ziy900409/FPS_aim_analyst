# T3 — 接入 WP-41 `buildFamilyOrder()`

> Part of [WP-42 session-orchestrator](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1 + WP-41 T-exit |
| **Risk / Cplx** | Low(依賴 WP-41 已驗證的純函式) |
| **Touches** | `src/session/SessionRunner.ts`(或 T1 所在的家族順序決定點) |
| **狀態** | ✅ 完成(2026-08-25;WP-41 T-exit 已完成) |

## Objective

把 T1 交付的手動固定家族順序,換成 WP-41 `sessionSchedule.ts` 的 `buildFamilyOrder(participantId, sessionIndex)` 決定性輸出。

## In scope

1. 匯入 WP-41 的 `buildFamilyOrder`/`TestFamilyId`(確認 WP-41 T-exit 時的實際落地介面,不得沿用規劃稿草稿型別)。
2. `SessionRunner`/`SessionPlan` 的家族順序來源改為 `buildFamilyOrder(plan.participantId, plan.sessionIndex)` 的輸出,套用 T1 的家族子集(FR-G9①)做交集/篩選(順序仍以 `buildFamilyOrder` 全排列為準,只是從中篩掉未勾選的家族,不重新排序)。
3. 若 WP-41 T0 判定 FR-G7(家族內條件排程)有可行分支(Spider Shot seed 覆寫),評估是否也在本 task 接入;若 WP-41 判定關閉,本 task 僅接 `buildFamilyOrder`。

## Out of scope

- WP-41 `sessionSchedule.ts` 本身的任何修改。
- 若 WP-41 的 Spider Shot seed 覆寫分支被採納且需要 UI 呈現(OQ-S7-9,WP-41 README 已列),那是額外範圍,需要另外評估是否計入本 task 或另開子任務。

## Steps

- [x] 確認 WP-41 T-exit 已完成,重新讀取其實際落地的 `buildFamilyOrder`/`TestFamilyId`(而非規劃稿草稿)。
- [x] `SessionRunner`(或呼叫端)改用 `buildFamilyOrder()` 輸出,套用家族子集篩選。
- [x] 單元測試:家族順序來源可追溯到 `buildFamilyOrder` 輸出(斷言呼叫參數與輸出排列);家族子集篩選不改變 `buildFamilyOrder` 排列的相對順序,只是移除未勾選項目。
- [x] 同一 `participantId` 的兩個不同 `sessionIndex` 由單元測試驗證：家族出場順序依 `buildFamilyOrder` 而非固定順序變化。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 家族順序來源可追溯到 `buildFamilyOrder` 輸出 | 單元測試 |
| ② | 家族子集篩選正確(不重排,只篩選) | 單元測試 |
| ③ | T1 手動固定順序的暫時程式碼已移除,無死程式碼殘留 | `git diff` 覆核 |

## Commit

`feat(wp-42): T3 — 接入 WP-41 buildFamilyOrder`
