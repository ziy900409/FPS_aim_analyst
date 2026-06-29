# WP-4 — Progress Log

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: 🟡 規劃完成，待執行

| Phase | State |
|-------|-------|
| T0 Entry gate | ⬜ 待執行 |
| T1 目標 entity | ⬜ 待執行 |
| T2 可見性 + t_visible | ⬜ 待執行 |
| T3 左右交替 | ⬜ 待執行 |
| T4 Crosshair | ⬜ 待執行 |
| T5 Exit gate | ⬜ 待執行 |

---

## Open Questions ledger（T0 解決）

| ID | Status | Resolution |
|----|--------|-----------|
| OQ-4.1 目標幾何 / hitbox | 🟡 建議 | 膠囊/方塊 + head/body 兩 hitbox |
| OQ-4.2 「可見」定義 | 🟡 建議 | spawn 瞬間即可見，`t_visible`=spawn tick |
| OQ-4.3 交替序列驅動 | 🟡 建議 | 內建確定性輪替，WP-6 接管 |
| OQ-4.4 目標消失條件 | 🟡 建議 | 被標記擊殺 → 消失 → 生成對側（WP-5 接命中） |

---

## Log

### （規劃）— WP-4 計畫產出
- 依 PLAN WP-4（4.1–4.4）+ 規格 §5（`t_visible` 為反應時間起點）展開為 T0–T5。
- 關鍵：`t_visible` **必須在 sim tick 內蓋**（非 render frame），且只在可見轉換蓋一次——這是反應時間效度的把關點。
- **Next**：確認 M1 + WP-1 後執行 **T0**（[T0-entry-gate.md](T0-entry-gate.md)）。
