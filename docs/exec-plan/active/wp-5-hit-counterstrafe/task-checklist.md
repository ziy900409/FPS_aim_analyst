# WP-5 — Master Task Checklist ★M2

> 每 task 一個自足檔案。Spec：[README.md](README.md) · Running log：[progress.md](progress.md) · 頂層索引：[../../README.md](../../README.md)

| Done | Task | File | Depends on | Risk |
|------|------|------|------------|------|
| ✅ | **T0** Entry gate | [T0-entry-gate.md](T0-entry-gate.md) | WP-3, WP-4 | Low |
| ✅ | **T1** HitDetector（Raycaster + 部位） | [T1-hit-detector.md](T1-hit-detector.md) | T0 | Med |
| ✅ | **T2** 首發判定 | [T2-first-shot.md](T2-first-shot.md) | T1 | Med |
| ✅ | **T3** A/D 橫移 movement | [T3-strafe-movement.md](T3-strafe-movement.md) | T0 | Med |
| ✅ | **T4** 簡化急停 + gate 開火 | [T4-simplified-counterstrafe.md](T4-simplified-counterstrafe.md) | T3 | Med |
| ✅ | **T5 / T-exit** Exit gate（宣告 M2） | [T5-exit-gate.md](T5-exit-gate.md) | T1–T4 | Med |

## Execution rules
- 一個 task = 一個切片 = 一個原子 commit；先驗證再 commit。
- task 完成更新 [progress.md](progress.md) 並翻 Done box。
- WP-5 全綠 → 翻 [頂層索引](../../README.md) §2 WP-5 ✅ 並標記 **M2 達成**。
- 順序：T0 →（T1 → T2）∥（T3 → T4）→ T5。
