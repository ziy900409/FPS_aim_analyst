# WP-28 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(決策落地 + CLAUDE.md §4 + 樣本狀態;無演算法碼) | [T0-entry-gate.md](T0-entry-gate.md) | — | Low |
| ✅ | **T1** scaffold + ingest + 合成匯出產生器 | [T1-scaffold-ingest.md](T1-scaffold-ingest.md) | T0 | Low |
| ✅ | **T2** 角運動學 ω(t)/ε(t) + **ε 雙向 parity 閘** | [T2-angular-kinematics.md](T2-angular-kinematics.md) | T1 | High |
| ✅ | **T3** SG + submovement 分段(`seg-v1` 凍結;合成 DoD;真實資料證據於 2026-08-05 T-exit 補齊) | [T3-submovement-segments.md](T3-submovement-segments.md) | T2 | High |
| ✅ | **T4** per_segment_apply + quality flags | [T4-per-segment-flags.md](T4-per-segment-flags.md) | T3 | Low |
| ✅ | **T-exit** M14 宣告(2026-08-05;六項 DoD 全綠;真實樣本 19/20 分段 + 疊圖人工檢核) | [T-exit-gate.md](T-exit-gate.md) | T1–T4 | — |

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-28 狀態翻 ✅。
- **兩個閘都要貼證據**:`uv run pytest`(research)+ `npm run test:ci`(engine,含 parity 對表)。
- ~~**M14 已於 2026-08-05 宣告**;WP-30/31 entry blocker 已解除。~~ ⚠️ **已作廢**:M14 **②③④⑤ 分兩次撤回**(② 2026-08-05 [KI-004](../../../../known_issue/KI-004-sim-world-unit-domain-mismatch.md);③④⑤ 2026-08-06 [KI-005](../../../../known_issue/KI-005-omega-render-sim-aliasing.md) + [KI-006](../../../../known_issue/KI-006-m14-sample-no-counterstrafe.md)),**僅 ①⑥ 維持**;**WP-30/31 entry blocker 維持**(三條獨立理由)。`seg-v1` 已被真實資料否證(SG window 7 < beat 週期 8),依 D-28.7 須**升版 `seg-v2` 重跑全鏈,不得原地調參**。
