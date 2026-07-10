# WP-23 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(上游驗證 + OQ-S5-4 拍板,無程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | — | Low |
| ✅ | **T1** hitbox config 化(單一來源;零破壞) | [T1-hitbox-config.md](T1-hitbox-config.md) | T0 | High |
| ✅ | **T2** 遠距追蹤 drill config(角參數反推) | [T2-longrange-drill.md](T2-longrange-drill.md) | T1 | Med |
| ✅ | **T3** round-trip + 決定性 + 結果頁 sanity | [T3-metrics-roundtrip.md](T3-metrics-roundtrip.md) | T2 | Med |
| ⬜ | **T-exit** M11 宣告 | [T-exit-gate.md](T-exit-gate.md) | T1–T3 | — |

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-23 狀態翻 ✅。
