# T5 / T-exit — Exit gate

> Part of [WP-3 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1–T4 |
| **Risk / Complexity** | Low / Low |
| **Touches** | MODIFY 頂層索引 [`../../README.md`](../../README.md)；docs only |
| **Status** | ⬜ TODO |

## Objective
驗證 F1 採集整體綠燈、map PLAN WP-3 驗收、更新索引、交棒 WP-5（消費這些事件做命中/急停）。

## Steps
- [ ] `npx vitest run` 綠燈（鍵盤/滑鼠/開火/消費 + WP-2 決定性回歸）。
- [ ] `npx tsc --noEmit` exit 0。
- [ ] 手動驗：鎖定中操作，緩衝收到帶時間戳的鍵/滑鼠/開火事件並被 sim 排序消費。
- [ ] map 下方 4 項驗收 → 證據；勾選。
- [ ] 翻 [頂層索引](../../README.md) §2 WP-3 ✅。
- [ ] progress.md 寫 `Outcomes & Retrospective`（coalesced 樣本率、時間戳基準確認）。
- [ ] （條件性）`gh pr create` 或記本機證據。

## Acceptance criteria（PLAN WP-3 / F1）→ evidence
- [ ] 鍵盤事件帶時間戳入緩衝 → T1
- [ ] 滑鼠 coalesced 次幀樣本無遺漏 → T2
- [ ] 開火事件帶時間戳 → T3
- [ ] sim 依時序、無遺漏消費並排空 → T4

## Definition of Done
- 4 項驗收勾選有證據；頂層索引 WP-3 ✅；交棒 note 指向 WP-5。

## Commit
`docs(wp-3): exit gate — F1 驗收 map + 頂層索引狀態 + 交棒 WP-5`
