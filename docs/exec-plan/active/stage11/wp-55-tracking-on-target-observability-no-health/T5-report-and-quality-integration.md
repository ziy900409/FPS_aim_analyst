# WP-55 T5 — Report and Quality Integration

## Objective

把 contact artifact 整合到報告與 quality gates，呈現 acquisition、pursuit、TOT、RMS/median/P95 epsilon、contact timeline、blocked reasons 與 BR split columns；protocol-incompatible runs 不得進 aggregate。

## Dependencies

- T3 and T4 completed。

## Steps

1. report 顯示 acquisition、pursuit、TOT、RMS/median/P95 epsilon 與 contact timeline。
2. 每個數值帶 n、duration、condition、drill id、analysisVersion 與 source run。
3. blocked reasons 以 closed vocabulary 顯示；不顯示 0 或空圖表取代 blocked。
4. BR/projectile tracking report 顯示 ballistic hit 與 aim-ray on-target 的差異，不混入 pure tracking 主結論。
5. 補 report/export artifact 與 `deriveTrackingMetrics()` summary parity tests。
6. legacy、incompatible、protocol-mismatch runs 不進 aggregate，且 exclusion count 可追溯。
7. 更新 operational doc，說明「跟隨目標」主判定是 exact-hitbox on-target/TOT/RMS epsilon，不需要血條。

## Report acceptance

- P0 summary 必須可追到同一 artifact rows，不得由 report 重新定義 contact。
- BR companion metrics 可並列，但 pure tracking aggregate 不讀 ballistic hit、damage、kill count。
- Blocked/incompatible results 顯示 reason 與 source identity，不輸出 fake zeros。
- 每個 aggregate 顯示 n 與 exclusion count；protocol-incompatible runs 排除可追溯。

## Definition of Done

- [x] report 顯示 acquisition、pursuit、TOT、RMS/median/P95 epsilon、contact timeline。
- [x] 每個數值帶 n、duration、condition、drill id、analysisVersion 與 source run。
- [x] blocked reasons 以 closed vocabulary 顯示，不顯示 0 或空圖表取代 blocked。
- [x] BR/projectile tracking report 顯示 ballistic hit 與 aim-ray on-target 差異，未混入 pure tracking 主結論。
- [x] report/export artifact 與 `deriveTrackingMetrics()` summary parity tests 全綠。
- [x] legacy/incompatible/protocol-mismatch runs 不進 aggregate，且 exclusion count 可追溯。
- [x] operational doc 已說明 exact-hitbox on-target/TOT/RMS epsilon 是跟隨目標主判定，不需要血條。

## Commit

```text
feat(tracking): report contact observability evidence
```
