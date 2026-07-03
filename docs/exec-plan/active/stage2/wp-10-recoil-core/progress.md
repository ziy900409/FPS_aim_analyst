# WP-10 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: ⬜ 未開始

| Task | 狀態 |
|---|---|
| T0 entry gate | ⬜ |
| T1 ran1 + 彈道表 | ⬜ |
| T2 punch 動力學 | ⬜ |
| T3 spread/inaccuracy | ⬜ |
| T4 2D 檢查頁 | ⬜ |
| T-exit(M5) | ⬜ |

---

## Open Questions ledger(T0 解決)

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S2-1 recoil tick 節奏(建議:64Hz 子節奏,偶數 sim tick) | ⬜ open | — |
| OQ-S2-6 彈匣盡行為(建議:停火、無 reload) | ⬜ open | — |

---

## Log

### 2026-07-03 — Plan authored
- 由 stage2 計畫([../README.md](../README.md))展開為自足 task 檔(T0–T4 + T-exit)。
- 演算法權威來源 = [研究計畫](../CS2%20壓槍軌跡復刻研究計畫.md) Phase 1;golden 測試向量 = Phase 4(seed 223、10 發 punch −10.18°/−1.56°、前 4 發抑制係數)。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— 決策拍板 + GD-5 對帳,docs-only commit。