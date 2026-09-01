# WP-54 — Progress / Decision Log

## Status

- **Current**：🟡 自足 planning package 建立完成；尚未開工。
- **Scope state**：候選 WP。原始 proposal 明確指出尚未納入 stage11 master checklist；T0 前不得視為 stage11 已接受範圍。
- **Dependency state**：依賴既有 `tracking_v1` baseline、schema v2、tracking metrics/transitions、stage10 history/result 基礎，以及使用者/研究者對 OQ-54 的 preregistration decision。

## Progress

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

## Open Questions

| ID | 問題 | Owner | Deadline | Impact |
|---|---|---|---|---|
| OQ-54-1 | 本輪只做 steady pursuit，或 steady + reactive 並列？ | 使用者 + 研究者 | T0 | T1-T8 scope |
| OQ-54-2 | Core matrix 是否沿用 `2.0 deg / 0.5 deg x 5 deg/s / 20 deg/s`？ | 研究者 | T0 | T2 config |
| OQ-54-3 | 每個 scored block 採 20、25 或 30 秒？ | 研究者 | T0 | T2/T5/T7 |
| OQ-54-4 | Lag 搜尋範圍、平滑器與 ambiguity gate 為何？ | 指標 owner | T0 | T3 metric contract |
| OQ-54-5 | Repeatability 最低證據門檻為何？ | 使用者 + 研究者 | T6 前 | T8/M20 |
| OQ-54-6 | 真人 pilot 招募數與 session 間隔？ | 研究者 | T6 前 | T7/T8 calendar |
| OQ-54-7 | Evidence artifact 只做研究 HTML/JSON，或同步進產品 Result 頁？ | 產品 owner | T0 | T4 scope |
| OQ-54-8 | 是否需要 tracking-specific SPARC？ | 指標 owner | T-exit | 後續診斷 |

## Verification log

| Date | Command / action | Result |
|---|---|---|
| 2026-09-01 | `Get-Content .claude/skills/engineering-planning/SKILL.md` | skill loaded |
| 2026-09-01 | `Get-Content AGENTS.md` / `Get-Content graphify-out/GRAPH_REPORT.md` | project planning rules loaded |
| 2026-09-01 | Read WP-54 proposal and WP-51 README/checklist/T files | planning format and scope source loaded |
| 2026-09-01 | Documentation edit only | no production code changed; no tests run |

