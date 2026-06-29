# T1 — 目標 entity（mesh + hitbox）

> Part of [WP-4 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T0 |
| **Risk / Complexity** | Low / Med |
| **Touches** | NEW `src/render/TargetView.ts`；MODIFY `src/state/SharedState.ts`（TargetState） |
| **Status** | ⬜ TODO |

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
- [ ] `SharedState` 加 `TargetState`（若 WP-2 已留空殼則補欄位）。
- [ ] 建 `TargetView`：mesh 池 + 依 state 顯示/隱藏。
- [ ] 手動驗：以測試鉤子塞一個 visible target → 場景出現；設 false → 隱藏。
- [ ] `tsc` 乾淨。

## Definition of Done
- [ ] 可由 state 驅動目標 mesh 顯示/隱藏；hitbox 參數與 mesh 一致。

## Commit
`feat(wp-4): 目標 entity（mesh + 單一 hitbox，H1）+ TargetView（FR-4.1）`
