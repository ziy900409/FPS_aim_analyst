# T-exit — 驗收 FR-G6/FR-G7 + 文件定稿

> Part of [WP-41 seeded-counterbalance](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1 + T2 |
| **Risk / Cplx** | Low |
| **Touches** | `docs/`(CONTEXT.md、stage7 README、必要的 `analysis-*.md`) |
| **狀態** | ✅ 完成(2026-08-25) |

## Objective

驗收 FR-G6 全綠(`buildFamilyOrder` 的 Latin-square 性質、決定性、週期性 wrap)+ FR-G7 判定已正式記錄(無論關閉或採納);`npm run test:ci` 全綠;完成本 WP 的文件對帳清單(README §8)。

## In scope

1. 重跑 `npm run test:ci`,確認 T1(+ T2 若為分支 B)交付的測試皆綠,且既有回歸(尤其四個協定的既有決定性測試)零修改全綠。
2. 覆核 FR-G6 的驗收條件:`buildFamilyOrder` 同 `participantId` 跨 `sessionIndex` 產生不同排列且可重現(對應 stage7 README §4 M17 完成條件之一)。
3. 覆核 FR-G7 判定是否已在 `progress.md`/`docs/operational/*.md` 完整記錄(引用 Decision Log `D-41.1`/`D-41.2`)。
4. 完成 [README.md §8](README.md) 文件對帳清單:stage7 README §3 狀態列翻轉、CONTEXT.md 新術語回寫(與 WP-40 協調實際章節號,見 OQ-S7-8)。

## Out of scope

- WP-42 T3 的實際接線(那是 WP-42 自己的 T-exit 驗收範圍)。

## Steps

- [x] `npm run test:ci` 全綠(126 Vitest 檔 / 955 tests + 21 Playwright tests)。
- [x] 覆核 FR-G6/FR-G7 驗收證據,逐項附測試檔案/行號引用(見 progress.md)。
- [x] 更新 [../README.md](../README.md) §3 WP-41 狀態列 + §7 OQ-S7-1 關閉。
- [x] 更新 [CONTEXT.md](../../../../CONTEXT.md) §M(新術語章節,續接 WP-40 §L)。
- [x] 更新 `progress.md` Open Questions 狀態表,全部關閉或明確標記延後理由。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | `npm run test:ci` 全綠 | CI 輸出記錄於 progress.md |
| ② | FR-G6 驗收條件(決定性 + 跨 sessionIndex 不同排列 + 可重現)有測試引用佐證 | progress.md 記錄檔案:行號 |
| ③ | FR-G7 判定(關閉或採納)已記錄,OQ-S7-1 正式關閉 | progress.md Decision Log |
| ④ | 文件對帳清單全部打勾或明確記錄延後理由 | README §8 |

## Commit

`docs(wp-41): T-exit — 驗收 FR-G6/FR-G7 + 文件定稿`
