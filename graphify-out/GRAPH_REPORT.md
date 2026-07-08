# Graph Report - FPS_aim_analyst  (2026-07-08)

## Corpus Check
- 108 files · ~163,890 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 817 nodes · 1786 edges · 47 communities (32 shown, 15 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 130 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `745556a0`
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
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 30|Community 30]]
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

## God Nodes (most connected - your core abstractions)
1. `createSharedState()` - 39 edges
2. `createSimLoop()` - 22 edges
3. `規格書 v1.1 + WBS` - 21 edges
4. `generateRecoilTable()` - 18 edges
5. `WP-3 輸入採集層 InputSampler (F1)` - 17 edges
6. `simStep()` - 16 edges
7. `exec-plan/README.md 執行計畫索引` - 16 edges
8. `createDataRecorder()` - 15 edges
9. `createTargetManager()` - 15 edges
10. `loadDrill()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `collect64HzSamples()` --calls--> `simStep()`  [INFERRED]
  tests/calibration/showpos.test.ts → src/loop/SimLoop.ts
- `D1 — 2D UI = 純 TS + DOM overlay` --semantically_similar_to--> `MetricsDashboard 元件`  [INFERRED] [semantically similar]
  docs/PLAN.md → CONTEXT.md
- `量測時鐘 vs 決定性時鐘 (two-clock model)` --semantically_similar_to--> `主執行緒卡頓污染 sim 計時 (階段 A 隔離不成立)`  [INFERRED] [semantically similar]
  CONTEXT.md → docs/DESIGN.md
- `runSpray()` --calls--> `loadDrill()`  [INFERRED]
  tests/regression/sprayDeterminismFixture.ts → src/drill/DrillLoader.ts
- `不可違反的硬約束 (技術)` --references--> `決定性 (determinism)`  [EXTRACTED]
  CLAUDE.md → CONTEXT.md

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

## Communities (47 total, 15 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (47): collect64HzSamples(), createDataRecorder(), createDrillRunner(), setup(), consume(), createInputSampler(), createSimLoop(), punchToThreeRad() (+39 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (59): round(), simulatePurePunchPattern(), toPatternShot(), applyInput(), ballisticRaycast(), fireOneShot(), projectMissOntoEngagementPlane(), recordVisibleEvents() (+51 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (57): assertFinitePayload(), buildExportPayload(), downloadCSV(), downloadJSON(), downloadTextFile(), exportBasename(), formatBoolean(), formatNumber() (+49 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (51): ADR-2 (three loops communicate via SharedState), ADR-3 (sub-tick), ADR-4 (timing: timeStamp / sim tick time source), Appendix D (stage B physics constants: friction/accelerate/stopspeed), Boolean Accuracy Gate (stopped -> accurate), firstShot / firstShotGate (per-peek first shot flag), Fixed-step Movement (determinism, FPS-independent), HitDetector (Raycaster camera-center hit detection) (+43 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (48): ADR-2 雙迴圈解耦, ADR-3 128 Hz tick, ADR-4 performance.now() 計時源, ADR-5 Pointer Lock + 原始輸入 + coalesced, D1 UI = 純 TS + DOM overlay, WP-0 — 環境設置 (scaffold/createRenderer seam), WP-3 — 高頻輸入採集 (getCoalescedEvents 入緩衝), WP-4 — 目標 / 準心 (+40 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (46): ADR-1 backend metadata, ADR-4 時間源 (performance.now()), counterstrafe_ad_v1 drill config, SharedState, SimLoop (src/loop/SimLoop.ts), WP-0 createRenderer backend seam, WP-1 sensitivity, WP-2 sim tick (+38 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (44): ADR-2 三迴圈經 SharedState 溝通, ADR-3 精準度來源 = sub-tick 輸入時間戳, ADR-4 performance.now() / event.timeStamp 同源, ADR-5 coalesced events, getCoalescedEvents 次幀採樣 (高頻滑鼠不丟樣本), 確定性左右交替輪替 (counter-strafe peek 節奏), 依時序排序消費 + 排空 (決定性契約), sub-tick 輸入時間戳 (精準度真正來源) (+36 more)

### Community 7 - "Community 7"
Cohesion: 0.1
Nodes (21): capacityForDrill(), keyMaskFromKeys(), keyMaskFromState(), keysFromMask(), TickArena, buildIdealPath(), buildPeekWindows(), coefficientOfVariation() (+13 more)

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (39): counterstrafe_ad_v1 counter-strafe drill, docs/operational/acceptance-stage-a.md, docs/operational/timing-validity.md, 里程碑 M1 (WP-2 脊椎 / 決定性驗證), 規格 §14 方法論 (受試者內相對值 + 顯示延遲誤差界線), 規格 §5 八指標, 規格 §9.2 計時效度 150–250 ms, counterReactionMs (急停反應時間) (+31 more)

### Community 9 - "Community 9"
Cohesion: 0.13
Nodes (19): defaultLoader(), disposeScene(), loadScene(), createSceneManager(), SceneManager, err(), requireColorNumber(), requireFiniteNumber() (+11 more)

### Community 10 - "Community 10"
Cohesion: 0.14
Nodes (21): loadDrill(), err(), requireFiniteNumber(), requireNonEmptyString(), requireNonNegativeNumber(), requireObject(), requirePositiveInt(), requirePositiveNumber() (+13 more)

### Community 11 - "Community 11"
Cohesion: 0.17
Nodes (19): appendGuideLine(), appendPath(), classifyResidualSpeed(), createRecoilOverlayModel(), createResultScreen(), createResultSummary(), finiteOffsets(), formatNumber() (+11 more)

### Community 12 - "Community 12"
Cohesion: 0.18
Nodes (19): 記憶分層 (Working/Semantic/Episodic/全域/程序), 程序記憶 (procedural memory), CLAUDE.md 專案執行協議與導航, 垂直切片 = 原子 commit 協議, 雙迴圈 (dual-loop), CONTEXT.md 專有名詞詞彙表, sim tick rate (128 Hz), DECISIONS.md 全域決策與矛盾帳本 (+11 more)

### Community 13 - "Community 13"
Cohesion: 0.18
Nodes (16): coalesced events (getCoalescedEvents), backend (render backend webgpu/webgl2), 原始輸入 (unadjustedMovement), 技術棧 (Three.js WebGPU + TS + Vite), 附錄 E 驗收清單 (階段 A), ADR-1 WebGPURenderer + WebGL2 fallback, ADR-5 Pointer Lock + 原始輸入 + coalesced events, 附錄 C 匯出資料 schema (+8 more)

### Community 14 - "Community 14"
Cohesion: 0.3
Nodes (15): 里程碑 M1 (WP-2 脊椎門控), 里程碑 M2 (WP-5 核心玩法), 里程碑 M3 (WP-7 可匯出資料), 里程碑 M4 (WP-9 階段 A 交付), exec-plan/README.md 執行計畫索引, WP-0 環境建置與學習爬升, WP-1 FPS 控制 + Pointer Lock, WP-2 SharedState + 雙迴圈骨架 (脊椎) (+7 more)

### Community 15 - "Community 15"
Cohesion: 0.38
Nodes (10): err(), requireFiniteNumber(), requireNonNegativeNumber(), requireObject(), requirePositiveInt(), requirePositiveNumber(), validateRecoveryTransition(), validateWeapon() (+2 more)

### Community 16 - "Community 16"
Cohesion: 0.18
Nodes (14): DataRecorder 元件 (preallocated arena), 首發 (first shot / firstShot), 首發命中率, HitDetector 元件, 輸入分桶 (input bucketing), InputSampler 元件, MovementController 元件 (狀態機 M1), peek 與 P2 推進政策 (命中才推進) (+6 more)

### Community 17 - "Community 17"
Cohesion: 0.19
Nodes (13): accumulator 模式, 準心對齊偏移, DrillConfig 元件, F5 接縫 (seam-in, drills-out), fixed-timestep (128 Hz), simStep 順序 (tick 內), GD-1 F5 是否屬階段 A (規格 v1.1 與 seam-in 不一致), 移動 + counter-strafe 能力混淆 (研究設計問題) (+5 more)

### Community 18 - "Community 18"
Cohesion: 0.2
Nodes (11): 正規單位 (canonical unit, source unit u/s), CS2 physics 常數 (階段 B 校準起點), 決定性 (determinism), RenderSnapshot 窄介面, 速度歸零誤差 (residual speed), 階段 B (Stage B), 量測時鐘 vs 決定性時鐘 (two-clock model), 速度 gate (velocity gate) (+3 more)

### Community 22 - "Community 22"
Cohesion: 0.36
Nodes (8): 不可違反的硬約束 (技術), cross-origin isolation (COOP/COEP), MetricsDashboard 元件, D1 — 2D UI = 純 TS + DOM overlay, D3 — COOP/COEP 部署 (Vite plugin + 靜態主機後定), ADR-4 performance.now() + cross-origin isolation, WP-0 T2 Cross-origin isolation, WP-0 T4 Deploy headers

### Community 24 - "Community 24"
Cohesion: 0.5
Nodes (4): 急停反應時間 (t_counter − t_visible), t_visible, TargetManager 元件, F2 — 記錄 t_visible spawn/可見時間戳

## Knowledge Gaps
- **89 isolated node(s):** `程序記憶 (procedural memory)`, `垂直切片 = 原子 commit 協議`, `記憶分層 (Working/Semantic/Episodic/全域/程序)`, `counter-strafe (反向急停)`, `反向鍵 (counter key)` (+84 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createSharedState()` connect `Community 0` to `Community 1`, `Community 2`, `Community 7`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `createSimLoop()` connect `Community 0` to `Community 1`, `Community 2`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Are the 16 inferred relationships involving `createSharedState()` (e.g. with `setup()` and `fireAt()`) actually correct?**
  _`createSharedState()` has 16 INFERRED edges - model-reasoned connections that need verification._
- **Are the 11 inferred relationships involving `createSimLoop()` (e.g. with `buildSimLoop()` and `createMovementController()`) actually correct?**
  _`createSimLoop()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `generateRecoilTable()` (e.g. with `runtime()` and `createSimLoop()`) actually correct?**
  _`generateRecoilTable()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `程序記憶 (procedural memory)`, `垂直切片 = 原子 commit 協議`, `記憶分層 (Working/Semantic/Episodic/全域/程序)` to the rest of the system?**
  _89 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._