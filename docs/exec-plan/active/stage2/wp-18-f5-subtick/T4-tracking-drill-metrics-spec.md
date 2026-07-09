# T4 — tracking drill config + 追蹤指標離線推導 spec + round-trip fixture

> Part of [WP-18 f5-subtick](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T2(sub-tick 內插——命中語意)+ T3(timed presentation——追蹤窗右界)+ schema v2 逐 tick `tx/ty/tz`+`px/pz`(WP-16 已交付) |
| **Risk / Cplx** | Med / Med |
| **Touches** | ADD `src/drill/tracking_v1.ts`(純追蹤 drill config)、`docs/operational/analysis-tracking.md`(推導 spec)、`src/metrics/trackingDerivation*`(dev 驗證器 + fixture);MODIFY `docs/operational/schema.md`(交叉引用) |
| **狀態** | ⬜ |

## Objective

把 GD-7 的追蹤指標定義變成**可執行介面**:①`tracking_v1` 純追蹤 drill config(移動目標 + timed presentation,可施測);②`analysis-tracking.md` 離線推導 spec(演算法 + 邊界案例);③合成 fixture 證明「從真實匯出格式推導 t_acquire/TOT%/RMS ε」——**引擎零新計算,spec 即介面**(對齊 WP-21 T3 偵測推導模式)。

## In scope
- **`tracking_v1` drill config**(TS const,比照 [detection_popin_v1.ts](../../../../src/drill/detection_popin_v1.ts)):純追蹤——單一移動目標(`motion` = T1 驅動的 type 之一)、`timing.presentationMs`(T3)、玩家靜止瞄準(不與 counter-strafe 複合,GD-7)。motion range/speed 用 T0 OQ-18.1 界定值(`field-low` 走廊相容);`sequence.seed` 記 metadata(重現)。
- **`analysis-tracking.md` spec**(輸入 = v2 匯出:逐 tick `aim{yaw,pitch}` + `tx/ty/tz` + `px/pz` + `t_visible` + presentation 窗界):
  - **on-target(逐 tick 二元)**:準心射線(camera 正向,自 aim 重建)∩ H1 hitbox(Box3,自 `tx/ty/tz` + hitbox 尺寸)——**與命中判定同幾何、零新門檻參數**(CONTEXT §A / GD-7)。
  - **ε(t)**:準心射線 vs 目標中心夾角(deg)——公式 + 符號慣例(對齊 `targetCenterOffsetDeg`)。
  - **t_acquire** = `t_first_on_target − t_visible`;整段 presentation 未 on-target → **獲取失敗**(計入獲取失敗率、該 presentation 不進 TOT 聚合;失敗是資料不是缺失值)。
  - **追蹤窗口** = `[t_first_on_target, presentation 結束)`;**TOT%** = 窗內 on-target tick 比例;**主統計量 RMS(ε)**(窗內);median/P95/streak 為離線副指標。
  - 邊界案例:未獲取(整窗 miss → 獲取失敗)、presentation 極短(窗 < k tick)、多 presentation 聚合。
- **dev 驗證器**(TS,`src/metrics/` 測試層級,非熱路徑)+ **合成 fixture**(round-trip:合成 aim 流 → recorder → export → 推導):
  - **完美追蹤**(準心恆貼目標中心)→ TOT% ≈ 100%、RMS ε ≈ 0、t_acquire ≈ 0。
  - **不動輸入**(準心固定、目標移開)→ 獲取失敗(t_acquire = 獲取失敗旗標)。
  - 誤差斷言:合成已知 on-target 起點 vs 推導 t_acquire ≤ 1 tick。
- **`schema.md` 交叉引用**:追蹤分析欄位 → spec 章節;結果頁 TOT%/RMS ε/t_acquire 欄位語意標注(呈現實作屬 WP-22/後續)。

## Out of scope
- 追蹤指標進 sim 熱路徑(GD-7:離線推導)、正式分析 pipeline(repo 外)、場景整合(WP-22 T1)、結果頁 UI 呈現實作、speed/雜亂度實驗矩陣(WP-22 T3 文件)。

## Steps

- [ ] `tracking_v1` config + schema 驗證通過 + 單元 sanity(可載入、motion/presentation 欄齊)。
- [ ] `analysis-tracking.md` spec(演算法 + 參數 + 邊界案例 + 敏感度建議)。
- [ ] dev 驗證器 + round-trip fixture(完美追蹤 / 不動輸入兩極端 + 已知 onset)測試全綠。
- [ ] 誤差斷言(合成 vs 推導 ≤ 1 tick)證據記 progress;兩極端指標數值 sanity 記 progress。
- [ ] `schema.md` 交叉引用;結果頁欄位語意標注。
- [ ] `npx vitest run` 全綠。

## Definition of Done

- `tracking_v1` 可載入且施測形狀完整;spec 完整(演算法可照抄實作,含 on-target/ε/t_acquire/TOT%/RMS ε + 邊界);round-trip fixture 證明真匯出格式可推導、誤差 ≤ 1 tick;完美追蹤/不動輸入兩極端指標數值符合預期(證據記 progress)。

## Commit

`feat(wp-18): T4 tracking drill config + 追蹤指標離線推導 spec + round-trip fixture(t_acquire/TOT%/RMS ε)`
