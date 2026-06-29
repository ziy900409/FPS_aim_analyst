# T2 — 結果頁（DOM）

> Part of [WP-8 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1 |
| **Risk / Complexity** | Low / Med |
| **Touches** | NEW `src/ui/ResultScreen.ts` |
| **Status** | ⬜ TODO |

## Objective
drill 結束後以 DOM overlay（D1）呈現結果：反應時間、命中率、停止時間、過衝、左右對稱，及反應時間分布小圖（FR-8.2）。

## In scope
- `ResultScreen`：數值卡（§5 指標）+ 反應時間分布小圖（為 WP-9 對照 150–250 ms 鋪路）。
- 左右對稱以左/右並列呈現 + 差值。
- §14 提醒：標註「受試者內相對值 + 顯示延遲誤差界線」。

## Out of scope
- 指標計算（T1）；匯出按鈕（WP-7 T4 已有，可在此放入）。

## Design notes
- 純 DOM/CSS；分布小圖可用簡單 SVG bar（不引圖表框架，D1）。
- drill ended 時顯示，restart/換 drill 時隱藏。

## Steps
- [ ] 建 `ResultScreen.ts`：卡 + 分布小圖 + 左右對稱 + §14 提醒。
- [ ] 接 `MetricsDashboard` 結果模型。
- [ ] 手動驗：跑完 drill → 結果頁顯示 8 指標數值 + 分布圖；數值與 T1 一致。
- [ ] `tsc` 乾淨。

## Definition of Done
- [ ] 結果頁呈現 §5 全部指標 + 反應時間分布 + 左右對稱 + 方法論提醒。

## Commit
`feat(wp-8): 賽後結果頁（DOM）（FR-8.2）`
