# WP-20 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: ⬜ 未開始

| Task | 狀態 |
|---|---|
| T0 entry gate | ⬜ |
| T1 解析度模式 | ⬜ |
| T2 fullscreen + 資格閘 | ⬜ |
| T3 frame-time log | ⬜ |
| T4 session setup 表單 | ⬜ |
| T-exit | ⬜ |

---

## Open Questions ledger(T0 解決)

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S3-1 效能地板門檻(warmup p95 ≤ ?ms;drill 中 suspect 門檻)起點值 | ⬜ open | — |
| OQ-S3-4 frames 匯出形式(JSON 完整序列 + 摘要;CSV 只摘要)確認 | ⬜ open | — |
| OQ-20.1 `MAX_DISPLAY_HZ` 容量常數(計畫預設 240)與更新率估計演算法(rAF deltas 中位數) | ⬜ open | — |
| OQ-20.2 meta.display 落點:WP-16 已留 optional 區塊縫?(未留 → 與 WP-16 對帳,比照 OQ-19.2) | ⬜ open | — |

---

## Log

### 2026-07-06 — Plan authored
- 由 stage3 計畫([../README.md](../README.md) §3/§6)展開為自足 task 檔(T0–T4 + T-exit)。
- 決議依據:GD-10(全遠端 + 三道 blocking 防線;實驗構念 =「同一面板上的 render 解析度效應」)、
  GD-8(frame log = 跨解析度顯示鏈延遲差的效度防線)。
- 設計要點:`setPixelRatio(1)` + 顯式 buffer 繞開 DPI 隱式縮放;資格閘不合格 = **拒入**
  實驗 session(非僅記錄);自陳欄僅 moderator。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— GD-10 收斂 + 效能地板起點,docs-only。
