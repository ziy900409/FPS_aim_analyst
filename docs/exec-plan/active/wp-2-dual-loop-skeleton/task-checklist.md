# WP-2 — Master Task Checklist ★脊椎（M1）

> 每 task 一個自足檔案。Spec：[README.md](README.md) · Running log：[progress.md](progress.md) · 頂層索引：[../../README.md](../../README.md)
> **M1 門控**：T4 決定性驗證未通過前，不展開 WP-3 之後的任何 WP。

| Done | Task | File | Depends on | Risk |
|------|------|------|------------|------|
| ✅ | **T0** Entry gate | [T0-entry-gate.md](T0-entry-gate.md) | WP-0, WP-1 | Low |
| ✅ | **T1** SharedState（型別 + 單例） | [T1-shared-state.md](T1-shared-state.md) | T0 | Low |
| ✅ | **T2** SimLoop accumulator 128 Hz | [T2-sim-loop.md](T2-sim-loop.md) | T1 | Med |
| ⬜ | **T3** Render alpha 內插 | [T3-render-interpolation.md](T3-render-interpolation.md) | T2 | Med |
| ⬜ | **T4** 決定性驗證 ★M1 gate | [T4-determinism.md](T4-determinism.md) | T2 | High |
| ⬜ | **T5 / T-exit** Exit gate（宣告 M1） | [T5-exit-gate.md](T5-exit-gate.md) | T1–T4 | Med |

## Execution rules
- 一個 task = 一個切片 = 一個原子 commit；先驗證再 commit。
- **M1 是專案脊椎**：T4 未綠燈，STOP，不開 WP-3+。
- task 完成更新 [progress.md](progress.md) 並翻 Done box。
- WP-2 全綠 → 翻 [頂層索引](../../README.md) §2 WP-2 ✅ 並標記 **M1 達成**。
- 順序：T0 → T1 → T2 →（T3 ∥ T4）→ T5。
