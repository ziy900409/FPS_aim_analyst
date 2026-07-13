# 階段 E(stage5)執行計畫 — BR 遠距跟槍測試模組(BR 場景 × 遠距小目標 × ADS × 彈道)

> stage5 頂層索引 + tech spec。整合輸入:**2026-07-10 架構評估**(五項需求對照既有資產:BR 場景/遠距移動小目標/跟槍效率/ADS/彈道顯示與 projectile)+ WP-18 交付形狀(motion/sub-tick 內插/追蹤指標,✅ 2026-07-09)+ stage3 場景與感知實驗鏈(M10 ✅ 2026-07-10)。
> 格式沿用 [exec-plan/README.md](../../README.md)(每 WP 一個自足子資料夾;task = 垂直切片 = 原子 commit)。文件語言:繁體中文,術語保留英文(D4)。
> **編號對帳(GD-15,2026-07-10)**:本階段取用 **WP-23~26 / M11~M13 / 驗收清單 E**;stage4 草稿(未採納)原預留之 WP-23~27 / M11~M12 於其採納時重編(WP-27+ / M14+),見 [DECISIONS.md](../../DECISIONS.md) GD-15 與 [stage4 README](../stage4/README.md) 標註。

| | |
|---|---|
| **交付範圍** | 遠距小目標追蹤模組(hitbox config 化 + 遠距 drill)+ ADS 開鏡(輸入事件/FOV/感度換算/scope overlay/記錄)+ 彈道(tracer 顯示 + config-gated projectile 彈道模型)+ BR 寫實開闊場景與整合 drill/protocol + 驗收清單 E |
| **上游門檻** | **WP-18 ✅(2026-07-09 T-exit)**:motion 驅動 + sub-tick 命中內插 + timed presentation + 追蹤指標推導全就緒。**M10 ✅(2026-07-10)**:場景系統/顯示管線/protocol E2E 鏈可消費。研究側:GD-7(追蹤指標)/GD-9(資產授權)既有決議直接沿用;新增構念(ADS 感度模型、彈道參數域)由各 T0 拍板 |
| **技術棧** | 沿用(Three.js `WebGPURenderer` + TS + Vite;UI = 純 TS + DOM overlay;Vitest + Playwright);新增 `src/ballistics/` 純數學模組(比照 `src/recoil/`,零 three/DOM 相依) |
| **估時** | 10.5–17 dev-days(WP-23~26) |
| **狀態** | ⬜ **已規劃(2026-07-10)**;WP-23 / WP-24 / WP-25 T1 可並行開跑 |

---

## 0. 輸入現況:五項需求 → 既有資產對照與範圍收斂

> 2026-07-10 架構評估結論。**已交付的不重做,只引用**;本階段的新工程集中在 ADS 與 projectile 兩塊。

| # | 需求 | 既有資產(不重做) | 本階段缺口 | 落點 |
|---|---|---|---|---|
| 1 | 大逃殺場景背景 | WP-19 場景系統(SceneConfig/GLTF/淨空驗證,M9)+ `field-low`;「換場景零引擎碼」已被測試釘死 | **寫實 BR 開闊場景 `br-field`**(資產 + config,零引擎碼;GD-9 白名單) | WP-26 T1/T2 |
| 2 | 遠距小目標持續移動 | WP-18 motion(`linear/pingpong/sine/waypoints`,age 驅動純函式)+ sub-tick 命中內插 + `tracking_v1` | **hitbox 寫死常數 config 化**([TargetManager.ts:57](../../../../src/sim/TargetManager.ts) 等三處)+ 遠距 drill config(角參數設計) | WP-23 |
| 3 | 跟槍效率指標 | GD-7 指標族已實作:ε(t)/on-target/t_acquire/TOT%/RMS(ε)([trackingDerivation.ts](../../../../src/metrics/trackingDerivation.ts),離線推導) | 小角尺寸下 round-trip 驗證 + 結果頁確認(近零工程) | WP-23 T3 |
| 4 | ADS 開鏡(Enabled 開關) | `CameraController.setFov` 接縫、WP-12 感度換算慣例、WP-11 `WeaponConfig`/fire down-up 事件模式 | **全新**:`EV_ADS` 輸入事件 + zoom 感度/FOV + scope overlay + 記錄 schema | WP-24 |
| 5a | 子彈軌跡顯示 | WP-13 `ImpactRing`/`ImpactView` pattern(sim 寫環形格、render 唯讀 InstancedMesh) | `shotRays` 環形格 + `TracerView` + UI 開關(render-only) | WP-25 T1 |
| 5b | Bullet Type = Projectile 開關 | 產彈點 = recoil 掛點 seam(WP-11/13);`ballisticRaycast(camera, state, subAlpha?)` 既有簽名 | **全新且動 sim 核心**:`src/ballistics/` 數學核心 + config-gated 子彈實體 + shot/hit 事件解耦 + 指標語意 | WP-25 T2–T4 |

**關鍵設計洞見(距離尺度)**:sim 正規單位 1u ≈ 1.905cm(Source),現行 drill distance ~4u。「遠距離」的**設計參數不是絕對距離,而是角尺寸與角速度**——目標角高 ≈ 2·atan(h/2d)(h = hitbox 高、d = 距離);projectile 的設計參數是**飛行時間 tick 數**(< 1 tick 即退化 hitscan、構念空轉)。距離/hitbox/初速三者必須聯動設計(OQ-S5-2/S5-4),render 端以 display scale 呈現場景尺度(CONTEXT「正規單位」既有機制)。

---

## 1. 需求(Requirements)

### 1.1 Functional Requirements

> 每條 FR 對應至少一個 WP task(映射欄);驗收句式 = 可機械判定。

| # | 需求(系統必須…) | 映射 |
|---|---|---|
| FR-E1 | 目標 hitbox 由 `DrillConfig.targets.hitbox?` 資料定義(additive 選填;省略 = 現行 1×2×1 **逐位不變**);**單一來源**貫穿命中判定(`TargetManager`/`HitDetector`)、渲染(`TargetView`)、淨空驗證(`clearance`)、離線推導(`trackingDerivation` 由 meta 餵);hitbox 快照進 meta | WP-23 T1 |
| FR-E2 | 遠距小目標追蹤 drill `tracking_longrange_v1` 上線:距離/hitbox/motion 速度由**角尺寸與角速度設計參數**反推(OQ-S5-4 定稿);timed presentation 沿用 WP-18;淨空驗證涵蓋遠距走廊 | WP-23 T2 |
| FR-E3 | 小角尺寸下追蹤指標鏈成立:round-trip fixture(錄 → 匯 → 推導)誤差 ≤ 1 tick;**命中 ⇔ on-target 同幾何**斷言(邊緣開火 fixture);遠距 fixture 進決定性回歸 | WP-23 T3 |
| FR-E4 | ADS 輸入鏈:`EV_ADS` 事件(packed `b`=down,比照 fire)進輸入 ring;`SharedState.heldAds` + stuck-ads 防護(PointerLock 解鎖補 ads-up);事件走既有輸入分桶(決定性契約不變) | WP-24 T1 |
| FR-E5 | `WeaponConfig.ads?: { fovDeg, sensitivityRatio }`(validateWeapon field-path 驗證);`CameraController` ADS 態:FOV 切換(render 幀內插)+ `applyDelta` gain 乘 `sensitivityRatio`(換算模型 = OQ-S5-1 決議);感度角度制跨解析度不變斷言沿用 | WP-24 T2 |
| FR-E6 | scope overlay(純 TS + DOM,D1)+ 記錄:tick row 增 `ads` flag、events 增 ads down/up(v2 additive);schema.md 對帳;**ads 狀態不記錄 = 該 drill 分析無效**,故為必填記錄 | WP-24 T3 |
| FR-E7 | tracer 顯示:sim 產彈點寫 `SharedState.shotRays`(preallocated 環形格,origin+endpoint+seq);`TracerView` render 唯讀繪製(InstancedMesh 單 draw call、壽命漸隱 render-only);UI Enabled/Disabled 開關(顯示層,不記錄);**sim 演進零改動** | WP-25 T1 |
| FR-E8 | `src/ballistics/` 純數學核心:固定 1/128s 步長彈道演進(初速 + 重力,u/s 域)+ swept segment vs AABB 命中測試;golden tests(已知參數 → 位置序列/命中 tick 逐位) | WP-25 T2 |
| FR-E9 | 彈道模型 config-gated:`WeaponConfig.bullet?: { model:'projectile', speedU, gravityU, maxRangeU }`;**未給 = hitscan 現行路徑逐位不變**(既有決定性 baseline 零重錄為 DoD 首項);SimLoop 子彈實體 = preallocated arena(固定容量、物件重用);shot 與 hit 事件解耦(v2 additive) | WP-25 T3 |
| FR-E10 | projectile 指標語意:`t_fire` 錨點與 `firstShot` 旗標語意**不變**(錨 shot);新增 `t_hit`/`timeOfFlightMs`;lead(提前量)誤差為**離線推導 spec**(引擎零新計算);projectile fixture 進決定性回歸(跨 FPS 逐位) | WP-25 T4 |
| FR-E11 | BR 寫實開闊場景 `br-field` 上線:原創資產(GD-9 白名單:CC0/CC-BY + `ATTRIBUTIONS.md` 逐項)、propBounds 與視覺同源、三角形預算內、雜亂度階層定位記 SceneConfig | WP-26 T1/T2 |
| FR-E12 | BR 整合 drill `tracking_br_v1`:`br-field` × 遠距小目標移動 × ADS 武器 × 彈道模型,全部由 config 宣告(零引擎碼);protocol 條件序列(ADS on/off、hitscan/projectile)宣告式定義 | WP-26 T3 |
| FR-E13 | E2E 全鏈路(drill → 匯出含 ads/hit/追蹤欄 → 離線推導)+ **三條決定性不變性**(場景切換/ADS 顯示/彈道模型 gate 各不改既有 sim baseline)+ 驗收清單 E 全項通過 = stage5 交付 | WP-26 T4 |

### 1.2 Non-functional Requirements

| 類別 | 量化需求 |
|---|---|
| 決定性 | hitscan/無 hitbox 欄/無 ads 的既有路徑**逐位不變**(既有 baseline 零重錄);projectile/遠距 fixture 為新增決定性面(同輸入跨 render FPS sim 狀態逐位一致);ads 事件走輸入分桶(排序消費) |
| GC 紀律 | `shotRays` ring、子彈 arena 皆 preallocated + 物件重用,熱路徑零配置(比照 `ImpactRing`/`DataRecorder`) |
| 效度 | ads 狀態(逐 tick flag + 事件)與彈道模型必進匯出(meta + rows);tracer 純視覺不記錄;lead 誤差離線推導、不進 sim 熱路徑(GD-7 模式) |
| 效能 | `br-field` + tracer + 移動目標 + projectile 下 sim 128Hz 不掉 tick;tracer/彈孔各單 draw call;frame log(WP-20)外顯負載證據 |
| 授權 | `br-field` 全資產 CC0/CC-BY 可稽核(GD-9);禁遊戲抽取資產、禁複製特定地圖配置 |

### 1.3 Constraints(硬約束;各 T0 採納時回寫 CLAUDE.md §4)

- 沿用階段 A–C 全部硬約束(`performance.now()`、`three/webgpu`、COI、決定性、三迴圈經 SharedState、GC 紀律、純 TS UI、seeded RNG、GD-6 場景零知識、GD-9 授權白名單、GD-11 FPSci 紅線)。
- **新增:ADS 只落輸入/render/data 層**——不得改 `SIM_HZ`、命中幾何、目標演進;ads 狀態(事件 + 逐 tick flag)必記錄。
- **新增:彈道模型必須 config-gated**——hitscan 為預設且路徑逐位不變;projectile 演進 = 固定步長純函式(禁時鐘、禁 `Math.random`,參數注入)。
- **新增:子彈永不與場景幾何互動**(GD-6 延伸)——彈道只測目標 hitbox;場景不擋彈與「純裝飾場景」本體論一致。
- **新增:tracer/軌跡渲染只讀 `SharedState` 環形格**(render-only,不伸手 sim 物件圖)。

---

## 2. 系統設計(Technical Design)

### 2.1 System boundary

**In scope**:`src/drill/`(hitbox 欄 + 兩個新 drill config)、`src/sim/TargetManager.ts` + `HitDetector.ts`(hitbox config 化)、`src/scene/clearance.ts`(hitbox/遠距包絡)、`src/metrics/trackingDerivation.ts`(options 由 meta 餵)+ lead spec(docs)、`src/state/`(EV_ADS、heldAds、shotRays)、`src/input/`(ads 事件)、`src/weapon/WeaponConfig.ts`(ads/bullet 欄)、`src/view/CameraController.ts`(zoom)、`src/render/`(TracerView)、`src/ui/`(scope overlay、tracer 開關)、`src/ballistics/`(新)、`src/loop/SimLoop.ts`(子彈 arena + 產彈點佈線)、`src/data/`(ads flag/hit 事件/meta additive)、`public/assets/scenes/` + `ATTRIBUTIONS.md`(br-field)、決定性/E2E 測試、`docs/operational/`(lead spec、驗收清單 E)。

**Out of scope**(防蔓延,各附觸發條件):

- **scoped inaccuracy / ADS 移動懲罰 / 呼吸晃動**:觸發 = 研究需要 ADS 精度構念;先只做 FOV + 感度 + 記錄。
- **zeroing(歸零距離)/ 風偏 / 穿透 / 傷害衰減**:PUBG 式進階彈道;觸發 = 明確研究委託。
- **W/S 前後移動**:移動模型維持 A/D 橫移(階段 A–B 契約);BR 感僅由場景與距離承擔。
- **頭/身 hitbox 分解**:H1 單一 hitbox 語意不變(CONTEXT §B 既有延後決策)。
- **slide-in / 宣告式 occluder**:GD-8 判準已預存,觸發條件不變。
- **lead 誤差進正式 pre-registered 指標**:本階段 spec-only 離線(OQ-S5-5);觸發 = pilot 顯示 lead 構念有效。

### 2.2 資料流(新增/異動)

```mermaid
graph LR
  subgraph config[Config 層 資料驅動]
    WC["WeaponConfig.ads? / .bullet?"] --> SIM
    DC["DrillConfig.targets.hitbox? + tracking_longrange/br_v1"] --> CV[validateClearance 遠距走廊]
    SC["SceneConfig br-field(propBounds)"] --> CV
  end
  subgraph input[輸入層]
    MOUSE["右鍵 → EV_ADS(down/up)"] --> RING[輸入 ring 分桶]
    RING --> SIM
  end
  subgraph sim[SimLoop 128Hz]
    SIM["simStep:heldAds 旗標 + 產彈點"] -->|hitscan(預設,逐位不變)| RAY[ballisticRaycast]
    SIM -->|"projectile(gated)"| ARENA["子彈 arena:stepBullet + sweptHitTest"]
    RAY --> SR["SharedState.shotRays(環形格)"]
    ARENA --> SR
    ARENA -->|t_hit| REC
    SIM --> REC["DataRecorder:tick.ads + shot/hit 事件"]
  end
  subgraph render[Render/UI 層]
    SR --> TV["TracerView(InstancedMesh,壽命漸隱)"]
    ADSF[heldAds] --> CAM["CameraController:FOV 內插 + gain"]
    ADSF --> OVL["scope overlay(DOM)"]
    TOGGLE[tracer 開關 UI] --> TV
  end
  REC --> EXP["匯出 v2 additive → 離線推導(TOT%/RMS ε/lead spec)"]
```

雙迴圈邊界不變(ADR-2):FOV/overlay/tracer 全在 render/UI 側;sim 新增 = heldAds 旗標(輸入事件驅動)與 gated 子彈 arena(純狀態演進,無時鐘無隨機)。aim 仍為「僅觀測」(GD-4):ADS gain 作用於 `CameraController.applyDelta`(輸入→視角換算),sim 消費的 aim 已是換算結果——**分析端靠 `ads` flag 還原構念**,故 FR-E6 為效度必要條件。

### 2.3 Interface contracts(關鍵簽名)

```ts
// src/drill/DrillConfig.ts 擴充(WP-23 T1;additive 選填,舊 drill 逐位不變)
// targets.hitbox?: { widthU: number; heightU: number; depthU: number }   // 省略 = 1×2×1(現行常數)
// meta.targets 快照含 hitbox —— 離線推導與命中「同幾何」的傳遞鏈

// src/state/types.ts(WP-24 T1)—— packed 佈局不變(type,t,a,b)
export const EV_ADS = 3;                      // b = down(0/1),比照 EV_FIRE
// SharedState:heldAds: boolean;stuck-ads 防護 = PointerLock 解鎖補送 ads-up(比照 heldFire)

// src/weapon/WeaponConfig.ts 擴充(WP-24 T2 / WP-25 T3;皆選填、validateWeapon field-path 驗證)
// ads?:    { fovDeg: number; sensitivityRatio: number }                  // 模型 = OQ-S5-1 決議(GD-16)
// bullet?: { model: 'projectile'; speedU: number; gravityU: number; maxRangeU: number }  // 未給 = hitscan

// src/view/CameraController.ts(WP-24 T2)
// setAds(active: boolean): void   // FOV 目標切換(render 幀內插)+ applyDelta gain × sensitivityRatio

// src/state/SharedState.ts(WP-25 T1)—— 比照 ImpactRing(seq 高水位增量同步)
export interface ShotRayRing { /* ox,oy,oz,ex,ey,ez,seq: Float64Array; total, cursor */ }
export function pushShotRay(ring: ShotRayRing, ox: number, oy: number, oz: number,
                            ex: number, ey: number, ez: number): void;
// 命中:endpoint = 命中點;未命中:endpoint = projectMissOntoEngagementPlane 投影(既有函式)或 maxRange 點

// src/ballistics/(WP-25 T2;純數學模組,零 three/DOM 相依,比照 src/recoil/)
export interface BulletState { x: number; y: number; z: number; vx: number; vy: number; vz: number;
                               ageTicks: number; alive: boolean }
export function stepBullet(b: BulletState, dtSec: number, gravityU: number): void;   // 固定 1/128s,非 1/128 拋錯
export function sweptHitTest(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
                             aabb: { min: Vec3; max: Vec3 }): number | null;          // slab;回 s∈[0,1] 或 null
```

### 2.4 關鍵設計決策

- **hitbox 單一來源(FR-E1)**:現行 `{1,2,1}` 常數重複於 [TargetManager.ts:57](../../../../src/sim/TargetManager.ts)、[clearance.ts:8](../../../../src/scene/clearance.ts)、[trackingDerivation.ts](../../../../src/metrics/trackingDerivation.ts) `DEFAULT_OPTIONS`——config 化時必須收斂為單一定義點,並以「邊緣開火 fixture:命中 ⇔ on-target」斷言鎖住 GD-7 的「同幾何、零新門檻」性質。
- **ADS 落點 = render/輸入層**:滑鼠→角度換算在 `CameraController`(aim 僅觀測,GD-4),故 ADS gain 不動 sim 演進、決定性契約零威脅;代價 = 記錄面必須帶 `ads` flag 才能離線還原構念(FR-E6)。
- **projectile 是唯一動 sim 核心語意的切片**:先鎖數學(T2 golden,仿 WP-10)再接線(T3),且 gate 在 `WeaponConfig.bullet?` 上——hitscan 預設路徑逐位不變是整個 stage2/3 golden 資產的保護閘(比照 WP-21 T1「無 seed 逐位不變」模式)。
- **子彈不測場景**(GD-6 延伸):彈道只對目標 hitbox 做 swept 測試;淨空驗證的視線走廊在 T2 擴為**彈道包絡**(下墜弧線的保守 AABB),維持「走廊淨空 ⇒ 與無場景逐位等價」論證。
- **飛行時間以 tick 數為設計參數**(OQ-S5-2):`speedU` 與 drill distance 聯動,目標 8–32 tick(62.5–250ms)量測窗;schema 驗證對「< 2 tick 到達」的組合發警告(退化 hitscan)。

### 2.5 schema 政策(v2 additive,沿 stage3 §2.5)

`targets.hitbox`(meta 快照)、tick row `ads`、events `ads`(down/up)/`hit`(t_hit/timeOfFlightMs)、`meta.weapon.ads/bullet` 快照——全部 **additive optional**,無語意重解釋、**不 bump** `schemaVersion`;舊資料無這些欄 = 該功能未啟用,語意自明。既有 `type:'fire'` row 語意(= 一發 shot)**不改**(WP-11 正名決議)。

### 2.6 Failure modes(對應 High/Med risk task)

| 觸發條件 | 影響 | 處理策略 |
|---|---|---|
| hitbox 三處常數 config 化後不同步 | 命中與 on-target 幾何分裂 → 追蹤指標失效 | 單一來源 + 「同幾何」邊緣 fixture 斷言(WP-23 T1 DoD);淨空膨脹半徑由同源推導 |
| projectile 改動波及 hitscan 路徑 | stage1–3 決定性 baseline 全紅 | 「未給 `bullet` 欄逐位不變」為 T3 DoD 首項(先跑既有回歸再進新功能) |
| 子彈 arena 熱路徑配置物件 | GC 卡頓汙染量測 | preallocated `BULLET_CAP` + 欄位重用(比照輸入 ring);滿載策略 = 拒發 + 旗標 |
| 飛行時間 < 1–2 tick | projectile 退化 hitscan、lead 構念空轉 | OQ-S5-2 以 tick 數反推參數;config 驗證警告;fixture 涵蓋長短兩端 |
| EV_ADS 擴編碼破壞 ring 佈局 | 輸入鏈解碼錯 → 全輸入失效 | packed 佈局不變(`b`=down);解碼 golden 測試;既有 ring 測試零修改全綠 |
| ADS gain 記錄缺失 | aim 資料無法離線解讀(構念混淆) | tick `ads` flag 必填(FR-E6 DoD);缺 flag 的 ads drill 匯出 = 測試紅 |
| 遠距小角目標像素混疊(target 佔位 < 數 px) | 視覺可辨識度混入追蹤量測 | 角尺寸下限進 OQ-S5-4 決議;與 WP-20 解析度模式交互記 drill 設計註記;display meta 外顯 |
| br-field 資產壓垮 render | 顯示鏈延遲汙染追蹤體感 | 三角形預算 + frame log 外顯 + WP-26 T2 負載 DoD(沿 WP-19 T5 模式) |

### 2.7 Concurrency model

單執行緒單一 rAF 超級迴圈不變。子彈 arena 為 sim 專屬狀態;`shotRays`/`heldAds` 經 `SharedState` 單向流(sim 寫 render 讀 / 輸入寫 sim 讀);無共享可變性新增。Worker 遷移 out of scope(stage2 觸發條件不變)。

---

## 3. WP 索引(⬜ 未開始 · 🟡 進行中 · ✅ 完成)

> 每 WP 一個自足子資料夾(`README.md` + `task-checklist.md` + `progress.md` + `T0` → `Tn` → `T-exit`)。編號分配見 GD-15。

| WP | 子資料夾 | 目標 | 里程碑 | 相依 | 估時 | 狀態 |
|---|---|---|---|---|---|---|
| **WP-23** | [wp-23-longrange-tracking/](wp-23-longrange-tracking/README.md) | 遠距小目標追蹤:hitbox config 化(單一來源)+ 遠距 drill + 指標 round-trip/決定性 | **M11 ✅** | WP-18 ✅ + M10 ✅ | 1.5–2.5 | ✅(2026-07-10) |
| **WP-24** | [wp-24-ads-optics/](wp-24-ads-optics/README.md) | ADS 開鏡:EV_ADS 輸入鏈 + WeaponConfig.ads + zoom/感度 + scope overlay + 記錄 | — | M8 ✅(可與 WP-23 並行) | 2–3 | ✅(2026-07-13) |
| **WP-25** | [wp-25-ballistics-tracer/](wp-25-ballistics-tracer/README.md) | 彈道:tracer 顯示(T1,獨立)+ projectile 數學核心/sim 整合/指標語意(T2–T4,gated) | **M12** | T1 獨立;T2+ 需 **M11** | 4–6.5 | ⬜ |
| **WP-26** | [wp-26-br-scene-integration/](wp-26-br-scene-integration/README.md) | BR 場景與整合:`br-field` 資產/上線 + `tracking_br_v1` + protocol + E2E + 驗收清單 E | **M13** | WP-23, 24, 25 | 3–5 | ⬜ |

---

## 4. 里程碑門控

| 里程碑 | 完成條件 | 對應 WP | 意義 |
|---|---|---|---|
| **M11 ✅**<br>(2026-07-10) | hitbox config 化零破壞(舊 drill 逐位不變)+ 同幾何斷言綠 + `tracking_longrange_v1` round-trip(推導誤差 ≤ 1 tick)+ 遠距 fixture 決定性綠 | WP-23 | 遠距追蹤效度地基;**WP-25 T2+ entry 前提自此可引用** |
| **M12** | hitscan 逐位回歸綠(baseline 零重錄)+ projectile golden(位置序列/命中 tick)綠 + tracer 交付(單 draw call、sim 零改動證據)+ shot/hit 事件 schema 對帳 | WP-25 | 彈道模型門控:**M12 未過 `bullet` 欄不得進任何 drill config** |
| **M13** | 驗收清單 E 全項通過:BR 整合 drill E2E 綠、三條決定性不變性(場景/ADS/彈道 gate)綠、ads/hit/追蹤欄匯出 round-trip 綠、資產 attribution 可稽核、`test:ci` exit 0 | WP-26 | **stage5 交付**:BR 遠距跟槍測試(含 ADS 與彈道條件)pilot-ready |

> WP-24 無獨立里程碑:其交付由 M13 驗收清單 E 一次收斂(比照 stage3 WP-20/21 → M10 模式)。

---

## 5. 相依圖(關鍵路徑)

```
WP-23(遠距追蹤,M11)──┬─(M11)─→ WP-25 T2–T4(projectile,M12)──┐
WP-24(ADS)────────────┼───────────────────────────────────────┼→ WP-26(BR 整合,M13)= stage5 交付
WP-25 T1(tracer)──────┴───────────────────────────────────────┘
```

- **三線可並行開跑**:WP-23、WP-24、WP-25 T1 互不相依,且不碰同一檔案熱區(hitbox 鏈 / 輸入+相機鏈 / SharedState+render 鏈)。
- **M11 未過不進 WP-25 T2+**(遠距 drill 是 projectile 構念的前提);**M12 未過不進 WP-26 T3+**(整合 drill 需彈道模型 gate 已鎖)。
- WP-26 T1(資產)可提前並行(僅依賴 OQ-S5-3 拍板,不依賴程式碼)。

---

## 6. 任務拆解(已展開為 per-WP 自足 task 檔,2026-07-10)

| WP | Task 檔 |
|---|---|
| **WP-23** longrange-tracking(M11) | [wp-23-longrange-tracking/](wp-23-longrange-tracking/README.md):T0 → T1 hitbox config 化 → T2 遠距 drill → T3 round-trip + 決定性 → T-exit |
| **WP-24** ads-optics | [wp-24-ads-optics/](wp-24-ads-optics/README.md):T0(GD-16 感度模型)→ T1 EV_ADS 輸入鏈 → T2 WeaponConfig.ads + zoom → T3 overlay + 記錄 → T-exit |
| **WP-25** ballistics-tracer(M12) | [wp-25-ballistics-tracer/](wp-25-ballistics-tracer/README.md):T0(GD-17 參數域)→ T1 tracer → T2 數學核心 golden → T3 sim 整合(gated)→ T4 指標語意 → T-exit |
| **WP-26** br-scene-integration(M13) | [wp-26-br-scene-integration/](wp-26-br-scene-integration/README.md):T0 → T1 br-field 資產 → T2 場景上線 + perf → T3 整合 drill + protocol → T4 E2E + 驗收清單 E → T-exit |

---

## 7. 風險分析

| 風險 | 等級 | 說明與緩解 |
|---|---|---|
| projectile 指標語意分岔(t_fire/t_hit)未鎖前汙染既有八指標 | **High** | T4 語意 spec 前置;`firstShot`/`t_fire` 錨定不變為斷言;首發命中率語意(shot 之 outcome)明文記 CONTEXT 候選 |
| hitbox 三處常數 config 化分裂 | **High** | 單一來源 + 同幾何 fixture(§2.6);T1 為 WP-23 唯一 High risk task |
| ADS 感度構念(OQ-S5-1)選錯 → 跨條件不可比 | Med | T0 拍板 + pre-registered 凍結(GD-16);gain 全程可由 config + ads flag 離線重建 |
| 遠距小角目標的像素混疊混入量測 | Med | 角尺寸下限(OQ-S5-4)+ 解析度模式交互記錄;必要時遠距 drill 綁最高解析度條件(protocol 層處理) |
| br-field 資產授權/效能 | Med | GD-9 白名單 + 程序化生成先例(WP-19,field-low 204 tri);三角形預算 + frame log DoD |
| ring 佈局/事件擴碼波及輸入鏈 | Med | packed 佈局不變;既有 ring/consume 測試零修改全綠為閘 |
| **Technical debt(有意識妥協)** | — | ① ADS 只做 FOV+gain(scoped inaccuracy/移動懲罰觸發後補)② lead 誤差 spec-only 離線 ③ tracer 純視覺不記錄 ④ projectile 不做 zeroing/風偏/穿透 ⑤ 頭/身 hitbox 分解維持延後 |

---

## 8. Open Questions

| # | 問題 | 建議(計畫預設) | Owner | Deadline | 未決影響 |
|---|---|---|---|---|---|
| OQ-S5-1 | ADS 感度換算模型(CS2 `zoom_sensitivity_ratio` vs monitor-distance match) | ✅ **GD-16 決議:CS2 式**。ads 有效感度 = `sensitivity × sensitivityRatio × (adsFov / hipFov)`;`sensitivityRatio` 預設 1.0,pre-registered 後凍結;monitor-distance match 不重解釋既有資料 | 研究者 | WP-24 T0 ✅ | WP-24 T2 unblocked;跨條件可比性由 config + ads flag 離線重建 |
| OQ-S5-2 | projectile 參數域(speedU/gravityU/maxRangeU 對照表;與 drill distance 聯動) | 以**飛行時間 tick 數**(8–32 tick)反推 speedU;gravityU 以「到靶下墜角尺寸 0.1–0.5×目標角高」反推;表列 2–3 組武器檔 | 架構+研究者 | WP-25 T0 | WP-25 T2+ blocked |
| OQ-S5-3 | br-field 資產路線(程序化生成 vs CC0 pack) | **程序化生成 CC0**(WP-19 先例:GD-9 完全合規、propBounds 與視覺同源);Kenney/Quaternius 保留為寫實置換備選 | 使用者 | WP-26 T0 | WP-26 T1 blocked(不阻塞 T0 前其他 WP) |
| OQ-S5-4 | 遠距 drill 設計矩陣(角尺寸/角速度/距離/hitbox 組合;角尺寸下限) | ✅ WP-23 T0 決議:小目標 H1 = `{widthU:0.5,heightU:1,depthU:0.5}`;角高 0.5°/2.0° × 角速度 5°/s/20°/s;角尺寸下限 0.5°。距離 `d=h/(2*tan(theta/2))`:0.5°→114.59u,2.0°→28.65u。水平速度 `v=d*omegaRad`:10.00/40.00u/s(0.5°),2.50/10.00u/s(2°)。T2 default=0.5°×5°/s;hard=0.5°×20°/s;near sanity=2°×5°/s。 | 研究者 | WP-23 T0 ✅ | WP-23 T2 unblocked |
| OQ-S5-5 | lead 誤差是否進正式指標(或 spec-only) | **spec-only 離線**(引擎零計算);pilot 顯示構念有效再立案晉升 | 研究者 | WP-25 T4 | 不阻塞工程 |
| OQ-S5-6 | ADS 操作語意(hold vs toggle) | ✅ **hold**(右鍵按住,與 CS2 慣例一致;stuck-ads 防護比照 fire);toggle 留未來 config 候補,stage5 預設不啟用 | 研究者 | WP-24 T0 ✅ | WP-24 T1 事件語意已鎖 |

---

## 9. 文件對帳清單(採納本計畫時執行;跨文件決策入 DECISIONS.md)

- [x] [DECISIONS.md](../../DECISIONS.md) **GD-15**(WP 編號分配:stage5 取 WP-23~26/M11~M13/清單 E;stage4 草稿採納時重編)入帳。(2026-07-10 本計畫)
- [x] [stage4 README](../stage4/README.md) 編號重編標註。(2026-07-10 本計畫)
- [x] [exec-plan/README.md](../../README.md):§2 加 stage5 索引表 + WP-18 狀態翻 ✅;§3 加 M11–M13;§4 相依圖擴充;§6 目錄慣例。(2026-07-10 本計畫)
- [x] [docs/MAP.md](../../../MAP.md):§3 加 stage5(+ stage4 草稿列)導航。(2026-07-10 本計畫)
- [x] [DECISIONS.md](../../DECISIONS.md) **GD-16**(ADS 感度模型:CS2 式 FOV-ratio gain + hold 語意)入帳。(2026-07-10 WP-24 T0)
- [ ] GD-17(彈道參數域)——落 WP-25 T0(拍板即入帳)。
- [ ] [CONTEXT.md](../../../../CONTEXT.md) 新術語(各 T0/T-exit 隨切片回寫):~~ADS/heldAds、zoom 感度換算~~(✅ WP-24 T-exit,§A/§G,2026-07-13)、tracer/shotRays、projectile/彈道模型 gate、time-of-flight、lead 誤差、hitbox config 化(H1 參數化)。
- [x] [CLAUDE.md](../../../../../CLAUDE.md) §4 硬約束追加:ADS 只落 input/render/data + ads event/tick flag 必記錄。(2026-07-10 WP-24 T0)
- [ ] [CLAUDE.md](../../../../../CLAUDE.md) §4 其餘 stage5 硬約束追加(彈道模型 config-gated、子彈不測場景、tracer render-only)——落 WP-25/26 各自 T0/T-exit。
- [ ] `docs/operational/schema.md`:~~`ads` 事件、tick `ads` flag、`meta.weapon`~~(✅ WP-24 T3,2026-07-13)、`hit` 事件、`meta.targets.hitbox`/(WP-25)`meta.weapon` 對帳(隨 WP-23 T1 / WP-24 T3 / WP-25 T3 分批)。
- [ ] 規格書版本對帳:新增「階段 E」節 + 附錄 E 增「驗收清單 E」(M13 前完成)。

---

## 10. 執行規則

沿用 [exec-plan/README.md §5](../../README.md):一 task = 一垂直切片 = 一原子 commit;task 完成更新該 WP `progress.md` + checklist;跨 WP 先驗上游 exit-gate;**M11 未過不進 WP-25 T2+、M12 未過不進 WP-26 T3+**。WP 展開格式以 stage3 各 WP 為模板(`completed/stage1/wp-2-dual-loop-skeleton/` 為原始模板)。
