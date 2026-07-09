# WP-22 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: 🟡 T3 AUTO PASS(2026-07-09):determinism + checklist C + pilot docs + `test:ci` green;manual true-fullscreen walkthrough pending

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ PASS(2026-07-09;WP-18 T-exit 交付 + OQ-S3-5 對帳解除;`test:ci` green) |
| T1 追蹤 × 場景 | ✅ PASS(2026-07-09;`tracking_scene_v1` + Playwright E2E + urban-high harness probe) |
| T2 protocol 執行器 + E2E | 🟡 AUTO PASS(2026-07-09;manual true-fullscreen walkthrough pending) |
| T3 決定性 + 驗收清單 C | 🟡 AUTO PASS(2026-07-09;manual true-fullscreen walkthrough pending) |
| T-exit(M10) | ⬜ |

---

## Open Questions ledger(T0 解決)

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S3-5 WP-18 交付形狀對帳(presentation policy / 追蹤 drill config 型 / 目標內插) | ✅ resolved (2026-07-09) | [WP-18 T-exit](../../stage2/wp-18-f5-subtick/T-exit-gate.md)✅ 交付。六項交付形狀逐項對帳、與本 WP T1 假設一致無漂移(對帳表見下方 Log 2026-07-09):motion drive(T1)/ sub-tick 命中內插 FR-B17(T2)/ timed presentation 命中不撤除(T3)/ target render alpha 內插(T3)/ `tracking_v1` config(T4)/ `t_acquire`·TOT%·RMS ε 離線推導 + `SpawnMeta.presentationMs` 匯出欄(T4+T5)。**T1 blocked 解除。** |
| OQ-22.1 protocol 條件標記落點(meta 何欄標記「本 drill 屬哪個條件/序位」) | ✅ resolved | `meta.protocol = { protocolId, conditionIndex, conditionLabel }`。`conditionIndex` 為 0-based config array index,`conditionLabel` 為檔名/人工檢查用 human label;v2 additive optional 區塊,比照 `scene`/`display`/`spawn`。 |
| OQ-22.2 pilot protocol 文件範圍(是否含受試者 ID/同意書行政欄 → 與 WP-20 T4 表單對帳) | ✅ resolved | App 只收 WP-20 T4 已落地的 `participantId`(必填)/`sessionLabel`(選填)並寫 `meta.session`;同意書、納排條件簽核、moderator 備註等行政欄不進 app,寫入 T3 `pilot-protocol-stage3.md` 文件層。 |

---

## Log

### 2026-07-09 16:59 local — T3 AUTO PASS(determinism regression + checklist C + pilot protocol;manual pending)

**Scope delivered**:
- Added `src/loop/__tests__/wp22-determinism.test.ts` covering all three FR-C15 invariants:cross-scene bit-exact sim state, cross-resolution bit-exact sim state after buffer mode application, and seeded `detection_popin_v1` spawn golden replay. The legacy L/R slot path is also checked against `sequence.seed` drift.
- Added [acceptance-checklist-c.md](../../../../operational/acceptance-checklist-c.md):10 M10 checklist rows with automatic evidence entry points and the remaining true-fullscreen manual walk-through.
- Added [pilot-protocol-stage3.md](../../../../operational/pilot-protocol-stage3.md):tracking × scene and resolution × detection pilot procedure, export naming/collection convention, and error-boundary notes for GD-7/GD-8/GD-10.
- Updated T3 task status to AUTO PASS. M10/T-exit remains pending until the manual true-fullscreen protocol walk-through is recorded.

**Verification**:
- `npm.cmd test -- src/loop/__tests__/wp22-determinism.test.ts` -> PASS(1 file / 4 tests).
- `npm.cmd test -- src/loop/__tests__/wp22-determinism.test.ts src/loop/__tests__/determinism.test.ts tests/regression/determinism.test.ts src/display/resolutionMode.test.ts tests/regression/moving-target-determinism.test.ts` -> PASS(5 files / 38 tests).
- `npm.cmd run typecheck` -> PASS(`tsc --noEmit`).
- `npm.cmd run test:ci` sandbox run failed because Vite/esbuild could not read upper config paths; elevated rerun -> PASS(`tsc --noEmit`;Vitest 65 files / 505 tests;Playwright 14 tests).
- `graphify update .` -> PASS(AST extraction 144/144;graph rebuilt 1052 nodes / 2435 edges / 65 communities).

**Decision Log**:
- Decision:T3 determinism tests live under `src/loop/__tests__/wp22-determinism.test.ts` as an additive WP-22 regression gate, while the existing `tests/regression/determinism.test.ts` baseline remains untouched.
  Alternatives Considered:expanding the older regression fixture directly;rejected because T3 needs a named acceptance-facing gate and should not churn the stage1/2 baseline file.
- Decision:清單 C treats true-fullscreen protocol operation as an explicit manual supplement while keeping the automatic protocol E2E as the CI gate.
  Alternatives Considered:marking fullscreen as auto-covered by Playwright;rejected because headless/browser automation does not prove the local interactive fullscreen/download path.

**Surprises & Discoveries**:
- Seeded spawn golden matched the independent reconstruction except for two floating-point last-bit display values;the committed golden uses the production TS pipeline output. Evidence:first run of `wp22-determinism.test.ts` failed only on `targetX` ULP differences for targets `t1`/`t2`,then passed after aligning to actual output.

**Open Questions / Manual Follow-up**:
- Same manual item remains:run the local app in true fullscreen, execute `resolution_detection_v1` end-to-end, and record the two exported JSON checks in this progress log before T-exit/M10.

### 2026-07-09 16:43 local — T2 AUTO PASS(protocol runner + resolution x detection E2E;manual pending)

**Scope delivered**:
- Added `ProtocolConfig` / `validateProtocol` / `ProtocolRunner` in `src/display/ProtocolRunner.ts`.
- Added shared `resolution_detection_v1` config:2 conditions ordered by config data, `fhd-1080-field-low-detection` then `qhd-1440-field-low-detection`.
- Added additive `meta.protocol = { protocolId, conditionIndex, conditionLabel }` and validation in `collectMeta`.
- Wired main UI:「解析度 protocol」button -> setup form -> eligibility gate -> condition sequence;each condition applies + locks resolution mode, loads declared scene/drill, exports condition-tagged JSON, then shows a next-condition transition.
- Wired dev harness + Playwright:2-condition protocol run exports two detection payloads;low-resolution gate path rejects without exports.

**Verification**:
- `npm.cmd test -- src/display/ProtocolRunner.test.ts src/data/metadata.test.ts src/testharness/fpsTestHarness.test.ts` -> PASS(3 files / 34 tests).
- `npm.cmd run typecheck` -> PASS(`tsc --noEmit`).
- `npx.cmd playwright test tests/e2e/full-drill.spec.ts -g "WP-22"` -> PASS(3 tests;required elevation because sandbox blocked Vite/esbuild config read).
- `npm.cmd test` -> PASS(64 files / 501 tests).
- `npx.cmd playwright test` -> PASS(14 tests;required elevation for webServer).
- `npm.cmd run test:ci` -> PASS(`tsc --noEmit`;Vitest 64 files / 501 tests;Playwright 14 tests).
- `graphify update .` -> PASS(AST extraction 143/143;graph rebuilt 1038 nodes / 2370 edges / 61 communities).

**Decision Log**:
- Decision:protocol config lives as `resolution_detection_v1` in `src/display/resolutionDetectionProtocol.ts`, separate from drill config.
  Alternatives Considered:embedding protocol fields in `detection_popin_v1`;rejected because condition order/mode/scene are experiment orchestration, not drill mechanics.
- Decision:main protocol progression exports automatically at drill `ended`, but requires an explicit next-condition button.
  Alternatives Considered:auto-advancing immediately after export;rejected because it hides the condition boundary and makes operator inspection/download failures harder to notice.
- Decision:condition-level fullscreen failure maps through `ProtocolRunner.markCurrentConditionSuspect('fullscreen-exit')`;non-protocol exports keep the existing `experimentSession.suspect` path.
  Alternatives Considered:using session-level suspect for all protocol exports;rejected because a condition-1 fullscreen exit would incorrectly contaminate condition 2.
- Decision:dev harness protocol uses a passed gate fixture for the mainline, and a separate `previewResolutionProtocolGate` path for low-resolution rejection.
  Alternatives Considered:driving real fullscreen in headless E2E;not reliable across CI/headless browser modes and not equivalent to the required manual walk.

**Surprises & Discoveries**:
- Harness synthetic frames initially used actual browser `displayHz`;on 60Hz runners this exceeded the 120Hz perf floor and correctly marked protocol exports `suspect=true`. Evidence:first WP-22 protocol E2E failed at `meta.suspect`;fix clamps harness protocol frame summary to `PERF_FLOOR_MS` because the harness mainline uses a pass gate fixture.
- `SettingsPanel.lockMode()` was already present as a WP-22 T2 seam;only `setResolutionMode()` was needed so protocol-applied modes do not visually drift from the dropdown.

**Open Questions / Manual Follow-up**:
- Manual true-fullscreen walkthrough remains pending:run local app, click「解析度 protocol」, fill setup, pass gate in real fullscreen, complete both detection conditions, and confirm two downloaded JSON files. This was not executed by the agent because it requires interactive local fullscreen/manual operation.

### 2026-07-09 16:14 local — T1 PASS(tracking drill × field-low scene + E2E)

**Scope delivered**:
- Added `src/drill/tracking_scene_v1.ts` as a scene-drill composition:drill id `tracking_scene_v1`, required `sceneId: field-low`, WP-18 timed tracking drill semantics preserved(seed `18018`, `presentationMs=2000`, speed `2u/s`) with scene-safe horizontal `range=0.25u`.
- App registry now exposes `tracking_scene_v1`; selecting it auto-loads its required `field-low` scene before `loadDrill(source, scene)` runs clearance.
- Test harness now accepts per-drill `SceneConfig`, exports `meta.scene`, keeps `meta.spawn.presentationMs`, and exposes tracking derivation from export payload.
- Playwright E2E covers `tracking_scene_v1`:COI, `meta.scene=field-low`, `meta.spawn.motion/presentationMs`, finite `px/pz/tx/ty/tz/aim` columns, moving `tx`, 10 visible events, `suspect=false`, presentation spacing, and tracking metrics sanity.

**Verification**:
- `npm.cmd test -- src/drill/tracking_scene_v1.test.ts src/drill/tracking_v1.test.ts src/scene/scenes/field-low.test.ts src/scene/scenes/urban-high.test.ts` → PASS(4 files / 14 tests).
- `npm.cmd test -- src/testharness/fpsTestHarness.test.ts src/drill/tracking_scene_v1.test.ts` → PASS(2 files / 9 tests).
- `npm.cmd run typecheck` → PASS(`tsc --noEmit`).
- `npx.cmd playwright test tests/e2e/full-drill.spec.ts -g "WP-22"` → PASS(1 test;required elevation because sandbox blocked Vite/esbuild config read).
- `npm.cmd test` → PASS(63 files / 492 tests).
- `npx.cmd playwright test` → PASS(12 tests;required elevation for webServer).

**Result sanity**:
- Perfect/auto tracking fixture from exported payload:`acquisitionFailureRate=0`,all presentations `TOT% >= 99`, `tAcquireMs <= 16ms`, `RMS ε < 1deg`.
- Stationary aim fixture from exported payload:`acquisitionFailureRate=1`,all presentations acquisition failure.
- `urban-high` probe via harness scene config completes all 10 timed presentations with `meta.scene=urban-high`, `suspect=false`, `recorderOverflow=false`, and tracking acquisition success.

**Decision Log**:
- Decision:T1 scene-drill is a composition object `{ id, sceneId, drill }`, not a new `DrillConfig.sceneId` field.
  Alternatives Considered:adding `sceneId` to `DrillConfig` would be silently discarded by current schema and would mix experiment composition with drill mechanics; relying on current active scene would make `tracking_scene_v1` non-reproducible after UI scene changes.
- Decision:`tracking_scene_v1` uses motion `range=0.25u`.
  Alternatives Considered:keeping WP-18 `tracking_v1` range `1u` failed clearance against `field-low` rock/tree and `urban-high` barriers; `range=0.5u` passed `urban-high` but still failed `field-low` rock bounds under the existing hitbox-radius + 0.5u clearance inflation. `0.25u` is the smallest scoped config change that preserves moving-target behavior and passes both scenes.

**Surprises & Discoveries**:
- T0 OQ-S3-5 assumed the WP-18 range envelope `[0.5,1.5]u` was field-low-compatible; real WP-19 clearance inflation shows `field-low` permits less than `0.5u` for this L/R slot geometry. Evidence:first test run failed on `rock-r1/tree-r1/rock-l1/tree-l1`; second run at `0.5u` still failed on `rock-r1/rock-l1`; `0.25u` passed.
- Browser/harness auto-aim originally used camera world z=4, while `deriveTrackingMetrics` consumes exported `px/pz` origin geometry. Tracking-specific harness aim now targets from player origin only for tracking sanity; counter-strafe fire aim remains camera-based.

**Open Questions**:
- None for T1. T2 protocol can consume `tracking_scene_v1` as a stable field-low condition and can use the same `{ mode, sceneId, drillId }` composition pattern.

### 2026-07-09 — T0 entry gate PASS(WP-18 交付 → OQ-S3-5 對帳解除;由 WP-18 T-exit 互記)

**觸發**:[WP-18 f5-subtick T-exit](../../stage2/wp-18-f5-subtick/T-exit-gate.md)✅ 交付(2026-07-09;T0–T5 全綠、`test:ci` exit 0 = 62 files / 487 vitest + 11 playwright)。原 T0 唯一 blocker(WP-18 尚為 stub、無交付形狀)已消除 → 重跑 OQ-S3-5 對帳、宣告 T0 PASS。

**四上游 exit 全 verified**:WP-19/M9 ✅ + WP-20 ✅ + WP-21 ✅(見下方原 BLOCKED log 表)+ **WP-18 ✅(本次)**。

**OQ-S3-5 形狀對帳表(假設 vs 實際)——六項逐項對齊、無漂移,T1 假設無需修正**:

| WP-22 T1 消費假設 | WP-18 實際交付 | 對帳 |
|---|---|---|
| 移動 target `pos` 每 tick 驅動 | `motionOffset(motion, age)` 純函式(linear/pingpong/sine);`age` 累加 `TICK_SEC` 常數 | ✅ 一致;tick 決定性(異 FPS 逐位一致) |
| sub-tick 命中內插(FR-B17) | `TargetState.posPrev` + fire 時間戳 `subAlpha` → `lerp(posPrev,pos,α)`;靜止零破壞 | ✅ 一致;命中位置對齊 fire 時刻 |
| timed presentation 推進政策 | `timing.presentationMs`(additive optional);`TargetState.persistent` 命中不撤除 | ✅ 一致;追蹤窗右界 = presentation 到期/下一 visible.t |
| target render alpha 內插 | `TargetView.sync(targets, alpha)` render-only,比照 player prev→curr | ✅ 一致;不寫 state、不進匯出 |
| 追蹤 drill config 型 | `src/drill/tracking_v1.ts`(pingpong horizontal range1/speed2 + presentationMs 2000 + seed 18018) | ✅ 一致;純追蹤(不複合 counter-strafe,GD-7) |
| `t_acquire`/TOT%/RMS ε 欄位語意 | `deriveTrackingMetrics` 離線推導 + `analysis-tracking.md` spec;`SpawnMeta.presentationMs` 匯出欄 | ✅ 一致;引擎零計算(GD-7 raw-over-derived);結果頁欄位語意在 spec 定 |

**清單 C 影響**:「追蹤 x 場景 E2E」條目(草稿)可消費 `tracking_v1` + 逐 tick `tx/ty/tz`+`px/pz` 欄——WP-18 已交付來源,T1 實作時掛 `sceneId: 'field-low'` 即成 `tracking_scene_v1`。

**互記**:WP-18 progress T-exit log 已記反向對帳(WP-18 側 OQ-S3-5 標 resolved)。

**Next**:WP-22 **T1 追蹤 × 場景**(blocked 解除,可開跑)——消費 WP-18 追蹤 drill 型 + sub-tick 內插 + presentation + 指標推導 spec,掛 field-low/urban-high 場景 + 速度/雜亂度實驗矩陣。

### 2026-07-09 10:52 local — T0 entry gate BLOCKED(WP-18 未交付;三上游 exit verified)

**Gate conclusion**:不得宣告 T0 PASS。WP-19/M9、WP-20、WP-21 三條工程上游已可追溯並且本次 `test:ci` baseline 綠;但 WP-18 目前仍只有 stage2 stub,狀態為 entry 全達成但未展開,沒有 tracking drill config、timed presentation policy、target render interpolation、`t_acquire`/TOT 結果頁欄位或 T-exit 證據可供 OQ-S3-5 對帳。因此 WP-22 T1 必須等待 WP-18 exit 後重跑 T0;T2 的 WP-20/21 技術上游已就緒,但仍不得把整體 T0 標 PASS。

| 上游 | Gate result | Evidence |
|---|---|---|
| WP-19 scene-system / M9 | ✅ verified | [wp-19 T-exit](../wp-19-scene-system/T-exit-gate.md) 宣告 M9 2026-07-08;四證據:場景置換、淨空拒載、跨場景決定性、ATTRIBUTIONS 稽核;`test:ci` 當時 typecheck + Vitest 48 files / 356 tests + Playwright 10 tests。 |
| WP-20 display-pipeline | ✅ verified | [wp-20 T-exit](../wp-20-display-pipeline/T-exit-gate.md) 宣告四件套交付;解析度模式、資格閘、frame log、session setup 皆有測試證據;`test:ci` 當時 typecheck + Vitest 55 files / 412 tests + Playwright 10 tests。 |
| WP-21 detection-drill | ✅ verified | [wp-21 T-exit](../wp-21-detection-drill/T-exit-gate.md) 宣告 2026-07-09;零破壞、seed 重現、t_detect round-trip 三證據;`test:ci` 當時 typecheck + Vitest 58 files / 438 tests + Playwright 11 tests。 |
| WP-18 f5-subtick / tracking drill | 🟡 blocked | [WP-18 README stub](../../stage2/wp-18-f5-subtick/README.md) 明示「entry 全達成、未展開、待排程」;`rg --files docs\exec-plan | rg "wp-18\|f5\|subtick"` 只找到 README,無 progress/task/T-exit。 |

**Baseline verification(本切片)**:
- `npm.cmd run test:ci` sandbox 內先被既有 Vite/esbuild 上層目錄讀取權限擋住。
- 提升權限重跑同一條 `npm.cmd run test:ci` → exit 0:`tsc --noEmit` pass;Vitest **58 files / 438 tests pass**;Playwright **11 tests pass**。

**OQ decisions that can close now**:
- OQ-22.1:`meta.protocol = { protocolId, conditionIndex, conditionLabel }`;`conditionIndex` = 0-based config index,`conditionLabel` = human/file label。Alternatives Considered:把條件標記塞進 `display` 或 drill id;但 protocol 是跨 display/scene/drill 的實驗層概念,獨立 optional `meta.protocol` 比較不污染既有區塊。
- OQ-22.2:行政欄不進 app;app 只消費 WP-20 T4 `meta.session`。Alternatives Considered:把 consent/moderator 欄加到 setup 表單,但那會把研究行政流程和執行器狀態耦合,也擴大 T2;T3 pilot protocol 文件可明確規範離線簽核。

**Acceptance checklist C draft(T3 定稿骨架)**:

| 條目 | 判定方式草稿 |
|---|---|
| 場景置換 x2 | `field-low` / `urban-high` load + scene metadata;沿用 WP-19 scene tests / smoke。 |
| 淨空拒載 | `DrillLoader` clearance violation fixture 指名 prop id。 |
| 資格閘拒入/放行 | `eligibilityGate` 單元矩陣 + protocol E2E 低解析度拒入。 |
| 三解析度模式 buffer | `resolutionMode.test.ts` + protocol E2E 斷 `meta.display.mode/bufferW/bufferH`。 |
| 受試者內 protocol 全流程 | WP-22 T2 Playwright:gate -> setup -> two conditions -> two exports。 |
| 偵測 round-trip 推導 | `src/metrics/detectionDerivation.test.ts` known onset <= 1 tick。 |
| 追蹤 x 場景 E2E | WP-22 T1 Playwright:tracking_scene_v1 export 含 target/player tick columns,`suspect=false`。 |
| 決定性三不變性 | WP-22 T3 regression:跨場景、跨解析度、同 seed spawn golden。 |
| `test:ci` | `npm.cmd run test:ci` exit 0。 |
| 授權稽核 | `ATTRIBUTIONS.md` 與 `public/assets/scenes/` 一一對應,無 NC/遊戲抽取/付費原始資產。 |

**Surprises & Discoveries**:
- WP-22 README 的相依列原寫 WP-18 ✅,但實際 WP-18 文件只代表 entry gate ready,不是 exit/交付。T0 已把 WP-22 狀態改為 blocked,避免 T1 誤展開。
- `graphify-out/GRAPH_REPORT.md` built commit 仍停在 `fe8aae20`,早於目前 `aa5cb0f`;本切片未改程式碼,但後續 code task 應先 `graphify update .` 後再依 graph 導航。

**Open Questions / Blocker**:
- 等 WP-18 展開並 exit 後,重跑 OQ-S3-5 對帳表:追蹤 drill config 型、motion 欄用法、presentation duration/速度階層、target render alpha interpolation、`t_acquire`/TOT/RMS ε 結果頁/匯出欄位。未完成前 WP-22 T1 不開跑。

### 2026-07-07 — FPSci R3/R4/R6 對齊(grill,GD-12)
- OQ-22.2 部分解:受試者 ID 提前至 WP-20 T4(`participantId` 必填/`sessionLabel` 選填,
  meta `session` 區塊)——本 WP T2 protocol 執行器與 E2E 應消費/斷言該欄;
  同意書行政欄仍歸 pilot protocol 文件層(T0 對帳)。
- **R4**:T3 的 `pilot-protocol-stage3.md` 納 FPSci 論文反應時間分布(150–250ms)作
  效度 baseline 引用(GD-11 紅線:引論文數據,不碰程式碼)。
- **R6 觸發點**:pilot protocol 題組定案時再議問卷模組(屆時複用 WP-20 T4 DOM 表單模式);
  過渡期可外部問卷 + `participantId` 離線串接。

### 2026-07-06 — Plan authored
- 由 stage3 計畫([../README.md](../README.md) §3/§6)展開為自足 task 檔(T0–T3 + T-exit)。
- 決議依據:GD-7(追蹤 × 場景的消費面)、GD-10(受試者內 protocol 三道防線的整合點)。
- 設計要點:protocol 執行器為 **config 資料驅動**(對抗平衡順序 = 研究者排定的資料,
  非引擎邏輯);條件失效採**條件級 suspect**(非整 session 丟棄)。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— 四上游 exit 驗證,docs-only。
  ⚠️ entry 條件:M9(WP-19)+ WP-20/21 exit + **WP-18 exit(stage2 M8 後)**。
