# WP-22 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate precheck(四上游 exit verified;WP-18 形狀對帳完成,無程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | — | Low |
| ✅ | **T1** 追蹤 drill × BR 場景 + E2E | [T1-tracking-in-scene.md](T1-tracking-in-scene.md) | T0 | Med |
| ⬜ | **T2** protocol 執行器 + 解析度 × 偵測受試者內 E2E | [T2-resolution-protocol-e2e.md](T2-resolution-protocol-e2e.md) | T0 | High |
| ⬜ | **T3** 決定性回歸擴充 + 驗收清單 C + pilot protocol | [T3-determinism-acceptance-c.md](T3-determinism-acceptance-c.md) | T1, T2 | Med |
| ⬜ | **T-exit** M10 宣告(stage3 交付) | [T-exit-gate.md](T-exit-gate.md) | T1–T3 | — |

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-22 狀態翻 ✅(M10 = stage3 交付,同步 [exec-plan/README.md](../../../README.md))。
