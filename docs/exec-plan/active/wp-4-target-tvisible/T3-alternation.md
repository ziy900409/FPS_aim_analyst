# T3 — 左右交替序列

> Part of [WP-4 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T2 |
| **Risk / Complexity** | Med / Med |
| **Touches** | MODIFY `src/sim/TargetManager.ts` |
| **Status** | ⬜ TODO |

## Objective
實作左右交替序列：擊殺/消失一側 → 生成對側（依序交替），確定性輪替，與 WP-2 決定性相容（FR-4.3）。

## In scope
- `markKilled(state, id)`：標記擊殺 → 移除 → 排程生成對側（L↔R）。
- 確定性輪替（從起始 side 交替；或帶種子）。
- `reset(state, seq)`：重設序列（WP-6/WP-8 重開 drill 用）。

## Out of scope
- 命中觸發 markKilled（→ WP-5；本 task 用測試/佔位觸發）；drill config（→ WP-6）。

## Design notes
- 一次只一個 active 目標（counter-strafe peek 節奏）；擊殺後生成對側並蓋新 `t_visible`。
- 輪替不可用無種子 `Math.random`（破壞決定性）。

## Steps
- [ ] `markKilled` + 對側生成邏輯。
- [ ] 確定性輪替（L→R→L…）。
- [ ] Vitest：連續 markKilled → side 嚴格交替；每次生成蓋新 `t_visible`；重跑相同序列結果一致（決定性）。
- [ ] 手動驗：佔位擊殺鍵 → 目標左右輪替出現。
- [ ] `vitest run` + `tsc` 綠燈。

## Definition of Done
- [ ] 擊殺一側 → 生成對側，嚴格交替、確定性；每次生成有新 `t_visible`。

## Commit
`feat(wp-4): 左右交替目標序列（確定性輪替）（FR-4.3）`
