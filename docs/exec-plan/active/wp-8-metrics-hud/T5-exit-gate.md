# T5 / T-exit — Exit gate

> Part of [WP-8 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1–T4 |
| **Risk / Complexity** | Low / Low |
| **Touches** | MODIFY 頂層索引 [`../../README.md`](../../README.md)；docs only |
| **Status** | ⬜ TODO |

## Objective
驗證指標儀表板 + HUD 整體綠燈、map PLAN WP-8 驗收、更新索引、交棒 WP-9（整合 + 計時效度驗證）。

## Steps
- [ ] `npx vitest run` 綠燈（8 指標計算 + 固定輸入測試）。
- [ ] `npx tsc --noEmit` exit 0。
- [ ] 手動驗：跑完 drill → 結果頁顯示 §5 全 8 指標；HUD 即時更新；重來/換 drill 可循環。
- [ ] map 下方 3 項驗收 → 證據；勾選。
- [ ] 翻 [頂層索引](../../README.md) §2 WP-8 ✅。
- [ ] progress.md 寫 `Outcomes & Retrospective`（指標與匯出一致性確認、過衝近似定義）。
- [ ] （條件性）`gh pr create` 或記本機證據。

## Acceptance criteria（PLAN WP-8）→ evidence
- [ ] 賽後統計顯示 §5 全部 8 指標 → T1 + T2
- [ ] HUD 即時更新 → T3
- [ ] 可循環使用（重來/換 drill）→ T4

## Definition of Done
- 3 項驗收勾選有證據；頂層索引 WP-8 ✅；交棒 note 指向 WP-9。

## Commit
`docs(wp-8): exit gate — 驗收 map + 頂層索引狀態 + 交棒 WP-9`
