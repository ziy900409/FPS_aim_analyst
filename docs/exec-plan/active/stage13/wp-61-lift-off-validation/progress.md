# WP-61 — progress.md

> Running log。Tech spec：[README.md](README.md) · Checklist：[task-checklist.md](task-checklist.md)

## 最新狀態

**⛔ T2 與 T3 皆判 `blocked-by-data`（2026-09-09）—— 唯一缺的是資料，不是程式。**

T2 與 T3 的儀器**全部落地並跑過**（逐份可用性覆核、標註完整性稽核、F3 檢定、Stage 1 golden 與逐位重現斷言、候選事件表、四層消融、session 隔離分割、凍結決策規則、seeded 可重現報表、兩支 operator 入口 + 一支 T3 入口）。缺的仍是 step 1：`?rawMouse=1&annotation=1` 的 240 Hz 真人 run **一份都還沒有**（錄製屬使用者操作）。

⚠️ **T3 判 `blocked-by-data` 不等於「分不開」** —— 本 WP 至今對可分性**未作任何宣稱**，也不得作。`not-reliably-separable` 要等資料與標註兩個閘都過才有資格產出。

⇒ **T4 不執行**（序列閘 ④）。cohort 錄好之後直接跑，不需要再寫程式：

```bash
npm run analyze:lift-cohort -- <匯出資料夾> --manifest <manifest.json>   # 判定：sufficient / blocked-by-data / annotation-channel-unusable
npm run record:lift-golden  -- <匯出資料夾> --manifest <manifest.json>   # Stage 1 golden
uv run python src/lift/notebooks/t2/build_candidate_table.py             # 候選事件表（research/）
uv run python src/lift/notebooks/t3/run_ablation.py --pair <golden>=<export> [--pair ...]   # 四層消融 + 判定
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
- **2026-09-09**：T3 可分性消融儀器完成，判定 `blocked-by-data`（cohort 仍不存在）。凍結檢核以逐段逐位 diff + sha256 證明 §Pre-registration 與 README §2.4 自 T0 未變。新增 `research/src/lift/algorithms/{features,pa_parameters,ablation}.py` 與 `notebooks/t3/run_ablation.py`；`golden.py` additive 補時間通道。兩個具名發現：PA 三個 `*_PX_S*` 參數名為誤稱（實作即在 counts 空間）、PA Stage 2 在 1 ms 取樣下算術上不可觸發。lift 套件 80 passed；typecheck／Vitest／build 與 T2 基線逐位相同。
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

## T3 separability ablation（2026-09-09）

### 判定：`blocked-by-data`（依 T0 凍結的決策規則字面條件）

T3 的核心產出是一個二元判定。**本輪判 `blocked-by-data`** —— 與 T2 同一個原因、同一份缺口：240 Hz 真人標註 cohort 仍不存在。（`~/Downloads` 內 2026-09-09 的六份 240 Hz 匯出經逐份檢查，`meta.mouseSampling` 皆為 `null`、`annotation` 事件 0 ⇒ 屬 WP-57／spider-shot 系列，**不是**本 WP 的 cohort。）

⚠️ **這不是「分不開」。** T3 task file 列的三種判定裡，`not-separable` 需要資料與標註兩個閘都過才有資格產出；本輪連第一個閘都沒過 ⇒ **本 WP 至今沒有、也不得對可分性作出任何宣稱**。T3 task file 的 `insufficient-evidence` 與 T0 凍結規則的 `blocked-by-data` 是同一個去向，措辭以凍結規則為準（D-61.T3-5）。

| T0 凍結規則（原文條件） | 實際值 | 判定 |
|---|---|---|
| independent sessions >= 2 | 1（合成 fixture） | ❌ |
| lift annotation intervals >= 30 | 8 | ❌ |
| pause annotation intervals >= 30 | 0 | ❌ |
| held-out lift intervals >= 10 | 0 | ❌ |
| held-out pause intervals >= 10 | 0 | ❌ |

⇒ **T4 不執行**（task-checklist 序列閘 ④）。cohort 錄好之後，T3 不需要再寫任何程式，直接跑：

```bash
uv run python src/lift/notebooks/t3/run_ablation.py --pair <golden.json>=<export.json> [--pair ...]
```

### Step 1 凍結檢核（T3 DoD 第一項）

`git log -p` 單獨用不夠 —— 它只證明「有沒有 commit 動過這個檔」，不證明**那一段**的內容未變（T1／T2 兩次都動過這兩個檔）。改以逐位比對兩個版本的該段落：

```bash
git show 6361c78:docs/.../progress.md | awk '/^### Pre-registration/{f=1} f{print} /^### Construct Naming/{if(f)exit}' > /tmp/prereg_t0.md
awk '/^### Pre-registration/{f=1} f{print} /^### Construct Naming/{if(f)exit}' docs/.../progress.md > /tmp/prereg_head.md
diff /tmp/prereg_t0.md /tmp/prereg_head.md   # 同法對 README §2.4（邊界為 §2.5）
```

| 段落 | T0 commit | HEAD | diff | sha256（HEAD） |
|---|---|---|---|---|
| progress.md §Pre-registration（19 行） | `6361c78` | `3a4c146` | **無差異** | `16b419640d1031be385d748c5fd7d8fd5a0017a76648dba1851e49353cd3da6f` |
| README.md §2.4 評估契約（21 行） | `6361c78` | `3a4c146` | **無差異** | `bc22fcb7986afad44da904521d8060520bfbb69be44c879f8b79467ecc1ea109` |

自 T0 起動過這兩個檔的 commit 為 `3175efd`（T1）與 `1097e70`（T2）；兩者的 diff **只新增 Decision Log／Surprises 條目**，未觸及任一凍結值。⇒ 凍結成立。

### 本輪實際交付：T3 的全部消融儀器 + 端到端驗證

比照 T2，也就是 D-60.T2-1 的同一模式：被 gate 阻塞時，先問「這個 task 的產出能不能變成解 gate 的儀器」。錄製之外的每一步都已落地並跑過。

| step | 交付物 | 狀態 |
|---|---|---|
| 1 凍結檢核 | 逐位比對 + 雜湊（見上） | ✅ |
| 2 Layer 1 gap-only baseline | `fit_gap_only()`：θ 為下限、門檻取觀測值全集，F1 最大者 | ✅ |
| 3 Layer 2 邊界運動學 | `features.py` 的十欄 `GapBoundaryKinematics` + `fit_boundary()`（單軸／單向／單門檻） | ✅ |
| 4 Layer 3 Stage 2 類比 | `spike_analogue()`（landing + takeoff 兩支都移植）+ 五欄換算表 | ✅ |
| 5 Layer 4 Stage 3 類比 | `hover_analogue()`（含 deadzone skip 與方向變異數） | ✅ |
| 6 消融紀律 | 逐層為前一層的**合取**；後層不得重擬前層門檻（測試釘死） | ✅ |
| 7 分割執行 | `split_sessions()` session 隔離、50/50、只在校準集擬合、held-out 只評一次 | ✅ |
| 8 可重現性 | seeded bootstrap（seed 61／2000 resamples）；報表不含 wall clock ⇒ 同 seed 逐位相同 | ✅ |
| 9 繪圖分層 | I/O 全在 `notebooks/t3/`；`algorithms/` 純函式（AST 掃描 + 突變驗證）。**不出圖**（D-61.T3-4） | ✅ |
| 10 二元判定 | `decide()` 逐字套用 T0 規則，附「規則原文 → 實際值 → 判定」三欄 | ✅ |

### Implementation Summary

| Area | Result |
|---|---|
| 邊界運動學 | `research/src/lift/algorithms/features.py`：`SampleBlock`（時間通道以整數 µs 累加，與 `segmentByTimeGap()` 同法）、`boundary_windows()`、`derive_gap_boundary_kinematics()`。`window_ms` 與 `tiny_counts` **無預設值**（比照 `gapThresholdMs`）。窗內樣本 < 2 時速度／加速度回 `None` 而非 0。 |
| golden／export 配對 | `assert_block_matches_golden()` 逐位比對 golden 內嵌的 `t0Ms`／`dtUs` 與 export 的 block。golden 有時間通道沒有 `dx`／`dy`，export 兩者都有 ⇒ 沒有這個檢查，讀錯配對只會安靜地產出看起來合理的數字。`golden.py` additive 補上 `t0_ms`／`dt_us`。 |
| 參數換算表 | `pa_parameters.py`：十項移植參數各帶「來源檔 + 版本 + 原空間 + 換算後值 + 換算依據」五欄；四項具名**不**移植並附後果。`counts_value()` 是下游唯一入口。 |
| 消融 | `ablation.py`：`score_candidates()`（**直接消費 T2 的 `build_candidate_table()`，不重新標籤**）、四層 `fit_layers()`／`evaluate_layers()`、`ConfusionMatrix`、`split_sessions()`、`assess_sufficiency()`、`promotion_checks()`、`decide()`、`bootstrap_f1_interval()`。 |
| operator 入口 | `research/src/lift/notebooks/t3/run_ablation.py` → `out/`（gitignored）下的 `lift-ablation-results.csv`（72 列 = 3 window × 3 θ × 4 layer × 2 split）、`lift-ablation-report.md`、`lift-ablation-timing.txt`。 |
| 空分母紀律 | precision／recall／F1／各組 FPR 在分母為 0 時一律回 `None`（報表印 `n/a`），且 `_threshold_check()` 把 `None` 判 **FAIL**。0.0 會讓一個從未量過的比率滿足凍結上限。 |

### 兩個必須寫進結論的發現

#### ① PA 的三個 `*_PX_S*` 參數命名是錯的 —— 它們本來就在 counts 空間

WP-60 的參數抄本把 `ACCEL_UP_THRESHOLD_PX_S2`／`START_SPEED_GATE_PX_S`／`HOVER_VELOCITY_THRESHOLD_PX_S` 標為「px/s 空間；須為 FPS 重推」。**讀實作而不是讀參數檔之後，這個標註不成立**：

```go
// backend/modules/input/infrastructure/lodclean/service.go @ 8e0d069
speeds[k] = math.Hypot(float64(p.DX), float64(p.DY)) / dtS   // p = domain.RawMousePoint
```

`RawMousePoint.DX/DY` 來自 `GetRawInputBuffer`（WM_INPUT）⇒ **原始 HID counts**；該模組內沒有任何 DPI 正規化。PA 的 ADR-002 自己從另一頭承認同一件事：「Deadzone threshold is counts-based — users with non-standard DPI may need manual config tuning」。

⇒ 換算是**改標籤而非改比例**：數值不變，單位由 px 更正為 counts。這個結論比看起來弱，兩個前提逐條記在 `pa_parameters.py` 的模組 docstring：① counts/s 正比於 CPI，而 **PA 的錄製 CPI 全庫未記載**；② 本專案「一個 sample = 一次裝置回報」只在觀測率貼合輪詢率時成立（T2 的凍結可用性閘已在管這件事，不符即作廢該 run）。

#### ② PA 的 Stage 2 在 1000 Hz 取樣下**在算術上永遠不會觸發**

landing 支需要 `accel > 350000` 且 `speed(k) <= 300`。`accel = Δspeed / dt` ⇒ 觸發需要 `Δspeed > 350000 × dt`；而速度非負且 `speed(k) <= 300` ⇒ `Δspeed <= 300`。

| 取樣間隔 | landing 需要的 Δspeed | takeoff 需要的 Δspeed（絕對值） | gate 允許的最大 Δspeed | 可觸發 |
|---:|---:|---:|---:|---|
| 1.000 ms（本 cohort 規格） | 350.0 | 1050.0 | 300.0 | **兩支都否** |
| 0.500 ms | 175.0 | 525.0 | 300.0 | landing 可 |
| 0.250 ms | 87.5 | 262.5 | 300.0 | 兩支皆可 |

⇒ **在本 cohort 的硬體上 Layer 3 的增益結構性地為 0**，而這與「邊界看起來很像」是**兩個不同的結論**，不得互相冒充。判定由 `stage_2_reachability()` 直接從參數算出（不需要資料）、逐份寫進報表，並由 `test_the_stage_2_rule_cannot_fire_at_this_cohort_s_sample_spacing` 釘死。實跑一致：合成 fixture 上 layer 3 把全部 8 個候選打成 FN（recall 0.0000）。

> **Stage 3 的物理前提尚未被檢定。** §1.4 預測 pause 期間的微顫可能低於感測器閾值 ⇒ `tinyFraction` 兩組皆 0；要檢定它需要真人 pause run 才有兩組可比。合成 fixture 的 `dx` 是腳本產生的斜坡，其 `tinyFraction` 不構成證據。此項留待 cohort 到位，**現在不得宣稱它成立或不成立**。

### 合成對照 fixture 的實跑輸出（T3 DoD）

`uv run python src/lift/notebooks/t3/run_ablation.py --pair fixtures/golden/lift-segments-synthetic-lift.json=fixtures/exports/synthetic_sensor_lift.json`：

```text
verdict: blocked-by-data -- Frozen data-sufficiency floors not met: independent sessions >= 2 (actual 1);
  lift annotation intervals >= 30 (actual 8); pause annotation intervals >= 30 (actual 0);
  held-out lift intervals >= 10 (actual 0); held-out pause intervals >= 10 (actual 0).
sessions: 1 (calibration ('synthetic-s1',), held-out ())
lift intervals 8, pause intervals 0
rows: 72; report sha256 dc3d71c23ce4a21f2279aeae887b2412bbd22e8772a50c8bfd0a10ff07ddd612
seed 61; full evaluation 0.02 s
```

消融表節錄（θ=30 ms、window=10 ms、calibration；held-out 為空集合故全 `n/a`）：

| layer | TP | FP | FN | TN | precision | recall | F1 | F1 gain |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| gap-only | 8 | 0 | 0 | 0 | 1.0000 | 1.0000 | 1.0000 | n/a |
| boundary | 8 | 0 | 0 | 0 | 1.0000 | 1.0000 | 1.0000 | 0.0000 |
| spike-analogue | 0 | 0 | 8 | 0 | n/a | 0.0000 | n/a | n/a |
| hover-analogue | 0 | 0 | 8 | 0 | n/a | 0.0000 | n/a | n/a |

⚠️ **這張表不是證據，一格都不是。** 合成 fixture 只有 lift 一類、空洞由腳本擺放、`dx` 是 `(index % 3) - 1` 的斜坡 ⇒ 沒有負例、沒有真人運動學。它證明的只有兩件事：管線會跑，以及 layer 3 的歸零與上面的算術預測一致。

### Verification

| Gate | Command | Result |
|---|---|---|
| lift 套件 Python | `uv run pytest src/lift -q` | exit 0；**80 passed**（T2 基線 19 ⇒ +61，全部來自本切片）。 |
| 全量 Python | `uv run pytest`（`research/`） | **522 passed / 5 failed**。5 紅**全部不是本切片造成** —— 以 `git stash` 移除全部 `lift/` 變更後同樣紅（見 Surprises 6）。lift 相關 0 紅。 |
| 可重現性（NFR-61.5） | 同 seed 連跑兩次，`sha256sum out/lift-ablation-report.md` | 兩次皆 `dc3d71c23ce4a21f2279aeae887b2412bbd22e8772a50c8bfd0a10ff07ddd612` ⇒ 逐位相同。CSV `02933b4af2923d48cba2b34815482dc97143a71f89a2ff2aa31304bd558acc03`。 |
| 全量評估耗時 | `out/lift-ablation-timing.txt` | **0.02 s**（1 run、72 列）。含程序啟動的 wall-clock 為 0.74 s。 |
| 突變驗證 ① F5 字面掃描 | 在 `candidates.py` 插入 `_UNCONVERTED = 350000.0` | expected red：1 failed／11 passed。還原後綠。 |
| 突變驗證 ② F5 名稱掃描 | 在 `candidates.py` 插入註解形式的來源參數名 | expected red：1 failed／11 passed。還原後綠。 |
| 突變驗證 ③ C-D2 | 在 `ablation.py` 插入 `print()` | expected red：`test_algorithms_do_not_print_or_write_files` 1 failed／3 passed。還原後 4 passed。 |
| Typecheck ×2 | `npm.cmd run typecheck` | exit 0。 |
| 全量 Vitest | `npm.cmd test` | exit 0；**252 passed／1 skipped files；2822 passed／2 skipped tests** ⇒ **與 T2 基線逐位相同**（本 task 未動 `src/`，符合 DoD 預期）。 |
| Build | `npm.cmd run build` | exit 0；Vite 2.00 s，既有 chunk-size warning。 |

全量 Playwright 未在本切片跑：T3 未動任何 runtime 程式碼（變動全在 `research/`），package-level 五閘於 T-exit 補齊。

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
| **D-61.T3-1** | 2026-09-09 | **PA 的三個 `*_PX_S*` 參數以「改標籤不改比例」移植，依據是實作而非參數名。**<br>WP-60 的抄本依**參數名**判定三者在 px/s 空間、須重推。讀 `lodclean/service.go` 後發現名稱是誤稱：`speeds[k] = hypot(p.DX, p.DY)/dtS`，其中 `p` 是 `RawMousePoint`，來自 `GetRawInputBuffer`（WM_INPUT）⇒ 原始 HID counts，該模組全程無 DPI 正規化；PA 的 ADR-002 亦自承 deadzone 是 counts-based 且對 DPI 敏感。⇒ 數值不變、單位由 px 更正為 counts。<br>**這個結論的兩個前提逐條入帳，不得隱含**：① counts/s 正比於 CPI，而 **PA 的錄製 CPI 全庫未記載** ⇒ 移植是 CPI-conditioned；② 「一個 sample = 一次裝置回報」只在觀測率貼合輪詢率時成立，由 T2 既有的可用性閘（active rate ≥ 500 Hz、`overflow === false`）承接，不符即作廢該 run。<br>**Alternatives considered**：(a) 照參數名當 px 空間、以 DPI 換算成 counts —— 會憑空引入一個 800/PA-CPI 的比例因子去修正一個不存在的單位差，正是 F5 描述的「靜默錯一個數量級」，只是方向相反，駁回；(b) 因為 PA 的 CPI 未知就整組不移植 —— 那 Layer 3／4 不存在，FR-61.6 的四層消融交不出來，駁回；(c) 移植但不記 CPI 前提 —— 換一台滑鼠就會安靜地失準，駁回。 | Engineering | [`pa_parameters.py`](../../../../../research/src/lift/algorithms/pa_parameters.py) 模組 docstring 與十筆 `ReferenceParameter.basis`；`test_pa_parameters.py`（14 cases）；`performance_analysis` `service.go` @ `8e0d069`、`lod_v3_default_config.json` @ `ff24223`、ADR-002 @ `e9c5c40` |
| **D-61.T3-2** | 2026-09-09 | **Stage 2 的兩支（landing／takeoff）都移植，且其「在 1 ms 取樣下不可觸發」以純參數推導 `stage_2_reachability()` 具名報出，而不是等實跑出 0 才發現。**<br>landing 需 `accel > 350000` 且 `speed(k) ≤ 300`；`accel = Δspeed/dt` ⇒ 需 `Δspeed > 350000×dt = 350`（dt = 1 ms），而 gate 把 `Δspeed` 上限壓在 300（速度非負）⇒ 兩個條件互斥。takeoff 更嚴（×3）。0.5 ms 時 landing 打開、0.25 ms 時兩支都打開 ⇒ **是取樣間隔關門，不是參數移錯**。<br>為什麼一定要分開報：Layer 3 增益 0 有兩種完全不同的成因 ——「規則不可能觸發」與「邊界真的很像」。前者是關於**參數與硬體**的結論，後者才是關於**可分性**的結論。若只看實跑數字，兩者長得一模一樣，而 T-exit 會把前者寫成後者。<br>**Alternatives considered**：(a) 只移植 landing 支 —— takeoff 是同一條 stage 2 規則的一半，少移植會讓「類比」名不副實，且會弱化上述算術結論，駁回；(b) 調整門檻讓它在 1 ms 下可觸發 —— 那是把 PA 的 prior 換成本輪自訂值，且是在看過資料前就動門檻，違反 GD-20／D-61.P6，駁回；(c) 只在報表寫一句「layer 3 無增益」—— 不可歸因，正是 R3 要防的事，駁回。 | Engineering | [`ablation.py`](../../../../../research/src/lift/algorithms/ablation.py) `spike_analogue()`／`stage_2_reachability()`；`test_ablation.py` / `test_the_stage_2_rule_cannot_fire_at_this_cohort_s_sample_spacing`；報表 §Stage 2 reachability |
| **D-61.T3-3** | 2026-09-09 | **四層各自的「可擬合量」明訂：Layer 1 擬一個門檻、Layer 2 擬「單軸 + 單向 + 單門檻」、Layer 3／4 一個參數都不擬（只套 PA prior）。後層一律為前層的合取，不得回頭重擬。**<br>T0 凍結了指標與門檻，但**沒有凍結每層的模型形狀**；不訂死它，R4（特徵 8+ 維、事件數數十）就由實作的胃口決定。單軸單門檻是「還算誠實的擬合」的上限；Layer 3／4 不擬合，正好使 FR-61.6 的問題（「加上 PA 的規則有沒有幫助」）成為一個乾淨的對照，而不是又一次調參。<br>合取形式的兩個後果都是想要的：recall 只能降 ⇒ 每層的增益就是它自己買到的 precision；且「第 N 層放行了第 N-1 層擋掉的候選」在結構上不可能發生 ⇒ 逐層歸因成立（T3 step 6）。<br>**Alternatives considered**：(a) 每層自由重擬全部參數 —— 增益不可歸因，且等於在 30 事件上擬 8 維，駁回；(b) Layer 2 用多軸線性／樹模型 —— 在 n≈30、維度 8 的條件下必然過擬合，且 T4 要移植成 TS 純函式判準會極為笨重，駁回；(c) Layer 3／4 也在校準集上重擬 PA 門檻 —— 那就不是「Stage 2／3 類比」而是「用 PA 的變數名重新校準一套新規則」，FR-61.6 問的問題會消失，駁回。 | Engineering | [`ablation.py`](../../../../../research/src/lift/algorithms/ablation.py) `fit_layers()`／`LayerRule.predict()`；`test_ablation.py` 的 `test_each_layer_is_a_conjunction_so_recall_can_only_fall`／`test_a_later_layer_never_re_fits_an_earlier_layer_s_threshold` |
| **D-61.T3-4** | 2026-09-09 | **T3 step 9 的「分布圖／ROC-PR 曲線」本輪不產出，只落實它的分層規則。**<br>step 9 的規範內容是**放哪裡**（圖進 `notebooks/`、`algorithms/` 保持純）——這一條已由 `notebooks/t3/run_ablation.py` 與 AST 掃描落實。至於圖本身：repo 沒有任何繪圖相依（`pyproject.toml` 只有 numpy／pandas／scipy；matplotlib 在全 repo 只出現在**禁止 import 的掃描名單**裡），而本輪唯一可畫的資料是一份 8 筆、單類別、`dx` 為腳本斜坡的合成 fixture。⇒ 為了畫一張「什麼都沒有的分布」而新增一個相依，成本與誤導都是實的。<br>**Alternatives considered**：(a) 加 matplotlib 相依並畫合成 fixture 的分布 —— 那張圖會被當成 lift/pause 分布圖引用，而它沒有 pause，駁回；(b) 用 ASCII 直方圖代替 —— 同樣是畫一份非證據的資料，且沒有既有慣例，駁回。<br>**觸發重做的條件**：真人 cohort 到位時，圖與相依一起加，落點就在 `notebooks/t3/`。 | Engineering | `research/pyproject.toml`；`test_purity.py` / `test_importing_the_algorithms_pulls_in_no_plotting_and_touches_no_cwd` |
| **D-61.T3-5** | 2026-09-09 | **判定措辭以 T0 凍結規則為準：資料不足 = `blocked-by-data`，不用 T3 task file 的 `insufficient-evidence`。**<br>T3 task file 的 step 10 寫三選一為 `promote`／`not-separable`／`insufficient-evidence`；T0 §2.4 的決策規則寫四個去向 `promote`／`not-reliably-separable`／`blocked-by-data`／`annotation-channel-unusable`。兩份文件指的是同一組去向，只是 task file 少了 `annotation-channel-unusable` 且用詞不同。凍結的是 §2.4 ⇒ 以它為準，並在此註明對應關係，避免日後被讀成兩套判定。<br>**同時明訂順序**：標註通道不可用 → 資料不足 → 逐層門檻，前兩者**在看任何一層之前**決定。理由：在標籤髒或資料不足的母體上算出來的指標不是關於可分性的證據，把它寫成 `not-reliably-separable` 是一個資料支撐不了的宣稱（F2／R3）。<br>**Alternatives considered**：(a) 用 task file 的措辭 —— 會讓帳本上出現第二套判定名，正是 C-D4 型的問題，駁回；(b) 資料不足時仍報逐層數字並判 `not-reliably-separable` —— 見上，駁回（數字仍照報，但**不參與判定**）。 | Engineering | [`ablation.py`](../../../../../research/src/lift/algorithms/ablation.py) `VERDICTS`／`decide()`；`test_ablation.py` / `test_the_verdict_is_blocked_by_data_when_a_floor_is_missed_even_if_a_layer_looks_perfect`、`test_an_unusable_annotation_channel_short_circuits_before_any_layer_is_looked_at` |
| **D-61.T3-6** | 2026-09-09 | **邊界窗的兩端不對稱：before 為閉區間 `[start−w, start]`（含 `beforeIndex`），after 為左開區間 `(end, end+w]`（**排除** `afterIndex`）。**<br>`afterIndex` 那一筆樣本的 `dtUs` **就是空洞本身**，它的 `dx`／`dy` 是整段空洞累積的位移。把它當成「空洞之後的樣本」會把空洞自己的位移折進離開輪廓，並讓每一個 `speed_after` 因除以空洞長度而結構性地趨近 0 —— 於是 `accel_exit` 實際上在量空洞長度，而那正是 WP-60 已經判定分不開的那個軸（D-60.R2-1）。<br>代價已知：`density_after` 因此少算那一筆。以**名目窗長**（而非觀測跨距）作分母，讓「樣本稀疏」與「窗比較短」在數字上分得開。<br>**Alternatives considered**：(a) 兩端都閉、把 `afterIndex` 算進去 —— 見上，會讓 layer 2 悄悄退化成 layer 1，駁回；(b) 把 `afterIndex` 算進 `n_after`／`tiny_fraction` 但排除在速度之外 —— 同一個窗有兩種成員資格，難以稽核也難以在 T4 對表，駁回。 | Engineering | [`features.py`](../../../../../research/src/lift/algorithms/features.py) `boundary_windows()`；`test_features.py` / `test_the_after_window_excludes_the_sample_that_spans_the_gap` |
| **D-61.T3-7** | 2026-09-09 | **T3 不重新標籤：`score_candidates()` 直接消費 T2 的 `build_candidate_table()`，只把特徵掛上去。**<br>T2 已經測過凍結的匹配規則（含 D-61.T2-1／T2-3 兩個適用範圍判斷）。T3 若自己再跑一次配對，就是同一個構念的第二套定義（C-D4），也是一個讓標籤悄悄沾上特徵的地方（FR-61.3）。<br>連帶：`golden.py` additive 補 `t0_ms`／`dt_us`，`features.assert_block_matches_golden()` 逐位比對 golden 的時間通道與 export 的 block —— golden 有時間沒有 `dx`／`dy`，export 兩者都有，配錯了不會報錯，只會產出看起來合理的數字。<br>**Alternatives considered**：(a) T3 自行配對以避免相依 T2 的私有函式 —— 兩套配對，駁回；(b) 只靠 `runId` 字串配對 golden 與 export —— 檔名可改、runId 可重複，且錯配無聲，駁回。 | Engineering | [`ablation.py`](../../../../../research/src/lift/algorithms/ablation.py) `score_candidates()`；[`features.py`](../../../../../research/src/lift/algorithms/features.py) `assert_block_matches_golden()`；`test_ablation.py` / `test_scoring_reuses_the_frozen_candidate_table_rather_than_relabelling` |

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

6. **PA 的 Stage 2 規則在 1 ms 取樣下不可能觸發 —— 而我差一點把它當成「邊界分不開」的證據。**（2026-09-09，T3）
   Layer 3 在合成 fixture 上把全部 8 個候選打成 FN、recall 0.0000。第一反應是「這一層沒有幫助」，那是關於**可分性**的結論。回頭算它為什麼不觸發才發現，那是關於**算術**的結論：landing 支要求 `accel > 350000` 且 `speed(k) ≤ 300`，而 `accel = Δspeed/dt`，dt = 1 ms 時前者要求 `Δspeed > 350`，後者（速度非負）把 `Δspeed` 上限壓在 300 —— 兩個條件在任何資料上都互斥。取樣間隔減半（0.5 ms）landing 就打開，減到 0.25 ms 兩支都打開。
   ⇒ 兩種成因在報表上長得**一模一樣**（同一個 0），而寫進 T-exit 的意思天差地遠：一個是「PA 的門檻與本硬體的取樣率不相容」，一個是「抬滑鼠與停頓的邊界真的很像」。後者是本 WP 唯一要回答的問題，前者根本不是關於它的證據。
   ⇒ 處置：把它做成 `stage_2_reachability()`，**從參數推導、不看資料**，每份報表都印。這樣「這一層為什麼是 0」不需要任何人再回頭算一次。
   ⇒ 與 Surprises 4 同型：那次是綠燈的**範圍**沒被驗證，這次是紅燈的**成因**沒被驗證。exit code 與混淆矩陣都只給結果，不給原因。

7. **參數的名字說了謊，而 WP-60 的抄本（包括我自己讀它時）照著名字信了。**（2026-09-09，T3）
   `ACCEL_UP_THRESHOLD_PX_S2`／`START_SPEED_GATE_PX_S`／`HOVER_VELOCITY_THRESHOLD_PX_S` 三個名字裡有 `PX`，WP-60 的參數抄本因此把它們標成「px/s 空間；須為 FPS 重推」，而 F5／R7 整條風險線都建立在這個判讀上。實際讀 `lodclean/service.go` 才發現：`speeds[k] = hypot(p.DX, p.DY)/dtS`，`p` 是 `RawMousePoint`，欄位直接來自 `GetRawInputBuffer`（WM_INPUT）—— **原始 HID counts，全模組沒有一處 DPI 正規化**。PA 的 ADR-002 從另一頭承認了同一件事（deadzone 是 counts-based、對 DPI 敏感），只是沒有人把兩邊放在一起讀。
   ⇒ 若照名字「重推」，我會憑空乘上一個 `800 / PA的CPI` 的比例因子去修正一個**不存在**的單位差 —— 那正是 F5 描述的「靜默錯一個數量級」，只是方向相反。防 F5 的動作本身會製造 F5。
   ⇒ **教訓**：跨 repo 移植常數時，權威是**使用該常數的那一行程式碼**，不是常數的名字，也不是別人抄本裡的空間標註。這次連帶也修正了 WP-60 抄本引用的路徑（`contracts/modules/input/…` 已不存在，追蹤中的副本在 `research/src/modules/input/algorithms/config/`）。
   ⇒ 與 Surprises 1 同型：那次是把兩個各有依據的數字當成矛盾，這次是把一個沒有依據的標註當成事實。兩次都是**沒有回到來源**。

8. **`uv run pytest` 全量有 5 個紅燈，全部與本切片無關 —— 但 T2 的紀錄說它當時 exit 0。**（2026-09-09，T3）
   全量 `uv run pytest`：522 passed / **5 failed**。其中 1 個是我的（F5 名稱掃描擋下 `ablation.py` 用 `counts_value("…")` 查表，已修為允許這條唯一的合法查表路徑）。另外 4 個在 `modules/kinematics`（`test_committed_sg_coefficients_match_generator`、`test_committed_omega_fixtures_match_generator`）、`modules/metrics`（`test_the_committed_verdict_for_one_session_reproduces_bit_for_bit_from_the_seed`）、`modules/segments`（`test_committed_real_segment_fixtures_match_generator`），全部是 committed golden 與現場重算在**浮點末位**上的差異（例：`-0.08391608391608422` vs `-0.08391608391608417`）。
   以 `git stash push -u -- research/src/lift/` 把本切片的全部變更移開後重跑，同樣紅 ⇒ **先於本切片存在**。`modules/*` 也沒有任何一處 import `lift`。
   ⇒ 這是 C-D5（晉升指標雙實作對表）的 golden 漂移，落在 WP-32／GD-21 的範圍，不是 T3 能就地修的：重新產生 golden 等於改一組晉升指標的權威值，那需要它自己的具名決策。
   ⇒ **未修，已具名**。T-exit 的「`uv run pytest` exit 0」不能靠本切片達成 —— 要嘛先處理這 4 個漂移，要嘛在 T-exit 明文寫「4 紅先於 WP-61 存在、歸屬 WP-32」。**不得**含糊寫成「Python 全綠」。

## Open Questions（狀態）

| ID | 狀態 | Owner | Deadline |
|---|---|---|---|
| **OQ-61.1**（= OQ-60.4）構念歸屬：取代還是並存？各叫什麼？ | ✅ **已收斂 2026-09-09** —— 並存但語意分離；新構念 = **感測器離地（sensor lift）**（D-61.U1）。T0 只需落成型別／檔名與 `CONTEXT.md` 草稿 | ~~使用者 + 研究~~ | ~~T0 exit~~ |
| **OQ-61.2** 標註通道形式：自報鍵／第二人／兩者 | ✅ **已收斂 2026-09-09** —— 自報鍵 + block 冗餘（D-61.U2）。⚠️ 附帶宣稱界線：支撐事件級匹配、**不**支撐起點精度 | ~~使用者~~ | ~~T0 exit~~ |
| **OQ-61.3** 標註鍵 code | ✅ **T0 收斂** —— `KeyL`（D-61.T0-2） | Engineering | ~~T1 凍結前~~ |
| **OQ-61.4** 實作落點與 C-D5 觸發時機 | ✅ **T0 收斂** —— T2/T3 Python `research/src/lift/`；T4 條件式 TS `src/metrics/sensorLiftCriterion.ts`；Stage 1 只讀 TS golden，不重寫切段（D-61.T0-2） | Engineering | ~~T0 exit~~ |
| **OQ-61.5** 硬體與門檻 | ✅ **已收斂 2026-09-09** —— cohort 錄在 **240 Hz**，逐份條件 `meta.displayHz === 240`，禁止混合更新率（D-61.U3）。⚠️ 120／144 **不是矛盾**：120 = 資格閘地板、144 = KI-031 完全緩解點，兩者並存；**T0 只補依據、不改數字** | ~~使用者~~ | ~~T0 exit~~ |
| **OQ-61.6** n = 1 時的宣稱上限 | ✅ **已收斂 2026-09-09** —— 本操作者 × 本硬體 × 本 drill，一律 `research_only`；T4 零 importer 為終局狀態（D-61.U4） | ~~使用者 + 研究~~ | ~~T0 exit~~ |
| **OQ-61.7** `gapThresholdMs` 最終值 | 🔴 開放。**T0 刻意不凍結**；T3 的消融已把三個 θ 全部接上（每個 θ × 3 window × 4 layer × 2 split 各出一組數字），但因 `blocked-by-data` 尚無資料可選值 | Engineering | T4 |
| **OQ-60.7**（承自 WP-60）長 drill 匯出體積政策 | 🔴 開放，**不阻塞本 WP**（協定限制單 run ≤ 120 s） | 使用者 + Engineering | 首次出現 > 200 s 的 `?rawMouse=1` run |

## 上游 handoff 覆核（WP-60 → WP-61）

| # | 交付物 | 狀態 | 本 WP 的用途 |
|---|---|---|---|
| 1 | 實機事件率分布 | ✅ p50 995 µs／≈1005 Hz；連續移動空洞上限 **18.2 ms**（n = 11，prior 非校準值） | θ sweep 的下界依據 |
| 2 | 抬起／停頓／一次到位的空洞長度分布 | ✅ **且結論為負面**（D-60.R2-1：範圍重疊） | T3 Layer 1 baseline 的預期值；四項具名限制是本 WP 設計要擋掉的東西 |
| 3 | PA 十四參數與語意抄本 | ✅ 已交付，但其中一項標註**經 T3 覆核為錯**：三個 `*_PX_S*` 參數的「px/s 空間、需重推」是依參數**名**判定的，實作顯示它們本來就在 counts 空間（D-61.T3-1／Surprises 7）。抄本引用的 config 路徑亦已失效，追蹤中的副本在 `research/src/modules/input/algorithms/config/` | T3 Layer 3／4 的換算起點（FR-61.10 記名），以 `pa_parameters.py` 的五欄表為權威 |
| 4 | OQ-60.4 構念歸屬結論 | ✅ **已於 2026-09-09 由使用者拍板**（D-61.U1：並存；新構念 = 感測器離地／sensor lift） | T1 的事件命名依據；T0 step 4 落成型別名與 `CONTEXT.md` 草稿。⚠️ WP-60 T-exit DoD 的「WP-61 handoff 四項齊備」未勾項可據此翻 ✅ |
| — | 高刷真人標註 cohort | 🟡 **硬體已就緒（240 Hz，D-61.U3）；資料仍不存在** | T1 交付儀器後由使用者錄製（T2）。`meta.displayHz ≠ 240` 即作廢，禁止與 60 Hz 混批 |
