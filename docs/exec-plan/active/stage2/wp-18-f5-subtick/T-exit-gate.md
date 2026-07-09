# T-exit — Exit gate(F5 移動目標鏈交付)

> Part of [WP-18 f5-subtick](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1–T5 |
| **Risk / Cplx** | — / Low |
| **Touches** | docs(progress/checklist/本資料夾 README 狀態 + 上層 [stage2 README](../README.md) 索引 line 222/267/294)|
| **狀態** | ⬜ |

## Objective

宣告 WP-18 收斂:移動目標可跑、sub-tick 命中內插(FR-B17)修正偏差、timed presentation + 追蹤指標介面就緒、移動目標決定性進回歸——WP-22 T1 的追蹤 × 場景實驗自此有完整 drill 型 + 內插語意 + 分析介面可消費。

## Steps

- [ ] `npm run test:ci` exit 0(記 `tsc --noEmit` + vitest 檔數/測項數 + playwright 測項數)。
- [ ] 交付證據記 progress(Outcomes):
  - **移動目標**:linear/pingpong/sine 每 tick 驅動 + 決定性(T1)。
  - **FR-B17**:sub-tick 命中內插修正「最近 tick」偏差、靜止目標零破壞(T2;偏差量化證據)。
  - **timed presentation + render 內插**:依時長推進、命中不截斷追隨窗、目標視覺平滑 render-only(T3)。
  - **追蹤指標介面**:`tracking_v1` + `analysis-tracking.md` spec + round-trip fixture 誤差 ≤ 1 tick + 兩極端 sanity(T4)。
  - **決定性回歸**:移動目標跨 FPS per-tick 逐位一致收編 + 既有 baseline 零破壞(T5)。
- [ ] **OQ-S3-5 對帳**:回 [WP-22 T0](../../stage3/wp-22-perception-integration/T0-entry-gate.md) 逐項核對交付形狀(drill 型 / motion 欄 / presentation 時長 / target render alpha / t_acquire/TOT%/RMS ε 匯出+結果頁欄位),互記雙方 progress;解除 WP-22 T1 的 blocked。
- [ ] OQ ledger 收斂:OQ-18.1/18.2/18.3 回填 progress;OQ-S3-5 標由本 WP 交付解除。
- [ ] WP-19 對帳複查:移動目標運動包絡已納入淨空驗證(T1 對帳結論複查),雙方 progress 互記。
- [ ] 索引翻牌:本資料夾 [README.md](README.md) 狀態 → ✅;[stage2 README](../README.md) WP-18 列(line 222/267)+ §狀態表 → ✅ 交付;視需要把資料夾移入 `completed/stage2/`。
- [ ] progress.md 寫 Outcomes(交付了什麼 / Surprises / 帶著走的決定)。

## Definition of Done

- `test:ci` exit 0;五項交付證據可追;OQ-S3-5 對帳完成且 **WP-22 T1 可直接消費**(追蹤 drill 型 + sub-tick 內插 + presentation + 指標推導 spec 全就緒);索引狀態一致。

## Commit

`docs(wp-18): exit gate — F5 移動目標鏈交付(motion/FR-B17 內插/timed presentation/追蹤指標)`
