# WP-54 — Task Checklist

> Tech spec：[README.md](README.md) · Running log：[progress.md](progress.md)
>
> 狀態符號：`[ ]` pending · `[-]` in progress · `[x]` complete。WP-54 目前是候選 WP；正式開工前 T0 必須先讓 stage11 master README/checklist/progress 接受此範圍。

| Done | Task | Objective | Dependencies | Risk |
|---|---|---|---|---|
| [ ] | **T0** Entry gate/scope freeze/preregistration | 凍結 stage scope、OQ、metric protocol、blast radius 與 baseline evidence | 使用者確認 WP-54 是否納入 stage11 | High |
| [ ] | **T1** Deterministic trajectory kernel/export contract | 新增 2D pseudorandom 與 finite-acceleration reversal generator | T0 | High |
| [ ] | **T2** Pilot drill matrix/protocol guards | 新增 practice、axis calibration、core 2 x 2、reactive blocks 與 no-fire/no-ADS/no-movement guard | T1 | High |
| [ ] | **T3** Canonical P0/P1 metrics/truth fixtures | 推導 acquisition、RMS/TOT、lag/gain、drop/reacquire、reversal response | T2 | High |
| [ ] | **T4** Eligibility/evidence/report | 建立 quality reason vocabulary、compatibility、deterministic JSON/HTML evidence | T3 | High |
| [ ] | **T5** Researcher manifest/operator flow | 支援 counterbalance、rest、retry reason、session index 與 keyboard flow | T2/T4 | Med |
| [ ] | **T6** Instrumentation pilot | 以 synthetic + 3-5 tester runs 驗證 motion/event/export/report traceability | T1-T5 | High |
| [ ] | **T7** Difficulty calibration pilot | 以 12-20 人校準 floor/ceiling、seed、visibility、time-on-task | T6 PASS | High |
| [ ] | **T8** Repeatability/validity pilot | 以兩次 session 驗證 ICC、CV/SEM、Bland-Altman、alternate seed equivalence | T7 PASS + OQ-54-5/6 frozen | High |
| [ ] | **T-exit** M20 evidence audit/handoff | 審核全需求追溯、evidence、docs、manual gate 與 go/revise/stop | T6 PASS、T7 PASS、T8 formal conclusion | Med |

## T0 — Entry gate/scope freeze/preregistration

- [ ] 更新 stage11 [README](../README.md)、[master checklist](../task-checklist.md) 與 [progress](../progress.md)，明確接受或延後 WP-54。
- [ ] 記錄 HEAD、worktree status、CodeGraph status/pending、graphify freshness。
- [ ] 對 `TargetMotion`、`motionOffset()`、`TargetManager`、schema/export events、metrics、Result/history consumers 執行 CodeGraph impact。
- [ ] 凍結 OQ-54-1～OQ-54-7：steady/reactive scope、condition matrix、block duration、lag contract、repeatability threshold、sample/session、artifact destination。
- [ ] 凍結 primary outcome、exclusion rules、ceiling/floor decision flags、metric version 與 pilot protocol version。
- [ ] 重跑或記錄 legacy tracking baseline tests，不把舊數字當 gate。
- [ ] 保存 preregistration snapshot；後續變更以新 protocol version 與 decision log 表達。

## T1 — Deterministic trajectory kernel/export contract

- [ ] 實作 band-limited 2D trajectory config validation。
- [ ] 實作 finite-acceleration reversal trajectory 與 precomputed change schedule。
- [ ] 實作 angular-to-world projection，且 position/velocity 僅依 `(config, seed, age)`。
- [ ] motion 熱路徑使用 caller-owned buffer，不在每 tick 配置新物件。
- [ ] 新增 additive `target_motion_change` export event 與 schema parse/serialize round-trip。
- [ ] 建立 continuity、bounds、speed statistics、event crossing、reset reproducibility tests。
- [ ] 建立 60/120/240 Hz pump determinism tests。
- [ ] 確認 `tracking_v1`、`tracking_longrange_v1`、`tracking_br_v1` snapshot 無 semantic diff。

## T2 — Pilot drill matrix/protocol guards

- [ ] 新增 practice block，並保證不寫入 scored aggregation。
- [ ] 新增 horizontal/vertical axis calibration blocks。
- [ ] 新增 core pseudorandom 2 x 2 size/speed candidate blocks。
- [ ] 新增 medium/high reversal density candidate blocks。
- [ ] 每個 block export metadata 包含 drill id、trajectory version、seed、condition、angular size/speed、duration。
- [ ] 建立 scored start/practice boundary event，且 scored 前 1 秒置中不進分析。
- [ ] 建立 no-fire/no-ADS/no-movement protocol violation 記錄。
- [ ] 驗證 target visibility、scene clearance、angular size/speed round-trip。

## T3 — Canonical P0/P1 metrics/truth fixtures

- [ ] 重用 canonical `deriveTrackingMetrics()` 組裝 P0 acquisition/RMS/TOT。
- [ ] 實作 target/aim angular kinematics。
- [ ] 實作 lag search、positive-lag sign contract、velocity gain、velocity residual、directional bias。
- [ ] 擴充 recovery aggregation：drop/sec、completed reacquire durations、terminal censor count、longest off-target。
- [ ] 實作 reversal event windows：response latency、peak error、overshoot、settling time。
- [ ] fixtures 覆蓋 perfect follower、fixed lag、gain `0.7/1.0/1.3`、never acquire。
- [ ] fixtures 覆蓋 drop/reacquire、terminal drop、overshoot/settling、lag ambiguity。
- [ ] 公式、容差、blocked semantics 回寫 `docs/operational/analysis-tracking.md`。

## T4 — Eligibility/evidence/report

- [ ] 定義 closed `TrackingQualityReason` vocabulary。
- [ ] 在 metrics 聚合前判定 schema/manifest/version、overflow、timestamp、missing target、coverage、protocol compatibility。
- [ ] 實作 run-level 與 metric-level eligibility；P1 blocked 不刪除仍有效的 P0。
- [ ] 定義 compatibility fields：drill、protocol、motion、size、speed、FOV、sensitivity、input mode。
- [ ] 產生 deterministic `TrackingPilotEvidence` JSON。
- [ ] 產生 self-contained HTML report，至少包含 quality、RMS/TOT、acquisition、lag/gain、drop/recovery、condition matrix、target/aim trace。
- [ ] HTML/JSON 數值 parity test 通過；blocked 指標顯示原因，不顯示 0。
- [ ] benchmark 單一 30 秒 export analysis；若 >2 秒，只記 worker spike。

## T5 — Researcher manifest/operator flow

- [ ] 定義 `TrackingPilotManifest`、counterbalance cell、session index、alternate seed family。
- [ ] Researcher-only runner 可執行 practice -> scored block -> rest -> export。
- [ ] 操作端顯示 current block/rest/quality abort，不顯示即時能力分數。
- [ ] 記錄 completion、abort、retry reason；retry 不覆蓋原 export。
- [ ] manifest replay 產生相同 order/seed；非法 manifest fail fast。
- [ ] keyboard-only/focus/status text walkthrough 完成，品質狀態不只靠顏色表達。

## T6 — Instrumentation pilot

- [ ] 3-5 位內部/熟練 tester，每條件至少 2 次。
- [ ] 驗證 trajectory 連續性、bounds、event 對表、angular size/speed round-trip。
- [ ] 驗證 quality flags、export metadata 與 report traceability。
- [ ] 任何 defect 先最小化、補 regression fixture，再重跑 affected conditions。
- [ ] 產出 `instrumentation-gate-v1` evidence，含資料版本、分析版本、環境與 go/revise/stop。
- [ ] Gate A 失敗時停止，不以更多真人樣本掩蓋。

## T7 — Difficulty calibration pilot

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

