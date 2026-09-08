# Analysis Spider Shot Contract

`spider-shot-v3` 是目前 Session Plan 的正式 Assessment 中心—周邊目標切換協定；v1/v2
保留作 legacy replay／歷史資料判讀，不再代表現行交付幾何。場上同時只保留一個可命中目標；
目標命中後依 `spiderShot` 排程在中心與周邊間交替。排程由 `spiderShot.seed` 決定，並完整回顯到
`meta.spawn.spiderShot`；既有 `sequence.alternation` 在此分支只保留型別相容位置，不承載 Spider Shot 語意。

## Relationship to legacy L/R alternation and `SpawnAreaConfig`（避免誤用）

Spider Shot 是與既有排程機制**互斥**且**幾何不同**的獨立分支，讀者不應假設兩者可以混用或互相取代：

| | 既有 L/R 交替 + `SpawnAreaConfig`（WP-4/WP-21） | Spider Shot（WP-36） |
|---|---|---|
| 排程原語 | `sequence.alternation: 'LR' \| 'RL'`,二元交替,`TargetManager.markKilled()` 的 `nextSide` 布林翻轉 | `DrillConfig.spiderShot?: SpiderShotScheduleConfig`(top-level additive),`kind: 'center-peripheral'`,獨立 `nextSpiderZone: 'center' \| 'peripheral'` 狀態,`TargetManager` 完全獨立分支(不讀寫 `nextSide`) |
| 幾何模型 | 一維水平 yaw(`SpawnAreaConfig.yawDegRange`/`distanceURange`),固定 `TARGET_Y`,無狀態獨立抽樣 | 繞「中心目標視線」的二維球面極角(`azimuthDegRange` 方位角 + `angularRadiusDegRange` 徑向角距),`y` 分量隨方位角變化,見下方公式 |
| RNG 權威 | `sequence.seed`(配合 `spawnArea`/`spawnDelayMsRange`) | `spiderShot.seed`,唯一 RNG source |
| 互斥規則 | — | `schema.ts` 的 `validateSpiderShotSchedule` 在 `spiderShot` 存在時拒絕 `targets.spawnArea`、`sequence.spawnDelayMsRange`、`sequence.seed` 同時出現,避免雙重排程/seed 權威([schema.ts:59-62](../../src/drill/schema.ts)) |
| `side`/`zone` 欄位 | `DrillEvent{type:'visible'}.side: 'L' \| 'R'` 承載真實左右語意 | `center-peripheral(-stratified/-eye-stratified)` 三支的 `side` 恆為 `'R'`(佔位,不承載象限語意);新增 `zone?: 'center' \| 'peripheral'` 才是 Spider Shot 的真實排程狀態。**例外**:`center-peripheral-yawpitch`(WP-57)的周邊 spawn 帶真實左右,見下方 wide 變體一節 |

省略 `spiderShot` 時,`TargetManager`/`schema.ts` 逐位等同現行 L/R 交替行為——既有 `TargetManager.test.ts`/`schema.test.ts`/`DrillLoader.test.ts`/WP-21 seeded spawn 測試零修改全綠(機械判準,已於 T1 驗證)。

## Schedule mechanism

`DrillConfig.spiderShot?: SpiderShotScheduleConfig`([DrillConfig.ts:28-42,81](../../src/drill/DrillConfig.ts))：

```ts
export interface SpiderPeripheralConfig {
  angularRadiusDegRange: [number, number]; // D_deg 候選值,與中心視線的夾角
  azimuthDegRange: [number, number];       // 繞中心視線的方位角(0=正上,90=右,180=正下,270=左)
  distanceURange: [number, number];        // 周邊目標與玩家的世界距離(u)
}

export interface SpiderShotScheduleConfig {
  kind: 'center-peripheral';
  seed: number;
  centerDistanceU: number;
  peripheral: SpiderPeripheralConfig;
}
```

`TargetManager` 以 `config?.spiderShot !== undefined` 進入獨立分支([TargetManager.ts:95](../../src/sim/TargetManager.ts))：內部 `nextSpiderZone`(初始 `'center'`)取代該分支的 `nextSide`；`markKilled()` 每次撤除目標翻轉 `nextSpiderZone`([TargetManager.ts:283-287](../../src/sim/TargetManager.ts))。

`sampleSpiderShotPose()`([TargetManager.ts:135-175](../../src/sim/TargetManager.ts))換算世界座標：以中心目標視線 `(0, TARGET_Y, -centerDistanceU)` 正規化為 `forward`,其與世界 up 正交的投影為 `up`,固定世界 `+X` 為 `right`。取樣順序固定 `azimuthDeg → angularRadiusDeg → distanceU`：

```text
direction = cos(radius) × forward + sin(radius) × (sin(azimuth) × right + cos(azimuth) × up)
pos = distanceU × direction
```

故方位角 0°/90°/180°/270° 對應上/右/下/左,45°/135°/225°/315° 為斜向。中心目標固定在 `centerDistanceU` 正前方,不取樣。

## FR-G7 condition-schedule scope (closed)

WP-41 T0 已關閉「以外部 seed 再次排程家族內條件區塊」的分支（D-41.1/D-41.2）。Assessment v1 保持各協定凍結的 seed，不新增 `buildSpiderShotOverrideSeed()`、config clone 或 metadata 同步路徑。

| 協定 | 現況與讀碼證據 | FR-G7 結論 |
|---|---|---|
| hold-click / hold-track | `near`、`mid`、`far` 常數雖存在，但 assessment config 只接入 `mid`；`spawnArea` 的 yaw 與 distance 範圍均退化為單點。seed 只取樣 700–1700 ms 的 spawn 延遲，L/R 則由 `TargetManager.markKilled()` 確定性交替。 | 沒有多層級條件格可做區塊平衡；不覆寫 seed。 |
| counterstrafe-reversal | 未定義 `spawnArea`，且 `spawnDelayMsRange` 固定為 `[500, 500]`；seed 沒有可觀測的隨機效果。 | 沒有可排程條件；不覆寫 seed。 |
| Spider Shot | `spiderShot.seed = 36036` 會取樣周邊點的連續方位、徑向角距與距離；唯一非退化範圍是 `azimuthDegRange: [0, 360]`。這不是固定的 L/R、近/中/遠或象限條件區塊，seed 改變取樣軌跡也不保證條件格平衡。 | 不覆寫 seed；若日後要平衡多個 `D_deg`/`W_deg` 條件格，應另開協定設計工作。 |

這個關閉決定不影響 `buildFamilyOrder()` 的跨 session 家族順序平衡（FR-G6）。`CompatibilityKey` 亦未包含 seed；不覆寫的理由是其無法達成條件區塊平衡，而不是相容性限制。完整覆核證據見 [WP-41 README §0](../exec-plan/completed/stage7/wp-41-seeded-counterbalance/README.md#0-讀碼對帳規劃階段2026-08-25決定本-wp-淨新增工作量與-fr-g7-範圍) 與 [progress.md D-41.1/D-41.2](../exec-plan/completed/stage7/wp-41-seeded-counterbalance/progress.md#decision-log)。

## Event anchors and transition direction

每個目標生成時記錄既有 `visible` 事件，Spider Shot 額外帶：

```ts
{ type: 'visible', targetId, side: 'R', zone: 'center' | 'peripheral', t, targetX, targetY, targetZ }
```

`zone` 是 additive 欄位([DataRecorder.ts](../../src/data/DataRecorder.ts))，省略時（既有 drill）行為零回溯相容成本；`side` 在 `center-peripheral`／`-stratified`／`-eye-stratified` 三支恆為 `'R'`，僅維持既有型別相容位置（`center-peripheral-yawpitch` 是唯一例外，見 wide 變體一節）。排程 config 本身以不透明形式回顯到 `Meta.spawn.spiderShot?: unknown`（[metadata.ts](../../src/data/metadata.ts)，比照既有 `spawnArea` 慣例，WP-33 不解析）。

離線 `deriveSpiderShotTransitions(payload)`([spiderShotConditions.ts](../../src/metrics/spiderShotConditions.ts))依時間排序相鄰的 `visible` 事件，以 `zone` 重建 transition：

- `center → peripheral` 是 `center-to-peripheral`。
- `peripheral → center` 是 `peripheral-to-center`。

兩種 transition 都輸出，讓 T3 的節奏統計保有完整序列；只有抵達周邊的 `center-to-peripheral` transition 具有象限標籤。遺漏座標、`zone`、GD-7 hitbox 或 spawn seed 的匯出會明確拋錯，避免無法溯源的條件格混入 Assessment 歷史。

## Condition geometry

`D_deg` 是前一目標與抵達目標、均由各自 visible tick 的**玩家眼睛**指向目標中心的兩個方向向量之無號球面夾角。eye base 來自 `meta.scene.eye`，玩家位移由 tick 的 `px/pz × meta.simToWorld` 還原。其實作共用 `resolveEyeOrigin()`／`eyeOriginForTick()`／`angularDistanceDeg()`；`angularEccentricityDeg()` 亦使用同一組 primitive，因此沒有第二套原點或夾角公式。

`W_deg` 是抵達目標的角寬：

```text
W_deg = 2 × atan((hitbox.width / 2) / worldDistanceU) × 180 / π
```

`hitbox` 僅來自 `meta.targets.hitbox`（GD-7 單一來源），`worldDistanceU` 為玩家眼睛到抵達目標中心的距離。輸出同時保留三維 hitbox、距離與 `meta.spawn.seed`，使條件可獨立審核。

## `spider-shot-v3` — canonical eye-frame Assessment（KI-026 / BD-026）

v3 使用獨立 `spider-shot-room`，scene eye 固定 `(0,1.6,0)`；`center-peripheral-eye-stratified`
排程從該 eye 生成中心與周邊球面座標，距離恆為 8 u、角半徑分層為 10–25°、sphere 角徑恆為
2.0°。玩家 translation locked，並要求 `protocolGuard.noMovement=true`。

`loadDrill()` 在 arm 前驗證 eye anchor、center/peripheral distance、sphere hitbox 對應的宣稱角徑，
以及整個周邊 spawn envelope 是否落在 room 內；不符合即 fail fast。v3 export 使用
`spider-shot-v3@1.0.0`，history condition cell 從 payload snapshot 建立，scene eye 或幾何有任何差異
都會形成不同 compatibility cohort。v1/v2 的 spawn path 與 frozen golden 不變。

周邊點相對中心視線的方位角依 45° 分箱：上／下為 `vertical`、左／右為 `horizontal`、45°、135°、225°、315° 邊界及其斜向區域為 `oblique`。這是呈現層標籤，不進 `targetConditionCell`，因此後續 pilot 調整分箱不會改變相容鍵語意（OQ-S6-18，暫定 45°，不阻塞開工）。

## Compatibility condition cell

每筆 transition 輸出固定六位小數的：

```text
spider:d=<D_deg>;w=<W_deg>
```

例如 `spider:d=15.000000;w=7.152668`。此字串是 caller-owned 的非空 `targetConditionCell`，可直接傳給 `buildCompatibilityKey()`；WP-33 不解析其內容。

## Five metrics

`deriveSpiderShotMetrics(payload, options)`([spiderShotMetrics.ts](../../src/metrics/spiderShotMetrics.ts))在同一組 transition anchors 上組裝五類指標，全部複用既有 canonical derivations（C-D4，無第二套幾何）。切換反應／移動執行／停止控制／首發只對 `zone: 'peripheral'` 的抵達目標輸出；回中心只進入節奏的連續 `visible.t` 間隔（D-36.5，承 README §1.1 的量測範圍）。

| 類別 | 定義 | 複用來源 |
|---|---|---|
| **切換反應**(switch reaction) | `tDetectMs`（`t_detect − t_visible`,視覺—動作代理值）、`reactionMs` | `deriveDetectionMetrics()`([detectionDerivation.ts](../../src/metrics/detectionDerivation.ts)) |
| **移動執行**(movement execution) | `movementTimeMs = t_first_on_target − t_detect`(flick 執行時間,與視覺—動作 reaction proxy 分離)、`peakOmegaDegPerSec`(peek window tick 範圍內的角速度峰值) | `buildPeekWindows()`([peekWindows.ts](../../src/metrics/peekWindows.ts)) 的 `tickRange` + `omegaDegPerSec()`([angularKinematics.ts](../../src/metrics/angularKinematics.ts)) |
| **停止控制**(stop control) | `overshootDeg`(首次進靶後所有 `onTarget===false` 樣本的最大無號 `epsilonDeg`,即逸出幅度,非有號 overshoot/undershoot 分類)、`dropCount`(掉靶次數)、`microAdjustCount`(reacquire 段數) | canonical `TrackingSample[]`([trackingDerivation.ts](../../src/metrics/trackingDerivation.ts)) + `deriveTrackingTransitions()`([trackingTransitions.ts](../../src/metrics/trackingTransitions.ts)) |
| **首發**(first shot) | `hit`(peek-window outcome)、`fireAngleErrorDeg`(開火 tick 對抵達目標的角度偏差) | `buildPeekWindows()` + `angularEccentricityDeg()`/`resolveEyeOrigin()`([eyeOrigin.ts](../../src/metrics/eyeOrigin.ts)) |
| **節奏**(rhythm) | 全部相鄰 `visible.t` 間隔（含回中心錨點）的 `transitionIntervalMs`/`medianMs`/`p95Ms` | 新加總，無既有函式衝突 |

**停止控制的已知限制**：canonical `TrackingSample` 沒有有號誤差，`overshootDeg` 只能量「進靶後逸出多少角度」，不能區分 overshoot（衝過頭）與 undershoot（沒到位）的方向（OQ-S6-16，D-36.5，避免建立第二套有號幾何）。

## `spider-shot-v2` — stratified peripheral schedule (WP-44)

`spider-shot-v2`([spider_shot_v2.ts](../../src/drill/spider_shot_v2.ts))是與 `spider-shot-v1` 並存的獨立 drill,**不修改** v1 的型別、行為或 WP-39 凍結數值。兩者共用同一套 center↔peripheral 交替、同一套 `deriveSpiderShotTransitions()`/`deriveSpiderShotMetrics()` 推導——差異**只在**周邊目標怎麼被排出來。

`DrillConfig.spiderShot` 現為 discriminated union([DrillConfig.ts](../../src/drill/DrillConfig.ts)):`kind: 'center-peripheral'`(v1)不變;新增 `kind: 'center-peripheral-stratified'`,多一個 `grid: { azimuthQuadrants; radiusTiers }`。

`TargetManager`([TargetManager.ts](../../src/sim/TargetManager.ts))把周邊目標的世界座標運算抽成共用 `peripheralPos(centerDistanceU, azimuthRad, radiusRad, distanceU)`——v1 的抽樣順序(azimuth → radius → distance)與輸出逐位不變。`center-peripheral-stratified` 分支改用一個 `azimuthQuadrants × radiusTiers`(v2 目前為 4×3=12)格的洗牌佇列:

- **象限分箱**:把 `peripheral.azimuthDegRange` 均分成 `azimuthQuadrants` 份(等寬)。**這是排程用的分類,邊界為 0/90/180/270 起算**,與上方「條件幾何」一節的 `SpiderQuadrant`(`horizontal`/`vertical`/`oblique`,45°-居中、8 分箱收斂 3 類的**呈現層標籤**)是兩套完全不同的分類——排程分箱只為 spawn 平衡,呈現層標籤只為報告分類,兩者刻意不對齊,避免其中一套的設計意圖被另一套稀釋。
- **距離 tier 分箱**:把 `peripheral.angularRadiusDegRange` 依**等立體角**(`cos(θ)` 線性內插;球面 cap 面積 `∝ 1-cosθ` 的正確等分公式)切成 `radiusTiers` 份。`angularRadiusDegRange` 在此變體必須 `min < max`(`schema.ts` 拒絕退化區間)——v1 的 `[15,15]` 固定值語意不適用於分層。
- **洗牌佇列**:佇列空時用 `spiderShot.seed` 的同一顆 seeded RNG(GD-5:禁 `Math.random`)建出全部格 + Fisher–Yates 洗牌;每次周邊 spawn 從佇列尾端 pop 一格,格內再均勻抽 azimuth(線性)與 radius(`cos` 空間線性抽樣後 `acos()` 還原,格內仍是等面積抽樣)。耗盡即重建 + 重洗,`reset()` 同步清空佇列。

`spider_shot_v2.ts` 目前的 `angularRadiusDegRange = [10, 25]` 是**未經 pilot 校準的候選值**(比照 v1 當年的候選值聲明方式),測試手感後可調整,不受 WP-39 凍結紀律約束(v2 是全新 drill,尚未走凍結流程)。

## `spider-shot-v2` — sphere hitbox / 60s time limit / center exempt from timeout (WP-46)

WP-46 對齊 Aim Lab Spidershot 手感,在 WP-44 交付的 stratified schedule 之上,再對幾何/時序/命中判定三個維度做調整。**只改 `spider-shot-v2`**,`spider-shot-v1` 逐位不變。

**① `shape: 'sphere'` 的命中判定與渲染同幾何來源**——GD-7 第二次修訂(`docs/exec-plan/DECISIONS.md` 正式編號延後,見下方誠實記錄):`TargetHitboxConfig`/`TargetHitboxSize`/`TargetState.hitbox` 新增 `shape?: 'box' | 'sphere'`。省略或 `'box'` 時行為逐位不變;`'sphere'` 時要求 `widthU === heightU === depthU`([schema.ts](../../src/drill/schema.ts) 拒絕不相等的三軸),`HitDetector.raycastWithRay`([HitDetector.ts](../../src/sim/HitDetector.ts))改用 `THREE.Ray.intersectSphere`(半徑 = `width/2`,球心沿用既有 subAlpha 內插座標)取代 Box3 相交;`TargetView.setShape()`([TargetView.ts](../../src/render/TargetView.ts))同步把 pool mesh 的 geometry 換成半徑相等的 `SphereGeometry`。單一來源原則不變——命中判定與視覺渲染永遠讀同一個 `TargetState.hitbox`,不新增第二套 sphere 專屬尺寸常數。

> **KI-021（2026-09-03）補齊的第三個消費者**：上述「同幾何」当時只落實到命中判定與渲染；**on-target 離線推導**（`trackingDerivation.isOnTarget()`）仍是無條件的 ray/AABB slab test，且 `hitboxFromMeta()` 把 `shape` 丟掉，於是 `spider-shot-v2` 的球在離線側被當成**外接立方體**（對角方向最多寬鬆 √2 倍）。這直接影響 `spiderShotMetrics` 的 `movementExecution.movementTimeMs` 與 `stopControl` settle/overshoot（它們以 `firstOnTarget` 為起點）。KI-021 修復後三者才真正同幾何；**pre-fix 的匯出檔其 settle/overshoot/`movementTimeMs` 係以 box 幾何算出，不可與修後資料直接合併**（見 [KI-021](../known_issue/KI-021-tracking-derivation-ignores-sphere-hitbox-shape.md) 與 wp-46 progress D-46.5）。

**② `centerExemptFromTimeout` 只影響 v2,v1 逐位不變**——`SpiderShotCenterPeripheralConfig`/`SpiderShotStratifiedConfig` 新增選填 `centerExemptFromTimeout?: boolean`。為 `true` 時,`DrillRunner.tick()` 的 `peekTimeoutMs` 迴圈跳過 `zone === 'center'` 的目標,只靠 `endCondition`/`timing.timeLimitMs` 的整場後援閘防止卡死;省略(含 `spider-shot-v1`,未設此欄位)時中心目標仍照既有 `peekTimeoutMs` 逾時規則。周邊目標不受此旗標影響,恆照常逾時。

**③ hitbox 直徑公式(視角直徑 2.0° @ 距離 8u)**——`spider_shot_v2.ts` 的 `SPIDER_SHOT_HITBOX_V2` 由具名常數推導:`SPIDER_SHOT_V2_HITBOX_DIAMETER_U = 2 × 8 × tan(2.0°/2 × π/180)`,即距離 8u 處視角直徑 2.0° 對應的球體直徑,三軸共用同一數值。2.0° 是 Aim Lab Ultimate/Standard 1.8°–2.2° 候選範圍的中點,**未經真人 pilot 校準**(比照 v1 當年 `angularRadiusDegRange` 的候選值聲明方式,測試手感後可調整)。同時整場結束條件改為單一 `endCondition: { type: 'timeLimit', value: 60000 }`(60 秒),移除冗餘的 `timing.timeLimitMs`;`targets.count: 300` 只是 spawn 安全上限,不是實際結束條件(60 秒內任何合理擊殺速率都到不了)。

## `spider-shot-wide-v1` — eye-frame 大幅度拉槍（WP-57，practice-only）

`spider-shot-wide-v1` 是與 v1／v2／v3 **同輩不同構念**的第四支排程（`kind: 'center-peripheral-yawpitch'`），
不是後繼版本：v1/v2 的參數與凍結狀態、v3 的 Assessment 地位都不因它改變。它把刺激的眼睛所見角位移
從 v2 的 ~10–25° 推到 **~40–70°**（依當次 FOV／aspect），周邊落點貼近水平 FOV 極限。
v1 交付範圍為 **researcher-only／practice**：不寫入 participant 歷史、不產生 compatibility cell、
不進 `DrillMetricRegistry`。

### 幾何：eye-frame 球面（yaw/pitch 參數化）

落點由 [`spiderWideEyePos()`](../../src/sim/spiderEyeFrame.ts) 產生，眼睛在 sim 原點正上方
`PLAYER_EYE_HEIGHT_U = 1.6`：

```text
eye = (0, 1.6, 0)
pos = eye + d × ( sin(yaw)·cos(pitch),  sin(pitch),  −cos(yaw)·cos(pitch) )
```

- `abs(pos − eye)` 對所有落點**恆等於 `d`** ⇒ 目標角徑恆定（設計值 2.0° @ `d = 8 u`，hitbox 直徑
  `2·8·tan(1°) = 0.279281 u`，sphere）。這是它與 `angularSpawnPose()` 的**圓柱**參數化
  （`y = TARGET_Y + tan(pitch)·d`，3D 距離隨 pitch 漂）刻意不同的地方。
- `yaw`／`pitch` 就是玩家的螢幕水平／垂直視角；中心目標是 `yaw = pitch = 0`，故「相對中心目標 ±p 度」
  與 `pitch ∈ [−p, p]` 完全等價，不需要偏移換算。
- 與 v1/v2 的 `peripheralPos()` 差異：後者的錐軸起點是**世界原點**而非眼睛（GD-32 已入帳）。
  wide 分支不沿用該幾何，也不回頭改 v1/v2。
- 綁定場景固定為 `wide-flick-arena`（`roomSize [18, 20, 4]`、`eyeZ: 0`、`eyeHeight 1.6`）。
  `eyeZ: 0` 是契約要求而非偏好：它讓匯出角度與刺激幾何同源，且避開 KI-012 的後牆遮擋。

### `resolvedFrom`：arm 時解析一次的 provenance

`peripheral.yawMagDegRange` **不是常數**：它由 [`resolveSpiderWideYawPitch()`](../../src/drill/spiderShotWide.ts)
在 drill **arm 時**依當下的垂直 FOV 與 camera aspect 解析一次，寫進 resolved `DrillConfig`。
越過那一點之後 `TargetManager` 對 FOV／aspect／camera／`SceneConfig` 一無所知 —— run 中 resize
或切解析度**不重解析**，spawn 序列逐位不變（GD-10）。

```text
halfHFOV = atan( tan(fovDegVertical / 2) × aspect )
r        = atan( (hitboxDiameterU / 2) / distanceU )
yawMax   = atan( (1 − screenMargin) × tan(halfHFOV) ) − r
yawMagDegRange = [ kLo × yawMax, yawMax ]
```

解析用到的五個量原樣落進 `spiderShot.resolvedFrom`：

| 欄位 | 意義 |
|---|---|
| `fovDegVertical` | 解析當時的垂直 FOV（= `meta.fovDeg`，來源 `SettingsPanel.fov`） |
| `aspect` | 解析當時的 `camera.aspect = w / h` |
| `screenMargin` | NDC 邊界安全餘裕（比例，非角度；裁切發生在 NDC 空間） |
| `kLo` | yaw 貼邊係數，窗下界 = `kLo × yawMax` |
| `targetAngularDiameterDeg` | 目標角徑設計值（2.0°），與 hitbox 直徑互為反推 |

**為什麼是刻意的冗餘**：`aspect` 在 WP-57 之前**完全不在任何匯出欄位裡**。沒有它，離線分析無法
重建 yaw 窗——同一個 FOV 75 下，4:3 解析出的 `yawMax` 是 43.485°、21:9 是 58.809°，相差 15.3°。
（同理：若未來把本 drill 晉升為 Assessment，`compatibilityKey` **必須**補 `aspect`，否則兩個實際
刺激不同的 run 會被誤判可合併。）

整塊 `spiderShot` 由 `main.ts` 原樣複製進 `meta.spawn.spiderShot`（opaque `unknown`），
`parseExportPayload()` 亦原樣 pass-through ⇒ resolved 參數只要在 resolved config 裡就自動落匯出，
不需要擴充 schema 型別。

### `side`：兩個不同的欄位，不要混用

| | `DrillEvent{type:'visible'}.side` | `SpiderShotTransition.side`（WP-57 T4 新增） |
|---|---|---|
| 產生者 | `TargetManager` spawn 時蓋章（sim 側） | `deriveSpiderShotTransitions()`（離線推導） |
| v1／v2／v3 | 恆為 `'R'` —— **純型別佔位**，不承載任何象限語意 | 由抵達點的 eye-frame `x` 符號讀出（見下方警告） |
| wide（`-yawpitch`） | 周邊 spawn 帶**真實左右**（分層佇列的 cell side）；中心目標仍為 `'R'` 佔位（正前方無左右可言） | 與 sim 側的 spawn side **逐筆相同**（由 regression 釘死） |

`SpiderShotTransition.side` 的規則：

- 只對 `direction === 'center-to-peripheral'` 輸出（回中心沒有左右可言）。
- `x > 0 → 'R'`、`x < 0 → 'L'`、**`x === 0` 省略欄位**（不猜一邊：猜了就無法在資料上分辨
  「這個落點沒有左右語意」與「這個落點在右邊」）。
- 它**不是**第二套幾何（C-D4）：讀的就是 `angularDistanceDeg`／`angularSizeDeg` 已經在用的同一個
  eye-frame 座標，只是取符號。之所以需要它，是因為 `quadrant` 對 wide drill 恆回 `'horizontal'`
  （T0 實測 80/80，距最近的 45° 分箱邊界仍有 24.37° 餘裕）—— 標籤正確但無辨別力，左右資訊只能由
  `side` 承載。

> ⚠️ **v1/v2 的 `side` 只是型別佔位，且近垂直呈現的符號可能是浮點殘值。** sim 側寫入的 `'R'` 不帶
> 語意（見上表）；離線推導出的 `side` 雖然讀的是真座標，但當 v1/v2 的候選點落在「正上／正下」時，
> `x` 可能是 `sin(180°) = 1.22e-16` 這種殘值而非 `0`，於是輸出一個幾何上無意義的 `'R'`。
> 這是刻意不加閾值的後果（加閾值等於為 `side` 發明第二套幾何容差）。**判讀 v1/v2 資料時，
> 請先以 `quadrant` 篩掉 `vertical` 呈現再看 `side`**；wide drill 不受此影響（yaw 幅度恆 ≥ 40°）。

### 不變的東西（本變體沒有動的契約）

- `D_deg`／`W_deg` 的公式、`quadrant` 的 45° 分箱門檻、`targetConditionCell` 的格式
  `spider:d=<6 位小數>;w=<6 位小數>` **全部不變**。
- `targetConditionCell` **不含 pitch、不含 side**：pitch 是干擾項（分層只為平衡），side 是條件變因
  但由獨立欄位承載，塞進 cell 會改動既有相容鍵語意。
- `spiderShotMetrics.ts` 的五類構念零修改 —— 它們本來就走 `resolveEyeOrigin()`／
  `angularEccentricityDeg()`（已是 eye-frame），與本 drill 的新幾何同源。
- eye-frame 修正（KI-026／BD-026／GD-32 ④）之後，wide drill 的匯出 `W_deg` 就是設計值本身
  （2.0°，`worldDistanceU` 恆為 8 u），不再有 origin-frame 漂移。

### `counts/360` 與 `cm/360`（離線推導，不新增輸入欄位）

大幅度拉槍會壓到低感度選手的滑鼠墊行程：單邊 yaw 約 50° 時，中心↔周邊來回接近 100° 峰對峰。
若不把每個 run 的實體行程算出來，感度會以「被迫抬滑鼠重新定位」的形式偷渡成混淆因子。

[`deriveMouseThrow(payload)`](../../src/metrics/mouseThrow.ts) 由既有欄位推導，**不新增任何輸入**：

```text
countsPer360 = 2π ÷ hipStep          // hipStep 來自 resolveMouseGain()，C-D4：不重寫 gain 公式
cmPer360     = countsPer360 ÷ dpi × 2.54
adsCountsPer360 = 2π ÷ adsStep       // adsStep = hipStep × sensitivityRatio × (ads.fovDeg / meta.fovDeg)
```

- `meta.dpi` 是 self-reported（瀏覽器讀不到外部硬體設定）。**缺席時 `cmPer360` 回 `undefined`
  而非猜一個 DPI**；`countsPer360` 不需要 DPI，仍然成立。
- `meta.fovDeg` 缺席時 ADS 感度鏈不可稽核（見 `metadata.ts` 的 `fovDeg` 註解），
  `adsCountsPer360`／`adsCmPer360` 一併回 `undefined`。
- 這是**資料品質標註**的輸入，不是構念：它與抬滑鼠疑慮旗標（T5）一樣，不得進教練報告（C-D3）。

### 投影形狀：周邊目標在畫面上是**橢圓**，不是圓（WP-57，OQ-57.8）

`W_deg`（角徑）恆為設計值 2.0° —— 球在虛擬眼睛處張的就是一個圓錐，這一點沒有問題。但**把那個圓錐
投影到一塊平面螢幕**之後，離軸的球是一個橢圓（切線錐與像平面的交線），而且：

```text
軸比      ≈ 1 / cos θ            其中 cos θ = cos(yaw) · cos(pitch)
螢幕足跡  ∝ 1 / cos³θ
```

以 `spider-shot-wide-v1` 的實錄參數（FOV 75、aspect 2.0031、yaw 窗 50.48–54.87°、pitch ±6.5°）：

| | 軸比 | 足跡 vs 中心目標 | 窗內足跡變異 |
|---|---|---|---|
| FOV 60 | 1.37 – 1.48 | 3.2× | 1.24× |
| **FOV 75（實錄）** | **1.57 – 1.75** | **5.4×** | **1.38×** |
| FOV 90 | 1.82 – 2.11 | 9.4× | 1.57× |
| FOV 120 | 2.51 – 3.31 | 36.4× | 2.30× |

**判讀時要緊的是最後一欄**：足跡隨 yaw 單調變化 ⇒ **與 `D_deg` 共變**。所以
`switchReaction`（`tDetectMs`／`reactionMs`）上看到的「偏心度越大反應越慢」，可能有一部分其實是
「目標越大越長越好偵測」在反向抵銷。要分離就必須把 θ 或足跡當共變量放進模型 —— **重建它所需的量
匯出裡已全有**（目標座標、`meta.scene.eye`、`spiderShot.resolvedFrom.fovDegVertical` 與 `.aspect`），
不需要任何新欄位。

**不受影響的部分**：命中判定走世界空間 ray–sphere（GD-7）—— **要打中的是角度上的正圓**，與畫面上的
橢圓無關；`firstShot`／`stopControl` 也幾乎不受影響，因為開火那一刻目標已被轉到準心上（θ≈0）、渲染
成正圓，橢圓只存在於拉槍**之前**的偵測階段。橢圓形心相對投影球心外移僅為長軸的 1.7–4.9%。

> 這不是渲染缺陷 —— 直線透視必然如此（廣角照片邊緣的人頭同理），也是高 FOV 下 FPS 的生態真實。
> 處置選項與駁回理由見 WP-57 README §1.6 OQ-57.8。

### 抬滑鼠疑慮旗標（`deriveRepositioningSuspicion()`，WP-57 T5）

**這是資料品質標註，不是構念（C-D3）。** 被迫抬滑鼠重新定位是**完全不同的運動行為**（中斷 + 重置），
會在 `movementTimeMs`／`overshootDeg` 產生大離群值，且系統性與感度相關；標註它的目的是讓分析者能
**剔除或分層**這些 trial，不是拿它當一個表現指標。

[`deriveRepositioningSuspicion(payload, options)`](../../src/metrics/spiderShotRepositioning.ts)
對每個 `zone: 'peripheral'` 抵達回一筆 `{ targetId, suspected, stallStartMs?, stallDurationMs? }`。

- **偵測窗**：canonical movement onset（`deriveDetectionMetrics().tDetectMs`）→ canonical 首次
  on-target（`deriveTrackingSamples()` 的第一個 `onTarget` 樣本）。這**正是 `movementTimeMs` 的同一對
  邊界**，所以旗標標的是那段區間內部發生的事，不是另開一個窗（C-D4）。
- **判準**：窗內存在連續 ≥ `stallMinMs` 且 `abs(omega) < stallOmegaDegPerSec` 的區段。`omega` 一律走
  `omegaDegPerSec()`（KI-005 A1 後的事件時間戳積分），本模組不自算角速度。
- **窗界任一端缺席**（detection timeout／acquisition failure）→ `suspected: false` 且不帶欄位。
  那是「**無從判定**」，不是「已判定沒有抬滑鼠」；要區分請對照 canonical derivations 的
  `status`／`acquisitionFailure`。
- `stallDurationMs` 取首、末兩個合格 ω 樣本的時間差，故比真實停滯**短最多一個 tick 間隔**（保守側）。
  兩個時間欄位**只在 `suspected` 時出現** —— 未達門檻的次長停滯不回報，避免它們被當成連續量使用。

> ⚠️ **門檻未凍結（OQ-57.5），呼叫端必須自己傳。** 2026-09-08 以四份真人 run（含「全程不抬滑鼠」／
> 「每次都抬滑鼠」／「刻意短停頓」三個 ground-truth 條件）校準後交付
> **`stallMinMs = 150`／`stallOmegaDegPerSec = 2`** —— 靈敏度 78%、偽陽 3%、baseline 0%、
> 刻意停頓 17%。要高靈敏度可用 `120 / 2`（91%，但刻意停頓誤標升到 29%）。詳表見 WP-57 progress §T5-real。
>
> ⚠️ **兩個先前的說法已被真人資料推翻，不要沿用**：① 早期合成期交付的 `100 / 15` 會標掉 44% 的
> 「全程不抬滑鼠」run 與 32% 的 baseline（寬鬆 ω 抓到的是拉槍中途的正常減速）；② 「分離兩者的是 **ω 軸**」
> 也錯了 —— 真人資料上四個 run 的最小 `|ω|` **全部是 0.0**，分離軸其實是 **duration @ 緊 ω 門檻**。
>
> ⚠️ **兩個前提條件**：`ω = 2 deg/s` 這個緊門檻條件於錄製機器的取樣特性，換硬體須複驗；且在真人資料上
> `deriveDetectionMetrics()` 必須以 `sustainedTicks: 1` 呼叫才有偵測窗
> （[KI-031](../known_issue/KI-031-detection-sustained-ticks-dies-when-aim-updates-slower-than-sim.md)，
> 預設 `4` 在 aim 更新率低於 sim 率的機器上 detected = 0/113），該 KI 修好後本節數字須重跑。

> ⚠️ **它與刻意停頓在觀測上不可完全分離。** 這是近似，不是判定 —— 所以型別叫 `Suspicion`，而且本模組
> **不被 `src/` 內任何檔案 import**（由 boundary 測試釘死零 importer，`vite build` 產物亦不含它）。

## Verified test evidence

- 排程機制（單目標存在、seed 決定性、四象限+兩斜向世界座標）：[TargetManager.test.ts:578-](../../src/sim/TargetManager.test.ts)「WP-36 spider-shot center/peripheral schedule」。
- Legacy seeded-spawn 互斥驗證：[schema.test.ts:298-](../../src/drill/schema.test.ts)「spiderShot validates its geometry and rejects legacy seeded-spawn settings」。
- 條件幾何（D_deg/W_deg/象限/hitbox 單一來源）：[spiderShotConditions.test.ts](../../src/metrics/spiderShotConditions.test.ts)。
- 五類指標端到端組裝：[spiderShotMetrics.test.ts](../../src/metrics/spiderShotMetrics.test.ts)「assembles the five metrics for peripheral arrivals and keeps center returns in rhythm only」。
- `spider-shot-v1` drill config：[spider_shot_v1.test.ts](../../src/drill/spider_shot_v1.test.ts)。
- `spider-shot-v2` 排程機制（單目標存在+交替、reset 後決定性重放+換 seed 改變序列、12 格耗盡前不重複+重洗後再次覆蓋、世界距離落在宣告值）：[TargetManager.test.ts](../../src/sim/TargetManager.test.ts)「WP-44 spider-shot stratified 12-cell peripheral schedule」。
- `spider-shot-v2` drill config（含與 v1 seed 互斥、v1 逐位不變回歸;WP-46 sphere 幾何/60 秒時限/spawn 上限合約)：[spider_shot_v2.test.ts](../../src/drill/spider_shot_v2.test.ts)。
- sphere ray-intersection(球心命中、外接方塊角落內但球外 miss、球體邊緣內側 hit、box 分支對照組):[HitDetector.test.ts](../../src/sim/HitDetector.test.ts)。
- `TargetView.setShape()`(sphere geometry 型別、既有 pool mesh identity 不變但 geometry 換新、同形狀重複呼叫不重複 dispose):[TargetView.test.ts](../../src/render/TargetView.test.ts)。
- `centerExemptFromTimeout`(center 不逾時、peripheral 仍逾時、v1 省略旗標時 center 仍逾時、兩種 spiderShot schema 形狀欄位保真):[DrillRunner.test.ts](../../src/drill/DrillRunner.test.ts)、[schema.test.ts](../../src/drill/schema.test.ts)。
- `spider-shot-wide-v1` eye-frame 幾何／resolver／arena 淨空：[spiderEyeFrame.test.ts](../../src/sim/spiderEyeFrame.test.ts)、[spiderShotWide.test.ts](../../src/drill/spiderShotWide.test.ts)、[spider-wide-geometry.test.ts](../../tests/regression/spider-wide-geometry.test.ts)、[spider-wide-arena-geometry.test.ts](../../tests/regression/spider-wide-arena-geometry.test.ts)。
- `spider-shot-wide-v1` 分層佇列／四 FPS 決定性／aspect 不變性：[spider-wide-spawn-determinism.test.ts](../../tests/regression/spider-wide-spawn-determinism.test.ts)、[spider-wide-schedule-invariants.test.ts](../../tests/regression/spider-wide-schedule-invariants.test.ts)。
- 匯出 round-trip（`resolvedFrom` 五欄逐位還原、由匯出欄位重算 yaw 窗、hitbox 單一來源與 `W_deg` 對回 2.0°、離線 `side` 與 sim 端 spawn side 逐筆相同、condition cell 不含 pitch/side）：[spider-wide-export-roundtrip.test.ts](../../tests/regression/spider-wide-export-roundtrip.test.ts)。
- `side` 的正負向（右／左／`x === 0` 省略、只對 center-to-peripheral 輸出、對移動中的眼睛取符號、v1/v2 fixture 七欄位逐位不變）：[spiderShotConditions.test.ts](../../src/metrics/spiderShotConditions.test.ts)。
- `counts/360`／`cm/360` 離線推導（手算閉式對帳、DPI 缺席回 `undefined`、ADS gain 分支）：[mouseThrow.test.ts](../../src/metrics/mouseThrow.test.ts)。
- 抬滑鼠疑慮旗標（五類合成訊號分類、兩段停滯取較長、窗界缺席回 `false`、typed error、C-D4「無第二套 ω／窗界」與 C-D3「`src/` 內零 importer」boundary scan、門檻敏感度網格與 `cm/360` 方向性）：[spiderShotRepositioning.test.ts](../../src/metrics/spiderShotRepositioning.test.ts)。
