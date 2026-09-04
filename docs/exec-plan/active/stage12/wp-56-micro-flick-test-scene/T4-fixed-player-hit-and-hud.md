# WP-56 T4 — Fixed Translation／Hit Integration／Crosshair and HUD

## Objective

把translation lock、三靶raycast／event與既有Crosshair/HUD整合到live sim，保證玩家位置固定但mouse aim與射擊仍有效，且不新增weapon view model或不誠實的replay/history入口。

## Steps

1. 依T0 seam把`playerControl.translation`一次性綁到SimLoop options或movement dependency；default仍enabled。
2. locked時保持input consumption與mouse yaw/pitch，跳過／中和translation integration並保持position/velocity invariant。
3. 擴充HitDetector/SimLoop integration tests：三個sphere、nearest hit、exact ID、重疊邊界、miss、stale ID與scene geometry blocking。
4. 驗證visible/fire/hit事件：targetId、timestamp、hit flag、replacement tick與recorder counts一致。
5. Browser層驗證Crosshair中心與canvas中心、Pointer Lock後mouse aim、W/A/S/D零camera-base位移、HUD score/time/hit-rate更新。
6. 驗證scene graph／DOM沒有weapon/hands/muzzle節點或影片editor/FPS/ammo UI。
7. 驗證micro-flick為practice-only；Result/History不產生持久化或full replay假入口。

## Failure cases

- key held before drill start／restart、A+D同時、rapid press/release與tab focus change。
- hit與replacement落在同一render frame但不同sim ticks，HUD/target count不得短暫重抽survivors。
- camera未update matrix、兩targets同射線、target已撤除、scene load fallback。
- 離開micro-flick後載入legacy movement drill，translation必須恢復enabled。

## Definition of Done

- [ ] FR-56.3/4/8/9/11/12/14 integration與E2E assertions全綠。
- [ ] locked場景至少10秒合成W/A/S/D輸入後player/camera base position逐位為起點，mouse yaw/pitch確有變化。
- [ ] exact target-id hit/miss/event/replacement時序在128 Hz測試有客觀trace。
- [ ] Crosshair在1080p/720p各軸中心誤差≤1 CSS px。
- [ ] 離開場景後legacy movement、replay、history與HUD regressions全綠。

## Commit

```text
feat(stage12): integrate fixed-position micro-flick gameplay
```

