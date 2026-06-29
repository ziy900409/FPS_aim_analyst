# WP-3 — Progress Log

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: 🟡 規劃完成，待執行（前置：M1 達成）

| Phase | State |
|-------|-------|
| T0 Entry gate | ⬜ 待執行 |
| T1 鍵盤採集 | ⬜ 待執行 |
| T2 滑鼠 coalesced | ⬜ 待執行 |
| T3 開火事件 | ⬜ 待執行 |
| T4 sim 消費 | ⬜ 待執行 |
| T5 Exit gate | ⬜ 待執行 |

---

## Open Questions ledger（T0 解決）

| ID | Status | Resolution |
|----|--------|-----------|
| OQ-3.1 反向鍵定義 | 🟡 建議 | 採集層只記原始鍵碼；反向語意在 WP-5 處理 |
| OQ-3.2 緩衝結構 | ✅ grill | 固定欄位 **ring buffer**（真環狀、靜態容量、不動態 resize）；溢位 `bufferOverflow` |
| OQ-3.3 時間戳對齊 | ✅ grill | 同 `performance.now()` time origin（僅 Chromium，須重驗）|

---

## Log

### （規劃）— WP-3 計畫產出
- 依 PLAN WP-3（3.1–3.4）+ ADR-4/5 + 附錄 B 展開為 T0–T5。
- 釐清：精準度真正來源 = sub-tick 輸入時間戳（非 sim Hz）；coalesced events 確保高頻滑鼠不丟樣本；sim 端排序消費。
- **Next**：確認 M1 達成後執行 **T0**（[T0-entry-gate.md](T0-entry-gate.md)）。
