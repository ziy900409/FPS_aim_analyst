# WP-11 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ⬜ | **T0** entry gate(影響面盤點,無程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | WP-10 T1–T3 | Low |
| ⬜ | **T1** WeaponConfig + validateWeapon + 三把內建 | [T1-weapon-config.md](T1-weapon-config.md) | T0 | Low |
| ⬜ | **T2** fire down/up 事件鏈 + heldFire | [T2-fire-down-up.md](T2-fire-down-up.md) | T0 | Med |
| ⬜ | **T3** cycletime 產彈排程 + 彈匣 | [T3-cycletime-scheduler.md](T3-cycletime-scheduler.md) | T1, T2 | Med |
| ⬜ | **T-exit** 連發決定性 + 回歸全綠 | [T-exit-gate.md](T-exit-gate.md) | T1–T3 | — |

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md) 與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-11 狀態翻 ✅。