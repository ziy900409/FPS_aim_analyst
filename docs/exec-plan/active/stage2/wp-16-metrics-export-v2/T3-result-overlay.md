# T3 — 結果頁軌跡對照(實際 vs 理想路徑)

> Part of [WP-16 metrics-export-v2](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T2(指標與序列就緒) |
| **Risk / Cplx** | Low / Med |
| **Touches** | MODIFY `src/ui/ResultScreen.ts` + `src/ui/ResultScreen.test.ts` |
| **狀態** | ⬜ |

## Objective

結果頁把實際壓槍軌跡與理想路徑畫在同一 2D 圖(pitch/yaw 平面)並列 mean/RMS——
玩家看得懂自己「拉太多 / 拉太少 / 時機晚」(FR-B15 呈現面)。

## In scope
- 2D 軌跡疊圖:DOM overlay(D1 純 TS;canvas 或 inline SVG 取 ResultScreen 現況技術最小改);
  兩線 + 圖例 + mean/RMS 數值列。
- 數值列與 T2 統計物件**同源**(直接讀結算物件,不在 UI 層重算——統計=呈現一致性)。
- 邊界處理:零 fire drill 優雅隱藏區塊;單發 drill 顯示單點而非線。
- 合成資料渲染快照測試(固定 10 發序列 → DOM/繪製輸出穩定)。

## Out of scope
- 匯出圖檔、互動(zoom/hover)、彈著散點疊加(潛在 backlog,記 progress);
  匯出 payload 變更(T1 已收斂)。

## Steps

- [ ] 疊圖繪製(座標歸一 + 兩序列 + 圖例 + 數值列)。
- [ ] 空資料 / 單發邊界處理。
- [ ] 快照測試(合成 10 發)+ 既有 ResultScreen 測試綠(疊層 z-index 迴歸留意:
      參照 2026-07-03 匯出面板疊層 bug 的教訓,新區塊不得蓋住既有互動)。
- [ ] `npx vitest run` 全綠;dev server 手動目視一次記 progress。

## Definition of Done

- 快照測試綠;手動目視紀錄(截圖或文字描述)在 progress;既有結果頁功能不退化。

## Commit

`feat(wp-16): T3 結果頁壓槍軌跡對照(實際 vs 理想 + mean/RMS)`
