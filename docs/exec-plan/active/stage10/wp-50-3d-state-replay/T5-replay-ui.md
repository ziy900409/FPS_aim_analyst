# WP-50 T5 — Replay Screen／Transport／Timeline／HUD

## Objective

交付可操作、可理解且keyboard-accessible的Replay UI，涵蓋loading/full/partial/unsupported/error與窄螢幕layout，不把clock或scene ownership放進DOM components。

## Steps

1. 建ReplayScreen shell、top bar/source identity/support badge、16:9 viewport host與focus trap/restore。
2. 建transport：previous event、play/pause、next event、time/duration、seek slider、0.25/0.5/1/2 rate與ended replay。
3. 建event marker/list（cue/visible/counter/fire/hit）與當下keys/ADS/speed/timestamp HUD；同一sample更新且避免每幀全DOM重建。
4. 建partial persistent warning／reason details、unsupported result-only、scene/API error retry/return與loading cancel。
5. 實作keyboard/ARIA/visibility pause、focus/shortcut cleanup與responsive layout。
6. 以fake player/controller做component tests，再以實際scene做browser visual/manual acceptance。

## UI acceptance

- 所有controls具accessible name/disabled state/focus order；slider有current/duration text。
- partial不只靠顏色辨識；unsupported沒有無效play button。
- Space不攔截slider/button/input原生操作；離開後shortcut不再作用。
- 1024×768與常用desktop viewport無control遮住scene，event list可捲動。

## Definition of Done

- [ ] FR-50.7～9/12/15 component與E2E scenarios全綠。
- [ ] keyboard-only、screen-reader labels、focus restore與partial warning通過。
- [ ] HUD/timeline不讀live state；DOM update/frame與long-task達NFR。
- [ ] loading/error/abort永遠可返回來源，無黑屏或unhandled rejection。

## Commit

```text
feat(replay): add replay transport and HUD
```
