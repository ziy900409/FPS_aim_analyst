# WP-64 — Progress

> Plan：[README.md](README.md) · checklist：[task-checklist.md](task-checklist.md)

## Current status

📋 **規劃完成，未開工（2026-09-10）。**

- 本次只建立 execution-plan 文件；未修改 production code、tests、stage/global index 或全域 decision ledger。
- 暫用 `WP-64 / GD-40`：工作樹已有未追蹤的 WP-63/GD-39 計畫，T0 仍須依 GD-15 在採納時重查。
- WP-62 progress 顯示 T1～T3 已完成，但 stage13/top-level index 的狀態文字仍停在 T3 未開工；T0 必須以實際 commits/worktree 為準，不信任過期摘要。

## Planning evidence

### Context read

- `CLAUDE.md` §3/§4、`CONTEXT.md`
- `docs/exec-plan/README.md`、`DECISIONS.md`
- stage13 index、WP-62 README/progress、WP-54 README/progress
- engineering-planning skill、design standards、tech spec template
- `graphify-out/GRAPH_REPORT.md`（架構社群/god nodes）與 CodeGraph structural exploration

### Repository findings

1. `FAMILY_ROSTER` 是 schedulability 的權威；picker 與 compiler 已自動消費，不需新增第二份 UI allowlist。
2. `availableDrills` 是 runtime loadability 的權威，但同時直接投影到 researcher Controls，需明確 surface policy。
3. WP-62 的 fixed-weapon guard 只涵蓋 `DECLARED_WEAPON_BY_DRILL_ID`；selected Pilot 一旦 schedulable，必須從其 config 將 `tracking_pilot_hold` 納入。
4. `loadDrillConfigDirect()` 與 formal Pilot runner 固定 `field-low`；Session Plan runtime entry 也必須 pin 同場景。
5. 所有 Pilot configs 是 `mode:'practice'`，且 exact-id history registry 排除已由專用 test 保護。
6. custom Session Plan metadata 已足以識別 ad hoc execution；新增 schema 欄位不是必要條件。

## Planning decisions

| ID | Decision | Rationale | Status |
|---|---|---|---|
| **D-64.P1** | selected Pilot configs 是「可排程的研究用 drill」，不是 Assessment 或 manifest block | family membership 只表達 scheduling reach，與 mode/history eligibility 正交 | ✅ 使用者方向已確認 |
| **D-64.P2** | 以單一 curated config registry 同時推導 family、weapon、runtime entries | 防止 picker/compiler/runtime 三邊漂移；不手寫第二份 ids | 📋 待 T1 落地 |
| **D-64.P3** | ad hoc path 沿用 generic SessionRunner 與既有 custom audit fields | 最小改動且保持 manifest-specific counterbalance/eligibility 邊界 | 📋 待 T2/T3 證明 |
| **D-64.P4** | 不新增 metadata execution-context 欄位 | `sessionPlanMode:'custom'` + item/rep 與 manifest session label 已可區分；避免無需求 schema 擴張 | 📋 待 T0 確認 |
| **D-64.P5** | formal Tracking Pilot 與 frozen tracking family representative 不變 | 本需求只要挑 1–2 個條件做 ad hoc 測試 | ✅ Scope freeze |

## Open Questions

| ID | Status | Owner | Deadline | Default |
|---|---|---|---|---|
| OQ-64.1 exact selected configs | 🟡 | 研究者／使用者 | T0 | `2deg × 5dps` core + `reversal high` |
| OQ-64.2 Controls visibility | 🟡 | 產品 owner／研究者 | T2 | Session Plan-only |
| OQ-64.3 live eligibility | 🟡 | 指標 owner | T0 | 不做；只離線分析 |
| OQ-64.4 alternate seed | 🟡 | 研究者 | T0 | 不做；primary only |

## Surprises / known coordination risks

- 現行 `drillFamily.ts` 註解明說 Tracking Pilot 不可排程；T1 必須同步更新該描述，否則文件會說謊。
- `availableDrills` 並非純 runtime registry；任何新增 entry 都會自動進 Controls，除非投影時過濾。
- WP-62 仍是 active 且觸及相同檔案；其 progress 比 stage/global index 新。T0 必須先處理狀態漂移與平行修改。
- 工作樹另有未追蹤 WP-63、KI-035 與 spider-shot HTML，均屬使用者現有工作；本計畫未觸碰。

## Task log

| Task | Status | Started | Completed | Commit | Evidence |
|---|---|---|---|---|---|
| T0 | ⬜ Not started | — | — | — | — |
| T1 | ⬜ Not started | — | — | — | — |
| T2 | ⬜ Not started | — | — | — | — |
| T3 | ⬜ Not started | — | — | — | — |
| T-exit | ⬜ Not started | — | — | — | — |

