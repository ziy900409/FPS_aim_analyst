# T-exit — 驗收 + `analysis-visibility.md` 定稿 + 文件對帳

> Part of [WP-34 hold-click-visibility](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T3 |
| **Risk / Cplx** | — / Low |
| **Touches** | `docs/operational/analysis-visibility.md`(定稿)、[../README.md](../README.md)、[CONTEXT.md](../../../../../CONTEXT.md) |
| **狀態** | ✅ 完成(2026-08-19) |

## Objective

收斂 WP-34,開放 WP-35(`hold-track-v1`)entry。

## In scope

- 驗收框架 v1 條件:`hold-click` 不宣稱獨立 tracking 能力。
- `analysis-visibility.md` 定稿(N/門檻/`t_*` 定義 + occlusion-aware clearance 政策 + 已知限制)。
- 文件對帳(README §8 清單)。
- [../README.md](../README.md) §3:WP-34 狀態 ⬜ → ✅。

## Steps

- [x] 驗收框架 v1 條件逐項覆核(見 [progress.md](progress.md) T-exit 覆核表;本 WP 範圍內項目全通過,範圍外項目明文標 N/A 並指向後續 WP)。
- [x] `analysis-visibility.md` 定稿(補 occlusion-aware clearance 政策章節 + Known Limitations)。
- [x] 回寫 [CONTEXT.md](../../../../../CONTEXT.md) 新術語:`visibleFraction(t)`／可見度時間線(含 `t_measurement_onset` 等三時間錨)、`occlusion-aware clearance`。
- [x] 更新 [../README.md](../README.md) §3/§9(WP-34 狀態);同步更新本資料夾 README.md §3/§4/§7 與 [exec-plan/README.md](../../../README.md) 頂層索引。
- [x] 確認 OQ-S6-12/OQ-S6-13 狀態:OQ-S6-13 已由 D-34.4 關閉;OQ-S6-12 明確記錄為**不阻塞**(candidate 值已 pre-registered,最終凍結留給 WP-39 pilot)。

## Definition of Done

| # | 條件 | 判定方式 | 結果 |
|---|---|---|---|
| ① | 框架 v1 驗收條件通過 | progress.md 記錄逐項覆核 | ✅ 本 WP 範圍內全通過(`hold-click` 不宣稱 tracking 能力等);範圍外項目標 N/A 並指向 WP-35~39 |
| ② | `analysis-visibility.md` 定稿 | 文件完整(N/門檻/`t_*`/occlusion 政策/限制) | ✅ |
| ③ | CONTEXT.md 新術語回寫 | 條目存在 | ✅ §A/§C 各新增一條 |
| ④ | `npm run test:ci` 全綠 | 貼原始輸出到 progress.md | 🟡 `tsc --noEmit` + Vitest 104 files/860 tests 全綠;Playwright 既有 app-ready flake(非本 WP 引入,見 S-34.3/S-34.4/S-34.5)——單獨重跑失敗案例皆綠,判定為既有基礎設施 flake,不阻塞收斂 |
| ⑤ | WP-35 entry 前提滿足 | [../README.md](../README.md) WP-34 狀態翻 ✅ | ✅ |

## Commit

`docs(wp-34): T-exit — 驗收清單覆核 + analysis-visibility.md 定稿,開放 WP-35 entry`
