# T2 — Drill 載入器（由 config 驅動 TargetManager）

> Part of [WP-6 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1 |
| **Risk / Complexity** | Med / High |
| **Touches** | NEW `src/drill/DrillLoader.ts`；MODIFY `src/sim/TargetManager.ts`（參數化） |
| **Status** | ⬜ TODO |

## Objective
讓 `TargetManager` 由 `DrillConfig` 驅動 spawn/位置/交替/結束——**換 config 即換 drill，零引擎程式碼改動**（FR-6.2，F4 核心）。

## In scope
- `DrillLoader.load(json)`：驗證（T1）→ `DrillConfig`。
- `TargetManager` 改吃 config：位置（L/R 槽位 + distance）、交替（sequence + seed）、結束（endCondition）取代 WP-4 內建佔位序列。

## Out of scope
- 生命週期 phase（→ T4）；範例檔（→ T3）。

## Design notes
- **解耦驗收**：新增「第二個」不同參數 JSON（如不同目標數/RL 交替）即可換 drill，不動任何 `.ts`——這是 F4 是否成立的判準。
- 種子化交替維持決定性（WP-2/4 相容）。

## Steps
- [ ] 建 `DrillLoader.ts`。
- [ ] `TargetManager` 參數化（從 config 取位置/交替/結束）。
- [ ] Vitest：餵兩個不同 config（目標數/交替不同）→ 目標序列各自正確、引擎程式碼未改（同一 TargetManager）。
- [ ] **回歸**：WP-4 t_visible / 交替決定性測試在 config 驅動下仍綠。
- [ ] `vitest run` + `tsc` 綠燈。

## Definition of Done
- [ ] config 驅動 TargetManager；換 config 即換 drill（零引擎改動），以兩個 config 證明。
- [ ] 決定性 + t_visible 回歸綠。

## Commit
`feat(wp-6): DrillLoader 由 config 驅動 TargetManager（換 config 即換 drill）（FR-6.2）`
