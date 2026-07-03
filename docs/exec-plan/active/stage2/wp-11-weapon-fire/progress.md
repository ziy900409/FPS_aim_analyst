# WP-11 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: ⬜ 未開始

| Task | 狀態 |
|---|---|
| T0 entry gate | ⬜ |
| T1 WeaponConfig | ⬜ |
| T2 fire down/up | ⬜ |
| T3 cycletime 產彈 | ⬜ |
| T-exit | ⬜ |

---

## Open Questions ledger

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S2-6 彈匣盡行為(於 wp-10 T0 拍板,此處消費) | ⬜ 待引用 | — |
| OQ-11.1 單擊(down→up 極短)最少產 1 發的邊界(down 當 tick nextFireT 檢查) | ⬜ open | T3 設計時定案並測試 |

---

## Log

### 2026-07-03 — Plan authored
- 由 stage2 計畫([../README.md](../README.md))展開;補齊稽核 A5 缺口(無 WeaponConfig、無 cycletime、無 full-auto)。
- 關鍵契約:fire down/up 走 `EV_FIRE` 既有閒置 b 欄;產彈排程累加制;產彈點 = WP-13 recoil 掛點 seam。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))。