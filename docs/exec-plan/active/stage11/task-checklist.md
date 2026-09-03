# Stage 11 — Master Task Checklist

> Stage spec：[README.md](README.md) · Running log：[progress.md](progress.md)
>
> 本清單先固定垂直切片、相依與 exit gate。每個 task 正式開工前，依 `docs/exec-plan/README.md` 規則補成自足 task file，並在讀碼後更新具體檔案與 blast radius；未完成前不得把預計路徑當成既成事實。

## WP-52 — Peek-click Transfer Pilot v2

> 自足 spec：[wp-52-peek-click-transfer-pilot-v2/README.md](wp-52-peek-click-transfer-pilot-v2/README.md) · checklist：[wp-52-peek-click-transfer-pilot-v2/task-checklist.md](wp-52-peek-click-transfer-pilot-v2/task-checklist.md)

| Done | Task | Objective | 相依 | Risk |
|---|---|---|---|---|
| ✅ | **T0** Entry gate／v1 audit／parameter freeze candidates | [WP-52 README §4](wp-52-peek-click-transfer-pilot-v2/README.md#4-任務拆解-task-breakdown) | WP-45 T-exit | High |
| ✅ | **T1** Pilot v2 config and contracts | [WP-52 README §4](wp-52-peek-click-transfer-pilot-v2/README.md#4-任務拆解-task-breakdown) | T0 | High |
| ✅ | **T2** Pilot session preset UI + metadata unblock | [WP-52 README §4](wp-52-peek-click-transfer-pilot-v2/README.md#4-任務拆解-task-breakdown) | T1 + KI-016/GD-26 | High |
| ✅ | **T3** Pilot evidence harness and report | [WP-52 README §4](wp-52-peek-click-transfer-pilot-v2/README.md#4-任務拆解-task-breakdown) | T1-T2 | Med |
| ✅ | **T4** Manual pilot gate and documentation | [WP-52 README §4](wp-52-peek-click-transfer-pilot-v2/README.md#4-任務拆解-task-breakdown) | T3 | High |
| ✅ | **T-exit** Pilot v2 acceptance and WP-53 handoff | [WP-52 README §4](wp-52-peek-click-transfer-pilot-v2/README.md#4-任務拆解-task-breakdown) | T1-T4 | Med |

WP-52 Definition of Done：調整後 transfer pilot 以新 id 與版本化 config 存在；操作端能選取 pilot session 並匯出不因 `peek-click-transfer` family metadata 失敗；自動化與人工 evidence 足以支撐是否進入 formal freeze，但不宣告 Assessment。

## WP-53 — Peek-click Transfer v1 Formal Release

> 自足 spec：[wp-53-peek-click-transfer-v1-formal-release/README.md](wp-53-peek-click-transfer-v1-formal-release/README.md) · checklist：[wp-53-peek-click-transfer-v1-formal-release/task-checklist.md](wp-53-peek-click-transfer-v1-formal-release/task-checklist.md)

| Done | Task | Objective | 相依 | Risk |
|---|---|---|---|---|
| ✅ | **T0** Freeze decision gate | [WP-53 README §4](wp-53-peek-click-transfer-v1-formal-release/README.md#4-任務拆解-task-breakdown) | WP-52 T-exit | High |
| ✅ | **T1** Formal Assessment drill config | [WP-53 README §4](wp-53-peek-click-transfer-v1-formal-release/README.md#4-任務拆解-task-breakdown) | T0 | High |
| ✅ | **T2** Assessment metadata and compatibility | [WP-53 README §4](wp-53-peek-click-transfer-v1-formal-release/README.md#4-任務拆解-task-breakdown) | T1 | High |
| ✅ | **T3** Metric registry and history/trend projection | [WP-53 README §4](wp-53-peek-click-transfer-v1-formal-release/README.md#4-任務拆解-task-breakdown) | T2 + WP-49 contract | High |
| ✅ | **T4** Formal Session Plan integration | [WP-53 README §4](wp-53-peek-click-transfer-v1-formal-release/README.md#4-任務拆解-task-breakdown) | T2-T3 | High |
| ✅ | **T5** E2E acceptance and regression | [WP-53 README §4](wp-53-peek-click-transfer-v1-formal-release/README.md#4-任務拆解-task-breakdown) | T1-T4 | High |
| ✅ | **T-exit** Formal release docs and M19 gate | [WP-53 README §4](wp-53-peek-click-transfer-v1-formal-release/README.md#4-任務拆解-task-breakdown) | T1-T5 | Med |

WP-53 Definition of Done：`peek_click_transfer_v1` 是獨立正式 Assessment drill id；完成 run 後產生 `meta.assessment`、保存至本機 history、可在 exact drill history/trend 中被 registry 投影；pilot v1/v2 仍維持 practice-only 且不進正式 history。

## WP-54 — Tracking Pilot Capability Test（M20）

> 自足 spec：[wp-54-tracking-pilot/README.md](wp-54-tracking-pilot/README.md) · checklist：[wp-54-tracking-pilot/task-checklist.md](wp-54-tracking-pilot/task-checklist.md) · progress：[wp-54-tracking-pilot/progress.md](wp-54-tracking-pilot/progress.md)

| Done | Task | Objective | 相依 | Risk |
|---|---|---|---|---|
| [x] | **T0** Entry gate/scope freeze/preregistration | [WP-54 README §4](wp-54-tracking-pilot/README.md#4-任務拆解-task-breakdown) | 使用者確認 WP-54 納入 stage11 | High |
| [x] | **T1** Deterministic trajectory kernel/export contract | [WP-54 README §4](wp-54-tracking-pilot/README.md#4-任務拆解-task-breakdown) | T0 | High |
| [x] | **T2** Pilot drill matrix/protocol guards | [WP-54 README §4](wp-54-tracking-pilot/README.md#4-任務拆解-task-breakdown) | T1 | High |
| [x] | **T3** Canonical P0/P1 metrics/truth fixtures | [WP-54 README §4](wp-54-tracking-pilot/README.md#4-任務拆解-task-breakdown) | T2 | High |
| [x] | **T4** Eligibility/evidence/report | [WP-54 README §4](wp-54-tracking-pilot/README.md#4-任務拆解-task-breakdown) | T3 | High |
| [x] | **T5** Researcher manifest/operator flow | [WP-54 README §4](wp-54-tracking-pilot/README.md#4-任務拆解-task-breakdown) | T2/T4 | Med |
| [x] | **T6** Instrumentation pilot（Gate A = 部分通過：資料鏈路 + reversal PASS，核心矩陣退回 T7） | [WP-54 README §4](wp-54-tracking-pilot/README.md#4-任務拆解-task-breakdown) | T1-T5 | High |
| [ ] | **T7** Difficulty calibration pilot | [WP-54 README §4](wp-54-tracking-pilot/README.md#4-任務拆解-task-breakdown) | T6 PASS | High |
| [ ] | **T8** Repeatability/validity pilot | [WP-54 README §4](wp-54-tracking-pilot/README.md#4-任務拆解-task-breakdown) | T7 PASS + OQ-54-5/6 frozen | High |
| [ ] | **T-exit** M20 evidence audit/handoff | [WP-54 README §4](wp-54-tracking-pilot/README.md#4-任務拆解-task-breakdown) | T6/T7/T8 PASS | Med |

WP-54 Definition of Done：見 [wp-54-tracking-pilot/task-checklist.md「Package Definition of Done」](wp-54-tracking-pilot/task-checklist.md#package-definition-of-done)。研究性 tracking pilot（researcher/pilot-only）不得寫入正式 Assessment history/trend，不與 M19 `peek-click-transfer` 系列 drill id 或 compatibility cohort 混用。

## WP-55 — Tracking On-target Observability without Health（M21）

> 自足 spec：[wp-55-tracking-on-target-observability-no-health/README.md](wp-55-tracking-on-target-observability-no-health/README.md) · checklist：[wp-55-tracking-on-target-observability-no-health/task-checklist.md](wp-55-tracking-on-target-observability-no-health/task-checklist.md) · progress：[wp-55-tracking-on-target-observability-no-health/progress.md](wp-55-tracking-on-target-observability-no-health/progress.md)

| Done | Task | Objective | 相依 | Risk |
|---|---|---|---|---|
| [x] | **T0** Scope freeze/no-health audit | [T0-scope-freeze-no-health-audit.md](wp-55-tracking-on-target-observability-no-health/T0-scope-freeze-no-health-audit.md) | 使用者確認 WP-55 納入 stage11 | High |
| [x] | **T1** Contact geometry contract | [T1-contact-geometry-contract.md](wp-55-tracking-on-target-observability-no-health/T1-contact-geometry-contract.md) | T0 | High |
| [x] | **T2** Export-derived artifact | [T2-export-derived-artifact.md](wp-55-tracking-on-target-observability-no-health/T2-export-derived-artifact.md) | T1 | Med/High |
| [x] | **T3** All tracking drill coverage | [T3-all-tracking-drill-coverage.md](wp-55-tracking-on-target-observability-no-health/T3-all-tracking-drill-coverage.md) | T2 | High |
| [x] | **T4** Replay observability | [T4-replay-observability.md](wp-55-tracking-on-target-observability-no-health/T4-replay-observability.md) | T2/T3 | Med/High |
| [x] | **T5** Report and quality integration | [T5-report-and-quality-integration.md](wp-55-tracking-on-target-observability-no-health/T5-report-and-quality-integration.md) | T3/T4 | Med |
| [x] | **T6** Exit gate and documentation | [T6-exit-gate-and-documentation.md](wp-55-tracking-on-target-observability-no-health/T6-exit-gate-and-documentation.md) | T1-T5 | Med |
| [x] | **T-exit** M21 evidence audit/handoff（**conditional pass**；OI-55-1 未閉合） | [T-exit-m21-evidence-audit-handoff.md](wp-55-tracking-on-target-observability-no-health/T-exit-m21-evidence-audit-handoff.md) | T1-T6 | Med |

M21 判定 = **conditional pass**（2026-09-03）：automated gate 與 A-55.1~10 全數有客觀證據；唯一未閉合項 **OI-55-1** —— WP-55 五個 module 只被自己的 test 匯入，無 CLI/npm/UI 入口，研究者無法從真實 export 產出 artifact，故 manual/researcher artifact review 保持 OPEN（owner = 使用者／研究者）。詳見 [wp-55 README §6.2](wp-55-tracking-on-target-observability-no-health/README.md#62-t-exit-evidence-ledger2026-09-03)。

WP-55 Definition of Done：見 [wp-55-tracking-on-target-observability-no-health/task-checklist.md「Package Definition of Done」](wp-55-tracking-on-target-observability-no-health/task-checklist.md#package-definition-of-done)。Tracking 跟隨判定必須以 exact-hitbox aim-ray `onTarget` / `epsilonDeg` 為核心，不新增 health/HP/damage/kill lifecycle，也不得把 BR ballistic hit 混入 pure tracking summary。

## 全階段紀律

1. 修改既有 symbol 前依專案規範執行 CodeGraph impact，記錄 affected files／symbols 與 local 或 cross-module 判斷。
2. 每個 WP 完成時更新各自 [progress.md](wp-52-peek-click-transfer-pilot-v2/progress.md) / [progress.md](wp-53-peek-click-transfer-v1-formal-release/progress.md) / [progress.md](wp-54-tracking-pilot/progress.md) / [progress.md](wp-55-tracking-on-target-observability-no-health/progress.md) 與 stage [progress.md](progress.md)。
3. production code 修改後執行 `graphify update .`。
4. 不得把 `peek-click-transfer-pilot-v1`、`peek_click_transfer_pilot_v2` 與 `peek_click_transfer_v1` 的資料混在同一 compatibility/history cohort。
5. Formal release 不得在 WP-52 evidence 未完成前開工。
