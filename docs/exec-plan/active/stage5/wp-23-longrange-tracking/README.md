# WP-23 — longrange-tracking:hitbox config 化 + 遠距小目標追蹤 drill

> stage5 執行計畫的 WP 子資料夾。上層 spec:[../README.md](../README.md) · 決議依據:**GD-7**(追蹤指標/同幾何零新門檻)/ GD-15(編號分配)· 上游交付:[WP-18 T-exit](../../../completed/stage2/wp-18-f5-subtick/T-exit-gate.md) ✅(motion/sub-tick 內插/追蹤指標)。
> Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **目標** | 「遠距離小目標持續移動」的效度地基:目標 hitbox 由寫死常數變成 `DrillConfig` 資料(**單一來源、預設逐位不變**)+ 遠距追蹤 drill `tracking_longrange_v1`(角參數設計)+ 小角尺寸下指標 round-trip 與決定性 |
| **里程碑** | **M11**(未過不進 WP-25 T2+) |
| **相依** | WP-18 ✅(2026-07-09)+ M10 ✅(2026-07-10);T1 之後 T2→T3 串行 |
| **對應 FR** | FR-E1 ~ FR-E3 |
| **估時** | 1.5–2.5 dev-days |
| **狀態** | 🟡 T2 PASS(2026-07-10);T3 ready |

---

## 1. 範圍

**In scope**:

```
src/drill/DrillConfig.ts + schema.ts     ← MODIFY targets.hitbox? 選填 + 驗證(正有限/上限 sanity)     [T1]
src/sim/TargetManager.ts                 ← MODIFY HITBOX 常數(:57)→ config 化(省略 = 1×2×1 不變)     [T1]
src/sim/HitDetector.ts / render/TargetView.ts ← MODIFY 命中幾何/渲染尺寸吃同一 hitbox 來源              [T1]
src/scene/clearance.ts                   ← MODIFY TARGET_HITBOX_U(:8)/膨脹半徑 → per-drill hitbox      [T1]
src/metrics/trackingDerivation.ts        ← MODIFY options.hitbox 由 meta 餵(DEFAULT_OPTIONS 為 fallback)[T1]
src/data/metadata.ts + export.ts         ← MODIFY meta.targets.hitbox 快照(v2 additive)                [T1]
src/drill/tracking_longrange_v1.ts       ← ADD 遠距小目標追蹤 drill config(角參數反推)                 [T2]
src/metrics/ + tests/regression/         ← ADD 小角尺寸 round-trip fixture + 遠距決定性 fixture          [T3]
docs/operational/schema.md               ← MODIFY hitbox 欄對帳                                          [T1]
```

**Out of scope**:頭/身 hitbox 分解(H1 語意不變)、ADS(WP-24)、彈道模型(WP-25)、BR 場景(WP-26;T2 先用 `field-low`)、lead 誤差 spec(WP-25 T4)。

## 2. 關鍵契約

- **同幾何不變式(GD-7)**:命中判定(sim)與 on-target(離線推導)用**同一** hitbox AABB——config 化後此性質必須由測試釘死(邊緣開火 fixture:打在 hitbox 邊緣內/外 → 命中 ⇔ on-target 同真同假)。hitbox 快照進 meta,推導端讀 meta 而非常數。
- **零破壞不變式**:省略 `targets.hitbox` 的既有 drill(counterstrafe/tracking/detection 全部)**逐位不變**——既有決定性回歸零修改全綠為 T1 DoD 首項(比照 WP-21 T1「無 seed 逐位不變」模式)。
- **角參數設計(§0 洞見)**:遠距 drill 的設計參數 = 目標角高(2·atan(h/2d))與角速度,非絕對距離;OQ-S5-4 定稿矩陣(預設角高 0.5°–2° × 角速度 5–20°/s),距離/hitbox/motion 速度由此反推。1u ≈ 1.905cm,現行距離 ~4u → 遠距檔位預期 d 數十~百餘 u,render 以 display scale 呈現。
- **淨空驗證涵蓋**:遠距走廊(更長的視線線段 + 運動包絡)必過 `validateClearance`;`field-low` 開闊場景為 T2 執行場景。
- **sub-tick 內插沿用**:WP-18 FR-B17 已交付,`ballisticRaycast(camera, state, subAlpha?)` 對移動目標的命中內插在遠距小角尺寸下尤其關鍵(相對角誤差放大)——T3 round-trip fixture 需覆蓋。

## 3. Failure modes

| 觸發 | 影響 | 處理 |
|---|---|---|
| 三處 hitbox 消費點(sim/clearance/推導)不同步 | 命中與 on-target 幾何分裂 → 指標失效 | 單一來源 export + 同幾何邊緣 fixture(T1 DoD) |
| config 化波及既有 drill | stage1–3 決定性 baseline 全紅 | 省略欄位 = 現行常數,路徑逐位不變(T1 DoD 首項) |
| 遠距目標角尺寸過小(像素混疊) | 視覺可辨識度混入追蹤量測 | OQ-S5-4 角尺寸下限(暫定 0.5°);drill 註記解析度條件交互 |
| 推導端仍讀 DEFAULT_OPTIONS 常數 | 舊匯出可推導、新 hitbox 匯出推導錯 | 推導 options 優先讀 meta.targets.hitbox,缺欄 fallback 常數(向後相容);round-trip 測試消費真匯出格式 |

## 4. Task 索引

| Task | 檔案 | Objective | 相依 | Risk |
|---|---|---|---|---|
| **T0** | [T0-entry-gate.md](T0-entry-gate.md) | 上游驗證(WP-18/M10)+ OQ-S5-4 拍板 + hitbox 現況基線 | — | Low |
| **T1** | [T1-hitbox-config.md](T1-hitbox-config.md) | hitbox config 化(單一來源;零破壞) | T0 | **High** |
| **T2** | [T2-longrange-drill.md](T2-longrange-drill.md) | `tracking_longrange_v1` config + 淨空 + display scale | T1 | Med |
| **T3** | [T3-metrics-roundtrip.md](T3-metrics-roundtrip.md) | 小角尺寸 round-trip + 遠距決定性 + 結果頁 sanity | T2 | Med |
| **T-exit** | [T-exit-gate.md](T-exit-gate.md) | M11 宣告(WP-25 T2+ 可開) | T1–T3 | — |
