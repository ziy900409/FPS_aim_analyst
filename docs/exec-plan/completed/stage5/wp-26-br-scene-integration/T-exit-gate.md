# T-exit — Exit gate(M13:stage5 交付)

> Part of [WP-26 br-scene-integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1–T4 |
| **Risk / Cplx** | — / Low |
| **Touches** | docs(progress/checklist/本資料夾 README + [上層 README](../README.md) 狀態 + [exec-plan/README.md](../../../README.md) §2/§3 + [docs/MAP.md](../../../../MAP.md)) |
| **狀態** | 🟡 自動閘 ✅(2026-07-14)/ **M13 保留待研究者實機手動回填**(清單 E §2;使用者拍板,沿 stage-C M10 先例) |

## Objective

宣告 **M13 = stage5 交付**:大逃殺跟槍測試(BR 場景 × 遠距小目標 × ADS ×
彈道條件)端到端成立且 pilot-ready。

## Steps

- [x] `npm run test:ci` exit 0(tsc/vitest/playwright 證據記 progress)。**branch-guarded 於 `aa` HEAD 6fec1e6:77 files/622 tests + 18 e2e 全綠**。
- [x] 驗收清單 E 全項狀態記 progress(自動項證據連結;手動項實機回填結果)。**自動項 E-1~E-10 全綠;§2 手動項 = 待研究者實機(M13 阻塞)**。
- [x] 交付證據記 progress(Outcomes):
  - **場景**:br-field 上線(淨空/perf/attribution/跨場景決定性,T1/T2)。
  - **整合 drill**:tracking_br_v1 全變體 + protocol(T3)。
  - **全鏈路**:E2E 匯出欄位全齊 + 離線推導可算跟槍效率(T4)。
  - **三不變性**:場景/ADS/彈道 gate 決定性全綠(T4)。
- [x] OQ ledger 收斂:OQ-S5-3/OQ-26.1~26.3 回填;帶著走的項(lead 晉升、
  scoped inaccuracy、toggle 語意)移交 backlog 註記。
- [x] 索引翻牌(**標「自動閘 ✅ / M13 待手動」,不翻「✅ 交付」**):本資料夾 README;
  [上層 README](../README.md) §3 WP-26 + 狀態列;[exec-plan/README.md](../../../README.md)
  §2 stage5 狀態(順帶對帳 WP-24 stale ⬜→✅)+ §3 M13;[docs/MAP.md](../../../../MAP.md) 對帳。
- [ ] 規格書對帳確認(階段 E 節 + 清單 E,§9 對帳清單項)。**沿 stage-C 先例保留 ⬜,owner 待指派;M13 正式宣告時補**。
- [x] progress.md 寫 Outcomes(交付了什麼 / Surprises / 帶著走的決定)。

## Definition of Done

- `test:ci` exit 0 ✅;清單 E **自動項全綠**(§2 手動回填為 M13 阻塞,待研究者實機);
  四項交付證據可追 ✅;OQ 收斂/移交 ✅;兩層索引 + MAP 一致(標自動閘/待手動)✅;
  **M13/stage5 宣告保留待手動回填**(使用者拍板 2026-07-14)。

## 手動回填後正式宣告(研究者)

清單 E §2 五步實機回填完成後:翻本資料夾 README / stage5 README / exec-plan README §2/§3
+ MAP.md 為「✅ 交付」;補規格書 §9(階段 E 節 + 附錄 E-E 清單 E);progress.md 記手動證據。

## Commit

`docs(wp-26): exit gate — M13 stage5 交付(BR 遠距跟槍測試 pilot-ready,清單 E 全綠)`
