# WP-55 — Task Checklist

> Tech spec：[README.md](README.md) · Running log：[progress.md](progress.md)
>
> 狀態符號：`[ ]` pending · `[-]` in progress · `[x]` complete。WP-55 目前是候選 WP；正式開工前 T0 必須先讓 stage11 master README/checklist/progress 接受此範圍。

| Done | Task | Objective | Dependencies | Risk |
|---|---|---|---|---|
| [ ] | **T0** Scope freeze/no-health audit | 凍結 stage scope、OQ、no-health boundary、blast radius 與 baseline evidence | 使用者確認 WP-55 是否納入 stage11 | High |
| [ ] | **T1** Contact geometry contract | 建立 `deriveTrackingContactSamples()` 與 exact-hitbox truth fixtures | T0 | High |
| [ ] | **T2** Export-derived artifact | 產出 deterministic contact artifact 與 closed blocked reason vocabulary | T1 | Med/High |
| [ ] | **T3** All tracking drill coverage | 覆蓋 `tracking_v1`、`tracking_longrange_v1`、`tracking_br_v1`，且 BR/pure tracking 分層 | T2 | High |
| [ ] | **T4** Replay observability | replay 或離線 replay trace 可逐 frame 對表 contact state | T2/T3 | Med/High |
| [ ] | **T5** Report and quality integration | 報告呈現 contact timeline、P0 metrics、BR split columns 與 blocked reasons | T3/T4 | Med |
| [ ] | **T6** Exit gate and documentation | operational/stage 文件、focused tests、no-health regression audit 收斂 | T1-T5 | Med |
| [ ] | **T-exit** M21 evidence audit/handoff | 審核全需求追溯、evidence、docs、stage handoff 與 go/revise/blocked 結論 | T1-T6 | Med |

## T0 — Scope freeze/no-health audit

- [ ] 更新 stage11 [README](../README.md)、[master checklist](../task-checklist.md) 與 [progress](../progress.md)，明確接受或延後 WP-55。
- [ ] 記錄 HEAD、worktree status、CodeGraph status/pending、graphify freshness。
- [ ] 對 `TargetState`、`TargetManager`、`DataRecorder`、export schema/parser、`deriveTrackingMetrics()`、Replay sampling/view 與 report consumers 執行 CodeGraph impact。
- [ ] 凍結 OQ-55-1～OQ-55-4：Replay UI vs offline artifact、tracking drill coverage、derived artifact format、BR ballistic vs aim-ray 呈現。
- [ ] 稽核 `DrillConfig`、`TargetState`、hit path、export schema、render UI，確認本 WP 不新增 health/damage/kill 作為 tracking 判定來源。
- [ ] 重跑或記錄 legacy tracking baseline tests，不把舊數字當 gate。
- [ ] 保存 preregistration snapshot；後續 scope 變更以新 decision log 或新 protocol version 表達。

## T1 — Contact geometry contract

- [ ] 定義 `TrackingContactSample`、`TrackingContactDerivationResult` 與 closed `TrackingContactBlockedReason`。
- [ ] 實作或定位 shared ray-hitbox geometry source；不得複製一套與 engine/metrics 分離的近似 hitbox。
- [ ] 實作 `deriveTrackingContactSamples(payload)` 的 scored tick window selection。
- [ ] `epsilonDeg` 與 existing angular center error 使用同一來源/公式。
- [ ] fixtures 覆蓋 perfect on-target、known miss、edge hit、target invisible、presentation boundary。
- [ ] fixtures 覆蓋 metadata hitbox 與 legacy/default hitbox fallback。
- [ ] parity test 證明 contact-derived TOT/RMS/acquisition 與 `deriveTrackingMetrics()` 對表。

## T2 — Export-derived artifact

- [ ] 定義 artifact schema：analysisVersion、sourceRunId/export basename、drillId、schemaVersion、simHz、hitbox source、sample count。
- [ ] 產出 deterministic contact JSON；若 OQ-55-3 決定需要 CSV/HTML，同步定義輸出欄位與 round-trip。
- [ ] blocked reasons 覆蓋 unsupported schema、missing visible event、missing target telemetry、missing eye origin、invalid hitbox、no tracking drill、protocol incompatible。
- [ ] 資料不足時輸出 blocked result；不得輸出空 samples 假裝成功。
- [ ] 同一 export 重跑 artifact byte-equivalent 或 stable deep-equal。
- [ ] 30 秒 tracking reference export artifact generation < 500 ms；結果記錄 environment。
- [ ] 確認 generation 在 export 後分析層執行，不進 sim/render hot path。

## T3 — All tracking drill coverage

- [ ] `tracking_v1` 至少一份 fixture 產出 contact samples、TOT、RMS epsilon、acquisition parity。
- [ ] `tracking_longrange_v1` 至少一份 fixture 產出 contact samples，且 longrange hitbox/source unit 對表。
- [ ] `tracking_br_v1` 至少一份 fixture 產出 aim-ray contact samples，並保留 ADS/projectile/hitscan companion fields。
- [ ] BR report/test 分開呈現 `aimRayOnTarget` 與 ballistic `hit`；pure tracking summary 不讀 hit count。
- [ ] protocol-incompatible run 不進 aggregate，仍能顯示 reason code。
- [ ] 若 WP-54 新 tracking drill 已存在，T3 只驗 contract compatibility；不得擴大到 WP-54 pilot metric release。
- [ ] legacy drill id、frozen parameters、target lifecycle tests 全綠。

## T4 — Replay observability

- [ ] 實作 `sampleReplayContact(samples, replayTimeMs)` 或等價 pure helper。
- [ ] replay frame alignment 以 `t` 對表 target id、target center、aim、`onTarget`、`epsilonDeg`。
- [ ] seek/playback/rate change 下 contact frame 不漂移、不 stale commit。
- [ ] OQ-55-1 若選產品 UI：Replay overlay 顯示 contact state，且不改 sim state。
- [ ] OQ-55-1 若選離線 artifact：self-contained HTML replay trace 可逐 frame/逐 row 檢視 contact。
- [ ] replay fixture 覆蓋 presentation boundary、missing sample、blocked artifact。
- [ ] product UI 或離線 HTML 的狀態不只靠顏色表達；至少有文字/label 可稽核。

## T5 — Report and quality integration

- [ ] report 顯示 acquisition、pursuit、TOT、RMS/median/P95 epsilon、contact timeline。
- [ ] 每個數值帶 n、duration、condition、drill id、analysisVersion 與 source run。
- [ ] blocked reasons 以封閉 vocabulary 顯示；不顯示 0 或空圖表取代 blocked。
- [ ] BR/projectile tracking report 顯示 ballistic hit 與 aim-ray on-target 的差異，不混入 pure tracking 主結論。
- [ ] report/export artifact 與 `deriveTrackingMetrics()` summary parity test 通過。
- [ ] legacy/incompatible/protocol-mismatch runs 不進 aggregate，且 exclusion count 可追溯。
- [ ] operational doc 說明「跟隨目標」的主判定是 exact-hitbox on-target/TOT/RMS epsilon，不需要血條。

## T6 — Exit gate and documentation

- [ ] README §6 M21 exit gate 逐項對帳。
- [ ] `docs/operational/analysis-tracking.md` 或新增 tracking observability doc 更新公式、artifact schema、blocked semantics。
- [ ] stage11 master README/checklist/progress 同步 WP-55 狀態，或明確保留為 candidate/future。
- [ ] focused unit/replay/report tests 全綠，且必要 full `npm test` 或 CI command exit 0。
- [ ] no-health/no-damage audit 重跑，確認 schema/state/render/hit path 無新增 health bar、HP、damage-as-tracking contract。
- [ ] production code 若有修改，執行 `graphify update .`。
- [ ] `git status --short`、staged stat/names、artifact scan 完成，無真實 participant payload 進 git。

## T-exit — M21 evidence audit/handoff

- [ ] README §6 M21 exit gate 全部有 automated/measurement/inspection/manual evidence 或明確 blocker owner。
- [ ] Requirements traceability 表逐項對帳，沒有 orphan FR/NFR。
- [ ] Gate 結論明確為 go、revise、blocked 或 future proposal；不得以候選狀態宣告正式完成。
- [ ] 若 WP-54/new tracking drills 已存在，handoff 說明如何接入 contact artifact contract。
- [ ] 若 product Replay overlay 未做，technical debt 與觸發後續工作的條件已寫入 progress/decision log。
- [ ] 完成後同步 [progress.md](progress.md)、本 checklist 與 stage11 master 文件。

## Package Definition of Done

- [ ] WP-55 stage scope 已接受，或明確保持 future/candidate，不和 WP-52/WP-53/WP-54 stage11 scope 矛盾。
- [ ] Legacy tracking drills 無 regression。
- [ ] `onTarget` 與 `epsilonDeg` 可由 export 以 exact hitbox deterministic 重建。
- [ ] Contact artifact、Replay/離線 trace、report 三者可對表同一 run/tick/frame。
- [ ] BR/projectile evidence 與 pure tracking summary 分層，不用 hit/damage/kill 取代 contact。
- [ ] Missing/unsupported/invalid data 全部輸出 closed reason code，不產生假 0。
- [ ] 不新增 health bar、HP、damage、kill count 作為 tracking 跟隨判定來源。

## Commit discipline

每個 task 單獨 commit；完成 task 後同步本清單、[progress.md](progress.md) 與 stage11 master 文件。發現上游 domain defect 時回 owning WP 修復並補 regression，不在 WP-55 checklist 裡混入未授權的產品語意。
