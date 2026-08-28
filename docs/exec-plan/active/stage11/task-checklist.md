# Stage 11 — Master Task Checklist

> Stage spec：[README.md](README.md) · Running log：[progress.md](progress.md)
>
> 本清單先固定垂直切片、相依與 exit gate。每個 task 正式開工前，依 `docs/exec-plan/README.md` 規則補成自足 task file，並在讀碼後更新具體檔案與 blast radius；未完成前不得把預計路徑當成既成事實。

## WP-52 — Peek-click Transfer Pilot v2

> 自足 spec：[wp-52-peek-click-transfer-pilot-v2/README.md](wp-52-peek-click-transfer-pilot-v2/README.md) · checklist：[wp-52-peek-click-transfer-pilot-v2/task-checklist.md](wp-52-peek-click-transfer-pilot-v2/task-checklist.md)

| Done | Task | Objective | 相依 | Risk |
|---|---|---|---|---|
| ⬜ | **T0** Entry gate／v1 audit／parameter freeze candidates | [WP-52 README §4](wp-52-peek-click-transfer-pilot-v2/README.md#4-任務拆解-task-breakdown) | WP-45 T-exit | High |
| ⬜ | **T1** Pilot v2 config and contracts | [WP-52 README §4](wp-52-peek-click-transfer-pilot-v2/README.md#4-任務拆解-task-breakdown) | T0 | High |
| ⬜ | **T2** Pilot session preset UI + metadata unblock | [WP-52 README §4](wp-52-peek-click-transfer-pilot-v2/README.md#4-任務拆解-task-breakdown) | T1 + KI-016/GD-26 | High |
| ⬜ | **T3** Pilot evidence harness and report | [WP-52 README §4](wp-52-peek-click-transfer-pilot-v2/README.md#4-任務拆解-task-breakdown) | T1-T2 | Med |
| ⬜ | **T4** Manual pilot gate and documentation | [WP-52 README §4](wp-52-peek-click-transfer-pilot-v2/README.md#4-任務拆解-task-breakdown) | T3 | High |
| ⬜ | **T-exit** Pilot v2 acceptance and WP-53 handoff | [WP-52 README §4](wp-52-peek-click-transfer-pilot-v2/README.md#4-任務拆解-task-breakdown) | T1-T4 | Med |

WP-52 Definition of Done：調整後 transfer pilot 以新 id 與版本化 config 存在；操作端能選取 pilot session 並匯出不因 `peek-click-transfer` family metadata 失敗；自動化與人工 evidence 足以支撐是否進入 formal freeze，但不宣告 Assessment。

## WP-53 — Peek-click Transfer v1 Formal Release

> 自足 spec：[wp-53-peek-click-transfer-v1-formal-release/README.md](wp-53-peek-click-transfer-v1-formal-release/README.md) · checklist：[wp-53-peek-click-transfer-v1-formal-release/task-checklist.md](wp-53-peek-click-transfer-v1-formal-release/task-checklist.md)

| Done | Task | Objective | 相依 | Risk |
|---|---|---|---|---|
| ⬜ | **T0** Freeze decision gate | [WP-53 README §4](wp-53-peek-click-transfer-v1-formal-release/README.md#4-任務拆解-task-breakdown) | WP-52 T-exit | High |
| ⬜ | **T1** Formal Assessment drill config | [WP-53 README §4](wp-53-peek-click-transfer-v1-formal-release/README.md#4-任務拆解-task-breakdown) | T0 | High |
| ⬜ | **T2** Assessment metadata and compatibility | [WP-53 README §4](wp-53-peek-click-transfer-v1-formal-release/README.md#4-任務拆解-task-breakdown) | T1 | High |
| ⬜ | **T3** Metric registry and history/trend projection | [WP-53 README §4](wp-53-peek-click-transfer-v1-formal-release/README.md#4-任務拆解-task-breakdown) | T2 + WP-49 contract | High |
| ⬜ | **T4** Formal Session Plan integration | [WP-53 README §4](wp-53-peek-click-transfer-v1-formal-release/README.md#4-任務拆解-task-breakdown) | T2-T3 | High |
| ⬜ | **T5** E2E acceptance and regression | [WP-53 README §4](wp-53-peek-click-transfer-v1-formal-release/README.md#4-任務拆解-task-breakdown) | T1-T4 | High |
| ⬜ | **T-exit** Formal release docs and M19 gate | [WP-53 README §4](wp-53-peek-click-transfer-v1-formal-release/README.md#4-任務拆解-task-breakdown) | T1-T5 | Med |

WP-53 Definition of Done：`peek_click_transfer_v1` 是獨立正式 Assessment drill id；完成 run 後產生 `meta.assessment`、保存至本機 history、可在 exact drill history/trend 中被 registry 投影；pilot v1/v2 仍維持 practice-only 且不進正式 history。

## 全階段紀律

1. 修改既有 symbol 前依專案規範執行 CodeGraph impact，記錄 affected files／symbols 與 local 或 cross-module 判斷。
2. 每個 WP 完成時更新各自 [progress.md](wp-52-peek-click-transfer-pilot-v2/progress.md) / [progress.md](wp-53-peek-click-transfer-v1-formal-release/progress.md) 與 stage [progress.md](progress.md)。
3. production code 修改後執行 `graphify update .`。
4. 不得把 `peek-click-transfer-pilot-v1`、`peek_click_transfer_pilot_v2` 與 `peek_click_transfer_v1` 的資料混在同一 compatibility/history cohort。
5. Formal release 不得在 WP-52 evidence 未完成前開工。
