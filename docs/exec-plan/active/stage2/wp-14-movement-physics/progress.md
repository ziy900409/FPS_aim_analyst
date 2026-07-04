# WP-14 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: ⬜ 未開始

| Task | 狀態 |
|---|---|
| T0 entry gate | ⬜ |
| T1 friction integrator | ⬜ |
| T2 velocity gate | ⬜ |
| T3 指標連續化 | ⬜ |
| T-exit | ⬜ |

---

## Open Questions ledger

| ID | 狀態 | 決議 |
|----|------|------|
| (無新 OQ;決定性 baseline 重錄授權由 GD-5 涵蓋,T0 驗證其存在) | — | — |

---

## Log

### 2026-07-03 — Valorant 接口決策(使用者拍板)
- **Valorant 移動不入本階段,只留接口**:T1 常數收斂為 `MovementProfile` 注入(`CS2_PROFILE` 預設)、
  T2 連續 velocity gate 為未來 Valorant 模式的直接繼承點;匯出斷代標記 `movementModel` 落 WP-16 T1。
- 依據分析:`MovementController` 已是注入式接縫(架構免改);真實成本在資料抽象 / 1D→2D / 單位校準——
  全數延後,WP-14 之後視研究立案另立 WP。

### 2026-07-03 — Plan authored
- 由 stage2 計畫([../README.md](../README.md) §6 WP-14 表 + session 補充設計)展開為自足 task 檔(T0–T3 + T-exit)。
- 物理公式權威來源 = 規格附錄 D(Source ground-move:`SV_FRICTION 5.2` / `SV_ACCELERATE 5.6` / `SV_STOPSPEED 75` / vStrafe ≈ 250)。
- 已知 breaking:integrator 會改變逐 tick 軌跡,既有決定性 baseline **預期重錄**(先重驗 M1 契約再重錄,見 T1)。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— GD-5 重錄授權確認 + 決定性測試盤點,docs-only。
