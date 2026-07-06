# WP-14 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(重錄授權 + 測試盤點,無程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | — | Low |
| ✅ | **T1** friction/accelerate integrator + baseline 重錄 | [T1-friction-integrator.md](T1-friction-integrator.md) | T0 | High |
| ✅ | **T2** velocity gate 連續模型(88 u/s) | [T2-velocity-gate.md](T2-velocity-gate.md) | T1、WP-11 T3 | Med |
| ✅ | **T3** 殘速/過衝指標連續化 | [T3-metrics-continuous.md](T3-metrics-continuous.md) | T2 | Low |
| ⬜ | **T-exit** baseline 重錄 + 手感驗證 | [T-exit-gate.md](T-exit-gate.md) | T1–T3 | — |

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-14 狀態翻 ✅。
