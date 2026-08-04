# T1 — EV_ADS 輸入事件鏈(ring 擴碼 + heldAds + stuck 防護;零破壞)

> Part of [WP-24 ads-optics](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(GD-16 + hold/toggle 決議) |
| **Risk / Cplx** | Med / Med(動輸入 ring 編碼——佈局不變是風險控制核心) |
| **Touches** | MODIFY `src/state/types.ts`(`EV_ADS=3` + InputEvent union)、`src/state/SharedState.ts`(`pushAds` + `heldAds`)、`src/input/InputSampler.ts`(右鍵 + contextmenu 抑制 + stuck-ads 防護)、`src/input/consume.ts` + `src/loop/SimLoop.ts`(消費 → heldAds)+ 測試 |
| **狀態** | ✅ |

## Objective

右鍵 ADS 意圖進輸入鏈(FR-E4):`EV_ADS` 事件(packed `b`=down)→ ring 分桶
排序消費 → `SharedState.heldAds`;PointerLock 解鎖補 ads-up(stuck 防護);
**既有輸入鏈逐位不變**。

## In scope

- `types.ts`:`EV_ADS = 3`;`InputEvent` union 增 `{ type:'ads'; down: boolean; t: number }`;
  `InputEventView` 語意註解更新。**packed 佈局(`type,t,a,b`)不變**,`b`=down 比照 fire。
- `SharedState`:`pushAds(down, t)`(bounded insertion 保序,滿拒收比照既有)+
  `heldAds: boolean` 旗標。
- `InputSampler`:PointerLock 中右鍵 down/up → `pushAds`;`contextmenu` 抑制;
  解鎖(pointerlockchange)補送 ads-up——與 stuck-fire 防護**同一掛點**。
- consume/SimLoop:ads 事件依 `timeStamp` 分桶排序消費 → 更新 `heldAds`
  (tick 內事件序語意與 key/fire 一致);drill reset 時 `heldAds` 歸 false。
- **零破壞閘(DoD 首項)**:既有 ring/consume/InputSampler 測試**零修改**全綠;
  決定性回歸零重錄。
- 新測試:ads 事件 push/解碼 golden、分桶落 tick 正確性、stuck 防護
  (解鎖中按住 → 補 up)、快速點放(同 tick down+up)。

## Out of scope

- 相機/FOV/gain(T2)、記錄欄位(T3)、toggle 模式(config 候補,不實作)。

## Steps

- [x] `types.ts`/`SharedState` 擴碼 + push/解碼 golden 測試。
- [x] **既有輸入鏈測試零修改全綠**(改動前基準 → 改動後重跑,證據記 progress)——ring/consume/SharedState/SimLoop/fire-determinism 五檔零修改;僅 InputSampler「非左鍵不入緩衝」一 case 因右鍵改採計 ADS 而窄化為中鍵(deviation 記 progress)。
- [x] `InputSampler` 右鍵 + contextmenu 抑制 + stuck-ads 防護(`releaseAds` 接縫)。
- [x] consume → heldAds + 分桶/同 tick 序測試 + reset 歸位。
- [x] 手動驗證矩陣(按住/點放/解鎖中放開)以決定性單元測試編碼(T1 未接 live app,見 progress)。
- [x] `npx vitest run` 全綠(67 files / 541 tests)。

## Definition of Done

- 既有輸入鏈測試零修改全綠 + 決定性 baseline 零重錄;ads golden/分桶/stuck 測試綠;
  手動矩陣證據記 progress;ring 佈局 grep 證據(`type,t,a,b` 未動)。

## Commit

`feat(wp-24): T1 EV_ADS 輸入事件鏈(heldAds + stuck 防護;ring 佈局零破壞)`
