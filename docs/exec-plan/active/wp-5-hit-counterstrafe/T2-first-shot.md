# T2 — 首發判定（每 peek 第一發）

> Part of [WP-5 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1 |
| **Risk / Complexity** | Med / Low |
| **Touches** | NEW `src/sim/firstShot.ts`；MODIFY `src/loop/SimLoop.ts` |
| **Status** | ⬜ TODO |

## Objective
每個 peek（一個目標可見週期）只把**第一發** fire 標為 `firstShot`，作為「首發命中率」的分子來源，不被後續掃射稀釋（FR-5.2，OQ-5.3）。

## In scope
- `firstShotGate(state, peekId)`：每 peek 第一次回 true，其後 false。
- peek 邊界：新目標可見（WP-4 蓋 `t_visible`）時 reset 首發旗標。

## Out of scope
- 命中率數值計算（→ WP-8）；residual/精準（→ T4）。

## Design notes
- peekId 取自當前 active 目標 id（每次新目標 = 新 peek）。
- 首發旗標存 `SharedState`（per-peek），新 peek reset。

## Steps
- [ ] 建 `firstShot.ts`：以 peekId 判第一發。
- [ ] sim fire 處理：附 `firstShot = firstShotGate(state, currentPeekId)`。
- [ ] Vitest：同 peek 連開三槍 → 只有第一槍 firstShot=true；換 peek 後第一槍又 true。
- [ ] `vitest run` + `tsc` 綠燈。

## Definition of Done
- [ ] 每 peek 僅第一發 firstShot=true；換 peek 正確 reset；掃射不稀釋。

## Commit
`feat(wp-5): 首發判定（每 peek 第一發）（FR-5.2）`
