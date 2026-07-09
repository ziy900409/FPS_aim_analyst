# T1 — 移動目標 motion drive(每 tick 驅動 target.pos;static 零破壞)

> Part of [WP-18 f5-subtick](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(motion 階層 / 決定性紀律凍結) |
| **Risk / Cplx** | **High** / Med(動 sim 目標機制;移動目標決定性是全部風險所在) |
| **Touches** | MODIFY `src/sim/TargetManager.ts`(每 tick 依 motion+age 更新 pos)、`src/loop/SimLoop.ts`(僅必要:`age` 累加 tickSec 的位置對齊)、REUSE `src/state/types.ts`(`TargetMotion`/`age`,不改型別);ADD 單元測試 |
| **狀態** | ⬜ |

## Objective

把 F5 seam 接活(規格 §1.3 階段 B(4)):`target.motion` 從「寫入未驅動」變成 `TargetManager.tick` 每 tick 依 `age` 更新 `target.pos`——**pos 為 tick 數的純函式**(異 render FPS 逐位一致);無 motion / `static` 的既有 drill **逐位不變**。

## In scope
- **motion drive**:`TargetManager.tick`(或抽出的純函式 motion 模組)在目標系統步內、**命中判定之前**([SimLoop.ts](../../../../src/loop/SimLoop.ts):335 既定順序)依 `target.motion` + `target.age` 計算 `target.pos`:
  - `linear`:沿 `axis` 以 `speed`(u/s)等速位移(spawn 位置為原點;行程界定見 T0 OQ-18.1)。
  - `pingpong`:在 `range` 內以 `speed` 往返(三角波)。
  - `sine`:在 `range` 內以 `speed`/週期正弦擺盪。
  - `waypoints`:**本 task 不驅動**(schema 已淺驗形狀;需求成立時另立)。
- **age 累加**:`age`(自 spawn 起邏輯秒數)每 tick 加 `tickSec`(= `1/SIM_HZ`,**常數**,不代入變動 dt)——決定性根源。spawn 時 `age=0`;`reset`/`markKilled` 清除。
- **決定性紀律**:motion 計算是 `(motion, age)` 的純函式;不讀 `performance.now()`/`Date.now()`、不碰 DOM(守 `simStep` 純函式邊界 OQ-2.4 + GD-5)。GC 紀律:就地改 `target.pos.x/y/z`,不配置新 Vec3。
- **零破壞閘(DoD 首項)**:無 motion / `static` 目標的 `pos` **逐位不變**——先跑既有命中/決定性回歸(counter-strafe 彈著序列、detection spawn golden)全綠再進移動測試。
- 新單元測試:
  - `static`/無 motion → pos 恆等於 spawn 位置(零破壞不變式)。
  - `linear`/`pingpong`/`sine` → 給定 age 序列的 pos golden(逐位)。
  - **決定性**:同 tick 數不同「每 pump 的 frame 切法」→ 目標 per-tick pos 逐位一致(異 FPS 不變性的單元版;回歸套件收編在 T5)。
  - 運動包絡極值(pingpong/sine range 邊界)符合 T0 OQ-18.1 界定值。

## Out of scope
- sub-tick 命中內插(T2)、timed presentation(T3)、render 內插(T3)、tracking drill config(T4)、跨 FPS 回歸套件收編(T5)、`waypoints` 驅動。

## Steps

- [ ] **既有命中/決定性回歸全綠**(改動前基準 → 改動後重跑,證據記 progress)。
- [ ] `age` 累加(tickSec 常數)+ motion drive(linear/pingpong/sine)實作。
- [ ] static/無 motion 逐位不變測試 + 三 motion type pos golden 測試。
- [ ] 決定性單元測試(異 frame 切法同 per-tick pos)。
- [ ] `Math.random`/時鐘禁令 grep 閘涵蓋 `src/sim` motion 路徑(確認既有 lint 閘已含)。
- [ ] `npx vitest run` 全綠。

## Definition of Done

- 無 motion/static:既有測試**零修改**全綠(逐位不變證據);linear/pingpong/sine:pos golden 鎖定 + 異 frame 切法決定性;motion 計算純函式、無時鐘/隨機/配置;運動包絡符合 T0 界定。

## Commit

`feat(wp-18): T1 移動目標 motion drive(linear/pingpong/sine;age tick 決定性;static 零破壞)`
