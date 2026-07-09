# T2 — 目標 sub-tick 命中內插(FR-B17;靜止目標零破壞)

> Part of [WP-18 f5-subtick](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1(移動目標 pos 每 tick 演進——內插的兩端點來源) |
| **Risk / Cplx** | **High** / High(FR-B17 核心;動命中判定幾何——靜止目標零破壞是全部風險所在) |
| **Touches** | MODIFY `src/state/types.ts`(`TargetState.posPrev` 快照欄)、`src/sim/HitDetector.ts`(注入 sub-tick 位置求交)、`src/loop/SimLoop.ts`(posPrev←pos 快照 + fire 時間戳 → subAlpha 傳入命中判定);ADD 單元測試 |
| **狀態** | ⬜ |

## Objective

修正「最近 tick 位置」已知偏差(FR-B17):fire 時間戳 `t` 落於 tick 窗 `[tickStart, tickEnd)` 內時,命中判定用**目標在時刻 t 的內插位置**——`lerp(posPrev, posCurr, subAlpha)`——取代直接讀 tick 末 `target.pos`。**靜止目標逐位等價現行判定**(零破壞)。

## In scope
- **posPrev 快照**(落點依 T0 OQ-18.3):`simStep` 在目標 motion drive(T1)**之前**把每目標的 `pos` 存入 `posPrev`(= tick 起始位置);drive 後的 `pos` 即 `posCurr`(tick 末位置)。GC 紀律:`posPrev` 為目標上重用欄位,就地寫、不配置。
- **subAlpha 計算**:fire 產彈點([SimLoop.ts](../../../../src/loop/SimLoop.ts) `fireOneShot`/`scheduleFire`)已持 fire 時間戳(`state.weapon.nextFireT`)與本 tick 窗 `[tickStart=tickEnd−tickMs, tickEnd)`;`subAlpha = (t − tickStart) / tickMs`,clamp/定義域 `[0,1)`(半開窗 GD-3 對齊)。
- **HitDetector 注入**:`raycastWithRay` 增一條「以內插位置建 hitbox」路徑——命中判定的 `boxMin/boxMax` 中心取 `lerp(posPrev, posCurr, subAlpha)` 而非 `t.pos`。**簽章向後相容**:未提供 subAlpha/posPrev 時退回讀 `t.pos`(既有 WP-5/WP-13 呼叫路徑不變)。GC 紀律:內插位置用模組層級重用暫存,零配置。
- **零破壞不變式(DoD 首項)**:
  - 靜止目標 `posPrev == posCurr` → 內插位置 == `pos` → **逐位等價現行 `raycastWithRay`**;counter-strafe/detection 命中 + 彈著序列 baseline 零修改全綠(先跑再改)。
  - 命中點回填(`HitPointOut`,彈孔來源)在內插位置上仍正確。
- **決定性**:subAlpha 為 `(t, tickStart, tickMs)` 純函式(全 tick 域量);內插不引入隨機/時鐘。
- 新單元測試:
  - 靜止目標:內插路徑 vs 現行路徑逐位等價(零破壞)。
  - 移動目標:fire 在 tick 中點 → 命中位置 ≈ 兩 tick 中點(誤差 < ε);對照「最近 tick 位置」的偏差量化記 progress(證明 FR-B17 修的是什麼)。
  - 邊界:subAlpha=0(tick 起始開火)= posPrev;subAlpha→1 = posCurr。
  - 高速移動目標:近 hitbox 邊緣的 fire,內插命中 vs 最近 tick 誤判(命中↔脫靶翻轉)案例。

## Out of scope
- 玩家/camera 的 sub-tick(FR-B17 專指**目標**位置;camera 走 render 內插既有機制)、timed presentation(T3)、render 內插(T3)、追蹤指標(T4;GD-7 明列 sub-tick 不參與追蹤指標)。

## Steps

- [ ] **既有命中/決定性回歸全綠**(改動前基準記 progress)。
- [ ] `TargetState.posPrev` 欄 + `simStep` 快照(drive 前 posPrev←pos)。
- [ ] `raycastWithRay` 內插位置路徑(向後相容簽章)+ subAlpha 計算與傳入。
- [ ] 靜止目標逐位等價測試(零破壞不變式)。
- [ ] 移動目標 sub-tick 命中位置測試 + 「最近 tick」偏差量化 + 邊界/翻轉案例。
- [ ] `npx vitest run` 全綠。

## Definition of Done

- 靜止目標:內插路徑逐位等價現行判定,既有命中/決定性/彈著 baseline 零修改全綠;移動目標:fire 時間戳對齊的命中位置正確(中點/邊界/翻轉案例有測試),偏差量化記 progress;subAlpha 純函式、無隨機/時鐘/配置。

## Commit

`feat(wp-18): T2 目標 sub-tick 命中內插(FR-B17;fire 時間戳對齊;靜止目標零破壞)`
