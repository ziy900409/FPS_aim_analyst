# T-exit — 驗收 + `analysis-visibility.md` 定稿 + 文件對帳

> Part of [WP-34 hold-click-visibility](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T3 |
| **Risk / Cplx** | — / Low |
| **Touches** | `docs/operational/analysis-visibility.md`(定稿)、[../README.md](../README.md)、[CONTEXT.md](../../../../../CONTEXT.md) |
| **狀態** | ⬜ |

## Objective

收斂 WP-34,開放 WP-35(`hold-track-v1`)entry。

## In scope

- 驗收框架 v1 條件:`hold-click` 不宣稱獨立 tracking 能力。
- `analysis-visibility.md` 定稿(N/門檻/`t_*` 定義 + occlusion-aware clearance 政策 + 已知限制)。
- 文件對帳(README §8 清單)。
- [../README.md](../README.md) §3:WP-34 狀態 ⬜ → ✅。

## Steps

- [ ] 驗收框架 v1 條件逐項覆核。
- [ ] `analysis-visibility.md` 定稿。
- [ ] 回寫 [CONTEXT.md](../../../../../CONTEXT.md) 新術語:`visibleFraction`、`t_measurement_onset`、`occlusion-aware clearance`。
- [ ] 更新 [../README.md](../README.md) §3(WP-34 狀態)。
- [ ] 確認 OQ-S6-12/OQ-S6-13 狀態(關閉或明確記錄未決影響)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 框架 v1 驗收條件通過 | progress.md 記錄逐項覆核 |
| ② | `analysis-visibility.md` 定稿 | 文件完整(N/門檻/`t_*`/occlusion 政策/限制) |
| ③ | CONTEXT.md 新術語回寫 | 條目存在 |
| ④ | `npm run test:ci` 全綠 | 貼原始輸出到 progress.md |
| ⑤ | WP-35 entry 前提滿足 | [../README.md](../README.md) WP-34 狀態翻 ✅ |

## Commit

`docs(wp-34): T-exit — 驗收清單覆核 + analysis-visibility.md 定稿,開放 WP-35 entry`
