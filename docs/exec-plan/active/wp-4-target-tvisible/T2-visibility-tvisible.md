# T2 — 可見性 + t_visible（sim tick 內蓋戳）

> Part of [WP-4 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1 |
| **Risk / Complexity** | Med / Med |
| **Touches** | NEW `src/sim/TargetManager.ts`；MODIFY `src/loop/SimLoop.ts`（simStep 呼叫 tick） |
| **Status** | ✅ DONE（2026-07-02）|

## Objective
`TargetManager.tick` 在 **sim tick 內**處理 spawn/可見性，並在目標 `visible` 由 false→true 的轉換 tick 蓋 `t_visible = nowMs`（sim clock）（FR-4.2）。這是反應時間量測的起點，效度關鍵。

## In scope
- `TargetManager.tick(state, nowMs)`：管理 spawn → 可見轉換 → `state.tVisible.set(id, nowMs)`（只一次）。
- `SimLoop.simStep` 內呼叫 `TargetManager.tick`，傳入 sim 的 `nowMs`（`performance.now()` 同源）。

## Out of scope
- 左右交替序列（→ T3，本 task 先單目標 spawn 即可）；命中（→ WP-5）。

## Design notes
- **只在可見轉換蓋一次**：用 `tVisible.has(id)` 防重複；可見→不可見→再可見視為新 id（或明確定義）。
- `nowMs` 必須來自 sim clock（不可用 rAF 時間 / `Date.now()`）。

## Steps
- [x] 建 `TargetManager`：spawn 一目標 → 可見瞬間蓋 `t_visible`（[src/sim/TargetManager.ts](../../../../src/sim/TargetManager.ts)）。
- [x] `SimLoop.simStep` 呼叫 `tick(state, nowMs)`（選填 `targetManager` 參數，命中判定之前）。
- [x] Vitest：斷言 `t_visible` 在可見轉換 tick 被設、值=該 tick sim 時間、且不重複設。
- [x] 斷言 `t_visible` 來源為注入 sim clock（值 ~1007，排除 `Date.now` 域）。
- [x] `vitest run`（38/38）+ `tsc` 綠燈；`vite build` ✓。

## Definition of Done
- [x] `t_visible` 在 sim tick 內、可見轉換時蓋一次，時間源為 sim clock。
- [x] 單元測試覆蓋「只蓋一次」與「時間源正確」（6 tests）。

## Commit
`feat(wp-4): 目標可見性 + t_visible 在 sim tick 內蓋戳（FR-4.2）`
