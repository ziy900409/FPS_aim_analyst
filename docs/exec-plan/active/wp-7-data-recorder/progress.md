# WP-7 — Progress Log ★M3

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: 🟡 規劃完成，待執行（達成即 M3）

| Phase | State |
|-------|-------|
| T0 Entry gate | ⬜ 待執行 |
| T1 Ring buffer | ⬜ 待執行 |
| T2 事件記錄 | ⬜ 待執行 |
| T3 Metadata | ⬜ 待執行 |
| T4 JSON/CSV 匯出 | ⬜ 待執行 |
| T5 Schema 文件 | ⬜ 待執行 |
| T6 Exit gate（M3） | ⬜ 待執行 |

---

## Open Questions ledger（T0 解決）

| ID | Status | Resolution |
|----|--------|-----------|
| OQ-7.1 ring buffer 容量/超量 | 🟡 建議 | 覆蓋單場 + 餘裕；超量覆寫最舊 + 旗標 |
| OQ-7.2 每 tick 欄位 | 🟡 建議 | `{t,vx,vz,crosshair,keys}`（附錄 C） |
| OQ-7.3 CSV 結構 | 🟡 建議 | JSON 為主 + ticks.csv / events.csv |
| OQ-7.4 重用 vs 匯出快照 | 🟡 建議 | 記錄重用、匯出一次性序列化 |

---

## Log

### （規劃）— WP-7 計畫產出
- 依 PLAN WP-7（7.1–7.5）+ 規格 §6 + 附錄 C 展開為 T0–T6。
- **M3 = 完整 drill 能端到端匯出**。核心紀律：ring buffer + 物件重用（無 GC 卡頓）；metadata 完整（backend/COI/sensitivity/Hz/browser）；schema 對齊附錄 C。
- **Next**：確認 M2 + WP-4/5 事件來源後執行 **T0**（[T0-entry-gate.md](T0-entry-gate.md)）。
