# T4 — 控制（重新開始 / 換 drill）

> Part of [WP-8 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T0 |
| **Risk / Complexity** | Low / Low |
| **Touches** | NEW `src/ui/Controls.ts`；MODIFY `src/main.ts` |
| **Status** | ⬜ TODO |

## Objective
提供重新開始與換 drill 控制，讓工具可循環使用（FR-8.4）。

## In scope
- `Controls`：重新開始（`DrillRunner.restart`，WP-6）、換 drill（`DrillLoader.load` 新 config → `start`）。
- 換 drill 選單列出 `drills/` 下可用 config（至少 counterstrafe_ad_v1）。

## Out of scope
- drill 編輯（手改 JSON）；複雜選單。

## Design notes
- 重來必須走 WP-6 restart（全 reset，避免殘留污染資料）。
- 控制在結果頁 / 解除鎖定時可見。

## Steps
- [ ] 建 `Controls.ts`：重來 + 換 drill。
- [ ] 串 DrillRunner/DrillLoader。
- [ ] 手動驗：結束後重來乾淨開始；換 drill 載入新 config 並開始。
- [ ] `tsc` 乾淨。

## Definition of Done
- [ ] 可重新開始（乾淨）+ 換 drill；循環使用無殘留狀態。

## Commit
`feat(wp-8): 重新開始 / 換 drill 控制（FR-8.4）`
