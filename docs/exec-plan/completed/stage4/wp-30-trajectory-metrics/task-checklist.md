# WP-30 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(驗 M14 六項含 A2-T4 + fixture roster 凍結 + suspect 使用界線 + `phase-v1`/`curve-v1` pre-registration;無演算法碼) | [T0-entry-gate.md](T0-entry-gate.md) | **A2-T4** | Low |
| ✅ | **T1** `t_detect` / eccentricity Python 推導 + **對表閘 ≤1e-9**(含反 vacuous) | [T1-detect-parity.md](T1-detect-parity.md) | T0 | Med |
| ✅ | **T2** REC/MR/V phase 分解 + `phase-v1` 雙維度掃參凍結 + REC-end vs t_detect 一致性檢查 | [T2-phase-decompose.md](T2-phase-decompose.md) | T1 | **Med** |
| ✅ | **T3** L/R 101 點正規化曲線(`curve-v1`)+ 逐 side 平均與分佈帶 | [T3-lr-curves.md](T3-lr-curves.md) | T0(**不依賴 T1/T2**) | Low |
| ✅ | **T-exit** 教練報告 v1 + `analysis-phase-curves.md` 定稿 + 文件對帳 | [T-exit-gate.md](T-exit-gate.md) | T2 + T3 | — |

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-30 狀態翻 ✅。
- **兩個閘都要貼證據**:`uv run pytest`(research)+ `npm run test:ci`(engine,含 T1 的 `detect-parity.test.ts`)。

## 本 WP 特有的四條紀律

1. **entry blocker 不得自行放行**:[KI-005-A / A2-T4](../../../../known_issue/KI-005-A/A2-blocked-plan.md#a2-t4--m14-③④⑤-重新宣告-✅-已完成2026-08-07)(M14 ③④⑤ 重新宣告)已於 2026-08-07 落地,entry blocker 已解除;但 T0 仍須自行覆核上游 exit-gate 的實際證據後才可開 T1,不得只信任帳本文字。
2. **fixture roster 是硬閘不是偏好**:ω/ε 指標只可用 09:18 / 09:24 / 09:37 + 合成;08:03 / 09:39 為 `aim-diff-legacy` 且無 `meta.scene.eye`,**禁用**。以 `omega_deg_s(strict=True)` + `resolve_eye_origin(strict=True)` 機械化,並以負向測試釘死。
3. **參數凍結必須雙維度**:`phase-v1` / `curve-v1` 只在合成資料上通過**不得**凍結 —— 這正是 `seg-v1` 失敗的機制(合成訊號不含真實現象)。沿用 `seg-v2` 的「合成通過條件 + 真實第二維度」模式。
4. **五條上游凍結不得動**:`compute-v1`、`timeline-v1`、`sync-v1`、`seg-v2`(及仍有效的 `seg-v1`)、`construct-v1`。要改一律升 version + 全鏈重跑(D-28.7 先例)。
