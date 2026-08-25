# T-exit — 驗收 FR-H1~H4 + 文件對帳

> Part of [WP-43 session-entry-restructure](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1 + T2 |
| **Risk / Cplx** | Low(驗收 + 文件彙整;無新程式碼) |
| **Touches** | `main.ts`(合併覆核,不再新增邏輯)、`docs/` |
| **狀態** | ⬜ 待開工 |

## Objective

驗收 FR-H1~H4 全項通過;`npm run test:ci` 全綠;完成文件對帳(README §8 清單)。

## In scope

1. 逐項核對 FR-H1~H4:
   - FR-H1:啟動畫面兩個主按鈕(+ 依 D-43.5 可能的第三按鈕),語意清楚。
   - FR-H2:操作者排定的家族順序即實際執行順序。
   - FR-H3:全域休息秒數自由輸入且正確套用;邊界驗證生效。
   - FR-H4:研究員子選單三入口正確;`Controls.ts` 顯隱條件正確。
2. `npm run test:ci` 全綠(含 T1/T2 合併後的 `main.ts` 一次性覆核)。
3. 文件對帳(依 README §8):
   - CONTEXT.md 新增 §O(`AppMode`/`SessionPlan.restSeconds`/`sessionPlanRestSeconds`/`sessionPlanFamilyOrder` 等)。
   - `../README.md` §5 WP-43 狀態翻 ✅。
   - 判斷 `docs/operational/*.md` 是否需要新文件(初判不需要)。
   - 若 OQ-S8-4 此時已由使用者拍板正式指派編號,同步 `DECISIONS.md`(GD-25)、`exec-plan/README.md`、`docs/MAP.md`;若仍未拍板,明確記錄「編號指派延後,WP-43/M18/GD-25 維持暫用狀態」。

## Out of scope

- 任何新功能開發——僅驗收與文件收尾。

## Steps

- [ ] 手動驗證 FR-H1~H4 四項情境(比照 wp-42 T-exit 的端到端手動驗證慣例)。
- [ ] `npm run test:ci` 全綠,記錄檔案數/測試數。
- [ ] `git diff` 對 `src/session/sessionSchedule.ts`、`src/session/sessionPlanPresets.ts`(若 D-43.4 判定保留)、`src/ui/Controls.ts`(元件本體)、`src/display/resolutionDetectionProtocol.ts`、`src/display/brTrackingProtocol.ts` 為空。
- [ ] CONTEXT.md 新增 §O。
- [ ] `../README.md` §5 狀態翻 ✅。
- [ ] 確認 OQ-S8-4 狀態,依結果完成或延後全域文件同步。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | FR-H1~H4 全項驗收通過 | 手動驗證記錄 + 對應單元/整合測試 |
| ② | `npm run test:ci` exit 0 | CI 日誌 |
| ③ | CONTEXT.md §O 定稿;`../README.md` §5 狀態翻 ✅ | git diff |
| ④ | OQ-S8-4 狀態明確記錄(已指派或延後) | progress.md |

## Commit

`docs(wp-43): T-exit — 驗收 FR-H1~H4 + 文件對帳`
