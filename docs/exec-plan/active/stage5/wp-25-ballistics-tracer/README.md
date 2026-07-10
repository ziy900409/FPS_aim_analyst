# WP-25 — ballistics-tracer:子彈軌跡顯示 + config-gated projectile 彈道模型

> stage5 執行計畫的 WP 子資料夾。上層 spec:[../README.md](../README.md) · 決議依據:GD-6(場景零知識——子彈不測場景)/ GD-5(seeded RNG)/ 待拍板 **GD-17**(彈道參數域,T0)。
> Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **目標** | 兩件可分離的交付:**(a)tracer 軌跡顯示**(render-only,UI 可開關,sim 零改動)與**(b)projectile 彈道模型**(Bullet Type 開關:飛行時間 + 重力下墜,config-gated,hitscan 預設逐位不變)+ 指標語意(t_hit/timeOfFlight/lead spec) |
| **里程碑** | **M12**(彈道模型門控:未過 `bullet` 欄不得進任何 drill config) |
| **相依** | **T1(tracer)獨立可先行**(M8 ✅ 即可);**T2–T4 需 M11**(遠距 drill 是 projectile 構念前提) |
| **對應 FR** | FR-E7 ~ FR-E10 |
| **估時** | 4–6.5 dev-days(T1 1–1.5 + T2–T4 3–5) |
| **狀態** | ⬜ 未開始 |

---

## 1. 範圍

**In scope**:

```
src/state/SharedState.ts            ← MODIFY ShotRayRing + pushShotRay(比照 ImpactRing)          [T1]
src/render/TracerView.ts            ← ADD render 唯讀 tracer(InstancedMesh,壽命漸隱)            [T1]
src/ui/(tracer 開關)              ← MODIFY Controls 增 Enabled/Disabled(顯示層,不記錄)       [T1]
src/ballistics/                     ← ADD 純數學模組:stepBullet + sweptHitTest + golden          [T2]
src/weapon/WeaponConfig.ts          ← MODIFY bullet?: { model,speedU,gravityU,maxRangeU } + 驗證  [T3]
src/loop/SimLoop.ts                 ← MODIFY 產彈點分支(gated)+ 子彈 arena 逐 tick 演進         [T3]
src/data/DataRecorder.ts + export   ← MODIFY hit 事件(t_hit/timeOfFlightMs)+ meta.weapon.bullet [T3]
src/metrics/ + docs/operational/    ← ADD lead 誤差離線推導 spec + 指標語意對帳                   [T4]
tests/regression/                   ← ADD projectile 決定性 fixture;hitscan 零重錄斷言           [T3/T4]
docs/operational/schema.md          ← MODIFY 對帳                                                 [T3]
```

**Out of scope**:zeroing/風偏/穿透/傷害衰減(觸發 = 明確研究委託)、子彈對場景幾何碰撞(**GD-6 紅線,永久排除**)、tracer 記錄(純視覺)、lead 誤差晉升正式指標(OQ-S5-5,spec-only)。

## 2. 關鍵契約

- **雙軌分離**:tracer(T1)是純顯示——sim 在產彈點已算出射線與命中/落點,只多寫一筆
  `shotRays` 環形格;projectile(T2–T4)才動命中語意。**T1 不依賴 T2–T4**,可先交付。
- **hitscan 預設逐位不變(M12 門控核心)**:`WeaponConfig.bullet` 未給 → 走現行
  `ballisticRaycast` 路徑,程式碼路徑零改動;stage1–3 全部 golden/決定性 baseline
  **零重錄**為 T3 DoD 首項(比照 WP-21 T1「無 seed 逐位不變」模式)。
- **先鎖數學再接線(仿 WP-10 → WP-13)**:T2 交付零相依純模組(`src/ballistics/`,
  比照 `src/recoil/`)+ golden;T3 才進 SimLoop。整合問題自此可歸因到接線而非公式。
- **子彈 = sim 實體,演進 = 固定步長純函式**:`stepBullet` 固定 1/128s(非 1/128 拋錯,
  比照 `recoilTick`);禁時鐘、禁 `Math.random`(方向已由產彈點的 seeded spread 決定,
  彈道本身無隨機);**只測目標 hitbox,永不測場景**(GD-6)。
- **simStep 順序**:子彈演進排在「① 目標 motion 更新到本 tick 位置」**之後**、
  記錄之前——swept segment(上一 tick 位置 → 本 tick 位置)對本 tick 目標 AABB 測試;
  命中 → 沿用既有命中處理鏈(markKilled/pushImpact/事件)。
- **事件語意(FR-E10)**:既有 `type:'fire'` row(= shot 產出)**語意不變**,
  `firstShot` 仍錨 peek 首發 shot;新增 `type:'hit'` 事件(`t_hit`、`timeOfFlightMs`、
  關聯 shot 序號)為 v2 additive。首發命中率 = 首發 shot 的 outcome(hit 事件回填),
  時序指標(急停反應/停火對齊)錨 `t_fire` 不變。
- **飛行時間設計參數 = tick 數**(GD-17,T0 拍板):`speedU` 與 drill distance 聯動,
  目標 8–32 tick;config 驗證對 < 2 tick 到達的組合發警告(退化 hitscan)。

## 3. Failure modes

| 觸發 | 影響 | 處理 |
|---|---|---|
| projectile 改動波及 hitscan 路徑 | stage1–3 baseline 全紅 | gate 在 config 解析層分支;零重錄為 T3 DoD 首項 |
| 子彈 arena 熱路徑配置 | GC 卡頓汙染量測 | preallocated `BULLET_CAP`(= magSize × 併發上限)+ 欄位重用;滿載拒發 + 旗標 |
| swept 測試漏接高速穿越(tunneling) | 高速彈穿過薄 hitbox 不判中 | swept segment vs AABB(非點採樣)為 T2 核心;golden 含高速貼邊 fixture |
| 移動目標 × 飛行中彈:命中語意歧義 | 決定性測試無法斷言 | 語意釘死:swept 對「本 tick 目標 AABB」測試(不對彈上一 tick 的目標位置);記 T2 spec + golden |
| t_hit 錨點與首發指標混淆 | 既有八指標語意漂移 | T4 語意 spec 前置;`firstShot`/`t_fire` 錨定不變斷言;CONTEXT 對帳 |
| 飛行時間 < 2 tick | projectile 構念空轉 | GD-17 tick 數反推 + config 驗證警告 |
| tracer 每發配置線段物件 | 高射速下 GC 卡頓 | `shotRays` preallocated 環形格 + TracerView 增量同步(比照 ImpactView seq 高水位) |

## 4. Task 索引

| Task | 檔案 | Objective | 相依 | Risk |
|---|---|---|---|---|
| **T0** | [T0-entry-gate.md](T0-entry-gate.md) | GD-17 參數域拍板 + 產彈點/命中鏈基線 | —(T1 可與 T0 併卷) | Low |
| **T1** | [T1-tracer-view.md](T1-tracer-view.md) | shotRays ring + TracerView + UI 開關(render-only) | T0 | Med |
| **T2** | [T2-projectile-math-core.md](T2-projectile-math-core.md) | `src/ballistics/` 純數學核心 + golden | T0 + **M11** | Med |
| **T3** | [T3-sim-integration.md](T3-sim-integration.md) | config gate + SimLoop 子彈 arena + 事件解耦(零破壞) | T2 | **High** |
| **T4** | [T4-metrics-semantics.md](T4-metrics-semantics.md) | 指標語意 + lead spec + 決定性回歸 | T3 | Med |
| **T-exit** | [T-exit-gate.md](T-exit-gate.md) | M12 宣告(彈道模型門控解鎖) | T1–T4 | — |
