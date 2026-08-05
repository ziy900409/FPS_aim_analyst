# Graph Report - FPS_aim_analyst-WP-29  (2026-08-05)

## Corpus Check
- 221 files · ~321,163 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1550 nodes · 3561 edges · 103 communities (78 shown, 25 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 389 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4536af4f`
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
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 97|Community 97]]
- [[_COMMUNITY_Community 98|Community 98]]
- [[_COMMUNITY_Community 99|Community 99]]
- [[_COMMUNITY_Community 100|Community 100]]
- [[_COMMUNITY_Community 101|Community 101]]
- [[_COMMUNITY_Community 102|Community 102]]

## God Nodes (most connected - your core abstractions)
1. `createSharedState()` - 61 edges
2. `createSimLoop()` - 40 edges
3. `createDataRecorder()` - 38 edges
4. `loadDrill()` - 35 edges
5. `createTargetManager()` - 30 edges
6. `load_export()` - 26 edges
7. `build_peek_windows()` - 25 edges
8. `pushEvent()` - 24 edges
9. `createDrillRunner()` - 22 edges
10. `collectMeta()` - 21 edges

## Surprising Connections (you probably didn't know these)
- `D1 — 2D UI = 純 TS + DOM overlay` --semantically_similar_to--> `MetricsDashboard 元件`  [INFERRED] [semantically similar]
  docs/PLAN.md → CONTEXT.md
- `量測時鐘 vs 決定性時鐘 (two-clock model)` --semantically_similar_to--> `主執行緒卡頓污染 sim 計時 (階段 A 隔離不成立)`  [INFERRED] [semantically similar]
  CONTEXT.md → docs/DESIGN.md
- `runBrVariant()` --calls--> `createDataRecorder()`  [INFERRED]
  tests/regression/br-tracking-invariants.test.ts → src/data/DataRecorder.ts
- `runFrames()` --calls--> `createDataRecorder()`  [INFERRED]
  tests/regression/determinism.test.ts → src/data/DataRecorder.ts
- `runMovingTarget()` --calls--> `createDataRecorder()`  [INFERRED]
  tests/regression/movingTargetDeterminismFixture.ts → src/data/DataRecorder.ts

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

## Communities (103 total, 25 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (68): assertFinitePayload(), buildExportPayload(), downloadCSV(), downloadJSON(), downloadTextFile(), exportBasename(), formatBoolean(), formatNumber() (+60 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (41): round(), simulatePurePunchPattern(), toPatternShot(), buttonCss(), createNumberInput(), drawGrid(), drawPattern(), maxSpreadRadiusDeg() (+33 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (27): spawnBullet(), stepBullet(), clipAxis(), sweptHitTest(), advanceProjectiles(), applyInput(), ballisticRaycast(), composeProjectileRay() (+19 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (39): buildHitShotSeqs(), buildIdealPath(), buildPeekWindows(), coefficientOfVariation(), compensationError(), computeMetrics(), computeRecoilCompensationError(), computeRecoilCompensationPath() (+31 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (49): _compute_failed_flag(), is_known_quality_flag(), per_segment_apply(), Per-segment computation with a closed, machine-readable quality vocabulary.  E, Summarize finite, unflagged values while counting excluded flagged rows., Summarize finite, unflagged values while counting excluded flagged rows., Return whether *flag* is an exact or templated vocabulary member., Return whether *flag* is an exact or templated vocabulary member. (+41 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (51): ADR-2 (three loops communicate via SharedState), ADR-3 (sub-tick), ADR-4 (timing: timeStamp / sim tick time source), Appendix D (stage B physics constants: friction/accelerate/stopspeed), Boolean Accuracy Gate (stopped -> accurate), firstShot / firstShotGate (per-peek first shot flag), Fixed-step Movement (determinism, FPS-independent), HitDetector (Raycaster camera-center hit detection) (+43 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (48): ADR-2 雙迴圈解耦, ADR-3 128 Hz tick, ADR-4 performance.now() 計時源, ADR-5 Pointer Lock + 原始輸入 + coalesced, D1 UI = 純 TS + DOM overlay, WP-0 — 環境設置 (scaffold/createRenderer seam), WP-3 — 高頻輸入採集 (getCoalescedEvents 入緩衝), WP-4 — 目標 / 準心 (+40 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (46): ADR-1 backend metadata, ADR-4 時間源 (performance.now()), counterstrafe_ad_v1 drill config, SharedState, SimLoop (src/loop/SimLoop.ts), WP-0 createRenderer backend seam, WP-1 sensitivity, WP-2 sim tick (+38 more)

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (44): ADR-2 三迴圈經 SharedState 溝通, ADR-3 精準度來源 = sub-tick 輸入時間戳, ADR-4 performance.now() / event.timeStamp 同源, ADR-5 coalesced events, getCoalescedEvents 次幀採樣 (高頻滑鼠不丟樣本), 確定性左右交替輪替 (counter-strafe peek 節奏), 依時序排序消費 + 排空 (決定性契約), sub-tick 輸入時間戳 (精準度真正來源) (+36 more)

### Community 9 - "Community 9"
Cohesion: 0.15
Nodes (33): collectMeta(), measureDisplayHz(), measureDisplayRefresh(), nextAnimationFrame(), normalizeOverflow(), normalizeStartedAt(), requireBackend(), requireBoolean() (+25 more)

### Community 10 - "Community 10"
Cohesion: 0.12
Nodes (20): resolveTargetHitbox(), targetHitboxToConfig(), activeSides(), assertFiniteEnvelope(), clipAxis(), criticalYawDegrees(), deriveTargetEnvelopes(), envelopeForSide() (+12 more)

### Community 11 - "Community 11"
Cohesion: 0.08
Nodes (39): counterstrafe_ad_v1 counter-strafe drill, docs/operational/acceptance-stage-a.md, docs/operational/timing-validity.md, 里程碑 M1 (WP-2 脊椎 / 決定性驗證), 規格 §14 方法論 (受試者內相對值 + 顯示延遲誤差界線), 規格 §5 八指標, 規格 §9.2 計時效度 150–250 ms, counterReactionMs (急停反應時間) (+31 more)

### Community 12 - "Community 12"
Cohesion: 0.18
Nodes (30): build_peek_windows(), _events_in_window(), _finite_number(), _first_compatible_fire(), _hit_times_by_shot(), _key(), _keys(), _last_release_transition() (+22 more)

### Community 13 - "Community 13"
Cohesion: 0.13
Nodes (13): consume(), createInputSampler(), drainAll(), drainToArray(), snapshot(), createBulletArena(), createImpactRing(), createInputRing() (+5 more)

### Community 14 - "Community 14"
Cohesion: 0.15
Nodes (17): createDataRecorder(), capacityForDrill(), loadDrill(), createDrillRunner(), canonicalLongrangeFrames(), createCamera(), runLongrangeTracking(), applyMode() (+9 more)

### Community 15 - "Community 15"
Cohesion: 0.14
Nodes (23): _keys_for_tick(), make_synthetic_export(), _profile(), Deterministic schema v2 synthetic export generation.  No clock or random sourc, Create a schema-faithful deterministic v2 payload without writing it to disk., SyntheticSpec, main(), Regenerate the committed T1 schema v2 fixture. (+15 more)

### Community 16 - "Community 16"
Cohesion: 0.12
Nodes (15): collect64HzSamples(), recordVisibleEvents(), simStep(), cameraLookingDownZ(), fireAt(), makeTarget(), meanSpreadRadius(), run() (+7 more)

### Community 17 - "Community 17"
Cohesion: 0.14
Nodes (18): createPointerLock(), beginNextProtocolCondition(), completeActiveProtocolCondition(), exportBasename(), installSceneLoad(), onExportCSV(), onExportJSON(), protocolRunningText() (+10 more)

### Community 18 - "Community 18"
Cohesion: 0.13
Nodes (12): createSimLoop(), canonicalTrajectory(), freshState(), runFrames(), snap(), syntheticInputs(), canonicalFire(), runFire() (+4 more)

### Community 19 - "Community 19"
Cohesion: 0.16
Nodes (15): setup(), canonicalRun(), runFrames(), snap(), syntheticInputs(), createMovementController(), run(), runBatches() (+7 more)

### Community 20 - "Community 20"
Cohesion: 0.12
Nodes (18): _Candidate, _merge_overlapping(), _prepare_signal(), Submovement segmentation for 128 Hz angular-speed traces., Segment an angular-speed trace into one primary flick and later adjustments., Segment an angular-speed trace into one primary flick and later adjustments., Segment an angular-speed trace into one primary flick and later adjustments., Pre-registered segmentation parameters; changes require a new version. (+10 more)

### Community 21 - "Community 21"
Cohesion: 0.15
Nodes (18): Export, Validated export data prepared for offline analysis., _finite(), _first_shot_hit_count(), Drill-level metrics that reproduce the frozen ``compute-v1`` semantics., Match frozen ``compute-v1``: finite values, linear p50, population SD., Compute the three frozen timeline metrics and retain every peek window., Return a JSON-ready payload; writing remains at the notebook boundary. (+10 more)

### Community 22 - "Community 22"
Cohesion: 0.13
Nodes (12): assignOptionalNumber(), assignOptionalText(), createSessionSetupForm(), displaySelfReportFromSessionSetup(), makeButton(), makeNumberField(), makeTextField(), optionalText() (+4 more)

### Community 23 - "Community 23"
Cohesion: 0.2
Nodes (18): _aim_forward(), _column(), _finite_column(), _finite_scalar(), _geometry(), _hitbox(), omega_deg_s(), on_target() (+10 more)

### Community 24 - "Community 24"
Cohesion: 0.29
Nodes (14): err(), requireColorNumber(), requireFiniteNumber(), requireNonEmptyString(), requireNonNegativeNumber(), requireObject(), requirePositiveNumber(), validateAsset() (+6 more)

### Community 25 - "Community 25"
Cohesion: 0.19
Nodes (6): defaultLoader(), disposeScene(), loadScene(), createSceneManager(), createSceneManagerWithStatus(), SceneManager

### Community 26 - "Community 26"
Cohesion: 0.2
Nodes (19): aimForward(), angularEccentricityDeg(), clamp(), deriveDetectionMetrics(), derivePresentation(), eccentricitySamples(), finite(), firstSustainedDecrease() (+11 more)

### Community 27 - "Community 27"
Cohesion: 0.18
Nodes (19): 記憶分層 (Working/Semantic/Episodic/全域/程序), 程序記憶 (procedural memory), CLAUDE.md 專案執行協議與導航, 垂直切片 = 原子 commit 協議, 雙迴圈 (dual-loop), CONTEXT.md 專有名詞詞彙表, sim tick rate (128 Hz), DECISIONS.md 全域決策與矛盾帳本 (+11 more)

### Community 28 - "Community 28"
Cohesion: 0.33
Nodes (16): _list(), load_export(), _mapping(), _non_empty_string(), _number(), Load the JSON form of the schema v2 export documented in docs/operational/schema, A schema v2 validation error with a machine-readable JSON field path., Read and validate one schema v2 JSON export. (+8 more)

### Community 29 - "Community 29"
Cohesion: 0.35
Nodes (15): err(), requireFiniteNumber(), requireHitboxDimension(), requireNonEmptyString(), requireNonNegativeNumber(), requireNonNegativeRange(), requireObject(), requirePositiveInt() (+7 more)

### Community 30 - "Community 30"
Cohesion: 0.2
Nodes (9): distanceForAngularHeight(), makeVariant(), speedForAngularRate(), variantId(), createFpsTestHarness(), makeBrTrackingProtocolHarness(), makeDetectionHarness(), makeHarness() (+1 more)

### Community 31 - "Community 31"
Cohesion: 0.21
Nodes (11): nextAnimationFrame(), percentile(), probeWarmupP95Ms(), readDevicePixelRatio(), readFullscreenElement(), readScreenDim(), requireNonNegativeInteger(), requireNonNegativeNumber() (+3 more)

### Community 32 - "Community 32"
Cohesion: 0.14
Nodes (17): 急停反應時間 (t_counter − t_visible), DataRecorder 元件 (preallocated arena), 首發 (first shot / firstShot), 首發命中率, HitDetector 元件, 輸入分桶 (input bucketing), InputSampler 元件, MovementController 元件 (狀態機 M1) (+9 more)

### Community 33 - "Community 33"
Cohesion: 0.2
Nodes (12): x(), candidate_params(), main(), _profile(), Deterministic T3 parameter sweep and optional real-data overlay generation., _same_numeric_params(), _score(), synthetic_cases() (+4 more)

### Community 34 - "Community 34"
Cohesion: 0.16
Nodes (6): createControls(), makeButton(), makeSelect(), makeToggle(), FakeDocument, FakeElement

### Community 35 - "Community 35"
Cohesion: 0.18
Nodes (16): coalesced events (getCoalescedEvents), backend (render backend webgpu/webgl2), 原始輸入 (unadjustedMovement), 技術棧 (Three.js WebGPU + TS + Vite), 附錄 E 驗收清單 (階段 A), ADR-1 WebGPURenderer + WebGL2 fallback, ADR-5 Pointer Lock + 原始輸入 + coalesced events, 附錄 C 匯出資料 schema (+8 more)

### Community 36 - "Community 36"
Cohesion: 0.17
Nodes (9): check_dt(), DtReport, Fixed-tick interval quality reporting., Uniformity report; each gap index identifies the right-hand tick row., Compare adjacent tick times with ``1000 / sim_hz`` using a 1e-6 ms tolerance., Pure submovement segmentation algorithms., _load(), test_check_dt_reports_dropped_tick_by_right_hand_row_index() (+1 more)

### Community 37 - "Community 37"
Cohesion: 0.19
Nodes (5): createRenderLoop(), lerp(), TargetView, moving(), target()

### Community 38 - "Community 38"
Cohesion: 0.3
Nodes (15): 里程碑 M1 (WP-2 脊椎門控), 里程碑 M2 (WP-5 核心玩法), 里程碑 M3 (WP-7 可匯出資料), 里程碑 M4 (WP-9 階段 A 交付), exec-plan/README.md 執行計畫索引, WP-0 環境建置與學習爬升, WP-1 FPS 控制 + Pointer Lock, WP-2 SharedState + 雙迴圈骨架 (脊椎) (+7 more)

### Community 39 - "Community 39"
Cohesion: 0.18
Nodes (8): Contract tests for the one-command research pipeline., A clean export must leave rows summarizable, not blanket-flagged., _read_csv(), test_dt_report_carries_tick_count_gaps_and_median(), test_peek_rows_cover_every_visible_event_in_order(), test_quality_summary_reports_n_and_flagged_per_metric(), test_segment_indices_and_times_are_in_the_tick_frame(), test_undefined_leading_omega_sample_does_not_flag_segments()

### Community 40 - "Community 40"
Cohesion: 0.16
Nodes (10): butter_filter(), Zero-phase Butterworth low-pass filtering., Low-pass a finite one-dimensional signal without phase shift.      Invalid cut, Savitzky-Golay smoothing with explicit input contracts., Smooth a finite one-dimensional signal.      Degenerate inputs raise :class:`V, sg_filter(), test_butter_filter_is_zero_phase_and_attenuates_high_frequency(), test_butter_filter_rejects_degenerate_inputs() (+2 more)

### Community 41 - "Community 41"
Cohesion: 0.3
Nodes (9): assertReadyState(), createProtocolRunner(), requireCondition(), requireNonEmptyString(), requirePositiveInteger(), requireRecord(), validateProtocol(), isResolutionMode() (+1 more)

### Community 43 - "Community 43"
Cohesion: 0.43
Nodes (11): err(), pushWarning(), requireFiniteNumber(), requireNonNegativeNumber(), requireObject(), requirePositiveInt(), requirePositiveNumber(), validateAds() (+3 more)

### Community 44 - "Community 44"
Cohesion: 0.23
Nodes (10): build_parity_payload(), _derive_presentation(), _is_finite_number(), main(), Generate the committed Python side of the T2 epsilon parity gate., Derive presentation metrics using only Python research functions., _resolved_hitbox(), _visible_or_first_tick_target() (+2 more)

### Community 45 - "Community 45"
Cohesion: 0.21
Nodes (6): resolutionModeLabel(), createSettingsPanel(), makeRow(), makeSelectRow(), FakeDocument, FakeElement

### Community 47 - "Community 47"
Cohesion: 0.32
Nodes (8): collectImpacts(), collectTracers(), createCamera(), createTargetManagerStub(), makeTarget(), runProjectile(), runWeapon(), pushEvent()

### Community 48 - "Community 48"
Cohesion: 0.19
Nodes (13): accumulator 模式, 準心對齊偏移, DrillConfig 元件, F5 接縫 (seam-in, drills-out), fixed-timestep (128 Hz), simStep 順序 (tick 內), GD-1 F5 是否屬階段 A (規格 v1.1 與 seam-in 不一致), 移動 + counter-strafe 能力混淆 (研究設計問題) (+5 more)

### Community 49 - "Community 49"
Cohesion: 0.2
Nodes (4): keyMaskFromKeys(), keyMaskFromState(), keysFromMask(), TickArena

### Community 50 - "Community 50"
Cohesion: 0.26
Nodes (5): brInputs(), createCamera(), runBrVariant(), getWeapon(), isWeaponId()

### Community 51 - "Community 51"
Cohesion: 0.18
Nodes (12): 正規單位 (canonical unit, source unit u/s), CS2 physics 常數 (階段 B 校準起點), 決定性 (determinism), RenderLoop 元件, RenderSnapshot 窄介面, 速度歸零誤差 (residual speed), 階段 B (Stage B), 量測時鐘 vs 決定性時鐘 (two-clock model) (+4 more)

### Community 52 - "Community 52"
Cohesion: 0.38
Nodes (9): epsilon_deg(), Return unsigned aim-to-target-center angular error for each tick.      ``fallb, test_epsilon_is_zero_at_target_center(), test_epsilon_recovers_known_unsigned_offset(), test_missing_tick_target_uses_visible_event_fallback(), test_omega_known_geometry(), test_omega_uses_adjacent_midpoint_pitch(), test_on_target_resolves_meta_hitbox_before_h1_fallback() (+1 more)

### Community 53 - "Community 53"
Cohesion: 0.31
Nodes (5): applyResolutionMode(), readDevicePixelRatio(), readViewport(), requirePositiveInteger(), FakeRenderer

### Community 54 - "Community 54"
Cohesion: 0.39
Nodes (7): addHay(), addShrub(), addTree(), addVisual(), box(), propVisuals(), round()

### Community 55 - "Community 55"
Cohesion: 0.31
Nodes (4): createEligibilityGateScreen(), makeButton(), FakeDocument, setup()

### Community 56 - "Community 56"
Cohesion: 0.25
Nodes (3): createScopeOverlay(), FakeDocument, FakeElement

### Community 57 - "Community 57"
Cohesion: 0.44
Nodes (7): createHUD(), createHUDStats(), createHUDSummary(), fillHUDSummary(), formatElapsed(), formatNumber(), renderMetric()

### Community 58 - "Community 58"
Cohesion: 0.39
Nodes (6): applyAimFixture(), canonicalSprayFrames(), collectImpacts(), createCamera(), round(), runSpray()

### Community 60 - "Community 60"
Cohesion: 0.46
Nodes (8): activeWeaponConfig(), buildSimLoop(), findSceneOption(), loadDrillById(), loadSceneById(), resetRunPresentation(), restartActiveDrill(), syncControlsVisibility()

### Community 61 - "Community 61"
Cohesion: 0.39
Nodes (4): applyAimFixture(), canonicalMovingTargetFrames(), createCamera(), runMovingTarget()

### Community 62 - "Community 62"
Cohesion: 0.46
Nodes (4): isDrivenMotion(), motionOffset(), offsetAt(), triangleWave()

### Community 63 - "Community 63"
Cohesion: 0.36
Nodes (8): 不可違反的硬約束 (技術), cross-origin isolation (COOP/COEP), MetricsDashboard 元件, D1 — 2D UI = 純 TS + DOM overlay, D3 — COOP/COEP 部署 (Vite plugin + 靜態主機後定), ADR-4 performance.now() + cross-origin isolation, WP-0 T2 Cross-origin isolation, WP-0 T4 Deploy headers

### Community 64 - "Community 64"
Cohesion: 0.48
Nodes (6): _delta(), generate_all(), main(), Generate the T1 anti-vacuous fixture, parity payloads, and coach-facing artifact, _write_summary_csv(), _write_timeline_svg()

### Community 66 - "Community 66"
Cohesion: 0.4
Nodes (4): List-compatible result carrying flags when no segment can hold them., List-compatible result carrying flags when no segment can hold them., List-compatible result carrying flags when no segment can hold them., SegmentList

## Knowledge Gaps
- **159 isolated node(s):** `Offline research modules.`, `Schema v2 ingestion and fixture generation.`, `Fixed-tick interval quality reporting.`, `Uniformity report; each gap index identifies the right-hand tick row.`, `Compare adjacent tick times with ``1000 / sim_hz`` using a 1e-6 ms tolerance.` (+154 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ImpactView` connect `Community 2` to `Community 17`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `createSharedState()` connect `Community 19` to `Community 1`, `Community 2`, `Community 13`, `Community 14`, `Community 47`, `Community 16`, `Community 18`, `Community 50`, `Community 57`, `Community 58`, `Community 61`, `Community 30`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `load_export()` connect `Community 28` to `Community 64`, `Community 33`, `Community 36`, `Community 4`, `Community 39`, `Community 44`, `Community 15`, `Community 21`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Are the 29 inferred relationships involving `createSharedState()` (e.g. with `setup()` and `fireAt()`) actually correct?**
  _`createSharedState()` has 29 INFERRED edges - model-reasoned connections that need verification._
- **Are the 22 inferred relationships involving `createSimLoop()` (e.g. with `buildSimLoop()` and `resetBulletArena()`) actually correct?**
  _`createSimLoop()` has 22 INFERRED edges - model-reasoned connections that need verification._
- **Are the 21 inferred relationships involving `createDataRecorder()` (e.g. with `capacityForDrill()` and `fireAt()`) actually correct?**
  _`createDataRecorder()` has 21 INFERRED edges - model-reasoned connections that need verification._
- **Are the 13 inferred relationships involving `loadDrill()` (e.g. with `loadDrillById()` and `loadSceneById()`) actually correct?**
  _`loadDrill()` has 13 INFERRED edges - model-reasoned connections that need verification._