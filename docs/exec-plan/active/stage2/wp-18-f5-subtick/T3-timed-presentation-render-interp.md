# T3 — timed presentation 推進政策 + 目標 render alpha 內插

> Part of [WP-18 f5-subtick](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1(移動目標 pos 演進;render 內插的兩端點)|
| **Risk / Cplx** | Med / Med |
| **Touches** | MODIFY `src/drill/schema.ts`(`timing.presentationMs?` additive optional)、`src/drill/DrillRunner.ts`(running 相位依時長推進、命中不撤除)、`src/drill/DrillConfig.ts`(欄註)、`src/render/`(TargetView 依 alpha 在 prev→curr lerp,render-only);ADD 測試 |
| **狀態** | ⬜ |

## Objective

追蹤 drill 的兩個「連續控制」前提就位:①**timed presentation** 推進政策——目標依時長呈現(而非 kill-to-advance / peekTimeout),presentation 窗結束才推進下一目標,窗內目標持續存活移動;②**目標 render alpha 內插**——移動目標視覺平滑(render-only,不動 sim/匯出/決定性)。

## In scope
- **timed presentation(OQ-18.2 落點)**:
  - schema:`timing.presentationMs?`(additive optional,正有限)——追蹤 drill 每目標呈現時長。驗證比照既有 timing 欄。
  - `DrillRunner` running 相位:目標可見後計時,`age`/sim 時鐘達 `presentationMs` → 推進下一目標(撤舊 spawn 新)。**命中不推進、不撤除**——追蹤是連續控制,命中只記 fire 事件(追隨窗不因命中截斷,守 GD-7「追蹤窗口 = [t_first_on_target, presentation 結束)」右界)。
  - 與既有政策共存:counter-strafe(kill-to-advance)、detection(`peekTimeoutMs`)路徑不變;presentation 政策僅在 config 提供 `presentationMs` 時啟用。
- **目標 render alpha 內插**:
  - 目標比照玩家/recoil 的 `prev/curr` + SimLoop `alpha`([SimLoop.ts](../../../../src/loop/SimLoop.ts):445 既有回傳)機制,render 端在 `target.posPrev → target.pos`(T2 已引入 posPrev)間 lerp 繪製。
  - **render-only 界界**:不改 sim 狀態、不進 `DataRecorder`、不改決定性 baseline(GD-6/GD-10 層界);命中判定仍用 sim 位置(T2 內插),與視覺分離但同源(視覺 = tick 內插、判定 = fire 時間戳內插,兩者皆自 posPrev/posCurr)。
- 新測試:
  - `presentationMs` schema 驗證(合法/非法)。
  - DrillRunner:presentation 到期推進(不靠命中);命中不提前推進/不撤除(追隨窗完整)。
  - render 內插為觀測純度測試(alpha=0→posPrev、alpha→1→posCurr;不寫 sim)——或以既有 render 測試模式覆蓋。

## Out of scope
- 追蹤指標推導(T4;presentation 窗右界是 T4 TOT 分母的輸入,但推導在 T4)、drill config 值(T4 `tracking_v1`)、sub-tick 命中內插(T2)。

## Steps

- [ ] `timing.presentationMs?` schema 擴欄 + 驗證測試。
- [ ] DrillRunner timed presentation 推進(命中不撤除)+ 既有政策零破壞測試。
- [ ] 目標 render alpha 內插(prev→curr)+ render-only 界界(不改 sim/匯出/決定性)證據。
- [ ] `npx vitest run` 全綠;既有 render/drill 測試零破壞。

## Definition of Done

- `presentationMs` 啟用時 drill 依時長推進、命中不截斷追隨窗;既有 counter-strafe/detection 推進政策逐位不變;目標 render 內插平滑且**不觸及** sim 狀態/匯出/決定性 baseline(層界證據記 progress)。

## Commit

`feat(wp-18): T3 timed presentation 推進政策 + 移動目標 render alpha 內插(render-only)`
