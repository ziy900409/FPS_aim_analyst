# WP-18 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(上游 exit + F5 seam 基線 + OQ 收斂,無程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | — | Low |
| ⬜ | **T1** motion drive(每 tick 驅動 target.pos;static 零破壞) | [T1-motion-drive.md](T1-motion-drive.md) | T0 | High |
| ⬜ | **T2** sub-tick 命中內插(FR-B17;靜止目標零破壞) | [T2-subtick-hit-interpolation.md](T2-subtick-hit-interpolation.md) | T1 | High |
| ⬜ | **T3** timed presentation 推進 + 目標 render 內插 | [T3-timed-presentation-render-interp.md](T3-timed-presentation-render-interp.md) | T1 | Med |
| ⬜ | **T4** tracking drill config + 追蹤指標離線推導 spec + fixture | [T4-tracking-drill-metrics-spec.md](T4-tracking-drill-metrics-spec.md) | T2, T3 | Med |
| ⬜ | **T5** 移動目標跨 FPS 決定性回歸 + drill 掛線整合 | [T5-determinism-regression-integration.md](T5-determinism-regression-integration.md) | T1–T4 | Med |
| ⬜ | **T-exit** 交付宣告(WP-22 T1 可消費)+ OQ-S3-5 對帳 | [T-exit-gate.md](T-exit-gate.md) | T1–T5 | — |

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-18 列狀態翻 ✅(索引 line 222/267/294),視需要把資料夾移入 `completed/stage2/`。
- **下游對帳**:T-exit 綠燈後,回 [WP-22 T0](../../stage3/wp-22-perception-integration/T0-entry-gate.md) 重跑 OQ-S3-5(交付形狀互驗),解除 WP-22 T1 的 blocked。
