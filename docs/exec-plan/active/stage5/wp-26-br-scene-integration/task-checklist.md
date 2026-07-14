# WP-26 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(上游三 WP 驗證 + 資產路線拍板,無程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | — | Low |
| ✅ | **T1** br-field 原創資產 + attribution | [T1-br-scene-assets.md](T1-br-scene-assets.md) | T0 | Med |
| ✅ | **T2** 場景上線 + 淨空 + perf + 決定性 | [T2-br-scene-online.md](T2-br-scene-online.md) | T1 + WP-23 | Med |
| ✅ | **T3** tracking_br_v1 + protocol(純 config) | [T3-br-tracking-drill.md](T3-br-tracking-drill.md) | T2 + WP-24/25 | Med |
| ✅ | **T4** 整合 E2E + 三不變性 + 驗收清單 E | [T4-e2e-acceptance.md](T4-e2e-acceptance.md) | T3 | Med |
| ⬜ | **T-exit** M13 宣告(stage5 交付) | [T-exit-gate.md](T-exit-gate.md) | T1–T4 | — |

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-26 狀態翻 ✅ + stage5 狀態對帳。
- **M12 未過 T3 不得使用 `bullet` 欄**(可先落 hitscan-only 條件,`bullet` 條件後補)。
