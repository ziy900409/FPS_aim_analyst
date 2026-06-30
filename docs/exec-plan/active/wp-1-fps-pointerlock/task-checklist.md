# WP-1 — Master Task Checklist

> 每 task 一個自足檔案。Spec：[README.md](README.md) · Running log：[progress.md](progress.md) · 頂層索引：[../../README.md](../../README.md)

| Done | Task | File | Depends on | Risk |
|------|------|------|------------|------|
| ✅ | **T0** Entry gate | [T0-entry-gate.md](T0-entry-gate.md) | WP-0 | Low |
| ✅ | **T1** SceneManager（room/camera） | [T1-scene.md](T1-scene.md) | T0 | Low |
| ⬜ | **T2** Pointer Lock 整合 | [T2-pointerlock.md](T2-pointerlock.md) | T1 | Med |
| ⬜ | **T3** 原始輸入 + NotSupportedError fallback | [T3-raw-input-fallback.md](T3-raw-input-fallback.md) | T2 | Med |
| ⬜ | **T4** yaw/pitch 視角 + 夾角 | [T4-yaw-pitch.md](T4-yaw-pitch.md) | T3 | Low |
| ⬜ | **T5** sensitivity/FOV 設定面板 | [T5-settings-panel.md](T5-settings-panel.md) | T4 | Low |
| ⬜ | **T6 / T-exit** Exit gate | [T6-exit-gate.md](T6-exit-gate.md) | T1–T5 | Low |

## Execution rules
- 一個 task = 一個切片 = 一個原子 commit；先驗證再 commit。
- 每個 task 檔自帶 Steps / DoD / Commit message。
- task 完成更新 [progress.md](progress.md) 並翻上表 Done box。
- WP-1 全綠後翻 [頂層索引](../../README.md) §2 WP-1 狀態。
- 順序：T0 → T1 → T2 → T3 → T4 → T5 → T6。
