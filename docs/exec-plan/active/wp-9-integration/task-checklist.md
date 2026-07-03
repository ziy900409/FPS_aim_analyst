# WP-9 — Master Task Checklist ★M4（階段 A 交付）

> 每 task 一個自足檔案。Spec：[README.md](README.md) · Running log：[progress.md](progress.md) · 頂層索引：[../../README.md](../../README.md)

| Done | Task | File | Depends on | Risk |
|------|------|------|------------|------|
| ✅ | **T0** Entry gate | [T0-entry-gate.md](T0-entry-gate.md) | WP-0~8 | Low |
| ✅ | **T1** E2E 整合（drill→匯出→統計） | [T1-e2e-integration.md](T1-e2e-integration.md) | T0 | High |
| ⬜ | **T2** 計時效度驗證（150–250 ms） | [T2-timing-validity.md](T2-timing-validity.md) | T0 | Med |
| ⬜ | **T3** 決定性回歸（自動化） | [T3-determinism-regression.md](T3-determinism-regression.md) | T0 | Med |
| ⬜ | **T4** 緩衝 + 附錄 E 驗收 | [T4-buffer-acceptance.md](T4-buffer-acceptance.md) | T1, T2, T3 | Med |
| ⬜ | **T5 / T-exit** Exit gate（宣告 M4） | [T5-exit-gate.md](T5-exit-gate.md) | T1–T4 | Med |

## Execution rules
- 一個 task = 一個切片 = 一個原子 commit；先驗證再 commit。
- task 完成更新 [progress.md](progress.md) 並翻 Done box。
- WP-9 全綠 → 翻 [頂層索引](../../README.md) §2 WP-9 ✅ + §3 標記 **M4 達成（階段 A 交付）**。
- 順序：T0 →（T1 ∥ T2 ∥ T3）→ T4 → T5。
