# WP-50 T2 — Normalizer／Sampling／Playback Core

## Objective

建立不依賴DOM/Three/live sim的immutable ReplayRecording、binary sampling、playback clock、speed與event navigation，讓任意`t`的輸出可重現且可效能量測。

## Steps

1. 實作normalizer：finite/monotonic/range/profile/capability validation、time origin normalization與typed indexes；不deep-clone整份payload。
2. 實作binary tick/event lookup；處理0/1 tick、duplicate event time、before/after bounds與duration clamp。
3. 實作position、shortest-arc yaw、pitch、離散input/ADS/ammo與same-target-segment interpolation。
4. 實作pure effect-window query與`previousEvent/nextEvent`stable ordering。
5. 實作injected-clock ReplayPlayer state machine：play/pause/seek/rate/ended/restart/visibility pause/dispose。
6. 用42k ticks/大量events fixture benchmark normalize、seek與frame allocation；加入property/table tests。

## Required tests

- yaw跨`+π/-π`不繞長路；target ID/lifecycle切換不跨物件lerp。
- direct seek與任意command序列到同`t`產生相同sample/state hash。
- rate切換保持time；tab pause/resume無大跳；ended再play從0開始。
- malformed/nonmonotonic/empty/overflow依T1 support contract降級或拒絕。

## Definition of Done

- [ ] replay domain boundary scan無DOM/Three/fs/sim/wall-clock/random import。
- [ ] FR-50.3/5/7/8/10 unit/property tests全綠。
- [ ] NFR-50.1/2達標並記硬體/browser/fixture/iteration/P95。
- [ ] hot frame不全array scan，allocation profile符合README。

## Commit

```text
feat(replay): add deterministic playback core
```
