# KI-014 — spider-shot 周邊目標朝下時被地板埋住

> 類型:場景幾何(render 層)與 drill 目標角距(sim/config 層)錯位——與 [KI-012](KI-012-spider-shot-target-occluded-by-placeholder-room-back-wall.md) 同一根因家族,換一面(地板而非北牆)。
> 狀態:**✅ 已修**(2026-08-26)。
> 決策帳本:[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) BD-014。

## 1. 症狀

KI-012(北牆遮擋中心目標)修復後,使用者實機重測回報:「現在地板高度也會遮蓋球體」。

## 2. 根因

`TargetManager.ts` 的 `peripheralPos()`([TargetManager.ts:78](../../src/sim/TargetManager.ts))把周邊目標
世界座標算成:

```ts
y = distanceU × (cos(radiusRad) × forwardY + sin(radiusRad) × cos(azimuthRad) × upY)
```

其中 `forwardY`/`upY` 由中心視線 `(0, TARGET_Y, -centerDistanceU)` 推導。azimuth 依「0=上、90=右、
180=下、270=左」的約定,`azimuthRad=180°` 時 `cos(azimuthRad)=-1`,把整個 `sin(radiusRad)×upY` 項
反向——這是周邊目標往「下」偏移最多的方向。代入 `spider-shot-v2` 的實際參數
(`centerDistanceU=8`、`TARGET_Y=1.5`、`angularRadiusDegRange` 上限 `25°`,`distanceURange=[8,8]`):

```
centerLength = hypot(1.5, 8) = 8.1394
forwardY = 1.5 / 8.1394 = 0.18431
upY = 8 / 8.1394 = 0.98287
y_min = 8 × (cos(25°)×0.18431 + sin(25°)×(-1)×0.98287)
      = 8 × (0.16702 − 0.41544) ≈ −1.987
```

`placeholder-room`([SceneManager.ts](../../src/render/SceneManager.ts) `#buildRoom()`)的地板原本鋪在
`y=0`,`spider-shot-v2` 朝下方位角、角距上限的周邊目標中心 y≈−1.99——目標中心已經埋進地板將近
2 個單位,加上 hitbox 半徑(球體約 0.14u),整顆目標幾乎完全沉在不透明地板之下,只有極少數
azimuth/radius 組合能露出地板一點點邊緣。

`spider-shot-v1`(`angularRadiusDegRange` 固定 `15°`)用同一公式算出最深 y≈−0.61——這正是
[KI-011](KI-011-spider-shot-v1-clearance-rejected-in-field-low.md) OQ-KI11-3 當年就記錄過的數字
(「spider-shot 真實目標包絡在 y 軸可達 −0.61~3.46」),但當時只點出「比房高(3)更寬」這件事,
沒有往下追「−0.61 已經是負值,地板在 y=0,目標下半部已經沉進地板」這一半——WP-44/46 把
`angularRadiusDegRange` 上限從 v1 的 15° 放寬到 25°,把這個原本只是「輕微沉入」的邊界情況推到
「幾乎全沉」的程度,才被使用者實機注意到。

**與 KI-012 的關係**:同一族問題(drill 目標幾何 vs. 場景固定尺寸的房間邊界不相容),但這次是
**地板**(下邊界)而非北牆(遠邊界)。KI-012 修復北牆時完全沒有觸碰地板,兩者是房間六個面裡
獨立的兩面,各自需要各自的淨空檢查。

## 3. 修復決策

比照 KI-012 的做法,只調整 `placeholder-room` 場景的地板位置,不動任何 drill config 數值:

- `SceneConfig.ts` 的 `ProceduralRoomConfig` 新增選填 `floorY?: number`(比照既有 `eyeZ?` 慣例,
  省略 = 0,逐位不變)。
- `SceneManager.ts` 的 `#buildRoom()` 用 `floorY` 定位地板 mesh,並讓四面牆的**下緣**跟著
  `floorY` 一起下移(牆高 = `height − floorY`,牆體縱向置中於 `[floorY, height]`)——上緣仍固定在
  當時的 `height=3`,維持 KI-012 §6 OQ-KI12-1 記錄過的「周邊目標探出牆頂進 open 空間仍可見」
  行為不變,只讓下邊界跟著地板一起退開。2026-09-01 後續產品調整把 `height` 提高為 6,不改
  `floorY` 或 spider-shot 參數。
- `placeholder-room.ts` 設 `floorY: -3`——覆蓋 `spider-shot-v2` 實測最深 y≈−1.99,留約 0.87
  的安全邊界(hitbox 半徑 + 未來候選值微調空間)。

**不採**「縮小 `angularRadiusDegRange` 上限」:這是 WP-44/46 候選值(未經 pilot 校準,拍板時
明確保留調整空間),為了場景幾何限制而反向去遷就它會本末倒置;場景幾何依 GD-6 本就可自由調整、
不影響 sim/drill config,是唯一不驚動已定案協定數值的修法。

## 4. 修改紀錄

| 檔案 | 修改 |
|---|---|
| `src/scene/SceneConfig.ts` | `ProceduralRoomConfig` 新增選填 `floorY?: number`;`validateProceduralRoom` 對應解析(比照 `eyeZ` 寫法) |
| `src/render/SceneManager.ts` | `#buildRoom()` 簽名新增 `floorY` 參數;地板 `position.y = floorY`;四牆改用 `wallHeight = height - floorY`、`wallCenterY = (floorY + height) / 2` |
| `src/scene/scenes/placeholder-room.ts` | `proceduralRoom` 新增 `floorY: -3`;2026-09-01 後續視覺調整維持 `floorY` 不變,只把 `roomSize` 更新為 `[16, 20, 6]` |
| `src/drill/spider_shot_v1.test.ts`/`spider_shot_v2.test.ts` | 各新增回歸測試:鎖死 `azimuthDegRange=[180,180]`(朝下)、`angularRadiusDegRange` 取上限,經真實 `TargetManager`/`createSharedState` 跑出周邊目標世界 y,斷言落在 `floorY + hitbox 半徑` 之上 |

## 5. 驗證證據

1. **重現路徑**:KI-012 修復(北牆退到 z=-10)後,Playwright 重跑同一操作流程 + `TargetView.sync()`
   暫時性 log,確認中心目標資料正確(`shape='sphere'`、位置 `(0,1.5,-8)`)但畫面仍空白;逐步放大
   角直徑(2°→4°→8°)重現「小尺寸本身即難以肉眼辨識」與「周邊目標朝下沉入地板」是**兩個獨立現象**
   ——本 KI 只處理使用者實際回報的地板遮擋。
2. **v1 box 目標對照**:同一位置(0,1.5,-8)的中心 box 目標在 KI-012 修復後**確實可見**(修復前的
   螢幕截圖顯示紅色方塊清楚出現在準心處),證明北牆問題已解;地板問題只在**周邊**(非中心)目標
   朝下時出現,與中心目標的可見性無關。
3. **數值驗證**:`spider_shot_v1.test.ts`/`spider_shot_v2.test.ts` 新增的回歸測試,經真實
   `TargetManager` 程式碼路徑(非手算公式)驗證朝下最深周邊目標 y 值,v1≈−0.61、v2≈−1.99,皆
   `> floorY(-3) + hitbox 半徑`。
4. 視覺確認房間幾何延伸無縫:`floorY=-3` 套用後,截圖顯示地板/牆交界線明顯下移,無背景色從
   牆體與地板間的縫隙透出(牆體下緣跟著地板一起延伸)。
5. 完整 `npm run test:ci`:見本次 commit 附帶的執行紀錄。

## 6. 遺留 Open Questions

- **OQ-KI14-1**:2.0° 角直徑的 `spider-shot-v2` 中心目標,即使在完全無遮擋的情況下,螢幕投影
  直徑仍只有個位數到十餘像素等級,肉眼辨識度偏低(本次診斷中以 4°/8° 對照驗證過「越小越難看見」
  的趨勢,但這是**尺寸感知**問題,不是遮擋問題,不在本 KI 修復範圍)。是否要調整 2.0° 這個
  Aim Lab 候選值,屬 WP-46 校準範圍的產品決策,建議使用者實機測試後另行拍板(WP-46 README 已
  聲明此為未經 pilot 校準的候選值)。
- **OQ-KI14-2**:`floorY=-3` 是針對 `spider-shot-v2` 目前 `angularRadiusDegRange` 上限(25°)算出的
  安全邊界;若日後這個候選值再調大(例如超過 ~29° 就會讓 −3 的邊界不夠),需要重新驗證這條邊界
  是否仍成立——`spider_shot_v1.test.ts`/`spider_shot_v2.test.ts` 新增的回歸測試會在那種情況下
  轉紅,充當這條隱性耦合的守門員。
- **OQ-KI14-3**(承 KI-012 OQ-KI12-2):`clearance.ts` 仍不查房間牆體/地板/天花板幾何本身,
  只查 `propBounds`——本次(KI-012+KI-014)已經是同一類「場景固定尺寸 vs. drill 目標幾何」問題
  第二次靠人工重現與追碼找到,若日後新增 drill 又選了超出房間六面邊界之一的位置,同樣的坑會第三次
  發生。是否要幫 `clearance.ts` 補一個房間邊界檢查,屬獨立於本次修復範圍的架構決策。

## 7. 影響範圍

**受影響**:`placeholder-room` 場景的地板/牆體下緣視覺呈現(房間看起來更深);2026-09-01 後續調整另使
房間更寬、牆面更高。**不受影響**:
`spider_shot_v1.ts`(協定凍結,零改動)、`spider_shot_v2.ts`、`TargetManager.ts`/`HitDetector.ts`
任何判定邏輯、`clearance.ts` 驗證結果、`placeholder-room` 上其他既有 drill 的 camera/raycast 原點
(`eyeZ` 不受影響)、匯出資料格式。`SceneConfig.ts`/`SceneManager.ts` 的 `floorY` 為新增選填欄位,
省略時對其他所有場景(`field-low`/`urban-high`/`DEFAULT_PROCEDURAL_ROOM` 等)逐位不變。
