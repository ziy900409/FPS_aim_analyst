# WP-61 — progress.md

> Running log。Tech spec：[README.md](README.md) · Checklist：[task-checklist.md](task-checklist.md)

## 最新狀態

**⛔ T2 判定 `blocked-by-data`（2026-09-09）—— 唯一缺的是資料，不是程式。**

T2 的儀器**全部落地並跑過**（逐份可用性覆核、標註完整性稽核、F3 檢定、Stage 1 golden 與逐位重現斷言、Python 候選事件表、兩支 operator 入口）。缺的是 step 1：`?rawMouse=1&annotation=1` 的 240 Hz 真人 run **一份都還沒有**（錄製屬使用者操作）。

⇒ **不得開 T3**（序列閘 ②）。cohort 錄好之後直接跑：

```bash
npm run analyze:lift-cohort -- <匯出資料夾> --manifest <manifest.json>   # 判定：sufficient / blocked-by-data / annotation-channel-unusable
npm run record:lift-golden  -- <匯出資料夾> --manifest <manifest.json>   # Stage 1 golden
uv run python src/lift/notebooks/t2/build_candidate_table.py             # 候選事件表（research/）
```

manifest 需要 `instructionClass` 與 `sessionId`（`spider-wide-recording-spec.md` §3.3）；缺任一即該 run 作廢。

**✅ T1 標註通道儀器已完成（2026-09-09）。**

**2026-09-09：四個使用者決策已收斂**（D-61.U1～U4）⇒ **T1 的兩個阻塞項（OQ-61.1／61.2）已解除，T2 的硬體阻塞（OQ-61.5）已解除**。

開工前置：
- ① WP-60 T-exit 的四項 handoff —— ①②③ ✅；**④ OQ-60.4 構念歸屬 ✅ 已由 D-61.U1 補上**（WP-60 T-exit 的最後一個未勾項可據此翻 ✅）。
- ② 高刷真人標註 cohort —— **仍不存在**。硬體已就緒（240 Hz），且 T1 的錄製儀器已落地；錄製本身屬使用者。
- ③ T0 已凍結評估契約；剩餘阻塞移到 **T2 的 cohort 錄製與資料品質 gate**。

## Progress

- **2026-09-09**：依 `engineering-planning` skill 完成 repository-grounded 規劃。盤點 `KEY_CODE` 封閉集、`applyInput` 的 key 分支、`TickRecord.keys` 四 bit 遮罩、`mouseSampleGaps.ts` 的中性原語、`deriveRepositioningSuspicion()` 的既有構念語意、`research/` 的 C-D1／C-D2 邊界與 WP-60 的 R1／R2／TF1／TF2 實機基線；**尚未修改任何 production code**。
- **2026-09-09**：把工作拆為 T0～T4 + T-exit（T4 條件式）。相對 2026-09-09 的範圍草案（本 WP `README.md` 的前一版，四切片 T0／T1／T2／T-exit；`git log -- README.md` 可回溯）新增一個 **T1「標註通道儀器」** —— 草案把「保存獨立的抬起／落下標註」寫成 T0 的資料要求，但 repo 內**沒有任何機制**能產生那種標註（`KEY_CODE` 是四鍵封閉集、`DrillEvent` 無標註型別）。見 D-61.P2。
- **2026-09-09**：T0 entry gate 完成。Baseline：HEAD `10ee3561ec81fd78b0fe59d125363ba1fc853c35`；`git status --short` 未列出變更，但 sandbox 讀 global ignore 與 `.pytest_cache/` 有 permission warning；`npm.cmd run typecheck` exit 0；`npm.cmd test` exit 0（249 files passed / 1 skipped；2764 passed / 2 skipped）；`npm.cmd run build` sandbox 內因 esbuild 無權讀 `../../../..` exit 1，非 sandbox 重跑 exit 0（Vite 195 modules，chunk-size warning）；preview COI focused read：`{"status":200,"coop":"same-origin","coep":"require-corp","crossOriginIsolated":true}`。5173 已被既有 server 占用，未停止他人 server，故未跑 dev-server COI 讀數。
- **2026-09-09**：T1 標註通道儀器完成。`KEY_CODE/CODE_KEY` additive 加入 `KeyL`；`DataRecorder` 新增 `recordAnnotationEvents?: boolean`（預設 false）與 additive `annotation` event；`applyInput` 對 `KeyL` 只在 opt-in recorder 上寫 event，不寫 sim state；app 以 `?annotation=1` 開啟，預設關閉；schema parser/CSV/JSON round-trip、InputRing/InputSampler、focused E2E 與決定性 regression 全補測。

## T0 entry gate（2026-09-09）

### Baseline

| Gate | Command | Result |
|---|---|---|
| HEAD | `git rev-parse HEAD` | `10ee3561ec81fd78b0fe59d125363ba1fc853c35` |
| Worktree | `git status --short` | exit 0；無變更列出。環境 warning：無權讀 `C:\Users\Hsin.YH.Yang/.config/git/ignore` 與 `.pytest_cache/`。 |
| Typecheck ×2 | `npm.cmd run typecheck` | exit 0；script = `tsc --noEmit && tsc --noEmit -p tsconfig.node.json`。 |
| Full Vitest | `npm.cmd test` | exit 0；249 files passed / 1 skipped；2764 tests passed / 2 skipped；duration 22.18 s。 |
| Build | `npm.cmd run build` | sandbox：exit 1（esbuild access denied resolving `vite.config.ts`）；non-sandbox rerun：exit 0，Vite 6.4.3，195 modules transformed，`dist/assets/index-CrPlqSfy.js` 1,233.07 kB gzip 350.60 kB，既有 >500 kB chunk warning。 |
| Preview COI | `npm.cmd run preview` + Playwright one-shot to `http://localhost:4173/` | preview sandbox：exit 1（同 esbuild access denied）；non-sandbox preview + headless Edge read：HTTP 200、COOP `same-origin`、COEP `require-corp`、`crossOriginIsolated === true`。 |

### Discovery Re-audit

| # | T0 要覆驗的事實 | 結果 |
|---|---|---|
| 1 | `ExportPayload.mouseSamples` + `meta.mouseSampling` 成對、缺席合法 | ✅ 維持成立；來源仍為 WP-60 T1/T2。 |
| 2 | raw mouse capture opt-in 預設關閉、`?rawMouse=1` 顯式開啟 | ✅ 維持成立。 |
| 3 | `segmentByTimeGap()` 中性原語、`gapThresholdMs` 呼叫端必填 | ✅ 維持成立。 |
| 4 | `deriveUnlockedIntervals()` 由 `pointer_lock` 事件推導 unlocked intervals | ✅ 維持成立。 |
| 5 | `mouseSampleGaps.ts` 不宣稱 lift/reposition/suspicion | ✅ 檔頭註解仍明確把構念留給 WP-61。 |
| 6 | `deriveRepositioningSuspicion()` = 角速度停滯語意，真人校準 `150/2`，品質標註非教練指標 | ✅ 維持成立；CONTEXT 詞條已明列其限制。 |
| 7 | `KEY_CODE = { KeyA:0, KeyD:1, KeyW:2, KeyS:3 }`，非集合內鍵不入 ring | ✅ CodeGraph + source 覆驗成立。 |
| 8 | `applyInput` 只消費 `KeyD`/`KeyA`，W/S 已採集但 sim 不消費 | ✅ CodeGraph + source 覆驗成立。 |
| 9 | `TickRecord.keys` 固定四 bit，從 `state.held` 推導 | ✅ `keyMaskFromState()` 只讀 left/right；第五 code 結構上不會進 tick record。 |
| 10 | `recordKeyEvents?: boolean` additive 先例存在，預設 false | ✅ 維持成立。 |
| 11 | `research/` C-D1/C-D2 邊界 | ✅ 維持成立；T2/T3 只讀 committed golden/export JSON。 |
| 12 | 真人逐筆軌跡不進 repo | ✅ 維持成立；T2 只允許匿名化短 fixture/golden。 |
| 13 | PA 十四參數已可讀且三個 px/s 參數需重推 | ✅ `lod_v3_default_config.json` 覆驗十四項；三個 px/s/px/s² 門檻不得直接搬。 |
| 14 | PA ADR-002 v1 偽陽與未量 F1 | ✅ ADR-002 覆驗：hard stop、physiological tremor；ground truth missing / F1 unmeasured。 |

### CodeGraph Blast Radius

| Symbol | Measured impact |
|---|---|
| `KEY_CODE` | 3 callers：`InputSampler.ts`、`fpsTestHarness.ts`；tests include `InputSampler.test.ts`。 |
| `CODE_KEY` | 1 caller：`createInputRing().dequeueInto()`；CodeGraph 未列 covering tests。 |
| `InputEvent` | 15 callers；tests include determinism/input ring/regression suites。 |
| `InputRing` | 4 callers in `SharedState.ts`；tests include `InputRing.test.ts`。 |
| `keyMaskFromKeys` | 1 caller：`TickArena.recordTick()`；CodeGraph 未列 covering tests。 |
| `applyInput` | 2 callers：`simStep`、`createSimLoop`；CodeGraph 未列 covering tests。 |
| `parseExportPayload` | 18 callers：history server/API、tracking scripts、replay/export tests 等。 |
| `createDataRecorder` | graph report god node，68 edges；`recordEvent()` 既有 events.push 路徑可重用。 |

### Pre-registration

以下契約同步寫入 README §2.4，**凍結於 2026-09-09（D-61.T0-1）；事後只能升版不得改值**。

| 項目 | 凍結值 |
|---|---|
| 候選事件 | θ sweep = **18 / 30 / 50 ms**；來源分別為 WP-60 R1 18.2 ms 雜訊底線近似、PA v3 30 ms prior、保守 50 ms 上界。三個 θ 都報，不在 T3 前選單值。 |
| 標註鍵與 block | `KeyL`；單一鍵 down/up 表達一段自報 interval。manifest 標 `instructionClass ∈ {'lift','pause','oneshot'}`；建議一 run 一種指示。Trial 由 peripheral `visible` 開始，同 target `hit`/下一個 peripheral `visible`/run end 最早者結束。 |
| 正例 | `instructionClass='lift'` 的有效 annotation interval 兩側各擴張 **300 ms** 後，與候選 gap interval 有 overlap > 0；one-to-one greedy pairing。 |
| 負例 | `pause` annotation interval 匹配到的 gap = pause 負例；`oneshot` 所有 candidate gap = oneshot 負例；lift run 未匹配 gap 另列 background 並計入 precision FP。 |
| 匹配容差 | **300 ms**，依 D-61.U2 的約 200 ms 自報反應時間與 WP-57 §T5-real 的 180–225 ms lift 事件長度。只支撐事件級匹配，不支撐起點精度。 |
| 資料充分性 | ≥2 independent sessions；全 cohort ≥30 lift intervals 與 ≥30 pause intervals；held-out 各 ≥10。每份 run 必須 `meta.displayHz === 240`、COI true、active event rate ≥500 Hz、no overflow、Pointer Lock 中斷 0。 |
| 標註完整性 | interval 數與 expected trials 差額 ≤ `max(1, floor(0.05 * expectedTrials))`；pair violations = 0；unlocked annotation = 0。lift/pause annotation latency median 差 >150 ms 或 p90 差 >300 ms ⇒ `annotation-channel-unusable`。 |
| Split | 依 manifest `recordedAt` / filename time / manifest order 排序；前半 calibration、後半 held-out，50/50，每側至少 1 session；同 session 不跨兩側。 |
| Metrics | 每個 θ × ablation layer 報 TP/FP/FN/TN、precision、recall、F1、pause FPR、oneshot FPR、background FP count；calibration/held-out 分開。 |
| Promotion gate | held-out precision ≥0.90、recall ≥0.80、F1 ≥0.85、pause FPR ≤0.10、oneshot FPR ≤0.05、`calibrationF1 - heldOutF1 ≤ 0.10`。 |
| Decision rule | 任一 θ × layer 達標且 data/annotation gates 皆過 ⇒ T4；資料不足 ⇒ `blocked-by-data`；標註通道不可用 ⇒ `annotation-channel-unusable`；足量但未達標 ⇒ `not-reliably-separable`。 |

### Construct Naming And CONTEXT Draft

T1/T4 可執行命名：

| Item | Frozen value |
|---|---|
| Construct zh/en | 感測器離地 / sensor lift |
| Identifier prefix | `sensorLift` for values/options; `SensorLift*` for types |
| T1 event | additive `DrillEvent` discriminant `annotation`，payload 以 `kind: 'sensor_lift'` 與 `down` 表示 `KeyL` interval |
| T4 conditional module | `src/metrics/sensorLiftCriterion.ts` |
| Research package | `research/src/lift/` |

`CONTEXT.md` 待 T1/T4 落地時可直接採用的草稿：

| 詞條 | 草稿 |
|---|---|
| **感測器離地（sensor lift）** | 以事件級 raw mouse sample stream 的時間間隙作候選、再用獨立 self-report annotation 與空洞前後運動學驗證的構念。訊號來源是 `mouseSamples.dtUs/dx/dy` 與 `annotation` event，同一 `event.timeStamp` 時鐘域；時間粒度約 1 ms。它回答「這個候選空洞是否可被判為感測器離地」，不回答「玩家是否重新定位滑鼠」或「lift 真實起點在第幾毫秒」。未通過 WP-61 gate 前一律 `research_only`，不得進教練報告。 |
| **抬滑鼠疑慮旗標（repositioning suspicion）與 sensor lift 的差異** | `deriveRepositioningSuspicion()` 是 WP-57 的角速度停滯品質標註，訊號來源為 128 Hz tick 聚合後的 `dYaw/dPitch` 與 canonical movement window，時間粒度 7.8125 ms；它標的是大幅拉槍期間疑似重新定位造成的停滯。`sensorLift` 是 WP-61 的獨立構念，訊號來源為 raw sample gap + annotation + 邊界運動學。兩者並存但不得互相取代；C-D4 禁的是同一構念兩套定義，不是這兩個不同構念。 |

### Required Audit Artifact

| 項目 | 門檻 | 實測 / 判定 |
|---|---|---|
| WP-60 handoff ① 事件率分布 | 連續移動期間 ≥ 500 Hz | ✅ R1 Run B：約 1005 Hz；`dtUs` p50 995 / p95 1660 / p99 2235。 |
| WP-60 handoff ② 空洞長度分布 | 已知負面結論與四限制覆驗 | ✅ D-60.R2-1 維持：lift/pause 秒級範圍重疊；R2 四限制仍成立。 |
| WP-60 handoff ③ PA 十四參數 | 三個 px/s 空間參數具名標註 | ✅ PA config 十四項覆讀；`ACCEL_UP_THRESHOLD_PX_S2`、`START_SPEED_GATE_PX_S`、`HOVER_VELOCITY_THRESHOLD_PX_S` 不得直接搬。 |
| WP-60 handoff ④ 構念歸屬 | 必須交付 | ✅ D-61.U1 + GD-37：既有角速度停滯 suspicion 與新 sensor lift 並存但語意分離。 |
| 顯示更新率 | cohort 錄於 240 Hz；兩門檻不合併 | ✅ 使用者已拍板 240 Hz；stage13/top-level index 已覆核有 120/144 依據補註，不改數字。 |
| 滑鼠輪詢率 / DPI | ≤1000 Hz polling；DPI 必填 | 🟡 R1 實測支撐約 1000 Hz；實際滑鼠型號/DPI/browser/resolution 尚待 cohort manifest。T2 作廢條件已凍結，缺 DPI 不進 T3。 |
| `crossOriginIsolated` | true | ✅ preview 實測 true；5173 被既有 server 占用，未跑 dev 讀數以免測錯 checkout。 |
| 評估契約凍結 | README §2.4 零留白 | ✅ 已填值並同步本節。 |
| Baseline 三閘 | typecheck ×2 / Vitest / build | ✅ typecheck exit 0；Vitest exit 0；build 非 sandbox exit 0。sandbox 失敗具名為 esbuild access denied。 |

## T1 annotation channel（2026-09-09）

### Implementation Summary

| Area | Result |
|---|---|
| Input ring | `KEY_CODE` / `CODE_KEY` additive 加入 `KeyL`，既有 A/D/W/S enum 值與 `keyMaskFromKeys()` 四 bit movement mask 不變。 |
| Recorder | `recordAnnotationEvents?: boolean` 預設 false；opt-in 時 `recordEvent()` 保存 `{ type:'annotation', kind:'sensor_lift', code:'KeyL', down, t }`。 |
| Sim loop | `applyInput` 的 `KeyL` 分支只讀 recorder flag 並記錄 event；不改 movement、aim、target、fire、ADS 或 tick state。 |
| App wiring | query flag 為 `?annotation=1`；正式 WP-61 錄製與 raw mouse 同開：`?rawMouse=1&annotation=1`。 |
| Export schema | JSON 顯式保存 `kind:'sensor_lift'`；CSV 維持 24 欄 header，不新增欄位，annotation row 重用 `key`/`down` 欄。 |
| UI | 無視覺回饋，避免誘導操作者分心或改變標註延遲。 |

### Verification

| Gate | Command | Result |
|---|---|---|
| Targeted Vitest | `npx.cmd vitest run src/state/InputRing.test.ts src/input/InputSampler.test.ts src/data/DataRecorder.test.ts src/data/exportPayloadSchema.test.ts src/data/export.test.ts tests/regression/wp61-annotation-channel.test.ts tests/regression/determinism.test.ts` | exit 0；7 files passed；211 tests passed。 |
| Mutation verification | temporary opt-in-only `state.player.x += 1e-12` inside the `KeyL` branch, then `npx.cmd vitest run tests/regression/wp61-annotation-channel.test.ts` | expected red：exit 1；4 failed / 3 passed；四個 FPS parity cases all reported `tick[19]: 1e-12 !== 0` 等 15 個 tick mismatches。以 copy backup 還原後同檔 exit 0；7 tests passed。 |
| Typecheck ×2 | `npm.cmd run typecheck` | exit 0。 |
| Focused E2E | `npx.cmd playwright test tests/e2e/annotation-channel.spec.ts --project=edge` | sandbox 因 esbuild 無權讀 `../../../..` exit 1；non-sandbox rerun exit 0；2 passed（59.9 s）。 |
| Push-count regression | `tests/regression/wp61-annotation-channel.test.ts` / `adds Array.prototype.push calls equal to the number of actual annotation events` | off path `0` calls；on path `2` calls；delta `2` = actual `KeyL` down/up annotation events。 |
| Naming scan | `rg -n "reposition\|suspicion" <T1 code/test files>`；`rg -n "sensorLift\|SensorLift\|sensor_lift\|annotation" src\metrics\spiderShotRepositioning.ts` | both exit 1 with zero hits；新標註切片不使用既有構念語彙，舊 repositioning 模組不提新構念。 |
| Full Vitest | `npm.cmd test` | exit 0；250 passed / 1 skipped files；2785 passed / 2 skipped tests；17.73 s。 |
| Build | `npm.cmd run build` | sandbox 因 esbuild access denied exit 1；non-sandbox rerun exit 0；Vite 6.4.3，195 modules transformed，既有 chunk-size warning。 |
| Graphify | `graphify update .` | exit 0；AST extraction 631/631；rebuilt 4675 nodes / 11506 edges / 285 communities。 |

`uv run pytest` 與全量 Playwright 未在 T1 跑：本切片沒有修改 `research/` Python，且 T1 DoD 要求的是 annotation-channel focused E2E。package-level 五閘會在 WP-61 T-exit 逐項補齊或具名說明。

## T2 cohort ingest and audit（2026-09-09）

### 判定：`blocked-by-data`（cohort 尚未錄製）

T2 的核心產出是一個 go／no-go 判定。**本輪判 `blocked-by-data`，理由是 cohort 不存在** —— step 1（錄製）屬使用者操作，`?rawMouse=1&annotation=1` 的 240 Hz 真人 run 一份都還沒有。

依 T0 凍結的 NFR-61.7 逐項對照（以現有可跑的合成 fixture 為輸入，數字為實測）：

| 項目 | 實測 | 下限 | 差多少 |
|---|---|---|---|
| 獨立 session（真人） | **0** | 2 | 差 2 |
| lift 標註區間（真人） | **0** | 30 | 差 30 |
| pause 標註區間（真人） | **0** | 30 | 差 30 |
| held-out lift／pause | **0／0** | 各 10 | 各差 10 |
| θ=18／30／50 ms 候選空洞（真人） | **0／0／0** | > 0 | 三個 θ 都缺 |

⇒ **不得開 T3**（task-checklist 序列閘 ②）。F3 檢定（標註通道可用性）在真人 lift／pause 兩組都有樣本之前**判 `indeterminate`，不是通過** —— 見 D-61.T2-4。

### 本輪實際交付：T2 的全部儀器 + 端到端驗證

錄製之外的每一個 step 都已落地並跑過。cohort 一到就能直接跑，不需要再寫程式。

| step | 交付物 | 狀態 |
|---|---|---|
| 1 錄製 | —— | ⛔ 使用者操作，未執行 |
| 2 逐份可用性覆核 | `auditLiftRuns()` 六項硬閘 + 具名作廢 | ✅ |
| 3 標註完整性稽核 | `extractAnnotationIntervals()` + trial 差額／成對性／unlocked 三閘 | ✅ |
| 4 F3 檢定 | `assessAnnotationChannel()` 逐 θ 的 p10／p50／p90 與二元判定 | ✅ |
| 5 Stage 1 golden | `record:lift-golden` + `lift-segments-synthetic-lift.json` + 逐位重現斷言 | ✅ |
| 6 候選事件表 | `research/src/lift/` + `build_candidate_table.py` | ✅ |
| 7 資料充分性判定 | `assessCohortSufficiency()` 三選一去向 | ✅ |
| 8 operator 報告 | `analyze:lift-cohort` 新入口 + `analyze:spider-wide` 三欄可見度 | ✅ |
| 9 全量閘 | 見下 §Verification | ✅ |

### Implementation Summary

| Area | Result |
|---|---|
| Python ingest | `load_export` additive 接受 `pointer_lock` 與 `annotation`。**這是修一個既有的硬傷** —— 在此之前任何帶 `pointer_lock` 的 WP-60 匯出、或帶 `annotation` 的 WP-61 匯出，都會被 `unsupported event type` 整份拒收。`annotation.code` 沿用 WP-29 的手法映進既有 `key` 欄，`EVENT_COLUMNS` 與 CSV 欄面**逐位不變**；`pointer_lock.locked` 驗而不出欄（歸因是 TS `deriveUnlockedIntervals()` 的單一定義）。 |
| 取樣健康度 | `readSamplingHealth()` 由 WP-57 runner 抬進 `scripts/mouseSamplingHealth.ts`，行為逐位不變（既有 20 個 case 全綠）。抬出來是為了讓 WP-61 稽核與 WP-57 報告共用**同一個** `activeRateHz` —— 兩邊各算一次就會有兩個「事件率夠不夠」的答案。 |
| 稽核契約 | `scripts/liftCohortAudit.ts`：T0 凍結值全部 `const` 具名並由測試釘死；`auditLiftRuns` / `assessAnnotationChannel` / `assessCohortSufficiency` / `splitBySession` / `buildLiftCohortReport`。純函式，零 I/O。 |
| Stage 1 golden | `scripts/liftSegmentationGolden.ts`（純）+ `record-lift-segmentation-golden.ts`（I/O）。golden 內嵌時間通道 `t0Ms`/`dtUs`，**不含** `dx`/`dy`、不含任何參與者欄位；寫出前先自我覆驗。 |
| manifest | `scripts/liftManifest.ts` 一份解析器同時吃字串型（WP-57）與物件型（WP-61）條目。 |
| Python 分析 | `research/src/lift/algorithms/{golden,candidates}.py`（純）+ `notebooks/t2/{generate_synthetic_lift_fixture,build_candidate_table}.py`（I/O）。 |
| 合成 fixture | `research/fixtures/exports/synthetic_sensor_lift.json`（8 trial／8 標註／8 空洞，240 Hz、1000 Hz 取樣）+ 由它產出的 golden。**它不是證據** —— 空洞由腳本擺放，任何在它上面訓練出來的判準只會復原這個檔。 |
| operator 入口 | 新 `npm run analyze:lift-cohort`（判定 + 三張表，輸出 `.lift-cohort-analysis/`，gitignored）；既有 `analyze:spider-wide` 的取樣健康度子表加三欄可見度欄位。 |

### 兩份對照 fixture 的實跑輸出（T2 DoD）

一份健康、一份標註殘缺（丟掉三對標註 + 一個沒有 up 的 down），兩支 operator 入口各跑一次。

`npm run analyze:lift-cohort`（節錄，完整輸出見終端機；三份 run = healthy lift／healthy pause／deficient lift）：

```text
⛔ **`blocked-by-data`** —— 資料量未達 T0 凍結下限。差多少逐條列於下。
- lift 標註區間 8 < 30（差 22）
- pause 標註區間 8 < 30（差 22）
- held-out lift 區間 0 < 10（差 10）
- held-out pause 區間 8 < 10（差 2）

## 逐份可用性（1／3 份作廢）
- **lift-annotation-deficient.json**
  - 標註成對性違規 1 次（T0 凍結上限 0）⇒ 作廢
  - 標註數 4 與 expected trials 8 差 -4，超過凍結上限 ±1 ⇒ 作廢

| run | class | 標註事件 | 標註區間 | expected trials | 差額 | 上限 | 成對違規 | 落在 unlocked |
|---|---|---|---|---|---|---|---|---|
| lift-healthy.json | lift | 16 | 8 | 8 | 0 | ±1 | 0 | 0 |
| pause-healthy.json | pause | 16 | 8 | 8 | 0 | ±1 | 0 | 0 |
| lift-annotation-deficient.json | lift | 9 | 4 | 8 | -4 | ±1 | 1 | 0 |
```

`npm run analyze:spider-wide`（新三欄）：

```text
| run | samples | 平均事件率 (Hz) | 連續期間 (Hz) | 溢位 | lock 中斷 | 間隙 > 30.0 ms | 最長間隙 (ms) | 標註區間 | 成對違規 | trials |
|---|---|---|---|---|---|---|---|---|---|---|
| lift-healthy.json | 2708 | 1000 | 1000 | 否 | 0 | 8 | 290.0 | 8 | 0 | 8 |
| lift-annotation-deficient.json | 2708 | 1000 | 1000 | 否 | 0 | 8 | 290.0 | 4 | 1 | 8 |
```

`uv run python src/lift/notebooks/t2/build_candidate_table.py`：

```text
goldens: 1 (synthetic-lift)
  theta=18 ms: 8 candidates, labels {'lift': 8}, match rate 100.00%
  theta=30 ms: 8 candidates, labels {'lift': 8}, match rate 100.00%
  theta=50 ms: 8 candidates, labels {'lift': 8}, match rate 100.00%
```

### Verification

| Gate | Command | Result |
|---|---|---|
| Targeted Vitest | `npx.cmd vitest run tests/regression/wp61-lift-cohort-audit.test.ts` | exit 0；30 tests passed。 |
| Golden 重現 | `npx.cmd vitest run tests/regression/wp61-lift-segmentation-golden.test.ts` | exit 0；5 tests passed。 |
| WP-57 runner 零回歸 | `npx.cmd vitest run tests/regression/spider-wide-repositioning-runner.test.ts` | 抬出 `readSamplingHealth()` 後 20 passed（逐位不變）；加上兩個 WP-61 可見度 case 後 22 passed。 |
| 全量 Vitest | `npm.cmd test` | exit 0；**252 passed / 1 skipped files；2822 passed / 2 skipped tests**（T1 基線為 250／2785 ⇒ +2 files／+37 tests，全部來自本切片）。 |
| Typecheck ×2 | `npm.cmd run typecheck` | exit 0。⚠️ **它不覆蓋 `scripts/` 與 `tests/`**（見 Surprises 4）；本切片另跑一次明確的 `tsc --noEmit --strict` 掃過所有新檔與被改的 `scripts/`／`tests/` 檔，exit 0。 |
| Build | `npm.cmd run build` | exit 0；Vite 2.36 s，既有 chunk-size warning。 |
| Python | `uv run pytest`（`research/`） | exit 0（見下方逐目錄數字）。 |
| 突變驗證 ① F3 | 把 `verdict: 'indeterminate'` 改成 `'usable'` | expected red：1 failed / 29 passed（`reports indeterminate — never usable`）。還原後 30 passed。 |
| 突變驗證 ② oneshot 豁免 | 拿掉 `instructionClass !== 'oneshot'` 條件 | expected red：1 failed / 29 passed。還原後綠。 |
| 突變驗證 ③ session 隔離 | 讓 `splitBySession` 允許同一 session 跨兩側 | expected red：2 failed / 28 passed。還原後綠。 |
| 突變驗證 ④ golden 重現 | 在測試內把一個 gap 的 `durationMs` +1 | `verifyLiftSegmentationGolden()` 回 `['theta=18.gaps: 8 recorded vs 8 recomputed']`（常駐 case，非暫時突變）。 |
| 突變驗證 ⑤ C-D1／C-D2 掃描 | 在 `candidates.py` 插入 `print()` + `from src.metrics import x` | expected red：2 failed（TS import 掃描 + print 掃描各一）。還原後 19 passed。 |

全量 Playwright 未在本切片跑：T2 沒有動任何 runtime 程式碼（`src/` 只有 Python ingest 與 `scripts/`／`research/`／fixtures 變動），package-level 五閘於 T-exit 補齊。

### 三個必須寫下來的判斷（不是門檻變更）

見 Decision Log 的 **D-61.T2-1～T2-7**。下列四項都是**凍結契約沒有涵蓋到的適用範圍問題**，不是把凍結值改掉（T2-5／T2-6／T2-7 為實作落點決策）：

1. `oneshot` 不套 trial 差額閘（否則整個 oneshot 負例對照組會被作廢）。
2. golden 內嵌時間通道以支撐逐位重現（`dx`/`dy` 仍不進 repo）。
3. `oneshot` run 中**有標註**的空洞標成 `lift` 而非負例（否則標籤會由空洞的脈絡而非操作者的標註決定，違反 FR-61.3）。
4. F3 檢定任一 θ 判 unusable 即整批 unusable；某一組無樣本時判 `indeterminate` 而非通過。

## Decision Log

| ID | Date | Decision | Owner | Evidence |
|---|---|---|---|---|
| **D-61.P1** | 2026-09-09 | **本 WP 為 WP-61，全域決策預留 GD-37，無獨立里程碑**（T-exit gate 即交付判定；下一個可用里程碑為 M22）。⚠️ 依 [GD-35](../../../DECISIONS.md) ② 的紀律，`GD-37` **視為佔位符** —— 入帳當下必須重新查最大值（GD-32／33／34／35／36 已各撞過一次，本專案平行 session 為常態）。 | 規劃 | [`../README.md`](../README.md) §3；`DECISIONS.md` 現行最高 = GD-36 |
| **D-61.P2** | 2026-09-09 | **在草案的四切片之外新增 T1「標註通道儀器」，且它排在 cohort 錄製之前。**<br>理由：草案 T0 要求「保存獨立的抬起／落下、停住／恢復時間標註，標註不可由空洞反推」，但 repo 內**不存在**能產生這種標註的機制 —— `KEY_CODE` 是 `{KeyA,KeyD,KeyW,KeyS}` 的封閉集（非集合內的鍵整筆不入 ring），`DrillEvent` union 也無標註型別。⇒ 沒有 T1，T0 的資料要求在物理上無法滿足。<br>**連帶價值**：這正是 D-60.T2-1 的同一模式 —— 被 gate 阻塞時，先問「這個 task 的產出能不能變成解 gate 的儀器」。T1 可在 cohort 尚未錄製時獨立驗收。<br>**Alternatives considered**：(a) 沿用 R2 的「每組 10 次」block 指示當標籤 —— R2 的具名限制②已判定「無逐次時間標註，九個長空洞不能當九次成功偵測」，駁回；(b) 外部影片 + 事後對齊 —— 跨時鐘域，repo 無支援，且對齊誤差不可稽核，駁回；(c) 把標註做進 UI 按鈕 —— 需離開 Pointer Lock，會製造與抬滑鼠同形的空洞（FR-60.6），**自相矛盾**，駁回。 | 規劃 | README §0 discovery ⑦⑧⑨；[`src/state/types.ts:45`](../../../../../src/state/types.ts#L45)；WP-60 progress §T0 R2 限制② |
| **D-61.P3** | 2026-09-09 | **標註鍵擴充既有 `KEY_CODE` 封閉集，而非另開一條輸入通道。**<br>理由：`applyInput` 的 key 分支只對 `KeyD`／`KeyA` 有作用，`KeyW`／`KeyS` 今天就是「被採集但 sim 不消費」；`TickRecord.keys` 是由 `state.held` 推導的固定四 bit 遮罩。⇒ 第五個 code 對 sim 的 inert **是結構性的**，決定性斷言是**覆核**它而非**維持**它。另開通道要動 ring 的 `type,t,a,b` 槽位語意，成本與風險都高得多。<br>**Alternatives considered**：(a) 新增第五種 ring event type —— 動固定佈局的核心表示法，駁回；(b) 用既有 `KeyW`／`KeyS` 兼作標註 —— 語意重載，且 WASD 在其他 drill 會被真正使用，駁回。 | 規劃 | README §0 discovery ⑦⑧⑨；§2.5 |
| **D-61.P4** | 2026-09-09 | **Stage 1 切段不在 Python 側重寫**：由 TS `segmentByTimeGap()` 產出 committed golden JSON，`research/` 只讀不算。<br>理由：C-D1 允許 `research/` 讀 committed golden；若 Python 另寫一套切段，T3 的結果就無法歸因（差異來自特徵還是來自切段？），且形同對一個已凍結的原語建立第二定義。<br>**Alternatives considered**：(a) Python 重寫切段並以 parity 對表 —— 那是 C-D5 的成本，而原語尚未晉升，過早，駁回；(b) 把整個分析搬進 TS —— 探索期需要繪圖與統計，TS 側沒有那個工具鏈，駁回。 | 規劃 | README §2.1／OQ-61.4／F7；[`research/README.md`](../../../../../research/README.md) |
| **D-61.P5** | 2026-09-09 | **T2／T3 只做 Python 單側實作，C-D5 刻意留到 T4 才觸發。**<br>理由：同 OQ-60.6 —— C-D5 的雙實作對表紀律只綁**晉升指標**；本 WP 在 T3 判定之前沒有任何晉升指標。過早雙實作會讓每次改判準都要兩端同步 + 升版，成本遠大於收益。<br>**Alternatives considered**：(a) 一開始就雙實作 —— 探索期參數會反覆變動，每次都要重跑 golden，駁回；(b) 永遠只做 Python —— 判準若晉升就必須進 `src/metrics/` 供離線推導使用，屆時 C-D5 是硬性要求，駁回。 | 規劃 | README §2b C-D5 列；OQ-61.4 |
| **D-61.P6** | 2026-09-09 | **評估契約必須在 T0 pre-register，事後只能升版不得改值。**<br>理由：GD-20 的既有紀律（xcorr 的 reliability gate 門檻於 WP-31 T0 pre-register 凍結，事後不得調整）。本 WP 的資料量小、特徵維度高，是「調門檻直到指標好看」風險最高的形態；[`../README.md`](../README.md) 也已明文禁止「用本輪最大值調出剛好分開的門檻」。<br>**Alternatives considered**：(a) 先看分布再定門檻 —— 那就是 GD-20 要防的事，駁回；(b) 只 pre-register 指標不 pre-register 門檻 —— 門檻才是判定的所在，駁回。 | 規劃 | [`DECISIONS.md`](../../../DECISIONS.md) GD-20；README §2.4 |
| **D-61.P7** | 2026-09-09 | **負面結論（「不可靠分離」／「證據不足」）為一級交付物，其驗收嚴格度與「通過」相同。**<br>理由：D-60.R2-1 已在空洞長度軸上得到負面結論，且 §1.4 的物理論證顯示 lift 與 pause 在本硬體上都產生「零樣本」區間 ⇒ 分不開是**最可能的單一結果**。若只為「通過」寫 DoD，這個 WP 在最可能的路徑上會沒有交付定義。C-D3／GD-20 的立場一致：寧可少一個指標，不能有一個會說錯話的指標。 | 規劃 | README §3.1 R3／§5；`DECISIONS.md` GD-20 |
| **D-61.T0-1** | 2026-09-09 | **評估契約 `sensor-lift-validation-v1` 於 T0 凍結**：θ sweep = 18/30/50 ms；匹配容差 = 300 ms；promotion gate = held-out precision ≥0.90、recall ≥0.80、F1 ≥0.85、pause FPR ≤0.10、oneshot FPR ≤0.05、calibration→held-out F1 drop ≤0.10；資料不足、標註通道不可用、足量但未達標三條負面結案路徑均為合法交付。<br>**Alternatives considered**：(a) 先看 cohort feature distribution 再調門檻 —— 違反 GD-20，駁回；(b) 只凍結 30 ms 單一 θ —— 會把 PA prior 誤升為本硬體校準值，駁回；(c) 用較寬容差（500 ms）吸收自報延遲 —— 會把相鄰 trial/gap 誤配風險放大，且開始接近秒級 gap overlap，駁回。 | Engineering | README §2.4；本檔 §Pre-registration |
| **D-61.T0-2** | 2026-09-09 | **OQ-61.3／61.4 收斂為工程決策**：標註鍵 code = `KeyL`；新構念識別名 = `sensorLift`，型別/模組前綴 = `SensorLift`，條件式 TS 晉升模組 = `src/metrics/sensorLiftCriterion.ts`；T2/T3 實作落 Python `research/src/lift/`，Stage 1 切段只讀 TS 產出的 committed golden JSON，不在 Python 重寫。<br>**Alternatives considered**：(a) 用兩個鍵分別標 lift/pause —— 增加誤按與仲裁規則，駁回；(b) 用 `KeyW`/`KeyS` 兼作標註 —— 語意重載且會污染未來 WASD drill，駁回；(c) T2 就做 TS+Python 雙實作 —— 尚無晉升指標，過早觸發 C-D5，駁回。 | Engineering | README §0.2／§2.4；D-61.P4/P5 |
| **D-61.T1-1** | 2026-09-09 | **T1 的標註事件為 opt-in `annotation` event，入口 flag = `?annotation=1`，JSON 保存 `kind:'sensor_lift'`，CSV 維持既有 events header 並重用 `key`/`down` 欄。**<br>理由：`KeyL` 已在 input ring 中取得同時鐘域時間戳；JSON 需要顯式構念名以支撐 strict parser 與後續稽核；CSV 若新增欄位會讓所有非標註匯出的 header 改變，違反 additive 預設關閉的精神。<br>**Alternatives considered**：(a) 新增 CSV `kind/code` 欄 —— header 對未使用標註的 export 也變動，駁回；(b) 把 `KeyL` 記成既有 `key` event —— 語意重載，會讓 release-time consumer 誤讀，駁回；(c) 全域預設開啟 —— 違反 FR-61.2，駁回。 | Engineering | T1 tests；`docs/operational/schema.md`；`docs/operational/spider-wide-recording-spec.md` |
| **D-61.U1** | 2026-09-09 | **OQ-61.1（＝ WP-60 交不出來的第四項 handoff）收斂：兩個構念並存但語意分離。**<br>既有 `deriveRepositioningSuspicion()` 維持「角速度停滯（repositioning suspicion）」語意**一行不改**；新構念為「**感測器離地（sensor lift）**」，用不同名稱、不同型別、不同模組。兩者於 `CONTEXT.md` 分開定義並**互相指名**（差異：訊號來源＝ 128 Hz tick 聚合 ω vs 事件級取樣空洞；時間粒度＝ 7.8125 ms vs ~1 ms；可回答的問題不同）。<br>⇒ C-D4 的守線方式確立：禁的是「同一構念兩套定義」，本案是「兩個不同構念」，故雙向命名掃描（新模組零 `reposition`／`suspicion`；舊模組零 `sensorLift`）即為充分證據。<br>**Alternatives considered**：(b) 新的取代舊的 —— 用一個未驗證的取代一個已校準的，順序反了，駁回；(c) 本輪不建構念名只出研究結論 —— 使用者未選，但仍是 T3 判定為非 `promote` 時的實際落點（T4 不執行）。 | 使用者 | 使用者回覆（2026-09-09）；README §1.5 OQ-61.1 |
| **D-61.U2** | 2026-09-09 | **OQ-61.2 收斂：自報鍵為主 + block 設計為冗餘。**<br>受測者本人按標註鍵；block 設計（「本 run 每個 trial 都抬」）提供 trial 級冗餘標籤，用來稽核漏按。不引入第二人標註、不引入外部硬體。<br>⚠️ **隨此決定生效的宣稱界線（必須進 §Pre-registration）**：反應時間 ≈ 200 ms 與 WP-57 量到的 lift 事件 180–225 ms **同量級** ⇒ 自報鍵可支撐**事件級匹配**（「哪一個空洞是抬滑鼠」），**不可**支撐**起點精度**宣稱（「抬滑鼠從第幾毫秒開始」）。T3／T-exit 不得作後者的宣稱；匹配容差的設計以此為前提。<br>**Alternatives considered**：(b) 第二人標註 —— 一樣是反應時間，不會更準，卻多一個人與一台裝置，駁回；(c) 兩者都收 —— 錄製負擔加倍，且不一致時要另訂仲裁規則，駁回；(d) 客觀量測（高速攝影／外部感測器）—— 跨時鐘域對齊，成本遠大於本 WP 規模，列為 F3 判定「自報通道不可用」時的升級路徑。 | 使用者 | 使用者回覆（2026-09-09）；README §1.5 OQ-61.2／§3.2 |
| **D-61.U3** | 2026-09-09 | **OQ-61.5 收斂：cohort 一律錄在 240 Hz 顯示器；`meta.displayHz === 240` 為逐份可用性條件。**<br>硬體：使用者有 60 Hz 與 **240 Hz** 兩台，選 240 Hz。<br>⚠️ **規劃期把「≥ 120」與「≥ 144」誤判為文件矛盾，實際上不是** —— 兩者回答不同問題，**兩個都對**：<br>　• **≥ 120 Hz** ＝ 資格閘地板，依 `PERF_FLOOR_MS = 8.33`（[`src/display/constants.ts:13`](../../../../../src/display/constants.ts#L13)）與 [`spider-wide-recording-spec.md`](../../../../operational/spider-wide-recording-spec.md) §2.1；管的是 `meta.suspect` 是否被 frame floor 判紅。<br>　• **≥ 144 Hz** ＝ KI-031 完全緩解點，依 [KI-031](../../../../known_issue/KI-031-detection-sustained-ticks-dies-when-aim-updates-slower-than-sim.md) §2「失效邊界」：零樣本比例 ≈ `1 − f/128`，`f ≥ 128 Hz`（144 Hz 顯示）幾乎無零樣本；**`f ≈ 120 Hz` 仍約 6% 零樣本 ⇒ 偶發漏檢**；60 Hz 為懸崖。管的是 `deriveDetectionMetrics()` 會不會靜默失效。<br>⇒ `../README.md` §4 與 `docs/exec-plan/README.md` §2 的「≥ 144 Hz」**有依據，不得改寫為 120**。正確處置是**兩個門檻並列並各自標明依據**，而非統一成一個數字。**240 Hz 同時滿足兩者**，故本決定不受影響。<br>**連帶**：F1（硬體不存在）**關閉**；R1 由 High 降為 **Med**（殘餘風險只剩錄製時間與品質）。原「60 Hz 降級路徑」不再需要。<br>**新增硬性條件**：**禁止混合顯示更新率** —— `meta.displayHz` 不等於 240 即作廢該 run（T2 逐份覆核）。顯示更新率同時改變 aim 更新率與 `suspect`，是顯性 confound；既有 WP-57／WP-60 的 60 Hz 真人資料**不得**併入本 cohort。 | 使用者 | 使用者回覆（2026-09-09）；`src/display/constants.ts:13`；`src/data/metadata.ts:154`；KI-031 §2 |
| **D-61.U4** | 2026-09-09 | **OQ-61.6 收斂：n = 1 的宣稱上限為「本操作者 × 本硬體 × 本 drill 條件下成立」，一律 `research_only`，不得進教練報告（C-D3／GD-20）。**<br>⇒ **T4 的「`src/` 內零 importer」不是暫時措施，而是本 WP 的終局狀態** —— 即使 T3 判 `promote`、T4 交付判準，也不會有任何教練報告端的消費者。這與 `deriveRepositioningSuspicion()` 的既有處置一致（同樣零 importer、同樣品質標註定位）。T-exit 的 A-61.20 據此驗收。<br>跨人泛化需另立 WP 與另一批 cohort。 | 使用者 | 使用者回覆（2026-09-09）；README §1.5 OQ-61.6；`DECISIONS.md` GD-20 |
| **D-61.T2-1** | 2026-09-09 | **`oneshot` run 不套用 trial 差額閘。**<br>凍結契約寫「interval 數與 expected trials 差額 ≤ `max(1, floor(0.05*expectedTrials))`」，但 **expected trials 這個概念只在「每個 trial 都標」的 block 設計下成立**。`spider-wide-recording-spec.md` §3.3 的 oneshot 指示是「一次到位，遇到**實際**抬滑鼠才用 KeyL 標註」⇒ 標註數本來就遠少於 trial 數。照字面套用會把**整個 oneshot 負例對照組**作廢，而那組正是 T3 用來算 oneshot FPR 的母體 —— 也就是說，照字面執行會摧毀凍結契約自己要求的一個指標。<br>這是**適用範圍**的判斷，不是門檻變更：`lift`／`pause` 的差額閘一字未改，`oneshot` 的成對性閘與 unlocked 閘照樣生效。<br>**Alternatives considered**：(a) 照字面套用 —— 見上，自相矛盾，駁回；(b) 為 oneshot 另訂一個較寬的差額上限 —— 那才是改門檻（憑空生一個新數字），駁回；(c) 錄製時要求 oneshot 也逐 trial 標註 —— 那就不是 oneshot 了，它會變成第二個 lift 組，駁回。 | Engineering | [`liftCohortAudit.ts`](../../../../../scripts/liftCohortAudit.ts) `auditRun()`；`wp61-lift-cohort-audit.test.ts` / `exempts oneshot from the trial-delta gate but still enforces pairing`；突變驗證 ② |
| **D-61.T2-2** | 2026-09-09 | **Stage 1 golden 內嵌時間通道（`t0Ms` + `dtUs`），不含 `dx`／`dy`。**<br>T2 step 5 寫「只含 index／時間／長度等衍生量，不含逐筆 `dx`／`dy`」。逐位重現斷言需要 `segmentByTimeGap()` 的**實際輸入**，而它只讀 `dtUs`（`dx`／`dy` 僅被檢查長度）。⇒ 內嵌 `dtUs` 換到一個真正有偵測力的斷言；`dx`／`dy`（＝ D-57.T5-8 保護的真人移動軌跡）仍然不進 repo，並由 `wp61-lift-segmentation-golden.test.ts` 的字串掃描釘死。<br>**代價已知**：2708 樣本的合成 golden 為 39 KB ⇒ 120 s 的真人 run 約 1.5 MB。真人 golden 沿用 `research/README.md` 既有的 ≤ 30 s 匿名化 fixture 政策。<br>**Alternatives considered**：(a) 不內嵌輸入、golden 只存衍生量 —— 那就無法重現，golden 會在原語變動時**靜默過期**，而 T3 會拿著一份與現行原語不一致的切段做消融，駁回；(b) 存 `dtUs` 的雜湊 —— 只能偵測「輸入變了」，不能重現切段本身，駁回。 | Engineering | [`liftSegmentationGolden.ts`](../../../../../scripts/liftSegmentationGolden.ts)；`wp61-lift-segmentation-golden.test.ts`（5 cases，含 tamper 偵測） |
| **D-61.T2-3** | 2026-09-09 | **`oneshot` run 中「有標註」的候選空洞標成 `lift`，只有未匹配的才是 oneshot 負例。**<br>凍結契約寫「`oneshot` 所有 candidate gap = oneshot 負例」。照字面執行會把一個**操作者親自標註為抬滑鼠**的空洞標成負例 —— 那等於讓空洞的脈絡（它出現在哪一種 run）而不是標註來決定標籤，直接違反 FR-61.3。⇒ 匹配到的標 `lift`，未匹配的留在 `negative_group='oneshot'`，凍結的 oneshot FPR 仍在同一個母體上計算。<br>**Alternatives considered**：(a) 照字面把全部標負 —— 違反 FR-61.3，且會人為壓低 recall，駁回；(b) 要求 oneshot run 不得有任何標註 —— 與 §3.3 的指示相反（它明說「遇到實際抬滑鼠才標註」），駁回。 | Engineering | [`candidates.py`](../../../../../research/src/lift/algorithms/candidates.py) `_label_for()`；`test_a_oneshot_run_keeps_unmatched_gaps_as_the_oneshot_negative_group` |
| **D-61.T2-4** | 2026-09-09 | **F3 檢定：某一組無樣本時判 `indeterminate`（非通過）；任一 θ 判 unusable 即整批 unusable。**<br>T0 凍結了 F3 的**門檻**（中位數差 150 ms／p90 差 300 ms）但沒有凍結兩件事：① 用哪個 θ 做檢定，② 一組為空時怎麼判。<br>① 逐 θ 各跑一次，任一 θ unusable 即整批 unusable —— 缺乏凍結值時**拒絕比通過保守**：拒絕不可能製造出可分性假象，通過可以。<br>② 一組為空時「兩組無系統性差異」在邏輯上**未被檢定**；判 usable 會讓一個從未做過的檢定看起來通過了。這是本 WP 最容易發生的錯誤形態（`blocked-by-data` 是最可能的路徑，而資料不足時正好就是某一組為空）。<br>**Alternatives considered**：(a) 只用 30 ms 做 F3 —— 會把 PA prior 誤升為本輪的校準值（T0 已為此拒絕過單一 θ），駁回；(b) 一組為空時判 usable 並加註腳 —— 註腳會在引用時脫落，駁回。 | Engineering | [`liftCohortAudit.ts`](../../../../../scripts/liftCohortAudit.ts) `assessAnnotationChannel()` / `buildLiftCohortReport()`；突變驗證 ① |
| **D-61.T2-5** | 2026-09-09 | **T2 的 operator 報告拆成兩處：`analyze:spider-wide` 只加**可見度**三欄，作廢判定放進新的 `analyze:lift-cohort`。**<br>T2 step 8 指名擴充 `spiderWideRepositioningRunner.ts`。但該 runner 回答的是 WP-57 的 `cm/360` 方向性、且硬綁 `spider-shot-wide-v1`；把 WP-61 的作廢閘塞進去，會讓「這份 run 不能用」在兩個不同的意義之間滑動（不能算方向性 vs 不能進 lift cohort）。⇒ 既有報告加三欄（標註區間／成對違規／trials）滿足「錄完當場就看得出標註有沒有錄壞」這個**實際目的**，且**明文不產生 blocker**；判定留在 WP-61 自己的入口。<br>**Alternatives considered**：(a) 全部塞進 WP-57 runner —— 見上，語意滑動，且會讓 WP-57 的 blocker 清單長出與它無關的條目，駁回；(b) 完全不動 WP-57 runner —— 操作者得跑第二支命令才知道標註錄壞了，違反 step 8 的目的，駁回。 | Engineering | [`spiderWideRepositioningRunner.ts`](../../../../../scripts/spiderWideRepositioningRunner.ts)；`spider-wide-repositioning-runner.test.ts` 的兩個 WP-61 可見度 case |
| **D-61.T2-6** | 2026-09-09 | **`research/src/lift/` 用 `algorithms/` + `notebooks/` 兩層，而非直接平鋪在 `lift/` 下。**<br>D-61.T0-2 凍結的是**路徑前綴** `research/src/lift/`；C-D2 要求純函式與 I/O 分層。兩者相容 ⇒ `lift/algorithms/`（純：無 print／無寫檔／無 matplotlib）+ `lift/notebooks/t2/`（I/O：產 fixture、寫 CSV）。與 `modules/*/` 的既有慣例一致，只是少一層 `modules/`（凍結值沒有它）。<br>C-D1／C-D2 由 `lift/algorithms/tests/test_purity.py` 的 AST 掃描釘死，並以突變驗證過偵測力。 | Engineering | `research/src/lift/`；`test_purity.py`（4 cases）；突變驗證 ⑤ |
| **D-61.T2-7** | 2026-09-09 | **Python `load_export` additive 接受 `pointer_lock` 與 `annotation`；`pointer_lock.locked` 驗而不出欄。**<br>在此之前，任何帶 `pointer_lock` 的 WP-60 匯出或帶 `annotation` 的 WP-61 匯出，都會被 `unsupported event type` **整份拒收** —— T2／T3 的 Python 側在物理上讀不到自己要稽核的標籤。<br>`annotation.code` 沿用 WP-29 `key` 事件的手法映進既有 `key` 欄（`EVENT_COLUMNS` 與 CSV 欄面逐位不變）；`kind` 以封閉集驗證但不出欄（今天只有一個值，多一欄只會讓每個既有 consumer 的 DataFrame 形狀改變）。`locked` 刻意不出欄：把空洞歸因給 lock 中斷是 TS `deriveUnlockedIntervals()` 的**單一定義**（C-D4），Python 側從 golden 讀那個歸因，不得自己長一套。<br>**Alternatives considered**：(a) 在 `lift/` 另寫一支專用 export reader —— 兩套 export 解析器，且既有 loader 的硬傷仍在，駁回；(b) 新增 `kind`／`locked` 欄 —— 改變所有既有 consumer 的欄面，違反 additive 紀律，駁回。 | Engineering | [`loader.py`](../../../../../research/src/modules/ingest/algorithms/loader.py)；`test_loader_annotation_events.py`（7 cases） |

## Surprises

1. **我把兩個各自有依據的門檻當成「文件矛盾」，差點把對的數字改掉。**（2026-09-09，規劃期）
   規劃時看到 `spider-wide-recording-spec.md` §2.1 寫 ≥ 120 Hz、stage13 README §4 與 exec-plan README 寫 ≥ 144 Hz，直接判為不一致，並向使用者陳述「144 是未經稽核的數字」，建議統一為 120。**這個陳述是錯的** —— 讀 [KI-031](../../../../known_issue/KI-031-detection-sustained-ticks-dies-when-aim-updates-slower-than-sim.md) §2「失效邊界」之後才發現 144 有精確依據：零樣本比例 ≈ `1 − f/128`，`f ≥ 128 Hz`（144 Hz 顯示）幾乎無零樣本，而 **`f ≈ 120 Hz` 仍約 6% 零樣本 ⇒ 偶發漏檢**。兩個數字管的是不同的事（資格閘地板 vs detection 判準的連續性），**兩個都對**。
   ⇒ 若沒有回頭讀 KI-031，這一輪會把一個有依據的門檻降級成一個較寬的門檻，而且是以「消除矛盾」的名義做的 —— 那比留著矛盾更糟，因為它會看起來已經解決了。
   ⇒ **教訓**：兩份文件對同一個量給不同數字時，第一個假設不該是「其中一個錯」，而是「它們可能在量不同的東西」。判定為矛盾之前，必須先找到**兩邊各自的依據**；找不到依據的那一個才是候選。本例中兩邊的依據都在 repo 裡（`constants.ts` 與 KI-031 §2），只是沒被一起讀。
   ⇒ 與 WP-60 Surprises 9 同型：那次是 fixture 從**閾值**倒推而非從**真實資料的形狀**倒推；這次是矛盾判定從**數字不同**出發而非從**依據**出發。都是「跳過來源直接看表面」。

2. **本機 gate 有兩種「紅」：真紅與 sandbox/port 紅，T0 必須分開記。**（2026-09-09，T0）
   `npm run build` 與 `npm run preview` 在 sandbox 內都因 esbuild 無權讀 `../../../..` 與 `vite.config.ts` exit 1；同一命令在非 sandbox 權限下 build exit 0，preview 也能回 COOP/COEP 並使 `crossOriginIsolated === true`。同時 5173 已被既有 server 占用，若直接跑 Playwright 全 config 會 reuse 一棵不一定是本 checkout 的 dev server。
   ⇒ T0 的紀錄不能只寫「build 紅」或「COI 未測」：前者是 sandbox 權限問題，後者是 port discipline 問題。本次只用 4173 preview 做 focused COI 讀數，未停止他人 server，也未宣稱 dev server 讀數。

3. **T1 的 determinism 測試必須故意弄壞一次才知道有偵測力。**（2026-09-09，T1）
   `KeyL` branch 的正確實作看起來很小，最危險的是未來有人順手寫進 `state` 而測試沒有抓到。因此 T1 依 README §5 的突變驗證紀律，用 copy backup 暫時插入 `state.player.x += 1e-12`。focused regression 立即紅，且回報多個 `TickRecord` mismatch；還原後同檔綠。
   ⇒ 這證明四 FPS parity 不是只檢查窄 trace，而是真的覆蓋 sim state 寫入對 tick export 的影響。

4. **`npm run typecheck` 不覆蓋 `scripts/` 與 `tests/` —— 我先在一個空集合上跑了六次綠燈。**（2026-09-09，T2）
   本切片的程式碼幾乎全在 `scripts/`（稽核契約、golden、manifest、兩支 CLI）。每寫完一段就跑 `npx.cmd tsc --noEmit -p tsconfig.node.json`，六次 exit 0。直到要驗收才去讀 tsconfig：`tsconfig.json` 的 `include` 是 `["src"]`，`tsconfig.node.json` 的是 `["server"]` ⇒ **`scripts/` 與 `tests/` 兩個目錄從來沒有被任何一支 typecheck 掃過**。
   改用明確的 `tsc --noEmit --strict <檔案清單>` 重跑，立刻抓到兩個真錯：既有 `spider-wide-repositioning-runner.test.ts` 的 `summary()` fixture 缺我新加的三個必填欄位，以及一個既有的未使用 import。也就是說：那六次綠燈**一次都沒有檢查過我寫的東西**。
   ⇒ 這是 WP-60 Surprises 9 與 T0 Surprises 2 的同一族：綠燈的**範圍**沒有被驗證。「命令 exit 0」與「我的程式碼被檢查了」之間差一個 `include` 陣列，而那個差別在終端機上完全看不出來。
   ⇒ **教訓**：第一次在一個新目錄裡寫程式時，先確認驗證命令真的看得到它 —— 最便宜的作法是**故意寫一個型別錯誤**，確認它會紅。本輪是靠讀 tsconfig 才發現，那已經是第六次綠燈之後。
   ⇒ **未修**：把 `scripts/`／`tests/` 納入 typecheck 是 repo 級的變更（會一次翻出既有檔案的錯，如上述那個未使用 import），超出 T2 範圍。已具名留在此處待另立任務。

5. **我寫的 C-D1 掃描器被 repo 既有的 C-D1 掃描器擋下來了。**（2026-09-09，T2）
   `research/src/lift/algorithms/tests/test_purity.py` 要檢查 lift 套件裡沒有任何 TypeScript 引用，於是把 `".ts'"`／`'.ts"'` 寫成字面字串當比對針。全量 `uv run pytest` 一跑，紅的不是我的測試，是既有的 `modules/kinematics/algorithms/tests/test_purity.py::test_research_python_has_no_typescript_dependencies` —— 它會 AST 掃過 **`research/src` 底下每一個 `.py`** 的每一個字串常數，禁止出現 `.ts` 子字串。我的比對針本身就是違規內容。
   有趣的是解法就寫在那支既有測試裡：它自己用 `"." + "ts"` 組出副檔名，正是為了不觸發自己。我沒讀它就先寫了自己的版本。
   ⇒ 兩個教訓。① **加一個同類的守門員之前，先讀既有的那個** —— 不只是為了不重複，而是既有的那個可能已經把「怎麼在不違規的前提下描述違規」解決掉了。② 這次的紅燈是**好事**：它證明既有掃描的覆蓋範圍真的是「每一個 `.py`」，包含 T2 新開的 `lift/` 子樹 —— C-D1 不需要我為新套件另外接線。
   ⇒ 我的 `test_purity.py` 仍然保留（它多驗 C-D2 的 print／寫檔與 `algorithms/` 的 import 純度，且對 `src/metrics`／`src/data` 這種**不帶副檔名**的路徑字串也有偵測力，那是既有掃描抓不到的）。

## Open Questions（狀態）

| ID | 狀態 | Owner | Deadline |
|---|---|---|---|
| **OQ-61.1**（= OQ-60.4）構念歸屬：取代還是並存？各叫什麼？ | ✅ **已收斂 2026-09-09** —— 並存但語意分離；新構念 = **感測器離地（sensor lift）**（D-61.U1）。T0 只需落成型別／檔名與 `CONTEXT.md` 草稿 | ~~使用者 + 研究~~ | ~~T0 exit~~ |
| **OQ-61.2** 標註通道形式：自報鍵／第二人／兩者 | ✅ **已收斂 2026-09-09** —— 自報鍵 + block 冗餘（D-61.U2）。⚠️ 附帶宣稱界線：支撐事件級匹配、**不**支撐起點精度 | ~~使用者~~ | ~~T0 exit~~ |
| **OQ-61.3** 標註鍵 code | ✅ **T0 收斂** —— `KeyL`（D-61.T0-2） | Engineering | ~~T1 凍結前~~ |
| **OQ-61.4** 實作落點與 C-D5 觸發時機 | ✅ **T0 收斂** —— T2/T3 Python `research/src/lift/`；T4 條件式 TS `src/metrics/sensorLiftCriterion.ts`；Stage 1 只讀 TS golden，不重寫切段（D-61.T0-2） | Engineering | ~~T0 exit~~ |
| **OQ-61.5** 硬體與門檻 | ✅ **已收斂 2026-09-09** —— cohort 錄在 **240 Hz**，逐份條件 `meta.displayHz === 240`，禁止混合更新率（D-61.U3）。⚠️ 120／144 **不是矛盾**：120 = 資格閘地板、144 = KI-031 完全緩解點，兩者並存；**T0 只補依據、不改數字** | ~~使用者~~ | ~~T0 exit~~ |
| **OQ-61.6** n = 1 時的宣稱上限 | ✅ **已收斂 2026-09-09** —— 本操作者 × 本硬體 × 本 drill，一律 `research_only`；T4 零 importer 為終局狀態（D-61.U4） | ~~使用者 + 研究~~ | ~~T0 exit~~ |
| **OQ-61.7** `gapThresholdMs` 最終值 | 🔴 開放。**T0 刻意不凍結**，以 18／30／50 ms sweep 進 T3 | Engineering | T4 |
| **OQ-60.7**（承自 WP-60）長 drill 匯出體積政策 | 🔴 開放，**不阻塞本 WP**（協定限制單 run ≤ 120 s） | 使用者 + Engineering | 首次出現 > 200 s 的 `?rawMouse=1` run |

## 上游 handoff 覆核（WP-60 → WP-61）

| # | 交付物 | 狀態 | 本 WP 的用途 |
|---|---|---|---|
| 1 | 實機事件率分布 | ✅ p50 995 µs／≈1005 Hz；連續移動空洞上限 **18.2 ms**（n = 11，prior 非校準值） | θ sweep 的下界依據 |
| 2 | 抬起／停頓／一次到位的空洞長度分布 | ✅ **且結論為負面**（D-60.R2-1：範圍重疊） | T3 Layer 1 baseline 的預期值；四項具名限制是本 WP 設計要擋掉的東西 |
| 3 | PA 十四參數與語意抄本 | ✅ 含三個 px/s 空間參數的「需重推」標註 | T3 Layer 3／4 的換算起點（FR-61.10 記名） |
| 4 | OQ-60.4 構念歸屬結論 | ✅ **已於 2026-09-09 由使用者拍板**（D-61.U1：並存；新構念 = 感測器離地／sensor lift） | T1 的事件命名依據；T0 step 4 落成型別名與 `CONTEXT.md` 草稿。⚠️ WP-60 T-exit DoD 的「WP-61 handoff 四項齊備」未勾項可據此翻 ✅ |
| — | 高刷真人標註 cohort | 🟡 **硬體已就緒（240 Hz，D-61.U3）；資料仍不存在** | T1 交付儀器後由使用者錄製（T2）。`meta.displayHz ≠ 240` 即作廢，禁止與 60 Hz 混批 |
