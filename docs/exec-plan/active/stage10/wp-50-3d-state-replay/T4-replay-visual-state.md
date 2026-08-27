# WP-50 T4 — Target／ADS-Recoil／Shot and Projectile Visual State

## Objective

把T1 recorded capabilities映射成可任意seek的target lifecycle與weapon/fire visuals；缺失資料依profile降級，不重用live累積式Impact/Tracer state。

## Steps

1. 建ReplayTargetView，以sampled target IDs、visible/alive、position與recorded hitbox/shape驅動mesh pool；same-ID segment內才插值。
2. 將ADS與recoil sampled state映射camera/FOV/scope overlay；seek不依賴前一render frame transition accumulator。
3. 建ReplayEffectView，以recorded fire/hit/shot visual在固定media-time windows呈現tracer/impact/cue；所有effect query可由`t`重建。
4. 依T0決策支援或降級projectile visual；絕不以current weapon physics重新跑live bullet simulation。
5. 對每個full profile用golden keyframes/state hash驗證start/before-event/at-event/after-event/end與direct seek parity。
6. 量測最大target/effect fixture的adapter/frame P95、mesh pool上限與allocation。

## Failure cases

- legacy target無ID、不同target相鄰、hitbox缺失、scene mismatch。
- fire有事件但無visual、hit延遲、duplicate shots、projectile track缺失。
- seek backward清除所有未在當下window內的effects，無殘影。

## Definition of Done

- [ ] full profile所有required visuals有recorded evidence與golden keyframes。
- [ ] direct seek vs sequential state hash等價；backward seek無target/effect殘留。
- [ ] partial reason與UI capability model一致，沒有猜測資料。
- [ ] NFR-50.2/4達標，GPU objects/DOM不逐frame無界增長。

## Commit

```text
feat(replay): render recorded replay state
```
