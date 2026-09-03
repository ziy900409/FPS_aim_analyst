# WP-54 — Task Checklist

> Tech spec：[README.md](README.md) · Running log：[progress.md](progress.md)
>
> 狀態符號：`[ ]` pending · `[-]` in progress · `[x]` complete。WP-54 已於 2026-09-02 正式納入 stage11（T0 完成）。

| Done | Task | Objective | Dependencies | Risk |
|---|---|---|---|---|
| [x] | **T0** Entry gate/scope freeze/preregistration | 凍結 stage scope、OQ、metric protocol、blast radius 與 baseline evidence | 使用者確認 WP-54 是否納入 stage11 | High |
| [x] | **T1** Deterministic trajectory kernel/export contract | 新增 2D pseudorandom 與 finite-acceleration reversal generator | T0 | High |
| [x] | **T2** Pilot drill matrix/protocol guards | 新增 practice、axis calibration、core 2 x 2、reactive blocks 與 no-fire/no-ADS/no-movement guard | T1 | High |
| [x] | **T3** Canonical P0/P1 metrics/truth fixtures | 推導 acquisition、RMS/TOT、lag/gain、drop/reacquire、reversal response | T2 | High |
| [x] | **T4** Eligibility/evidence/report | 建立 quality reason vocabulary、compatibility、deterministic JSON/HTML evidence | T3 | High |
| [x] | **T5** Researcher manifest/operator flow | 支援 counterbalance、rest、retry reason、session index 與 keyboard flow | T2/T4 | Med |
| [x] | **T6** Instrumentation pilot | 以 synthetic + 3-5 tester runs 驗證 motion/event/export/report traceability | T1-T5 | High |
| [ ] | **T7** Difficulty calibration pilot | 以 12-20 人校準 floor/ceiling、seed、visibility、time-on-task | T6 PASS | High |
| [ ] | **T8** Repeatability/validity pilot | 以兩次 session 驗證 ICC、CV/SEM、Bland-Altman、alternate seed equivalence | T7 PASS + OQ-54-5/6 frozen | High |
| [ ] | **T-exit** M20 evidence audit/handoff | 審核全需求追溯、evidence、docs、manual gate 與 go/revise/stop | T6 PASS、T7 PASS、T8 formal conclusion | Med |

## T0 — Entry gate/scope freeze/preregistration

- [x] 更新 stage11 [README](../README.md)、[master checklist](../task-checklist.md) 與 [progress](../progress.md)，明確接受或延後 WP-54。
- [x] 記錄 HEAD、worktree status、CodeGraph status/pending、graphify freshness。
- [x] 對 `TargetMotion`、`motionOffset()`、`TargetManager`、schema/export events、metrics、Result/history consumers 執行 CodeGraph impact。
- [x] 凍結 OQ-54-1～OQ-54-7：steady/reactive scope、condition matrix、block duration、lag contract、repeatability threshold、sample/session、artifact destination。
- [x] 凍結 primary outcome、exclusion rules、ceiling/floor decision flags、metric version 與 pilot protocol version。
- [x] 重跑或記錄 legacy tracking baseline tests，不把舊數字當 gate。
- [x] 保存 preregistration snapshot；後續變更以新 protocol version 與 decision log 表達。

## T1 — Deterministic trajectory kernel/export contract

- [x] 實作 band-limited 2D trajectory config validation（`src/sim/trackingTrajectory.ts` `createTrackingTrajectory` / `band-limited-2d-v1`）。
- [x] 實作 finite-acceleration reversal trajectory 與 precomputed change schedule（`reversal-2d-v1`，rest-to-rest trapezoid legs，`changes` 陣列）。
- [x] position/velocity 僅依 `(config, seed, age)`（`sample(ageSec, out)` 純函式；建構時一次性算出係數/schedule）。
- [x] 實作 angular-to-world projection（`projectTrackingAngles(yawDeg, pitchDeg, origin, out)`，`src/sim/trackingTrajectory.ts`）——純幾何函式，`TargetManager` 實際接線（決定 `origin`/如何寫回 `TargetState.pos`）留給 T2，符合 T1「trajectory kernel」與 T2「pilot drill matrix」的責任切分。
- [x] motion 熱路徑使用 caller-owned buffer，不在每 tick 配置新物件（`sample()`/`projectTrackingAngles()` 只寫入呼叫端 `out`；construction-time 才配置係數/schedule 陣列）。
- [x] 新增 additive `target_motion_change` export event 與 schema parse/serialize round-trip（`DrillEvent` union in `src/data/DataRecorder.ts` + `parseTargetMotionChangeEvent` in `src/data/exportPayloadSchema.ts`；CSV 匯出刻意不新增欄——沿用專案既有「不新增 CSV 欄，重用既有欄」慣例，語意相符的既有欄留待 T2 實際接線後一併決定，見 progress.md）。
- [x] 建立 continuity、bounds、speed statistics、event crossing、reset reproducibility tests（`src/sim/trackingTrajectory.test.ts`，35 tests；`src/data/exportPayloadSchema.test.ts` +19 tests）。
- [x] 建立 60/120/240 Hz pump determinism tests（純函式 age 求值 pump-cadence-equivalence tests）。
- [x] 確認 `tracking_v1`、`tracking_longrange_v1`、`tracking_br_v1` snapshot 無 semantic diff（11 檔 103 tests 全綠，見 progress.md）。

## T2 — Pilot drill matrix/protocol guards

- [x] 新增 practice block，並保證不寫入 scored aggregation（`tracking_core_pr_pilot_v1_practice`，
      `mode:'practice'`、無 `trackingPrepMs`/`protocolGuard`，T2 slice 5）。
- [x] 新增 horizontal/vertical axis calibration blocks（`tracking_core_pr_pilot_v1_calibration_
      horizontal`/`_vertical`，T2 slice 5）。
- [x] 新增 core pseudorandom 2 x 2 size/speed candidate blocks（`TRACKING_CORE_PR_PILOT_V1_CANDIDATES`，
      2.0/0.5 deg × 5/20 deg/s，T2 slice 5）。
- [x] 新增 medium/high reversal density candidate blocks（`TRACKING_REVERSAL_PILOT_V1_CANDIDATES`，
      `src/drill/tracking_reversal_pilot_v1.ts`，T2 slice 5）。
- [x] 每個 block export metadata 包含 drill id、trajectory version、seed、condition、angular size/speed、
      duration（`meta.drillId` 承載 drill id/condition——每個 candidate 給獨立 drillId；`meta.spawn.
      trackingTrajectory` 原樣帶出 `DrillConfig.targets.trackingTrajectory` 整包物件，version/seed/
      angular size/speed/duration 全部已在該物件內、single source，不重複定義，T2 slice 4）。
- [x] 建立 scored start/practice boundary event，且 scored 前 1 秒置中不進分析（`timing.trackingPrepMs`
      + `scored_start` DrillEvent，`TargetManager`/`SimLoop` 接線，T2 slice 2）。
- [x] 建立 no-fire/no-ADS/no-movement protocol violation 記錄（`DrillConfig.protocolGuard` +
      `DrillRunner.tickProtocolGuard` + `protocol_violation` DrillEvent，T2 slice 3；edge-triggered，
      不阻擋輸入本身）。
- [x] 驗證 target visibility、scene clearance、angular size/speed round-trip（`clearance.test.ts`
      envelope 展開、`TargetManager.test.ts`/`SimLoop.test.ts` trajectory drive round-trip，T2 slice 1-2）。

## T3 — Canonical P0/P1 metrics/truth fixtures

- [x] 重用 canonical `deriveTrackingMetrics()` 組裝 P0 acquisition/RMS/TOT（`adaptPayloadForScoredWindow()`
      shallow-copy adapter，`trackingDerivation.ts` 本體未修改）。
- [x] 實作 target/aim angular kinematics（`computeSignedOmegaSeries()`，signed 2D、tick-integral、
      wraparound-safe，`src/metrics/trackingDynamics.ts`）。
- [x] 實作 lag search、positive-lag sign contract、velocity gain、velocity residual、directional bias
      （`searchLag()` + `computeSignedBias()`；離線固定係數平滑 `smoothingVersion` 見
      `applySmoothingToSeries()`）。
- [x] 擴充 recovery aggregation：drop/sec、completed reacquire durations、terminal censor count、
      longest off-target（重用 `deriveTrackingTransitions()` + `scanLongestOffTarget()`）。
- [x] 實作 reversal event windows：response latency、peak error、overshoot、settling time
      （`deriveTrackingReversalWindows()`，additive function — README §2.4 `TrackingDynamicsResult`
      無此欄位，見 progress.md 決策）。
- [x] fixtures 覆蓋 perfect follower、fixed lag、gain `0.7/1.0/1.3`、never acquire。
- [x] fixtures 覆蓋 drop/reacquire、terminal drop、overshoot/settling、lag ambiguity。
- [x] 公式、容差、blocked semantics 回寫 `docs/operational/analysis-tracking.md`（新增 P1 章節）。

## T4 — Eligibility/evidence/report

- [x] 定義 closed `TrackingQualityReason` vocabulary（`src/pilot/trackingRunEligibility.ts`，T4 slice 1/6）。
- [x] 在 metrics 聚合前判定 schema/manifest/version、overflow、timestamp、missing target、coverage、protocol compatibility（`evaluateTrackingRunEligibility()`，T4 slice 1/6；`buildTrackingPilotEvidence()` 對 blocked run 完全不呼叫 metric derivation，T4 slice 3/6）。
- [x] 實作 run-level 與 metric-level eligibility；P1 blocked 不刪除仍有效的 P0（`trackingPilotEvidence.test.ts` 的 never-acquire fixture 鎖住，T4 slice 3/6）。
- [x] 定義 compatibility fields：drill、protocol、motion、size、speed、FOV、sensitivity、input mode（`src/pilot/trackingCompatibilityKey.ts`，T4 slice 2/6；`inputMode` 語意見 progress.md OQ-54-9）。
- [x] 產生 deterministic `TrackingPilotEvidence` JSON（`src/pilot/trackingPilotEvidence.ts`，T4 slice 3/6；`buildTrackingPilotEvidence()` 簽名偏離 README §2.4 見 progress.md D-54.20）。
- [x] 產生 self-contained HTML report，至少包含 quality、RMS/TOT、acquisition、lag/gain、drop/recovery、condition matrix、target/aim trace（`src/pilot/trackingPilotReport.ts`，T4 slice 4/6）。
- [x] HTML/JSON 數值 parity test 通過；blocked 指標顯示原因，不顯示 0（`src/pilot/trackingPilotReport.test.ts`，T4 slice 4/6；parity-by-construction 設計見 progress.md）。
- [x] benchmark 單一 30 秒 export analysis；若 >2 秒，只記 worker spike（T4 slice 5/6：~23ms 冷/~8ms 暖，遠低於門檻，未加 concurrency；見 `docs/operational/analysis-tracking.md`「Benchmark」節與 progress.md）。
- [x] README §4 T4 DoD 額外一項：practice/pilot run 被 history guard 排除（`src/pilot/trackingPilotHistoryExclusion.test.ts`，T4 slice 6/6；鎖住既有事實——`DrillMetricRegistry.REGISTRATIONS` 從未註冊任何 WP-54 tracking pilot drillId，且 `project()` 對全部 9 個 T2 pilot block 皆回傳 `unregistered-drill`——不新蓋一層 guard 機制）。

## T5 — Researcher manifest/operator flow

- [x] 定義 `TrackingPilotManifest`、counterbalance cell、session index、alternate seed family
      （`src/session/trackingPilotManifest.ts`，`TrackingPilotBlock={drillId,seedFamily}`，
      counterbalance 重用 WP-41 `buildFamilyOrderForRoster()`，T5 slice 1/5）。
- [x] Researcher-only runner 可執行 practice -> scored block -> rest -> export
      （`src/session/TrackingPilotRunner.ts` `createTrackingPilotRunner()`，phase state machine
      比照 `SessionRunner.ts`，T5 slice 2/5）。
- [x] 操作端顯示 current block/rest/quality abort，不顯示即時能力分數
      （`src/ui/TrackingPilotOperatorScreen.ts`，只顯示 closed `TrackingRunEligibility` reason
      codes/coverage 事實，從不顯示 RMS/TOT/lag/gain 等能力數字，T5 slice 3/5）。
- [x] 記錄 completion、abort、retry reason；retry 不覆蓋原 export
      （`TrackingPilotRunner.records[]`/`retryLog[]`，append-only，T5 slice 2/5；screen 端
      `renderRecords()` 呈現，T5 slice 3/5）。
- [x] manifest replay 產生相同 order/seed；非法 manifest fail fast
      （`buildTrackingPilotManifest()` 決定性、`parseTrackingPilotManifest()` fail-fast on 未知
      drillId/重複 block/seed 家族衝突，T5 slice 1/5，27 tests）。
- [x] keyboard-only/focus/status text walkthrough 完成，品質狀態不只靠顏色表達
      （`tests/e2e/tracking-pilot-operator.spec.ts`，真實瀏覽器 Playwright keyboard-only spec，
      比照既有 `stage10-accessibility.spec.ts` 慣例；過程中抓到並修復一個真的 WCAG 2.5.3 Label in
      Name a11y bug，T5 slice 4/5）。

## T6 — Instrumentation pilot

> **Gate A = 部分通過（2026-09-03，第三輪 P04+P05，使用者決定）**。
> **通過的部分**：資料鏈路（四層對帳全綠、8 個 scored 條件皆 `eligible=2`、刺激逐位符合宣稱）
> 與 **reversal 家族**（凍結準心比值 2.1–3.3 ⇒ 測得到跟槍）⇒ **T7 可開工**。
> **退回 T7 的部分**：**band-limited 核心矩陣**——慢速（5 deg/s）三個 cell 與兩個 axis calibration
> block 的 ε 動態範圍只有 0.75°、真人離「完全不動」僅 10–25%（比值 1.05–1.25）⇒ **測不出跟槍
> 能力**，須以「凍結準心比值」為量化目標重新參數化（[OQ-54-14](progress.md#open-questions)）。
> 三輪歷程：§10（第一輪 P01，REVISE）→ §11（第二輪 P03，REVISE）→ **§12（第三輪，本判定）**，
> 見 [T6-instrumentation-gate.md](T6-instrumentation-gate.md)。第三輪**無 instrumentation defect**
> （三輪來第一次）。

- [x] 3-5 位內部/熟練 tester，每條件至少 2 次。（**每條件 ≥ 2 份可用 run ✅**：第三輪 P04 s0 +
      P05 s1 合併後 8 個 scored 條件皆 `eligible=2`。**tester 人數 2 位 < §6 的 3–5 位**，使用者
      決定以此結案並記錄理由（[OQ-54-12](progress.md#open-questions)）;遺留代價 = 21 份 payload
      全來自同一台 60 Hz / 3840×2160 / Edge 151 機器，`displayRefreshHz` 至今無第二種刷新率驗證，
      跨面板覆蓋留 T7）
- [x] 驗證 trajectory 連續性、bounds、event 對表、angular size/speed round-trip。（**第三輪全過**：
      event 對表 58/58・29/29・55/55・42/42 `mismatched=0`；**speed 終於被交付**——交付/宣稱
      0.989–1.017（KI-023 落地後，重建量法與錄到的位置反推兩種算法一致）；size 以 sphere hitbox
      交付且 `widthU` round-trip。新增 layer 3b **刺激保真度**：21/21 payload 與現行程式重建的刺激
      逐位一致（≤ 8.9e-16 u），套回作廢的 P03（G2）批次則 11 份中 8 份被判 mismatch）
- [x] 驗證 quality flags、export metadata 與 report traceability。（第一輪已全過；**第三輪再次
      成立**：21/21 schema v2、覆蓋率 3202–3203 ticks / 25008–25016 ms、`meta.session` 追溯完整、
      practice 排除、HTML/JSON parity ok ×3；3 個 `protocol-violation` 被閘門正確擋下且 retry 合格）
- [x] 任何 defect 先最小化、補 regression fixture，再重跑 affected conditions。（累計已修 7 個，
      各自 commit + regression test：main.ts boot-window TDZ、operator overlay restore、practice
      進入 scored aggregation、KI-019 F-A1、run-level protocol-violation 閘門、
      [KI-022](../../../known_issue/KI-022-pilot-analysis-summary-reads-blocked-first-attempt.md)、
      [KI-023](../../../known_issue/KI-023-target-speed-set-point-is-per-axis-not-2d.md)。
      **第三輪無新 defect**——三輪來第一次）
- [-] 0.5° 條件在真實顯示器上可辨識。（**❌ 不可辨識,連兩個單軸 calibration 也看不見**（操作員
      2026-09-03 回報，修正後的 5 / 20 deg/s 下）。依 §10.5/§6 **不放大目標、不偷偷淘汰條件**，
      照實留檔;客觀對照見 gate §12.8 ⇒ 這是核心矩陣退回 T7 的直接證據）
- [x] 產出 `instrumentation-gate-v1` evidence，含資料版本、分析版本、環境與 go/revise/stop。
      （[T6-instrumentation-gate.md](T6-instrumentation-gate.md) §12：資料版本 P04 s0 ×10 +
      P05 s1 ×11 / 2026-09-03、分析版本 `a786e4b`（+ layer 3b 於 `139b559`）、刺激基線 `f191642`、
      環境 60Hz/WebGPU/COI true/Edge 151、結論 **部分通過**）
- [x] Gate A 失敗時停止，不以更多真人樣本掩蓋。（2026-09-03 實際執行：判 revise 並停在刺激決策上，
      未要求補人；D-54.39 記錄「份量不足不是判 revise 的原因」以防後續誤讀）

### T6 工程 slice（已 commit）

- [x] **slice 1**：`createTrackingPilotSession()` wiring seam + `main.ts` 接線
      （`activateDrill()`/`loadDrillConfigDirect()`、研究員選單第 4 個入口、render-loop poll、
      drill-ended handoff），12 tests。
- [x] **slice 2**：`tests/e2e/tracking-pilot-live.spec.ts` 真瀏覽器 live walkthrough（practice +
      calibration 兩個真實 25s block、下載 JSON 追溯欄位斷言），修 2 個真 bug。
- [x] **slice 3**：practice block 不入 scored aggregation（`isTrackingPilotPracticeDrillId()` +
      `excludedPracticeRunCount`），+4 regression tests，回寫 `analysis-tracking.md`。
- [x] **slice 4**：`T6-instrumentation-gate.md`（Gate A 帳本）+ runbook 正式操作章節 + graphify。
- [x] **slice 5**：`scripts/analyze-tracking-pilot.ts` 可重跑分析 runner（跑既有實作四層 + parity
      檢查），D-54.37。
- [x] **slice 6**：KI-019 F-A1 修復（reversal 排程貼牆退化）+ 3 個回歸測試 + BD-019。
- [x] **slice 7**：run-level `protocol-violation` 閘門（FR-54-10）+ 3 個回歸測試。
- [x] **slice 8**：KI-020 診斷 + BD-020 + Gate A = REVISE 結論 + 文件同步（D-54.38/39）。
- [x] **slice 9**：KI-019 F-A2 落地（reversal 視窗 ±13° + 建構期幾何守衛）+ 4 個 fixture 對齊。
- [x] **slice 10**：KI-020 落地（size→cube hitbox、頻帶 [0.3,2.1]Hz + 共用振幅 ±16°、建構期速度
      守衛）+ 7 個新測試 + 4 個 fixture 對齊（D-54.40）。
- [x] **slice 11**：compatibility key 新增 `displayRefreshHz`/`targetHitboxWidthU`、`sizeDeg` 更名
      （OQ-54-11 / D-54.41）。
- [x] **slice 12**：KI-021 落地後，兩個 pilot 家族的 hitbox 由 cube 改回 **sphere**（`shape:'sphere'`，
      直徑不變），並同步描述現況的文件（GD-30／D-54.42）。**這是 9-block 重跑的前置**。
- [x] **slice 13**：第二輪（P03）批次識別與分析——批次一律以 `meta.session.participantId` 判定，
      不信路徑/檔名配對（Downloads 內同時存在 P01/P02/P03 三批）。
- [x] **slice 14**：Gate A 第二輪帳本（§11）+ KI-023 診斷（交付速度是每軸量）。
- [x] **slice 15**：KI-023 落地（速度 set-point 改 2D 語意，含 reversal 家族，Option A）。
- [x] **slice 16**：Gate A 第三輪帳本（§12，P04 + P05，G3 刺激）——四層對帳全綠、無 defect。
- [x] **slice 17**：分析 runner 新增 **layer 3b 刺激保真度**（錄到的位置 vs 現行程式重建），
      `scripts/trackingStimulusFidelity.ts` + 4 個回歸測試（含「metadata 相同、位置乘 √2 → mismatch」
      這個 KI-023 類缺陷的守門案）;視線幾何由 payload 自身反解，不寫死 sim 常數（D-54.43）。
- [x] **slice 18**：OQ-54-12（以 2 位 tester 結案）/ OQ-54-13（ADS 違規只加強 runbook 提示）落地。
- [x] **slice 19**：0.5° 主觀回報的客觀對照（§12.8）——凍結準心比值揭露慢速 cell 測不出跟槍能力;
      先排除渲染側 radius/diameter 混用。**這是 Gate A 部分通過判定的依據**（OQ-54-14）。

## T7 — Difficulty calibration pilot

> **T6 交接進來的必辦項（Gate A 部分通過，2026-09-03）**——見
> [T6-instrumentation-gate.md §12.8](T6-instrumentation-gate.md) 與
> [OQ-54-14](progress.md#open-questions)：
>
> - **band-limited 核心矩陣須重新參數化**，量化目標 = **凍結準心比值**（把準心凍結在受測者自己的
>   aim 中位數，重算 ε(t) 的 RMS ÷ 實際 RMS ε）。這是「這個條件能不能分辨會跟槍與不跟槍」的上界。
>   **實測錨點**：reversal 家族 **2.08–3.26**（有效）;20 deg/s cell 1.38–1.49;5 deg/s 三個 cell 與
>   兩個 axis calibration **1.05–1.25（無效）**。**閾值本身尚未凍結**，屬 T7 的預註冊決定。
> - **幾何約束**：`band-limited-2d-v1` 的行程 ≈ speed / 2πf ⇒ 在預註冊頻帶 [0.3, 2.1] Hz 下
>   5 deg/s 必然只能走 ±0.4–2.7°。**「慢又走得遠」必須降低頻帶下限**（代價：25 s block 內週期數
>   變少，任務性質往「緩慢漂移」偏移）。速度與頻帶皆為預註冊參數，變更須走研究決策。
> - **0.5° floor 證據**：操作員回報 0.5° 目標在 5 / 20 deg/s 下皆「幾乎看不見/只能猜」，**連單軸
>   calibration 也看不見**。依 §10.5 未放大目標，照實作為 T7 的 floor 輸入。
> - **跨面板覆蓋**：T6 的 21 份 payload 全來自同一台 60 Hz / 3840×2160 / Edge 151 機器，
>   `displayRefreshHz`（D-54.41）至今無第二種刷新率驗證 ⇒ T7 招募時應涵蓋不同刷新率/解析度。
> - **T7 前不應放寬的帶寬**：交付速度 0.95–1.05（KI-023）、`stimulusCheck()` 的量法。
> - **可考慮的工具化**：凍結準心比值目前是一次性探測腳本;若 T7 要拿它當設計目標，建議比照
>   slice 17 升成 `scripts/` 純函式 + 回歸測試再用。

### T7 工程 slice（已 commit）

- [x] **slice 2**：KI-024 診斷（`field-low` 未設 `eyeZ` ⇒ 交戰距離 8 u ≠ config 4 u ⇒ WP-54 全部 9 個 block 的角尺寸/角速度只交付 0.50×；機制上解釋「0.5° 看不見」= 實為 0.25°）+ BD-024 待決 + KI-024 §5.2 的頻帶候選比值表。**未動 production code、未改刺激**（修法屬研究決策）。
- [x] **slice 1**：凍結準心比值升成 `scripts/trackingFrozenCrosshairRatio.ts` 純函式
      + `tests/regression/tracking-frozen-crosshair-ratio.test.ts`（7 tests）+ 分析 runner
      **layer 5**（每 run 印 `discriminability ratio=…`）。與 canonical P0 `rmsEpsilonDeg`
      同一 tick 集與同一個 `angularEccentricityDeg()`（C-D4），結果隨行 `canonicalRmsEpsilonDeg`
      供每 run 對表。在 P04+P05 覆驗 §12.8：reversal 2.06–3.01 / 慢速 1.08–1.35 /
      20 deg/s 1.40–1.52。**未凍結任何閾值。**

### T7 gate 項

- [ ] 依 T0 preregistered protocol 招募 12-20 位不同 tracking 程度受測者。
- [ ] 分析 easy ceiling、hard acquisition floor、0.5 deg pixel/aliasing floor。
- [ ] 分析 seed equivalence、size x speed effect、block time slope。
- [ ] 每個 retained cell 至少 10 份 eligible runs。
- [ ] 依 preregistered rules 輸出 retained/revise/remove decision，不覆寫 v1 protocol。
- [ ] 未達 Gate B 時狀態為 revise，不進 T8。

## T8 — Repeatability/validity pilot

- [ ] 同一批受測者完成兩次 session，裝置與設定 compatibility 一致。
- [ ] 計算 condition-level RMS `epsilon` 的 ICC(A,1) + CI。
- [ ] 計算 within-subject CV/SEM 與 Bland-Altman bias/limits。
- [ ] 分析 TOT、lag、gain、drop 的 repeatability、metric redundancy、alternate-seed equivalence。
- [ ] 驗證 known manipulation：size、speed、reversal density 對不同 metric 的方向性。
- [ ] 所有 analysis script、input manifest、exclusion log 版本化且可重跑。
- [ ] 每個 M20 threshold 有 pass/fail；不以 p-value 單獨決定採納。

## T-exit — M20 evidence audit/handoff

- [ ] README §6 M20 exit gate 全部逐項對帳。
- [ ] Gate A/B/C evidence 均有 owner sign-off、資料版本、analysis commit、go/revise/stop。
- [ ] 若 repeatability 未達 preregistered threshold，以 revise/stop 結案，不發布 Assessment。
- [ ] 更新 `CONTEXT.md`、`DECISIONS.md`、`docs/operational/analysis-tracking.md`、stage progress/checklist。
- [ ] production code 若有修改，執行 `graphify update .`。
- [ ] Focused unit/integration/determinism/E2E、full CI 與 manual a11y walkthrough 全綠或有明確 blocker owner。
- [ ] `git status --short`、staged stat/names、artifact scan 完成，無真實 participant payload 進 git。

## Package Definition of Done

- [ ] WP-54 stage scope 已接受，或明確保持 future/candidate，不和 WP-52/WP-53 stage11 scope 矛盾。
- [ ] Legacy tracking drills 無 regression。
- [ ] New tracking pilot stimuli、metrics、eligibility、evidence artifact 均有 deterministic tests 與 truth fixtures。
- [ ] Researcher pilot protocol 可重建、可操作、可追溯，且不進正式 Assessment history/trend。
- [ ] Instrumentation、difficulty calibration、repeatability 三層 gate 都有 versioned evidence 與 decision。
- [ ] 不輸出 composite score、常模、處方或 formal release claim。

## Commit discipline

每個 task 單獨 commit；完成 task 後同步本清單、[progress.md](progress.md) 與 stage11 master 文件。發現上游 domain defect 時回 owning WP 修復並補 regression，不在 WP-54 checklist 裡混入未授權的產品語意。

