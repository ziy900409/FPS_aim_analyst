# T-exit — Exit gate(M13:stage5 交付)

> Part of [WP-26 br-scene-integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1–T4 |
| **Risk / Cplx** | — / Low |
| **Touches** | docs(progress/checklist/本資料夾 README + [上層 README](../README.md) 狀態 + [exec-plan/README.md](../../../README.md) §2/§3 + [docs/MAP.md](../../../../MAP.md)) |
| **狀態** | ⬜ |

## Objective

宣告 **M13 = stage5 交付**:大逃殺跟槍測試(BR 場景 × 遠距小目標 × ADS ×
彈道條件)端到端成立且 pilot-ready。

## Steps

- [ ] `npm run test:ci` exit 0(tsc/vitest/playwright 證據記 progress)。
- [ ] 驗收清單 E 全項狀態記 progress(自動項證據連結;手動項實機回填結果)。
- [ ] 交付證據記 progress(Outcomes):
  - **場景**:br-field 上線(淨空/perf/attribution/跨場景決定性,T1/T2)。
  - **整合 drill**:tracking_br_v1 全變體 + protocol(T3)。
  - **全鏈路**:E2E 匯出欄位全齊 + 離線推導可算跟槍效率(T4)。
  - **三不變性**:場景/ADS/彈道 gate 決定性全綠(T4)。
- [ ] OQ ledger 收斂:OQ-S5-3/OQ-26.1~26.3 回填;帶著走的項(lead 晉升、
  scoped inaccuracy、toggle 語意)移交 backlog 註記。
- [ ] 索引翻牌:本資料夾 README → ✅;[上層 README](../README.md) §3 WP-26 + 狀態列
  → ✅ 交付;[exec-plan/README.md](../../../README.md) §2 stage5 狀態 + §3 M13;
  [docs/MAP.md](../../../../MAP.md) 對帳。
- [ ] 規格書對帳確認(階段 E 節 + 清單 E,§9 對帳清單項)。
- [ ] progress.md 寫 Outcomes(交付了什麼 / Surprises / 帶著走的決定)。

## Definition of Done

- `test:ci` exit 0;清單 E 全項通過(含手動回填);四項交付證據可追;
  OQ 收斂或移交;兩層索引 + MAP 一致;**stage5 宣告交付**。

## Commit

`docs(wp-26): exit gate — M13 stage5 交付(BR 遠距跟槍測試 pilot-ready,清單 E 全綠)`
