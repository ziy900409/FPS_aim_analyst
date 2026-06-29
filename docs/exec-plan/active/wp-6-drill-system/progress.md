# WP-6 — Progress Log

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: 🟡 規劃完成，待執行

| Phase | State |
|-------|-------|
| T0 Entry gate | ⬜ 待執行 |
| T1 DrillConfig schema | ⬜ 待執行 |
| T2 Drill 載入器 | ⬜ 待執行 |
| T3 Counter-strafe drill 檔 | ⬜ 待執行 |
| T4 Drill 生命週期 | ⬜ 待執行 |
| T5 Exit gate | ⬜ 待執行 |

---

## Open Questions ledger（T0 解決）

| ID | Status | Resolution |
|----|--------|-----------|
| OQ-6.1 schema 欄位 | 🟡 建議 | drillId/targets/sequence/timing/endCondition；TS + JSON Schema |
| OQ-6.2 位置定義 | 🟡 建議 | L/R 槽位 + 距離抽象 |
| OQ-6.3 結束條件預設 | 🟡 建議 | 目標數達標（可選時限） |
| OQ-6.4 載入失敗處理 | 🟡 建議 | 載入驗證 throw、不啟動 |

---

## Log

### （規劃）— WP-6 計畫產出
- 依 PLAN WP-6（6.1–6.4）+ F4 + 附錄 C 展開為 T0–T5。
- 核心：把 WP-4 內建佔位序列換成 **config 驅動**，新增 drill = 新增 JSON（零引擎改動）。生命週期 idle→countdown→running→ended + restart 全 reset。
- **Next**：確認 M2 後執行 **T0**（[T0-entry-gate.md](T0-entry-gate.md)）。
