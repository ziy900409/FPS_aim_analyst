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
| T5 Automated Integration and Performance | Not started | — | — | T4 complete；可開工 |
| T6 Visual Acceptance | Blocked by T4–T5 | — | — | T3 complete |
| T-exit | Blocked by T4–T6 | — | — | T0–T3 complete |

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

## Open Questions（狀態）

| ID | Status | Owner | Deadline | Notes |
|---|---|---|---|---|
| OQ-56.1 | Resolved | 使用者 | 2026-09-04 | 核心場景／玩法／no-gun scope已確認 |
| OQ-56.2 | Resolved | 使用者 + Gameplay owner | 2026-09-04 | 使用者明確要求實作T1，採Candidate A；T6仍需manual visual sign-off |
| OQ-56.3 | Resolved | Gameplay owner | 2026-09-04 | 採60-kill target quota |
| OQ-56.4 | Open/non-blocking for v1 | Product/Research owner | T-exit | 是否另開 Assessment/full-replay WP |
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

尚未開始。

## T6 Evidence Log

尚未開始。

## T-exit Evidence Log

尚未開始。
