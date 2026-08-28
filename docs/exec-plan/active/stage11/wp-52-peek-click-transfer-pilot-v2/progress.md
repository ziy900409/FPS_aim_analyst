# WP-52 — progress / decision log

## Status

- **Current**：🟡 規劃完成，尚未開工。
- **Scope state**：新增 `peek_click_transfer_pilot_v2` 作為調整後 pilot；不修改 `peek-click-transfer-pilot-v1` 的既有語意。
- **Dependency state**：依賴 WP-45 T-exit；T2 會處理 GD-26/KI-016 造成的 session wiring 阻塞。

## Progress

### 2026-08-28 — Planning

- 依 stage11 方向建立 WP-52 自足 spec。
- 明確將 pilot 調整與 formal release 分離，避免同一 drill id 混用不同協定。
- 本次只新增文件，未修改 production code。

## Decision log

| ID | 決策 | 理由 | 狀態 |
|---|---|---|---|
| D-52.1 | 新增 `peek_click_transfer_pilot_v2`，不原地改 `peek-click-transfer-pilot-v1` | 保留 WP-45 pilot-ready evidence 與舊資料語意 | Proposed |
| D-52.2 | Pilot v2 仍是 `mode:'practice'` | 調整階段尚未完成 formal freeze，不應進 Assessment history | Proposed |
| D-52.3 | Session wiring 必須同步修 KI-016/GD-26 | transfer family 一旦進 UI，metadata allowlist 會成為阻塞 bug | Proposed |

## Open Questions

| ID | 問題 | Owner | Deadline | Impact |
|---|---|---|---|---|
| OQ-52-1 | target angular size policy | 使用者 + 研究者 | T0 | T1 |
| OQ-52-2 | timeout policy | 使用者 + 研究者 | T0 | T1 |
| OQ-52-3 | transfer warmup policy | 使用者 | T0 | T2 |
| OQ-52-4 | formal go/no-go evidence threshold | 研究者 | T4 | WP-53 T0 |

## Verification log

| Date | Command | Result |
|---|---|---|
| 2026-08-28 | Planning-only | No production verification run |
