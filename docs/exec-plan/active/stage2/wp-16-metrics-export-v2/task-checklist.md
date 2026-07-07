# WP-16 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(上游驗證 + 語意決議,無程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | — | Low |
| ⬜ | **T1** schema v2 擴欄 + schemaVersion + 容量重估 | [T1-schema-v2.md](T1-schema-v2.md) | T0 | Med |
| ⬜ | **T2** 理想路徑 + 補償誤差 mean/RMS | [T2-ideal-path-metric.md](T2-ideal-path-metric.md) | T1 | Low |
| ⬜ | **T3** 結果頁軌跡對照 | [T3-result-overlay.md](T3-result-overlay.md) | T2 | Low |
| ⬜ | **T-exit** 不變式全綠 + 對帳宣告 | [T-exit-gate.md](T-exit-gate.md) | T1–T3 | — |

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-16 狀態翻 ✅。
