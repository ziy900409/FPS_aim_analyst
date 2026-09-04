# WP-56 T2 — Deterministic Three-target Population Lifecycle

## Objective

讓TargetManager以單一seeded sim path維持三個active targets，命中只替換exact ID，並保持spawn budget、restart、DrillRunner end condition與既有單靶drills相容。

## Steps

1. 先以table/property tests鎖定legacy單靶trace與新population invariants，再修改TargetManager。
2. 將spawn gate泛化為legacy single path或population `fillUntilActiveCount`；RNG只在accepted/fixed-attempt candidate sequence消費。
3. 實作vertical angular projection、distance sampling與pair separation；使用固定attempt budget及T0凍結fallback/error策略。
4. 保證new target的ID、pos/posPrev、side、sphere hitbox、visible/alive與`t_visible`初始化語意正確。
5. 驗證`markKilled` exact/stale/unknown ID、survivor stability、next-tick replacement、同tick輸入邊界與spawn budget尾段。
6. 對DrillRunner的seen/killed、timeout/presentation loops與end condition做三active tests；只有證據顯示不成立時才做最小修改。
7. 加restart same-seed hash、different-seed anti-vacuous、10k bounds/separation與30/60/144/240 render FPS逐tick parity。

## Required tests

- first running tick恰有3個unique visible/alive IDs；每個一筆visible event。
- hit middle ID後兩個survivors的ID/position逐位不變；replacement於下一tick出現且ID新穎。
- miss、unknown ID、double kill same ID不spawn、不增hit/quota。
- remaining spawn budget為2/1/0時active count正確下降，最後end condition成立且無額外spawn。
- impossible/tight separation不hang；attempt count不超T0上限，fallback sequence可重現。
- legacy seeded fixtures、spider-shot、tracking與counter-strafe traces不變。

## Definition of Done

- [ ] FR-56.6～10 unit/property/integration tests全綠。
- [ ] NFR-56.1～3與四render-FPS trace parity達標。
- [ ] TargetManager tick熱路徑無unbounded loop／`Math.random()`／render-clock依賴。
- [ ] DrillRunner target-count、restart與timeout語意對3 active有客觀evidence。
- [ ] legacy full test suite無spawn/movement/metric回歸，perf初測寫入progress。

## Commit

```text
feat(stage12): support deterministic three-target population
```

