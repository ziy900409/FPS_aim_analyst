# WP-12 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(OQ-S2-3 拍板,無程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | — | Low |
| ✅ | **T1** 感度 CS2 0.022°/count + meta 標記 | [T1-cs2-sensitivity.md](T1-cs2-sensitivity.md) | T0 | Low |
| ⬜ | **T2** raycastWithRay 方向注入 + 薄包裝 | [T2-ray-injection.md](T2-ray-injection.md) | — | Low |
| ⬜ | **T-exit** 回歸全綠 + 手感抽查 | [T-exit-gate.md](T-exit-gate.md) | T1, T2 | — |

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md) 與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-12 狀態翻 ✅。
