# WP-69 — Progress

## Snapshot

- **狀態**：⬜ 規劃完成，未開工
- **分支**：`chore/agents-skills-tree`
- **規劃日期**：2026-09-15
- **下一步**：T0 entry gate
- **決策**：[GD-46](../../../DECISIONS.md#gd-46--wp-69-暫停後永久失去實驗效力時間戳不可信即丟棄只有整場-restart-可恢復資格2026-09-15規劃)

## Planning evidence

- 已依 `.claude/skills/engineering-planning/SKILL.md` 讀取 `CLAUDE.md`、exec-plan index/decisions、`CONTEXT.md`、design standards/template，以及直接上游 WP-65 與平行 schema WP-67。
- CodeGraph 規劃期辨識的高風險節點：`createSimLoop`（53 callers/test references）、`Clock`（43）、`DrillRunner`（9）、`createInputSampler`（2）、`HistoryPersistence`（單一 app caller），以及三個 runner 的完成/推進狀態機。
- 現況關鍵事實：`liveFrame()` 在 ended 後無條件 build payload/save/advance；`HistoryPersistence` 只排除 practice、不排除 suspect；`SimLoop` 對 >250 ms delta 會 re-anchor；`restartActiveDrill()` 已重建 sim/RNG 並清 recorder/UI，可作 full restart 單一核心。

## Task log

| Task | 狀態 | 證據 / 決策 / 意外 |
|---|---|---|
| T0 | ⬜ | — |
| T1 | ⬜ | — |
| T2 | ⬜ | — |
| T3 | ⬜ | — |
| T4 | ⬜ | — |
| T5 | ⬜ | — |
| T6 | ⬜ | — |
| T-exit | ⬜ | — |

## Decision log

| ID | 決定 | 狀態 |
|---|---|---|
| D-69.P1 | pause 是 orthogonal runtime state，不擴充 `DrillPhase` | 規劃採納；T0 複核 |
| D-69.P2 | pause 立即 sticky invalid；resume 不恢復，只有 full restart 建新 candidate | 使用者已拍板 |
| D-69.P3 | timestamp health 通過才保留 invalid diagnostic；失敗則無 payload並清 recorder | 使用者已拍板 |
| D-69.P4 | finalization gate 必須早於 payload/metrics/save/advance | 規劃採納；T0 spike 複核 |

## Open Questions

見 [README §1.4](README.md#14-open-questions)。T0 必須關閉 OQ-69.1～69.3，未關閉不得進 T1。

