# T3 — A/D 橫移 movement（固定步長）

> Part of [WP-5 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T0 |
| **Risk / Complexity** | Med / Med |
| **Touches** | NEW `src/sim/MovementController.ts`；MODIFY `src/loop/SimLoop.ts`、`src/state/SharedState.ts` |
| **Status** | ⬜ TODO |

## Objective
`MovementController.step` 依 A/D held 狀態在 sim 固定步長推進 velocity 與位移（FR-5.3）。公開介面須讓階段 B 替換為 friction integrator 時不變（附錄 D）。

## In scope
- `MovementController.step(state, dt)`：held A → vx=-`v_strafe`、held D → vx=+`v_strafe`、皆無 → vx=0（瞬間 snap、無 accel；本 task 尚無急停 flag，T4 補）；`x += vx*dt`。
- `SharedState.player` 補 `vx`/`x`（若 WP-2 佔位已有則沿用）。

## Out of scope
- 急停 flag / gate（→ T4）；真摩擦（階段 B）。

## Design notes
- **固定 dt**（sim tick），不用 frame delta（決定性）。
- 瞬間 snap 到 `v_strafe`（OQ-5.2，預設 ~250 u/s），無加速曲線（階段 A）。
- `step` 為唯一公開點；內部數值階段 B 可換（附錄 D），介面不動。

## Steps
- [ ] 建 `MovementController.ts`（`step` + `createMovementController`）。
- [ ] sim：consume 後呼叫 `movement.step(state, dt)`。
- [ ] Vitest：held D 一段時間 → x 線性增加且與 FPS 無關（同總時間不同分幀 → 同位移）；放開 → vx=0。
- [ ] 手動驗：A/D 可左右移動。
- [ ] `vitest run` + `tsc` 綠燈。

## Definition of Done
- [ ] A/D 橫移正確、固定步長、與 FPS 無關（決定性回歸綠）。
- [ ] `MovementController` 公開介面僅 `step`（階段 B 友善）。

## Commit
`feat(wp-5): MovementController A/D 橫移（固定步長）（FR-5.3）`
