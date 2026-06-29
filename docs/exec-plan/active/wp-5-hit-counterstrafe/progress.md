# WP-5 — Progress Log ★M2

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: 🟡 規劃完成，待執行（達成即 M2）

| Phase | State |
|-------|-------|
| T0 Entry gate | ⬜ 待執行 |
| T1 HitDetector | ⬜ 待執行 |
| T2 首發判定 | ⬜ 待執行 |
| T3 橫移 movement | ⬜ 待執行 |
| T4 簡化急停 | ⬜ 待執行 |
| T5 Exit gate（M2） | ⬜ 待執行 |

---

## Open Questions ledger（T0 解決）

| ID | Status | Resolution |
|----|--------|-----------|
| OQ-5.1 停止 gate 精準判定 | ✅ grill | 布林：stopped→accurate；residualSpeed 二元 {0,±v}→結果頁分類；連續模型留階段 B |
| OQ-5.2 橫移速度 / 加速 | ✅ grill | 瞬間 snap 到 `v_strafe`(~250 u/s)、反向鍵穿越 tick 歸零（M1）；附錄 D 留階段 B |
| OQ-5.3 peek 邊界 | ✅ grill (P2) | t_visible 起點、**第一次命中=kill** 終點（未命中可補槍）；`peekTimeoutMs` 防卡；新目標可見 reset 首發 |
| OQ-5.4 命中即擊殺 | ✅ grill (P2) | **第一次命中**即 markKilled → 生成對側（spawnDelay 0）|

---

## Log

### （規劃）— WP-5 計畫產出
- 依 PLAN WP-5（5.1–5.4）+ 規格 §5 + F3 展開為 T0–T5。
- **M2 = 核心玩法成立**。階段 A 簡化急停（立即停止 + 布林精準 gate）；`MovementController` 介面預留階段 B friction integrator（附錄 D）。
- 首發旗標綁 peek 生命週期（t_visible→擊殺），避免掃射稀釋。
- **Next**：確認 WP-3/WP-4 後執行 **T0**（[T0-entry-gate.md](T0-entry-gate.md)）。
