# WP-28 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ⬜ | **T0** entry gate(決策落地 + CLAUDE.md §4 + 樣本狀態;無演算法碼) | [T0-entry-gate.md](T0-entry-gate.md) | — | Low |
| ⬜ | **T1** scaffold + ingest + 合成匯出產生器 | [T1-scaffold-ingest.md](T1-scaffold-ingest.md) | T0 | Low |
| ⬜ | **T2** 角運動學 ω(t)/ε(t) + **ε 雙向 parity 閘** | [T2-angular-kinematics.md](T2-angular-kinematics.md) | T1 | High |
| ⬜ | **T3** SG + submovement 分段(參數凍結) | [T3-submovement-segments.md](T3-submovement-segments.md) | T2 | High |
| ⬜ | **T4** per_segment_apply + quality flags | [T4-per-segment-flags.md](T4-per-segment-flags.md) | T3 | Low |
| ⬜ | **T-exit** M14 宣告 | [T-exit-gate.md](T-exit-gate.md) | T1–T4 | — |

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-28 狀態翻 ✅。
- **兩個閘都要貼證據**:`uv run pytest`(research)+ `npm run test:ci`(engine,含 parity 對表)。
- **M14 未過不開 WP-30/31**;真實匯出樣本未到位時 M14 不得宣告(T-exit 阻塞項)。
