# Stage 11 — progress / decision log

## Status

- **Current**：✅ M19（WP-52/WP-53）完成（2026-09-02）；🟡 M20（WP-54 tracking pilot）T0-T4 完成、T5 待開工（2026-09-02）；🟢 M21（WP-55 tracking observability/no-health）T0-T2 完成、T3 待開工（2026-09-03）。
- **Scope state**：WP-52 pilot v2 adjustment 已交付；WP-53 formal `peek_click_transfer_v1` release 已完成 T0~T5 與 T-exit；WP-54 tracking pilot 已正式納入 stage11，T0-T4 完成；WP-55 已正式納入 stage11，第一版以 export 後 derived contact artifact 為主，不做 health/damage lifecycle。
- **Dependency state**：WP-52 T-exit、WP-53 formal freeze、stage10 history/trend contract、formal Session Plan integration、focused E2E 與 docs sync 全數完成（M19）。WP-54 T0 依賴的 legacy tracking baseline（103 tests）綠燈、OQ-54-1~8 preregistration 凍結、CodeGraph impact 記錄完成；T1 deterministic trajectory kernel + export contract 交付；T2 pilot drill matrix（practice/calibration/core 2×2/reversal density）+ no-fire/no-ADS/no-movement protocol guard 交付；T3 canonical P0/P1 metrics（lag/gain/drop/recovery/reversal）+ truth fixtures 交付；T4 eligibility/evidence pipeline（closed quality-reason vocabulary、WP-54 compatibility key、deterministic JSON evidence、self-contained HTML report）交付，全程 legacy tracking regression 保持綠燈（M20）。WP-55 T0 凍結現有三個 tracking drill roster、OQ-55-1~4、no-health boundary、CodeGraph blast radius 與 50-test baseline；T1 已凍結 contact geometry contract；T2 已交付 deterministic export-derived contact JSON artifact（M21）。

## Progress

### 2026-09-03 — WP-55 T2 export-derived artifact

- WP-55 T2 完成：新增 `src/metrics/trackingContactArtifact.ts` 與 `src/metrics/trackingContactArtifact.test.ts`。Artifact schema 為 `tracking-contact-artifact-v1`，輸出 analysis/source/drill/schema/simHz/geometry/sample identity，並只從 raw export 經 T1 contact derivation 產生。
- Blocked artifact 沿用 WP-55 closed seven-reason vocabulary，不含 `samples`，不輸出 fake zero TOT 或空 contact timeline；缺失 traceable run identity 會 blocked `protocol-incompatible`。
- T2 verification：artifact focused 7/7 passed；contact+artifact+trackingDerivation 26/26 passed；T2 + legacy tracking/BR baseline 66/66 passed；`npm.cmd run typecheck` exit 0；30 秒 128 Hz synthetic reference export（3840 ticks）通過 < 500 ms gate。`graphify update .` 已執行；generated `graphify-out` 因包含本地未相關檔案 metadata 而還原、不納入 T2 commit。

### 2026-09-03 — WP-55 T1 contact geometry contract

- WP-55 T1 完成：新增 `src/metrics/trackingContact.ts` 與 `src/metrics/trackingContact.test.ts`。Contact derivation fail-closed 後復用既有 `deriveTrackingSamples()`，使 `onTarget` 與 `epsilonDeg` 和 canonical tracking metrics 同源；不進 sim/render hot path，不新增 health/HP/damage/kill lifecycle。
- T1 evidence：typed contract、perfect/miss/edge/invisible/boundary/scored_start、metadata/default hitbox、blocked reasons 與 `deriveTrackingMetrics()` parity fixtures 全綠。Focused tests 9/9、trackingDerivation regression 10/10、legacy tracking/BR baseline 50/50、`npm.cmd run typecheck` exit 0。

### 2026-09-03 — WP-55 T0 entry gate/scope freeze/no-health audit

- 使用者要求實作 **WP-55 — Tracking On-target Observability without Health** T0，正式納入 stage11 M21；同步更新 stage11 [README](README.md)、[master checklist](task-checklist.md) 與 WP-55 自身 [progress](wp-55-tracking-on-target-observability-no-health/progress.md)。
- 凍結 OQ-55-1~4：第一版先做離線 deterministic contact JSON/HTML artifact，不做產品 Replay overlay；必達覆蓋現有 `tracking_v1`、`tracking_longrange_v1`、`tracking_br_v1`；WP-54 新 tracking pilot drills 以同 contract adjacent 接入；BR ballistic hit 與 aim-ray contact 分欄，不混入 pure tracking summary。
- T0 evidence：HEAD/worktree、CodeGraph status、graphify freshness、actual target paths/blast radius、no-health/no-damage audit 與 legacy tracking baseline 50/50 passed 已記錄於 WP-55 progress。

### 2026-09-02 — WP-54 T3/T4 完成（詳見 [wp-54-tracking-pilot/progress.md](wp-54-tracking-pilot/progress.md)）

- T3：`src/metrics/trackingDynamics.ts` 新增 `deriveTrackingDynamics()`（lag/velocity gain/residual/
  directional bias/drop-reacquire recovery）與 `deriveTrackingReversalWindows()`（response latency/
  peak error/overshoot/settling time），P0 沿用未修改的 `trackingDerivation.ts` 透過 shallow-copy
  adapter 窗口到 `scored_start`。8 條 truth fixture 覆蓋 NFR-54-2/3 容差、blocked semantics。
- T4：`src/pilot/trackingRunEligibility.ts`（closed `TrackingQualityReason` 8 碼 + 
  `evaluateTrackingRunEligibility()`，run-level quality gate）、`trackingCompatibilityKey.ts`
  （WP-54 專屬 8 軸 compatibility key，不可重用既有 `compatibilityKey.ts`——它強制要求
  `meta.assessment`，WP-54 全 practice-mode 恆缺席）、`trackingPilotEvidence.ts`（deterministic
  `TrackingPilotEvidence` JSON model，偏離 README 鎖定的 manifest-based 簽名，因 T5 manifest 型別
  尚未存在）、`trackingPilotReport.ts`（self-contained HTML report，parity-by-construction 設計）。
  `trackingPilotHistoryExclusion.test.ts` 鎖住既有事實：WP-54 pilot run 從未進入
  `DrillMetricRegistry`，無需新蓋 guard。

### 2026-09-02 — WP-54 T1/T2 完成（詳見 [wp-54-tracking-pilot/progress.md](wp-54-tracking-pilot/progress.md)）

- T1：`src/sim/trackingTrajectory.ts` 新增 `band-limited-2d-v1`（seeded band-limited pursuit）與
  `reversal-2d-v1`（finite-acceleration random reversal）trajectory kernel + `projectTrackingAngles()`
  角度轉世界座標投影 + additive `target_motion_change` export event（parse 側）。
- T2：additive `DrillConfig.targets.trackingTrajectory`/`timing.trackingPrepMs`/`protocolGuard` 契約
  （schema 驗證 + clearance envelope 展開）；`TargetManager` trajectory drive + `scored_start`/
  `target_motion_change` producer；`DrillRunner.tickProtocolGuard`（no-fire/no-ADS/no-movement
  edge-triggered、不阻擋輸入）；export metadata opaque pass-through；9 個實際 pilot block config
  （`src/drill/tracking_core_pr_pilot_v1.ts`、`tracking_reversal_pilot_v1.ts`）。
- 全程未修改任何既有 legacy drill 行為（`tracking_v1`/`_longrange_v1`/`_br_v1` 等）；每個 slice 完成
  後全專案 `npx vitest run` 保持綠燈。`graphify update .`/`codegraph sync .` 已於 T2 收尾執行。
- T3（canonical P0/P1 metrics/truth fixtures）待開工，依賴 T2 交付的 `scored_start`/
  `target_motion_change`/`protocol_violation` events 與 trajectory config 的 export round-trip。

### 2026-09-02 — WP-54 T0 entry gate/scope freeze/preregistration

- 使用者確認正式接受 **WP-54 — Tracking Pilot Capability Test** 納入 stage11，作為獨立 M20 里程碑（不與 M19 peek-click-transfer 範圍/drill id 混合）。
- 同步更新 stage11 [README](README.md)、[master checklist](task-checklist.md) 新增 WP-54 段落；WP-54 自身 T0 細節（HEAD/worktree/CodeGraph impact/OQ 凍結/legacy baseline 103 tests 全綠）見 [wp-54-tracking-pilot/progress.md](wp-54-tracking-pilot/progress.md)。
- 本次只改文件，未修改 production code，因此未執行 `graphify update .`。

### 2026-08-28 — Planning

- 依使用者要求使用 `.claude/skills/engineering-planning/SKILL.md` 建立 stage11 規劃。
- 明確決定不原地修改 `peek-click-transfer-pilot-v1` 成正式版；調整後 pilot 以 `peek_click_transfer_pilot_v2` 表達，正式版以 `peek_click_transfer_v1` 表達。
- 新增 stage11 stage spec、master checklist、WP-52 與 WP-53 自足規格。
- 本次只新增文件，未修改 production code。

### 2026-09-02 — WP-53 T-exit / M19 achieved

- WP-53 T-exit 完成：full CI exit 0、transfer-focused E2E 4/4 passed、operational docs 與 exec-plan navigation 已同步、staged file audit 完成。
- Stage11 狀態改為完成：WP-52/WP-53 全數 T-exit，正式 `peek_click_transfer_v1` 可進 Assessment Session Plan、history 與 trend registry；pilot v1/v2 仍維持 practice-only / formal cohort 隔離。
- 本輪只改文件，未改 production code，因此未執行 `graphify update .`。

## Decision log

| ID | 決策 | 理由 | 狀態 |
|---|---|---|---|
| D-11.1 | 保留 `peek-click-transfer-pilot-v1`，新增 `peek_click_transfer_pilot_v2` 承載調整後 pilot | 避免同一 drill id 代表兩套 pilot 協定，保留 WP-45 evidence 可追溯性 | ✅ Confirmed（WP-52） |
| D-11.2 | 正式版新增 `peek_click_transfer_v1`，不沿用 pilot id | Assessment/history/compatibility 需要穩定正式 id 與 `meta.assessment` | ✅ Confirmed（WP-53） |
| D-11.3 | WP-53 T0 必須引用 WP-52 evidence 才能 freeze | 防止未經 pilot evidence 直接發布正式 Assessment | ✅ Confirmed（GD-29） |
| D-11.4 | WP-55 正式納入 stage11 作為 M21，但第一版不新增 health/HP/damage/kill tracking contract | Tracking contact 是逐 tick aim-ray / hitbox observability；shooting outcome 只能作 BR companion evidence | ✅ Confirmed（WP-55 T0） |

## Open Questions

| ID | 問題 | Owner | Deadline | Impact |
|---|---|---|---|---|
| OQ-S11-1 | 調整後 pilot v2 要採用哪組 target angular size / timeout / sequence / target count 候選？ | 使用者 + 研究者 | WP-52 T0 | ✅ Resolved（WP-52：1/2.5/5 deg，3000 ms timeout，20 presentations） |
| OQ-S11-2 | formal `peek_click_transfer_v1` 的 minimum pilot evidence 門檻為何？ | 使用者 + 研究者 | WP-52 T4 | ✅ Resolved（GD-29：n=1 smoke-test threshold accepted for this freeze） |
| OQ-S11-3 | 正式 Session Plan 是否把 transfer 作為第五 Assessment 家族，或只提供獨立 transfer plan？ | 使用者 | WP-53 T0 | ✅ Resolved（獨立 family id `'peek-click-transfer-v1'`，不改 stage6 default roster） |
| OQ-S11-4 | WP-55 Replay 可觀測性第一版做到產品 UI 或離線 artifact？ | 使用者 | WP-55 T0 | ✅ Resolved（先做離線 JSON/HTML replay/contact artifact；產品 Replay overlay optional/future） |
| OQ-S11-5 | WP-55 必達 tracking roster 是否包含 WP-54 新 pilot drills？ | 使用者 + 研究者 | WP-55 T0 | ✅ Resolved（必達矩陣只含既有三類；WP-54 drills adjacent 接入同 contract） |

## Verification log

| Date | Command | Result |
|---|---|---|
| 2026-08-28 | `Get-Content .claude/skills/engineering-planning/SKILL.md` | skill loaded |
| 2026-08-28 | `Get-Content AGENTS.md` / `Get-Content graphify-out/GRAPH_REPORT.md` | project planning rules loaded |
| 2026-08-28 | `mcp__codegraph__codegraph_explore` for transfer/session/history symbols | current interfaces and blast radius reviewed |
| 2026-09-01 | WP-52 T0 entry gate（v1 audit／OQ-52-1~3 拍板；detail 見 [wp-52 progress.md](wp-52-peek-click-transfer-pilot-v2/progress.md)） | 8 files / 111 tests baseline 全綠；未改 production code |
| 2026-09-01 | WP-52 T1-T4 完成（config/session wiring/evidence report/manual gate doc；detail 見 [wp-52 progress.md](wp-52-peek-click-transfer-pilot-v2/progress.md)）；T2 途中發現並解決 GD-24/FR-G9 vs. WP-43/FR-H3 跨 WP 矛盾（見 [DECISIONS.md GD-26](../../DECISIONS.md)） | 全數 focused unit + Playwright 綠燈；**WP-53 go/no-go：No-go，待真人 pilot 執行**（D-52.8） |
| 2026-09-02 | WP-53 T-exit（detail 見 [wp-53 progress.md](wp-53-peek-click-transfer-v1-formal-release/progress.md)） | `npx.cmd tsc --noEmit` exit 0；`npx.cmd vitest run` 190 files / 1725 tests passed（2 skipped）；focused Playwright 4/4 passed |
| 2026-09-02 | WP-54 T0（detail 見 [wp-54-tracking-pilot/progress.md](wp-54-tracking-pilot/progress.md)） | 使用者確認納入 stage11；OQ-54-1~8 凍結；CodeGraph impact 記錄；11 個既有 tracking 相關檔案 103/103 tests passed（baseline，非 gate） |
| 2026-09-03 | WP-55 T0（detail 見 [wp-55-tracking-on-target-observability-no-health/progress.md](wp-55-tracking-on-target-observability-no-health/progress.md)） | 使用者確認納入 stage11；OQ-55-1~4 凍結；CodeGraph impact/no-health audit 記錄；10 個 tracking/BR baseline files 50/50 tests passed |
| 2026-09-03 | WP-55 T1（detail 見 [wp-55-tracking-on-target-observability-no-health/progress.md](wp-55-tracking-on-target-observability-no-health/progress.md)） | `src/metrics/trackingContact.test.ts` 9/9 passed；contact + canonical trackingDerivation regression 19/19 passed；legacy tracking/BR baseline 50/50 passed；`npm.cmd run typecheck` exit 0 |
| 2026-09-03 | WP-55 T2（detail 見 [wp-55-tracking-on-target-observability-no-health/progress.md](wp-55-tracking-on-target-observability-no-health/progress.md)） | `src/metrics/trackingContactArtifact.test.ts` 7/7 passed；contact + artifact + trackingDerivation regression 26/26 passed；T2 + legacy tracking/BR baseline 66/66 passed；`npm.cmd run typecheck` exit 0；30 s / 3840 tick artifact perf gate passed；`graphify update .` executed but graphify-out not staged because unrelated local files were indexed |
