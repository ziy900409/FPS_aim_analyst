# Analysis Spider Shot Contract

`spider-shot-v1` 是 Assessment 的中心—周邊目標切換協定（FR-F8/FR-F9,WP-36)。場上同時只保留一個可命中目標；目標命中後依 `spiderShot` 排程在中心與周邊間交替。排程由 `spiderShot.seed` 決定，並完整回顯到 `meta.spawn.spiderShot`；既有 `sequence.alternation` 在此分支只保留型別相容位置，不承載 Spider Shot 語意。

## Relationship to legacy L/R alternation and `SpawnAreaConfig`（避免誤用）

Spider Shot 是與既有排程機制**互斥**且**幾何不同**的獨立分支，讀者不應假設兩者可以混用或互相取代：

| | 既有 L/R 交替 + `SpawnAreaConfig`（WP-4/WP-21） | Spider Shot（WP-36） |
|---|---|---|
| 排程原語 | `sequence.alternation: 'LR' \| 'RL'`,二元交替,`TargetManager.markKilled()` 的 `nextSide` 布林翻轉 | `DrillConfig.spiderShot?: SpiderShotScheduleConfig`(top-level additive),`kind: 'center-peripheral'`,獨立 `nextSpiderZone: 'center' \| 'peripheral'` 狀態,`TargetManager` 完全獨立分支(不讀寫 `nextSide`) |
| 幾何模型 | 一維水平 yaw(`SpawnAreaConfig.yawDegRange`/`distanceURange`),固定 `TARGET_Y`,無狀態獨立抽樣 | 繞「中心目標視線」的二維球面極角(`azimuthDegRange` 方位角 + `angularRadiusDegRange` 徑向角距),`y` 分量隨方位角變化,見下方公式 |
| RNG 權威 | `sequence.seed`(配合 `spawnArea`/`spawnDelayMsRange`) | `spiderShot.seed`,唯一 RNG source |
| 互斥規則 | — | `schema.ts` 的 `validateSpiderShotSchedule` 在 `spiderShot` 存在時拒絕 `targets.spawnArea`、`sequence.spawnDelayMsRange`、`sequence.seed` 同時出現,避免雙重排程/seed 權威([schema.ts:59-62](../../src/drill/schema.ts)) |
| `side`/`zone` 欄位 | `DrillEvent{type:'visible'}.side: 'L' \| 'R'` 承載真實左右語意 | `side` 恆為 `'R'`(佔位,不承載象限語意);新增 `zone?: 'center' \| 'peripheral'` 才是 Spider Shot 的真實排程狀態 |

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

`zone` 是 additive 欄位([DataRecorder.ts](../../src/data/DataRecorder.ts))，省略時（既有 drill）行為零回溯相容成本；`side` 在 Spider Shot 分支恆為 `'R'`，僅維持既有型別相容位置。排程 config 本身以不透明形式回顯到 `Meta.spawn.spiderShot?: unknown`（[metadata.ts](../../src/data/metadata.ts)，比照既有 `spawnArea` 慣例，WP-33 不解析）。

離線 `deriveSpiderShotTransitions(payload)`([spiderShotConditions.ts](../../src/metrics/spiderShotConditions.ts))依時間排序相鄰的 `visible` 事件，以 `zone` 重建 transition：

- `center → peripheral` 是 `center-to-peripheral`。
- `peripheral → center` 是 `peripheral-to-center`。

兩種 transition 都輸出，讓 T3 的節奏統計保有完整序列；只有抵達周邊的 `center-to-peripheral` transition 具有象限標籤。遺漏座標、`zone`、GD-7 hitbox 或 spawn seed 的匯出會明確拋錯，避免無法溯源的條件格混入 Assessment 歷史。

## Condition geometry

`D_deg` 是前一目標與抵達目標、均由玩家原點指向目標中心的兩個方向向量之無號球面夾角。其實作共用 `angularDistanceDeg()`；`angularEccentricityDeg()` 亦使用同一函式，因此沒有第二套夾角公式。

`W_deg` 是抵達目標的角寬：

```text
W_deg = 2 × atan((hitbox.width / 2) / worldDistanceU) × 180 / π
```

`hitbox` 僅來自 `meta.targets.hitbox`（GD-7 單一來源），`worldDistanceU` 為玩家原點到抵達目標中心的距離。輸出同時保留三維 hitbox、距離與 `meta.spawn.seed`，使條件可獨立審核。

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

## Verified test evidence

- 排程機制（單目標存在、seed 決定性、四象限+兩斜向世界座標）：[TargetManager.test.ts:578-](../../src/sim/TargetManager.test.ts)「WP-36 spider-shot center/peripheral schedule」。
- Legacy seeded-spawn 互斥驗證：[schema.test.ts:298-](../../src/drill/schema.test.ts)「spiderShot validates its geometry and rejects legacy seeded-spawn settings」。
- 條件幾何（D_deg/W_deg/象限/hitbox 單一來源）：[spiderShotConditions.test.ts](../../src/metrics/spiderShotConditions.test.ts)。
- 五類指標端到端組裝：[spiderShotMetrics.test.ts](../../src/metrics/spiderShotMetrics.test.ts)「assembles the five metrics for peripheral arrivals and keeps center returns in rhythm only」。
- `spider-shot-v1` drill config：[spider_shot_v1.test.ts](../../src/drill/spider_shot_v1.test.ts)。
- `spider-shot-v2` 排程機制（單目標存在+交替、reset 後決定性重放+換 seed 改變序列、12 格耗盡前不重複+重洗後再次覆蓋、世界距離落在宣告值）：[TargetManager.test.ts](../../src/sim/TargetManager.test.ts)「WP-44 spider-shot stratified 12-cell peripheral schedule」。
- `spider-shot-v2` drill config（含與 v1 seed 互斥、v1 逐位不變回歸）：[spider_shot_v2.test.ts](../../src/drill/spider_shot_v2.test.ts)。
