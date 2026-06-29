# T5 / T-exit — Exit gate（宣告 M4 — 階段 A 交付）

> Part of [WP-9 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1–T4 |
| **Risk / Complexity** | Med / Low |
| **Touches** | MODIFY 頂層索引 [`../../README.md`](../../README.md)（WP-9 ✅ + M4 + 整體狀態）；docs only |
| **Status** | ⬜ TODO |

## Objective
驗證附錄 E 全綠，正式宣告 **M4 — 階段 A 交付**，收尾整個專案的階段 A。

## Steps
- [ ] `npm run test:ci` exit 0（tsc + vitest + playwright 全綠）。
- [ ] 手動驗收：附錄 E 中標為手動的項（原生輸入無加速、實際遊玩手感）逐一通過。
- [ ] 確認 [acceptance-stage-a.md](../../../operational/acceptance-stage-a.md) 10 項全綠。
- [ ] map 下方 4 項 WP-9 驗收 → 證據；勾選。
- [ ] 翻 [頂層索引](../../README.md) §2 WP-9 ✅ + §3 標記 **M4 達成**；頂層 §0 狀態改「✅ 階段 A 交付」。
- [ ] 把 `active/wp-*` 依需要移入 `../../completed/`。
- [ ] progress.md 寫 `Outcomes & Retrospective`（階段 A 交付總結、已知限制、階段 B 銜接）。
- [ ] （條件性）`gh pr create`（base `main`）彙整階段 A，或記本機綠燈證據。

## Acceptance criteria（PLAN WP-9 / 附錄 E / M4）→ evidence
- [ ] 端到端整合（drill→匯出→統計）→ T1
- [ ] 計時效度（150–250 ms 合理）→ T2
- [ ] 決定性回歸自動化 → T3
- [ ] 附錄 E 驗收清單全數通過 → T4

## Definition of Done
- 附錄 E 10 項全綠；**M4 達成、階段 A 交付**並記於頂層索引；階段 B 銜接 note 寫入 progress.md。

## Commit
`docs(wp-9): exit gate — 宣告 M4 階段 A 交付 + 附錄 E 全綠`
