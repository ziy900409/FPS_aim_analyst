# WP-56 T1 — Additive Drill Contract／Schema／Fixtures

## Objective

依T0凍結結果建立optional、legacy-compatible的三靶population、vertical spawn與translation lock契約，並交付exact practice drill fixture；不在engine內以drillId分支。

## Steps

1. 新增`TargetPopulationConfig`、`SpawnAreaConfig.pitchDegRange/minAngularSeparationDeg`與`PlayerControlConfig` types；舊欄位簽名與default不變。
2. 擴充`validateDrill`：numeric ranges、activeCount≤count、seed需求、互斥組合、field-path typed errors。
3. 建`micro_flick_three_target_test_v1` exact config，使用sphere hitbox、T0凍結spawn field、population=3、translation locked與practice mode。
4. 將drill綁定`micro-flick-room` researcher registry；不加入Participant/Assessment/session protocol。
5. 建valid、boundary、invalid-combination、missing-seed、impossible-separation與legacy canonical fixtures。
6. 加negative gates：沒有history persistence side effect、沒有WP-50 full profile、unknown/prefix相近ID不繼承support。

## Invariants

- `targets.count`仍是整場spawn budget；`population.activeCount`才是同時active上限。
- 新欄位省略時舊drill parse output、spawn trace、movement與export metadata不變。
- config沒有render object、DOM、Three、wall-clock或非seeded randomness。
- sphere visual/hitbox尺寸只定義一次；場景asset不含targets。

## Definition of Done

- [ ] README §2.3 contracts有實際type/schema tests，錯誤訊息帶正確field path。
- [ ] 所有既有drill fixtures parse/canonical/determinism regressions全綠。
- [ ] exact micro-flick config可載入，scene binding唯一且practice-only。
- [ ] invalid combination與impossible field fail fast，不到TargetManager才throw。
- [ ] replay/history/Assessment negative tests成立，progress記最新blast radius與測試數。

## Commit

```text
feat(stage12): add micro-flick drill contracts
```

