# WP-55 — progress / decision log

> Tech spec：[README.md](README.md) · Checklist：[task-checklist.md](task-checklist.md)

## Status

- **Current**：🟡 候選 WP，自足 planning artifacts 已建立；尚未正式納入 stage11 master checklist，尚未開工。
- **Scope state**：從 existing raw tracking telemetry 推導 on-target observability；不新增 health/damage lifecycle。
- **Dependency state**：依賴現有 `tracking_v1`、`tracking_longrange_v1`、`tracking_br_v1`、schema v2、`deriveTrackingMetrics()` 與 Replay contract；若 WP-54 新 tracking drills 後續落地，接入同一 contact artifact contract。

## Progress

### 2026-09-01 — Planning

- 依使用者要求讀取 `.claude/skills/engineering-planning/SKILL.md`、WP-55 source proposal 與 WP-51 work-package 格式。
- 參照 WP-51 的 `README.md`、`task-checklist.md`、T0/T1 task file 與 progress pattern，將 WP-55 候選單檔整理為自足 WP 資料夾。
- 讀取 stage11 既有 README/checklist/progress 與 WP-54 格式；決定先比照 WP-54 保持 candidate WP，不改 stage11 master 文件。
- 新增本 WP 的 `README.md`、`task-checklist.md` 與 `progress.md`；本次只新增文件，未修改 production code。

## Decision log

| ID | 決策 | 理由 | 狀態 |
|---|---|---|---|
| D-55.1 | Tracking 跟隨判定以 exact-hitbox aim-ray `onTarget`、TOT 與 RMS/epsilon 為核心，不新增血條/HP/damage | Tracking 是逐 tick 跟隨構念；health/damage/kill 會把 shooting outcome 混入主指標 | Proposed |
| D-55.2 | Contact derivation 放在 export 後分析層，不寫回 sim state | 沿用 `DataRecorder -> ExportPayload -> metrics/report` 責任切分，降低 sim/render regression 風險 | Proposed |
| D-55.3 | 第一版優先支援 derived artifact；產品 Replay overlay 由 T0/OQ-55-1 決定 | 離線 artifact 可先滿足研究稽核，Replay UI scope 對估時與測試面影響較大 | Proposed |
| D-55.4 | BR/projectile tracking 同時可呈現 ballistic hit 與 aim-ray contact，但 pure tracking summary 不讀 hit count | 避免 projectile lead/travel time 被誤解為準心跟隨能力 | Proposed |

## Open Questions

| ID | 問題 | Owner | Deadline | Impact |
|---|---|---|---|---|
| OQ-55-1 | Replay 可觀測性要做到產品 UI，還是先產出離線 HTML/JSON replay artifact？ | 使用者 | T0 | T4 scope/估時 |
| OQ-55-2 | 「tracking 項目」是否只包含現有三類，或也包含 WP-54 候選新 drills？ | 使用者 + 研究者 | T0 | T3/T5 fixture matrix |
| OQ-55-3 | Export 支援是 raw export 足以重建，還是要另存 derived contact JSON/CSV？ | 使用者 | T0 | T2 output format |
| OQ-55-4 | BR projectile 條件中是否同時顯示 ballistic hit 與 aim-ray on-target？ | 研究者 | T1 | T3 metric semantics |

## Verification log

| Date | Command / inspection | Result |
|---|---|---|
| 2026-09-01 | `Get-Content .claude/skills/engineering-planning/SKILL.md` | skill loaded |
| 2026-09-01 | `Get-Content AGENTS.md` / `Get-Content graphify-out/GRAPH_REPORT.md` | project planning rules and graph hubs loaded |
| 2026-09-01 | `Get-Content docs/exec-plan/active/stage11/wp-55-tracking-on-target-observability-no-health-plan.md` | source proposal loaded |
| 2026-09-01 | `Get-Content docs/exec-plan/active/stage10/wp-51-m18-integration-and-acceptance/README.md` and `task-checklist.md` | WP-51 output format reviewed |
| 2026-09-01 | `Get-Content docs/exec-plan/active/stage11/wp-54-tracking-pilot/README.md` and `task-checklist.md` | candidate WP pattern reviewed |

## Surprises & Discoveries

- WP-55 source proposal is still a single candidate plan file under stage11, while WP-51 and WP-54 use self-contained WP folders. This planning pass keeps the source proposal intact and adds the folderized artifacts beside it.
- Existing `git status` already contains unrelated modified stage10/operational/graphify files plus WP-54/WP-55 proposal files. This pass intentionally adds only `docs/exec-plan/active/stage11/wp-55-tracking-on-target-observability-no-health/` files and does not touch those pre-existing changes.
