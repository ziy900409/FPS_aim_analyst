# T5 / T-exit — Exit gate

> Part of [WP-4 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1–T4 |
| **Risk / Complexity** | Low / Low |
| **Touches** | MODIFY 頂層索引 [`../../README.md`](../../README.md)；docs only |
| **Status** | ⬜ TODO |

## Objective
驗證 F2 整體綠燈、map PLAN WP-4 驗收、更新索引、交棒 WP-5（命中 + 急停消費目標/hitbox）與 WP-6（drill 接管目標生成）。

## Steps
- [ ] `npx vitest run` 綠燈（t_visible 蓋一次 / 時間源 / 交替確定性 + WP-2 決定性回歸）。
- [ ] `npx tsc --noEmit` exit 0。
- [ ] 手動驗：目標左右交替出現、準心置中；以鉤子確認 `t_visible` 正確。
- [ ] map 下方 4 項驗收 → 證據；勾選。
- [ ] 翻 [頂層索引](../../README.md) §2 WP-4 ✅。
- [ ] progress.md 寫 `Outcomes & Retrospective`（t_visible 時間源確認、交替決定性）。
- [ ] （條件性）`gh pr create` 或記本機證據。

## Acceptance criteria（PLAN WP-4 / F2）→ evidence
- [ ] 可生成目標（mesh + hitbox）→ T1
- [ ] `t_visible` 在 sim tick 內正確蓋戳 → T2
- [ ] 目標左右交替生成 → T3
- [ ] 螢幕中心準心 → T4

## Definition of Done
- 4 項驗收勾選有證據；頂層索引 WP-4 ✅；交棒 note 指向 WP-5 / WP-6。

## Commit
`docs(wp-4): exit gate — F2 驗收 map + 頂層索引狀態 + 交棒 WP-5/6`
