# WP-8 — Master Task Checklist

> 每 task 一個自足檔案。Spec：[README.md](README.md) · Running log：[progress.md](progress.md) · 頂層索引：[../../README.md](../../README.md)

| Done | Task | File | Depends on | Risk |
|------|------|------|------------|------|
| ✅ | **T0** Entry gate | [T0-entry-gate.md](T0-entry-gate.md) | WP-5, WP-6, WP-7 | Low |
| ✅ | **T1** 指標計算（§5 八指標） | [T1-compute-metrics.md](T1-compute-metrics.md) | T0 | Med |
| ⬜ | **T2** 結果頁（DOM） | [T2-result-screen.md](T2-result-screen.md) | T1 | Low |
| ⬜ | **T3** 即時 HUD（DOM） | [T3-hud.md](T3-hud.md) | T0 | Low |
| ⬜ | **T4** 控制（重來/換 drill） | [T4-controls.md](T4-controls.md) | T0 | Low |
| ⬜ | **T5 / T-exit** Exit gate | [T5-exit-gate.md](T5-exit-gate.md) | T1–T4 | Low |

## Execution rules
- 一個 task = 一個切片 = 一個原子 commit；先驗證再 commit。
- task 完成更新 [progress.md](progress.md) 並翻 Done box。
- WP-8 全綠 → 翻 [頂層索引](../../README.md) §2 WP-8 狀態。
- 順序：T0 →（T1 → T2）∥（T3）∥（T4）→ T5。
