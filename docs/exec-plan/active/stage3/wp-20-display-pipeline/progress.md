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

### 2026-07-07 — FPSci R2/R3 對齊決策(使用者拍板,grill)
- **R3 採納(縮限版)**:T4 加 session 識別欄 `participantId`(必填)/`sessionLabel`(選填),
  進 meta `session` 區塊(v2 reserved,形狀歸 WP-16 T1)——原 T4 out-of-scope 的
  「受試者 ID 待 WP-22 T2 對帳」懸案在此解決;experiment 層 = 分析端概念、引擎不實作,
  三層術語入 CONTEXT §A。FPSci 的 userstatus/config `#include`/受試者管理後端不採納。
- **R2 不採納**:click-to-photon 硬體校準不做(latency probe 頁/protocol 皆不入計畫);
  接受瀏覽器 compositor 盲區為先天限制,審稿以誤差界線(規格 §15)+ 受試者內對比(GD-10)
  + frame-time log(T3)回應。
- 出處:[FPSci 評估](../../../../research/FPSci_評估與建議.md) R2/R3;授權紅線 GD-11。

### 2026-07-06 — Plan authored
- 由 stage3 計畫([../README.md](../README.md) §3/§6)展開為自足 task 檔(T0–T4 + T-exit)。
- 決議依據:GD-10(全遠端 + 三道 blocking 防線;實驗構念 =「同一面板上的 render 解析度效應」)、
  GD-8(frame log = 跨解析度顯示鏈延遲差的效度防線)。
- 設計要點:`setPixelRatio(1)` + 顯式 buffer 繞開 DPI 隱式縮放;資格閘不合格 = **拒入**
  實驗 session(非僅記錄);自陳欄僅 moderator。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— GD-10 收斂 + 效能地板起點,docs-only。
