# WP-1 — Progress Log

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: 🟡 規劃完成，待執行

| Phase | State |
|-------|-------|
| T0 Entry gate | ⬜ 待執行 |
| T1 SceneManager | ⬜ 待執行 |
| T2 Pointer Lock | ⬜ 待執行 |
| T3 原始輸入 + fallback | ⬜ 待執行 |
| T4 yaw/pitch | ⬜ 待執行 |
| T5 設定面板 | ⬜ 待執行 |
| T6 Exit gate | ⬜ 待執行 |

---

## Open Questions ledger（T0 解決）

| ID | Status | Resolution |
|----|--------|-----------|
| OQ-1.1 sensitivity 換算 | 🟡 建議 | counts→radians 線性係數，sensitivity 可調，pilot 校準 |
| OQ-1.2 房間/距離 | 🟡 建議 | 佔位常數（10×10×3 m，距離 ~8 m），正式值待 WP-6 |
| OQ-1.3 設定面板可見時機 | 🟡 建議 | 鎖定中隱藏、解除時顯示 |

---

## Log

### （規劃）— WP-1 計畫產出
- 依 PLAN WP-1（1.1–1.5）+ 規格 ADR-5 + 附錄 B 展開為 T0–T6。
- 邊界釐清：視角走輸入/render 路徑，**不入 sim**（sim 屬 WP-2）；高頻採樣入緩衝屬 WP-3，本 WP 滑鼠只驅動視角。
- **Next**：WP-0 exit 綠燈後執行 **T0**（[T0-entry-gate.md](T0-entry-gate.md)）。
