# WP-6 — Master Task Checklist

> 每 task 一個自足檔案。Spec：[README.md](README.md) · Running log：[progress.md](progress.md) · 頂層索引：[../../README.md](../../README.md)

| Done | Task | File | Depends on | Risk |
|------|------|------|------------|------|
| ✅ | **T0** Entry gate | [T0-entry-gate.md](T0-entry-gate.md) | WP-4, WP-5 | Low |
| ✅ | **T1** DrillConfig schema | [T1-drill-config.md](T1-drill-config.md) | T0 | Low |
| ⬜ | **T2** Drill 載入器（驅動 TargetManager） | [T2-drill-loader.md](T2-drill-loader.md) | T1 | Med |
| ⬜ | **T3** Counter-strafe drill 檔 | [T3-counterstrafe-drill.md](T3-counterstrafe-drill.md) | T2 | Low |
| ⬜ | **T4** Drill 生命週期 | [T4-lifecycle.md](T4-lifecycle.md) | T2 | Med |
| ⬜ | **T5 / T-exit** Exit gate | [T5-exit-gate.md](T5-exit-gate.md) | T1–T4 | Low |

## Execution rules
- 一個 task = 一個切片 = 一個原子 commit；先驗證再 commit。
- task 完成更新 [progress.md](progress.md) 並翻 Done box。
- WP-6 全綠 → 翻 [頂層索引](../../README.md) §2 WP-6 狀態。
- 順序：T0 → T1 → T2 →（T3 ∥ T4）→ T5。
