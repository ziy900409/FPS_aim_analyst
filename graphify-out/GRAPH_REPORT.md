# Graph Report - FPS_aim_analyst  (2026-07-02)

## Corpus Check
- 48 files · ~71,093 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 484 nodes · 866 edges · 28 communities (16 shown, 12 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 38 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `16837d12`
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
- [[_COMMUNITY_Community 12|Community 12]]
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

## God Nodes (most connected - your core abstractions)
1. `規格書 v1.1 + WBS` - 21 edges
2. `createSharedState()` - 18 edges
3. `WP-3 輸入採集層 InputSampler (F1)` - 17 edges
4. `exec-plan/README.md 執行計畫索引` - 16 edges
5. `PLAN.md 執行計畫 (階段 A)` - 14 edges
6. `WP-4 目標系統 + t_visible (F2)` - 13 edges
7. `validateDrill()` - 11 edges
8. `T1 — E2E 整合測試 (drill→匯出→統計)` - 11 edges
9. `規格附錄 E — 階段 A 驗收清單 (10 項)` - 11 edges
10. `CLAUDE.md 專案執行協議與導航` - 10 edges

## Surprising Connections (you probably didn't know these)
- `D1 — 2D UI = 純 TS + DOM overlay` --semantically_similar_to--> `MetricsDashboard 元件`  [INFERRED] [semantically similar]
  docs/PLAN.md → CONTEXT.md
- `量測時鐘 vs 決定性時鐘 (two-clock model)` --semantically_similar_to--> `主執行緒卡頓污染 sim 計時 (階段 A 隔離不成立)`  [INFERRED] [semantically similar]
  CONTEXT.md → docs/DESIGN.md
- `WP-8 MetricsDashboard + HUD` --implements--> `MetricsDashboard 元件`  [EXTRACTED]
  docs/exec-plan/README.md → CONTEXT.md
- `CLAUDE.md 專案執行協議與導航` --references--> `exec-plan/README.md 執行計畫索引`  [EXTRACTED]
  CLAUDE.md → docs/exec-plan/README.md
- `不可違反的硬約束 (技術)` --references--> `DataRecorder 元件 (preallocated arena)`  [EXTRACTED]
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

## Communities (28 total, 12 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (26): createDrillRunner(), setup(), consume(), applyInput(), createSimLoop(), simStep(), currentPeekId(), firstShotGate() (+18 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (60): 不可違反的硬約束 (技術), 記憶分層 (Working/Semantic/Episodic/全域/程序), 程序記憶 (procedural memory), CLAUDE.md 專案執行協議與導航, 垂直切片 = 原子 commit 協議, accumulator 模式, coalesced events (getCoalescedEvents), cross-origin isolation (COOP/COEP) (+52 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (51): ADR-2 (three loops communicate via SharedState), ADR-3 (sub-tick), ADR-4 (timing: timeStamp / sim tick time source), Appendix D (stage B physics constants: friction/accelerate/stopspeed), Boolean Accuracy Gate (stopped -> accurate), firstShot / firstShotGate (per-peek first shot flag), Fixed-step Movement (determinism, FPS-independent), HitDetector (Raycaster camera-center hit detection) (+43 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (47): ADR-2 雙迴圈解耦, ADR-3 128 Hz tick, ADR-4 performance.now() 計時源, ADR-5 Pointer Lock + 原始輸入 + coalesced, WP-0 — 環境設置 (scaffold/createRenderer seam), WP-3 — 高頻輸入採集 (getCoalescedEvents 入緩衝), WP-4 — 目標 / 準心, WP-5 — movement / 急停物理 (+39 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (47): ADR-1 backend metadata, ADR-4 時間源 (performance.now()), counterstrafe_ad_v1 drill config, D1 UI = 純 TS + DOM overlay, SharedState, SimLoop (src/loop/SimLoop.ts), WP-0 createRenderer backend seam, WP-1 sensitivity (+39 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (14): createInputSampler(), createPointerLock(), createRenderLoop(), lerp(), createRenderer(), pickBackend(), resolveBackend(), SceneManager (+6 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (44): ADR-2 三迴圈經 SharedState 溝通, ADR-3 精準度來源 = sub-tick 輸入時間戳, ADR-4 performance.now() / event.timeStamp 同源, ADR-5 coalesced events, getCoalescedEvents 次幀採樣 (高頻滑鼠不丟樣本), 確定性左右交替輪替 (counter-strafe peek 節奏), 依時序排序消費 + 排空 (決定性契約), sub-tick 輸入時間戳 (精準度真正來源) (+36 more)

### Community 7 - "Community 7"
Cohesion: 0.08
Nodes (40): 正規單位 (canonical unit, source unit u/s), 急停反應時間 (t_counter − t_visible), CS2 physics 常數 (階段 B 校準起點), DataRecorder 元件 (preallocated arena), 首發 (first shot / firstShot), 首發命中率, HitDetector 元件, 輸入分桶 (input bucketing) (+32 more)

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (39): counterstrafe_ad_v1 counter-strafe drill, docs/operational/acceptance-stage-a.md, docs/operational/timing-validity.md, 里程碑 M1 (WP-2 脊椎 / 決定性驗證), 規格 §14 方法論 (受試者內相對值 + 顯示延遲誤差界線), 規格 §5 八指標, 規格 §9.2 計時效度 150–250 ms, counterReactionMs (急停反應時間) (+31 more)

### Community 9 - "Community 9"
Cohesion: 0.35
Nodes (9): loadDrill(), err(), requireFiniteNumber(), requireNonNegativeNumber(), requireObject(), requirePositiveInt(), requirePositiveNumber(), validateDrill() (+1 more)

## Knowledge Gaps
- **89 isolated node(s):** `程序記憶 (procedural memory)`, `垂直切片 = 原子 commit 協議`, `記憶分層 (Working/Semantic/Episodic/全域/程序)`, `counter-strafe (反向急停)`, `反向鍵 (counter key)` (+84 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `規格書 v1.1 + WBS` connect `Community 1` to `Community 7`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `D1 UI = 純 TS + DOM overlay` connect `Community 4` to `Community 3`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `里程碑 M1 (WP-2 脊椎 / 決定性驗證)` connect `Community 8` to `Community 6`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `createSharedState()` (e.g. with `setup()` and `freshState()`) actually correct?**
  _`createSharedState()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `程序記憶 (procedural memory)`, `垂直切片 = 原子 commit 協議`, `記憶分層 (Working/Semantic/Episodic/全域/程序)` to the rest of the system?**
  _89 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._