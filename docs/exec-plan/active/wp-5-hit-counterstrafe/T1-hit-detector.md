# T1 — HitDetector（Raycaster + 部位 + 擊殺）

> Part of [WP-5 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T0 |
| **Risk / Complexity** | Med / Med |
| **Touches** | NEW `src/sim/HitDetector.ts`；MODIFY `src/loop/SimLoop.ts`（fire 事件 → raycast） |
| **Status** | ⬜ TODO |

## Objective
消費 fire 事件時，用 Raycaster 從 **camera 中心**射線判命中與部位（head/body）；命中即觸發 WP-4 `markKilled`（FR-5.1，OQ-5.4）。

## In scope
- `raycastFromCenter(camera, targets)`：NDC 中心 (0,0) 射線 → 對 active 目標 hitbox 求交 → `{hit, part, targetId}`。
- sim 在處理 fire 事件時呼叫；命中 → `TargetManager.markKilled`。

## Out of scope
- 首發判定（→ T2）；精準 gate（→ T4）；統計（→ WP-8）。

## Design notes
- 射線從 camera 中心（準心固定螢幕中心，WP-4 T4）；用 `Raycaster.setFromCamera({x:0,y:0}, camera)`。
- head/body 以兩個 hitbox 子物件區分，回傳命中部位（供 §5 部位記錄）。
- 命中即擊殺 → markKilled → WP-4 生成對側（新 peek）。

## Steps
- [ ] 建 `HitDetector.ts`：`raycastFromCenter`。
- [ ] sim fire 事件處理：raycast → 命中 → markKilled。
- [ ] Vitest：camera 正對目標 → hit + 正確部位；偏移未對準 → miss；命中觸發 markKilled。
- [ ] 手動驗：對準目標開火 → 擊殺 → 對側生成。
- [ ] `vitest run` + `tsc` 綠燈。

## Definition of Done
- [ ] camera 中心射線正確判命中/未命中 + 部位；命中即擊殺並生成對側。

## Commit
`feat(wp-5): HitDetector Raycaster 命中 + 部位 + 擊殺（FR-5.1）`
