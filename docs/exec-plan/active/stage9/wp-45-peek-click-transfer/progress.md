# WP-45 — progress / decision log

## Status

- **Current**:T3 完成（1.5°/2.0°/3.0° pilot config builder + 20-trial LR/cue/timeout/backstop gameplay 契約 + hitscan occlusion miss/hit 契約 + researcher mode 2.0° default 註冊），T1–T3 皆已就緒。T4 可開始。
- **Scope state**:`peek-click-transfer-pilot-v1` 為 Practice/pilot-only；正式 Assessment freeze 不在本 WP。
- **Dependency state**:T3 依賴的 WP-44 T-exit 已完成(`c44270e`)；T5 依賴的 stage8 WP-43 T-exit 已完成(`61db0ba`)；HEAD(`41d3bd5`)已包含兩者，兩個 gate 皆已開放，T3/T5 不再受阻。

## Progress

### 2026-08-26 — Planning

- 由 Kovaak's `Peek and Click` 影片分析收斂為 self-motion exposure transfer test。
- 依 `engineering-planning` quality gate 建立 requirements、interfaces、failure modes、risk、task files 與可驗證 DoD。
- 依 repeated-measures 原則，明確定義 participant 為 independent replicate、peeks 為 nested trials。
- 未修改 production code；未執行 T0 baseline。

### 2026-08-26 — T0 entry gate

- **Baseline HEAD**:`41d3bd508f9e9902ebbb333223c3d47f316bf96b`（`git status --short` 乾淨，無 pending diff）。
- **CodeGraph blast radius**（`codegraph_explore`，無 staleness banner，索引為權威）：
  - `createSimLoop`（`src/loop/SimLoop.ts:683`）：24 callers（`src/testharness/fpsTestHarness.ts`、`src/main.ts`），tests 覆蓋 `recoil-wiring.test.ts`/`wp22-determinism.test.ts`/`movingTargetDeterminismFixture.ts`/`projectile-determinism.test.ts` 等 7+ 檔 → 確認 T1 為跨模組 **High risk**，符合 README §3 風險評估。
  - `fireOneShot`（`SimLoop.ts:373`）：1 caller（`ballisticRaycast`），⚠️ CodeGraph 回報 **無覆蓋測試** — 現況既有缺口，非本 WP 引入；T1 新增 occlusion gate 時須為其新增/延伸測試，不能延用「零覆蓋」現況。
  - `raycastWithRay`（`src/sim/HitDetector.ts:67`）：5 callers（`HitDetector.ts`、`SimLoop.ts`），tests：`trackingDerivation.test.ts`。
  - `deriveVisibilityTimeline`（`src/metrics/visibilityDerivation.ts:43`）：3 callers（`holdClickMetrics.ts`），tests：`visibilityDerivation.test.ts`。
  - `loadDrillById`（`src/main.ts:1019`）：由 UI `onLoadDrill` 與 `createAppProtocolRunner.applyCondition` 呼叫；scene/drill atomic load 邏輯（`installSceneLoad`/`buildSimLoop`）與 README FM-P45-1 描述一致。
  - `buildFamilyOrder`（`src/session/sessionSchedule.ts:18`）：1 caller，tests：`sessionSchedule.test.ts`；`TEST_FAMILY_IDS` 為現行四家族凍結常數，T5 versioned roster 須另建常數，不得改此常數。
- **Baseline test 指令與結果**：
  - `npm.cmd test -- src/metrics/visibilityDerivation.test.ts src/sim/HitDetector.test.ts src/loop/SimLoop.test.ts` → exit 0，3 files / 73 tests 全綠。
  - `npm.cmd test -- src/session/sessionSchedule.test.ts src/session/SessionRunner.test.ts` → exit 0，2 files / 15 tests 全綠。
  - 無既有紅燈，無需歸因排除。
- **WP-44 dependency gate**（T3 依賴）：`git log` 確認 T-exit 已於 `c44270e` 完成（含 T0+T1 `78116a2`、T2 `5fa0c38`、T3 `1e31bd0`），且早於本 WP 目前 HEAD `41d3bd5`。`DrillConfig.ts`/`schema.ts`/`TargetManager.ts`/`main.ts` 熱區目前無 WP-44 未合併變更。**T3 gate 開放**。
- **WP-43 dependency gate**（T5 依賴）：`git log` 確認 stage8 WP-43 T-exit 已於 `61db0ba` 完成，同樣早於目前 HEAD。**T5 gate 開放**。
- **OQ-S9-4 決議**：維持 README 既定預設 — T3 先用 spawn-anchored `3000 ms` 總 timeout，同時輸出 `cue→onset`/`onset→hit` 分段時間與 `timeout_before_onset` flag（FM-P45-5）；split timeout 是否成為第二段獨立狀態機，留待真人 pilot 後另評估。理由：此為既有 README 預設且不阻塞 T1/T2/T3 介面設計；T0 未發現需要提前拍板的新資訊。若真人 pilot 後改採 split timeout，須先新增獨立 task/interface，不得沿用本決議悄悄改 `peekTimeoutMs` 語意。
- Production code diff：空（T0 僅讀碼與跑既有測試，未修改 `src/**`）。

### 2026-08-26 — T1 共用 occlusion kernel + hitscan wall-block gate

- **新增** `src/scene/occlusionGeometry.ts`：`firstBlockingIntersection`（segment→AABB 最近阻擋交點，含 `propId`/`alpha`/`point`）+ `visibleFractionForTarget`（1/9-point 可見比例）。核心 `segmentAabbEntryAlpha`/`clipAxis` 為純 scalar 運算、模組層級 `clipTMin`/`clipTMax` 重用暫存，`visibleFractionForTarget` 全程零配置（不建立 `Vec3[]`），`firstBlockingIntersection` 唯一配置是命中時回傳的單一物件（比照既有 `RaycastResult` 低頻開火事件慣例）。與 `clearance.ts` 既有 `segmentIntersectsAabb`（pre-spawn 淨空驗證，僅回 boolean）刻意分離——README scope 未列 `clearance.ts`，兩者用途不同（pre-spawn 驗證 vs. runtime 曝光/命中），FR-P45-3「同一 kernel」僅約束 visibility 與 hitscan 兩者之間。
- **改** `src/metrics/visibilityDerivation.ts`：`visibleFractionForTick` 改呼叫 `visibleFractionForTarget`，移除本地 `sampleTargetAabb`/`isBlocked`；既有 4 個 fixture 測試零修改全綠（含 edge-grazing tangent 案例），證明新 kernel 與舊 `segmentIntersectsAabb` 數學等價。
- **改** `src/loop/SimLoop.ts`：新增 `HitscanOcclusionContext`（`{propBounds}`）+ `SimLoopOptions.hitscanOcclusion?`；`fireOneShot` 在 hitscan 命中後、`markKilled`/彈孔寫入前，用 `firstBlockingIntersection(ballisticOrigin, ballisticHitPoint, propBounds)` 判定牆面阻擋——有 blocker 時 `hit=false`、不 `markKilled`，彈孔/tracer 終點改用 blocker 交點；`targetId` 欄位維持既有語意（射線幾何命中的目標，不受阻擋影響）。`hitscanOcclusion` 以 additive 參數逐層串（`simStep`→`scheduleFire`→`fireOneShot`；`createSimLoop.pump`→`simStep`），省略時三者簽名/呼叫序列與既有路徑逐位相同。projectile 分支（`weapon.bullet !== undefined`）完全不讀本 context。
- **改** `src/testharness/fpsTestHarness.ts` / `src/main.ts`：`buildSimLoop`/`startDrillWithScene` 建 loop 時注入 active scene 的 `propBounds`（`main.ts` 讀 `activeSceneConfig`，每次 `buildSimLoop()` 呼叫時取最新值；harness 讀 `resolvedScene`，無 scene 時整個 `hitscanOcclusion` 省略，維持既有無 context 行為）。`main.ts` 既有 scene 切換流程（`installSceneLoad` 先寫 `activeSceneConfig` 再 `buildSimLoop()`）天然滿足 FM-P45-1（無需額外改動）。
- **測試**新增：`src/scene/occlusionGeometry.test.ts`（13 tests：`firstBlockingIntersection` 空/outside/inside/tangent/endpoint/nearest/tie；`visibleFractionForTarget` 1-point/9-point/partial/mirror/非法 sampleCount throw）；`src/loop/SimLoop.test.ts` 新增 2 tests（隔牆阻擋:未擊殺+彈孔停牆面；`propBounds:[]` context 與省略 context 等效命中即殺）；`src/testharness/fpsTestHarness.test.ts` 新增 1 test（FM-P45-1：切換 wall-drill→open-drill 後 loop 重建、無殘留 propBounds，需搭配 `loadOptions.clearance.allowedOcclusionPropIds` 放行測試用全阻擋牆通過 `loadDrill` 的 pre-spawn clearance 驗證）。
- **驗證**：`npx vitest run`（全專案）→ 133 files / 1014 tests 全綠（含既有 baseline 零 fixture 修改）；`npm run typecheck` exit 0。

### 2026-08-26 — T2 左右對稱 `peek-ad-corridor-v1` 場景

- **新增** `src/scene/scenes/peek-ad-corridor.props.json` + `peek-ad-corridor.ts`：不改 frozen `peek-corridor`。propBounds 為一組「以 x=0 對半切」的中心柱：`cover-wall-l` `x∈[-1.2,0]`、`cover-wall-r` `x∈[0,1.2]`（`y∈[0,3]`、`z∈[-4.5,-3.5]`），兩者互為 x 軸鏡像（`cover-wall-r` = mirror(`cover-wall-l`)）。`playerCorridor.halfWidthU:2`，`proceduralRoom.eyeZ:0`、`fovDeg:75`（README §T2 geometry invariants）。
- **幾何設計依據**：用 `TargetManager` 預設(無 spawnArea)L/R 位置(`x=∓2, y=1.5`)與 `DEFAULT_TARGET_HITBOX`，經由 scratch 數值掃描（非 repo 程式碼,僅用於挑選常數；scratch 腳本未進 repo）驗證：中心 `px=0` 對兩側 9-point visible fraction 皆為 `0`；`px=∓halfWidthU=∓2`（往 cue 方向峰值移動）該側 fraction 達 `1`、對側維持 `0`；50% onset crossing 落在 `px≈∓0.58`,遠早於 `halfWidthU`,corridor 內有充足行程可達 full exposure（`px≈∓0.99`)。此設計假設 target distance `=8`（沿用 `peek-corridor` 同尺度）,已在 `peek-ad-corridor.test.ts` 頂部註記為 T3 pilot config 的相容假設——若 T3 改變 distance,須重驗此處 invariants。
- **新增** `scripts/gen-peek-ad-corridor-gltf.mjs`（改寫自 `gen-peek-corridor-gltf.mjs`，KIND 只留 `wall`/`ground`，無 `guide` 視覺輔助線,因為本場景無 slide-in 移動目標語意）→ 產生 `public/assets/scenes/peek-ad-corridor/peek-ad-corridor.gltf`（原創 CC0 box primitives）。已手動連跑兩次並 `diff` 確認 byte-identical。
- **新增** `src/scene/scenes/peek-ad-corridor.test.ts`（12 tests）：
  - SceneConfig 自驗 + propBound AABB 合法性 + GLTF mesh 節點/AABB 與 props JSON 逐項相同。
  - clearance：strict 拒絕兩側 cover-wall；只放行一側時另一側仍被拒絕（驗證「非允許 prop 仍拒絕」）；兩側皆放行後 `validateClearance` 零違規且 `loadDrill` 不 throw。
  - visibility symmetry：中心兩側 `<0.5`；往正確方向移動達 50% onset 且對側仍 `<0.5`；`±halfWidthU` 達 full exposure `=1` 對側 `=0`；左右 crossing px 絕對值誤差 `<= CS2_PROFILE.maxSpeed/SIM_HZ`（1 tick 空間容差,exact mirror 故實際誤差 `~0`）；`propBounds` x 軸鏡像逐欄驗證。
- **驗證**：`npx vitest run src/scene/scenes/peek-ad-corridor.test.ts src/scene/clearance.test.ts` → exit 0，2 files / 28 tests 全綠；`npx vitest run`（全專案）→ exit 0，134 files / 1026 tests 全綠（較 T1 baseline 1014 增加 12，皆為本次新增）；`npm run typecheck` exit 0。`git status --short` 只有本 task 新檔（`peek-ad-corridor.*`、`gen-peek-ad-corridor-gltf.mjs`、`public/assets/scenes/peek-ad-corridor/`）,frozen `peek-corridor` 三檔零 diff。

### 2026-08-26 — T3 pilot drill（1.5°/2.0°/3.0° angular-size cells）

- **新增** `src/drill/peek_click_transfer_pilot_v1.ts`：`PEEK_CLICK_ANGULAR_SIZE_CANDIDATES_DEG = [1.5,2,3]`（型別為文字聯集,非 `number`,故 operator 無法傳入未校準數值——README §2.3 C 的機械落實)；`angularSizeToHitboxWidthU(deg, distanceU) = 2·distanceU·tan(deg/2 in rad)` 純函式；`buildPeekClickTransferPilotConfig(angularSizeDeg)` 組出 `PeekClickTransferPilotConfig`（`id`/`sceneId='peek-ad-corridor-v1'`/`drill`/`clearanceOptions`/`visibility`/`angularSizeDeg`)。`drill` 沿用既有 engine 能力,零新狀態機:`cue:{kind:'single'}` + `sequence.spawnDelayMsRange:[500,500]`（cue foreperiod 500ms,對齊 `counterstrafe_cued_v1` 既有模式)、`targets.distance=8`（D-45.10 沿用 T2 校準值)、`timing.peekTimeoutMs=3000`（OQ-S9-4 決議的 spawn-anchored 總 timeout)、`timing.timeLimitMs=120000`（backstop)、`endCondition={type:'targetCount',value:20}`。first-miss-retain/second-hit-advance 與 L/R 交替皆是 `TargetManager`/`DrillRunner` 既有語意,本檔不新增判定邏輯。seed 用獨立 family base(`94000`,家族 offset 4,接續 `pilotConfigs.ts` 既有 0–3)避免與既有四個 pilot 家族或 assessment seed(1–37002)碰撞。`peekClickTransferPilotV1 = buildPeekClickTransferPilotConfig(2)` 為 researcher-mode 預設(OQ-S9-5)。
- **改** `src/pilot/pilotConfigs.ts`：新增 `buildPeekClickTransferPilotConfigs(candidates)`,回傳扁平 `DrillConfig[]`（`.drill` 已展開)——比照既有 `buildSpiderShotPilotConfigs`/`buildCounterstrafeReversalPilotConfigs` 慣例(呼叫端自行搭配 drill 檔匯出的 `sceneId`/`clearanceOptions`,同 `holdClickV1` 模式),不引入第二種 wrapper 形狀。`pilotConfigs.test.ts` 的 `allConfigs()` 併入新家族,沿用既有「practice-only / seed 不碰撞 / deterministic」斷言。
- **改** `src/main.ts`：新增 `peekAdCorridor` 進 `availableScenes`;新增 `peekClickTransferPilotV1` 進 `availableDrills`（`loadOptions.clearance = peekClickTransferPilotV1.clearanceOptions`,比照 `holdClickV1` 註冊模式)——研究員模式「單一 Drill 調整」下拉即可選取 2.0° pilot cell,scene/drill atomic load 沿用既有 `loadDrillById` 路徑,零新入口程式碼。
- **測試設計決策**:`fpsTestHarness.ts` 的合成 camera 固定於世界原點(從不隨 `state.player.x` 位移——只有 `main.ts` render loop 才把 `sceneManager.camera.position` 綁 player 位置),故無法透過該 harness 端到端驗證「玩家橫移曝光」幾何;改在 `peek_click_transfer_pilot_v1.test.ts` 內用 `simStep()` 低階直呼(比照 T1 `SimLoop.test.ts` 的兩個 occlusion tests 手法:`weapon`/`recoilRuntime` 皆省略以避開武器 spread 對 1.5°/2.0°/3.0° 極小 hitbox 的隨機脫靶風險),自建 camera + stub `TargetManager` 直接斷言 occlusion/hit 契約,不修改 `fpsTestHarness.ts`(README §2.1 file scope 未列該檔於 T3)。20-trial/cue/alternation/timeout/backstop/restart 契約則用 `createTargetManager`+`createDrillRunner` 直驅(免 camera/fire),因為這些語意完全由既有 `DrillRunner.tick`/`TargetManager.tick` 決定,不需經過完整 SimLoop。
- **驗證**:`npx vitest run src/drill/peek_click_transfer_pilot_v1.test.ts src/testharness/fpsTestHarness.test.ts` → exit 0,23 tests passed(T3 DoD 指定套件,`fpsTestHarness.test.ts` 為零修改回歸)；`npx vitest run`（全專案）→ exit 0,135 files / 1037 tests passed（較 T2 baseline 134 files/1026 tests 增加 1 file/11 tests,皆為本次新增)；`npm run typecheck` exit 0；`git status --short` 只有本 task 預期檔案（`peek_click_transfer_pilot_v1.ts`/`.test.ts` 新檔,`main.ts`/`pilot/pilotConfigs.ts`/`pilot/pilotConfigs.test.ts` 修改)。

## Decision log

| ID | 決策 | 理由 | 狀態 |
|---|---|---|---|
| **D-45.7** | OQ-S9-4：T0 維持 spawn-anchored `3000 ms` 總 timeout 預設，不提前拍板 split timeout | README 既定預設已滿足「不阻塞 T1/T2/T3」；split timeout 需要真人 pilot 資料才能判斷是否值得新增第二套狀態機 | Confirmed，T0 |
| **D-45.1** | 新任務定位為 integrated transfer test，不取代 hold-click/counterstrafe component assessments | 混合構念適合驗證技能轉移，不適合單一診斷分數 | Confirmed，T0 覆核通過 |
| **D-45.2** | 先修共用 occlusion kernel，再允許 scene-aware hit | 現況 target-only raycast 可穿牆；不修即無有效 peek task | Confirmed，T1 落地 |
| **D-45.8** | `occlusionGeometry.ts` 為獨立新 kernel，不與 `clearance.ts` 既有 `segmentIntersectsAabb` 合併 | `clearance.ts` 不在 T1 scope（README §2.1 未列）；用途不同（pre-spawn 驗證 boolean vs. runtime 曝光/命中 alpha+point）；FR-P45-3「同一 kernel」約束的是 visibility 與 hitscan 兩者之間，非全 repo 唯一一套 | Confirmed，T1 |
| **D-45.3** | 新建 `peek-ad-corridor-v1`，不改 frozen `peek-corridor` | 避免改變 stage6 hold-click geometry/history compatibility | Confirmed，T2 落地 |
| **D-45.9** | `peek-ad-corridor-v1` 用「單一中心柱沿 x=0 對半切」為 `cover-wall-l`/`cover-wall-r`,而非複製 `peek-corridor` 式「貼近各自目標」的側牆 | 貼近目標側的牆在玩家置中時無法遮住雙側視線(數值驗證：sightline 在該 z 帶穿過的 x 落在牆外);中心柱幾何才能同時滿足「置中雙側皆隱藏」與「x 軸鏡像」兩個 README invariant | Confirmed，T2 |
| **D-45.10** | T2 geometry tests 假設 target distance=8(沿用 peek-corridor 尺度),於 test 檔頂部註記為 T3 相容假設 | cover-wall 幾何常數是針對特定 distance 校準;T3 若改變 pilot distance 必須重驗本檔 invariants,避免悄悄失真 | Confirmed，T2；待 T3 覆核 |
| **D-45.4** | pilot 保留 box target、AK-47、嚴格 LR、miss 補槍 | 最小化新引擎分支並對齊影片循環；正式值留給 pilot | Confirmed，T3 落地 |
| **D-45.11** | `buildPeekClickTransferPilotConfigs`（`pilotConfigs.ts`）回傳扁平 `DrillConfig[]`，不回傳 wrapper（`PeekClickTransferPilotConfig[]`） | 比照既有四個 pilot 家族 builder 慣例（呼叫端自帶 sceneId/clearanceOptions 常數，同 `holdClickV1` 模式）；避免該檔出現兩種回傳形狀 | Confirmed，T3 |
| **D-45.12** | T3 gameplay/occlusion 測試不經 `fpsTestHarness.ts`，改在 drill 測試檔內直呼 `simStep`/`TargetManager`/`DrillRunner` | harness 合成 camera 固定於世界原點、不隨 `state.player.x` 位移（只有 `main.ts` render loop 才做這件事），無法端到端驗證「玩家橫移曝光」；直呼底層原語可控 camera 位置且比照 T1 `SimLoop.test.ts` 省略 weapon/recoilRuntime 避開極小 hitbox 的 spread 脫靶風險 | Confirmed，T3 |
| **D-45.5** | 不建立 composite score | 沿用 stage6「不同構念分層報告」紀律 | Proposed，T4 |
| **D-45.6** | Session 採 versioned roster，不改 stage6 default family list | 防止既有 participant order 全數漂移 | Proposed，T5 |

## Surprises / blockers

- None at planning time。
- T0 覆核：WP-44/WP-43 均已 T-exit 且早於本 WP 目前 HEAD，T3/T5 熱區未被同時修改，dependency gate 皆已開放，不需延後。
- CodeGraph 標記 `fireOneShot` 現況零測試覆蓋——非本 WP 引入的既有缺口，記錄供 T1 新增 occlusion gate 時一併補測試意識，不在 T0 修。
- T1：測試用「全阻擋牆」場景在 `loadDrill` 的 pre-spawn clearance 驗證（`validateClearance`）會直接拒入（牆同時擋住 spawn 前的玩家↔目標可見性），須以 `DrillLoadOptions.clearance.allowedOcclusionPropIds` 放行——這正是 `clearance.ts` 既有機制（供設計上「玩家淨空但允許遮擋」的牆體），不需新增介面；記錄供 T2 設計 `peek-ad-corridor-v1` 的 `cover-wall` 參考同一放行模式。
- T1：`fpsTestHarness.ts` 的 `sceneConfig`（outer `let SceneConfig | undefined`）在 `startDrillWithScene` 內被 closure 捕捉，導致賦值後的 narrowing 在後續呼叫其他函式後失效（TS18048）；改用區域 `const resolvedScene` 承接後即恢復型別窄化，此為一般 TS control-flow 對可變 closure 變數的已知限制，非本 WP 邏輯問題。

## Open Questions

- 無新增；OQ-S9-5/S9-6/S9-7 維持 README 既定 owner/deadline，不受 T0 影響。

## Verification log

| Date | Command | Result |
|---|---|---|
| 2026-08-26 | `git rev-parse HEAD` / `git status --short` | HEAD=`41d3bd5`；working tree 乾淨 |
| 2026-08-26 | `npm.cmd test -- src/metrics/visibilityDerivation.test.ts src/sim/HitDetector.test.ts src/loop/SimLoop.test.ts` | exit 0，3 files / 73 tests passed |
| 2026-08-26 | `npm.cmd test -- src/session/sessionSchedule.test.ts src/session/SessionRunner.test.ts` | exit 0，2 files / 15 tests passed |
| 2026-08-26 | `mcp__codegraph__codegraph_explore`(6 core symbols) | blast radius 記錄如上；無 staleness banner |
| 2026-08-26 | `npx vitest run src/metrics/visibilityDerivation.test.ts src/loop/SimLoop.test.ts src/sim/HitDetector.test.ts` | exit 0，3 files / 73 tests passed（T1 wiring 後，DoD 指定套件） |
| 2026-08-26 | `npx vitest run tests/regression src/loop/__tests__ src/testharness src/scene` | exit 0，27 files / 167 tests passed（blast-radius 回歸） |
| 2026-08-26 | `npx vitest run`（全專案） | exit 0，133 files / 1014 tests passed |
| 2026-08-26 | `npm run typecheck` | exit 0 |
| 2026-08-26 | `node scripts/gen-peek-ad-corridor-gltf.mjs`（連跑兩次 + `diff`） | 產物 byte-identical |
| 2026-08-26 | `npx vitest run src/scene/scenes/peek-ad-corridor.test.ts src/scene/clearance.test.ts` | exit 0，2 files / 28 tests passed（T2 DoD 指定套件） |
| 2026-08-26 | `npx vitest run`（全專案，T2 wiring 後） | exit 0，134 files / 1026 tests passed |
| 2026-08-26 | `npm run typecheck`（T2 wiring 後） | exit 0 |
| 2026-08-26 | `git status --short`（T2 完成後） | 只有本 task 新檔;frozen `peek-corridor` 三檔零 diff |
| 2026-08-26 | `npx vitest run src/pilot/pilotConfigs.test.ts` | exit 0，5 tests passed（新 builder 加入 `allConfigs()` 後仍全綠） |
| 2026-08-26 | `npx vitest run src/drill/peek_click_transfer_pilot_v1.test.ts` | exit 0，11 tests passed |
| 2026-08-26 | `npx vitest run src/drill/peek_click_transfer_pilot_v1.test.ts src/testharness/fpsTestHarness.test.ts` | exit 0，23 tests passed（T3 DoD 指定套件） |
| 2026-08-26 | `npx vitest run`（全專案，T3 wiring 後） | exit 0，135 files / 1037 tests passed |
| 2026-08-26 | `npm run typecheck`（T3 wiring 後） | exit 0 |
| 2026-08-26 | `git status --short`（T3 完成後） | 只有本 task 預期檔案（2 新檔 + `main.ts`/`pilot/pilotConfigs.ts`/`pilot/pilotConfigs.test.ts` 修改） |
