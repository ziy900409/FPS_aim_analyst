# KI-012 — spider-shot-v1/v2 目標完全看不到(被 placeholder-room 北牆遮擋)

> 類型:場景幾何(render 層)與 drill 目標距離(sim/config 層)錯位——重蹈 WP-5 T1 已文件化過的坑。
> 狀態:**✅ 已修**(2026-08-26)。
> 決策帳本:[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) BD-012。

## 1. 症狀

使用者於 WP-46 T-exit 手動驗收 `spider-shot-v2` 時回報:「沒有看到任何球體」。

## 2. 根因

透過 Playwright 驅動真實瀏覽器(Edge)重現使用者操作流程(研究員模式 → 單一 Drill 調整 → 選
`spider-shot-v2` → 點擊鎖定滑鼠 → 等待 spawn),並於 `TargetView.sync()` 加暫時性 log 確認:

- 目標**確實有 spawn**:`visible=true`、位置 `(0, 1.5, -8)`、`hitbox.shape='sphere'`、直徑
  0.279u——WP-46 T1–T5 交付的 sphere 幾何/schema/render 切換管線本身完全正確。
- 把同一顆目標暫時放大到 30° 角直徑做對照,畫面上只看到目標「探出牆頂」的一小塊圓弧——牆把目標
  下半部完全遮住,只有超出牆高(3u,無天花板)的上緣曝光在開放空間。
- 改測 `spider-shot-v1` 的方塊目標(同一位置 `(0,1.5,-8)`、同一場景),**一樣完全看不到**——證明
  這不是 WP-46 新增 sphere 渲染管線的回歸,是 box/sphere 皆受影響的場景幾何問題。

追碼確認:[`SceneManager.ts` `#buildRoom()`](../../src/render/SceneManager.ts)把北牆放在世界座標
`z = -depth/2`。`placeholder-room` 原本的 `roomSize: [10, 10, 3]`(depth=10)使北牆落在
**z = -5**,而 `spider-shot-v1`(WP-36/WP-39 凍結)與 `spider-shot-v2`(WP-44/WP-46)的
`centerDistanceU`/`peripheral.distanceURange` 皆為 **8**,目標生在 **z = -8**——比牆遠 3 個單位,
整顆目標(不分 box/sphere)幾何上完全埋在不透明牆體後方。

**這是一個已被記錄過、後來被重蹈的坑**:`TargetManager.ts` 的 `DEFAULT_DISTANCE` 常數旁,WP-5 T1
早已留下明確警語:

> ⚠️ 須 < 佔位房間半深(SceneManager `roomSize` 預設 [10,10,3] → 北牆 z=−5),否則目標生在牆後
> 被遮擋(WP-5 T1 手動驗證發現:距離 8 → z=−8 落在北牆後方)。

WP-5 當年把 `DEFAULT_DISTANCE` 從 8 降到 4 來閃開這個坑,`counterstrafe_ad_v1.test.ts` 也留了一個
回歸測試斷言 `targets.distance < 5`。但 WP-36 引入 `spider-shot-v1` 時另開了 `centerDistanceU`/
`peripheral.distanceURange` 這兩個新欄位(不是 `targets.distance`),沒有對照到這條就在同一份檔案裡
的警語,選了 `8`——原地重踩十二個 WP 之前就踩過的雷,WP-44/WP-46 沿用 v1 的距離慣例,一併繼承。

**為何 v1 用了超過一年(WP-36→WP-39→WP-44→WP-46)都沒人發現**:

1. `HitDetector` 的 raycast 只測目標 hitbox,不查牆的視覺遮擋——[WP-45](../exec-plan/completed/stage9/wp-45-peek-click-transfer/README.md)
   的 occlusion gate 只在場景 `propBounds` 非空時觸發,`placeholder-room` 的 `propBounds: []`
   恆不觸發。玩家對著準心中線盲開火,中心目標「看不見但打得中」,不需要真的看到它。
2. 周邊目標的方位角/徑向角會讓部分目標的 Y 座標超出牆高(3u,`#buildRoom()` 不建天花板),使其
   探出牆頂、落入開放空間而**可見**——這解釋了為何使用者(WP-44/46 觸發)的抱怨一直是「太難搜尋」
   (峰迴路轉才看到)而非「完全看不到」:中心目標(必被遮)沒被抱怨過,因為沒人靠視覺瞄它;周邊
   目標(部分被遮、部分探頭)才是真正被拿來練習、抱怨的對象。
3. `validateClearance()`([clearance.ts](../../src/scene/clearance.ts))只檢查目標包絡是否與場景
   `propBounds`(裝飾道具)相交,完全不檢查房間本身的牆/地板/天花板幾何——[KI-011](KI-011-spider-shot-v1-clearance-rejected-in-field-low.md)
   OQ-KI11-3 曾點出 y 軸包絡超出房高,但當時聚焦在道具淨空,未往下追牆體本身是否擋住 z 軸。

## 3. 修復決策

**只放大 `placeholder-room` 的房間深度,不動任何 drill config 數值**:

```ts
// src/scene/scenes/placeholder-room.ts
proceduralRoom: {
  roomSize: [10, 20, 3],  // depth: 10 → 20，北牆 z=-5 → z=-10（給 distance=8 目標 2u 淨空）
  eyeZ: 4,                // 明確釘住舊 depth=10 時的 fallback 值（depth/2-standoff），
                           // 避免 depth 改動連動改變 camera/raycast 原點
  ...
}
```

- **只改 depth,不改 width/height**:`width=10`(半寬 5)已足夠容納周邊目標最大側向偏移
  (`8×sin(25°)≈3.38u`,WP-46 v2 的最大角距);`height=3` 維持不動——是否要讓周邊目標完全不
  探頭(加高牆體或補天花板)是產品/美術決策,不在本次修復範圍(見 §6 遺留 OQ)。
- **顯式 `eyeZ:4`**:`resolveEyeWorldBase()`(camera 位置與 raycast 原點的單一來源)在缺
  `eyeZ` 時 fallback 為 `depth/2 - CAMERA_STANDOFF`;若放任 depth 改動連動這個 fallback,會把
  `placeholder-room` 上**所有**既有 drill(`hold_click_v1`/`hold_track_v1`/counterstrafe 系列等,
  只要綁定這個場景)的 camera 位置與命中判定原點一併移動 7 個單位,牽動面遠大於本次修復目標。
  明確釘住舊值,把改動範圍收斂到「只有牆更遠了」。

**不採**「縮短 spider-shot 的 `centerDistanceU`/`distanceURange`」:這兩個值是 v1 的 WP-39 凍結
校準值,且 `spiderShotConditions.ts` 的 `W_deg`/`D_deg` 條件格計算、WP-46 的視角直徑換算公式皆以
`distance=8` 為基準——改動會牽動已凍結的協定數值與既有指標校準,而場景幾何本來就允許自由調整
(GD-6:場景幾何永不進 sim runtime,render 層可以自由變動,不需要驚動 sim/drill config)。

## 4. 修改紀錄

| 檔案 | 修改 |
|---|---|
| `src/scene/scenes/placeholder-room.ts` | `roomSize` depth 10→20;新增顯式 `eyeZ: 4` 釘住既有 camera/raycast 原點 |
| `src/sim/TargetManager.ts` | `DEFAULT_DISTANCE` 旁的 WP-5 警語補充 KI-012 交叉引用與 placeholder-room 新深度 |
| `src/scene/SceneConfig.test.ts` | `placeholderRoom.proceduralRoom.roomSize` 斷言值同步 `[10, 20, 3]` |
| `src/scene/eyePose.test.ts` | placeholder-room 的 `resolveEyeWorldBase` 測試標題更正為「顯式 eyeZ」(值不變,仍是 4) |
| `src/drill/spider_shot_v1.test.ts` | 新增回歸測試:`centerDistanceU`/`peripheral.distanceURange` 須 < 房間半深(10) |
| `src/drill/spider_shot_v2.test.ts` | 同上,新增對等回歸測試 |

## 5. 驗證證據

1. **重現**:Playwright 驅動 Edge 走完整使用者路徑(研究員模式→單一 Drill 調整→選
   drill→點擊鎖定→等待 spawn),`TargetView.sync()` 暫時性 log 確認目標 spawn 於
   `(0,1.5,-8)`,螢幕上準心處與周圍裁切區域(200×200px)完全無任何色塊。
2. **形狀無關對照**:同一場景/同一位置,`spider-shot-v1` 的 box 目標與 `spider-shot-v2` 的
   sphere 目標(修復前)一樣完全不可見——排除 WP-46 sphere 渲染管線是根因。
3. **放大對照**:暫時把 sphere 角直徑從 2.0° 調到 30°,畫面上只見目標探出牆頂的一小塊圓弧,
   直接視覺確認牆體遮擋的存在與位置。
4. 修復後(depth=20):`npm run test:ci` 全綠——詳見下方「狀態」列。
5. 診斷用暫時性 log(`TargetView.sync` console.log)與暫時性 e2e spec 檔均已於修復前清除,
   `git status` 確認乾淨,未殘留於最終 commit。

## 6. 遺留 Open Questions

- **OQ-KI12-1**:周邊目標(`azimuthDegRange` 覆蓋 0–360°)在特定方位角/角距組合下,Y 座標仍可能
  超出牆高(3u,無天花板)而探出牆頂——這在修復前後皆存在,不是本次修復範圍。是否要讓所有周邊
  目標完全落在牆內可見範圍(加高牆體、補天花板,或縮小 `angularRadiusDegRange` 上限),屬產品/
  訓練設計決策,建議另開 task 評估(可能與 stage9 使用者對 v2 手感的後續回饋一併考慮)。
- **OQ-KI12-2**:`validateClearance()` 只查 `propBounds`,不查房間牆/地板/天花板幾何本身——
  本次靠人工重現與追碼找到問題,沒有自動化的「目標包絡是否落在房間幾何內」機制。若日後新增
  drill 又選了一個超出房間邊界的 distance,同樣的坑會第三次發生。是否要幫 `clearance.ts` 補一個
  房間邊界檢查(而不只是 `propBounds`),屬獨立於本次修復範圍的架構決策,留給日後有更多場景/
  drill 組合時再評估投入產出比。
- **OQ-KI12-3**:`DEFAULT_PROCEDURAL_ROOM`(`eyePose.ts`,`roomSize:[10,10,3]`)與
  `field-low`/`urban-high` 的 `proceduralRoom.roomSize`(皆 depth=10)仍是舊值——這些場景要嘛是
  GLTF 資產場景(牆體來自 `.gltf` 檔,不受 `roomSize` 影響,只有 `eyeZ` fallback 計算會用到深度值)
  要嘛是實務上從未真正以 `asset:null` 形態被建構(`DEFAULT_PROCEDURAL_ROOM` fallback),本次未
  發現任何實際受影響的路徑,故未一併修改;若日後有新 drill 綁定到會實際建牆的程序化房間且距離
  ≥5,需要重新檢查这個假設是否仍成立。

## 7. 影響範圍

**受影響**:`placeholder-room` 場景的房間深度視覺呈現(牆更遠,房間看起來更大)。**不受影響**:
`spider_shot_v1.ts`(協定凍結,零改動)、`spider_shot_v2.ts`、`TargetManager.ts`/`HitDetector.ts`
任何判定邏輯、`clearance.ts` 驗證結果(propBounds 仍是空陣列,恆通過)、`placeholder-room` 上其他
既有 drill(`hold_click_v1`/`hold_track_v1` 等)的 camera 位置與命中判定原點(`eyeZ` 明確釘住不變)、
匯出資料格式/語意。
