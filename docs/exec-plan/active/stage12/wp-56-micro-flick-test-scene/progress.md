# WP-56 — progress.md

> 主規格：[README.md](README.md) · 清單：[task-checklist.md](task-checklist.md)

## Progress

| Task | Status | Started | Completed | Evidence |
|---|---|---|---|---|
| T0 Entry Gate | Complete | 2026-09-04 | 2026-09-04 | Engine/GLTF/sampling PoC全綠；OQ-56.2／3由使用者明確T1指令解除 |
| T1 Contract and Fixtures | Complete | 2026-09-04 | 2026-09-04 | targeted 93 tests、full Vitest 2099 tests、typecheck/build exit 0 |
| T2 Three-target Lifecycle | Complete | 2026-09-07 | 2026-09-07 | initial/replacement/tail/restart/fallback、10k invariants、四FPS parity與full Vitest全綠 |
| T3 Corridor Scene and Presentation | Complete | 2026-09-07 | 2026-09-07 | 21-mesh GLTF、inventory/projection/contrast、rapid/late load、50-cycle resources、full Vitest/build全綠 |
| T4 Fixed Player, Hit and HUD | Complete | 2026-09-07 | 2026-09-07 | locked SimLoop policy、exact-ID sphere hit→next-tick replacement、live HUD/crosshair E2E、full Vitest/build全綠 |
| T5 Automated Integration and Performance | Complete | 2026-09-07 | 2026-09-07 | browser/harness lifecycle、20-sample cached-load P95、10k warmed hot-path P95與full regression evidence全綠 |
| T6 Visual Acceptance | Complete | 2026-09-07 | 2026-09-07 | four Edge/WebGPU captures + metadata；review Pass，fallback accepted difference，blocking=0 |
| T-exit | Complete | 2026-09-07 | 2026-09-07 | 兩個T5 rerun失敗診斷為測試前提缺陷並修正；FR/NFR traceability、A-56.1～12、boundary scans、full Vitest／build／Playwright gates全數入帳 |

## Decision Log

| ID | Date | Decision | Owner | Evidence |
|---|---|---|---|---|
| D-56.P1 | 2026-09-04 | 場景是固定位置的灰白狹長 Micro Flick 走廊，同時三顆紅色球形目標，命中後補位 | 使用者 | 對影片理解的明確確認 |
| D-56.P2 | 2026-09-04 | 不製作槍枝模型；規劃同時排除手臂／weapon view model | 使用者 | 原始需求 + 確認訊息 |
| D-56.P3 | 2026-09-04 | 規劃文件採 stage10/WP-50 的 README、checklist、progress、T0～T6、T-exit 結構 | 使用者 | 本文件組 |
| D-56.P4 | 2026-09-04 | v1 recommended default 為 researcher-only／practice；不宣稱 Assessment 或 full replay | Planning default，待OQ-56.4 | README §1.4/§3.2 |
| D-56.P5 | 2026-09-04 | Population PoC沿用`TargetManager` interface + 真實`DrillRunner`；production最小改法是在既有manager內加入optional maintain-population mode，不建第二套runner/state | Engineering | 6-target lifecycle PoC；7.8125 ms replacement；restart hash一致 |
| D-56.P6 | 2026-09-04 | Sampling採固定32次bounded rejection；超限以固定63-cell farthest grid作deterministic fallback，禁止unbounded loop／`Math.random()` | Engineering，待T1以owner-selected bounds落地 | A/B各12,000 samples，fallback/failure=0 |
| D-56.P7 | 2026-09-04 | Translation lock最小seam為`createSimLoop` additive option選擇locked `MovementController`；mouse aim／Pointer Lock路徑不關閉 | Engineering | 真實`simStep`注入PoC保持x/z固定且yaw/pitch不變 |
| D-56.P8 | 2026-09-04 | GLTF方案沿用`SceneAssetLoader`→`SceneManager`→fallback/dispose；asset只含環境，target由既有`TargetView` pool呈現 | Engineering | 21-mesh inventory、draw-call上界24、pool=3 after 1,000 replacements |
| D-56.P9 | 2026-09-04 | 數值工程推薦Candidate A（75° FOV、yaw ±22°、pitch ±12°、3°球、7° separation、12–14u、60 kills），但未取得影片與owner確認前不凍結、不解鎖T1 | Engineering recommendation only | projection/sampling PoC；explicit OQ-56.2／3 blocker |
| D-56.P10 | 2026-09-04 | 使用者明確要求實作T1，採用Candidate A與60-kill target quota，並以seed=56001凍結exact practice fixture | 使用者 + Engineering | Alternatives Considered：Candidate B與30秒time-limit；未選，因Candidate A畫面密度較保守且60-kill tail可直接做deterministic acceptance |
| D-56.P11 | 2026-09-04 | T1先註冊asset-null的`micro-flick-room` scene contract，固定scene id、75° FOV、eye pose與room envelope；T3再以同ID升級為approved GLTF | Engineering | Alternatives Considered：只存sceneId字串但不註冊（researcher選取會失敗）、T1提前製作GLTF（越過T3）；選擇可載入的最小contract fixture |
| D-56.P12 | 2026-09-07 | Population spawn保留既有horizontal `distanceURange`語意，以`TARGET_Y + tan(pitch) * distance`投影垂直角；每個spawn最多32次seeded rejection，失敗後掃固定9×7 cell centres並取最大最小角距，仍不可行則明確throw；DrillRunner production不改 | Engineering | Alternatives Considered：把distance改為完整球面半徑（會改既有spawn distance語意）、只在32次後throw（放棄T0凍結fallback）、新增runner killed counter（tests證明`seenIds - targets.length`已可泛化，無需增加狀態） |
| D-56.P13 | 2026-09-07 | 走廊採21個environment nodes共用3個cube primitives（floor/wall/ceiling），以18片側牆panel間隙呈現規則接縫；live async scene切換新增共用generation coordinator，late manager在掛入前dispose | Engineering | Alternatives Considered：每片panel各自primitive（draw-call/asset膨脹）、程序化scene-id特例（繞過既有GLTF pipeline）、只補測不修live race（rapid switch可讓舊load覆蓋新選擇）；均未採 |
| D-56.P14 | 2026-09-07 | translation lock採`SimLoopOptions.translation`於建 loop 時選擇固定的movement dependency；locked tick清零`vx/vz`並標記stopped，但不關閉input consumption或CameraController mouse aim | Engineering | Alternatives Considered：在`afterTick`回寫位置（觀測hook違反來源單向性且會留下瞬時位移）、複用`protocolGuard.noMovement`（只記違規、不阻止integration）、改InputSampler忽略按鍵（會破壞input trace）；均未採 |
| D-56.P15 | 2026-09-07 | browser gate先以researcher UI載入真實live scene，再以既有dev-only `FpsTestHarness`驅動精準命中、60-target end與restart；native Pointer Lock正向取得仍保留給T6 manual，避免把Edge automation limitation誤當玩法缺陷 | Engineering | Alternatives Considered：新增可寫入live singleton的test API、或mock Pointer Lock；未選，因會擴張production觀測縫或測到非瀏覽器權威狀態。harness與production共用DrillRunner／TargetManager／SimLoop。 |
| D-56.P16 | 2026-09-07 | T6 capture以實際researcher入口與Pointer Lock取景，初始／replacement／720p為Micro Flick baseline；強制GLTF失敗顯示既有generic placeholder，列為accepted fallback difference而非視覺baseline | Engineering | Alternatives Considered：把fallback畫面當作Micro Flick corridor驗收、或為capture注入mock scene；未選，前者混淆失敗路徑目的，後者不再是production fallback。 |
| D-56.P17 | 2026-09-07 | T5的兩個Micro Flick browser gate為**測試前提缺陷**，修在`tests/e2e/micro-flick-live.spec.ts`，production code不動：60-target gate的tap cadence由120 ms改為500 ms；cached-load gate的reset leg由`#scene-select`+`counterstrafe_ad_v1`改為`detection_popin_v1`，量測終點由「3靶可見」改為app寫回的scene dropdown | Engineering | Alternatives Considered：①在harness內把recoil歸零或改用大彈匣武器——會讓gate測到非production的武器語意；②`markKilled`後同步補位以掩蓋脫靶——違反D-56.P3的next-tick契約且掩蓋FR-56.9；③在`#scene-select`加change listener讓原測試成立——那是WP-56範圍外的UI行為變更，且`loadSceneById`會用micro-flick重驗`field-low`而依設計throw（clearance）；④改用loop-until-ended驅動預算——放棄固定序列的決定性。均未採。 |

## Open Questions（狀態）

| ID | Status | Owner | Deadline | Notes |
|---|---|---|---|---|
| OQ-56.1 | Resolved | 使用者 | 2026-09-04 | 核心場景／玩法／no-gun scope已確認 |
| OQ-56.2 | Resolved | 使用者 + Gameplay owner | 2026-09-04 | 使用者明確要求實作T1，採Candidate A；T6仍需manual visual sign-off |
| OQ-56.3 | Resolved | Gameplay owner | 2026-09-04 | 採60-kill target quota |
| OQ-56.4 | Closed for v1；仍待owner決定是否另開WP | Product/Research owner | 2026-09-07（v1部分） | v1確定practice-only並以自動負向測試守住（no participant/assessment registry、no full replay profile、no history write）。「是否升為Assessment／full replay」不在WP-56交付內，且**不得**只把`mode`改為`assessment`——所需的multi-target tick snapshot／replay sampling／exact profile／指標效度／history相容見README §5 handoff contract |
| OQ-56.5 | Resolved | Engineering default | 2026-09-07 | 沿用既有score/time/hit-rate/velocity HUD；不加入影片式FPS、ammo或editor UI |

## Planning Evidence（2026-09-04）

- `DrillConfig` 約115 consumers、`SceneConfig` 約79 consumers；新契約須 additive/optional。
- `TargetManager` 目前以 `hasAliveTarget()` 限制單 active；三靶是 engine lifecycle change，不是純 config。
- `SpawnAreaConfig` 缺 vertical/pitch；現有 target center固定 `TARGET_Y=1.5`。
- `HitDetector.raycastWithRay()` 已支援多 active targets並取最近命中。
- `TargetView` 已有 sphere geometry與mesh pool，可重用到三靶。
- `Crosshair` 已固定screen center且與camera中心射線同源。
- 現有 live scene graph沒有第一人稱槍／手view model；no-gun以asset/scene regression守住。
- WP-50 replay既有官方 profile/capture以單target為基礎，故v1保持practice-only。

## T0 Evidence Log

- 開工HEAD=`bc319c53c687a22eb1c9b286e62c540169c454a2`；baseline期間另一個並行工作把HEAD推進到WP-55 T7 commit `ce75b6868ebf8cc3601da10baeab088340fde718`。開工status已有`.claude/settings.local.json`及未追蹤`docs/algorithm/micro-flick/*`；執行中一度出現不屬本task的`.gitignore`、`package.json`、Stage 11/WP-55、tracking scripts/tests變更並由該工作獨立commit，本task未觸碰／stage。
- Baseline：typecheck exit 0；Vitest 216 files passed + 1 skipped／2071 tests passed + 2 skipped；build exit 0（只有既存chunk warning）。Playwright 79 passed／4 failed；單worker targeted rerun5 passed／4 failed，固定為preview root lock 3項（HTTP 423）與overlay helper回`null` 1項；production diff=0下已存在，本task不越界修。
- PoC cleanup後CodeGraph final impact：`DrillConfig`117、`SpawnAreaConfig`6、`validateDrill`3、`createTargetManager`39／`TargetManager`28、`createDrillRunner`28／`DrillRunner`9、`createSimLoop`31／`simStep`20／`SimLoop`5、`SceneConfig`79／`SceneManager`15、`raycastWithRay`6、`TargetView`3。無pending/stale banner。
- Throwaway PoC最終8 tests全綠：三靶fill→kill exact one→兩survivors逐位不變→7.8125 ms next-tick replenish；budget=6尾段ended；restart SHA-256=`9a1e23ba8a5dbb77116967e339d603bf80062da3ee1bf84105fe12c81b948ab5`。
- Sampling A：n=12,000、P95/max=3/8、worst seed=94、fallback/failure=0、hash=`982cad85335094a74ccd9b187ced5665da9aee8e2744d91d2b7392d717b3d247`。B：n=12,000、P95/max=2/7、worst seed=125、fallback/failure=0、hash=`3e102fc00809b42d2da58160157fc15e0ac9cd164e90ebaee31d95c8d0b2d971`。
- Projection A：NDC max=(0.3187,0.3412)、1080p margin=(654.0px,355.8px)、diameter=36.9px@1080／24.6px@720、sphere=0.6808u。B：NDC max=(0.4591,0.4951)、margin=(519.2px,272.7px)、diameter=47.1px／31.4px、sphere=0.9166u。兩者scene clearance全綠；只證明安全、不替代影片構圖。
- GLTF PoC：先以注入group驗SceneManager load/fallback/dispose，再以embedded-buffer最小glTF 2.0走真實`GLTFLoader.parseAsync()`；21 environment meshes（含ceiling／18 panels）、禁用asset name命中0、連3 targets draw-call上界24、mount/dispose全綠；`TargetView.poolSize===3` after 1,000 replacements。
- Translation PoC：真實`simStep`注入locked controller後x/z與camera base snapshot固定、vx/vz=0、yaw/pitch不變；`createSimLoop`需additive policy seam。
- WP-50／History：micro-flick exact與相近suffix都無replay profile；既有Practice persistence tests維持不保存策略。
- `Media1.mp4`未出現在workspace；未提交影片、衍生影格、截圖或PoC asset。詳細commands、候選表、blast radius與限制見[T0-entry-gate.md](T0-entry-gate.md)。PoC test已於記錄證據後清除，production code diff=0。

## Surprises & Discoveries（T0）

- baseline執行中HEAD被並行WP-55 T7工作推進；本task以開工HEAD與收尾HEAD雙記錄，未stage／改寫該工作。這也使全量Playwright只能作dirty-worktree baseline，不能歸因給WP-56。
- Node headless執行真實`GLTFLoader.parseAsync()`時沒有browser的`ProgressEvent`，第一次PoC因此5 s timeout並回`ReferenceError: ProgressEvent is not defined`；throwaway test加入最小test-only polyfill後1 test通過。這是Node harness缺browser global，不是production GLTF pipeline缺陷。
- bounded sampling的較寬Candidate B attempt P95/max（2/7）優於A（3/8），但兩者遠低於32次上限且fallback=0；選A的理由是較保守的畫面密度／尺寸，不是sampling效能較好。

## T1 Evidence Log

- `DrillConfig`新增optional `TargetPopulationConfig`、`SpawnAreaConfig.pitchDegRange/minAngularSeparationDeg`與`PlayerControlConfig`；省略時不注入defaults，legacy canonical JSON parse output逐位不變。
- `validateDrill`新增`activeCount` 1..16且`<=targets.count`、`replacement='next-tick'`、seed、pitch ±89°安全界、separation (0,180]°、obvious-impossible angular field與population/cue/spider/tracking/presentation/spawn-delay互斥驗證；所有錯誤帶field path。
- exact fixture：`drillId=micro_flick_three_target_test_v1`、`sceneId=micro-flick-room`、practice、translation locked、population=3、yaw ±22°、pitch ±12°、distance 12–14u、7° separation、3° sphere（0.680834u @ 13u）、60 kills、seed=56001。
- researcher registry已綁定exact drill/scene；T1 scene contract為asset-null procedural envelope（75° FOV、eyeZ=0、16×36×12 room），T3維持同sceneId升級GLTF與presentation。
- 最新CodeGraph blast radius：`DrillConfig`117 callers（cross-module，27+ production files／11+ test files）；`SpawnAreaConfig`6 callers（config/schema/clearance）；`validateDrill`3 callers（local implementation、cross-contract）；`availableDrills`2、`AvailableScene`3（main registry local）；`classifyReplaySupport`4且`createHistoryPersistence`3（只加negative tests，production未改）。
- Targeted：`npx.cmd vitest run src/drill/micro_flick_three_target_test_v1.test.ts src/drill/schema.test.ts src/scene/SceneConfig.test.ts` → 3 files／93 tests passed。
- `npm.cmd run typecheck` → exit 0。`npm.cmd test -- --reporter=default` → 218 files passed + 1 skipped／2099 tests passed + 2 skipped。`npm.cmd run build` → exit 0、166 modules、bundle 1,190.42 kB（gzip 338.95 kB），只有既存>500 kB warning。
- Sandbox內全量Vitest／Vite build首次因esbuild無權讀取workspace父目錄而無法載入`vite.config.ts`；以相同命令在已核准sandbox外重跑均exit 0。T1未跑Playwright：browser lifecycle／visual acceptance由T5/T6負責，且T0已記錄既存4項baseline failures。
- `graphify update .` → 554/554 code files re-extracted，4274 nodes／10250 edges／254 communities。

## T2 Evidence Log

- 開工前CodeGraph blast radius：`createTargetManager` 39 callers／`TargetManager` 28 consumers，屬cross-module High；graphify將`createTargetManager()`列為50-edge god node，目標狀態流維持`TargetManager → SharedState.targets → TargetView`。
- `TargetManager.tick()`新增optional population分支：每個sim tick以bounded `for`補到`activeCount`且不超過`targets.count`；legacy無population仍走原`hasAliveTarget()`單靶路徑，既有seeded yaw→distance抽樣順序不變。
- population候選以seeded yaw→pitch→distance抽樣；pitch相對既有`TARGET_Y` sightline投影。pair separation以中心相對unit directions計算；固定32次rejection後走9×7（63-cell）deterministic farthest fallback，不可容納時以固定訊息失敗，無unbounded loop／`Math.random()`／render clock。
- exact-ID lifecycle：initial tick產生`t0/t1/t2`且各一筆visible event；撤`t1`後`t0/t2` ID/position逐位不變，下一個7.8125 ms tick補`t3`；unknown與double kill均no-op且不消耗budget。
- budget tail測得`3 → 3 → 3 → 2 → 1 → 0`；真實`DrillRunner`在6-target budget完成後進`ended`，restart清空IDs並重建相同seed opening trace；peek timeout每tick至多撤一個且最終正確達targetCount。runner既有`seenIds.size - state.targets.length`已成立，production source未修改。
- property/regression：10,000 replacements全數finite、yaw±22°、pitch±12°、horizontal distance 12–14u、unique active IDs且pair separation≥7°；同seed SHA-256 trace一致、不同seed不同；30/60/144/240 render FPS的96-tick replacement trace逐位一致且包含多個replacement IDs。
- Targeted：`npx.cmd vitest run ...`（TargetManager population/legacy、DrillRunner、schema、micro-flick fixture、moving-target determinism）→ 6 files／196 tests passed；10k property case 3.478 s（含每次全invariant assertions，非T5 production P95 benchmark）。
- `npm.cmd run typecheck` → exit 0。sandbox內full Vitest／Vite build因esbuild無權讀workspace父目錄而啟動失敗；依既有T1環境處理在sandbox外重跑：full Vitest 219 files passed + 1 skipped／2147 tests passed + 2 skipped；build 166 modules、1,193.96 kB（gzip 340.06 kB），僅既存>500 kB warning。
- `graphify update .` → 555/555 code files re-extracted，4298 nodes／10315 edges／273 communities。

## Surprises & Discoveries（T2）

- `DrillRunner`註解雖寫單active，但其實際count公式對「補位時固定3、budget尾段逐步下降」自然成立；新增三靶target-count／restart／timeout tests後無須更動runner production code，縮小了原先預估的cross-module修改面。
- 10k invariant測試的時間主要來自每次Vitest assertions（targeted 3.478 s；full-suite並行時6.409 s），因此只作correctness/stress evidence；NFR-56.4的warmed P95仍保留給T5專用benchmark，不把此數字誤報為hot-path latency。

## T3 Evidence Log

- `micro-flick-room`由T1的asset-null contract升級為`micro-flick-room-v1` local GLTF；stable scene id、75° FOV、`eyeZ=0`、1.6u eye height與16×36×12 envelope不變。
- asset inventory為21個environment mesh nodes：floor、deeper ceiling、end wall與左右各9片panel；共用3個unit-cube primitives/materials，environment draw-call上界21，連3顆targets上界24。所有node transforms finite且positive scale；buffer為embedded data URI，無remote/external dependency。
- allowlist與production `GLTFLoader.parseAsync()` gate證明無camera/light及`weapon|gun|rifle|pistol|hand|arm|muzzle|target`名稱；真實parser產生exact 21 meshes。
- 1920×1080與1280×720以真實`SceneManager.camera`投影Candidate A四角及完整球半徑，均保留至少24 CSS px safe region；world `(0, 1.6, -18)`投影中央誤差≤1 px。實際`TargetView`紅色material對spawn-zone wall base colour contrast≥3:1。
- sphere presentation連跑1,000 replacements後`poolSize===3`，mesh geometry均為`SphereGeometry`且三軸scale直接讀同一hitbox diameter；dispose後pool與scene children歸零。
- T3 discovery發現README所稱既有live scene generation seam實際只存在replay path；新增通用`SceneLoadCoordinator`並接到`activateDrill`／`loadSceneById`。rapid A→B、same-scene/no-load supersession與dispose-before-late-arrival都會在掛入前dispose stale manager。
- 50次enter/switch/leave每輪均維持2 lights + 1 asset group + 3 pooled target meshes，離開後scene children歸零且asset geometry/material各dispose一次；`SceneManager`／`TargetView`／coordinator不註冊DOM listeners。
- Targeted：6 files／60 tests passed；`npm.cmd run typecheck` exit 0。sandbox內full Vitest／Vite build仍因既知esbuild父目錄權限失敗；核准sandbox外重跑：221 files passed + 1 skipped／2166 tests passed + 2 skipped；build 167 modules、1,194.58 kB（gzip 340.30 kB），僅既存>500 kB warning。
- `graphify update .`完成560/560 code files、4323 nodes／10393 edges／273 communities；執行時另有平行WP-54 tracking變更，故graphify產物保留unstaged，避免混入本T3 commit。

## Surprises & Discoveries（T3）

- live `main.ts`原本直接await scene load後無條件install；rapid scene/drill選擇會讓較慢的舊請求最後覆蓋新選擇。Replay已有per-session late-dispose，但live沒有可沿用的generation gate；T3因此新增小型共用coordinator，不建立micro-flick專用旗標。
- 走廊21個nodes可共用3個GLTF mesh primitives；規則panel接縫不需要18份重複vertex buffers，符合T0 draw-call上界且把資產維持在單一embedded GLTF。

## T4 Evidence Log

- `SimLoopOptions`新增optional `translation`，省略或`enabled`逐位保留既有`MovementController`；live `buildSimLoop()`單次從`activeDrillConfig.playerControl`傳入。`locked`仍消費W/A/S/D input，並於每個128 Hz tick清零`vx/vz`、設`stopped=true`，使player、prev/curr render snapshot固定；CameraController／mouse aim路徑未關閉。
- SimLoop regression以10秒（1,280 ticks）W/A/S/D synthetic timeline、非零初始position/velocity與mouse delta驗證position、velocity、prev/curr不變且yaw/pitch保留；legacy drill省略policy仍會正常移動。
- 真實micro-flick config integration：first tick生成`t0/t1/t2`三個sphere，中心射線只命中最近`t0`，fire event寫`hit=true,targetId=t0`且recorder counts為1；survivors `t1/t2`在本tick不變、下一tick才補`visible(t3)`。
- live Edge browser test經researcher入口載入exact drill/scene，確認三個live targets、KeyD後固定player、HUD仍呈現score/time/hit-rate/STOP，以及1280×720／1920×1080 crosshair中心分別為(640,360)／(960,540)。原生Pointer Lock正向取得屬既有manual-only瀏覽器限制；CameraController unit coverage與此live test共同守住mouse-aim不被lock關閉。
- practice-only／history exclusion／non-full replay為fixture negative tests：沒有participant/assessment registry、沒有exact或near-miss full replay profile，且HistoryPersistence在呼叫client前short-circuit。
- Verification：targeted 5 files／137 tests passed；`npx.cmd playwright test tests/e2e/micro-flick-live.spec.ts --project=edge` exit 0；`npm.cmd run typecheck` exit 0；full Vitest 222 files passed + 1 skipped／2178 tests passed + 2 skipped；`npm.cmd run build` exit 0（僅既存bundle warning）；`graphify update .`完成561/561 code files、4328 nodes／10404 edges／261 communities。

## T5 Evidence Log

- 新增`src/sim/micro-flick-performance.test.ts`：相同three-target population hot path先warm 100次、量10,000次`TargetManager.tick + TargetView.sync`（不含assertion/serialization）。Node/V8 full-suite run P95=`0.0115 ms`、max=`2.1154 ms`，低於NFR-56.4的`1 ms`；pool與scene mesh count均維持3。focused run P95=`0.0050 ms`、max=`0.6746 ms`。
- `tests/e2e/micro-flick-live.spec.ts`新增browser/harness acceptance：researcher UI載入exact drill/scene和三靶；harness fire記錄`visible t0..t3`及`fire(hit=true,targetId=t0)`；60個tap完成target budget、phase=`ended`，restart opening sequence相同。這補足live UI與同源domain lifecycle之間的gate；T2既有property tests仍驗survivor position、stale ID/miss、budget tail和30/60/144/240 FPS trace。
- cached first-visible-frame gate在Edge desktop、dev build、1280×720、無額外background load下作20個`field-low → micro-flick-room` cached transaction samples；每次待scene id與3 visible targets完成，P95符合`<1,500 ms` gate。測試先等待field drill transaction實際落為1靶，避免DOM select value已變但async activation尚未完成的race。
- scene failure／rapid switch／late dispose的production manager lifecycle由`SceneLoadCoordinator.test.ts`和`micro-flick-room.test.ts`的50-cycle dispose spies覆蓋；stale／unknown target ID與miss不補位由`TargetManager.population.test.ts`與T4 integration覆蓋；no-weapon、practice-no-history、non-full-replay負向契約維持T1/T3/T4 gates。
- Verification：`npm.cmd test -- --reporter=default` → 223 files passed + 1 skipped／2179 tests passed + 2 skipped；`npm.cmd run typecheck`完成無diagnostic；`npx.cmd vite build` → exit 0、167 modules、1,194.71 kB（gzip 340.34 kB），僅既存>500 kB warning；focused及full `npm.cmd run test:e2e` Edge runs完成且無failure artifacts。Sandbox內Vitest/Vite的esbuild父目錄讀取限制維持以核准sandbox外命令執行。

## T6 Evidence Log

- `scripts/capture-wp56-visuals.mjs`新增可重跑的local Edge capture runner；以researcher-only控制列載入exact drill，確認Pointer Lock後移除控制項／dev readout再截圖。replacement keyframe以同一live InputSampler→SimLoop→HitDetector pipeline命中frozen opening `t0`；其行為正確性仍由T2/T5 gate權威覆蓋，runner只建立可重現視覺視角。
- `npm.cmd run capture:wp56-visuals` exit 0；產生1920×1080 initial/replacement/fallback、1280×720 initial及metadata。Edge 151.0.4129.101、headless、DPR1、WebGPU API available；drill seed=56001、scene asset=`micro-flick-room-v1`。replacement metadata=`t1/t2/t3`，證明畫面中的三靶為兩survivors + replacement。
- Visual review：走廊構圖、surface hierarchy、panel seams、三靶辨識、center crosshair、no-weapon scope、HUD與safe region全Pass；沒有Kovaak editor／FPS／ammo UI或weapon/hands/muzzle/shadow。強制abort GLTF後的generic placeholder為預期fallback evidence，且維持HUD／crosshair與live targets state；列accepted difference，不作primary baseline。blocking differences=0。
- Post-review regression rerun：`npm.cmd run typecheck` exit 0；capture runner exit 0。`npx.cmd playwright test tests/e2e/micro-flick-live.spec.ts --project=edge --workers=1` 則為 2 passed／2 failed，重現T5的60-target harness最後仍為`running`（預期`ended`）及cached researcher selection保持`field-low`（預期`micro-flick-room`）。sandbox內同命令先因已知esbuild parent-directory讀取限制失敗；核准sandbox外重跑仍相同，故非sandbox或parallel flake。此rerun失敗沒有在T6 capture runner／文件變更前修正，T-exit保持blocked；不將未診斷的T5修正混入本T6 slice。

## Surprises & Discoveries（T6）

- T6 screenshot capture需要Pointer Lock才能移除lock hint並取得真實中心準星；Edge headless在第二次native canvas click可取得lock。capture runner以frozen target bearing建立replacement keyframe，並以metadata記錄`targetIds`，不把視覺工具當作lifecycle correctness gate。
- T5 browser regression在single-worker及parallel rerun都重現。`87926dd..HEAD`的production code diff只涉及WP-57 Spider wide-flick branch in `TargetManager`，但尚未建立將它與兩個Micro Flick症狀相連的最小repro；依scope/increment紀律，本T6不改共同manager或E2E測試來掩蓋問題。

## T-exit Evidence Log

### T-exit 診斷：T5兩個browser gate的repeatable失敗（2026-09-07）

T6留下的blocker在T-exit開工時以`--workers=1`穩定重現（2 passed／2 failed）。T6曾懷疑`87926dd..HEAD`的WP-57 spider branch，**該懷疑不成立**：commit `56e7d99`與其後的未提交改動全部gated在`spiderShot.kind === 'center-peripheral-yawpitch'`／`'center-peripheral-eye-stratified'`，micro-flick沒有`spiderShot`，執行不到那些分支。兩個失敗是**各自獨立的測試前提缺陷**，production code無缺陷。

**失敗①「60-target budget停在`running`」— root cause = tap cadence低於recoil衰減窗。** Node harness探針量到`fires=60 hits=59 visibles=60`——恰好一發脫靶，故kill=59 < `endCondition.targetCount=60`。脫靶那發的匯出事件為`recoilIndex=10.16`、`aimPunch=(-3.72°,-2.66°)`、`spread=(0.70°,0.33°)`。原因：`aimAtActiveTarget()`只補償**開火前一tick取樣**的punch，且完全無法補償每發隨機spread，而Micro Flick球在13 u僅約**1.44°角半徑**；120 ms的tap間隔短於ak47（cycletime 100 ms）的punch衰減，recoil跨tap累積。cadence掃描證據：

| tap interval | phase | hits/fires | max recoilIndex | max spread |
|---|---|---|---|---|
| 120 ms | running | 59/60 | 19.07 | 0.774° |
| 200 ms | ended | 60/60 | 2.01 | 0.563° |
| 300 ms | ended | 60/60 | 0.73 | 0.447° |
| **500 ms（採用）** | ended | 60/60 | **0.20** | **0.378°** |
| 800 ms | ended | 60/60 | 0.04 | 0.356° |

採500 ms＝cycletime的5倍，spread僅為目標角半徑的26%。60 × 500 ms = 30 s = 3,840 ticks，遠低於recorder arena的38,400 tick容量（`capacityForDrill`，300 s @128 Hz），無overflow。脫靶不消耗預算本身就是FR-56.9的正確行為，故不得以production改動掩蓋。

**失敗②「`#scene-select`停在`field-low`」— root cause = 測試假設了兩個不存在的app行為。** 瀏覽器內trace（暫時instrumentation，已移除）顯示：
- `#scene-select`**沒有`change` listener**（[Controls.ts](../../../../../src/ui/Controls.ts) 只有Load scene按鈕接`onLoadScene`），故`selectOption('field-low')`只改DOM值、不驅動任何載入，反而讓dropdown與`activeSceneConfig`**去同步**。
- `counterstrafe_ad_v1`在`availableDrills`**未宣告`sceneId`**（trace: `requiredScene: undefined`），故選它也不換場景。

因此iteration 0之後app再也離不開`micro-flick-room`：選micro-flick drill時`needsSceneLoad=false` → `installSceneLoad`不執行 → `setSelectedScene`不執行 → dropdown永遠保持Playwright強設的`field-low`，20 s timeout。**推論：T5記錄的「20-sample cached-load P95」evidence無效**——iteration 0之後沒有任何一個sample量到真實transaction，`.toBe(3)`也是被殘留的micro-flick靶立即滿足。此為T5證據的honesty更正，已一併入帳。

修法：reset leg改用`detection_popin_v1`（`availableDrills`中真正pin `field-low`的drill），量測終點改為`installSceneLoad`寫回的scene dropdown值。另注意`loadSceneById('field-low')`在micro-flick為active drill時**依設計throw**（Node探針：clearance驗證失敗，tree-b1/tree-b2/rock-b1…遮擋±22°spawn範圍），故「選scene回field-low」本就不是合法的reset路徑。3靶斷言移到迴圈後執行一次，因為drill自帶的3 s countdown屬protocol、不屬scene load latency（NFR-56.6量的是first visible scene frame）。

**修後結果**：`npx.cmd playwright test tests/e2e/micro-flick-live.spec.ts --project=edge --workers=1` → **4 passed**（6.5 s／5.9 s／2.0 s／6.9 s）。cached researcher selection在20個真實transaction下 **p50=17.0 ms、p95=62.0 ms、max=72.1 ms**，遠低於NFR-56.6的1,500 ms gate（先前的數字不可用）。`npm.cmd run typecheck` exit 0。

### T-exit automated gates（2026-09-07，HEAD=`9e42c7e`）

| Gate | 命令 | 結果 |
|---|---|---|
| typecheck | `npm.cmd run typecheck` | **exit 0**（browser + node tsconfig 皆無 diagnostic） |
| 全Vitest | `npm.cmd test -- --reporter=default` | **232 files passed + 1 skipped／2325 tests passed + 2 skipped** |
| build | `npm.cmd run build` | **exit 0**、1,203.22 kB（gzip 342.71 kB），僅既存 >500 kB chunk warning |
| Micro Flick E2E | `npx.cmd playwright test tests/e2e/micro-flick-live.spec.ts --project=edge --workers=1` | **4 passed**（6.5／5.9／2.0／6.9 s） |
| 全Playwright | `npm.cmd run test:e2e` | **86 passed／1 failed** — 見下方既存失敗 |
| boundary scans | grep（engine／spawn／asset） | 全通過：`src/sim`／`src/loop`／`DrillRunner`／`src/render`／`src/state` 無 micro-flick drill/scene id 特例；`src/sim`／`src/recoil`／`src/loop` 的 `Math.random` 與時鐘字樣**只出現在禁止用法的註解**、無實際呼叫；GLTF 節點僅 floor／ceiling／end-wall／side-panel-*／unit-cube-*／mat-* |

**全Playwright 的 1 個失敗不屬 WP-56，且已精確定位**：`tests/e2e/overlay-layering.spec.ts:74`「session launch controls do not overlap the settings panel」的第二個斷言 `overlapsSettingsPanel(7)` 回 `null`。helper 在 `launchButtons.length !== expectedCount` 就 short-circuit，因此**根本沒跑到重疊判定**——真正原因是 `ResearcherMenu` 現有 **4** 個子選單項（單一 drill 控制、解析度×偵測 protocol、BR 跟槍 protocol、**WP-54 tracking pilot manifest**），展開後共 8 個可見按鈕，而測試仍硬編 7。該第 4 項由 WP-54 加入，這也正是 T0（2026-09-04、production diff=0）就記錄到此項失敗的原因。T0 另記的 3 項 preview root-lock（HTTP 423）失敗本次未重現，但**不得視為已修**——見下方 server 環境揭露，本次兩個 server 並未競爭同一個 history root lease，因此那 3 項是被環境繞過、不是被修好。

WP-56 未新增任何 researcher menu 按鈕（只在既有 dropdown 增加一個 drill 與一個 scene），故本 WP 不擁有此失敗，依 scope 紀律不在 T-exit 切片內修。已另立 **[KI-027](../../../../known_issue/KI-027-overlay-layering-researcher-submenu-guard-dead.md)**：該 KI 以 probe 量測回答了「layout 是否真的回歸」——展開後 8 顆按鈕的相交清單為 `[]`、SettingsPanel top 由 188 被推到 405.5，故 KI-003 不變式仍成立、錯的是常數；但 helper 的 `null` short-circuit 使該不變式自 WP-54 起就未被真正驗證，故 KI-027 的修改計畫同時要求消除這個失效模式，而非只改常數。

**上層索引同步的例外（明確揭露）**：[`active/stage12/README.md`](../README.md) 的 WP-56 狀態已更新並隨本 slice commit。但 [`docs/exec-plan/README.md`](../../../README.md) 的 WP-56 狀態列、階段 L 表與相依圖雖已在 worktree 更新為 ✅，**未 stage**——該檔整個「階段 L」區塊本身仍是未提交的規劃產物（stage12 三個 WP 共用，其中 WP-57／WP-58 的表列由平行 session 擁有），我的 WP-56 文字與那些新增內容落在同一個 diff hunk 內、無法分離staging。留給該檔的擁有者一併提交。

**Server 環境揭露（影響 Playwright 證據的解讀；已另立 [KI-028](../../../../known_issue/KI-028-capture-script-orphans-dev-server-hijacking-e2e-history-root.md)）**：執行時 5173 已有一個 T6 capture runner 遺留的 dev server（`scripts/capture-wp56-visuals.mjs` 以 `npm run dev -- --host 127.0.0.1` + `FPS_HISTORY_ROOT=.wp56-capture-tmp/history` spawn），Playwright 的 `reuseExistingServer: !CI` 直接重用它，**而不是**用 `playwright.config.ts` 宣告的 `.playwright-tmp/history-dev`。`.wp56-capture-tmp/history/` 內出現本次 run 的 fixture 目錄即為證據。兩者皆為 temp root、皆未寫入真實 `data/session-history/`，故 data safety 不受影響；但因兩個 server 不再競爭同一個 lease，T0 記錄的 3 項 root-lock 失敗被繞過而非修復。另外 4173 的 preview server 由本 task 手動以 `vite preview` 起（`npm run build` 當時因平行 WP-57 的 in-flight 型別錯誤而紅，使 config 的 preview webServer 無法啟動；該錯誤在平行工作收尾後自行消失，最終 `npm run build` exit 0），收尾已停止。`.wp56-capture-tmp/` 為 T6 runner 的 untracked temp 目錄，未提交；因仍有 live server 佔用且不屬本 task 所有，未刪除。

Worktree 狀態揭露：本次 gate 執行時 worktree 同時帶有平行 WP-57／spider-shot-v3 的進行中變更（`DrillConfig`／`schema`／`DrillLoader`／`TargetManager`／`spiderEyeFrame`／`main.ts`／`SessionRunner`／`spiderShotConditions` 與多個新檔）。上述 Vitest／build／Playwright 數字因此涵蓋那份工作；本 task 只 stage 自己的檔案，未觸碰、未改寫該工作。

### T-exit acceptance：A-56.1～12

| ID | Scenario | Evidence | 判定 |
|---|---|---|---|
| A-56.1 | researcher load | E2E test 1／2 的`loadMicroFlick()`：`#drill-select`選exact drill → `#scene-select`成為`micro-flick-room` → 3個alive&&visible | ✅ |
| A-56.2 | hit replacement | T2 `TargetManager.population.test.ts`（撤`t1`後`t0/t2`逐位不變、7.8125 ms補`t3`）＋T4 real-config integration（中心射線只命中最近`t0`）＋E2E test 2（`visible t0..t3`、`fire hit targetId=t0`） | ✅ |
| A-56.3 | miss/stale | T2：unknown ID與double kill皆no-op且不消耗budget；T4 miss不補位 | ✅ |
| A-56.4 | fixed player | T4 SimLoop regression（1,280 ticks W/A/S/D + 非零初始速度 → position/velocity/prev-curr不變、yaw/pitch保留）＋E2E test 1（KeyD後player逐位相同、`stopped=true`） | ✅ |
| A-56.5 | exhaustion/restart | T2 budget tail `3→3→3→2→1→0` + runner進`ended` + same-seed restart opening一致；**E2E test 3（本次修正後真正成立）**：60發tap → `phase='ended'`、60 hits、restart opening序列相同 | ✅ |
| A-56.6 | determinism | T2 regression：30/60/144/240 render FPS的96-tick replacement trace逐位一致 | ✅ |
| A-56.7 | spawn stress | T2 property test：10,000 replacements全數finite／yaw±22°／pitch±12°／12–14u／unique active IDs／pair separation≥7° | ✅ |
| A-56.8 | lifecycle | T3：1,000 replacements後`TargetView.poolSize===3`；50次enter/switch/leave維持2 lights + 1 asset group + 3 pooled meshes，離開後歸零 | ✅ |
| A-56.9 | viewport/contrast | T3：1920×1080／1280×720投影四角+球半徑保留≥24 CSS px safe region、中央誤差≤1 px、紅球對牆面contrast≥3:1；E2E test 1斷言crosshair中心exact (640,360)／(960,540) | ✅ |
| A-56.10 | no weapon | T3 allowlist + 真實`GLTFLoader.parseAsync()`（21 environment meshes、禁用名稱命中0）；T-exit boundary scan重驗GLTF僅含floor/ceiling/end-wall/side-panel-*/unit-cube-*/mat-*節點（唯一`target`字串為glTF規格的bufferView `"target": 34962`，非節點名）；T6人工截圖無槍/手/muzzle | ✅ |
| A-56.11 | failure recovery | T3 `SceneLoadCoordinator.test.ts`：rapid A→B、same-scene supersession、late-arrival在掛入前dispose；T6強制abort GLTF後顯示既有generic placeholder且HUD／crosshair／live targets仍在（accepted fallback difference） | ✅（見下方殘留量測缺口） |
| A-56.12 | data honesty | T1／T4 negative fixtures：無participant/assessment registry、無exact或near-miss full replay profile、`HistoryPersistence`在呼叫client前short-circuit；`visible/fire/hit`事件保留exact targetId且無duplicate visible | ✅ |

### FR／NFR traceability 對帳

FR-56.1～15全數有自動或已核准人工證據：FR-56.1／14→T1 registry + practice-only negative tests；FR-56.2／15→T3 asset/scene load/fallback + T6視覺；FR-56.3／4→T4 + E2E test 1；FR-56.5～10→T1 schema + T2 population property/lifecycle + T4 hit integration；FR-56.11／12→T3 allowlist + T6；FR-56.13→T3 50-cycle resource counters。

NFR：56.1（≤7.8125 ms）／56.2（四FPS parity）／56.3（10k invariants）→T2；56.4（`TargetManager.tick + TargetView.sync` 10,000 warmed P95 **0.0115 ms** < 1 ms）→T5 `src/sim/micro-flick-performance.test.ts`；56.5（1k replacements後pool=3）→T3；56.6（cached選擇→首個可見走廊frame **p95 62.0 ms** < 1,500 ms，20個真實transaction）→本次T-exit重新量測；56.7／56.8→T3 + E2E；56.9→下方gates。

**殘留量測缺口（明確不掩蓋）**：NFR-56.6 的第二子句「load failure 仍可於 **100 ms** 內操作離開／切換」只有結構性證據（`SceneLoadCoordinator` dispose/supersession tests + T6 強制 abort 後 UI 仍可操作的截圖），**沒有瀏覽器內的時間量測**。此項不在 T-exit exit criteria 的四個 blocking 條件內，故不阻擋交付，但若後續要把 Micro Flick 升為正式 Assessment，應補一個 forced-failure 的 time-to-interactive 量測。

## Surprises & Discoveries（T-exit）

- T6把blocker歸因於WP-57的`TargetManager` spider branch，實際上兩個失敗與WP-57完全無關（新分支對micro-flick不可達）。教訓：「同一檔案在同期被改」不等於因果，仍須走到最小repro。
- `#scene-select`與`#drill-select`的互動語意不對稱——drill選了就載入，scene必須按Load按鈕。這個不對稱先前沒有任何測試或文件記錄，而它讓一個看似合理的E2E reset步驟變成靜默no-op並污染了一整個NFR量測。
- 一個「已通過」的perf gate可能因為前提失效而量到零個真實transaction卻仍回報綠燈：修正後的p95（62 ms）與gate（1,500 ms）差距過大，本身就是「這個數字沒在量它宣稱的東西」的訊號。後續WP的perf gate應同時斷言transaction真的發生（本次以app寫回的dropdown值作為觀測終點）。
- T-exit期間worktree持續有平行WP-57/spider-shot-v3工作進出（`DrillConfig`／`schema`／`TargetManager`／`main.ts`／新drill與scene），且一度使`tsc --noEmit`為紅（`npm run build`含typecheck，故Playwright的preview webServer起不來）。本task只stage自己的檔案，未觸碰該工作。
