# T1 — 目標 entity（mesh + hitbox）

> Part of [WP-4 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T0 |
| **Risk / Complexity** | Low / Med |
| **Touches** | NEW `src/render/TargetView.ts`；MODIFY `src/state/SharedState.ts`（TargetState） |
| **Status** | ✅ DONE（2026-07-02；T1a 型別 + T1b mesh/TargetView）|

## Objective
定義 `TargetState`（**單一 hitbox，H1**；`part` 選填保留）並建 `TargetView` 依狀態顯示/隱藏 mesh（FR-4.1）。

## In scope
- `SharedState.TargetState`：id/side/pos/visible/alive/**hitbox（單一，`part` 選填）/motion?+age（F5 接縫）**。
- `TargetView`：為每個 target 建/回收 mesh（膠囊或方塊），依 `visible` 顯示/隱藏（唯讀 state）。
- hitbox 幾何參數隨 TargetState 暴露（WP-5 Raycaster 用同來源）。

## Out of scope
- 可見性邏輯 / t_visible（→ T2）；交替（→ T3）；命中（→ WP-5）。

## Design notes
- mesh 重用池（避免每次 spawn new mesh，GC 紀律）。
- hitbox 與 mesh 由同 TargetState 衍生，確保視覺與判定一致。

## Steps
- [x] `SharedState` 加 `TargetState`（T1a：重塑至 README §2 契約，見 progress）。
- [x] 建 `TargetView`：mesh 池 + 依 state 顯示/隱藏（T1b）。
- [x] 驗：`TargetView.test.ts` 以 state 驅動 visible/隱藏/位置/尺寸 + 重用池斷言（5 tests）；tsc/vitest/build 全綠。
- [x] `tsc` 乾淨。

## Definition of Done
- [x] 可由 state 驅動目標 mesh 顯示/隱藏；hitbox 參數與 mesh 一致（單位 box + scale 同來源）。

## Commit
`feat(wp-4): 目標 entity（mesh + 單一 hitbox，H1）+ TargetView（FR-4.1）`
