# WP-9 — Progress Log ★M4（階段 A 交付）

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: 🟡 規劃完成，待執行（達成即 M4 階段 A 交付）

| Phase | State |
|-------|-------|
| T0 Entry gate | ⬜ 待執行 |
| T1 E2E 整合 | ⬜ 待執行 |
| T2 計時效度 | ⬜ 待執行 |
| T3 決定性回歸 | ⬜ 待執行 |
| T4 緩衝 + 附錄 E | ⬜ 待執行 |
| T5 Exit gate（M4） | ⬜ 待執行 |

---

## Open Questions ledger（T0 解決）

| ID | Status | Resolution |
|----|--------|-----------|
| OQ-9.1 E2E 模擬 Pointer Lock/原生 | 🟡 建議 | harness 合成輸入做自動鏈路 + COI/匯出斷言；原生無加速手動補 |
| OQ-9.2 計時效度判準 | 🟡 建議 | 分布落 ~150–250 ms 量級 sanity（非單值硬閾） |
| OQ-9.3 決定性回歸 CI | 🟡 建議 | 有 CI 加 workflow；否則 `test:ci` 本機腳本 exit code 閘 |
| OQ-9.4 附錄 E 自動 vs 手動 | 🟡 建議 | COI/決定性/schema/首發/反應分布自動；原生手感手動 |

---

## Log

### （規劃）— WP-9 計畫產出
- 依 PLAN WP-9（9.1–9.4）+ 規格附錄 E/F + §9.2 + §14 展開為 T0–T5。
- **M4 = 階段 A 交付**：附錄 E 驗收清單全綠為硬閘。三道計時效度防線：COI E2E 斷言 + 反應分布 sanity + 決定性回歸。
- **Next**：確認 WP-0~8 全 exit ✅ 後執行 **T0**（[T0-entry-gate.md](T0-entry-gate.md)）。
