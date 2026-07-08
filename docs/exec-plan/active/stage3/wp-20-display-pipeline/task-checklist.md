# WP-20 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(GD-10 收斂 + 效能地板起點,無程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | — | Low |
| ✅ | **T1** 解析度模式 + 顯式 buffer + display 自動 meta | [T1-resolution-modes.md](T1-resolution-modes.md) | T0 | Med |
| ✅ | **T2** fullscreen + 資格閘(拒入) | [T2-fullscreen-eligibility-gate.md](T2-fullscreen-eligibility-gate.md) | T1 | High |
| ⬜ | **T3** frame-time log + frames 匯出 + suspect | [T3-frame-time-log.md](T3-frame-time-log.md) | T1 | Med |
| ⬜ | **T4** session setup 表單 + 自陳 meta | [T4-session-setup-form.md](T4-session-setup-form.md) | T1 | Low |
| ⬜ | **T-exit** 四件套交付宣告 | [T-exit-gate.md](T-exit-gate.md) | T1–T4 | — |

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-20 狀態翻 ✅。
