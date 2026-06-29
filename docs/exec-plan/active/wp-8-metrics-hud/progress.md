# WP-8 — Progress Log

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: 🟡 規劃完成，待執行

| Phase | State |
|-------|-------|
| T0 Entry gate | ⬜ 待執行 |
| T1 指標計算 | ⬜ 待執行 |
| T2 結果頁 | ⬜ 待執行 |
| T3 即時 HUD | ⬜ 待執行 |
| T4 控制 | ⬜ 待執行 |
| T5 Exit gate | ⬜ 待執行 |

---

## Open Questions ledger（T0 解決）

| ID | Status | Resolution |
|----|--------|-----------|
| OQ-8.1 指標來源 | 🟡 建議 | 用 WP-7 snapshot（與匯出同來源） |
| OQ-8.2 過衝定義 | 🟡 建議 | velocity 軌跡：速度過零後反向量近似 |
| OQ-8.3 HUD 即時值 | 🟡 建議 | 分數/計時/命中率/velocity 狀態 |
| OQ-8.4 結果頁圖表 | 🟡 建議 | 數值卡 + 反應時間分布小圖 |

---

## Log

### （規劃）— WP-8 計畫產出
- 依 PLAN WP-8（8.1–8.4）+ 規格 §5（8 指標）+ §14（受試者內相對值）展開為 T0–T5。
- 核心：指標純機械計算、與匯出**同一 snapshot 來源**（確保統計=匯出，WP-9 交叉驗證）；HUD 不污染量測。
- **Next**：確認 M3 後執行 **T0**（[T0-entry-gate.md](T0-entry-gate.md)）。
