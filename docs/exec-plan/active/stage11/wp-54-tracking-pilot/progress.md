# WP-54 — Progress / Decision Log

## Status

- **Current**：✅ T0、T1、T2、T3 完成（2026-09-02）；T4（eligibility/evidence/report）進行中——slice 1/6（closed `TrackingQualityReason` vocabulary + `evaluateTrackingRunEligibility()`）已完成。
- **Scope state**：已正式納入 stage11（見 [../README.md](../README.md)、[../task-checklist.md](../task-checklist.md)、[../progress.md](../progress.md)）。M20 為本 WP 里程碑。
- **Dependency state**：`tracking_v1`/`tracking_longrange_v1`/`tracking_br_v1` baseline 綠燈（見下方 verification log）；OQ-54-1~OQ-54-8 全數凍結（見 §1.4 與下方 decision log）。

## Progress

### 2026-09-02 — T4 slice 1/6：closed `TrackingQualityReason` vocabulary + `evaluateTrackingRunEligibility()`

- **落點**：新檔 `src/pilot/trackingRunEligibility.ts`（README §2.4 `TrackingRunEligibility`/
  `evaluateTrackingRunEligibility()` 逐字實作）+ `src/pilot/trackingRunEligibility.test.ts`（13
  tests：eligible fixture 1 條、每個 FR-54-10 類別至少 1 條 fixture、外加「同時觸發兩個 overflow
  reason 不短路」與「prep 窗內的問題不誤判進 scored 窗」兩條邊界 fixture）。`src/pilot/` 目錄本次起用
  （WP-52 `peekClickTransferPilotEvidence.ts` 之外第二個檔案），T4 其餘檔案（compatibility key/
  evidence/report）陸續加入同目錄，而非全部塞進單一 `trackingPilotEvidence.ts`——README §2.2 只列了
  這一個檔名當落點候選，但 T4 範圍（eligibility 判定 + WP-54 專屬 compatibility key + JSON evidence
  model + 自足 HTML report）遠比 WP-52 那支 81 行的純聚合函式大，拆檔以維持單一職責、可個別測試。
- **run-level vs metric-level 雙層閉列舉（不得混用）**：本檔的 `TrackingQualityReason`（run-level，
  8 碼）與 T3 `trackingDynamics.ts` 的 `TrackingDynamicsResult.status:'blocked'` 5 碼原因是**兩個獨立
  命名空間**——刻意選了不同字串（例如 run-level 用 `missing-target-position`，metric-level 用
  `missing-target-telemetry`）避免兩層在字面上疊在一起造成「這是同一件事」的錯覺。README §2.4 已把
  兩者定義成兩個不同型別（`TrackingRunEligibility` vs `TrackingDynamicsResult`），本檔只是延續。
- **8 碼收斂設計**（FR-54-10 五大類別 → 8 個具體 reason code，一次定案、封閉列舉）：
  - overflow → `recorder-overflow`（`meta.recorderOverflow`）、`input-buffer-overflow`
    （`meta.bufferOverflow`）。
  - missing target → `missing-target-position`（scored 窗內〔`t >= scoredStartMs`〕任一 tick
    `tx`/`ty`/`tz` 為 `null`；prep 窗內的 null 不算，見 fixture「does not flag a null target position
    that only occurs inside the prep window」）。
  - timestamp → `non-monotonic-timestamps`（依 **匯出原始陣列順序**逐一比較 `ticks[i].t <=
    ticks[i-1].t`，不對輸入先 `sort()`——`trackingDerivation.ts`/`trackingDynamics.ts` 等下游消費者都會
    自己 `slice().sort()`，那是它們的權利；但這裡要抓的正是「原始寫入順序本身出了 bug」，先排序會把
    這個訊號洗掉）。
  - coverage → `insufficient-scored-coverage`（`validScoredTicks / expectedTickCount < 99.5%`，
    `expectedTickCount = round(durationMs / (1000/simHz)) + 1`；`durationMs<=0` 时视为
    `actualTickCount>0 ? 1 : 0`，避免「0 除以 0 通过」的假陽性)。
  - protocol mismatch → 拆成三個更具體的 reason，而非單一 `protocol-mismatch`：
    `missing-scored-start`（完全没有 `scored_start` 事件——代表这份匯出根本不是 WP-54 scored pilot
    run，直接短路回傳，不再检查 target-position/coverage，因为没有 scored 窗可检查）、
    `unsupported-schema-version`（`meta.schemaVersion !== 2`，defense-in-depth——`parseExportPayload`
    理论上已挡，但比照 `DrillMetricRegistry.project()` 的 defense-in-depth 惯例再挡一次）、
    `unrecognized-tracking-trajectory`（`meta.spawn.trackingTrajectory` 缺席或其 `kind` 不在
    `{band-limited-2d-v1, reversal-2d-v1}`——因为它是 opaque `unknown` pass-through〔T2 设计〕，这里只做
    浅层 `kind` 白名单检查，不深验其余栏位，深验留给 `trackingTrajectory.ts` 自己的建构期 guard）。
- **不短路,收集全部 reasons**：除了「完全没有 `scored_start`」这一支（没有 scored 窗，target-position/
  coverage 两项检查语意上无法进行,直接回传单一 reason)以外,其余检查互相独立、全部执行完才回传——
  fixture「collects both overflow reasons at once」直接锁住这个契约（README/checklist 明讲
  `reasons: readonly TrackingQualityReason[]`，不是单一 reason）。
- `npx tsc --noEmit` exit 0；`npx vitest run src/pilot/trackingRunEligibility.test.ts` 13/13 passed；
  `npx vitest run`（全专案）195 files / 1857 tests passed（2 skipped），对照 T3 收尾的 194/1844 基准，
  新增 1 个档案、13 个测试，无回归。

### 2026-09-02 — T3：canonical P0/P1 metrics/truth fixtures（T3 完成）

- **落點**：新檔 `src/metrics/trackingDynamics.ts`（`deriveTrackingDynamics()` — README §2.4 interface
  逐字實作 — 加上額外 additive export `deriveTrackingReversalWindows()`，見下方決策）+
  `src/metrics/trackingDynamics.test.ts`（19 tests，8 條 truth fixture 全覆蓋）。`docs/operational/
  analysis-tracking.md` 新增「P1 — Tracking Pilot Dynamics」章節（公式/容差/blocked 語意/版本字串）。
- **P0 重用（不改 `trackingDerivation.ts`）**：`adaptPayloadForScoredWindow()` 建一份 shallow-copy
  `ExportPayload`——把每個 `visible` event 的 `t`/target 位置換成同 `targetId` 的 `scored_start`
  event 的 `t`/位置，再呼叫未修改的 `deriveTrackingMetrics()`/`deriveTrackingSamples()`。11 個既有
  caller 的 blast radius維持 0；無 `scored_start` 事件的匯出（如既有 legacy tracking 匯出）原樣通過,
  退回 plain `visible`-windowed P0（寬容,非錯誤）。專用 fixture（`dropRecoveryPayload` +
  「scored_start windowing」test）證明 prep 窗內的 drop/reacquire 不會漏進 scored 窗分析。
- **target/aim angular kinematics**：aim 端讀 `ticks[].dYaw`/`dPitch`（KI-005 tick 窗積分),不對
  `aim.yaw/pitch` 做差分——同 `angularKinematics.ts` `omegaDegPerSec()` 的 render/sim beat-aliasing
  規避理由。target 端用 `aimForward()` 的代數反函式（`yaw=atan2(-dx,-dz)`、`pitch=asin(dy)`)算出
  implied yaw/pitch,逐 tick 差分後把角度差 wrap 進 `[-180,180]`（band-limited/reversal trajectory
  可能跨 ±180° 縫）。兩序列皆從相鄰 tick pair 算出（首個 tick 無樣本,同 `omegaDegPerSec` 慣例）。
- **lag search / gain / residual**：`corr(omega_target(t), omega_aim(t+tau))` 對 `tau` 在
  `lagSearchMs`（凍結 `[0,250]ms`,D-54.5）內以整數 tick 步進搜尋；peak 挑選用「每個候選 `k` 的平均
  dot product」（避免搜尋邊界附近 overlap 樣本數略減造成的偏誤),`gain`/`rmse` 則用選定 `k_hat` 的
  **加總** dot product（與 README 公式的 `sum(...)/sum(...)` 形狀一致——同一 index range 上 sum 與
  mean 只差一個常數,對挑 peak 與算 gain 分開處理不影響結果一致性）。
- **ambiguity gate**：收集 mean-correlation-vs-tau 曲線的所有 local peak,若次高峰值超過
  `1/correlationAmbiguityRatio` 倍最高峰值,回傳 `lag-peak-ambiguous`（不得靜默回傳單一 lag/gain,
  README 風險表「Lag 多峰仍回傳單值」）。週期性 fixture（10Hz 純正弦,`[0,250]ms` 內出現 3 個相近
  峰值)驗證此路徑。
- **directional bias**：`signedYawBiasDeg`/`signedPitchBiasDeg` = post-acquisition 窗內
  `wrap(aim_angle_deg(t) - target_angle_deg(t))` 的平均值,兩軸分開回報,不 normalize 成單一分數。
- **recovery aggregation**：重用 `deriveTrackingTransitions()`（未修改,spider-shot 共用函式）取得
  `dropCount`/`reacquireMs`；`completedReacquireCount = reacquireMs.length`,
  `terminalDropCount = dropCount - reacquireMs.length`（`dropCount` 本就含未恢復的終端 drop,
  `reacquireMs` 本就排除它——相減即得終端計數,零額外掃描、零重複計數風險）。`longestOffTargetMs`
  另掃 on/off-target transition 找最長連續離線 run（含跑到窗尾仍未恢復的開放式 run），獨立欄位、
  絕不併入 `reacquireMs`/`completedReacquireCount`。
- **reversal event windows（FR-54-9,additive function）**：README §2.4 的 `TrackingDynamicsResult`
  沒有 reversal 專屬欄位（介面逐字凍結,不得加欄）——故 response latency/peak error/overshoot/
  settling time 落在新 export `deriveTrackingReversalWindows()`,以 `target_motion_change` event 為
  窗界（見下方決策 D-54.14）。純 pursuit block（零 `target_motion_change`）回傳 `windows: []`,
  視為正常/空,非 blocked 狀態。窗界排除 `'overlap'`（與前一次變化間隔 `< minBaselineMs`）與
  `'insufficient-window-data'`（可用窗長 `< minWindowMs`,含 run 尾端沒有足夠真實 tick 的情形——
  `presentation.windowEndMs` 在單目標 run 下恆為 `Infinity`（無後續 `visible` event）,必須另外以最後
  一筆真實 sample 的 `t` 夾住,否則「窗尾空間不足」的排除規則會失效,見下方 D-54.15）都計數、不靜默丟棄。
- **offline fixed-coefficient smoothing（`smoothingVersion`,D-54.5）**：`applySmoothingToSeries()`
  對 4 條 omega 分量套用版本化 FIR kernel（僅用於 lag search 輸入,不影響 bias 用的原始角度）;未知
  `smoothingVersion` fail fast（同 `trackingTrajectory.ts` 未知 `kind` 的紀律）。目前註冊
  `tracking-dynamics-smoothing-v1-none`（identity,truth fixture 預設,保持可精確追溯）與
  `tracking-dynamics-smoothing-v1-tri3`（對稱三點三角 FIR）。
- **8 條 truth fixture**：perfect follower（NFR-54-3：`rmsEpsilonDeg<1e-6`、`totPercent=100`、
  `lagMs≈0`、`gain≈1`）；fixed lag（NFR-54-2：`abs(estimated-truth)<=1000/simHz`——**25 秒**合成窗
  （非最初嘗試的 400 tick/3.1s——實測以 400 tick 合成窗跑同一 fixture,recovered lag 誤差達 5
  tick/39ms,遠超 1-tick 容差;改成 25 秒後誤差收斂到剛好 1 tick/7.8ms,壓線通過——才能讓多頻正弦訊號
  的有限窗 cross-correlation 邊界效應收斂到一個 tick 誤差內,恰好對齊 D-54.4 真實 scored block 長度）；
  known gain
  `0.7/1.0/1.3`（`abs(gain-truth)<=0.02`）；never acquire（P1 `blocked:'no-acquisition'`,P0
  `acquisitionFailureRate` 不被隱藏)；drop/reacquire（`completedReacquireCount>=1`、
  `terminalDropCount=0`）；terminal drop（`terminalDropCount>=1`、未污染 completed 計數）；
  overshoot/settling（`deriveTrackingReversalWindows()` 專屬 fixture,scripted rise-then-decay
  epsilon 曲線)；lag ambiguity（純正弦週期訊號,`blocked:'lag-peak-ambiguous'`）。額外覆蓋
  `protocol-incompatible`、`insufficient-valid-ticks`、兩種 `missing-target-telemetry`（缺 target
  position / 缺 dYaw-dPitch）、reversal window 的 `'overlap'`/`'insufficient-window-data'` 排除,以及
  未知 `smoothingVersion` fail-fast。
- `npx tsc --noEmit` exit 0；`npx vitest run src/metrics/trackingDynamics.test.ts` 19/19 passed；
  `npx vitest run`（全專案）194 files / 1844 tests passed（2 skipped),對照 T2 slice 6 的 193/1825
  baseline,新增 1 個檔案、19 個測試,無回歸。
- **執行協議偏離記錄**：本 task 未逐一切出 README 建議的 8 個 slice 各自 commit——lag search、gain、
  residual、ambiguity gate 與 recovery aggregation 在實作與 debug 過程中高度耦合（同一組 fixture
  同時驗證多個子功能),事後強行拆成獨立 commit 需要重新設計 fixture 邊界,對可稽核性沒有實質幫助,
  反而增加風險。改採 2 個 commit：(1) 實作 + 全部 truth fixture + 全專案 regression 綠燈,
  (2) operational doc + checklist/progress 收尾。記錄於此供後續 task 參考。
- 尚未動：`graphify update .`（留到本 task 收尾一次執行，見下方最終收尾條目）；T4 的 eligibility
  vocabulary、`TrackingPilotEvidence` JSON/HTML 尚未開工。

### 2026-09-02 — T2 slice 6/6：graphify update + 文件收尾（T2 完成）

- `graphify update .`：3909 nodes / 9263 edges / 242 communities 重建（`graphify-out/GRAPH_REPORT.md`/
  `graph.html`/`graph.json`/`manifest.json` 同步）。
- `codegraph sync .`：索引已是最新（無 pending）。
- README §2.2 新增「T1/T2 actual additive touch points」段落，補上讀碼後實際觸碰但原規劃表未列出的
  10 個檔案（`DrillConfig.ts`/`schema.ts`/`clearance.ts`/`TargetManager.ts`/`SharedState.ts`/
  `SimLoop.ts`/`DrillRunner.ts`/`DataRecorder.ts`/`metadata.ts`/`main.ts`+`fpsTestHarness.ts`），並
  註記原規劃裡尚未落地的 T3+ 項目（`trackingDynamics.ts`/`trackingPilotEvidence.ts`/
  `trackingPilotManifest.ts`/`analysis-tracking.md`/`tracking-pilot-runbook.md`）非本次遺漏、依排程
  屬 T3-T5。README 狀態列、stage11 母檔（README/task-checklist/progress，見 2026-09-02 條目）與本
  package 的 `task-checklist.md` 同步翻 T2 ✅。
- 最終全專案 regression（slice 5 收尾時已跑過，此處為 graphify/codegraph 同步後的確認性重跑）：
  `npx tsc --noEmit` exit 0；`npx vitest run` 193 files / 1825 tests passed（2 skipped），無回歸。
- **T2 總結**：6 個 slice、每片各自 atomic commit（見上方 slice 1-5 條目）。交付：additive
  `DrillConfig.targets.trackingTrajectory`/`timing.trackingPrepMs`/`protocolGuard` 契約 + schema 驗證 +
  clearance envelope 展開（slice 1）；`TargetManager` trajectory drive + `scored_start`/
  `target_motion_change` producer（slice 2）；no-fire/no-ADS/no-movement edge-triggered guard（slice 3）；
  export metadata opaque pass-through（slice 4）；9 個實際 pilot block config（1 practice + 2
  calibration + 4 core matrix + 2 reversal density，slice 5）。全程未修改任何既有 legacy drill 行為
  （`tracking_v1`/`_longrange_v1`/`_br_v1` 等 legacy regression 全程保持綠燈，逐 slice 驗證）。
- **遺留給後續 T 的已知缺口**（非本 T2 範圍，記錄供 T3+ 讀碼時參考）：
  1. `DrillConfig.timing.trackingStopMs`（hold-track-v1 用）與 `trackingTrajectory` 未加 schema 層互斥
     guard——語意上不相容（trackingStopMs 會凍結目標並解鎖開火，與連續 tracking pursuit 矛盾），但
     TargetManager 的 trajectory drive 分支在 legacy motion 分支之前提早 `continue`，即使兩者誤同時
     設定，trajectory drive 仍會贏、不會 crash。不影響任何已交付 block（皆未設定 trackingStopMs）。
  2. protocolGuard 的「movement」偵測讀 `state.held.left`/`state.held.right`（按鍵狀態），非
     `state.player.vx`（實際速度）——按鍵按下但因 friction/accelerate 尚未產生位移的情形仍會被記為
     violation，符合「偵測輸入意圖」的既定語意（FR-54 原文「no-movement」對應按鍵層級，非速度層級）。
  3. 尚未有任何地方（main.ts UI/researcher runner）實際載入本 T2 交付的 9 個 pilot block——T2 checklist
     的 DoD 是「configs 可 load/complete/rebuild」，不要求 UI 註冊；researcher-mode 排程/操作流程是
     T5（Researcher manifest/operator flow）範圍。

### 2026-09-02 — T2 slice 5/6：pilot block config 檔案（practice/calibration/core 2×2/reversal density）

- **落點**：`src/drill/tracking_core_pr_pilot_v1.ts`（practice + horizontal/vertical axis calibration +
  core 2×2 size/speed matrix，`band-limited-2d-v1`）與 `src/drill/tracking_reversal_pilot_v1.ts`
  （medium/high reversal density，`reversal-2d-v1`）——與 README §2.2 規劃路徑一致。慣例對齊
  `peek_click_transfer_pilot_v2.ts`（builder function + `XXX_CANDIDATES` 陣列 single source，供未來
  T5 researcher-mode 註冊）與 `tracking_longrange_v1.ts`（module-level 常數 + 內嵌設計註解）。
- **關鍵設計決策**：每個 config 一律 `mode: 'practice'`（WP-33 `AssessmentMode` 契約），**包含**
  WP-54 自己語彙裡「已評分」的 calibration/core/reversal blocks——比照既有 WP-52 pilot v2 precedent
  （`peek_click_transfer_pilot_v2.ts` 的所有候選，含其分析用候選，皆 `mode:'practice'`）。`DrillConfig.
  mode` 的 Assessment/Practice 契約與 WP-54 自己「practice vs scored」的語彙是兩個不同軸線：後者用
  `timing.trackingPrepMs` + `protocolGuard` 的有無表達（practice block 兩者皆無；calibration/core/
  reversal 皆兩者皆有），不疊加進前者，避免 pilot run 意外流入正式 Assessment 機制（違反 stage11 交付
  定位「不發布正式 Assessment」）。
- Scored block 契約：`trackingPrepMs=1000`（FR-54-5「1 秒置中準備」）、`protocolGuard={noFire,noAds,
  noMovement:true}`（§1.3「Scored block 禁止射擊、ADS 與玩家移動」）、trajectory `durationMs=25000`
  （D-54.4 凍結值）、`endCondition={type:'timeLimit', value:26000}`（prep+scored 合計）、
  `presentationMs=30000`（安全高於 26000，避免 timed-presentation 提早撤除目標搶在 timeLimit 之前）。
- Core matrix：`yawBoundDeg=pitchBoundDeg`∈{2.0,0.5} deg × `targetRmsSpeedDegPerSec`∈{5,20} deg/s
  （OQ-54-2 calibration candidate，非凍結）；`frequencyBandHz=[0.1,0.7]` 固定不變（非操弄變項）。
  Calibration blocks 用 2.0deg/5dps 這格（較大振幅、較慢速度，隔離單軸可見度判讀，不與快速運動混淆）
  搭配被壓制軸 `0.1deg`（`trackingTrajectory.ts` 要求正值，不能是 0）。Reversal blocks：
  `angularBoundsDeg=[-8,8]`、`speedRangeDegPerSec=[5,20]`（沿用 core matrix 速度候選，便於跨 block
  比較）、`accelerationRampMs=150`；medium `reversalIntervalMs=[800,1400]`、high `=[300,600]`——只有
  密度變動。
- `distance=4`（沿用 `tracking_v1`/`tracking_core_pr_pilot_v1` 既有正前方視線慣例，非
  `tracking_longrange_v1` 被迫改用的 110° 右後方 lane——4u 距離下角度上界投影後的側向/垂直偏移遠小於
  既有 L/R 槽位 `SIDE_OFFSET=2u`，`field-low` clearance 測試證實全部 block 過關）。
- 每個 block 各自獨立 seed（`SEED_BASE=54000`/`54100` 兩個家族，WP-54 專屬、不與既有 WP 的
  18018/23002/94000s/95000s 系列碰撞）與獨立 `drillId`（researcher-mode 註冊鍵，同時承載 checklist
  要求的「condition」標籤——每個 candidate 一個穩定識別，不新增額外欄位）。
- 測試：`src/drill/tracking_core_pr_pilot_v1.test.ts`（8 tests：全部 block 過 `field-low` clearance、
  drillId/seed 各自唯一、practice block 無 prep/guard、calibration 軸向振幅斷言、scored window 契約、
  2×2 矩陣覆蓋每個候選組合恰一次、端到端 sim round-trip 驗證 `visible`/`scored_start` 事件）；
  `src/drill/tracking_reversal_pilot_v1.test.ts`（6 tests：clearance、drillId/seed 唯一、high 密度區間
  嚴格短於 medium 且僅密度變動、scored window 契約、`accelerationRampMs < reversalIntervalMs[0]`、
  端到端 sim round-trip 驗證 `scored_start`/`target_motion_change` 事件皆抵達 recorder）。
- `npx tsc --noEmit` exit 0；`npx vitest run` 全專案 193 files / 1825 tests passed（2 skipped），無回歸。
- T2 checklist 8 個項目全數完成。尚未動：`graphify update .`（production code 有變動，依 T1 precedent
  等 T2 全部收尾再一次執行）與最終 README/task-checklist/progress 收尾同步（slice 6）。

### 2026-09-02 — T2 slice 4/6：export metadata（trackingTrajectory/trackingPrepMs opaque pass-through）

- **設計修正（比 T0/T1 規劃更簡）**：讀碼發現 `SpawnMeta.motion`/`spawnArea`/`spiderShot` 早已是
  opaque `unknown` pass-through 慣例（`parseSpawnMeta` 直接原樣帶出，不深驗——深驗留給各自 config 建構
  期，如 `trackingTrajectory.ts` 的 runtime guard）。checklist 要求的「drill id、trajectory version、
  seed、condition、angular size/speed、duration」六項，**五項已經全部在 `DrillConfig.targets.
  trackingTrajectory` 這個物件裡**（`kind`=version、`seed`、`durationMs`=duration、
  `yawBoundDeg`/`pitchBoundDeg`（band-limited）或 `angularBoundsDeg`（reversal）=size、
  `targetRmsSpeedDegPerSec`/`speedRangeDegPerSec`=speed），`drillId`/condition 則是既有頂層
  `meta.drillId`（每個 calibration candidate 給獨立 drillId，如 `PEEK_CLICK_TRANSFER_PILOT_V2_CANDIDATES`
  precedent）。故**不新增 `Meta.trackingPilot?` 平行 meta block**（原 T2 開工前設計筆記的方向）——
  那樣會把同一份 seed/kind/size/speed/duration 在兩個地方各定義一次，違反 GD-7「單一來源」精神；改為
  單純把 `trackingTrajectory` 整包物件塞進既有 `SpawnMeta.trackingTrajectory?: unknown`（比照 `motion`
  同紀律），`trackingPrepMs` 則比照 `presentationMs`（驗證正有限數，非 opaque，因為是純數字無需信任
  下游 parser）。
- `src/data/metadata.ts`：`SpawnMeta` 新增 `trackingTrajectory?: unknown`、`trackingPrepMs?: number`。
- `src/data/exportPayloadSchema.ts`：`parseSpawnMeta` 新增 `trackingTrajectory` opaque passthrough、
  `trackingPrepMs` 驗證（`parsePositiveFiniteNumber`，既有 helper）。
- `src/main.ts`、`src/testharness/fpsTestHarness.ts`：`buildCurrentExportPayload`/`fpsTestHarness` 的
  `spawn: {...}` 區塊各自新增 `trackingTrajectory`/`trackingPrepMs` 條件展開（比照緊鄰的 `motion`/
  `presentationMs` 寫法）——兩處原本就逐位重複 `motion`/`spawnArea`/`spiderShot`/`spawnDelayMsRange`/
  `presentationMs` 全部欄位（既有慣例，非本次新增的重複），故同步兩處維持一致慣例。
- 測試：`src/data/metadata.test.ts` +1 test（`collectMeta` 原樣帶出 `spawn.trackingTrajectory`/
  `trackingPrepMs`）；`src/data/exportPayloadSchema.test.ts` +2 tests（canonical round-trip、
  `trackingPrepMs <= 0` fail-fast）。
- `npx tsc --noEmit` exit 0；`npx vitest run` 全專案 191 files / 1811 tests passed（2 skipped），無回歸。
- 尚未動：實際 pilot block config 檔案本身（practice/axis calibration/core 2×2/reversal density
  candidates，slice 5——本 slice 只交付「若有 block config 存在，其 metadata 如何匯出」的管線）。

### 2026-09-02 — T2 slice 3/6：protocolGuard（no-fire/no-ADS/no-movement）

- `src/drill/DrillRunner.ts`：新增 `tickProtocolGuard(s, nowMs)`（`running` 相位內、`tickHoldReversal`
  之後呼叫，與其同層）。**設計**：每個 kind（fire/ads/movement）各自一個「已回報」latch，而非比較
  「上一 tick held 值」——因為跨 prep 窗界帶入的既有 held 狀態，在 scored 窗開始那一刻就該算一次違規，
  不必等到「false→true」邊緣；latch 在對應輸入放開時歸零，允許下一次按下再記一次。閘門條件是
  `s.tScoredStart.size === 0`（尚無任何目標跨過 prep）→ 直接跳過，不偵測——prep 窗內既有輸入（例如玩家
  放開移動鍵準備瞄準）不應誤記。**不阻擋輸入本身**：只推進 `s.protocolViolations`，完全不寫
  `heldFire`/`heldAds`/`held`。
- `src/data/DataRecorder.ts`：新增 `protocol_violation` additive `DrillEvent` 變體（`kind: 'fire'|'ads'|
  'movement'`、`t`）。
- `src/data/exportPayloadSchema.ts`：新增 `parseProtocolViolationEvent`（`kind` 用既有 `parseLiteral`
  封閉列舉慣例），`parseDrillEvent` switch 補一個 case。
- `src/loop/SimLoop.ts`：新增 `recordProtocolViolationEvents`（比照 `recordTargetMotionChangeEvents` 的
  export-then-clear），`simStep` 內接在其後呼叫。
- 測試：`src/drill/DrillRunner.test.ts` +6 tests（prep 窗內不偵測、跨過 prep 那個 tick 立即記帶入的
  既有 held 違規、latch 恆 held 只記一次+放開再按再記一次、noAds/noMovement 各自獨立、省略
  protocolGuard 時逐位不變、不阻擋輸入本身的直接斷言）；`src/data/exportPayloadSchema.test.ts` +4
  tests（正向解析 + canonical round-trip + 3 個 fail-fast 案例）。過程中同樣先犯一次 crossedPrep
  邊界 off-by-one（測試迴圈多跑了一次，把跨過 prep 的那個 tick 誤算進「仍在 prep 窗內」的斷言區間），
  發現後修正迴圈邊界——非實作問題，見上一個 slice 已建立的同類邊界紀律。
- `npx tsc --noEmit` exit 0；`npx vitest run` 全專案 191 files / 1808 tests passed（2 skipped），無回歸。
- T2 checklist 的 8 個項目中，practice/calibration/2×2/reversal block **config 檔案本身**（slice 5）與
  export metadata 接線（drill id/trajectory version/seed/condition/angular size&speed/duration，slice 4）
  尚未完成；其餘（trajectory drive round-trip、scored start/practice boundary event、protocol violation
  guard、target visibility/clearance/角度尺寸 round-trip）已在 slice 1-3 交付，同步翻 task-checklist.md。

### 2026-09-02 — T2 slice 2/6：SharedState/TargetManager/SimLoop trajectory drive + scored_start/target_motion_change producer

- `src/state/SharedState.ts`：新增 `tScoredStart: Map<string, number>`（比照 `tStop`）、
  `targetMotionChanges`/`protocolViolations` transient queue（比照 `cues`）——三者皆 additive，
  `interface`/`createSharedState`/`resetState` 三處同步；`protocolViolations` 本 slice 只定義欄位，
  producer（`DrillRunner.tickProtocolGuard`）留給 slice 3。
- `src/sim/TargetManager.ts`：`trackingTrajectory` 存在時建構期建一次 `createTrackingTrajectory()`
  （比照 `hitboxQueue`「build once per run」慣例），drive 迴圈新增獨立分支（`isDrivenMotion` 分支之前
  提早 `continue`，legacy motion 路徑逐位不動）。**關鍵設計**：`crossedPrep = nextAge >= trackingPrepSec`
  同時閘控 `tScoredStart` 蓋戳與 `changes` 游標 drain——若只用 `trajectoryAgeSec` 是否為 0 來判斷會在
  prep 窗**每個** tick 誤觸發（因為 clamp 後恆為 0），改用「是否已跨過 prep」這個布林旗標一次性判斷，
  且用 `state.tScoredStart.has(id)` 而非 `prevAge < prepSec` 的邊界比較來保證恰好蓋一次（prepSec=0 的
  退化情形下 `prevAge < prepSec` 用邊界比較會漏掉第一個 tick——`has()` 檢查沒有這個陷阱）。origin 重用
  既有 `distance`/`TARGET_Y`；`spawn()` 完全不用改（trackingTrajectory 目標的 `motion` 恆 undefined，
  且 drive 迴圈第一個 tick 就會用絕對投影覆寫 spawn 給的暫時 pos，spawn 給的 side-slot x 值從未被外部
  觀察到）。`markKilled`/`reset` 同步清除 `tScoredStart`/`targetMotionChanges`（比照既有 `tVisible`/
  `tStop`/`cues` 清除紀律）。
- `src/data/DataRecorder.ts`：新增 `scored_start` additive `DrillEvent` 變體（形狀比照 `target_stop`）。
- `src/data/exportPayloadSchema.ts`：新增 `parseScoredStartEvent`，`parseDrillEvent` switch 補一個 case。
  `target_motion_change` 的 producer 側（T1 只交了 parse 側）在本 slice 由 `TargetManager` 補上。
- `src/loop/SimLoop.ts`：新增 `recordScoredStartEvents`（比照 `recordTargetStopEvents` 的 exact-tick-match
  dedup）、`recordTargetMotionChangeEvents`（比照 `recordCueEvents` 的 export-then-clear），`simStep` 內
  緊接既有 `recordTargetStopEvents` 呼叫之後加這兩個。
- `src/data/export.ts`（`serializeEventsCSV`）**刻意未修改**：既有 `if/else if` 鏈無 `default`/`else`
  分支，未匹配的事件型別靜默不產生 CSV 列（非 throw）——`scored_start`/`target_motion_change` 沿用 T1
  對後者的既有決定（JSON-only，理由同前：無語意相符既有欄可重用、CSV header 不變測試已鎖）。
- 測試：`src/sim/TargetManager.test.ts` +9 tests（trackingTrajectory drive round-trip 對 `createTrackingTrajectory`
  + `projectTrackingAngles` 現算現比對、prep 窗凍結、跨過 prep 蓋戳恰一次、reversal `target_motion_change`
  在 prep 窗內不得提早 drain、`markKilled`/`reset` 清除紀律）；`src/loop/SimLoop.test.ts` +1 test（`simStep`
  直驅路徑端到端：recorder 收到 `scored_start`/`target_motion_change`）；`src/data/exportPayloadSchema.test.ts`
  +6 tests（`scored_start` 正向解析 + canonical round-trip + 4 個 fail-fast 案例）。
  過程中發現並修正 2 個測試自身的邊界 off-by-one（`crossedPrep` 判準為 `nextAge >= prepSec`，含跨過那個
  tick 本身；原測試迴圈邊界寫錯，不是實作 bug——見 commit 前 debug 紀錄，此處不重複列出試錯過程）。
- `npx tsc --noEmit` exit 0；`npx vitest run` 全專案 191 files / 1797 tests passed（2 skipped），無回歸。
- `graphify update .` **延後**到 T2 全部 slice 完成後一次執行（比照 T1 slice 1/2 的「避免中途 partial
  graph 產生誤導性節點」決策）。
- 尚未動：`protocolGuard`/`DrillRunner.tickProtocolGuard`/`protocolViolations` producer（slice 3）、
  export metadata `trackingPilot` meta block（slice 4）、實際 pilot block config 檔案（slice 5）。

### 2026-09-02 — T2 slice 1/6：DrillConfig/schema/clearance 契約

- `src/drill/DrillConfig.ts`：新增 `targets.trackingTrajectory?: TrackingTrajectoryConfig`（import 自
  `src/sim/trackingTrajectory.ts`，不重新宣告型別）、`timing.trackingPrepMs?: number`、頂層
  `protocolGuard?: { noFire?; noAds?; noMovement? }`——三者皆 additive，省略時既有 `DrillConfig` 逐位不變。
- `src/drill/schema.ts`：新增 `validateTrackingTrajectory`（`band-limited-2d-v1`/`reversal-2d-v1` 兩支，
  數值規則對齊 `trackingTrajectory.ts` 自己的 runtime guard，但在 `loadDrill` 驗證閘就帶欄位路徑拒絕）、
  `validateProtocolGuard`、`requireAscendingRange`/`requireAscendingPositiveRange`（嚴格 `min < max`，
  區別於既有 `requireRange` 的 `min <= max`——對齊 trajectory kernel 對退化區間的拒絕）。`trackingTrajectory`
  與 `motion` 互斥（比照既有 `hitbox`/`hitboxCandidates` 互斥風格）；`trackingPrepMs` 需搭配
  `trackingTrajectory`。
- `src/scene/clearance.ts`：`envelopeForSide` 新增 `expandForTrackingTrajectory`（import
  `projectTrackingAngles`/`TrackingProjectionOrigin` 自 `src/sim/trackingTrajectory.ts`——scene 消費 sim
  的無場景耦合純幾何函式，方向不違反 GD-6）。**設計決策**：trackingTrajectory 目標的 envelope 中心改為
  `x=0`（不套用既有 L/R peek 槽位 `±TARGET_SIDE_OFFSET_U` 偏移）——trackingTrajectory 目標是單一持久目標、
  繞玩家正前方中軸連續運動，比照既有 `spiderShot.centerDistanceU` 的 `(0, TARGET_Y, -centerDistanceU)`
  中軸慣例，不是 L/R 交替 peek。`band-limited-2d-v1` 讀 `yawBoundDeg`/`pitchBoundDeg`；`reversal-2d-v1` 的
  `angularBoundsDeg` 同時套用到 yaw 與 pitch（對齊 T1 `createReversal2dV1` 兩軸共用同一 range 的慣例）。
  四角落投影展開 AABB（純建構期上界檢查，不逐 tick 模擬，同 `expandForMotion` 紀律）。
- 測試：`src/drill/schema.test.ts` +14 tests（trackingTrajectory 合法/互斥/欄位驗證、trackingPrepMs 搭配
  規則、protocolGuard 欄位驗證）；`src/scene/clearance.test.ts` +2 tests（band-limited/reversal envelope
  展開，期望值以 `projectTrackingAngles` 現算現比對，避免手算誤差；`toBeLessThan(-0.5)` 佐證確實展開，
  且未套用 side offset）。
- `npx tsc --noEmit` exit 0；`npx vitest run src/drill src/scene` 29 files / 247 tests passed，無回歸。
- 尚未動：`SharedState`/`TargetManager`/`SimLoop`/`DrillRunner`/`DataRecorder`/`exportPayloadSchema.ts`
  （trajectory 實際 drive、`scored_start`/`target_motion_change`/`protocol_violation` producer 側）留給
  slice 2-3；本 slice 只交付 config 契約與 clearance round-trip，`trackingTrajectory` 尚無任何 drill 使用。

### 2026-09-02 — T2 CodeGraph discovery + landing-point design（開工前，未寫 code）

讀碼後（`codegraph_explore` 對 `DrillConfig`/`schema.ts`/`clearance.ts`/`TargetManager.ts`/
`SimLoop.ts`/`SharedState.ts`/`DrillRunner.ts`/`DataRecorder.ts`/`exportPayloadSchema.ts`/
`ProtocolRunner.ts`）確認以下與 README §2.2 規劃路徑的落點差異，並記錄實際設計（供 T2 各切片依循，
偏離處後續完成時同步回寫 README）：

- **不走 `src/drill/tracking_core_pr_pilot_v1.ts` 等獨立檔案清單先行**——先做「trajectory 如何接進
  既有 `DrillConfig`/`TargetManager`/`clearance`/`DrillRunner`/`SimLoop`/`DataRecorder` 資料流」這個
  地基（T2 slice 1-3），最後才落 block config 檔案本身（slice 4-5）。原因：pilot block 本質仍是一份
  `DrillConfig`（沿用 F4「換 config 即換 drill」），沒有新引擎介面；地基不穩，config 檔案只是噪音。
- **`ProtocolRunner`（`src/display/ProtocolRunner.ts`）不是本 WP 要用的機制**——它是「整個 drill+scene+
  resolution mode 換條件」的協定跑者（WP-52 pilot v2 用），操作粒度是「換一個完整 drill」。WP-54 的
  practice→1s 置中準備→25s scored 窗界是**單一 drill run 內部**的相位/事件語意，不是跨 drill 條件切
  換——T5（researcher session manifest/operator flow）才會決定要不要疊一層 `ProtocolRunner`-like 排程
  跑完整組 block 序列；T2 只交付單一 block 的 config 契約與執行期語意。
- **`DrillConfig.mode`（`AssessmentMode` = `'assessment' | 'practice'`）已存在**，直接重用做 practice
  block 的識別（FR-54-5「practice 不寫入 scored aggregation」在 T2 的落地＝practice block 的 config
  帶 `mode: 'practice'`；實際聚合層的排除規則留給 T4 讀這個欄位，T2 不用新發明一個 practice 旗標）。

**新 additive 契約（設計，尚未實作，2026-09-02）**：

1. `DrillConfig.targets.trackingTrajectory?: TrackingTrajectoryConfig`（import 自
   `src/sim/trackingTrajectory.ts`，不重新宣告型別）——`targets.motion` 的 sibling、schema.ts 強制互斥
   （比照現行 `hitbox`/`hitboxCandidates` 互斥風格）。
2. `DrillConfig.timing.trackingPrepMs?: number`——比照現行 `trackingStopMs` 慣例（正有限數，選填）。
   `TargetManager` 用它把 trajectory 的 `ageSec` 原點往後推：`nextAge < prepSec` 時目標凍結在
   `trajectory.sample(0)`（= 玩家「置中準備」瞄準的固定點），跨過 `prepSec` 那個 tick 觸發
   `scored_start` 事件、之後 `ageSec = age - prepSec` 正常推進。**不**新增「practice 相位」到
   `DrillRunner.DrillPhase`（`idle|countdown|running|ended` 不變）——prep 純粹是 `TargetManager` 對單一
   持久目標（`timing.presentationMs`/`trackingStopMs` 已有的「一直存活到 drill 結束」模式）的內部時間
   原點平移,不是新的生命週期相位。
3. `DrillConfig.protocolGuard?: { noFire?: boolean; noAds?: boolean; noMovement?: boolean }`
   （additive top-level 欄位,`cue` 的 sibling)。`DrillRunner`（已持有 `config`/`state`,`tickHoldReversal`
   同層)新增 `tickProtocolGuard`:只在 scored 窗內（`state.tScoredStart` 該目標已蓋戳且
   `nowMs >= 蓋戳時間`）對 `heldFire`/`heldAds`/`held.left`/`held.right` 做 edge-trigger 偵測（false→true
   才記一次，不連續洗版、不阻擋輸入本身,FR-54 no-fire/no-ADS/no-movement 硬約束原文）。
4. `SharedState` 新增三個 additive 欄位（`interface`/`createSharedState`/`resetState` 三處同步)：
   - `tScoredStart: Map<string, number>`（比照既有 `tStop`,`TargetManager` 寫、`SimLoop` 讀drain）。
   - `targetMotionChanges: Array<{targetId; t; yawVelocityBeforeDegPerSec; yawVelocityAfterDegPerSec;
     pitchVelocityBeforeDegPerSec; pitchVelocityAfterDegPerSec}>`（比照既有 `cues` 的 transient queue
     模式——`TargetManager` 依 `trajectory.changes`（T1 已預算好的 schedule）游標推進 push,`SimLoop`
     每 tick drain 進 `recorder`,清空)。**T1 只交了 `target_motion_change` 的 parse 側**（`DrillEvent`
     union member + `exportPayloadSchema.ts` parser)，producer 側（誰在什麼時候真的 push 這個事件)是
     T2 待補的一半——這裡補上。
   - `protocolViolations: Array<{kind: 'fire'|'ads'|'movement'; t: number}>`（同 `cues` transient queue
     模式，`DrillRunner.tickProtocolGuard` 寫、`SimLoop` drain)。
5. `TargetManager`：`trackingTrajectory` 存在時,建構期建一次 `createTrackingTrajectory()`（比照
   `hitboxQueue`「build once per run」慣例,非每 tick)；drive 迴圈新增獨立分支（`isDrivenMotion(t.motion)`
   分支之前提早 `continue`，legacy motion 路徑逐位不動)：`sample(trajectoryAgeSec, buf)` →
   `projectTrackingAngles(buf.yawDeg, buf.pitchDeg, {distanceU: config.targets.distance, centerY: TARGET_Y},
   t.pos)`（origin 重用既有 `targets.distance`/`TARGET_Y`,不新增 config 欄位、不新增常數)。`spawn()`
   完全不用改（trackingTrajectory 目標的 `motion` 恆 undefined,`age:0` 初始化已存在)。
6. `src/scene/clearance.ts`：`envelopeForSide` 新增 `expandForTrackingTrajectory(min, max, center,
   trackingTrajectory, hitbox)`,重用既有 `expandByPoint` helper——把 `trackingTrajectory` 的角度上界
   （`band-limited-2d-v1` 讀 `yawBoundDeg`/`pitchBoundDeg`；`reversal-2d-v1` 讀 `angularBoundsDeg` 同時
   套用到 yaw 與 pitch,對齊 T1 `createReversal2dV1` 的 room 計算慣例)四個角落投影
   （import `projectTrackingAngles`/`TrackingProjectionOrigin` 自 `src/sim/trackingTrajectory.ts`——
   scene 讀 sim 的純幾何函式,方向不違反 GD-6「場景幾何不得進 sim」,是反過來 scene 消費 sim 的無場景
   耦合 pure function)展開進 AABB。
7. `DrillEvent` 新增兩個 additive union member：`scored_start`（形狀比照 `target_stop`：`targetId`/`t`/
   `targetX`/`targetY`/`targetZ`）、`protocol_violation`（`kind: 'fire'|'ads'|'movement'`/`t`）。
   `src/data/exportPayloadSchema.ts` 各補一個 parser、`parseDrillEvent` switch 新增兩個 case。CSV
   （`src/data/export.ts` `serializeEventsCSV`）沿用 T1 對 `target_motion_change` 的既有決定——**不**
   新增欄（JSON-only,理由同 T1 slice 2/2 記錄：無語意相符的既有欄可重用、CSV header 不變測試已鎖）。
8. Export metadata（drill id/trajectory version/seed/condition/angular size&speed/duration）落點：
   `src/data/metadata.ts` 待讀碼確認確切寫法後在對應切片動工，暫記為 `Meta.trackingPilot?` additive
   sub-block（設計方向,非最終定案——實作時若讀碼發現更貼合既有慣例的落點，以讀碼後為準)。

**執行順序（T2 slice 計畫,每片各自 commit + focused test + `npx tsc --noEmit`)**：
① DrillConfig/schema/clearance 契約（含 mutual-exclusion + envelope round-trip test）
② SharedState 新欄位 + TargetManager 接線（trajectory drive + `scored_start` + `target_motion_change`
   producer）+ SimLoop drain + DrillEvent/schema parser（含 round-trip + legacy regression）
③ protocolGuard（DrillConfig + DrillRunner.tickProtocolGuard + SharedState.protocolViolations +
   SimLoop drain + DrillEvent + schema parser）
④ export metadata 接線（trackingPilot meta block）
⑤ 實際 pilot block config 檔案（practice、axis calibration、core 2×2、reversal density candidates）
⑥ 全專案 regression + `graphify update .` + README/task-checklist/progress 收尾同步

### 2026-09-02 — T1 slice 2/2：angular-to-world projection + `target_motion_change` export event

- 新增 `projectTrackingAngles(yawDeg, pitchDeg, origin, out)`（`src/sim/trackingTrajectory.ts`）：純幾何函式，`yaw=pitch=0` 時輸出 `(0, centerY, -distanceU)`，與既有 `TargetManager` sightline 慣例一致；不讀場景資料（GD-6）。5 個新測試（boresight、90° yaw/pitch、鏡射對稱、純函式性）。實際「這個 origin 從哪來、寫回哪個 `TargetState`」留給 T2（`TargetManager` wiring），T1 只交付可重用的投影公式本身。
- 新增 additive `target_motion_change` `DrillEvent` variant（`src/data/DataRecorder.ts`）+ `parseTargetMotionChangeEvent`（`src/data/exportPayloadSchema.ts`，wired into `parseDrillEvent` switch）：`targetId`、`t`、`yaw/pitchVelocityBefore/AfterDegPerSec` 皆為必要有限數；未知欄位/缺欄位 fail fast（沿用既有 `parseFiniteNumber`/`parseNonEmptyString` helper，無新 helper）。
- `src/data/exportPayloadSchema.test.ts` +19 tests：positive parse、`canonicalExportJSON` round-trip（含二次 parse 驗證逐位相等）、4 個 fail-fast 案例（缺 targetId/t/非有限 yaw velocity/缺 pitchVelocityAfter）。
- **刻意不改** `src/data/export.ts` 的 `serializeEventsCSV`：該檔既有 2 個 test 明確斷言「header 不變、不新增欄」（WP-29 key event 前例：重用既有 `key`/`down` 欄而非新增 `code` 欄）。`target_motion_change` 的 4 個 yaw/pitch velocity 數值目前沒有語意相符的既有欄可重用（`viewYaw`/`aimPunchYaw` 等欄屬於 fire event 的瞄準語意，硬套會誤導 CSV 消費者）。since 尚無任何 producer 會真的送出此事件（T2 才接線），CSV 這個 gap 現在不影響任何真實資料；記錄為已知、有意的暫緩，留到 T2 接線、確定欄位語意後再決定新增欄或找到合適的既有欄重用，而不是現在猜錯。JSON（`serializeJSON`/`canonicalExportJSON`）路徑對此事件完整、無 gap。
- `npx tsc --noEmit` exit 0（`DrillEvent` 61 個既有 caller 皆用 `if/else-if` 而非窮舉 `switch`，additive union 變更未破壞任何一個）；`npx vitest run` 全專案 191 files / 1766 tests passed（2 skipped），無回歸。
- `graphify update .` 已執行（3884 nodes / 9158 edges / 240 communities 重建）；`codegraph sync .` 確認索引已是最新。
- T1 至此全數完成（README §4 DoD：FR-54-2/3、NFR-54-1/6 tests 全綠；`tracking_v1`/`_longrange_v1`/`_br_v1` snapshot 無 semantic diff；未知 version fail fast）。

### 2026-09-02 — T1 slice 1/2：deterministic trajectory kernel（`src/sim/trackingTrajectory.ts`）

- 新增 `createTrackingTrajectory(config)`，涵蓋 README §2.4 兩種 kind：
  - `band-limited-2d-v1`：5 個對數等距頻率分量的 sum-of-sinusoids pursuit，係數在建構時一次解出（速度 RMS 目標 vs. 位置邊界安全兩個縮放係數取 min——邊界安全恆優先）；`sample(ageSec, out)` 之後只是純函式求值，無 `changes`（連續 pursuit，無離散事件）。
  - `reversal-2d-v1`：**設計歷經一次返工**——原設計讓新 leg 直接沿用上一個 leg 的巡航速度做 ramp（`v(0)=前一 leg 終速`），實測（`toBeGreaterThanOrEqual(lowDeg)` 失敗，`-8.0148` 越界）發現：leg 邊界的殘留速度仍指向舊方向（撞牆方向），ramp 前段會先繼續衝向牆、超過已用完的房間才回頭。改為**每個 leg 靜止到靜止**（ramp-up 0→cruise、cruise、ramp-down cruise→0）的梯形/三角形速度剖面：leg 邊界恆是速度歸零瞬間，房間不足以跑完整趟 ramp 時，用同一個加速度 `magnitude/rampNominalSec`（不升高）反推可達到的較低峰值速度（三角形分支）。此設計讓「位置不越界」變成解析可證的建構期保證，不需要 runtime clamp。見本檔 D-54.12。
  - `createTrackingTrajectory()` 對未知 `kind` runtime fail fast（README §2.4「Unknown trajectory kind/version ... 必須 fail fast」）。
- 新增 `src/sim/trackingTrajectory.test.ts`（30 tests）：bounds sweep、finite-acceleration 上界、change-event 連續性/before-after 一致性、60/120/240 Hz pump-cadence 等價（純函式 age 求值，天然滿足決定性）、reset reproducibility、不同 seed 產生不同結果、config fail-fast（非有限 seed、非正 duration、非遞增 range、ramp ≥ min interval 等）。
- Legacy tracking baseline 重跑：11 檔（`targetMotion`/`TargetManager`/`tracking_v1`/`_longrange_v1`/`_br_v1`/`_scene_v1` 等）103 tests 全綠，`trackingTrajectory.ts` 為全新獨立檔案、未改動任何既有 symbol，snapshot 無 semantic diff。
- `npx tsc --noEmit` exit 0；`npx vitest run` 全專案 191 files / 1755 tests passed（2 skipped），無既有測試回歸。
- 尚未完成（下一個 T1 slice）：angular-to-world projection（yaw/pitch → `TargetState.pos`，留到 T2 wiring 進 `TargetManager`/pilot drill config 時一併做）、additive `target_motion_change` export event 與 `exportPayloadSchema.ts` round-trip。
- production code 有變動，但 `trackingTrajectory.ts`/`.test.ts` 尚未被任何既有模組 import（純新增、未接線），暫緩 `graphify update .` 到 T1 完整收尾（含 export event wiring）一次做，避免中途 partial graph 產生誤導性節點。

### 2026-09-02 — T0 Entry gate/scope freeze/preregistration

- **Stage scope**：使用者確認正式接受 WP-54 進入 stage11；同步更新 stage11 [README](../README.md)、[master checklist](../task-checklist.md)、[progress](../progress.md)（見該三檔 2026-09-02 條目）。
- **Repo state at T0**：HEAD `dc2a6b3abd9f79a113c73b4bb8326bd0c87e5041`（`test(wp-53): E2E acceptance for formal peek_click_transfer_v1 (T5)`）。Worktree 另有 WP-53 T-exit 遺留的 staged doc-sync 變更（`CONTEXT.md`、`docs/MAP.md`、`docs/exec-plan/README.md`、stage11 README/progress/task-checklist、wp-53 README/progress/task-checklist、`docs/operational/analysis-peek-click-transfer.md`）——與 WP-54 無關，本次未觸碰其內容，僅在同一批 stage11 master 檔案上疊加 WP-54 段落。
- **CodeGraph status**：索引健康（500 files indexed）。多個檔案（`src/metrics/trackingDerivation.ts`、`trackingTransitions.ts`、`submovement.ts`、`src/data/exportPayloadSchema.ts`、`export.ts`、`src/sim/TargetManager.ts`、`targetMotion.ts`、`src/results/ResultPresentation.ts`、`src/state/types.ts` 等）在查詢時顯示「pending sync（edited ~200ms ago）」，經 `git status --short` 對照確認皆為 0 diff（純 mtime touch，非實質變更）——本次 codegraph 讀取內容視為權威。graphify `GRAPH_REPORT.md` 最後提交時間與 HEAD 相同（2026-09-02T09:11:49+02:00），視為新鮮。
- **CodeGraph impact**（T1 前必讀，T1 實作時需重新確認 blast radius 未擴大）：
  - `TargetMotion`（`src/state/types.ts:145`）— 13 callers，含 `src/scene/clearance.ts`、`src/drill/DrillConfig.ts`、`src/drill/schema.ts`、`src/sim/targetMotion.ts` 等，屬 cross-module。WP-54 新 trajectory kind 若要掛在 `TargetMotion` union 上，必須 additive（新 variant），不得改既有 variant 語意；若改走 §2.2 規劃的獨立 `trackingTrajectory.ts` 模組（不進 `TargetMotion` union），則此 blast radius 不適用，留待 T1 讀碼後定案並回寫本文件。
  - `motionOffset()`（`src/sim/targetMotion.ts:40`）— 3 callers，全在 `src/sim/TargetManager.ts` 內，屬 local-to-sim-module，非 cross-module。
  - Export schema（`src/data/exportPayloadSchema.ts` 的 `parseExportPayload`/`parseEvents`/`parseDrillEvent`；`src/data/export.ts` 的 `ExportPayload`/`buildExportPayload`/`serializeJSON`）— 新增 `target_motion_change` event 必須是 additive union member，並在 unknown event type 時 fail closed；不得改動既有 tick/event 解析路徑。
  - `deriveTrackingMetrics()`（`src/metrics/trackingDerivation.ts:117`）— 11 callers，含 `src/results/ResultPresentation.ts`、`src/metrics/holdClickMetrics.ts`、`src/testharness/fpsTestHarness.ts`；`options` 必須維持全 optional，新增行為不得改變既有呼叫方在省略 options 時的輸出。
  - `deriveTrackingTransitions()`（`src/metrics/trackingTransitions.ts:15`）— 3 callers，全在 `src/metrics/spiderShotMetrics.ts`（spider-shot 構念，與 WP-54 tracking pilot 無關但共用同一函數）——T3 若擴充此函數，必須確認 spider-shot 既有 regression 不受影響。
  - Result/history consumers：`src/history/DrillMetricRegistry.ts` 的 `REGISTRATIONS` 目前只有 `spiderShotV2` 與 `peekClickTransferV1` 兩筆註冊；`tracking_v1`/`tracking_longrange_v1`/`tracking_br_v1` **未註冊**於 `DrillMetricRegistry`/`HistoryTrend`。確認本 WP 的 pilot run 沒有既有 formal history/trend 路徑可誤入——與 §1.3 Constraints「pilot 資料不得自動進正式 Assessment history/trend」的既有事實一致，T0 不需要新增 guard 來阻擋一個原本就不存在的路徑。
- **Legacy tracking baseline（記錄用，非 gate）**：`npx vitest run` 對以下 11 個既有 tracking 相關檔案，103/103 全綠：`src/sim/targetMotion.test.ts`(12)、`src/sim/TargetManager.test.ts`(49)、`src/metrics/trackingDerivation.test.ts`(10)、`src/metrics/trackingTransitions.test.ts`(3)、`src/metrics/holdTrackWindowInvariant.test.ts`(1)、`tests/golden/research/epsilon-parity.test.ts`(1)、`tests/golden/research/promoted-curve.test.ts`(12)、`src/drill/tracking_v1.test.ts`(3)、`src/drill/tracking_longrange_v1.test.ts`(4)、`src/drill/tracking_br_v1.test.ts`(5)、`src/drill/tracking_scene_v1.test.ts`(3)。
- **Preregistration snapshot**：OQ-54-1~OQ-54-8 全數凍結（見下方 decision log D-54.1~D-54.8 與 README §1.4）；primary outcome、metric version、pilot protocol version 見 D-54.9~D-54.11。後續若需變更任一凍結值，必須以新 protocol/metric version 字串 + 本表新增 decision row 表達，不得原地覆寫本次凍結值。

### 2026-09-01 — Planning package

- 依使用者要求讀取 `.claude/skills/engineering-planning/SKILL.md`。
- 讀取原始 WP-54 proposal：[../wp-54-tracking-pilot-execution-plan.md](../wp-54-tracking-pilot-execution-plan.md)。
- 參照 WP-51 folder-style work package：[../../stage10/wp-51-m18-integration-and-acceptance/README.md](../../stage10/wp-51-m18-integration-and-acceptance/README.md) 與 [task-checklist.md](../../stage10/wp-51-m18-integration-and-acceptance/task-checklist.md)。
- 讀取 `AGENTS.md` 與 `graphify-out/GRAPH_REPORT.md`；確認 target/sim/export/metrics 屬 cross-module planning 熱區。
- 新增 WP-54 自足執行計畫、task checklist 與 progress log。
- 本次只新增 planning docs，未修改 production code，未執行 tests 或 `graphify update .`。

## Decision log

| ID | 決策 | 理由 | 狀態 |
|---|---|---|---|
| D-54P.1 | WP-54 先以獨立 folder-style planning package 呈現，不直接改 stage11 master scope | 原始 proposal 已明確警告尚未納入 stage11；正式接受應由 T0 更新 master README/checklist/progress | Proposed |
| D-54P.2 | 保留 `tracking_v1` 作為 predictable baseline，新增 pilot-only trajectory/drill ids | 避免同一 drill id 表達不同 tracking construct 或污染既有 evidence | Proposed |
| D-54P.3 | Pilot evidence 先採 researcher HTML/JSON，不進正式 history/trend | Reliability/validity 未過 gate 前，產品化結果會製造錯誤精確感 | Proposed |
| D-54.1 | 正式接受 WP-54 進入 stage11 | 使用者於 T0 明確確認（見 verification log） | ✅ Confirmed |
| D-54.2（OQ-54-1） | Steady pursuit + reactive reversal 並列，分開報告，不合併成單一分數 | 使用者確認採用建議預設；符合 §2.5 metrics contract 已規定的分層報告原則 | ✅ Confirmed |
| D-54.3（OQ-54-2） | Core matrix `2.0/0.5 deg x 5/20 deg/s` 採為 T2 calibration candidate，非正式凍結值 | 與 README 原文一致：T7 依 floor/ceiling 證據決定 retained/revise/remove，T0 沒有真人資料可提前凍結 | ✅ Confirmed（as candidate） |
| D-54.4（OQ-54-3） | Scored block 長度 = 25 秒 | 建議預設；T7 Gate B 需檢查 time-on-task slope 是否需要調整區塊長度 | ✅ Confirmed |
| D-54.5（OQ-54-4） | Lag 搜尋範圍 `0–250 ms`；離線固定係數平滑（`smoothingVersion` 版本化）；週期性多峰回傳 `lag-peak-ambiguous`，禁止回傳單一 lag/gain 值 | 對齊 README §2.4 `TrackingDynamicsOptions`/`TrackingDynamicsResult` 既定 blocked reason 詞彙 | ✅ Confirmed |
| D-54.6（OQ-54-5） | Repeatability 最低門檻：condition-level RMS `epsilon` 的 ICC(A,1) point `>= 0.75`，95% CI 下界 `>= 0.60`，作為 M20/T8 pass-fail 依據 | 使用者確認採用建議預設 | ✅ Confirmed |
| D-54.7（OQ-54-6） | 真人招募：Gate B 12–20 人；Gate C 20–30 人，session 間隔 24–72 小時 | 建議預設；純招募/calendar 決策，不影響 T0–T5 程式範圍 | ✅ Confirmed |
| D-54.8（OQ-54-7 / OQ-54-8） | Evidence artifact 先做 researcher-only self-contained HTML + JSON，不進產品 Result UI；不做 tracking-specific SPARC，M20 後才另立提案 | 建議預設；與 stage11 「Researcher/pilot-only；不發布正式 Assessment」的交付定位一致 | ✅ Confirmed |
| D-54.9 | Primary outcome = 每 condition 合併 eligible pursuit ticks 的 `RMS(epsilon)`（deg） | 原始 WP-54 proposal 已預註冊；本次 T0 只是重申並鎖定，不重新評估 | ✅ Confirmed（承襲既有預註冊） |
| D-54.10 | Metric version = `tracking-dynamics-v1`；trajectory version = `band-limited-2d-v1`（pursuit）/ `reversal-2d-v1`（reactive） | 沿用 README §2.4 interface 命名，作為 T1/T3 實作時的版本字串來源 | ✅ Confirmed |
| D-54.11 | Pilot protocol version = `tracking-pilot-v1` | 沿用 README §2.4 `TrackingPilotManifest.protocolVersion` 命名 | ✅ Confirmed |
| D-54.12 | `reversal-2d-v1` 採「每個 leg 靜止到靜止」（v(leg start)=v(leg end)=0）的梯形/三角形速度剖面，而非「新 leg 沿用前一 leg 巡航速度做 ramp」 | 後者在 T1 test（bounds sweep）發現會越界（`-8.0148` vs `-8` 下界）——leg 邊界殘留速度仍指向舊方向，ramp 前段先繼續衝向牆才回頭；前者讓邊界安全變成解析可證的建構期保證，不需 runtime clamp，`changes` 語意改為「前一穩態巡航速度 → 本 leg 穩態巡航速度」而非「瞬時速度」（leg 邊界瞬時速度恆為 0） | ✅ Confirmed（T1 slice 1/2，2026-09-02） |
| D-54.13 | P1 對 `trackingDerivation.ts` 採 shallow-copy adapter（`adaptPayloadForScoredWindow()`）而非修改該檔 | README §2.2 只列 `trackingDerivation.test.ts` 為 MODIFY/ADD,未列實作檔——暗示實作檔應保持不動；11 個既有 caller（`ResultPresentation.ts`/`holdClickMetrics.ts` 等）與兩個 golden fixture test（`epsilon-parity`/`promoted-curve`）的 blast radius 因此維持 0 | ✅ Confirmed（T3,2026-09-02） |
| D-54.14 | Reversal event windows（response latency/peak error/overshoot/settling time,FR-54-9）落在新 export `deriveTrackingReversalWindows()`,不塞進 `TrackingDynamicsResult` | README §2.4 的 `TrackingDynamicsResult` 介面是逐字凍結契約,任務指示「copy verbatim,不重新設計」——該介面本就沒有 reversal 專屬欄位；FR-54-9/checklist/§2.5「P1 reactive」列仍要求此分析,故另開一個 additive function 滿足需求而不違反凍結契約 | ✅ Confirmed（T3,2026-09-02） |
| D-54.15 | `deriveTrackingReversalWindows()` 的「run 尾端可用窗長」改用 `min(presentation.windowEndMs, 最後一筆 sample 的 t)` 而非直接用 `presentation.windowEndMs` | 單目標 run（WP-54 pilot block 常態）沒有後續 `visible` event,`windowEndMs` 恆為 `Infinity`——若不夾住,run 尾端的 change event 會被誤判為「窗長足夠」而不觸發 `insufficient-window-data` 排除；fixture 首次執行時即抓到此 bug（`expected false to be true`,`windows[2].excluded` 未被標記為排除），修正後全綠 | ✅ Confirmed（T3,2026-09-02） |
| D-54.16 | Lag ambiguity 預設 `correlationAmbiguityRatio = 2`（次高峰需 `<=` 最高峰的一半才不算 ambiguous） | README/D-54.5 只凍結 `[0,250]ms` 搜尋範圍與「多峰必須 blocked」這個閘門本身存在,未凍結比例門檻數值；`2` 是 truth-fixture 套件用的預設值,足以清楚分辨「單一乾淨峰值」（band-limited pursuit,次高峰通常遠低於一半）與「純週期訊號」（次高峰幾乎等於最高峰,比例≈1）兩種案例,標記為 T6/T7 校準候選,非正式凍結值 | ✅ Confirmed（T3,2026-09-02,as default/candidate） |
| D-54.18 | Run-level `TrackingQualityReason`（T4）收斂為 8 個 kebab-case reason code，且刻意與 T3 `TrackingDynamicsResult` 的 5 個 metric-level blocked reason 使用不同字串（例如 `missing-target-position` vs `missing-target-telemetry`） | FR-54-10 五大類別（overflow/missing target/timestamp/coverage/protocol mismatch）需要具體、封閉、one-shot 定案的字串；兩層 blocked 語意若共用相近字面會讓消費者誤以為是同一件事，README §2.4 本就把兩者定義成不同型別（`TrackingRunEligibility` vs `TrackingDynamicsResult`） | ✅ Confirmed（T4 slice 1/6，2026-09-02） |
| D-54.19 | `T4` 新檔落在 `src/pilot/` 目錄下多個檔案（`trackingRunEligibility.ts` 起頭，compatibility key/evidence/report 陸續加入），而非全部塞進 README §2.2 規劃的單一 `trackingPilotEvidence.ts` | README §2.2 只是 T0 時期的落點候選，T4 實際範圍（run-level eligibility + WP-54 專屬 compatibility key + JSON evidence model + 自足 HTML report）遠比 WP-52 `peekClickTransferPilotEvidence.ts`（81 行純聚合）大；拆檔維持單一職責、可個別測試，同目錄慣例（`src/pilot/`）不變 | ✅ Confirmed（T4 slice 1/6，2026-09-02） |
| D-54.17 | Smoothing kernel 版本化為封閉字串表（`tracking-dynamics-smoothing-v1-none` identity / `tracking-dynamics-smoothing-v1-tri3` 對稱三點三角 FIR),未知字串 fail fast | D-54.5 要求「離線固定係數平滑,`smoothingVersion` 版本化」——用封閉 registry + fail-fast 而非允許任意係數陣列,對齊本專案既有「未知 version/kind 必須 fail fast」紀律（`trackingTrajectory.ts` 前例);truth fixture 預設用 `-none`（保持結果可精確追溯到合成訊號本身,不被平滑掩蓋),另加一個 `-tri3` 案例證明有實際套用平滑且不崩潰 | ✅ Confirmed（T3,2026-09-02） |

## Open Questions

全部 OQ-54-1~OQ-54-8 已於 T0（2026-09-02）凍結，詳見上方 decision log D-54.2~D-54.8 與 [README §1.4](README.md)。OQ-54-2 標記為 calibration candidate（非 hard freeze），其餘視為凍結值；後續變更一律走新 protocol/metric version + 本表新 decision row。

## Verification log

| Date | Command / action | Result |
|---|---|---|
| 2026-09-01 | `Get-Content .claude/skills/engineering-planning/SKILL.md` | skill loaded |
| 2026-09-01 | `Get-Content AGENTS.md` / `Get-Content graphify-out/GRAPH_REPORT.md` | project planning rules loaded |
| 2026-09-01 | Read WP-54 proposal and WP-51 README/checklist/T files | planning format and scope source loaded |
| 2026-09-01 | Documentation edit only | no production code changed; no tests run |
| 2026-09-02 | `AskUserQuestion`：WP-54 stage scope、OQ-54-1、OQ-54-5 | 使用者確認：正式接受 WP-54 進入 stage11；OQ-54-1 = Steady+Reactive 並列；OQ-54-5 = 採用建議預設門檻 |
| 2026-09-02 | `git status --short` / `git rev-parse HEAD` | HEAD `dc2a6b3`；worktree 另有 WP-53 T-exit 遺留 staged doc-sync（與 WP-54 無關，未觸碰其內容） |
| 2026-09-02 | `mcp__codegraph__codegraph_explore`（`TargetMotion`/`motionOffset`/`TargetManager`/export schema/`deriveTrackingMetrics`/`deriveTrackingTransitions`） | blast radius 記錄於上方 Progress 段落；「pending sync」檔案經 `git status --short` 對照為 0 diff（純 mtime touch） |
| 2026-09-02 | `mcp__codegraph__codegraph_explore`（`DrillMetricRegistry`/`HistoryTrend`/`compatibilityKey`/tracking drill ids） | 確認 `tracking_v1`/`tracking_longrange_v1`/`tracking_br_v1` 未註冊於 `DrillMetricRegistry`，無既有 formal history/trend 路徑 |
| 2026-09-02 | `git log -1 --format=%cI -- graphify-out/GRAPH_REPORT.md` vs `git log -1 --format=%cI HEAD` | 兩者時間戳相同（2026-09-02T09:11:49+02:00），graphify 視為新鮮 |
| 2026-09-02 | `npx vitest run`（11 個既有 tracking 相關檔案，見上方 Progress「Legacy tracking baseline」） | 103/103 tests passed，記錄為 baseline，非 gate |
| 2026-09-02 | T1 slice 1/2：`npx vitest run src/sim/trackingTrajectory.test.ts` | 30/30 passed（首次執行 4 個 reversal 相關測試失敗，觸發 D-54.12 返工，改版後全綠） |
| 2026-09-02 | T1 slice 1/2：`npx tsc --noEmit` | exit 0 |
| 2026-09-02 | T1 slice 1/2：`npx vitest run`（全專案） | 191 files / 1755 tests passed（2 skipped），無回歸 |
| 2026-09-02 | T1 slice 2/2：`npx vitest run src/data/exportPayloadSchema.test.ts src/sim/trackingTrajectory.test.ts` | 84/84 passed |
| 2026-09-02 | T1 slice 2/2：`npx tsc --noEmit` | exit 0（`DrillEvent` 61 callers 未受 additive union 影響） |
| 2026-09-02 | T1 slice 2/2：`npx vitest run`（全專案） | 191 files / 1766 tests passed（2 skipped），無回歸 |
| 2026-09-02 | T1 slice 2/2：`graphify update .` / `codegraph sync .` | graph 重建（3884 nodes/9158 edges/240 communities）；codegraph 索引已最新 |
| 2026-09-02 | T3：`npx tsc --noEmit` | exit 0 |
| 2026-09-02 | T3：`npx vitest run src/metrics/trackingDynamics.test.ts` | 19/19 passed（首次執行 5 個失敗：靜態目標令 target omega 恆為 0、退化成 `lag-peak-ambiguous`；400-tick 視窗令 fixed-lag 誤差達 5 tick；`windowEndMs=Infinity` 未被真實資料夾住令 reversal-window 的 run-尾端排除失效——三者修正後全綠，詳見 D-54.15 與上方 fixture 說明） |
| 2026-09-02 | T3：`npx vitest run`（全專案） | 194 files / 1844 tests passed（2 skipped），對照 T2 slice 6 的 193/1825 baseline，無回歸 |

