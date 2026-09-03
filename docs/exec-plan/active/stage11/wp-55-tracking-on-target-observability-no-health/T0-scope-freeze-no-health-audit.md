# WP-55 T0 — Scope Freeze／No-health Audit

## Objective

凍結 WP-55 是否納入 stage11、OQ-55-1～4、no-health/no-damage 邊界、blast radius 與 baseline evidence。T0 未通過不得開始 T1～T6；不得把 planned contract 當 delivered evidence。

## Inputs to read

- [README.md](README.md) §0～7、[task-checklist.md](task-checklist.md)、[progress.md](progress.md)。
- stage11 [README](../README.md)、[master checklist](../task-checklist.md)、[progress](../progress.md)。
- `AGENTS.md`、`graphify-out/GRAPH_REPORT.md` 與當時 CodeGraph status/pending。
- `TargetState`、`TargetManager`、`DataRecorder`、export schema/parser、`deriveTrackingMetrics()`、Replay sampling/view 與 report consumers。
- 現有 tracking drill roster：`tracking_v1`、`tracking_longrange_v1`、`tracking_br_v1`，以及 WP-54 候選 tracking drills 若已存在。

## Steps

1. 記錄 HEAD、`git status --short`、CodeGraph status/pending、graphify freshness 與 baseline command 結果；不處理 unrelated changes。
2. 更新 stage11 master README/checklist/progress，明確接受 WP-55、延後 WP-55，或保留為 candidate/future proposal。
3. 對候選 implementation targets 執行 CodeGraph impact，記錄 affected files/symbols 與 local/cross-module 判斷。
4. 凍結 OQ-55-1～4：Replay UI vs offline artifact、tracking drill coverage、derived artifact format、BR ballistic vs aim-ray 呈現。
5. 稽核 `DrillConfig`、`TargetState`、hit path、export schema 與 render/report UI，確認本 WP 不新增 health/damage/kill 作為 tracking 判定來源。
6. 重跑或記錄 legacy tracking baseline tests；只把實際測試輸出作 gate，不把舊數字當作已驗收證據。
7. 保存 preregistration snapshot；後續 scope 變更以新 decision log 或新 protocol version 表達。
8. 將 commands、blast radius、OQ 結論、baseline 與 no-health audit 寫入 [progress.md](progress.md)。

## Required audit artifact

| Area | Evidence required | Pass condition |
|---|---|---|
| stage scope | stage11 master docs diff or explicit future/candidate decision | WP-55 狀態不與 stage11 scope 矛盾 |
| no-health boundary | schema/state/render/hit path inspection | 未新增 health bar、HP、damage、kill 作為 tracking 跟隨判定來源 |
| tracking roster | exact drill IDs and fixture availability | 現有三類 tracking drill coverage scope 凍結 |
| CodeGraph impact | affected files/symbols and local/cross-module notes | T1～T6 target paths 以 actual codebase 為準 |
| OQ-55.1～4 | owner/deadline/impact | 有 owner-confirmed 結論或明確 blocked owner |

## Definition of Done

- [ ] stage11 master README/checklist/progress 已明確接受、延後或保留 WP-55 candidate/future 狀態。
- [ ] HEAD、worktree status、CodeGraph pending、graphify freshness 與 baseline commands 已記錄。
- [ ] `TargetState`、`TargetManager`、`DataRecorder`、export schema/parser、`deriveTrackingMetrics()`、Replay sampling/view、report consumers 的 blast radius 已記錄。
- [ ] OQ-55-1～OQ-55-4 有 owner-confirmed 結論或 blocked owner/deadline/impact。
- [ ] no-health/no-damage/no-kill audit 證明本 WP 沒有引入 health lifecycle 或 damage-as-tracking contract。
- [ ] legacy tracking baseline tests 有客觀輸出；任何既存 failure 已標 owner，不阻塞無關切片。
- [ ] progress.md 已貼上 T0 evidence，T1～T6 的 actual paths/contracts 已按讀碼結果更新。

## Commit

```text
docs(stage11): complete WP-55 tracking contact entry gate
```
