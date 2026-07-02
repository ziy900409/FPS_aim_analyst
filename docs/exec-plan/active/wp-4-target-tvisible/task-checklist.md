# WP-4 — Master Task Checklist

> 每 task 一個自足檔案。Spec：[README.md](README.md) · Running log：[progress.md](progress.md) · 頂層索引：[../../README.md](../../README.md)

| Done | Task | File | Depends on | Risk |
|------|------|------|------------|------|
| ✅ | **T0** Entry gate | [T0-entry-gate.md](T0-entry-gate.md) | WP-1, WP-2 | Low |
| ✅ | **T1** 目標 entity（mesh + hitbox） | [T1-target-entity.md](T1-target-entity.md) | T0 | Low |
| ✅ | **T2** 可見性 + t_visible（sim tick 內） | [T2-visibility-tvisible.md](T2-visibility-tvisible.md) | T1 | Med |
| ✅ | **T3** 左右交替序列 | [T3-alternation.md](T3-alternation.md) | T2 | Med |
| ✅ | **T4** Crosshair | [T4-crosshair.md](T4-crosshair.md) | T0 | Low |
| ⬜ | **T5 / T-exit** Exit gate | [T5-exit-gate.md](T5-exit-gate.md) | T1–T4 | Low |

## Execution rules
- 一個 task = 一個切片 = 一個原子 commit；先驗證再 commit。
- task 完成更新 [progress.md](progress.md) 並翻 Done box。
- WP-4 全綠 → 翻 [頂層索引](../../README.md) §2 WP-4 狀態。
- 順序：T0 →（T1 → T2 → T3）∥（T4）→ T5。
