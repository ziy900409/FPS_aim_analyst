# WP-19 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(GD-6/9 收斂 + 資產選型 + 硬約束回寫,無程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | — | Low |
| ✅ | **T1** SceneConfig schema + validateScene + 佔位房間收編 | [T1-scene-config.md](T1-scene-config.md) | T0 | Low |
| ⬜ | **T2** GLTF 管線 + field-low 場景 + ATTRIBUTIONS | [T2-gltf-pipeline.md](T2-gltf-pipeline.md) | T1 | High |
| ✅ | **T3** 淨空驗證器 + DrillLoader 拒載 | [T3-clearance-validator.md](T3-clearance-validator.md) | T1 | High |
| ⬜ | **T4** 場景切換 + meta.scene + 跨場景決定性斷言 | [T4-scene-switch-metadata.md](T4-scene-switch-metadata.md) | T2, T3 | Med |
| ⬜ | **T5** urban-high 第二場景 + 負載驗證 | [T5-second-scene-perf.md](T5-second-scene-perf.md) | T4 | Med |
| ⬜ | **T-exit** M9 宣告(四項證據) | [T-exit-gate.md](T-exit-gate.md) | T1–T5 | — |

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-19 狀態翻 ✅(M9 達成日期記入)。
