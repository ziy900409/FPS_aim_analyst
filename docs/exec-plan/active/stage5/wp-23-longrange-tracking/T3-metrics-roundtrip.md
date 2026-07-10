# T3 — 小角尺寸指標 round-trip + 遠距決定性回歸

> Part of [WP-23 longrange-tracking](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T2(遠距 drill 存在) |
| **Risk / Cplx** | Med / Med |
| **Touches** | ADD `tests/regression/`(遠距決定性 fixture)、`src/metrics/` 測試(小角尺寸 round-trip);MODIFY 無 production 邏輯(僅測試/fixture);結果頁 sanity 為觀測 |
| **狀態** | ⬜ |

## Objective

「跟槍效率」指標鏈在遠距小角尺寸下成立(FR-E3):round-trip
(錄 → 匯 → `trackingDerivation` 推導)誤差 ≤ 1 tick;遠距 fixture 進決定性回歸;
結果頁呈現 sanity。

## In scope

- **round-trip fixture**(比照 WP-21 T3 模式,消費 production `ExportPayload`):
  合成 aim 流 × `tracking_longrange_v1`(known on-target 窗)→ `DataRecorder` →
  `buildExportPayload` → `serializeJSON` → 推導;斷言 `t_acquire`/TOT%/RMS(ε)
  誤差 ≤ 1 tick;hitbox 讀自 meta(T1 傳遞鏈的端到端證據)。
- **兩極端 sanity**(沿 WP-18 T4 模式):完美追蹤(恆 on-target)與完全不追
  (獲取失敗)兩支合成 fixture,指標落在預期端點。
- **sub-tick 內插覆蓋**:遠距移動目標開火 fixture——命中結果對 `subAlpha` 內插
  語意的斷言(WP-18 FR-B17 在小角尺寸下的回歸)。
- **決定性回歸**:遠距 drill 同輸入跨 render FPS sim 狀態逐位一致,收編
  `tests/regression/`(既有 baseline 零重錄)。
- 結果頁 sanity(觀測):`MetricsDashboard` 對遠距 drill 顯示追蹤指標無 NaN/爆值,
  手動證據記 progress。

## Out of scope

- 新指標定義(GD-7 既有指標族沿用,零新門檻);lead 誤差(WP-25 T4)。

## Steps

- [ ] round-trip fixture(known 窗 → 誤差 ≤ 1 tick)+ meta hitbox 傳遞斷言。
- [ ] 兩極端 sanity fixture。
- [ ] sub-tick 內插遠距回歸 fixture。
- [ ] 遠距決定性 fixture 收編 `tests/regression/`;既有 baseline 零重錄證據。
- [ ] 結果頁手動 sanity 記 progress。
- [ ] `npm run test:ci` exit 0。

## Definition of Done

- round-trip 誤差 ≤ 1 tick;兩極端 sanity 綠;sub-tick 遠距回歸綠;
  決定性(新 fixture 綠 + 既有零重錄)證據記 progress;`test:ci` exit 0。

## Commit

`test(wp-23): T3 遠距小角尺寸 round-trip + 決定性回歸(指標鏈效度證據)`
