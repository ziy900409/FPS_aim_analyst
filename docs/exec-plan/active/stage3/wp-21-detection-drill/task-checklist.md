# WP-21 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(GD-7/8 收斂 + spawnArea 決議,無程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | — | Low |
| ✅ | **T1** seeded spawn(schema 擴欄 + TargetManager;零破壞) | [T1-seeded-spawn.md](T1-seeded-spawn.md) | T0 | High |
| ✅ | **T2** 偵測 drill config + spawn 事件位置欄 | [T2-detection-drill-config.md](T2-detection-drill-config.md) | T1 | Med |
| ⬜ | **T3** t_detect/偏心度離線推導 spec + fixture | [T3-offline-derivation-spec.md](T3-offline-derivation-spec.md) | T2 + WP-16 | Med |
| ⬜ | **T-exit** 偵測鏈交付宣告 | [T-exit-gate.md](T-exit-gate.md) | T1–T3 | — |

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-21 狀態翻 ✅。
