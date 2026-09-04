# WP-55 — progress / decision log

> Tech spec：[README.md](README.md) · Checklist：[task-checklist.md](task-checklist.md)

## Status

- **Current**：✅ **WP-55 完成。T0-T6 + T-exit + T7 全數交付;M21 = pass（2026-09-04）。** T-exit 曾以 conditional pass 結案並開立 OI-55-1;T7 補上 `npm run analyze:contact` operator 入口後 OI-55-1 關閉,M21 收成 pass。
- **Scope state**：從 existing raw tracking telemetry 推導 on-target observability；不新增 health/damage lifecycle；第一版以 export 後 derived contact artifact 為主，不做產品 Replay overlay。
- **Dependency state**：依賴現有 `tracking_v1`、`tracking_longrange_v1`、`tracking_br_v1`、schema v2、`deriveTrackingMetrics()` 與 Replay contract；WP-54 新 tracking pilot drills 已存在，但 T0 凍結為 adjacent/future 接入同一 contact artifact contract，不擴大 T1-T5 必達矩陣。

## Progress

### 2026-09-04 — T7 operator entry point complete（OI-55-1 關閉 ⇒ M21 = pass）

- 新增 `scripts/trackingContactRunner.ts`（純函式:loaded runs → 要寫出的檔案內容 + manifest + summary,無 fs、無 process）與 `scripts/analyze-tracking-contact.ts`（CLI:收檔/parse/mkdir/write/exit code）。責任切分照 repo 既有慣例（`trackingGateBExtract.ts` 純邏輯 / `analyze-tracking-pilot.ts` I/O 邊界），讓輸出契約可在無檔案系統的情況下被測。
- `npm run analyze:contact -- <export.json | export-dir> [--out <dir>] [--no-strict-eye-origin]`;預設輸出 `.contact-analysis/`,已加 `.gitignore` 條目並註明理由（contact artifact 由 participant export 衍生,紅線同 WP-54 的 `.pilot-analysis/`）。
- 輸出五類檔案:per-run `contact-artifact.json`（含 blocked run）、per-included-run `replay-trace.html`、聚合 `tracking-contact-report.json` / `.html`、以及 `manifest.json`（輸出檔 ↔ 來源 export 檔 ↔ `sourceId` 對照,交付 NFR-55-5 的 operator 側可追溯性）。
- **runner 不重新定義任何 contact 構念（C-D4）**:所有數值皆取自 `buildTrackingContactCoverageReport()` / `buildTrackingContactReport()` / `buildReplayContactTrace()`;測試 `reports the same coverage as calling the shipped coverage function directly` 直接把 runner 的 coverage 與 shipped 函式對表。未改任何凍結 schema 版本字串。
- **End-to-end 實跑 + 解析式覆驗**:3 份 synthetic export（正常 / 缺 `visible` event / schema 破損）⇒ `runs: 2 (included 1, excluded 1)`、`missing-visible-event=1`、`rejected files: 1`（具名）。included run 輸出 `tAcquireMs = 250`、`totPercent = 100`（pursuit n=224）、`rmsEpsilonDeg = 0.249591`。這兩個數字**用解析值反推覆驗過**:注入 acquisition 在第 32 tick ⇒ 32 × (1000/128) = 250 ms 精確相符;注入 aim 誤差為 0.35° 正弦 ⇒ RMS = 0.35/√2 = 0.247° 與輸出相符。⇒ runner 真的接上既有推導,不是自行產數。
- Blocked run 仍產 artifact（`status:'blocked'`、closed reason code、`sampleCount: 0`、無 `samples`）,不產 replay trace,不偽裝 0 TOT（FR-55-7）。schema-rejected 檔照 `analyze-tracking-pilot.ts` 先例收進 `rejected[]` 並具名,不中止整批,但讓 CLI 以 exit 1 結束（rejected 是 operator 側問題;blocked 是合法結果,不影響 exit code）。
- 預設輸出目錄經 `git check-ignore -v` 確認被 `.gitignore:38` 擋住;跑完 runner 後 `git status --short` 不出現任何 artifact。
- **驗證**:runner 7 tests 綠;WP-55 focused suite 6 files / 47 tests passed（T-exit 時 5 / 40）;`npm.cmd run typecheck` exit 0;full `npm.cmd test` 217 files / 2078 tests passed、1 file / 2 tests skipped、exit 0。
- 未動 sim/render/`TargetManager`/`SharedState`/live render hot path;未新增 health/HP/damage/kill contract;未做產品 Replay overlay（仍為 future）。
- **`graphify update .` 已執行但輸出未 stage**（第三次踩到同一個坑,見 T3/T5）:重建後 `graphify-out/manifest.json` 會把**未追蹤**的 `docs/algorithm/micro-flick/index.html` 與 `README.md`（併行 WP-56 工作,非本切片產出）寫進 manifest。若 stage,committed graph 會宣稱存在兩個 repo 裡不存在的檔。依 T3/T5 先例 `git restore graphify-out/`,代價是 graph 暫時未收錄 T7 的兩支 script;待 WP-56 把 micro-flick 文件 commit 後,任何一次乾淨 worktree 的 `graphify update .` 即會補上。
- **Measurement window**:上述測試數字量測於 2026-09-04 14:58（full suite 14:58:37 起約 20 s）。併行的 WP-56 T0 檔案 `tests/wp56-t0-poc.test.ts` 建立於 15:02:35,在我的 run 之後,且在 run 輸出中 0 命中 ⇒ 217 files / 2078 tests 不含該檔。本切片未 stage 任何 WP-56 或 micro-flick 檔案。

### 2026-09-03 — T-exit M21 evidence audit and handoff complete（conditional pass）

- 重跑全部 automated gate（未沿用 T6 數字，全部本輪實測，HEAD `a1d89e8`、worktree clean）：focused contact/report/replay suite **5 files / 40 tests passed**；contact + legacy tracking/BR baseline **14 files / 81 tests passed**；`npm.cmd run typecheck` exit 0；full `npm.cmd test` **211 files / 2028 tests passed，1 file / 2 tests skipped**，exit 0。
- Skipped file 已具名並判定為 owner-approved：`tests/history/historyRepository.perf.test.ts` 是 `describe.skipIf(!RUN_BENCHMARK)` 的 opt-in 5,000-run benchmark，pre-existing 且與 WP-55 無關。（T6 記錄為 210 files / 2021 tests；本輪 211 / 2028 是後續 commit 累積的既有測試，非 WP-55 變更。）
- Determinism/perf gate 逐測試具名：artifact byte-equivalent（`trackingContactArtifact.test.ts:150`）、report + HTML embedded JSON parity（`trackingContactReport.test.ts:157`）、replay seek/playback/rate-change 查詢序無關（`replayContact.test.ts:147`）、30 s / 3840-tick generation `< 500 ms`（`trackingContactArtifact.test.ts:218`）。Perf headroom 實測上界：整個 artifact test file（8 tests）僅 41 ms。
- Boundary scan：5 個 WP-55 production module 對 `Date.now`／`performance.now`／`Math.random`／`three`／`window` **0 命中**（ADR-4、GD-5 相容）。`document.*` 命中只在 `TRACE_SCRIPT`／`REPORT_SCRIPT` template string 常數內，屬 self-contained HTML 的 payload，逐行檢視確認非 module runtime DOM 依賴。
- Architecture regression：逐檔檢視 import 方向，確認 `contact → artifact → coverage → report` 單向且 `replayContact` 只 type-only 依賴 metrics；**五個 module 都沒有任何 import 自 `src/sim`、`src/state`、`src/render`**，因此 D-55.2（不寫回 sim state）在結構上成立，而非僅靠約定。
- Research/data safety：5 個 WP-55 test file 對 `fs`／`node:fs`／`writeFile`／`mkdtemp`／`historyRoot`／`os.tmpdir` **0 命中** —— 全為 in-memory fixture，無檔案系統副作用，真實 history root 與 participant payload 不可能被觸碰。
- No-health audit（第三次，T-exit 版）：`targetHealth|healthBar|hitPoints|maxHealth|currentHealth|damage|armor|killCount` over `src/` + `server/` production code **0 命中**；`src/state/`、`src/sim/`、`src/data/`、`src/drill/` 的 `health|hp` 命中只有 `HitDetector.test.ts` 的 hit-point out-param 區域變數 `hp`。FR-55-1/5 成立。
- Parity 未鴨子驗收：逐行檢視 `trackingContact.test.ts:206` 與 `trackingContactReport.test.ts:97` 的測試 body，確認兩者都獨立呼叫 `deriveTrackingMetrics(payload, { strictEyeOrigin: true })` 再比對（acquisition 精確相等、TOT/RMS/median/P95 `toBeCloseTo(..., 12)`），不是自我比對的 tautology。
- **審計發現 OI-55-1（本輪開立）**：`deriveTrackingContactSamples`、`buildTrackingContactArtifact`、`buildTrackingContactCoverageReport`、`buildTrackingContactReport`、`renderTrackingContactReportHtml`、`sampleReplayContact`、`buildReplayContactTrace`、`renderReplayContactTraceHtml` **全部只被自己的 test file 匯入**；`src/`／`scripts/`／`server/`／`tests/` 無其他 importer，`package.json` 無對應 script。因此研究者拿到真實 tracking `export.json` 時無法在不寫新程式的情況下產出任何 artifact，M21 的 manual/researcher artifact review 無法執行。這不是 FR 失敗（FR-55-3/4 的凍結判準是對表關係，已由測試證明），而是 operator tooling 缺口，登記為 README §3 conscious technical debt 第 4 項 + §7 handoff 第 4 項，建議修法為比照 `scripts/analyze-tracking-pilot.ts` 的 thin CLI runner（估 0.5d）。
- 因此 M21 以 **conditional pass** 結案，而非全綠：README §6 gate 逐項翻 ✅ 但兩處帶明確限定（replay observability 限定在契約/trace 層；manual/researcher review 明列 OPEN + blocker owner），避免用 escape clause 把缺口藏起來。
- T-exit 為 docs-only：未修改 production code，未新增 health/HP/damage/kill contract，未動 sim state／replay overlay／`TargetManager`／`SharedState`／live render hot path。依 README §5 不執行 `graphify update .`；`graphify-out/GRAPH_REPORT.md` 仍 built from `2cbedbce`（相對 HEAD `a1d89e8` stale，已具名記錄）。`codegraph.cmd status` = 545 files / 8,815 nodes / 29,698 edges。
- `CONTEXT.md`／`DECISIONS.md` 本輪無需變更：T-exit 未產生新的全域決策或跨 WP code contract；OI-55-1 是 WP 內負債 + handoff 條件，依 CLAUDE.md §7 寫在 per-WP 文件。
- WP-54 isolation check：未修改或 stage 任何 `wp-54-tracking-pilot/` 文件、`scripts/analyze-tracking-pilot.ts`、`scripts/trackingStimulusFidelity.ts` 或 `tests/regression/tracking-stimulus-fidelity.test.ts`。
- **Measurement window 誠實聲明**：上述所有 gate 數字都量測於 worktree clean、HEAD `a1d89e8` 的狀態（focused suite 16:39、full suite 16:41）。量測完成後（16:43-16:46）worktree 出現**與 WP-55 無關的併行 KI-024／BD-024 修復**（`src/scene/scenes/field-low.ts` 補 `eyeZ: 0`，以及 `src/scene/eyePose.test.ts`、`tests/regression/br-camera-anchor-invariants.test.ts`、`tests/golden/research/epsilon-offsetdeg-oracle.test.ts`、`src/drill/tracking_core_pr_pilot_v1.test.ts` 的對應 regression）。這些變更**不由 WP-55 T-exit 產生、未被 stage、未被本輪 full suite 覆蓋**；本次 commit 為 docs-only，不影響也不宣稱驗證該修復。KI-024 的驗證屬其 owning WP／KI 流程。

### 2026-09-03 — T6 exit gate and documentation complete

- README §6 M21 Exit Gate 已新增 T6 evidence ledger：每個 gate row 都標成 automated / measurement / inspection / manual evidence，或指出 T-exit/adjacent owner；此 ledger 是 T-exit 的輸入，不宣告 T-exit 已完成。
- `docs/operational/analysis-tracking.md` 已確認並補強 WP-55 contract：跟隨目標以 exact-hitbox aim-ray `onTarget`、TOT、RMS/median/P95 epsilon 判定；artifact schema / coverage / replay trace / report projection 只消費 contact artifact；blocked result 用 closed vocabulary，不以 0 或空圖表偽裝成功；HP/damage/hit/kill 不是 pure tracking 跟隨來源；BR/projectile 只作 companion evidence。
- No-health/no-damage audit 重跑：`rg` over `src`, `tests`, `docs/operational`, and WP-55 docs found no target health/HP/damage/health-bar contract. Matches were WP-55 boundary docs, History API `/api/history/health`, `HitDetector.test.ts` hit-point variable `hp`, and existing fire/hit/kill lifecycle.
- Verification completed: focused contact/report/replay suite 5 files / 40 tests passed; contact + legacy tracking/BR baseline 14 files / 81 tests passed; `npm.cmd run typecheck` exit 0; full `npm.cmd test` 210 files / 2021 tests passed with 1 file / 2 tests skipped. Full suite is recorded as broad regression smoke, not as WP-54 pilot gate evidence.
- T6 was docs/audit/test-gate only: no production code changed, no sim state/replay overlay/TargetManager/SharedState/live render hot path changes, and no health/HP/damage/kill tracking contract added. `graphify update .` skipped because production code did not change; `graphify-out` was not staged.
- WP-54 isolation check: did not modify or stage `docs/exec-plan/active/stage11/wp-54-tracking-pilot/T6-instrumentation-gate.md`, `scripts/analyze-tracking-pilot.ts`, `scripts/trackingStimulusFidelity.ts`, or `tests/regression/tracking-stimulus-fidelity.test.ts`.

### 2026-09-03 — T5 report and quality integration complete

- 新增 `src/metrics/trackingContactReport.ts`，提供 `buildTrackingContactReport()`、`serializeTrackingContactReport()` 與 `renderTrackingContactReportHtml()`；report artifact schema 為 `tracking-contact-report-v1`，輸入只接受 T3 `TrackingContactCoverageReport` 與可選 T4 replay trace，不重新吃 raw payload 定義 contact。
- Report 顯示 acquisition（failure rate 與 per-presentation `tAcquireMs`）、pursuit TOT、RMS/median/P95 epsilon、contact timeline 與 replay trace frame count；每個 metric cell 都帶 `value`、`unit`、`n`、`durationMs`、condition、drill id、`analysisVersion`、source id/source run/export basename。
- Blocked/protocol-incompatible runs 以 `tracking-contact-blocked-reason-v1` closed vocabulary 顯示，沒有 `summary`/`timeline`，不輸出 fake 0 或空 contact chart；aggregate condition count 只列 included run source ids，另保留 excluded source/reason counts。
- BR companion projection 標記為 `companion-only-not-pure-tracking`，將 aim-ray on-target rate 與 ballistic hitscan/projectile hit count 分欄；pure tracking summary 仍只來自 contact coverage，不讀 `fire`/`hit`/damage/kill。
- 補 `src/metrics/trackingContactReport.test.ts`，覆蓋 report artifact、HTML embedded JSON parity、`deriveTrackingMetrics()` summary parity、blocked reason display、aggregate exclusion traceability 與 BR split columns。
- T5 同步修正 T2 artifact provenance：`TrackingContactArtifactHitbox.shape` 可為 `'box' | 'sphere'`；well-formed sphere 會保留在 artifact/report，malformed sphere 仍 blocked `invalid-hitbox`。此修正只在 WP-55 artifact/report 層，不修改 WP-54 drill config、trajectory kernel、pilot metrics、researcher manifest/operator flow。

### 2026-09-03 — T4 replay observability complete

- 新增 `src/replay/replayContact.ts`，提供 pure `sampleReplayContact(samples, replayTimeMs)`；sampling 採 deterministic latest-at-or-before contact row，並保留 `replayTimeMs` 與 contact sample `t` 對表。
- `ReplayContactFrame` 對表 `targetId`、target center、aim yaw/pitch、`onTarget`、`epsilonDeg`、`presentationIndex` 與 `trackingWindow`；before first、empty samples、跨 target/presentation gap 與 blocked artifact 都輸出 reason-coded unavailable，而不是 fake off-target。
- 新增 `buildReplayContactTrace()` / `renderReplayContactTraceHtml()`，交付 OQ-55-1 決議的離線 JSON/HTML replay contact trace；HTML 是 self-contained inline CSS/JS + embedded JSON，contact state 有 `on-target` / `off-target` / `unavailable: <reason>` 文字 label，不只靠顏色。
- `src/replay/replayContact.test.ts` 覆蓋 exact time、between tick、before first、after last、empty/missing sample、presentation boundary、seek/playback/rate-change determinism、blocked artifact 與 HTML embedded JSON trace。
- 本切片未做產品 Replay overlay，未修改 `TargetManager`、`SharedState`、live render hot path、sim state、WP-54 production code、drill config、trajectory kernel、pilot metrics 或 researcher manifest/operator flow。

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
| D-55.8 | M21 以 **conditional pass** 結案：automated gate 全綠，但 manual/researcher artifact review 保持 OPEN，並開立 OI-55-1 記錄「無 operator 入口」 | T-exit 稽核發現五個 module 只被自己的 test 匯入，研究者無法從真實 export 產出 artifact。M21 gate 的 escape clause（「或有明確 blocker owner」）在字面上可讓該項打勾，但那會把一個真實的交付缺口藏進括號裡；把它顯性化成 OI-55-1 + technical debt + handoff item，才能讓承接者看見。同時不誇大成 FR 失敗——FR-55-3/4 的凍結判準是對表關係，已由 12 位小數 parity 測試證明成立 | ✅ Confirmed（T-exit） |
| D-55.9 | T7 runner **只呼一次 `buildTrackingContactCoverageReport()`**,per-run artifact 直接取 `run.contactArtifact`;檔名 provenance 由 runner 自產的 `manifest.json` 承載,而非塞進 artifact | coverage 對整批只吃一份 options,無法逐檔帶 `exportBasename`。若為每檔再呼一次 `buildTrackingContactArtifact()` 並帶 basename,同一個檔可能出現兩種判定(standalone ok 但 coverage 判 `protocol-incompatible`),operator 會看到自相矛盾的結果。改用 manifest 承載檔名對照,既不動 T2 凍結契約,也保證一檔一判定 | ✅ Confirmed（T7） |

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
| 2026-09-03 | `npx.cmd vitest run src/replay/replayContact.test.ts` | T4 focused replay/contact: 1 file / 11 tests passed |
| 2026-09-03 | `npx.cmd vitest run src/replay/replayContact.test.ts tests/replay/sampleReplay.test.ts src/metrics/trackingContact.test.ts src/metrics/trackingContactArtifact.test.ts` | Replay/contact focused suite: 4 files / 43 tests passed |
| 2026-09-03 | `npx.cmd vitest run src/metrics/trackingContactCoverage.test.ts src/metrics/trackingContactArtifact.test.ts src/metrics/trackingContact.test.ts src/metrics/trackingDerivation.test.ts src/metrics/trackingTransitions.test.ts src/drill/tracking_v1.test.ts src/drill/tracking_longrange_v1.test.ts src/drill/tracking_br_v1.test.ts tests/regression/longrange-tracking-determinism.test.ts tests/regression/br-tracking-invariants.test.ts tests/regression/br-camera-anchor-invariants.test.ts tests/regression/projectile-determinism.test.ts tests/regression/moving-target-determinism.test.ts` | T4 + legacy tracking/BR baseline: 13 files / 75 tests passed |
| 2026-09-03 | `npm.cmd run typecheck` | exit 0 |
| 2026-09-03 | `graphify update .` | Executed after production code changes; generated `graphify-out` retained because current worktree had no WP-54 dirty production/test files and manifest additions are WP-55 T4 replay/contact files |
| 2026-09-03 | `npx.cmd vitest run src/metrics/trackingContactReport.test.ts src/metrics/trackingContactArtifact.test.ts src/metrics/trackingContactCoverage.test.ts` | T5 initial focused report/artifact/coverage suite: 3 files / 19 tests passed |
| 2026-09-03 | `npm.cmd run typecheck` | T5 typecheck pre-doc update: exit 0 |
| 2026-09-03 | `npx.cmd vitest run src/metrics/trackingContactReport.test.ts` | T5 focused report tests: 1 file / 5 tests passed |
| 2026-09-03 | `npx.cmd vitest run src/metrics/trackingContactReport.test.ts src/metrics/trackingContactArtifact.test.ts src/metrics/trackingContactCoverage.test.ts src/metrics/trackingContact.test.ts src/replay/replayContact.test.ts` | Contact report/artifact/coverage/replay focused suite: 5 files / 40 tests passed |
| 2026-09-03 | `npx.cmd vitest run src/metrics/trackingContactReport.test.ts src/metrics/trackingContactCoverage.test.ts src/metrics/trackingContactArtifact.test.ts src/metrics/trackingContact.test.ts src/metrics/trackingDerivation.test.ts src/metrics/trackingTransitions.test.ts src/drill/tracking_v1.test.ts src/drill/tracking_longrange_v1.test.ts src/drill/tracking_br_v1.test.ts tests/regression/longrange-tracking-determinism.test.ts tests/regression/br-tracking-invariants.test.ts tests/regression/br-camera-anchor-invariants.test.ts tests/regression/projectile-determinism.test.ts tests/regression/moving-target-determinism.test.ts` | T5 + legacy tracking/BR baseline: 14 files / 81 tests passed |
| 2026-09-03 | `npm.cmd run typecheck` | T5 final typecheck: exit 0 |
| 2026-09-03 | `graphify update .` | Executed after production code changes, but generated `graphify-out` was restored/not staged because manifest/graph output included unrelated WP-54 active document state (`wp-54-tracking-pilot/progress.md`, `T6-instrumentation-gate.md`) |
| 2026-09-03 | T6 no-health/no-damage audit with `rg` over `src`, `tests`, `docs/operational`, and WP-55 docs | no target health/HP/damage/health-bar tracking contract found; matches were WP-55 boundary docs, History API `/api/history/health`, `HitDetector.test.ts` hit-point variable `hp`, and existing fire/hit/kill lifecycle |
| 2026-09-03 | `npx.cmd vitest run src/metrics/trackingContactReport.test.ts src/metrics/trackingContactArtifact.test.ts src/metrics/trackingContactCoverage.test.ts src/metrics/trackingContact.test.ts src/replay/replayContact.test.ts` | T6 focused contact/report/replay suite: 5 files / 40 tests passed |
| 2026-09-03 | `npx.cmd vitest run src/metrics/trackingContactReport.test.ts src/metrics/trackingContactCoverage.test.ts src/metrics/trackingContactArtifact.test.ts src/metrics/trackingContact.test.ts src/metrics/trackingDerivation.test.ts src/metrics/trackingTransitions.test.ts src/drill/tracking_v1.test.ts src/drill/tracking_longrange_v1.test.ts src/drill/tracking_br_v1.test.ts tests/regression/longrange-tracking-determinism.test.ts tests/regression/br-tracking-invariants.test.ts tests/regression/br-camera-anchor-invariants.test.ts tests/regression/projectile-determinism.test.ts tests/regression/moving-target-determinism.test.ts` | T6 contact + legacy tracking/BR baseline: 14 files / 81 tests passed |
| 2026-09-03 | `npm.cmd run typecheck` | T6 typecheck: exit 0 |
| 2026-09-03 | `npm.cmd test` | T6 broad regression smoke: 210 files / 2021 tests passed; 1 file / 2 tests skipped. Not used as WP-54 pilot gate evidence |
| 2026-09-03 | `graphify update .` | skipped for T6 because no production code changed; `graphify-out` not staged |
| 2026-09-03 | T-exit: `npx.cmd vitest run src/metrics/trackingContactReport.test.ts src/metrics/trackingContactCoverage.test.ts src/metrics/trackingContactArtifact.test.ts src/metrics/trackingContact.test.ts src/replay/replayContact.test.ts` | 5 files / 40 tests passed |
| 2026-09-03 | T-exit: `npm.cmd run typecheck` | exit 0 |
| 2026-09-03 | T-exit: contact + legacy tracking/BR baseline (14 files) | 14 files / 81 tests passed |
| 2026-09-03 | T-exit: full `npm.cmd test` | exit 0; 211 files / 2028 tests passed, 1 file / 2 tests skipped (`historyRepository.perf.test.ts`, opt-in `RUN_BENCHMARK` benchmark, pre-existing) |
| 2026-09-03 | T-exit boundary scan: `Date.now`/`performance.now`/`Math.random`/`three`/`window`/`document` over the 5 WP-55 production modules | 0 hits except `document.*` inside `TRACE_SCRIPT`/`REPORT_SCRIPT` template-string HTML payloads (inspected line by line) |
| 2026-09-03 | T-exit import-direction audit over the 5 WP-55 modules | no import from `src/sim`, `src/state`, `src/render`; single direction contact -> artifact -> coverage -> report |
| 2026-09-03 | T-exit importer audit: `grep` for `trackingContact`/`replayContact` importers across `src/`, `scripts/`, `server/`, `tests/` | no importer outside the modules' own test files; no `package.json` script -> OI-55-1 opened |
| 2026-09-03 | T-exit data-safety scan: `fs`/`node:fs`/`writeFile`/`mkdtemp`/`historyRoot`/`os.tmpdir` over the 5 WP-55 test files | 0 hits; all in-memory fixtures |
| 2026-09-03 | T-exit no-health audit `rg` over `src/` + `server/` production code | 0 hits for target health/HP/damage/armor/killCount contract; only `HitDetector.test.ts` local `hp` hit-point out-param |
| 2026-09-03 | T-exit parity body inspection: `trackingContact.test.ts:206`, `trackingContactReport.test.ts:97` | both independently call `deriveTrackingMetrics(payload, { strictEyeOrigin: true })` and compare (exact on acquisition, `toBeCloseTo(..., 12)` on TOT/RMS/median/P95); not a tautology |
| 2026-09-03 | T-exit: `codegraph.cmd status` / `graphify-out/GRAPH_REPORT.md` header | 545 files / 8,815 nodes / 29,698 edges; graphify report still built from `2cbedbce`, stale vs HEAD `a1d89e8`, recorded (docs-only task, no `graphify update .`) |
| 2026-09-03 | T-exit: `git status --short` / `git rev-parse HEAD` | clean worktree at entry; HEAD `a1d89e86836e393f2607d4992ab1aec2ebd5f569` |
| 2026-09-04 | T7: `npx.cmd vitest run tests/regression/tracking-contact-runner.test.ts` | 1 file / 7 tests passed |
| 2026-09-04 | T7: WP-55 focused suite + runner (6 files) | 6 files / 47 tests passed |
| 2026-09-04 | T7: `npm.cmd run typecheck` | exit 0 |
| 2026-09-04 | T7: full `npm.cmd test` | exit 0; 217 files / 2078 tests passed, 1 file / 2 tests skipped (`historyRepository.perf.test.ts` opt-in benchmark) |
| 2026-09-04 | T7 end-to-end: `npm.cmd run analyze:contact -- <3 synthetic exports> --out <scratch>` | runs 2 (included 1, excluded 1), missing-visible-event=1, rejected 1 named; wrote 6 files; exit 1 due to the rejected file (by design) |
| 2026-09-04 | T7 analytic cross-check of runner output | `tAcquireMs=250` == 32 ticks x (1000/128); `rmsEpsilonDeg=0.249591` == analytic 0.35/sqrt(2)=0.247 for the injected sine aim error |
| 2026-09-04 | T7: `git check-ignore -v .contact-analysis/manifest.json` + `git status --short` after a default-dir run | ignored by `.gitignore:38`; no artifact appears in git status |
| 2026-09-04 | T7: `graphify update .` then `git diff graphify-out/` | rebuilt 4276 nodes / 10246 edges / 272 communities and picked up the T7 scripts (45 hits), but also added untracked `docs/algorithm/micro-flick/{index.html,README.md}` to the manifest -> restored per T3/T5 precedent, not staged |

## Surprises & Discoveries

- **2026-09-03（T-exit，OI-55-1）**：T-exit 稽核最有價值的發現不在測試，而在 importer graph。T1-T5 每個切片都交付了測試齊全的純函式，`npm test` 全綠、parity 到 12 位小數，但把「誰匯入這些 module」問一次，答案是「只有它們自己的 test」。這是一種容易在逐切片交付中隱形的缺口：每個 task 的 DoD 都以「函式行為正確」定義，沒有任何一個 task 的 DoD 是「研究者能產出一份 artifact」。教訓：交付分析層工具時，DoD 至少要有一項是 end-to-end 可執行入口，否則 WP 可以全綠卻零可用性。

- **2026-09-03（KI-021）**：T3 為了讓 WP-54 candidate drills 進 coverage，曾請 WP-54 側維持 cube hitbox。追查該 box-only 限制的來源後發現，真正的問題不在 WP-55 的閘門，而在 `src/metrics/trackingDerivation.ts`：`isOnTarget()` 是無條件的 ray/AABB slab test，`hitboxFromMeta()` 又把 `shape` 丟掉——`spider-shot-v2`（正式 Assessment drill）的球體目標因此一直被當成外接立方體判定。也就是說 WP-55 的閘門其實是在**正確地**拒絕一個會算錯的推導。修復記於 KI-021／BD-021，WP-55 側的放寬記為 D-55.7。
- WP-55 source proposal is still a single candidate plan file under stage11, while WP-51 and WP-54 use self-contained WP folders. This planning pass keeps the source proposal intact and adds the folderized artifacts beside it.
- Existing `git status` already contains unrelated modified stage10/operational/graphify files plus WP-54/WP-55 proposal files. This pass intentionally adds only `docs/exec-plan/active/stage11/wp-55-tracking-on-target-observability-no-health/` files and does not touch those pre-existing changes.
- T0 run found the current worktree already has unrelated `src/main.ts` and `tests/e2e/tracking-pilot-live.spec.ts`; WP-55 T0 docs intentionally avoid touching those files.
- The named incremental implementation reference says this repo is Python/Poetry ES_analysis, but the actual workspace is TypeScript/Vitest FPS_aim_analyst. Verification therefore follows `package.json` scripts and stage11 task docs, not the stale Poetry commands in that reference.
- T1 edge miss fixture initially used `x=0.500001` at target depth and still hit because the AABB has depth; the final outside oracle uses `x=0.58`, which clears the front slab for the default H1 box.
- T2 environment recording via `Get-CimInstance` was denied by local Windows permissions; fallback environment snapshot uses Node/OS/.NET environment APIs and `$env:PROCESSOR_IDENTIFIER`, which is sufficient for the lightweight artifact perf gate.
- T3 graphify cleanup observed unrelated local changes outside WP-55; graphify output was therefore regenerated for freshness evidence but restored before commit to avoid mixing unrelated indexed state into WP-55.
