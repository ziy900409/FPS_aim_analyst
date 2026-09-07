# WP-57 T3 — 寬場 Arena 場景與幾何斷言

## Objective

新增容納 FOV 上限落點的寬場 procedural arena，並把 README §2.5 的每一列變成測試——包含「預設房間裝不下」的負向證據。**目標穿牆／埋地板目前沒有自動閘（discovery item 11），本 task 補上這個閘。**

## Steps

1. 先確認 scene registry 的實際檔名與註冊方式（T0 已記錄），並讀 `src/scene/eyePose.ts`／`src/render/SceneManager.ts` 的 procedural room 建構路徑。
2. 新增 arena scene config：`roomSize: [18, 10, 4]`、`eyeHeight: 1.6`、`eyeZ` 用預設（`depth/2 − CAMERA_STANDOFF = 4`）、顏色／燈光沿用既有 procedural 慣例。**純 procedural，不引入任何外部資產**（故 GD-9 不適用）。
3. 在 registry 註冊 scene id 並與 T1 的 drill template 綁定（比照 WP-56 的 `sceneId` 先例）。
4. 新增幾何斷言模組／測試（純函式，不需 renderer）：
   - 對 `fovDeg ∈ {60, 75, 90, 120}` × `aspect ∈ {16/9, 21/9, 4/3}`，由 resolver 取 `yawMagDegRange`／`pitchDegRange`，列舉區間端點與若干內點，算出世界座標；
   - 斷言每個落點的 hitbox AABB 對四面牆與地板的間距 ≥ `CLEARANCE_MARGIN_U`；
   - 逐列比對 README §2.5 的數字（中心目標、最大／最小 yaw、pitch 上下界）。
5. **負向測試（FR-57.9）**：把同一 drill 套上預設 `[10, 10, 3]` 房間，斷言**四個 FOV 檔位皆**產生穿側牆（側向落點 > 5 u）。此測試是把 README §2.5 的結論鎖住，未來若有人改回預設房間會立刻紅燈。
6. 斷言 `arena.eyeHeight === PLAYER_EYE_HEIGHT_U`（GD-6：sim 用常數、scene 用 config，兩者必須相等才不脫鉤）。
7. 跑 `validateClearance()`（本 arena 無 props，應為零 violation）與既有 scene regression。
8. 實機截圖：FOV 60／75／120 三檔各一張，顯示中心目標與左右最大 yaw 落點；記錄目標對背景牆的可辨識度（README §3.1 的「視覺空曠」風險證據），一併回填 OQ-57.3 的觀察。

## Invariants

- 不擴充 `SceneConfig` 核心型別，只新增一筆 config + 一個 scene id。
- 不新增天花板幾何（既有 procedural room 沒有天花板，本 WP 不改變這件事）。
- arena 不得被既有 drill 引用；不改任何既有 scene 的 `roomSize`／`eyeHeight`／`eyeZ`。
- 幾何斷言為純函式測試，不依賴 WebGPU renderer 可用性。

## Definition of Done

- [x] arena scene config 已註冊並與 drill template 綁定；既有 scene 零修改。（`availableScenes` 新增一列；drill 的 roster 註冊需 arm-time resolve ⇒ T6，綁定以 `spiderShotWideV1Binding.sceneId === wideFlickArena.sceneId` 釘死）
- [x] README §2.5 全表逐列有對應斷言且綠。
- [x] 12 組（FOV × aspect）落點對四牆與地板的淨空 ≥ `CLEARANCE_MARGIN_U`。（每組 51 個落點、合計 612；全域最緊為地板 `0.5547 u`）
- [x] 預設 `[10, 10, 3]` 房間的穿牆負向測試綠（四個 FOV 檔位全數 > 5 u）。
- [x] `arena.eyeHeight === PLAYER_EYE_HEIGHT_U` 已釘死（config 測試 + `loadDrill` 閘的負向面）。
- [x] `validateClearance()` 零 violation；既有 scene regression 綠。
- [ ] ~~FOV 60／75／120 三張實機截圖已附 [progress.md](progress.md)，並記錄 OQ-57.3 的初步觀察。~~ → **延到 T6**（截圖需 drill 可從研究者控制列載入 = arm-time resolve 接線；使用者 2026-09-07 拍板，見 D-57.T3-3）

## Commit

```text
feat(scene): add wide flick arena for spider wide drill
```
