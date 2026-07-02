# T4 — Drill 生命週期（開始/倒數/結束/重來）

> Part of [WP-6 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T2 |
| **Risk / Complexity** | Med / Med |
| **Touches** | NEW `src/drill/DrillRunner.ts`；MODIFY `src/loop/SimLoop.ts`（tick 推進） |
| **Status** | ✅ DONE（2026-07-02） |

## Objective
`DrillRunner` 管理 drill 生命週期：`idle → countdown → running → ended`，以及 `restart()` 全 reset（FR-6.4）。

## In scope
- `DrillRunner.start/tick/restart`，`phase` 狀態機。
- countdown（timing.countdownMs）；running 期間驅動 TargetManager；endCondition 達成 → ended。
- restart：呼叫 WP-2 `resetState` + `TargetManager.reset` + 首發/記錄游標重置 → idle。

## Out of scope
- 結果頁顯示（→ WP-8）；資料匯出（→ WP-7）。

## Design notes
- phase 轉換在 sim tick 內（`tick(state, nowMs)`），時間用 sim clock。
- **restart 必須清乾淨**：殘留狀態會污染下一輪資料（風險登記）。

## Steps
- [x] 建 `DrillRunner.ts` 狀態機。
- [x] sim tick 呼叫 `DrillRunner.tick`（`simStep`/`createSimLoop` 選填 `drillRunner`；整合測試驗證）。
- [x] Vitest：idle→countdown→running→ended phase 轉換時序正確；endCondition（目標數/時限）觸發 ended；restart 後 state/target/首發全空。
- [ ] 手動驗：開始倒數 → 遊玩 → 達標結束 → 重來乾淨。→ **延後 WP-8**（drill 載入 + 開始/重來 UI 接線屬 WP-8；本 task 未接 main.ts，整合以 SimLoop 單元測試驗證）。
- [x] `vitest run`（135 passed，+9）+ `tsc --noEmit` 綠燈。

## Definition of Done
- [x] 生命週期完整；endCondition 正確；restart 後無殘留狀態（測試斷言）。

## Commit
`feat(wp-6): DrillRunner 生命週期（開始/倒數/結束/重來）（FR-6.4）`
