# WP-17 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(M7 + WP-16 上游驗證,無程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | — | Low |
| ✅ | **T1** 決定性回歸擴充(punch/彈著 × 3 FPS) | [T1-determinism-regression.md](T1-determinism-regression.md) | T0 | Med |
| ⬜ | **T2** 壓槍 drill 全鏈路 E2E | [T2-e2e-full-chain.md](T2-e2e-full-chain.md) | T1 | Med |
| ⬜ | **T-exit** M8 門(驗收清單 B,原 T3 併入) | [T-exit-gate.md](T-exit-gate.md) | T1, T2 | — |

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-17 狀態翻 ✅(M8 = stage2 交付)。
