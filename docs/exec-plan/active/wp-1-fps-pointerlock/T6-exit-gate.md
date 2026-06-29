# T6 / T-exit — Exit gate

> Part of [WP-1 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1–T5 |
| **Risk / Complexity** | Low / Low |
| **Touches** | MODIFY 頂層索引 [`../../README.md`](../../README.md)；docs only |
| **Status** | ⬜ TODO |

## Objective
驗證 WP-1 整體綠燈、map PLAN WP-1 驗收、更新索引、交棒 WP-2（雙迴圈需要 1.4 視角做內插驗證）與 WP-4（場景）。

## Steps
- [ ] `npx tsc --noEmit` exit 0。
- [ ] 手動驗收：click 鎖定 / Esc 解除 / 無 OS 加速（或 fallback 記錄）/ 環顧四周不翻轉 / sensitivity·FOV 即時生效。
- [ ] map 下方 4 項驗收 → 證據；勾選。
- [ ] 翻 [頂層索引](../../README.md) §2 WP-1 狀態 ✅。
- [ ] progress.md 寫 `Outcomes & Retrospective`（`rawInputEnabled` 實測、未決 sensitivity 校準）。
- [ ] （條件性）`gh pr create`（base `main`）或記本機證據。

## Acceptance criteria（PLAN WP-1）→ evidence
- [ ] 點擊鎖定、Esc 解除 → T2
- [ ] 無 OS 加速的視角（或 fallback 記錄）→ T3
- [ ] 可環顧四周（夾角）→ T4
- [ ] sensitivity/FOV 可調並即時生效 → T5

## Definition of Done
- 4 項驗收勾選有證據；頂層索引 WP-1 ✅；交棒 note 指向 WP-2 / WP-4。

## Commit
`docs(wp-1): exit gate — 驗收 map + 頂層索引狀態 + 交棒 WP-2/4`
