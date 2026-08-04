# Graph Report - FPS_aim_analyst  (2026-08-04)

## Corpus Check
- 200 files · ~294,592 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1348 nodes · 3174 edges · 94 communities (66 shown, 28 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 296 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `012eddcf`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]

## God Nodes (most connected - your core abstractions)
1. `createSharedState()` - 61 edges
2. `createSimLoop()` - 40 edges
3. `createDataRecorder()` - 38 edges
4. `loadDrill()` - 35 edges
5. `createTargetManager()` - 30 edges
6. `pushEvent()` - 24 edges
7. `createDrillRunner()` - 22 edges
8. `collectMeta()` - 21 edges
9. `規格書 v1.1 + WBS` - 21 edges
10. `simStep()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `collect64HzSamples()` --calls--> `simStep()`  [INFERRED]
  tests/calibration/showpos.test.ts → src/loop/SimLoop.ts
- `advanceUntilTracer()` --calls--> `simStep()`  [INFERRED]
  tests/regression/muzzle-tracer-invariants.test.ts → src/loop/SimLoop.ts
- `D1 — 2D UI = 純 TS + DOM overlay` --semantically_similar_to--> `MetricsDashboard 元件`  [INFERRED] [semantically similar]
  docs/PLAN.md → CONTEXT.md
- `量測時鐘 vs 決定性時鐘 (two-clock model)` --semantically_similar_to--> `主執行緒卡頓污染 sim 計時 (階段 A 隔離不成立)`  [INFERRED] [semantically similar]
  CONTEXT.md → docs/DESIGN.md
- `runBrVariant()` --calls--> `createDataRecorder()`  [INFERRED]
  tests/regression/br-tracking-invariants.test.ts → src/data/DataRecorder.ts

## Hyperedges (group relationships)
- **三迴圈透過 SharedState 溝通 (雙迴圈架構, ADR-2)** — context_input_sampler, context_sim_loop, context_render_loop, context_shared_state, spec_adr2 [EXTRACTED 1.00]
- **急停反應時間量測鏈 (t_visible / t_counter / 兩個時鐘)** — context_counter_reaction_time, context_t_visible, context_two_clock_model, spec_adr7 [EXTRACTED 0.85]
- **F5 seam-in/drills-out 三文件對帳 (規格/CONTEXT/DECISIONS)** — spec_f5, context_f5_seam_in, decisions_gd1_f5_conflict, spec_ability_confusion [EXTRACTED 0.95]
- **雙迴圈資料流: input→SharedState→SimLoop→RenderLoop** — wp2_shared_state, wp2_sim_loop_accumulator, wp2_render_loop_interpolation [EXTRACTED 1.00]
- **M1 門控: 決定性驗證 + accumulator + clock 注入** — wp2_m1_milestone, wp2_determinism, wp2_sim_loop_accumulator, wp2_clock_injectable [EXTRACTED 1.00]
- **WP-1 視角管線: PointerLock→CameraController→SettingsPanel** — wp1_pointerlock_handle, wp1_camera_controller, wp1_settings_panel [EXTRACTED 1.00]
- **輸入事件流：採集 → SharedState 緩衝 → sim 依時序消費** — wp3_input_sampler_class, shared_state, wp3_consume_fn, sim_loop [EXTRACTED 1.00]
- **t_visible 效度鏈：sim tick 內蓋戳 (ADR-2/4) → 反應時間起點** — concept_tvisible_in_sim_tick, adr2_three_loops, adr4_performance_now, concept_t_visible [EXTRACTED 1.00]
- **目標狀態流：TargetManager (sim 寫) → SharedState.targets → TargetView (render 唯讀)** — target_manager, shared_state, target_view [EXTRACTED 1.00]
- **M2 core gameplay flow: movement -> stop -> fire -> hit -> first-shot** — wp5_readme_movementcontroller, wp5_readme_simplified_counterstrafe, wp5_readme_hitdetector, wp5_readme_firstshot, wp5_readme_m2 [EXTRACTED 1.00]
- **Data-driven drill pipeline: DrillConfig -> DrillLoader -> DrillRunner -> TargetManager** — wp6_readme_drillconfig, wp6_readme_drillloader, wp6_readme_drillrunner, wp6_readme_targetmanager [EXTRACTED 1.00]
- **匯出 payload 組裝 (meta + ticks + events → JSON/CSV)** — wp7_t3_metadata, wp7_t1_ring_buffer, wp7_t2_event_recording, wp7_t4_export [EXTRACTED 1.00]
- **附錄 C schema 對齊 (記錄/匯出/文件單一真相)** — wp7_appendix_c_schema, wp7_t2_event_recording, wp7_t4_export, wp7_t5_schema_doc [EXTRACTED 1.00]
- **指標計算消費 WP-7 snapshot (統計=匯出)** — wp7_datarecorder, wp8_compute_module, wp8_metrics_dashboard, wp8_result_screen_module [EXTRACTED 1.00]
- **三道計時效度防線 (COI E2E 斷言 + 反應分布 sanity + 決定性回歸)** — term_cross_origin_isolated, wp9_reaction_time_band, term_determinism, wp9_three_timing_defenses [EXTRACTED 1.00]
- **E2E 全鏈路 (drill→匯出→統計，統計=匯出)** — counterstrafe_ad_v1_drill, wp7_export, wp8_statistics, wp9_stats_equals_export [EXTRACTED 1.00]
- **M4 階段 A 交付閘 (附錄 E 10 項全綠 → 各上游 WP 證據)** — wp9_milestone_m4, wp9_appendix_e_acceptance, wp9_t5_exit_gate [EXTRACTED 1.00]

## Communities (94 total, 28 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (59): createDataRecorder(), assertFinitePayload(), buildExportPayload(), downloadCSV(), downloadJSON(), downloadTextFile(), exportBasename(), formatBoolean() (+51 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (46): round(), simulatePurePunchPattern(), toPatternShot(), cameraLookingDownZ(), fireAt(), makeTarget(), meanSpreadRadius(), run() (+38 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (28): resolveTargetHitbox(), targetHitboxToConfig(), loadDrill(), distanceForAngularHeight(), makeVariant(), speedForAngularRate(), variantId(), canonicalLongrangeFrames() (+20 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (43): check_dt(), DtReport, Fixed-tick interval quality reporting., Uniformity report; each gap index identifies the right-hand tick row., Compare adjacent tick times with ``1000 / sim_hz`` using a 1e-6 ms tolerance., Pure submovement segmentation algorithms., Export, _list() (+35 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (29): spawnBullet(), stepBullet(), clipAxis(), sweptHitTest(), advanceProjectiles(), applyInput(), ballisticRaycast(), composeProjectileRay() (+21 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (51): ADR-2 (three loops communicate via SharedState), ADR-3 (sub-tick), ADR-4 (timing: timeStamp / sim tick time source), Appendix D (stage B physics constants: friction/accelerate/stopspeed), Boolean Accuracy Gate (stopped -> accurate), firstShot / firstShotGate (per-peek first shot flag), Fixed-step Movement (determinism, FPS-independent), HitDetector (Raycaster camera-center hit detection) (+43 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (36): buildHitShotSeqs(), buildIdealPath(), buildPeekWindows(), coefficientOfVariation(), compensationError(), computeMetrics(), computeRecoilCompensationError(), computeRecoilCompensationPath() (+28 more)

### Community 7 - "Community 7"
Cohesion: 0.08
Nodes (47): ADR-2 雙迴圈解耦, ADR-3 128 Hz tick, ADR-4 performance.now() 計時源, ADR-5 Pointer Lock + 原始輸入 + coalesced, WP-0 — 環境設置 (scaffold/createRenderer seam), WP-3 — 高頻輸入採集 (getCoalescedEvents 入緩衝), WP-4 — 目標 / 準心, WP-5 — movement / 急停物理 (+39 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (47): ADR-1 backend metadata, ADR-4 時間源 (performance.now()), counterstrafe_ad_v1 drill config, D1 UI = 純 TS + DOM overlay, SharedState, SimLoop (src/loop/SimLoop.ts), WP-0 createRenderer backend seam, WP-1 sensitivity (+39 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (45): ADR-2 三迴圈經 SharedState 溝通, ADR-3 精準度來源 = sub-tick 輸入時間戳, ADR-4 performance.now() / event.timeStamp 同源, ADR-5 coalesced events, getCoalescedEvents 次幀採樣 (高頻滑鼠不丟樣本), 確定性左右交替輪替 (counter-strafe peek 節奏), 依時序排序消費 + 排空 (決定性契約), sub-tick 輸入時間戳 (精準度真正來源) (+37 more)

### Community 10 - "Community 10"
Cohesion: 0.13
Nodes (20): defaultLoader(), disposeScene(), loadScene(), createSceneManager(), createSceneManagerWithStatus(), SceneManager, err(), requireColorNumber() (+12 more)

### Community 11 - "Community 11"
Cohesion: 0.11
Nodes (34): _aim_forward(), _column(), epsilon_deg(), _finite_column(), _finite_scalar(), _geometry(), _hitbox(), omega_deg_s() (+26 more)

### Community 12 - "Community 12"
Cohesion: 0.09
Nodes (38): counterstrafe_ad_v1 counter-strafe drill, docs/operational/acceptance-stage-a.md, docs/operational/timing-validity.md, 規格 §14 方法論 (受試者內相對值 + 顯示延遲誤差界線), 規格 §5 八指標, 規格 §9.2 計時效度 150–250 ms, counterReactionMs (急停反應時間), crossOriginIsolated === true (COOP/COEP) (+30 more)

### Community 13 - "Community 13"
Cohesion: 0.19
Nodes (29): collectMeta(), measureDisplayHz(), measureDisplayRefresh(), nextAnimationFrame(), normalizeOverflow(), normalizeStartedAt(), requireBackend(), requireBoolean() (+21 more)

### Community 14 - "Community 14"
Cohesion: 0.13
Nodes (13): collect64HzSamples(), createSimLoop(), advanceUntilTracer(), createCamera(), createTarget(), fireOne(), runAtFrames(), canonicalFire() (+5 more)

### Community 15 - "Community 15"
Cohesion: 0.21
Nodes (13): consume(), resetRecoilState(), drainAll(), drainToArray(), snapshot(), createBulletArena(), createImpactRing(), createInputRing() (+5 more)

### Community 16 - "Community 16"
Cohesion: 0.19
Nodes (14): createPointerLock(), beginNextProtocolCondition(), buildCurrentExportPayload(), completeActiveProtocolCondition(), exportBasename(), onExportCSV(), onExportJSON(), protocolRunningText() (+6 more)

### Community 17 - "Community 17"
Cohesion: 0.2
Nodes (19): aimForward(), angularEccentricityDeg(), clamp(), deriveDetectionMetrics(), derivePresentation(), eccentricitySamples(), finite(), firstSustainedDecrease() (+11 more)

### Community 18 - "Community 18"
Cohesion: 0.16
Nodes (5): createInputSampler(), isDrivenMotion(), motionOffset(), offsetAt(), triangleWave()

### Community 19 - "Community 19"
Cohesion: 0.18
Nodes (19): 記憶分層 (Working/Semantic/Episodic/全域/程序), 程序記憶 (procedural memory), CLAUDE.md 專案執行協議與導航, 垂直切片 = 原子 commit 協議, 雙迴圈 (dual-loop), CONTEXT.md 專有名詞詞彙表, sim tick rate (128 Hz), DECISIONS.md 全域決策與矛盾帳本 (+11 more)

### Community 20 - "Community 20"
Cohesion: 0.35
Nodes (15): err(), requireFiniteNumber(), requireHitboxDimension(), requireNonEmptyString(), requireNonNegativeNumber(), requireNonNegativeRange(), requireObject(), requirePositiveInt() (+7 more)

### Community 21 - "Community 21"
Cohesion: 0.21
Nodes (11): nextAnimationFrame(), percentile(), probeWarmupP95Ms(), readDevicePixelRatio(), readFullscreenElement(), readScreenDim(), requireNonNegativeInteger(), requireNonNegativeNumber() (+3 more)

### Community 22 - "Community 22"
Cohesion: 0.21
Nodes (8): setup(), createTargetManager(), collectImmediateSpawns(), killSequence(), motionConfig(), runDrill(), runPositions(), createSharedState()

### Community 23 - "Community 23"
Cohesion: 0.23
Nodes (16): aimForward(), angularEccentricityDeg(), clamp(), derivePresentation(), finite(), hitboxFromMeta(), isFiniteNumber(), isOnTarget() (+8 more)

### Community 24 - "Community 24"
Cohesion: 0.16
Nodes (6): createControls(), makeButton(), makeSelect(), makeToggle(), FakeDocument, FakeElement

### Community 25 - "Community 25"
Cohesion: 0.29
Nodes (9): assertReadyState(), createProtocolRunner(), requireCondition(), requireNonEmptyString(), requirePositiveInteger(), requireRecord(), validateProtocol(), isResolutionMode() (+1 more)

### Community 26 - "Community 26"
Cohesion: 0.22
Nodes (11): createDrillRunner(), applyMode(), canonicalFrames(), counterstrafeFrames(), FakeRenderer, framesAt(), runCounterstrafeTrace(), runDetectionSpawnSequence() (+3 more)

### Community 27 - "Community 27"
Cohesion: 0.18
Nodes (16): coalesced events (getCoalescedEvents), backend (render backend webgpu/webgl2), 原始輸入 (unadjustedMovement), 技術棧 (Three.js WebGPU + TS + Vite), 附錄 E 驗收清單 (階段 A), ADR-1 WebGPURenderer + WebGL2 fallback, ADR-5 Pointer Lock + 原始輸入 + coalesced events, 附錄 C 匯出資料 schema (+8 more)

### Community 28 - "Community 28"
Cohesion: 0.19
Nodes (5): createRenderLoop(), lerp(), TargetView, moving(), target()

### Community 29 - "Community 29"
Cohesion: 0.4
Nodes (11): err(), pushWarning(), requireFiniteNumber(), requireNonNegativeNumber(), requireObject(), requirePositiveInt(), requirePositiveNumber(), validateAds() (+3 more)

### Community 30 - "Community 30"
Cohesion: 0.3
Nodes (15): 里程碑 M1 (WP-2 脊椎門控), 里程碑 M2 (WP-5 核心玩法), 里程碑 M3 (WP-7 可匯出資料), 里程碑 M4 (WP-9 階段 A 交付), exec-plan/README.md 執行計畫索引, WP-0 環境建置與學習爬升, WP-1 FPS 控制 + Pointer Lock, WP-2 SharedState + 雙迴圈骨架 (脊椎) (+7 more)

### Community 31 - "Community 31"
Cohesion: 0.25
Nodes (11): assignOptionalNumber(), assignOptionalText(), createSessionSetupForm(), displaySelfReportFromSessionSetup(), makeButton(), makeNumberField(), makeTextField(), optionalText() (+3 more)

### Community 33 - "Community 33"
Cohesion: 0.18
Nodes (14): DataRecorder 元件 (preallocated arena), 首發 (first shot / firstShot), 首發命中率, HitDetector 元件, 輸入分桶 (input bucketing), InputSampler 元件, MovementController 元件 (狀態機 M1), peek 與 P2 推進政策 (命中才推進) (+6 more)

### Community 34 - "Community 34"
Cohesion: 0.28
Nodes (13): activeWeaponConfig(), buildSimLoop(), findSceneOption(), installSceneLoad(), loadDrillById(), loadSceneById(), resetRunPresentation(), resize() (+5 more)

### Community 35 - "Community 35"
Cohesion: 0.21
Nodes (6): resolutionModeLabel(), createSettingsPanel(), makeRow(), makeSelectRow(), FakeDocument, FakeElement

### Community 36 - "Community 36"
Cohesion: 0.32
Nodes (8): collectImpacts(), collectTracers(), createCamera(), createTargetManagerStub(), makeTarget(), runProjectile(), runWeapon(), pushEvent()

### Community 38 - "Community 38"
Cohesion: 0.19
Nodes (13): accumulator 模式, 準心對齊偏移, DrillConfig 元件, F5 接縫 (seam-in, drills-out), fixed-timestep (128 Hz), simStep 順序 (tick 內), GD-1 F5 是否屬階段 A (規格 v1.1 與 seam-in 不一致), 移動 + counter-strafe 能力混淆 (研究設計問題) (+5 more)

### Community 39 - "Community 39"
Cohesion: 0.26
Nodes (7): canonicalRun(), runFrames(), snap(), syntheticInputs(), createMovementController(), run(), runBatches()

### Community 40 - "Community 40"
Cohesion: 0.2
Nodes (11): 正規單位 (canonical unit, source unit u/s), CS2 physics 常數 (階段 B 校準起點), 決定性 (determinism), RenderSnapshot 窄介面, 速度歸零誤差 (residual speed), 階段 B (Stage B), 量測時鐘 vs 決定性時鐘 (two-clock model), 速度 gate (velocity gate) (+3 more)

### Community 41 - "Community 41"
Cohesion: 0.31
Nodes (5): applyResolutionMode(), readDevicePixelRatio(), readViewport(), requirePositiveInteger(), FakeRenderer

### Community 42 - "Community 42"
Cohesion: 0.39
Nodes (7): addHay(), addShrub(), addTree(), addVisual(), box(), propVisuals(), round()

### Community 43 - "Community 43"
Cohesion: 0.44
Nodes (7): createHUD(), createHUDStats(), createHUDSummary(), fillHUDSummary(), formatElapsed(), formatNumber(), renderMetric()

### Community 45 - "Community 45"
Cohesion: 0.25
Nodes (3): createScopeOverlay(), FakeDocument, FakeElement

### Community 46 - "Community 46"
Cohesion: 0.31
Nodes (4): createEligibilityGateScreen(), makeButton(), FakeDocument, setup()

### Community 47 - "Community 47"
Cohesion: 0.39
Nodes (6): applyAimFixture(), canonicalSprayFrames(), collectImpacts(), createCamera(), round(), runSpray()

### Community 50 - "Community 50"
Cohesion: 0.32
Nodes (3): brInputs(), createCamera(), runBrVariant()

### Community 51 - "Community 51"
Cohesion: 0.39
Nodes (4): applyAimFixture(), canonicalMovingTargetFrames(), createCamera(), runMovingTarget()

### Community 52 - "Community 52"
Cohesion: 0.39
Nodes (5): canonicalTrajectory(), freshState(), runFrames(), snap(), syntheticInputs()

### Community 53 - "Community 53"
Cohesion: 0.36
Nodes (8): 不可違反的硬約束 (技術), cross-origin isolation (COOP/COEP), MetricsDashboard 元件, D1 — 2D UI = 純 TS + DOM overlay, D3 — COOP/COEP 部署 (Vite plugin + 靜態主機後定), ADR-4 performance.now() + cross-origin isolation, WP-0 T2 Cross-origin isolation, WP-0 T4 Deploy headers

### Community 54 - "Community 54"
Cohesion: 0.6
Nodes (5): createFpsTestHarness(), makeBrTrackingProtocolHarness(), makeDetectionHarness(), makeHarness(), makeTrackingHarness()

### Community 56 - "Community 56"
Cohesion: 0.8
Nodes (3): createRenderer(), pickBackend(), resolveBackend()

### Community 60 - "Community 60"
Cohesion: 0.5
Nodes (4): 急停反應時間 (t_counter − t_visible), t_visible, TargetManager 元件, F2 — 記錄 t_visible spawn/可見時間戳

## Knowledge Gaps
- **114 isolated node(s):** `Offline research modules.`, `Schema v2 ingestion and fixture generation.`, `Fixed-tick interval quality reporting.`, `Uniformity report; each gap index identifies the right-hand tick row.`, `Compare adjacent tick times with ``1000 / sim_hz`` using a 1e-6 ms tolerance.` (+109 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **28 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createSimLoop()` connect `Community 14` to `Community 1`, `Community 2`, `Community 34`, `Community 4`, `Community 36`, `Community 39`, `Community 47`, `Community 16`, `Community 15`, `Community 50`, `Community 51`, `Community 52`, `Community 22`, `Community 54`, `Community 25`, `Community 26`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `createSharedState()` connect `Community 22` to `Community 0`, `Community 1`, `Community 2`, `Community 4`, `Community 36`, `Community 39`, `Community 43`, `Community 14`, `Community 15`, `Community 47`, `Community 18`, `Community 50`, `Community 52`, `Community 51`, `Community 54`, `Community 25`, `Community 26`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `createDataRecorder()` connect `Community 0` to `Community 1`, `Community 2`, `Community 36`, `Community 39`, `Community 14`, `Community 47`, `Community 16`, `Community 50`, `Community 51`, `Community 54`, `Community 25`, `Community 26`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Are the 29 inferred relationships involving `createSharedState()` (e.g. with `setup()` and `fireAt()`) actually correct?**
  _`createSharedState()` has 29 INFERRED edges - model-reasoned connections that need verification._
- **Are the 22 inferred relationships involving `createSimLoop()` (e.g. with `buildSimLoop()` and `resetBulletArena()`) actually correct?**
  _`createSimLoop()` has 22 INFERRED edges - model-reasoned connections that need verification._
- **Are the 21 inferred relationships involving `createDataRecorder()` (e.g. with `capacityForDrill()` and `fireAt()`) actually correct?**
  _`createDataRecorder()` has 21 INFERRED edges - model-reasoned connections that need verification._
- **Are the 13 inferred relationships involving `loadDrill()` (e.g. with `loadDrillById()` and `loadSceneById()`) actually correct?**
  _`loadDrill()` has 13 INFERRED edges - model-reasoned connections that need verification._