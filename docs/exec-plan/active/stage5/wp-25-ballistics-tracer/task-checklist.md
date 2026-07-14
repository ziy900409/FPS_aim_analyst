# WP-25 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(GD-17 參數域拍板,無程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | — | Low |
| ✅ | **T1** tracer(shotRays + TracerView + 開關;render-only) | [T1-tracer-view.md](T1-tracer-view.md) | T0 | Med |
| ✅ | **T2** projectile 數學核心 + golden | [T2-projectile-math-core.md](T2-projectile-math-core.md) | T0 + M11 | Med |
| ⬜ | **T3** sim 整合(config gate + arena;hitscan 零破壞) | [T3-sim-integration.md](T3-sim-integration.md) | T2 | High |
| ⬜ | **T4** 指標語意 + lead spec + 決定性 | [T4-metrics-semantics.md](T4-metrics-semantics.md) | T3 | Med |
| ⬜ | **T-exit** M12 宣告 | [T-exit-gate.md](T-exit-gate.md) | T1–T4 | — |

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-25 狀態翻 ✅。
- **M11 未過不開 T2**;**M12 未過 `bullet` 欄不得進任何 drill config**。
