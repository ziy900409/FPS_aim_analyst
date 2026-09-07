# KI-026 — `spider-shot-v1`/`v2` 綁定的 `placeholder-room` 未錨定 `eyeZ`:交戰距離 **12.0 u ≠ config 宣稱的 8 u**,交付角徑只有設計值的 **2/3**,而匯出值卻**幾乎等於**設計值

> 類型:tech spec(診斷 + 修改計畫)。語言:繁中,術語保留英文(D4)。
> 狀態:✅ **已修**(2026-09-07,使用者採納架構建議:新增正確的 `spider-shot-v3`,保留 v1/v2 legacy)。
> 決策帳本:[BD-026](BUGFIX-DECISIONS.md);跨 WP 影響面見 [DECISIONS.md GD-34](../exec-plan/DECISIONS.md)。
> 發現於 **WP-57 T0 entry gate** 分析 [OQ-57.7](../exec-plan/active/stage12/wp-57-spider-shot-wide-flick/README.md) 選項 (b) 時的旁支發現;
> WP-57 明確不碰 v1/v2,故不在該 WP 內處理。
>
> 這是 [KI-024](KI-024-field-low-eye-not-anchored-halves-delivered-angles.md) / [GD-31](../exec-plan/DECISIONS.md)
> 的**同一類病理在第三個場景的復發**(`actual ≈ config_distance + eyeZ`),前兩次是
> [KI-002](KI-002-br-field-camera-anchor-protocol-load.md) D1(`br-field`)與 KI-024(`field-low`)。
> **本次的新特徵**:前兩次「宣稱 ≠ 交付」是**單向**的(交付 = 宣稱的 1/2,匯出資料如實反映);
> 本次是**雙向互相遮蔽**——刺激偏小、匯出偏大,兩個誤差方向相反,**在資料裡是隱形的**。
> 亦是 C-D4「既有構念不得有第二定義」的第四次殘留:`W_deg`/`D_deg` 這一個構念,repo 內現有
> **四個**不同的距離基準(§2.2)。

---

## 1. 症狀

`spider-shot-v1` 與 `spider-shot-v2` 皆 pin 在 `placeholder-room`
([main.ts:179/181](../../src/main.ts))。該場景顯式設 `eyeZ: 4`
([placeholder-room.ts:19](../../src/scene/scenes/placeholder-room.ts)),而 spiderShot 中心目標生在
`z = −centerDistanceU = −8`([TargetManager.ts:414-420](../../src/sim/TargetManager.ts))。

⇒ 眼睛在 world `(0, 1.6, 4)`、中心目標在 `(0, 1.5, −8)`,**實際交戰距離 12.0004 u**,
而 config 的 `centerDistanceU` / `peripheral.distanceURange` 都寫 **8**。

### 1.1 中心目標(最單純的一例)

| 量 | 值 | 對設計值之比 |
|---|---|---|
| eye → 中心目標距離 | **12.000417 u** | 1.500× |
| world origin → 中心目標距離(`spiderShotConditions` 實際用的) | 8.139410 u | 1.017× |
| v2 設計角徑([spider_shot_v2.ts:9](../../src/drill/spider_shot_v2.ts):「subtending 2.0° at the fixed 8u distance」) | 2.0000° | — |
| **v2 實際交付角徑** | **1.3334°** | **0.6667×** |
| v2 匯出 `angularSizeDeg`(中心目標) | 1.9658° | 0.983× |
| v1 匯出 `angularSizeDeg`(中心目標) | 7.0305° | — |
| **v1 實際交付角徑** | **4.7717°** | 0.679× |

**這個 bug 的危險在於它在資料裡是隱形的**:匯出值(origin-frame,1.9658°)恰好接近設計值(2.0°),
而真正交付給受測者的是 1.3334°。兩個錯誤方向相反、互相遮蔽。

### 1.2 周邊目標(比中心更糟——`D_deg` 也失準,且標籤塌縮)

`peripheralPos()`([TargetManager.ts:154-171](../../src/sim/TargetManager.ts))以**世界原點**建立正交框
(`forward`/`up` 兩軸正交、`right` = x 軸),故 `abs(pos) ≡ distanceU` **恆為 8.000000**。
從真實眼睛量則落在 **10.94–12.28 u**,且隨 azimuth/radius 變動:

| 條件 | 匯出 `D_deg` | **交付 `D_deg`(眼睛)** | 匯出 `W_deg` | **交付 `W_deg`** |
|---|---|---|---|---|
| v2 radius 10°(內層) | 10.000 | **6.526 – 6.764** | 2.0000 | **1.3230 – 1.3851** |
| v2 radius 17.5°(中層) | 17.500 | **11.585 – 11.824** | 2.0000 | **1.3101 – 1.4202** |
| v2 radius 25°(外層) | 25.000 | **16.499 – 16.920** | 2.0000 | **1.3025 – 1.4626** |
| v1 radius 15°(WP-39 凍結) | 15.000 | **9.891 – 10.132** | 7.1527 | **4.7018 – 5.0375** |

兩個獨立的後果:

1. **`D_deg` 這個主要自變量(Fitts 的 D 項)被壓縮到約 0.65–0.68×**。v2 宣稱掃過
   「離中心視線 10–25°」的包絡,實際交付 **6.5–16.9°**。
2. **條件標籤塌縮(label collapsing)**:v2 **全部**周邊目標的匯出 `W_deg` 都是
   **`2.000000`**(逐位相同,因為 `abs(pos)` 恆為 8),而交付值散布在
   **1.3025–1.4626°(相對散布 12.29%)**。也就是說 `targetConditionCell` 的 `w=2.000000`
   把一整片變動的真實角徑收進同一個標籤 —— 它不只是「偏移一個常數」,而是
   **把有變異的現實壓成一個沒有變異的標籤**,方向由 azimuth 決定。
3. **中心與周邊的匯出標籤本來就不一致**:中心目標 `originDist = 8.139410`(因 `y=1.5` 不在框原點上),
   周邊 `originDist = 8.000000` ⇒ 匯出 `W_deg` 中心 1.9658 vs 周邊 2.0000(v1:7.0305 vs 7.1527)。
   同一個 drill、同一顆 hitbox,兩個 zone 的「目標角寬」標籤不同,而這個差異**不是**刺激的真實差異。

---

## 2. 根因

三件事各自都對,合起來錯(與 KI-024 §2 同一結構):

1. **spawn 以 world 原點為基準**:中心目標 `= (0, TARGET_Y=1.5, −centerDistanceU)`
   ([TargetManager.ts:414-420](../../src/sim/TargetManager.ts),`TARGET_Y` 於
   [:69](../../src/sim/TargetManager.ts));周邊目標 `peripheralPos()` 的正交框頂點在
   **world (0,0,0)**([:154-171](../../src/sim/TargetManager.ts))。
2. **射線/彈道/視覺原點 = camera world position**:
   `resolveEyeWorldBase()` = `{0, eyeHeight, eyeZ ?? depth/2 − CAMERA_STANDOFF}`
   ([eyePose.ts:39-47](../../src/scene/eyePose.ts))。
   已逐一覆驗三個消費端**同源**:
   - render camera 建構期 [SceneManager.ts:50](../../src/render/SceneManager.ts)
   - 每幀 camera 位置 [main.ts:1539](../../src/main.ts)(`base + p × SIM_TO_WORLD`)
   - **開火射線原點** [SimLoop.ts:155](../../src/loop/SimLoop.ts) 與
     [:216](../../src/loop/SimLoop.ts) 皆 `camera.getWorldPosition(ballisticOrigin)`,
     再傳給 `raycastWithRay(origin, …)`([HitDetector.ts:68-75](../../src/sim/HitDetector.ts))。
     ⇒ **命中判定確實從 `(0, 1.6, 4)` 出發**,主張前提成立。
3. **`placeholder-room` 顯式設 `eyeZ: 4`**([placeholder-room.ts:19](../../src/scene/scenes/placeholder-room.ts))。

⇒ 眼睛在 `z=+4`、目標在 `z=−8`,**實際交戰距離 = 12 u = config 的 1.5 倍**。

`SceneConfig` 自己早就寫明了這條規則——[SceneConfig.ts:18](../../src/scene/SceneConfig.ts):

> `radial-spawn drill(前向目標 z=−distance)需 eyeZ:0,使實際交戰距離 == config distance`

`br-field`(KI-002/D1)、`peek-corridor`、`peek-ad-corridor`、`field-low`(KI-024/BD-024)、
`micro-flick-room` 都設了 `eyeZ: 0`。**`placeholder-room` 是唯一承載 radial-spawn drill
卻刻意釘住非零 `eyeZ` 的場景。**

### 2.1 `eyeZ: 4` 是**知情**的選擇,但當年只評估了遮擋,沒評估角度

[placeholder-room.ts:16-17](../../src/scene/scenes/placeholder-room.ts) 的註解明寫:

> `eyeZ` 明確釘住為舊 depth=10 時的 fallback 值(depth/2-standoff=4),避免 depth/width/height
> 調整連動改變 camera/raycast 原點,**牽動本場景其他既有 drill 的實際交戰距離**。

即 [KI-012](KI-012-spider-shot-target-occluded-by-placeholder-room-back-wall.md) §3 當年
**知道 `eyeZ` 會改變「實際交戰距離」**,並刻意釘住現況以收斂 blast radius(避免把
`hold_click_v1`/`hold_track_v1`/counterstrafe 系列一起移動 7 u)。**那個決策本身是合理的**;
缺的是**從未斷言「實際交戰距離 == config 宣稱值」**。

更關鍵的是 KI-012 §3 明文**不採**「縮短 `centerDistanceU`」的理由:

> `spiderShotConditions.ts` 的 `W_deg`/`D_deg` 條件格計算、WP-46 的視角直徑換算公式皆以
> `distance=8` 為基準——改動會牽動已凍結的協定數值與既有指標校準

⇒ 當年**正確地指出條件格以 `distance=8` 為基準**,但沒有回頭問「8 是不是眼睛真正看到的距離」。
KI-012 §7 因此宣告「不受影響:…匯出資料格式/語意」——**這個宣告在實質上不成立**:語意在 KI-012
之前就已經錯了,KI-012 只是把它凍結下來。

### 2.2 同一個構念的**四個**距離基準(C-D4 第四次殘留)

| # | 基準 | 值 | 誰在用 |
|---|---|---|---|
| 1 | `targets.distance`(裸值) | 8.000000 | [DrillMetricRegistry.ts:138](../../src/history/DrillMetricRegistry.ts) 的 compatibility cell ⇒ `width=2deg` |
| 2 | `abs(peripheralPos())`(world 原點) | 8.000000 | 周邊目標的匯出 `W_deg` = 2.0000 |
| 3 | `hypot(0, 1.5, 8)`(world 原點→中心目標) | 8.139410 | 中心目標的匯出 `W_deg` = 1.9658([spiderShotConditions.ts:46](../../src/metrics/spiderShotConditions.ts)) |
| 4 | **真實 eye → target** | **10.94 – 12.28** | **受測者實際看到的角度**;`spiderShotMetrics.ts` 的 ε(t) 也用這個 |
| (5) | `resolveEyeOrigin` 的 `legacy-default` fallback `{0,1.6,0}` | 8.000625 | pre-S1 匯出被離線推導時 ⇒ `W_v2 = 1.9998`(**幾乎正好是設計值**) |

第 5 列是額外的陷阱:任何缺 `meta.scene.eye` 的舊匯出,離線推導會落到 `legacy-default`
([eyeOrigin.ts:68-72](../../src/metrics/eyeOrigin.ts))並算出 **1.9998°** —— 看起來完美正確,
但那個原點從來不存在。`resolveEyeOrigin` 的 `source` 旗標是唯一能分辨的線索。

### 2.3 為什麼撐了六個 WP(WP-36 → 39 → 44 → 46 → 49)都沒被發現

| 檢查點 | 用的距離基準 | 結果 |
|---|---|---|
| `spider_shot_v1.test.ts` / `v2.test.ts` | config 值本身(`8`、`[15,15]`、`[10,25]`、`2*8*tan(1°)`) | 通過——它們斷言的是「config 寫了什麼」,不是「交付了什麼」 |
| 同上的 KI-012/KI-014 回歸測試 | 房間半深 / floorY | 通過——問的是「目標有沒有穿牆/沉地板」 |
| `spiderShotConditions.test.ts` | 合成 fixture(目標距原點 10 u) | 通過——fixture 自洽,不碰真實 drill 的交付值 |
| `tests/regression/spider-shot-spawn-golden.test.ts` | spawn 座標逐位 | 通過——釘的是 spawn 位置,與 eye 無關 |
| **交付角度(眼睛為原點)** | — | **不存在這個測試** |

這是 KI-024 §2.1 的同一張表、同一個結論:**「宣稱的量不是交付的量,而測試站在會通過的那一邊」**。

**另外三個讓它隱形的機制:**

1. **雙向遮蔽**(§1):刺激偏小 2/3、匯出偏大 1.017×,匯出值因此落在設計值 1.7% 內。
   任何「看一眼匯出 `angularSizeDeg` 是否約 2°」的稽核都會過關。
2. **Fitts ID 近乎不變**。`ID = log2(2D/W)`,而 D 與 W 都近似隨 1/distance 縮放 ⇒ 距離因子在
   比值中抵消。實測 v2 全包絡:**`ID` 誤差 ≤ 0.13 bit**(匯出 3.322–4.644 vs 交付 3.236–4.663)。
   ⇒ 任何以 ID 為預測因子的分析、以及**所有序位性的結論**(內層比外層快、命中率隨 radius 下降)
   **在方向上都仍成立**。這既是「為何沒人發現」的數學原因,也是評估選項時最重要的減災事實。
3. **`spiderShotMetrics.ts` 站在正確的原點上**(已獨立覆驗:
   [spiderShotMetrics.ts:4/48/94](../../src/metrics/spiderShotMetrics.ts) 走
   `resolveEyeOrigin()` + `angularEccentricityDeg()`)⇒ **應變量(DV)量對了**,
   錯的只有**自變量的標籤**。兩者不一致時沒有任何 assert 會紅。

### 2.4 GD-32 ② 的敘述需要更正

[GD-32](../exec-plan/DECISIONS.md) ② 寫:

> `spider-shot-v1`／`v2` 的 origin-frame 圓錐不動。…其 spawn 與離線推導
> **兩端一致地偏移** ⇒ 指標內部自洽、既有結論不失效。

**「spawn 與離線推導兩端一致」本身是對的**(兩者都以 world 原點為頂點),但由此推出的
「既有結論不失效」**只在序位性結論上成立**,不能延伸到:

- **絕對值宣稱**(「2.0° 目標」、「10–25° 拉槍」)——這些都沒被交付;
- **`W_deg` 作為預測因子**——標籤恆 2.000000 而現實散布 12.29%(§1.2 第 2 點);
- **zone 間可比性**——中心 1.9658 vs 周邊 2.0000 的標籤差不對應任何刺激差異(§1.2 第 3 點)。

而且「兩端一致」也不是完全成立:中心目標(基準 #3)與周邊目標(基準 #2)在 origin frame 內部
就已經用了兩個不同距離。GD-32 撰寫時只檢查了 wide drill 的 arena(假想 `eyeZ` fallback = 4),
**沒有回頭檢查 v1/v2 實際綁定的 `placeholder-room` 本來就是 `eyeZ: 4`** —— 這是本 KI 的成因。

### 2.5 這不是「已被接受的性質」

逐一讀過 [KI-012](KI-012-spider-shot-target-occluded-by-placeholder-room-back-wall.md) /
[KI-014](KI-014-spider-shot-peripheral-target-sunk-below-floor.md) / BD-012 / BD-014 /
[KI-024](KI-024-field-low-eye-not-anchored-halves-delivered-angles.md) §3.3 與
[GD-31](../exec-plan/DECISIONS.md):

- KI-012 / BD-012:只處理**北牆遮擋**,`eyeZ:4` 是為了收斂 blast radius 而釘住,
  §7 明文宣告「匯出資料格式/語意不受影響」⇒ **角度後果未被辨識**。
- KI-014 / BD-014:只處理**地板高度**(`floorY:-3`),同樣不碰角度語意。
- KI-024 §3.3:明文把本案**延後**——但它引用的是 **KI-012(後牆遮擋)**這條線,
  措辞是「`centerDistanceU`/`distanceURange=8` 也曾重蹈此坑(KI-012)」,
  即**當成「距離選太大會穿牆」那個坑**,不是「交付角度失準」。
- **[GD-31](../exec-plan/DECISIONS.md) 的「影響面」只列 `field-low` 的三個 drill**
  (`tracking_longrange_v1`/`detection_popin_v1`/`tracking_scene_v1`),**沒有 spider-shot 條目**。

⇒ **結論:這是未被辨識的 KI-024 復發,不是已知並接受的性質。** GD-31 影響面的缺口即本 KI 要補的洞。

---

## 3. 影響面

### 3.1 直接受影響的 drill

| drill | 模式 | 宣稱 | 交付 |
|---|---|---|---|
| `spider-shot-v2` | **正式 Assessment**(進 history + trend + compatibility cell) | 角徑 2.0°、radius 10–25° | **1.30–1.46°**、**6.5–16.9°** |
| `spider-shot-v1` | Assessment(WP-39 凍結;`SessionRunner` 的 `spider-shot` 家族解析目標) | 角徑 7.15/7.03°、radius 15° | **4.70–5.04°**、**9.9–10.1°** |
| `spider-shot-pilot-d*-w*` | pilot([pilotConfigs.ts:82-95](../../src/pilot/pilotConfigs.ts) 由 v1 衍生,同場景) | 各 cell 的 `widthU`×`heightU` | 同比例縮小 |

`spider-shot-v1` 另經 [sessionPlanPresets.ts:33-35](../../src/session/sessionPlanPresets.ts) 與
[SessionRunner.ts:69-70](../../src/session/SessionRunner.ts) 進入 stage6 四家族 session roster
⇒ 任何跑過完整 session 的資料都含這個偏差。

### 3.2 匯出與條件格

- [spiderShotConditions.ts:46/50](../../src/metrics/spiderShotConditions.ts):
  `worldDistanceU = hypot(x,y,z)`(world 原點)⇒ `angularSizeDeg`、`angularDistanceDeg`、
  `targetConditionCell`(`spider:d=…;w=…`,6 位小數)三者全是 origin-frame。
- **真值資訊無損**:`meta.scene.eye` + `meta.simToWorld` + `visible` 事件的
  `targetX/Y/Z` 足以用既有 `resolveEyeOrigin()` 完全還原眼睛所見角度
  ⇒ 這是**標籤/分析紀律問題,不是資料遺失**。舊資料仍可被正確重新判讀。

### 3.3 ⚠️ history / registry:compatibility cell **偵測不到世代改變**(最高風險項)

[DrillMetricRegistry.ts:128-143](../../src/history/DrillMetricRegistry.ts) 的
`SPIDER_SHOT_V2_CONDITION_CELL` 完全由 **drill config** 推導:

```
spider-v2:radius=10-25deg;width=2deg;grid=4x3;timeout=1750ms;duration=60s;shape=sphere
```

其中 `width=2deg` 來自 `2*atan((dia/2) / spiderShotV2.targets.distance)` = **距離基準 #1**。

⇒ **若修法只動場景(例如 `placeholder-room` 改 `eyeZ: 0`),這個字串逐位不變**,
而交付刺激從 1.33° 變成 2.00°(+50%)。**修法前後的 run 會被判為可合併並匯入同一條 trend**。

這與 [KI-025](KI-025-tracking-pilot-protocol-version-stuck-at-v1.md) 的失效模式同型
(「唯一一次 layer 3b 攔不住的世代分界」),且更嚴重:那裡是版本字串忘了升,這裡是
**compatibility key 的軸本身不含交付幾何**。
⇒ **任何修法都必須同時 bump `SPIDER_SHOT_V2_REGISTRY_VERSION` 或把交付距離納入 cell**,
否則會靜默污染 trend。這一點與選了哪個選項無關,是所有選項的共同前置。

### 3.4 既有測試的 blast radius(依修法分類)

| 測試 | 釘住什麼 | 場景改 `eyeZ:0` | 改 config 距離 | 只改離線 frame |
|---|---|---|---|---|
| [eyePose.test.ts:10-11](../../src/scene/eyePose.test.ts) | `placeholder-room` → `{0,1.6,4}` | **紅**(語意變更) | 不變 | 不變 |
| [SceneConfig.test.ts](../../src/scene/SceneConfig.test.ts) | `roomSize [16,20,6]` | 視是否加深房間 | 不變 | 不變 |
| `eyePose.test.ts:30-38` | `SceneManager.camera` 與 `resolveEyeWorldBase` 綁定 | 綠(綁定仍成立) | 不變 | 不變 |
| [ReplaySceneAdapter.test.ts:26-35](../../src/render/replay/ReplaySceneAdapter.test.ts) | 讀活的 `placeholderRoom` eye base | 綠(動態讀取) | 不變 | 不變 |
| `spider_shot_v1/v2.test.ts` KI-012 半深回歸 | `distanceU < 10` | 綠(除非改 depth 語意) | **可能紅** | 不變 |
| 同上 KI-014 floorY 回歸 | 最差周邊 y > −3 | 綠 | **可能紅** | 不變 |
| [spider-shot-spawn-golden.test.ts](../../tests/regression/spider-shot-spawn-golden.test.ts) | **spawn 座標逐位**(commit `3548ccc`) | **綠**(spawn 不含 eye) | **紅**(必須重錄 golden) | 綠 |
| [spiderShotConditions.test.ts](../../src/metrics/spiderShotConditions.test.ts) | 合成 fixture 的 `d=30`/`W=2*atan(0.5/10)` | 綠 | 綠 | **紅**(且 fixture 需補 `meta.scene.eye`) |
| [target-cardinality-invariant.test.ts](../../tests/replay/target-cardinality-invariant.test.ts) | 目標基數(與幾何無關) | 綠 | 綠 | 綠 |
| `DrillMetricRegistry.test.ts` | registry 註冊/描述子 | 綠 ⚠️(**這正是 §3.3 的問題**) | 視 cell 是否變 | 綠 |
| [epsilon-offsetdeg-oracle.test.ts](../../tests/golden/research/epsilon-offsetdeg-oracle.test.ts) | eyeBase 凍結歷史值 `{0,1.6,4}` | 綠(已凍結,GD-31 前例) | 綠 | 需覆驗 |

**注意「場景改 `eyeZ:0`」一欄幾乎全綠** —— 這正是 §2.3 的核心問題:現有測試無法分辨
「交付刺激改變 50%」與「什麼都沒發生」。**任何修法都必須先補一個以眼睛為原點的紅燈測試**
(KI-024 §6 ① 的同一慣例)。

### 3.5 場景層的連動(若選「改 `placeholder-room`」)

`placeholder-room` 是 `SceneManager` 的 fallback 場景
([SceneManager.ts:155](../../src/render/SceneManager.ts))與 `main.ts:1669` 的
`fallbackSceneConfig`,另承載 `hold_click_v1`/`hold_track_v1`/counterstrafe 系列等 drill。
改 `eyeZ` 會把**所有**這些 drill 的交戰距離一併 −4 u —— 這正是 KI-012 當年刻意避開的事。
需另外評估:後牆淨空(目標 `z=−8`,眼睛移到 `z=0` 後仍需 `depth/2 > 8`,現行 depth=20 足夠)、
`floorY` 與周邊目標包絡、以及那些 drill 自己的既有資料世代。

### 3.6 與 WP-57 / OQ-57.7 的相依(**本 KI 不替它拍板**)

- WP-57 的新 drill `spider-shot-wide-v1` **結構上已避開本 bug**:它用
  `SPIDER_WIDE_EYE_ORIGIN = {0, 1.6, 0}`([spiderEyeFrame.ts:23](../../src/sim/spiderEyeFrame.ts))
  的 eye-frame 球面,並綁定**新場景** `wide-flick-arena`
  ([spider_shot_wide_v1.ts:27/77-80](../../src/drill/spider_shot_wide_v1.ts))+
  `playerControl: { translation: 'locked' }`。
  ⇒ **前提是 T3 交付的 arena 必須設 `eyeZ: 0`**,GD-32 待辦 ① 已要求以測試釘死。本 KI 支持該要求。
- **對 OQ-57.7 的影響**:該 OQ 目前建議選項 **(a)**(匯出不動、只記載換算),其成本論據是
  「v1/v2 的匯出值是既有凍結 baseline,改動要重錄」。**若本 KI 確認 v1/v2 的刺激本身就沒有交付
  宣稱的角度,那個 baseline 的權威性就下降**,選項 (b)(把 `spiderShotConditions.ts` 修成 eye-frame)
  的邊際成本大幅降低——因為屆時 v1/v2 的匯出值本來就要重新基準化。
  ⇒ **這只是改變 (b) 的成本評估,不構成對 OQ-57.7 的拍板。** 兩者應一併決策以免修兩次。

### 3.7 **不受影響**(已逐一覆驗)

- **sim 決定性與 spawn 序列**:目標位置不含 eye ⇒ `spider-shot-spawn-golden` 逐位不變。
- **應變量(DV)**:`spiderShotMetrics.ts` 走 `resolveEyeOrigin()`
  ([:4/48/94](../../src/metrics/spiderShotMetrics.ts))⇒ `fireAngleErrorDeg`、`overshootDeg`、
  ε(t) **本來就是 eye-frame,量對了**。registry 的五個 v2 指標
  (hits/min、first-shot-hit-rate、median hit time、fire angle error、overshoot)是**行為結果**,
  它們如實記錄了受測者對「實際被交付的刺激」的反應。
- **命中判定**:`HitDetector` 與 render mesh 同一 `TargetState.hitbox` 來源(GD-7)⇒ 無 render/hit 漂移。
- **序位性結論與 Fitts ID 分析**:誤差 ≤ 0.13 bit(§2.3 第 2 點)。
- **GD-6**:本 KI 不涉及把場景幾何送進 sim;所有討論的量都在 render/data/analysis 層。

---

## 4. 為什麼這是研究決策,不由 agent 拍板

依 [KI-024 §4](KI-024-field-low-eye-not-anchored-halves-delivered-angles.md) 的既有慣例:

1. **任一改幾何的修法都改變交付給受測者的刺激** ⇒ 產生新的資料世代,既有 v1/v2 資料作廢
   (`spider-shot-v2` 是**正式 Assessment**,有 history registry 與 trend 指標)。
2. **「條件標籤該宣稱哪個角度」本身是預註冊參數的語意問題** —— v1 的 `[15,15]` 是 WP-39
   凍結校準值、v2 的 `[10,25]` 與 2.0° 是 Aim Lab 對標候選值。要對齊「宣稱」還是對齊「已收的資料」,
   是研究設計取捨。
3. **§2.3 第 2 點使「不修」成為一個真正可辯護的選項**(不同於 KI-024 —— 那裡交付值是宣稱的
   0.5×、且 pilot 資料的效度結論直接依賴絕對值)。這裡序位結論與 ID 分析都存活,
   代價只在絕對值宣稱與 `W_deg` 的預測力。

⇒ 比照 KI-019 F-A2 / KI-020 §4 / KI-023 / KI-024 §5,列出選項交研究者。

---

## 5. 選項

> **所有選項的共同前置(不可跳過)**:
> ① 先補**以眼睛為原點**量交付角徑/角距的紅燈測試(KI-024 §6 ① 慣例);
> ② 處理 §3.3 —— compatibility cell 對交付幾何無感,必須 bump registry version
> 或把交付距離納入 cell,否則新舊世代靜默合併。

| 選項 | 做法 | 交付角徑(v2) | 誰的資料作廢 | 代價 / 副效益 |
|---|---|---|---|---|
| **A — 維持現況,只修文件宣稱** | 幾何、config、匯出全不動。把 `spider_shot_v2.ts:9`「2.0° at 8u」等註解、`analysis-spider-shot.md`、CONTEXT 改成**如實記載**:交付 1.30–1.46°、6.5–16.9°,並記載 origin↔eye 換算式 | 1.30–1.46°(不變) | **無人作廢**。v1/v2 既有資料全部保留 | 最小 blast radius;序位結論與 ID 分析本就存活(§2.3)。**但坑留著**:`placeholder-room` 的「config 距離 ≠ 交戰距離」會被下一個 drill 再踩(這已是第三次復發);且 `W_deg` 標籤塌縮(§1.2)無法靠文件修好——它仍是一個沒有變異的預測因子 |
| **B — `placeholder-room` 改 `eyeZ: 0`(+ 視需要加深房間)** | 把根因修在場景層,與 `br-field`(KI-002/D1)、`field-low`(KI-024/BD-024)一致。現行 depth=20 已滿足後牆淨空,需覆驗 `floorY` 與周邊包絡 | **1.9998°**(≈ 設計值) | **v1 + v2 + spider pilot 全部作廢**;**且 `placeholder-room` 上其他所有 drill**(`hold_click_v1`/`hold_track_v1`/counterstrafe 系列)的交戰距離 −4 u ⇒ 它們的資料世代也改變(§3.5) | **根因修掉、坑關上**,`eyeZ` 契約在全 repo 一致。blast radius **最大**——正是 KI-012 當年刻意避開的那一片。副效益:交付 ≈ 宣稱,`W_deg` 中心/周邊標籤差也一併收斂(8.0006 vs 8.0000) |
| **C — 只改 spider-shot 的 config 距離為交付真值** | `centerDistanceU`/`distanceURange` 由 8 改為 12(或改 hitbox 直徑使 2.0° 成立於 12 u);場景不動 | 可設計成 2.0° | **v1 + v2 + spider pilot 作廢**;其他 drill **不受影響** | 只動 spider-shot 家族,`placeholder-room` 其他 drill 逐位不變。**但坑留在場景層**,且 v1 的 WP-39 凍結值被改動;**須重錄 `spider-shot-spawn-golden`**(§3.4);後牆淨空需重驗(`z=−12` vs depth/2=10 ⇒ **會穿牆,必須同時加深房間**) |
| **D — 只修離線推導的 frame(`spiderShotConditions.ts` 走 eye-frame)** | 刺激完全不動;把 `worldDistanceU`/`angularDistanceDeg` 改用 `resolveEyeOrigin()`,匯出**如實反映交付值** | 1.30–1.46°(刺激不變) | **既有匯出的 `D_deg`/`W_deg`/`targetConditionCell` 標籤全部重新基準化** ⇒ trend 的條件軸不連續;但**行為資料本身仍有效**(DV 是 eye-frame,§3.7),可重跑離線推導重新標註 | **不改刺激 ⇒ 受測者資料不作廢**,只是標籤改版。修掉 §1.2 的標籤塌縮(交付變異變得可見)。**這是 OQ-57.7 選項 (b)**,一併解決 wide drill 的兩端不同源。但「config 宣稱 2.0°、匯出誠實顯示 1.33°」的落差會**永久留在 config 層**,除非併用 A 的文件修正 |
| **E — D + A 併用(修匯出 + 修宣稱,刺激不動)** | 匯出改 eye-frame(D),同時把 config 註解/分析文件的宣稱值改為交付真值(A) | 1.30–1.46°(刺激不變) | 同 D(標籤重新基準化,行為資料保留) | **不作廢任何受測者資料**,且宣稱、匯出、交付三者首次一致。代價:v1/v2 的「2.0°」「10–25°」這些對標 Aim Lab 的**設計意圖數字消失**(變成 1.33°、6.5–16.9°),未來要回到整數條件值仍須改幾何(B 或 C) |

**選項之間的正交性**:A/E 是「接受現行刺激」路線,B/C 是「讓刺激符合宣稱」路線,D 是「讓匯出誠實」
的獨立軸(可與任一路線併用)。**B 與 C 二選一**(都改幾何,不應疊加)。

> **與 OQ-57.7 的耦合**:選 **D 或 E** 等於實質採納 OQ-57.7 的選項 (b);
> 選 **A/B/C** 則 OQ-57.7 仍需獨立拍板。建議兩者一次決定,避免 `spiderShotConditions.ts` 改兩次。

---

## 6. 驗證計畫(修法選定後)

1. **先證實紅**(BD-001/KI-024 的 TDD 慣例):新增以**眼睛為原點**量交付角徑與角距的斷言
   ——`resolveEyeWorldBase(placeholderRoom)` → spawn 位置 → 角徑/角距,
   斷言交付/宣稱 ∈ [0.95, 1.05]。修法前必須失敗並重現本檔數字
   (中心 `dist=12.0004`、`W_v2=1.3334`、交付/宣稱 `0.6667`)。
2. **建構期/載入期守衛**(比照 KI-020 `requireDeliverableSpeed()`、KI-024 §6 ②):
   drill config 的宣稱距離與 `resolveEyeWorldBase(boundScene)` 推出的交戰距離不一致時 fail fast。
   這道守衛應**涵蓋所有 radial-spawn drill × 場景綁定**,以終結第三次復發(見 §7 OQ-KI26-2)。
3. **§3.3 的 registry 守門**:新增測試斷言「交付幾何改變 ⇒ compatibility cell 或 registry
   version 改變」,否則 §3.3 的靜默合併會在下一次幾何調整時重演。
4. 若選 B/C:重驗後牆淨空(`abs(z_target) < depth/2`)、`floorY` 與周邊 y 包絡;
   重錄 `spider-shot-spawn-golden`(僅 C 需要)。
5. 若選 D/E:`spiderShotConditions.test.ts` 的合成 fixture 需補 `meta.scene.eye`,
   並新增「同一 spawn、不同 `scene.eye.z` ⇒ 不同 `D_deg`/`W_deg`」的決定性對照
   (比照 GD-31 的 `tracking-delivered-angles.test.ts` fixture 慣例)。
6. `npx vitest run` 全綠;`npx tsc --noEmit` 與 `-p tsconfig.node.json` exit 0;
   `playwright --project=edge` 相關 spec 綠。
7. **人工覆驗**:實跑 `spider-shot-v2`,以已知角徑的參照確認畫面上目標大小符合修法後的期望值
   (KI-012 的視覺對照慣例)。

---

## 7. 遺留 Open Questions

- **OQ-KI26-1**:`spider-shot-v1` 的 WP-39 凍結值(`[15,15]`、hitbox `1×2×1`)是否曾以
  **交付角度**校準?若當年 pilot 是在同一個 `eyeZ:4` 場景上跑的,則「凍結值」凍住的是
  交付 4.70–5.04°/9.9–10.1° 這組實際條件 —— 那麼選項 A 反而是唯一保留該校準的做法。
  **需研究者確認 WP-39 pilot 的執行環境**(本 KI 無法從程式碼判定)。
- **OQ-KI26-2**:`validateClearance()` 不查房間邊界(KI-012 OQ-KI12-2 已提出),
  現在再加一條:**沒有任何機制驗證「drill 宣稱距離 == 綁定場景的實際交戰距離」**。
  這是同一病理三次復發(KI-002 → KI-024 → KI-026)的共同根因。§6 ② 的守衛是否要做成
  **全 drill × 場景綁定的載入期矩陣檢查**,屬獨立於本次修復的架構決策。
- **OQ-KI26-3**:`resolveEyeOrigin` 的 `legacy-default` fallback `{0,1.6,0}` 對 spider-shot
  會算出 1.9998°(**幾乎正好是設計值**,§2.2 第 5 列)⇒ 缺 `meta.scene.eye` 的舊匯出被離線推導時
  會產生「看起來完全正確」的假象。是否應對 spider-shot 家族的研究側入口強制
  `strictEyeOrigin: true`?
- **OQ-KI26-4**:`peripheralPos()` 的正交框頂點在 world `(0,0,0)` 而非眼高
  ⇒ 即使選 B 把 `eyeZ` 改為 0,錐軸仍相對真實視線仰起 `atan(1.6/8) ≈ 11.31°`
  (GD-32 已記名此偏移為 `atan(1.5/8)=10.62°`)。B 只修 z 分量,不修這個 y 分量的傾斜。
  是否要一併處理屬 GD-32 ② 的重新評估,不在本 KI 擅自決定。

---

## 8. 落地結果（BD-026）

採「**新世代取代正式入口、舊世代唯讀保留**」：新增 `spider-shot-v3`，以獨立
`spider-shot-room`（eye=`(0,1.6,0)`）、eye-frame 球面生成、固定 8 u、2.0° sphere、
translation locked/noMovement 組成封閉契約。Session Plan 的 `spider-shot` 家族改指向 v3；
v1/v2 仍可供 legacy replay/既有資料判讀，spawn golden 未重錄。

同時採納選項 D：`deriveSpiderShotTransitions()` 改由 export 的 scene eye 與 visible tick
位置推導真正交付的 `D_deg`/`W_deg`。v3 export 寫入獨立 protocol
`spider-shot-v3@1.0.0`；history registry 使用 payload snapshot 建 condition cell，並驗證宣稱角徑
與 hitbox 一致，因此 live config 日後變更不會回頭重標舊資料。

載入期 guard 會拒絕 eye anchor、translation/noMovement、center/peripheral distance、sphere angular
diameter 或 room envelope 任一漂移。這使本案從「靠文件提醒」提升為建構期不可違反的契約。
