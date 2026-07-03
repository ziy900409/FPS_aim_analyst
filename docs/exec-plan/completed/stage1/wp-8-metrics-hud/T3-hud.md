# T3 — 即時 HUD（DOM）

> Part of [WP-8 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T0 |
| **Risk / Complexity** | Low / Med |
| **Touches** | NEW `src/ui/HUD.ts`；MODIFY `src/main.ts`（rAF 更新） |
| **Status** | ✅ DONE（2026-07-03） |

## Objective
遊戲中即時 HUD（DOM overlay，D1）：分數、計時、命中率、velocity 指示（FR-8.3）。HUD 只在 rAF 讀 `SharedState`/記錄更新文字，不污染量測。

## In scope
- `HUD`：分數（擊殺數）、drill 計時、累積命中率、velocity 指示（停止/移動狀態條）。
- rAF 更新（與 RenderLoop 同步讀值）。

## Out of scope
- 賽後統計（→ T2）；sim 邏輯。

## Design notes
- **不進 sim、不每幀配置**：HUD 讀 `SharedState.player`（velocity/stopped）+ recorder 累積，更新既有 DOM 節點 textContent。
- velocity 指示反映「停止 gate」狀態，幫助玩家學急停時機。

## Steps
- [x] 建 `HUD.ts`：DOM 結構 + `update(state, stats)`。
- [x] rAF 內呼叫 `HUD.update`（重用節點）。
- [x] DOM smoke / 審查：分數/計時/命中率即時讀值路徑存在，velocity 指示讀 stopped/moving。
- [x] 審查：HUD 不寫 SharedState、不每幀 new。
- [x] `tsc` 乾淨。

## Definition of Done
- [x] HUD 即時顯示分數/計時/命中率/velocity；不污染量測（審查通過）。

## Commit
`feat(wp-8): 即時 HUD（分數/計時/命中率/velocity）（FR-8.3）`
