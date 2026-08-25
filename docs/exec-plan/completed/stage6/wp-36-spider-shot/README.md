# WP-36 — spider-shot:單目標中心—周邊 seeded 排程 + 切換/移動/停止/首發/節奏五類指標

> stage6 執行計畫的 WP 子資料夾。上層 spec:[../README.md](../README.md) · 需求 source of truth:[../aim-assessment-framework-v1.md](../aim-assessment-framework-v1.md) · 決議依據:**GD-22**(stage6 採納)+ 本 WP T0 讀碼拍板(D-36.1/D-36.2)。
> Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **目標** | 交付 FR-F8(`spider-shot-v1`:同時最多一個可命中目標;命中中心後下一目標依 seeded polar schedule 出現在周邊;命中周邊後固定回中心;Assessment 使用固定 `D_deg × W_deg` 條件格版本)+ FR-F9(切換反應/移動執行/停止控制/首發/節奏五類指標) |
| **里程碑** | 無獨立里程碑;是 WP-38(診斷推薦)entry 條件之一(需四個測試家族 WP 皆 T-exit) |
| **相依** | **WP-33 T-exit ✅**(共同契約:Assessment/Practice 模式、metadata、事件時間線、`CompatibilityKey`/`checkQualityGate`);與 WP-34/35/37 並行,無檔案熱區重疊([../README.md §5](../README.md)) |
| **對應 FR** | FR-F8(`spider-shot-v1`)+ FR-F9(五類指標) |
| **估時** | 2.5–3.5 dev-days([../README.md §6](../README.md));讀碼發現「單目標存在」約束已由既有 `TargetManager.tick()` spawn 閘天然滿足、`buildPeekWindows`/`deriveDetectionMetrics`/`omegaDegPerSec` 可覆蓋五類指標中三類的骨架,但「中心—周邊」排程需要一個既有 `SpawnAreaConfig`(僅水平 yaw)沒有的**二維極角幾何**(繞中心視線的方位角 + 徑向角距),且「停止控制」的 overshoot/逸出量尚未確認 `trackingDerivation.ts` 是否已產出——估時傾向落在上緣,由 T0/T3 讀碼結果收斂 |
| **狀態** | ✅ 完成(T0~T-exit 全數完成,2026-08-24;`analysis-spider-shot.md` 定稿,開放 WP-38 entry 其中一個條件——尚需 WP-37 一併 T-exit) |

---

## 0. 讀碼對帳(規劃階段,2026-08-19;決定本 WP 淨新增工作量)

> 動筆前對 `src/drill/DrillConfig.ts`、`src/drill/schema.ts`、`src/sim/TargetManager.ts`、`src/state/types.ts`、`src/data/DataRecorder.ts`、`src/data/metadata.ts`、`src/metrics/peekWindows.ts`、`src/metrics/detectionDerivation.ts`、`src/metrics/angularKinematics.ts`、`src/metrics/eyeOrigin.ts`、`src/metrics/compatibilityKey.ts` 的讀碼結果。目的與 WP-32 §0.1、WP-33 §0、WP-35 §0 同:找出框架 v1 假設為新能力的項目裡,有多少是既有構念的延伸,避免虛報工作量或漏看真正的缺口。

| # | 框架 v1 / stage6 README 假設 | 讀碼發現 | 對本 WP 的影響 |
|---|---|---|---|
| **0-1** | 「場上同時最多一個可命中目標」是待新增的約束 | [`TargetManager.tick()`](../../../../../src/sim/TargetManager.ts) 第①步 `if (!hasAliveTarget(state) && spawnedCount < spawnLimit)` 對**所有既有 drill**已經是「無存活目標才補生」——這是全域不變式,不是 counter-strafe 專屬行為。Spider Shot 只要不額外注入 `persistent`/多目標 motion,就自動滿足此約束 | **零新增工程量**。T1 DoD 只需一條斷言測試證明既有閘涵蓋 spider-shot-v1(而非新寫一套互斥檢查),避免重複造輪子 |
| **0-2** | 「複用 WP-21 的 seeded polar spawn 骨架」隱含 `targets.spawnArea` 可直接套用 | [`SpawnAreaConfig`](../../../../../src/drill/DrillConfig.ts)(`yawDegRange`/`distanceURange`)與 `TargetManager.sampleSpawnPose()` 只做**單一水平面極座標**取樣(繞玩家原點的水平偏心角,`TARGET_Y` 固定常數),且是「每次 spawn 獨立抽樣」的無狀態產生器,**沒有**「固定回中心」的排程狀態。框架要求的象限標記含「水平、垂直或斜向」,意味周邊位置需要**繞中心視線的二維方位角**(水平 + 垂直),`SpawnAreaConfig` 的一維 yaw 模型覆蓋不到 | **這是本 WP 唯一的淨新增幾何能力**:需要新的極座標模型——以「中心目標視線」為軸,取樣(方位角 `azimuthDeg` 決定象限、徑向角距 `angularRadiusDeg` = `D_deg`、世界距離)再換算世界座標,而非重用 `SpawnAreaConfig`/`sampleSpawnPose` 的一維模型。仍**複用** `createRan1`/`randomFloat`(RNG 原語本身,不改)與「`config.sequence.seed` → seeded 分支」的既有慣例([WP-21 T1](../../../../completed/stage3/wp-21-detection-drill/T1-seeded-spawn.md)先例) |
| **0-3** | Spider Shot 的排程可視為既有 `sequence.alternation`(L/R 交替)的變形 | `alternation: 'LR' \| 'RL'` 與 `TargetManager` 的 `nextSide` 布林翻轉是二元語意,`TargetState.side`/`DrillEvent{type:'visible'}.side` 型別也硬編為 `'L' \| 'R'`——三處都假設「恰好兩側」。Spider Shot 是「中心 ⇄ 周邊(任意方位角)」,語意上不是二元交替 | 承 [../README.md §2.3(c)](../README.md)(C-D4 精神延伸):**不得**修改 `alternation` 的型別或語意去容納第三態。方案:新增獨立的 top-level additive 欄位 `DrillConfig.spiderShot?`(與 `targets`/`sequence`/`timing` 同層),存在時 `TargetManager` 進入**完全獨立的排程分支**(不讀 `nextSide`/`alternation`);`sequence.alternation` 型別維持必填不變(現有型別系統零改動),值在 spider-shot drill 中僅為佔位、不被讀取——比照 WP-35 §2.3(b)「新語意用新欄位,不疊加進舊欄位」的先例 |
| **0-4** | 「每次 transition 保存方向/象限/角距/角尺寸/hitbox/世界距離/seed」是待新增的記錄機制 | `DrillEvent{type:'visible'}` 現況只有 `targetId`/`side`/`t`/`targetX,Y,Z?`;沒有「這次 spawn 是中心還是周邊」的旗標。`Meta.spawn`([`metadata.ts`](../../../../../src/data/metadata.ts))已有 `seed`/`spawnArea?: unknown`/`spawnDelayMsRange?: unknown` 的**不透明回顯**欄位(WP-21/WP-18 先例:只回顯 config 供溯源,不解析) | 新增 `DrillEvent.visible.zone?: 'center' \| 'peripheral'`(additive,比照既有 `side` 慣例,由 `TargetManager` 在 spawn 時蓋章);`D_deg`/`W_deg`/象限/世界距離/hitbox 皆可在 metrics 層**離線**由連續兩個 `visible` 事件的座標 + `meta.targets.hitbox` 重新推導,不需要額外即時記錄。`spiderShot` config 比照既有 `spawnArea` 慣例,回顯進 `Meta.spawn.spiderShot?: unknown`(不透明,WP-33 不解析) |
| **0-5** | 五類指標(切換反應/移動執行/停止控制/首發/節奏)是待新增的推導邏輯 | 逐項核對既有函式覆蓋面:① 切換反應(視覺—動作代理值)——[`deriveDetectionMetrics`](../../../../../src/metrics/detectionDerivation.ts) 本就是「`visible` → 持續動作反應 `t_detect`」的通用推導,不綁定 counter-strafe 語意,**可直接複用**;② 移動執行(movement time/峰值角速度)——[`omegaDegPerSec`](../../../../../src/metrics/angularKinematics.ts)(WP-32 已晉升 `tick-integral` ω(t))可在 `buildPeekWindows` 給的 `tickRange` 內取峰值,**可直接複用**;④ 首發(命中/角度偏差)——[`buildPeekWindows`](../../../../../src/metrics/peekWindows.ts) 已按 `visible` 事件分窗,`firstFire`/`outcome`/`tFirstShot` 現成,角度偏差複用 `angularEccentricityDeg`;⑤ 節奏(transition interval 分布)——連續 `visible.t` 差值,無既有函式衝突,單純新加總。③ 停止控制(overshoot/逸出/微調次數)——`trackingDerivation.ts` 目前只產出 on-target 布林序列與聚合統計(TOT%/RMS/percentile),**未確認**是否已有「進靶後又逸出的角度量」或「微調次數」的量化;若無,需要一個新的小型消費函式(比照 WP-35 `deriveTrackingTransitions` 的加法擴充模式) | ①②④⑤四類是**協定組裝 + 複用**,不是新幾何;③需要 T3 先 grep 確認 `trackingDerivation.ts`/`TrackingSample[]` 的既有輸出是否夠用,若不夠則新增一個消費既有樣本的加法擴充函式(不碰既有幾何,C-D4) |

**結論**:FR-F8 的核心「新能力」只有 0-2(繞中心視線的二維極座標周邊排程),其餘(單目標約束、事件記錄、四類指標)皆為既有機制的複用或加法擴充。這個收斂決定了 T1/T2/T3 的切法(見 §4),記入 Decision Log D-36.1(T0 執行時定案)。

---

## 1. 需求對應

| FR | 內容 | 落點 |
|---|---|---|
| FR-F8 | `spider-shot-v1`:同時最多一個可命中目標(既有約束天然滿足,§0-1)+ 命中中心後下一目標依 seeded polar schedule 出現在周邊、命中周邊後固定回中心 + Assessment 固定 `D_deg × W_deg` 條件格版本 | T1(排程引擎) |
| FR-F9 | 五類指標:切換反應、移動執行、停止控制、首發、節奏 | T2(條件格/transition 記錄)+ T3(指標) |

### 1.1 範圍

**In scope**:

```
src/drill/DrillConfig.ts                  ← MODIFY 新增 top-level additive `spiderShot?: SpiderShotScheduleConfig`  [T1]
src/drill/schema.ts                       ← MODIFY validateSpiderShotSchedule(additive,不動既有 sequence 驗證)     [T1]
src/data/DataRecorder.ts                  ← MODIFY DrillEvent{type:'visible'} additive `zone?: 'center'|'peripheral'` [T1]
src/data/metadata.ts                      ← MODIFY SpawnMeta additive `spiderShot?: unknown`(比照既有 spawnArea)   [T1]
src/sim/TargetManager.ts                  ← MODIFY 新增 center-peripheral 排程分支(additive,不改既有 nextSide 路徑) [T1]
src/drill/spider_shot_v1.ts               ← ADD spider-shot-v1 drill config(比照既有 *_v1.ts drill 形狀)          [T2]
src/metrics/spiderShotConditions.ts       ← ADD D_deg/W_deg/象限/targetConditionCell 推導(消費既有 visible 事件)   [T2]
src/metrics/spiderShotMetrics.ts          ← ADD 五類指標組裝(複用 detectionDerivation/angularKinematics/peekWindows/trackingDerivation,C-D4) [T3]
docs/operational/analysis-spider-shot.md  ← ADD 契約文件(排程語意/象限定義/五類指標公式/targetConditionCell 格式) [T1/T2/T3/T-exit]
```

**Out of scope**(附觸發條件):

- **`hold-click-v1`/`hold-track-v1` 的可見度/fire-gating 機制**——WP-34/35,無檔案熱區重疊,Spider Shot 不需要遮蔽物或鎖 fire。
- **急停測試**——WP-37,無重疊。
- **診斷規則對五類指標的解讀**——WP-38,本 WP 只交付指標數值本身。
- **Practice 模式的自適應角距/尺寸**——框架 v1 明文列為 Practice 延伸,v1 只需 config 層級可調;觸發 = 教練工作流明確要求自動調參。
- **`D_deg`/`W_deg` 的凍結數值**——WP-39 pilot 待決(OQ-S6-4),本 WP 只交付「可配置 + 可記錄」的機制,不凍結範圍。
- **中心目標本身的切換反應/停止控制指標**——五類指標的構念定義以「進入周邊目標」為量測對象(框架 v1 §"Spider Shot"僅描述 center→peripheral 與 peripheral→center 的 transition,不對「回中心」本身重複量測反應/停止);回中心的 transition 只計入節奏分布,細節由 T2/T3 拍板並記錄理由。

---

## 2. 關鍵契約(T0 已凍結;詳見 progress.md D-36.1/D-36.2)

### ① 排程落點:top-level additive `DrillConfig.spiderShot`,`TargetManager` 獨立分支(承 §0-3)

```ts
// src/drill/DrillConfig.ts                                                     [T1,additive]
export interface SpiderPeripheralConfig {
  /** 徑向角距取樣範圍(deg)—— 即 D_deg 候選值,與中心視線的夾角。 */
  angularRadiusDegRange: [number, number];
  /** 繞中心視線的方位角取樣範圍(deg;0=正上,90=右,180=正下,270=左)—— 決定象限標記。 */
  azimuthDegRange: [number, number];
  /** 周邊目標與玩家的世界距離範圍(u,source unit)。 */
  distanceURange: [number, number];
}

export interface SpiderShotScheduleConfig {
  /** 排程原語 discriminant;為未來排程變體(如多層級 D_deg)留擴充空間。 */
  kind: 'center-peripheral';
  /** seeded RNG;驅動周邊方位角/角距/世界距離取樣,同 seed 同序列(決定性,ADR-2)。 */
  seed: number;
  /** 中心目標與玩家前方距離(u)。 */
  centerDistanceU: number;
  peripheral: SpiderPeripheralConfig;
}

export interface DrillConfig {
  // …既有欄位不變
  /** Spider Shot 專屬排程原語(WP-36,FR-F8)。省略 = 既有 L/R 交替語意不變。
   *  存在時 TargetManager 進入獨立分支,`sequence.alternation` 型別仍必填(相容既有型別系統)
   *  但值不被讀取——新語意用新欄位,不疊加進舊欄位(C-D4 精神延伸)。 */
  spiderShot?: SpiderShotScheduleConfig;
}
```

`TargetManager` 內部以 `config?.spiderShot !== undefined` 判斷進入獨立排程分支:內部狀態 `zone: 'center' | 'peripheral'`(初始 `'center'`)取代該分支的 `nextSide` 邏輯;`markKilled` 時翻轉 `zone`,翻入 `'peripheral'` 時以 `createRan1(seed)` 建的 stream 依序取樣 `(azimuthDeg, angularRadiusDeg, distanceU)` 並換算世界座標(繞中心視線的球面偏移,`y` 分量隨方位角變化,非既有 `TARGET_Y` 常數水平模型);翻入 `'center'` 時位置固定為 `centerDistanceU` 正前方。既有 `nextSide`/`alternation` 分支**零改動**,兩分支由 config 存在與否互斥選擇。`spiderShot.seed` 是此分支唯一 RNG source；T1 schema 將拒絕與 `targets.spawnArea`、`sequence.spawnDelayMsRange` 或 `sequence.seed` 併用，避免雙重排程／seed 權威。

### ② `visible` 事件與 `Meta.spawn` 的 additive 回顯(承 §0-4)

```ts
// src/data/DataRecorder.ts                                                     [T1,additive]
| {
    type: 'visible';
    targetId: string;
    side: 'L' | 'R';       // 既有欄位不變;spider-shot 模式下語意退化為佔位(恆定值),不表達左右
    t: number;
    targetX?: number; targetY?: number; targetZ?: number;
    /** Spider Shot 專屬:本次 spawn 是中心還是周邊目標(WP-36)。省略 = 既有 drill 零回溯相容成本。 */
    zone?: 'center' | 'peripheral';
  }
  | …

// src/data/metadata.ts                                                        [T1,additive]
export interface SpawnMeta {
  seed: number;
  motion?: unknown;
  spawnArea?: unknown;
  spawnDelayMsRange?: unknown;
  presentationMs?: number;
  /** Spider Shot 排程 config 的不透明回顯(比照既有 spawnArea 慣例);WP-33 不解析內容。 */
  spiderShot?: unknown;
}
```

`D_deg`/`W_deg`/象限/世界距離不即時記錄,由 T2 在 metrics 層對連續兩個 `visible` 事件的座標 + `meta.targets.hitbox`(GD-7 單一來源)離線重建——比照 WP-34 的可見度訊號「即時只記錄錨點,連續量交給離線層重建」設計原則([../README.md §2.3(a) 候選③](../README.md))。

### ③ `D_deg` 計算複用既有夾角公式,不另立第二套(C-4 延伸)

[`angularEccentricityDeg`](../../../../../src/metrics/eyeOrigin.ts)計算的是「aim ray 與 target center 的夾角」,數學上是兩個方向向量的球面夾角(dot product + acos)。`D_deg`(前一目標方向與當前目標方向的夾角)是同一個幾何運算,只是把「aim 方向」換成「玩家原點 → 前一目標」的方向向量。T2 直接重用該夾角公式(以合成的方向向量取代 `tick.aim` 推出的 `aim` 向量),**不另寫第二套球面夾角計算**——若既有函式簽名不便直接餵入合成向量,允許從 `eyeOrigin.ts` 抽出「兩方向向量夾角」的內部輔助函式供兩處呼叫(抽出屬結構重構,零語意變更,判準同 WP-32 T3/T4 的「抽出 ≠ 改寫」)。

### ④ `W_deg` 為新的小型公式,來源仍是 GD-7 單一 hitbox

`W_deg = 2 · atan((hitbox 半寬 u) / (世界距離 u)) · (180/π)`,`hitbox` 一律取 [`resolveTargetHitbox`](../../../../../src/drill/DrillConfig.ts)/`meta.targets.hitbox`(GD-7),不新增第二套尺寸常數。此為 T2 唯一真正意義上的「新公式」,但輸入完全來自既有單一來源。

### ⑤ 象限標記由方位角分箱,非新增座標系

`azimuthDeg`(取樣值,經 `zone: 'peripheral'` 的 `visible` 事件座標可離線還原)以 45° 為界分箱為 `'horizontal' | 'vertical' | 'oblique'`(貼近 0/90/180/270 為 horizontal/vertical,其餘為 oblique),對齊框架 v1 「水平、垂直或斜向象限」原文用語。

---

## 3. Failure modes

| 觸發 | 影響 | 處理 |
|---|---|---|
| `spiderShot` 排程分支與既有 `nextSide`/`alternation`/`sequence.seed`(WP-21 spawnArea 模式共用同一 `config.sequence.seed`)判斷順序耦合,誤判進入錯誤分支 | 既有 63+ drill(含 WP-21 detection drill、counter-strafe 系列)的決定性回歸可能被污染 | T1 DoD 首項 = `config.spiderShot` 省略時逐位等同現行行為;既有 `TargetManager.test.ts`/`schema.test.ts`/`DrillLoader.test.ts` **零修改**全綠;新分支以獨立 if 分支進入,`git diff` 可審為新增而非改寫既有邏輯 |
| 繞中心視線的二維極座標换算(方位角 + 徑向角距 → world Vec3)與既有水平面模型(`TARGET_Y` 常數)混用,導致周邊目標 y 分量計算錯誤 | 垂直/斜向象限的目標實際落點偏移,`D_deg`/象限標記與真實幾何不符,污染條件格效度 | T1 合成 fixture 覆蓋四個象限(正上/正右/正下/正左)+ 兩個斜向案例,逐案例斷言世界座標與獨立手算值(不透過待測函式重算)一致 |
| `D_deg` 複用 `angularEccentricityDeg` 底層公式時,抽出共用輔助函式過程中誤改既有 `detectionDerivation.ts`/`holdClickMetrics.ts` 的呼叫路徑 | WP-30/32/34 既有的 `t_detect`/`eccentricityAtSpawnDeg` 相關測試可能連帶紅燈 | T2 DoD:抽出後既有 `eyeOrigin.test.ts`/`detectionDerivation.test.ts`/`holdClickMetrics.test.ts` **零修改**全綠;抽出範圍限於「兩方向向量求夾角」這一段,不動 `angularEccentricityDeg` 對外簽名 |
| 「停止控制」(overshoot/逸出/微調次數)若 `trackingDerivation.ts` 現有輸出不足,倉促另立第二套幾何 | 直接違反 C-D4(既有構念禁第二定義),且與 WP-35 `deriveTrackingTransitions` 的加法擴充模式脫節 | T3 entry 前先讀 `trackingDerivation.ts`/`TrackingSample[]` 是否已有 overshoot 量;若無,新函式只消費既有 `TrackingSample[]`(比照 WP-35 §2④ 先例),不修改既有幾何,既有測試零修改為機械判準 |
| Spider Shot 的 `targetConditionCell` 格式與 WP-34(`hold:distance=mid`)風格不一致,造成三家族条件格字串難以人工比對 | 不影響 `checkCompatibility()` 的機器判定(全等字串比較不看格式),但降低人工稽核可讀性 | T2 採用一致風格 `spider:d=<D_deg 值>;w=<W_deg 值>`(比照 hold-click 的 `key=value` 分號序列慣例),於 `analysis-spider-shot.md` 明文記載格式,供 WP-38 呈現層參考 |
| 象限分箱門檻(45°)在 pilot 前武斷選定,與框架 v1「先篩選再保留有限條件格」的 calibration 精神衝突 | 條件格定義可能在 WP-39 pilot 後需要調整分箱門檻,產生版本相容問題 | T2 明文記載分箱門檻為**呈現層標籤**,不是 `targetConditionCell` 相容鍵欄位本身(相容鍵仍用連續數值序列化);門檻調整不觸發 `protocolVersion` 升版,只影響人類可讀的象限敘述 |

---

## 4. Task 索引

| Task | 檔案 | Objective | 相依 | Risk | 估時 |
|---|---|---|---|---|---|
| **T0** | [T0-entry-gate.md](T0-entry-gate.md) | 驗 WP-33 T-exit;讀碼確認 §0 對帳結論(尤其 0-2 二維極座標模型與 0-5 的 `trackingDerivation.ts` overshoot 覆蓋面);拍板排程落點(§2①)+ `zone`/`Meta.spawn.spiderShot` 欄位命名;零程式碼 | WP-33 T-exit | Low | 0.25–0.5d |
| **T1** | [T1-schedule-engine.md](T1-schedule-engine.md) | `DrillConfig.spiderShot` + schema 驗證 + `TargetManager` center-peripheral 排程分支 + `zone` 事件欄位 + `Meta.spawn.spiderShot` 回顯 | T0 | **Med–High**(新二維極座標幾何 + 觸碰 sim 熱路徑分支) | 1–1.25d |
| **T2** | [T2-condition-cell.md](T2-condition-cell.md) | `spider-shot-v1` drill config + `D_deg`/`W_deg`/象限/`targetConditionCell` 離線推導(複用 `angularEccentricityDeg` 夾角公式 + GD-7 hitbox) | T1 | Med | 0.75–1d |
| **T3** | [T3-five-metrics.md](T3-five-metrics.md) | 五類指標組裝(切換反應/移動執行/停止控制/首發/節奏),複用 `detectionDerivation`/`angularKinematics`/`peekWindows`/`trackingDerivation`(C-D4) | T2 | Med(停止控制子項視 T0/T3 讀碼結果可能上修) | 0.75–1d |
| **T-exit** | [T-exit-gate.md](T-exit-gate.md) | 驗收:每次 transition 保存方向/角距/角尺寸(框架 v1 驗收條件);`analysis-spider-shot.md` 定稿;文件對帳 | T3 | — | 0.25d |

**T1 是本 WP 的關鍵路徑與風險集中點**(唯一觸碰 `TargetManager` 熱路徑分支 + 唯一真正新幾何);T2/T3 高度依賴既有函式複用,一旦 T1 交付穩定的 `zone` 標記與世界座標,後續多為協定組裝。一 task = 一垂直切片 = 一原子 commit 紀律不變。

---

## 5. Interface contracts(草案;確切簽名與命名留給 T0/T1 定稿)

```ts
// src/metrics/spiderShotConditions.ts                                          [T2,新增]
export type SpiderQuadrant = 'horizontal' | 'vertical' | 'oblique';
export type SpiderTransitionDirection = 'center-to-peripheral' | 'peripheral-to-center';

export interface SpiderShotTransition {
  readonly index: number;
  readonly targetId: string;
  readonly direction: SpiderTransitionDirection;
  readonly quadrant?: SpiderQuadrant;          // peripheral-to-center 時無象限語意(undefined)
  readonly angularDistanceDeg: number;          // D_deg:與前一目標方向的夾角(複用既有夾角公式,契約③)
  readonly angularSizeDeg: number;              // W_deg:換算自 GD-7 單一 hitbox(契約④)
  readonly hitbox: { readonly width: number; readonly height: number; readonly depth: number };
  readonly worldDistanceU: number;
  readonly seed: number;                        // 回顯自 meta.spawn.spiderShot(不解析,只轉錄)
  readonly targetConditionCell: string;         // 'spider:d=<..>;w=<..>'(契約 Failure modes 表)
}

export function deriveSpiderShotTransitions(payload: ExportPayload): readonly SpiderShotTransition[];

// src/metrics/spiderShotMetrics.ts                                             [T3,新增,複用既有函式]
export interface SpiderShotMetrics {
  readonly switchReaction: readonly { targetId: string; tDetectMs?: number; reactionMs?: number }[]; // 複用 deriveDetectionMetrics
  readonly movementExecution: readonly { targetId: string; movementTimeMs?: number; peakOmegaDegPerSec?: number }[]; // 複用 omegaDegPerSec + buildPeekWindows.tickRange
  readonly stopControl: readonly { targetId: string; overshootDeg?: number; dropCount?: number; microAdjustCount?: number }[]; // 消費既有 TrackingSample[],不動幾何(§0-5/T3 讀碼定稿欄位)
  readonly firstShot: readonly { targetId: string; hit?: boolean; fireAngleErrorDeg?: number }[]; // 複用 buildPeekWindows + angularEccentricityDeg
  readonly rhythm: { readonly transitionIntervalMs: readonly number[]; readonly medianMs: number; readonly p95Ms: number }; // 新加總,無既有函式衝突
}

export function deriveSpiderShotMetrics(payload: ExportPayload, options: SpiderShotMetricsOptions): SpiderShotMetrics;
```

---

## 6. 執行規則

沿用 [exec-plan/README.md §5](../../../README.md):一 task = 一垂直切片 = 一原子 commit;完成即更新 [progress.md](progress.md) 與 [task-checklist.md](task-checklist.md);單一閘 `npm run test:ci`。跨 WP 決策入 [DECISIONS.md](../../../DECISIONS.md),per-WP 決策入本資料夾 `progress.md`(編號 `D-36.n`)。

**本 WP 特有的四條紀律**:

1. **既有 L/R 交替與 seeded spawn 行為零回溯相容成本**:T1 新增的 `spiderShot` 分支必須是完全可省略的 additive 路徑;既有 `TargetManager.test.ts`/`schema.test.ts`/`DrillLoader.test.ts`/WP-21 seeded spawn 相關測試**零修改**全綠是機械判準。
2. **不得修改 `sequence.alternation` 的型別或語意**:新排程原語一律走新的 top-level `spiderShot` 欄位(C-D4 精神延伸,承 §0-3)。
3. **既有幾何/首發/追蹤判定禁第二定義**:`D_deg` 複用既有夾角公式(§2③)、首發判定複用 `buildPeekWindows`、on-target 判定複用 `trackingDerivation.ts`;`W_deg` 是唯一被允許的新公式,且輸入限定 GD-7 單一 hitbox 來源。
4. **象限分箱是呈現層標籤,不是相容鍵欄位**:`targetConditionCell` 的相容性比較不依賴象限分箱門檻,避免呈現層的人為選擇污染正式相容鍵語意(承 Failure modes 表最後一列)。

---

## 7. Open Questions(本 WP 新增;既有見 [../README.md §8](../README.md))

| # | 問題 | 建議 / 待決 | Owner | Deadline | 未決影響 |
|---|---|---|---|---|---|
| **OQ-S6-16**(新) | `trackingDerivation.ts`/`TrackingSample[]` 現有輸出是否已足以推導 overshoot 角度量與微調次數,或需要新的消費函式(比照 WP-35 `deriveTrackingTransitions`) | 🟡 **T0 初判完成**:`deriveTrackingTransitions()` 可直接複用 drop/reacquire；`TrackingSample` 缺有號誤差／反轉資訊，overshoot 與 micro-adjust 仍傾向新增獨立消費層，不擴充既有幾何；T3 定案 | 研究者 | WP-36 T3 | 「停止控制」指標的落地方式;可能影響 T3 估時上修 |
| **OQ-S6-17**(新) | Spider Shot 的「回中心」transition 是否需要與「進周邊」transition 同等量測切換反應/停止控制,還是只計入節奏分布(承 §1.1 out of scope 條款) | 🟡 **T2/T3 拍板**;初判傾向只計入節奏(框架 v1 原文只描述 center→peripheral 與 peripheral→center 的通用 transition 記錄義務,五類指標敘述以「切換到新目標」為構念核心,回中心是否算「新目標」需要 T2 讀碼後定案) | 研究者 | WP-36 T2 | 五類指標的樣本範圍定義;影響 `n` 的計算基礎,連帶影響 WP-38 品質旗標判定 |
| **OQ-S6-18**(新) | 象限分箱門檻(建議 45°,契約⑤)是否需要在 pilot 前先徵求教練意見,或直接由工程側暫定再交 WP-39 pilot 調整 | 🟢 **建議**:先暫定 45° 對稱分箱(不阻塞開工),T-exit 於 `analysis-spider-shot.md` 明文記載為「呈現層標籤,可在不升版的前提下調整」(承契約⑤/Failure modes 表) | 使用者 | WP-36 T2(暫定)/ WP-39(pilot 覆核) | 象限敘述的教練可讀性;不阻塞相容鍵或指標計算 |

---

## 8. 文件對帳清單

- [x] [../README.md](../README.md) §3:WP-36 狀態列翻 ✅(2026-08-24 T-exit)。
- [x] `docs/operational/analysis-spider-shot.md`(T2 起稿,T-exit 定稿):中心—周邊排程語意、`zone` 欄位定義、`D_deg`/`W_deg`/象限公式、`targetConditionCell` 格式、五類指標公式、與既有 L/R 交替/`SpawnAreaConfig` 差異說明。
- [x] [CONTEXT.md](../../../../../CONTEXT.md):新術語(`spiderShot` schedule、`zone`、`D_deg`、`W_deg`、象限標籤、五類指標)於 T-exit 回寫(2026-08-24)。
