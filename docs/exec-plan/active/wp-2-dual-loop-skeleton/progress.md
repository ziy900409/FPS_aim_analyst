# WP-2 — Progress Log ★脊椎（M1）

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: 🟡 規劃完成，待執行 — **M1 門控**

| Phase | State |
|-------|-------|
| T0 Entry gate | ⬜ 待執行 |
| T1 SharedState | ⬜ 待執行 |
| T2 SimLoop accumulator | ⬜ 待執行 |
| T3 Render 內插 | ⬜ 待執行 |
| T4 決定性驗證（M1 gate） | ⬜ 待執行 |
| T5 Exit gate（宣告 M1） | ⬜ 待執行 |

---

## Open Questions ledger（T0 解決）

| ID | Status | Resolution |
|----|--------|-----------|
| OQ-2.1 決定性佔位 sim 邏輯 | 🟡 建議 | 等速位移 + 合成輸入切換 velocity |
| OQ-2.2 render FPS 變化方式 | 🟡 建議 | 餵不同 frame delta 序列（60/144/240 + 抖動 + spike）給同一 accumulator |
| OQ-2.3 sim 時間源 | 🟡 建議 | `clock.ts` 介面；正式 `performance.now()`、測試注入 |
| OQ-2.4 階段 B worker seam | 🟡 建議 | 留 `simStep` 純函式邊界，不實作 worker |

---

## Log

### （規劃）— WP-2 計畫產出
- 依 PLAN WP-2 + 規格 ADR-2/3/4 + §4.3 accumulator 虛擬碼展開為 T0–T5。
- **M1 = 專案脊椎**：T4 決定性驗證為門控閘，未過不展開 WP-3+。
- 關鍵設計：三迴圈只經 `SharedState` 溝通；`simStep` 純函式邊界（預留階段 B worker）；`clock.ts` 注入式時間（可測 + 守 ADR-4）；render 唯讀 + prev/curr 雙快照內插。
- **Next**：WP-0/WP-1 exit 綠燈後執行 **T0**（[T0-entry-gate.md](T0-entry-gate.md)）。
