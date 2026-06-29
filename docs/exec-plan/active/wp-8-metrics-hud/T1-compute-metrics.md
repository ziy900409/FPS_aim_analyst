# T1 — 指標計算（§5 八指標純函式）

> Part of [WP-8 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T0 |
| **Risk / Complexity** | Med / High |
| **Touches** | NEW `src/metrics/compute.ts`、`src/metrics/MetricsDashboard.ts` |
| **Status** | ⬜ TODO |

## Objective
`computeMetrics(snapshot)` 純函式計算規格 §5 全部 8 指標，無主觀評分（FR-8.1）。

## In scope（§5 對照）
- 急停反應時間 = `t_counter − t_visible`。
- 速度歸零誤差 = 開火 tick `|velocity|`（residualSpeed）。
- 停火時序對齊 = `t_fire − t_velocity_zero`（負=未停先開）。
- 首發命中率 = 首發命中 / 總 peek × 100%。
- 準心對齊偏移 = 開火 tick 準心與目標中心距離/角度。
- 切換時間 = `t_next_acquisition − t_prev_kill`。
- 節奏穩定度 = 循環時長 SD / CV。
- 左右對稱性 = 左/右 peek 分別統計 + 差值。

## Out of scope
- 呈現（→ T2）；HUD（→ T3）。

## Design notes
- 全部從 `ticks[]`（velocity/準心）+ `events[]`（visible/counter/fire）確定算出（OQ-8.1 同源）。
- `Stat{mean,sd,n,values?}` 統一回傳；空樣本 n=0（不 NaN 外漏）。
- 過衝（結果頁用）以 velocity 過零後反向量近似（OQ-8.2）。

## Steps
- [ ] 建 `compute.ts`：逐指標純函式。
- [ ] `MetricsDashboard`：drill ended → `computeMetrics(snapshot)`。
- [ ] Vitest：對每指標餵**已知**合成 snapshot → 斷言精確數值（含左右對稱、空樣本 N/A）。
- [ ] `vitest run` + `tsc` 綠燈。

## Definition of Done
- [ ] 8 指標皆有純函式 + 固定輸入→固定輸出測試；對照 §5 定義正確；空樣本安全。

## Commit
`feat(wp-8): §5 八指標計算（純函式）（FR-8.1）`
