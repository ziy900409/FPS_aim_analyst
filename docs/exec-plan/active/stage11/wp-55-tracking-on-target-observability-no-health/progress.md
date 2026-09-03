# WP-55 — progress / decision log

> Tech spec：[README.md](README.md) · Checklist：[task-checklist.md](task-checklist.md)

## Status

- **Current**：🟢 T3 all tracking drill coverage 完成（2026-09-03）；T4 replay observability 待開工。
- **Scope state**：從 existing raw tracking telemetry 推導 on-target observability；不新增 health/damage lifecycle；第一版以 export 後 derived contact artifact 為主，不做產品 Replay overlay。
- **Dependency state**：依賴現有 `tracking_v1`、`tracking_longrange_v1`、`tracking_br_v1`、schema v2、`deriveTrackingMetrics()` 與 Replay contract；WP-54 新 tracking pilot drills 已存在，但 T0 凍結為 adjacent/future 接入同一 contact artifact contract，不擴大 T1-T5 必達矩陣。

## Progress

### 2026-09-03 — T3 all tracking drill coverage complete

- 新增 `src/metrics/trackingContactCoverage.ts`，以 T2 `buildTrackingContactArtifact()` 為唯一 contact 來源，輸出 per-run included/excluded 狀態、pure P0 contact summary、BR companion evidence 與 blocked reason counts。
- Pure summary 只從 `TrackingContactSample[]` 推導 acquisition、TOT、RMS/median/P95 epsilon；不讀 `fire`、`hit`、damage、kill 或 recorder hit count。
- `tracking_v1` fixture 驗證 contact samples、acquisition、TOT、RMS epsilon 與 `deriveTrackingMetrics()` parity。
- `tracking_longrange_v1` fixture 驗證 meta hitbox provenance、source unit 與 0.5 deg angular-height contract。
- `tracking_br_v1` fixture 驗證 aim-ray contact samples，並把 ADS ticks/events、hitscan fire hit 與 projectile hit event 放在 BR companion 欄位；改變 ballistic fire/hit events 不會改變 pure summary。
- Protocol-incompatible artifact 在 coverage report 中以 `excluded` run 保留 reason code/exclusion count，不進 aggregate。
- WP-54 `tracking_core_pr_pilot_v1_*` / `tracking_reversal_pilot_v1_*` 只做 contact-contract compatibility smoke，不發布或混入 WP-54 pilot metric release。

### 2026-09-03 — T2 export-derived artifact complete

- 新增 `src/metrics/trackingContactArtifact.ts`，定義 `tracking-contact-artifact-v1` JSON artifact schema，固定輸出 `analysisVersion`、`generatedFrom: 'export-derived'`、`sourceRunId`/`exportBasename`、`drillId`、`schemaVersion`、`simHz`、geometry provenance、`sampleCount` 與 per-tick contact samples。
- Artifact generation 只呼叫 T1 的 `deriveTrackingContactSamples(payload)`，不修改 `DataRecorder`、raw export schema、sim loop、render loop 或 replay state；contact 仍是 export 後同步分析層。
- Geometry provenance：hitbox source 明列 `meta.targets.hitbox` / `options.hitbox` / `default-h1`；eye origin source 明列 `explicit` / `meta` / `legacy-default`。Default path 仍 fail-closed 要求 metadata eye origin；legacy-default 只在呼叫端明確 `strictEyeOrigin: false` 時可見。
- Traceability：未提供 `sourceRunId` 時以 `${drillId}@${startedAt}` 決定性產生；若 `startedAt` 不可解析且呼叫端也未提供 explicit source，artifact blocked `protocol-incompatible`，不偽造 run identity。
- Blocked semantics：artifact 沿用 T1 七碼 closed vocabulary；blocked output 不含 `samples`，`sampleCount: 0` 只表示未產 sample artifact，不輸出 0 TOT、空圖表或 fake off-target timeline。
- Determinism/perf evidence：同一 export 重跑 `serializeTrackingContactArtifact()` byte-equivalent；30 秒 synthetic tracking reference export（128 Hz、3840 ticks、perfect follower、1 iteration measured inside Vitest）通過 < 500 ms gate。Environment snapshot：Node v25.9.0、Windows 10.0.26100.0、AMD64、28 logical cores、CPU identifier `Intel64 Family 6 Model 183 Stepping 1, GenuineIntel`。

### 2026-09-03 — T1 contact geometry contract complete

- 新增 `src/metrics/trackingContact.ts`，凍結 `TrackingContactSample`、`TrackingContactDerivationResult`、`TrackingContactBlockedReason` 與 `deriveTrackingContactSamples(payload)`。
- Geometry source：T1 不複製新的近似 hitbox；`deriveTrackingContactSamples()` 先 fail-closed validation，再呼叫既有 `deriveTrackingSamples()`，因此 `onTarget` 使用 `trackingDerivation.ts` 的 exact AABB ray/slab geometry，`epsilonDeg` 使用同一 `angularEccentricityDeg()`/`resolveEyeOrigin()` 鏈。
- Contact selection：只輸出每個 presentation/scored window 內 `tx/ty/tz` 皆存在的 active target ticks；若同 target 有 `scored_start`，contact sample 從 scored window 開始；null target ticks 被跳過，不跨下一個 `visible` presentation。
- Fail-closed contract：預設 `strictEyeOrigin: true`；blocked reasons 覆蓋 `schema-version-unsupported`、`missing-visible-event`、`missing-target-telemetry`、`missing-eye-origin`、`invalid-hitbox`、`no-tracking-drill`、`protocol-incompatible`。Known miss 仍輸出觀測 samples，不偽裝 blocked 或 0。
- Fixture matrix：typed contract、perfect on-target、known miss、inclusive edge hit / outside miss、target invisible skip、presentation boundary、`scored_start` trimming、metadata hitbox priority、default H1 hitbox fallback、invalid hitbox、missing eye origin、metrics parity 全部由 `src/metrics/trackingContact.test.ts` 覆蓋。
- Metrics parity：contact-derived first on-target / acquisition / TOT / RMS epsilon 與 `deriveTrackingMetrics(payload, { strictEyeOrigin: true })` 對表成立。

### 2026-09-03 — T0 scope freeze/no-health audit complete

- 使用者要求「實作 t0」後，WP-55 正式納入 stage11 M21；stage11 [README](../README.md)、[master checklist](../task-checklist.md) 與 [progress](../progress.md) 已同步。
- Entry snapshot：HEAD `7976fc23f3a71cbcd300d9f500158f7876666a4a`；`git status --short` 在 T0 前已有 unrelated `M src/main.ts` 與 `?? tests/e2e/tracking-pilot-live.spec.ts`，本切片不觸碰。
- CodeGraph：`codegraph.cmd status` 顯示 528 files / 8,454 nodes / 28,153 edges，`[OK] Index is up to date`；同時提示 index 由 earlier version 建立，後續若需要新版分析可 `codegraph sync`/full rebuild。`codegraph` PowerShell shim 被 execution policy 擋住，改用 `codegraph.cmd`。
- graphify freshness：`graphify-out/GRAPH_REPORT.md` built from commit `dc1cc480`，相對本輪 HEAD `7976fc23...` stale；T0 只改 docs，未執行 `graphify update .`。
- Baseline：`npx.cmd vitest run src/metrics/trackingDerivation.test.ts src/metrics/trackingTransitions.test.ts src/drill/tracking_v1.test.ts src/drill/tracking_longrange_v1.test.ts src/drill/tracking_br_v1.test.ts tests/regression/longrange-tracking-determinism.test.ts tests/regression/br-tracking-invariants.test.ts tests/regression/br-camera-anchor-invariants.test.ts tests/regression/projectile-determinism.test.ts tests/regression/moving-target-determinism.test.ts` -> 10 files / 50 tests passed.

#### T0 blast radius and actual target paths

| Area | Actual path/symbol | CodeGraph impact | T1-T6 note |
|---|---|---|---|
| Target state | `src/state/types.ts` `TargetState` | 32 callers across `src/sim/HitDetector.ts`, `src/render/TargetView.ts`, `src/state/SharedState.ts`, `src/testharness/fpsTestHarness.ts`; tests include muzzle tracer, target/render and first-shot coverage | Cross-module; do not add health/HP/damage lifecycle fields |
| Target lifecycle | `src/sim/TargetManager.ts` `createTargetManager()` / `markKilled()` / `hasAliveTarget()` | `hasAliveTarget()` local to TargetManager; `createTargetManager()` drives spawn, visibility, motion, trackingTrajectory and `scored_start` | `markKilled()` removes target and clears timestamps; no damage/HP decrement model |
| Hit path | `src/sim/HitDetector.ts` `raycastWithRay()` and `src/loop/SimLoop.ts` `targetAabb()` / projectile hit branch | `targetAabb()` local to `SimLoop` with no direct covering tests; broader hit path covered by `SimLoop.test.ts`, ballistic/projectile regressions and `HitDetector.test.ts` | T1 geometry parity must compare aim-ray contact with this same hitbox source, not shooting outcome |
| Recorder/export | `src/data/DataRecorder.ts` `createDataRecorder()` / `recordEvent()` and `src/data/export.ts` `buildExportPayload()` | `createDataRecorder()` 46 callers; `buildExportPayload()` 22 callers via `main.ts` and harnesses | Keep raw ticks/events unchanged; derived contact generated after export |
| Schema/parser/meta | `src/data/exportPayloadSchema.ts` `parseExportPayload()` / `parseTargetsMeta()` and `src/data/metadata.ts` `Meta` | `parseExportPayload()` 10 callers in history/replay/server; `Meta` 72 callers | Additive parser changes only if T2 needs stricter contact metadata validation |
| Eye origin | `src/metrics/eyeOrigin.ts` `resolveEyeOrigin()` / `eyeOriginForTick()` | Shared by tracking/detection derivation | T1/T2 should map strict fallback failures to reason-coded blocked result |
| Canonical tracking metrics | `src/metrics/trackingDerivation.ts` `deriveTrackingMetrics()` / `deriveTrackingSamples()` | `deriveTrackingSamples()` 11 callers in research, spider-shot, tracking dynamics and tests | Reuse for epsilon/TOT parity; avoid rewriting existing P0 semantics |
| Replay | `src/replay/sampleReplay.ts` `sampleReplay()`, `src/replay/ReplayPlayer.ts`, `src/render/replay/ReplayTargetView.ts`, `src/ui/replay/ReplayScreen.ts` | `sampleReplay()` 7 callers; `ReplayTargetView` 6 callers; replay tests cover sample/player/presentation/visual seek | T4 starts with offline contact frame alignment; product overlay stays optional/future |
| Report consumers | `src/results/ResultPresentation.ts`, `src/metrics/researchMetrics.ts`, `src/pilot/trackingPilotEvidence.ts`, `src/pilot/trackingPilotReport.ts` | Result presentation builds current/historical view model; WP-54 evidence/report consume `deriveTrackingMetrics()`/dynamics | T5 report must split pure tracking contact from BR ballistic hit/lead evidence |
| Drill roster | `src/drill/tracking_v1.ts`, `src/drill/tracking_longrange_v1.ts`, `src/drill/tracking_br_v1.ts` | Existing tests cover configs and BR invariants; WP-54 candidate files also exist under `tracking_core_pr_pilot_v1.ts` / `tracking_reversal_pilot_v1.ts` | Required WP-55 matrix frozen to the three existing tracking drills; WP-54 drills are adjacent adopters |

#### T0 no-health/no-damage audit

- `rg -n "\b(health|hp|damage|armor|killCount|kills|targetHealth|healthBar)\b" ...` found no production target-health/damage contract. Matches are stage11 WP-55 planning docs, History API `/api/history/health`, test variable `hp` meaning hit point output in `HitDetector.test.ts`, and unrelated process `kill` comments.
- `TargetState` has `visible`, `alive`, `hitbox`, optional `hitboxVaries`, motion and timing fields; no HP/damage/health bar.
- `DrillConfig.targets` has `hitbox`, optional `hitboxCandidates`, motion/trajectory/timing fields; `sequence.peekTimeoutMs` text says timeout advances if not killed, but no HP/damage schema.
- Hit path records `fire` and `hit` events plus `fireCount`/`hitCount`; WP-55 contact derivation must not consume hit count as pure tracking on-target evidence. BR projectile/hitscan may be companion evidence only.
- Render/replay target views scale meshes from `TargetState.hitbox` / `meta.targets.hitbox`; no health bar UI was introduced.

### 2026-09-01 — Planning

- 依使用者要求讀取 `.claude/skills/engineering-planning/SKILL.md`、WP-55 source proposal 與 WP-51 work-package 格式。
- 參照 WP-51 的 `README.md`、`task-checklist.md`、T0/T1 task file 與 progress pattern，將 WP-55 候選單檔整理為自足 WP 資料夾。
- 讀取 stage11 既有 README/checklist/progress 與 WP-54 格式；決定先比照 WP-54 保持 candidate WP，不改 stage11 master 文件。
- 新增本 WP 的 `README.md`、`task-checklist.md` 與 `progress.md`；本次只新增文件，未修改 production code。

## Decision log

| ID | 決策 | 理由 | 狀態 |
|---|---|---|---|
| D-55.1 | Tracking 跟隨判定以 exact-hitbox aim-ray `onTarget`、TOT 與 RMS/epsilon 為核心，不新增血條/HP/damage | Tracking 是逐 tick 跟隨構念；health/damage/kill 會把 shooting outcome 混入主指標 | ✅ Confirmed（T0） |
| D-55.2 | Contact derivation 放在 export 後分析層，不寫回 sim state | 沿用 `DataRecorder -> ExportPayload -> metrics/report` 責任切分，降低 sim/render regression 風險 | ✅ Confirmed（T0） |
| D-55.3 | 第一版優先支援 derived artifact；產品 Replay overlay 由 T0/OQ-55-1 決定 | 離線 artifact 可先滿足研究稽核，Replay UI scope 對估時與測試面影響較大 | ✅ Confirmed（T0；offline artifact first） |
| D-55.4 | BR/projectile tracking 同時可呈現 ballistic hit 與 aim-ray contact，但 pure tracking summary 不讀 hit count | 避免 projectile lead/travel time 被誤解為準心跟隨能力 | ✅ Confirmed（T0） |
| D-55.5 | T2 artifact 先交付 deterministic JSON builder，不新增 CSV/HTML writer | OQ-55-3 已決定另存 deterministic derived contact JSON；CSV/HTML 不是 T2 必要條件，後續 Replay/report task 可從同一 JSON model 投影 | ✅ Confirmed（T2） |
| D-55.6 | T3 新增 metrics-layer coverage projection，而不把 BR companion 直接塞進 T2 artifact schema | T2 artifact 已凍結為 deterministic contact JSON；T3 需要的是 all-drill coverage 與 BR/pure 分層 evidence，report UI/HTML integration 留給 T5 | ✅ Confirmed（T3） |
| D-55.7 | Contact derivation 的 hitbox 閘門接受 `shape:'sphere'`（三軸相等），不再 box-only | 原本的 box-only 閘門是正確的防線——但它防的是 `trackingDerivation.isOnTarget()` 忽略 `shape` 這個更底層的 bug（[KI-021](../../../../known_issue/KI-021-tracking-derivation-ignores-sphere-hitbox-shape.md)／BD-021），而非 sphere 本身不可支援。KI-021 讓推導層拿到與 `HitDetector` 相同的 ray/sphere 幾何後，排除 sphere payload 就變成純粹的資料損失。閘門同時新增「sphere 三軸必須相等」（鏡射 `schema.ts:243`），否則畸形 sphere 會只用 `widthU` 靜默推導。實測：WP-54 candidate drills 改 sphere 後，`trackingContactCoverage.test.ts` 的 `includedRunCount` 仍為 2；若少了本決策則掉到 0 | ✅ Confirmed（2026-09-03，KI-021 slice B） |

## Open Questions

| ID | 問題 | Owner | Deadline | Impact |
|---|---|---|---|---|
| OQ-55-1 | Replay 可觀測性要做到產品 UI，還是先產出離線 HTML/JSON replay artifact？ | 使用者 | T0 | ✅ Resolved（T0）：先做離線 JSON/HTML replay/contact artifact；產品 Replay overlay optional/future |
| OQ-55-2 | 「tracking 項目」是否只包含現有三類，或也包含 WP-54 候選新 drills？ | 使用者 + 研究者 | T0 | ✅ Resolved（T0）：T1-T5 required matrix 只含 `tracking_v1`、`tracking_longrange_v1`、`tracking_br_v1`；WP-54 drills 以同 contract adjacent 接入 |
| OQ-55-3 | Export 支援是 raw export 足以重建，還是要另存 derived contact JSON/CSV？ | 使用者 | T0 | ✅ Resolved（T0）：另存 deterministic derived contact JSON；CSV/HTML 可由後續 task 視需要產出 |
| OQ-55-4 | BR projectile 條件中是否同時顯示 ballistic hit 與 aim-ray on-target？ | 研究者 | T1 | ✅ Resolved（T0）：兩者分欄呈現；pure tracking summary 不讀 ballistic hit/hit count |

## Verification log

| Date | Command / inspection | Result |
|---|---|---|
| 2026-09-01 | `Get-Content .claude/skills/engineering-planning/SKILL.md` | skill loaded |
| 2026-09-01 | `Get-Content AGENTS.md` / `Get-Content graphify-out/GRAPH_REPORT.md` | project planning rules and graph hubs loaded |
| 2026-09-01 | `Get-Content docs/exec-plan/active/stage11/wp-55-tracking-on-target-observability-no-health-plan.md` | source proposal loaded |
| 2026-09-01 | `Get-Content docs/exec-plan/active/stage10/wp-51-m18-integration-and-acceptance/README.md` and `task-checklist.md` | WP-51 output format reviewed |
| 2026-09-01 | `Get-Content docs/exec-plan/active/stage11/wp-54-tracking-pilot/README.md` and `task-checklist.md` | candidate WP pattern reviewed |
| 2026-09-03 | `Get-Content .claude/skills/incremental-implementation/SKILL.md` and `references/es-analysis.md` | incremental implementation skill loaded; project reference noted but actual repo is TS/Vitest |
| 2026-09-03 | `Get-Content README.md` / `T0-scope-freeze-no-health-audit.md` / stage11 master docs / `graphify-out/GRAPH_REPORT.md` | T0 inputs loaded; graphify report built from older commit `dc1cc480` |
| 2026-09-03 | `git rev-parse HEAD` / `git status --short` | HEAD `7976fc23f3a71cbcd300d9f500158f7876666a4a`; unrelated `M src/main.ts` and `?? tests/e2e/tracking-pilot-live.spec.ts` present |
| 2026-09-03 | `codegraph.cmd status` | up to date; 528 files / 8,454 nodes / 28,153 edges; earlier-version index warning recorded |
| 2026-09-03 | CodeGraph explore: target state/manager/hit path/export/schema/replay/report/drill roster | blast radius and actual target paths recorded in T0 progress |
| 2026-09-03 | No-health audit `rg` scans over `src`, `server`, `tests`, `docs/operational`, stage11 docs | no target health/HP/damage/health bar contract found; History API health route is unrelated |
| 2026-09-03 | `npx.cmd vitest run src/metrics/trackingDerivation.test.ts src/metrics/trackingTransitions.test.ts src/drill/tracking_v1.test.ts src/drill/tracking_longrange_v1.test.ts src/drill/tracking_br_v1.test.ts tests/regression/longrange-tracking-determinism.test.ts tests/regression/br-tracking-invariants.test.ts tests/regression/br-camera-anchor-invariants.test.ts tests/regression/projectile-determinism.test.ts tests/regression/moving-target-determinism.test.ts` | 10 files / 50 tests passed |
| 2026-09-03 | `npx.cmd vitest run src/metrics/trackingContact.test.ts` | 1 file / 9 tests passed |
| 2026-09-03 | `npx.cmd vitest run src/metrics/trackingContact.test.ts src/metrics/trackingDerivation.test.ts` | 2 files / 19 tests passed |
| 2026-09-03 | `npm.cmd run typecheck` | exit 0 |
| 2026-09-03 | `npx.cmd vitest run src/metrics/trackingDerivation.test.ts src/metrics/trackingTransitions.test.ts src/drill/tracking_v1.test.ts src/drill/tracking_longrange_v1.test.ts src/drill/tracking_br_v1.test.ts tests/regression/longrange-tracking-determinism.test.ts tests/regression/br-tracking-invariants.test.ts tests/regression/br-camera-anchor-invariants.test.ts tests/regression/projectile-determinism.test.ts tests/regression/moving-target-determinism.test.ts` | T1 post-change baseline: 10 files / 50 tests passed |
| 2026-09-03 | `mcp__codegraph__codegraph_explore` for `trackingContact`, export schema, metadata, pilot evidence and tracking derivation symbols | T2 blast radius reviewed: additive artifact consumer of `deriveTrackingContactSamples()`; no `DataRecorder`/raw export/schema/sim/render changes required |
| 2026-09-03 | `npx.cmd vitest run src/metrics/trackingContactArtifact.test.ts` | 1 file / 7 tests passed; includes sourceRunId/export basename traceability, closed reason vocabulary, no fake samples/metrics, byte-equivalent JSON, and 30 s / 3840 tick perf gate |
| 2026-09-03 | `npm.cmd run typecheck` | exit 0 |
| 2026-09-03 | `npx.cmd vitest run src/metrics/trackingContact.test.ts src/metrics/trackingContactArtifact.test.ts src/metrics/trackingDerivation.test.ts` | T2 focused regression: 3 files / 26 tests passed |
| 2026-09-03 | `npx.cmd vitest run src/metrics/trackingContactArtifact.test.ts src/metrics/trackingContact.test.ts src/metrics/trackingDerivation.test.ts src/metrics/trackingTransitions.test.ts src/drill/tracking_v1.test.ts src/drill/tracking_longrange_v1.test.ts src/drill/tracking_br_v1.test.ts tests/regression/longrange-tracking-determinism.test.ts tests/regression/br-tracking-invariants.test.ts tests/regression/br-camera-anchor-invariants.test.ts tests/regression/projectile-determinism.test.ts tests/regression/moving-target-determinism.test.ts` | T2 + legacy tracking/BR baseline: 12 files / 66 tests passed |
| 2026-09-03 | `graphify update .` | Executed after code changes, but generated `graphify-out` was restored/not staged because the local worktree contained unrelated uncommitted files (`scripts/analyze-tracking-pilot.ts`, `src/sim/__probe.test.ts`, `src/sim/trackingTrajectory.ts`) that graphify indexed into the manifest/graph |
| 2026-09-03 | `npx.cmd vitest run src/metrics/trackingContactCoverage.test.ts` | T3 narrow coverage: 1 file / 6 tests passed |
| 2026-09-03 | `npx.cmd vitest run src/metrics/trackingContactCoverage.test.ts src/metrics/trackingContactArtifact.test.ts src/metrics/trackingContact.test.ts src/metrics/trackingDerivation.test.ts` | T3 focused contact regression: 4 files / 32 tests passed |
| 2026-09-03 | `npm.cmd run typecheck` | exit 0 |
| 2026-09-03 | `npx.cmd vitest run src/metrics/trackingContactCoverage.test.ts src/metrics/trackingContactArtifact.test.ts src/metrics/trackingContact.test.ts src/metrics/trackingDerivation.test.ts src/metrics/trackingTransitions.test.ts src/drill/tracking_v1.test.ts src/drill/tracking_longrange_v1.test.ts src/drill/tracking_br_v1.test.ts tests/regression/longrange-tracking-determinism.test.ts tests/regression/br-tracking-invariants.test.ts tests/regression/br-camera-anchor-invariants.test.ts tests/regression/projectile-determinism.test.ts tests/regression/moving-target-determinism.test.ts` | T3 + legacy tracking/BR baseline: 13 files / 72 tests passed |
| 2026-09-03 | `graphify update .` | Executed after code changes, but generated `graphify-out` was restored/not staged because unrelated local worktree changes would be indexed into the graph output |

## Surprises & Discoveries

- **2026-09-03（KI-021）**：T3 為了讓 WP-54 candidate drills 進 coverage，曾請 WP-54 側維持 cube hitbox。追查該 box-only 限制的來源後發現，真正的問題不在 WP-55 的閘門，而在 `src/metrics/trackingDerivation.ts`：`isOnTarget()` 是無條件的 ray/AABB slab test，`hitboxFromMeta()` 又把 `shape` 丟掉——`spider-shot-v2`（正式 Assessment drill）的球體目標因此一直被當成外接立方體判定。也就是說 WP-55 的閘門其實是在**正確地**拒絕一個會算錯的推導。修復記於 KI-021／BD-021，WP-55 側的放寬記為 D-55.7。
- WP-55 source proposal is still a single candidate plan file under stage11, while WP-51 and WP-54 use self-contained WP folders. This planning pass keeps the source proposal intact and adds the folderized artifacts beside it.
- Existing `git status` already contains unrelated modified stage10/operational/graphify files plus WP-54/WP-55 proposal files. This pass intentionally adds only `docs/exec-plan/active/stage11/wp-55-tracking-on-target-observability-no-health/` files and does not touch those pre-existing changes.
- T0 run found the current worktree already has unrelated `src/main.ts` and `tests/e2e/tracking-pilot-live.spec.ts`; WP-55 T0 docs intentionally avoid touching those files.
- The named incremental implementation reference says this repo is Python/Poetry ES_analysis, but the actual workspace is TypeScript/Vitest FPS_aim_analyst. Verification therefore follows `package.json` scripts and stage11 task docs, not the stale Poetry commands in that reference.
- T1 edge miss fixture initially used `x=0.500001` at target depth and still hit because the AABB has depth; the final outside oracle uses `x=0.58`, which clears the front slab for the default H1 box.
- T2 environment recording via `Get-CimInstance` was denied by local Windows permissions; fallback environment snapshot uses Node/OS/.NET environment APIs and `$env:PROCESSOR_IDENTIFIER`, which is sufficient for the lightweight artifact perf gate.
- T3 graphify cleanup observed unrelated local changes outside WP-55; graphify output was therefore regenerated for freshness evidence but restored before commit to avoid mixing unrelated indexed state into WP-55.
