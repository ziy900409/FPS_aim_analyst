# WP-18 — f5-subtick:F5 移動目標 drill + 目標 sub-tick 命中內插 + 追蹤指標

> stage2 執行計畫的 WP 子資料夾(門控後續,不在 M8 主估時內)。上層 spec:[../README.md](../README.md) · 決議依據:[DECISIONS.md](../../../DECISIONS.md) **GD-7**(追蹤指標定義 / 獲取-追隨分離 / raw-over-derived 資料策略)/ **GD-6**(純裝飾場景 + 淨空驗證,追蹤窗口無遮擋特例)/ **GD-5**(seeded RNG 紀律)。
> Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **目標** | F5 移動目標 drill 成形:`TargetMotion` 由「已寫入未驅動」變成 sim 每 tick 驅動目標位置 + **目標 sub-tick 命中內插(FR-B17)**——命中位置對齊 fire 時間戳、取代「最近 tick 位置」偏差;追蹤指標(`t_acquire`/TOT%/RMS ε)離線推導 spec + 合成 fixture。 |
| **里程碑** | —(WP-22 T1 前置:追蹤 × 場景實驗消費本 WP 追蹤 drill 型與內插語意) |
| **相依** | WP-17(M8)✅ + GD-7 拍板 ✅(entry 兩條件皆達成 2026-07-07,門控解除);T4 的追蹤指標推導輸入 = schema v2 逐 tick `tx/ty/tz`+`px/pz`(WP-16 已交付,`TickRecord` 既有欄) |
| **對應 FR** | FR-B17(sub-tick 命中內插)+ 規格 §1.3 階段 B(4)(移動目標)+ GD-7(追蹤指標) |
| **估時** | +2–3.5 dev-days(門控解除後另計,不在 stage2 主估時內) |
| **狀態** | 🟡 **task 檔已展開,待實作**(2026-07-09):T0–T5 + T-exit 規劃就緒;尚未動 `src/`。下游 = stage3 [WP-22 T1](../../stage3/wp-22-perception-integration/README.md) |

---

## 0. 展開緣起與門控史(episodic,保留供參照)

> **門控解除(2026-07-07,M8 ✅);兩個 entry 條件皆達成。** 本節保留原委供未來稽核。

「移動 + counter-strafe」同屏會造成**能力混淆**:移動追蹤能力與急停執行品質在資料中無法分離。決議點 = **OQ-S2-5**([../README.md §8](../README.md);規格附錄 F / GD-1 遺留)——**已於 GD-7 拍板**:純追蹤 drill 與急停 drill 分離(drill 層),追蹤 drill 內部再以窗口定義切開**獲取(acquisition)vs 追隨(pursuit)**(指標層)。故本 WP 的追蹤 drill 是**純追蹤**(移動目標 + 玩家靜止瞄準),不與 counter-strafe 複合。

**「門控解除」≠「立即展開」**:WP-18 不在 stage2 主估時內(+2–3.5 dev-days 另計),唯一下游消費者為 stage3 [WP-22 T1](../../stage3/wp-22-perception-integration/README.md)。本次展開(2026-07-09)即為服務 WP-22:WP-22 T0 因 WP-18 未交付而 blocked,依「Deliver WP-18 first」決策先展開並交付本 WP。

---

## 1. 範圍

**In scope**:

```
src/sim/TargetManager.ts        ← MODIFY 每 tick 依 motion + age 驅動 target.pos(linear/pingpong/sine)  [T1]
src/state/types.ts              ← MODIFY TargetState 加 tick 位置快照(posPrev,sub-tick 內插基準)       [T2]
src/sim/HitDetector.ts          ← MODIFY 注入 sub-tick alpha → hitbox 以內插位置求交(FR-B17)              [T2]
src/loop/SimLoop.ts             ← MODIFY fire 產彈點傳 fire 時間戳/tick 窗 → sub-tick alpha;target curr←pos [T1/T2]
src/drill/DrillRunner.ts        ← MODIFY timed presentation 政策(依時長呈現 → 推進,取代 kill-to-advance) [T3]
src/render/(TargetView 內插)   ← MODIFY 目標 render alpha 內插(prev→curr,移動視覺平滑;render-only)     [T3]
src/drill/tracking_v1.ts        ← ADD 純追蹤 drill config(移動目標 + timed presentation)                 [T4]
docs/operational/analysis-tracking.md ← ADD t_acquire/TOT%/RMS ε 離線推導 spec(演算法 + 邊界案例)         [T4]
src/metrics/trackingDerivation*  ← ADD 合成 fixture 推導測試(round-trip:錄 → 匯 → 推導,完美/失敗兩極端)  [T4]
src/loop/__tests__ + tests/regression/ ← MODIFY 移動目標跨 render FPS 決定性回歸(per-tick 狀態逐位一致)   [T5]
src/main.ts                     ← MODIFY tracking_v1 進 drill registry(可選取)                            [T5]
```

**Out of scope**:
- 複合 drill(移動 + counter-strafe)—GD-7 明列「進階複合技能」,不入 WP-18。
- **追蹤指標進 sim 熱路徑**—GD-7:全部離線推導,引擎零新計算;本 WP 只交付 spec + 驗證器(對齊 WP-21 T3 的偵測推導模式)。
- 追蹤指標的結果頁 UI 呈現(結果頁欄位語意在 T4 spec 定,呈現實作屬 WP-22 消費面 / 後續 UI WP)。
- 場景整合(`sceneId: 'field-low'`)、速度/雜亂度實驗矩陣—WP-22 T1(本 WP 只交付 drill 型與內插,場景在 WP-22 掛)。
- 正式分析 pipeline(Python/R,repo 外;spec 即介面)。
- `waypoints` motion 的完整語意深驗(schema 已淺驗形狀;點數下限/速度配套隨真實需求另立;T1 只驅動 linear/pingpong/sine)。

## 2. 關鍵契約

- **T1 motion drive**:`TargetManager.tick` 每 tick 依 `target.motion` + `target.age`(累加 `tickSec`)更新 `target.pos`——**tick-index 決定性**(pos 為 tick 數的純函式,與 render FPS 無關;不代入變動 dt、不讀時鐘)。`static`/省略 motion 逐位不變(既有 drill 零破壞)。運動包絡(pingpong/sine 的 range、linear 的行程)須與 `field-low` 走廊 + 淨空驗證(GD-6)相容——WP-22 T1 實戰,本 WP 以單元包絡界定。
- **T2 sub-tick 命中內插(FR-B17)**:fire 時間戳 `t` 落於 tick 窗 `[tickStart, tickEnd)` 內 → 目標命中位置取 `lerp(posPrev, posCurr, subAlpha)`,`subAlpha = (t − tickStart) / tickMs ∈ [0,1)`,取代直接讀 `target.pos`。`posPrev` = 本 tick motion drive **之前**的位置快照,`posCurr` = drive 之後(= tick 末位置)。**靜止目標 subAlpha 無效果**(posPrev == posCurr,逐位等價現行判定 → counter-strafe/detection baseline 零破壞)。sub-tick 為 GD-7 明列「僅命中內插用,不參與追蹤指標」。
- **T3 timed presentation**:追蹤 drill 的推進政策 = **依時長呈現**(presentation duration → 到期推進下一目標),取代 counter-strafe 的 kill-to-advance 與 detection 的 `peekTimeoutMs`。目標在 presentation 窗內**持續存活移動**(不因命中撤除;追隨是連續控制構念)。窗結束定義 GD-7「追蹤窗口 = [t_first_on_target, presentation 結束)」的右界。config 欄位落點在 T3 定(`timing.presentationMs` 或等價),schema additive optional。
- **T3 目標 render 內插**:移動目標視覺平滑—render 端以 `alpha`(SimLoop 既有回傳)在目標 `prev→curr` 間 lerp,比照玩家/recoil 既有 `RenderSnapshot` prev/curr 機制。**render-only**:不改 sim 狀態、不進匯出、不改決定性 baseline(GD-6/GD-10 層界)。
- **T4 追蹤指標離線推導(GD-7)**:`analysis-tracking.md` spec + `src/metrics` 驗證器,輸入 = schema v2 逐 tick(aim + `tx/ty/tz` + `px/pz` + `t_visible`)。定義照 [CONTEXT.md §A](../../../../CONTEXT.md) / GD-7:on-target(準心射線 ∩ H1 hitbox,零新門檻)、ε(t)(準心射線 vs 目標中心夾角 deg)、`t_acquire = t_first_on_target − t_visible`(未 on-target → 獲取失敗,不進 TOT 聚合)、追蹤窗口 `[t_first_on_target, presentation 結束)`、TOT%(窗內 on-target tick 比例)、**主統計量 RMS(ε)**(窗內)。**引擎零新計算,spec 即介面**(round-trip fixture 證明真匯出格式可推導)。
- **T5 決定性回歸擴充**:移動目標 drill 在異 render FPS 下,per-tick sim 狀態(目標 `pos`、命中序列)逐位一致(不斷言 wall-clock)。既有 baseline(stage1/2 punch/彈著/spawn 序列)零破壞維持。

## 3. Failure modes

| 觸發 | 影響 | 處理 |
|---|---|---|
| motion drive 誤用變動 dt / 讀時鐘 | 移動目標決定性破功(異 FPS 位置漂移) | T1 DoD:pos 為 `age`(tick 累加)的純函式;T5 跨 FPS 回歸鎖定;grep 閘確認 `src/sim` 無 `Date.now`/`performance.now` |
| sub-tick 內插改動波及靜止目標命中 | counter-strafe/detection 命中 baseline 全紅 | T2 不變式:posPrev==posCurr 時逐位等價現行 `raycastWithRay`;**先跑既有命中/決定性回歸全綠**再進內插 |
| 移動目標運動包絡撞 `field-low` prop / 走廊外 | 淨空驗證誤擋或目標穿牆 | 運動包絡極值納入 WP-19 淨空驗證的目標包絡(`deriveTargetEnvelopes`);WP-22 T1 首跑實戰對帳,本 WP 單元界定 range |
| timed presentation 與命中撤除語意衝突(追蹤目標被 markKilled 提前消失) | 追隨窗被截斷、TOT 分母錯 | T3:追蹤 drill presentation 窗內目標**不因命中撤除**(命中只記事件,不 advance);推進純由時長驅動 |
| 推導 spec 與實際匯出欄位漂移 | 分析端算不出 t_acquire/RMS ε | T4 合成 fixture round-trip(錄 → 匯 → 推導)消費真匯出格式;誤差斷言 |
| 追蹤指標語意混入 sim 熱路徑 | 違反 GD-7「零 sim 改動」、增 GC/延遲 | 指標一律離線(`src/metrics` 測試層級,非 sim);on-target 幾何**複用** HitDetector,不新增門檻參數 |

## 4. Task 索引

| Task | 檔案 | Objective | 相依 | Risk |
|---|---|---|---|---|
| **T0** | [T0-entry-gate.md](T0-entry-gate.md) | 上游 exit(M8/GD-7)驗證 + F5 seam 現況基線凍結 + OQ 收斂(motion 階層 / presentation 落點 / OQ-S3-5 預對帳) | — | Low |
| **T1** | [T1-motion-drive.md](T1-motion-drive.md) | `TargetManager` 每 tick 驅動 `target.pos`(linear/pingpong/sine;tick 決定性;static 零破壞) | T0 | **High** |
| **T2** | [T2-subtick-hit-interpolation.md](T2-subtick-hit-interpolation.md) | sub-tick 命中內插(FR-B17):target posPrev 快照 + fire 時間戳 alpha → 內插位置求交 | T1 | **High** |
| **T3** | [T3-timed-presentation-render-interp.md](T3-timed-presentation-render-interp.md) | timed presentation 推進政策 + 目標 render alpha 內插(render-only) | T1 | Med |
| **T4** | [T4-tracking-drill-metrics-spec.md](T4-tracking-drill-metrics-spec.md) | `tracking_v1` config + 追蹤指標離線推導 spec + round-trip fixture(t_acquire/TOT%/RMS ε) | T2, T3 | Med |
| **T5** | [T5-determinism-regression-integration.md](T5-determinism-regression-integration.md) | 移動目標跨 FPS 決定性回歸 + drill registry 掛線整合 | T1–T4 | Med |
| **T-exit** | [T-exit-gate.md](T-exit-gate.md) | 交付宣告(WP-22 T1 可消費追蹤 drill 型 + 內插 + 指標介面)+ OQ-S3-5 對帳 | T1–T5 | — |
