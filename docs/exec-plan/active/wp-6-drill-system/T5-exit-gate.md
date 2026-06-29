# T5 / T-exit — Exit gate

> Part of [WP-6 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1–T4 |
| **Risk / Complexity** | Low / Low |
| **Touches** | MODIFY 頂層索引 [`../../README.md`](../../README.md)；docs only |
| **Status** | ⬜ TODO |

## Objective
驗證 F4 整體綠燈、map PLAN WP-6 驗收、更新索引、交棒 WP-7（記錄完整 drill）/ WP-8（結果頁 + 換 drill）。

## Steps
- [ ] `npx vitest run` 綠燈（schema/loader/lifecycle + 決定性回歸）。
- [ ] `npx tsc --noEmit` exit 0。
- [ ] 手動驗：載入 `counterstrafe_ad_v1.json` 端到端遊玩；換另一 config 即換 drill（零引擎改動）。
- [ ] map 下方 4 項驗收 → 證據；勾選。
- [ ] 翻 [頂層索引](../../README.md) §2 WP-6 ✅。
- [ ] progress.md 寫 `Outcomes & Retrospective`（F4 解耦證明：第二個 config 換 drill）。
- [ ] （條件性）`gh pr create` 或記本機證據。

## Acceptance criteria（PLAN WP-6 / F4）→ evidence
- [ ] `DrillConfig` schema（型別 + 範例 JSON）→ T1
- [ ] 換 config 即換 drill（零引擎改動）→ T2
- [ ] 1 個完整 counter-strafe drill 可玩 → T3
- [ ] drill 生命週期完整 → T4

## Definition of Done
- 4 項驗收勾選有證據；頂層索引 WP-6 ✅；交棒 note 指向 WP-7 / WP-8。

## Commit
`docs(wp-6): exit gate — F4 驗收 map + 頂層索引狀態 + 交棒 WP-7/8`
