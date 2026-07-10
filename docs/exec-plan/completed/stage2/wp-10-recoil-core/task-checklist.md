# WP-10 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(決策拍板 + 對帳,無程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | — | Low |
| ✅ | **T1** ran1 RNG + 彈道表 + golden | [T1-ran1-recoil-table.md](T1-ran1-recoil-table.md) | T0 | Med |
| ✅ | **T2** punch 動力學 + 10 發 golden 向量 | [T2-punch-dynamics.md](T2-punch-dynamics.md) | T1 | High |
| ✅ | **T3** spread / inaccuracy 三成分 | [T3-spread-inaccuracy.md](T3-spread-inaccuracy.md) | T1 | Low |
| ✅ | **T4** 2D 彈道檢查頁(dev-only) | [T4-pattern-viewer.md](T4-pattern-viewer.md) | T2, T3 | Low |
| ✅ | **T-exit** M5 門(golden 全綠) | [T-exit-gate.md](T-exit-gate.md) | T1–T4 | — |

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../../../completed/stage2/README.md) 的 WP-10 狀態翻 ✅(M5)。
