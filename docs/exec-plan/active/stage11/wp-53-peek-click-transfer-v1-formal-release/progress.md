# WP-53 — progress / decision log

## Status

- **Current**：🟡 規劃完成，尚未開工。
- **Scope state**：根據 WP-52 evidence 新增 formal `peek_click_transfer_v1` Assessment，不修改 pilot v1/v2。
- **Dependency state**：Blocked until WP-52 T-exit and formal freeze gate are complete.

## Progress

### 2026-08-28 — Planning

- 依 stage11 方向建立 WP-53 自足 spec。
- 將 formal release 分成 freeze gate、config、metadata/compatibility、registry/history、Session Plan、E2E/docs 六個垂直切片。
- 本次只新增文件，未修改 production code。

### 2026-09-01 — 上游 WP-52 新增 masked-visual pilot 變體（WP-53 本身仍未開工，No-go）

- **本節不代表任何 WP-53 task 進度**：WP-53 仍卡在 [stage11 README](../README.md) §6 記載的 No-go（尚無真人 pilot trial），本檔 T0 checklist 尚未勾動任何一項，見 [task-checklist.md](task-checklist.md)。
- 記錄原因：上游 WP-52 在本輪（使用者於人工走查 T4 checklist 時提出）新增了 `peek_click_transfer_pilot_v2_masked` 變體——render 固定套用 2.5° 參考視覺尺寸，hitbox（命中判定/clearance/occlusion）仍逐一使用真實 1°/2.5°/5° 候選,目的是排除受試者用視覺線索猜測目前難度候選的混淆。這是 GD-7（CLAUDE.md 硬約束）的記名例外，使用者已明確拍板；詳見全域 [DECISIONS.md](../../../DECISIONS.md) GD-27 與 WP-52 [progress.md](../wp-52-peek-click-transfer-pilot-v2/progress.md) D-52.12。
- 與 WP-53 的關係：這個新增 pilot 變體本身**不是** WP-53 的交付物（仍是 `mode:'practice'`、獨立 drill id、不進 formal history/trend），但它的走查結果可能影響 WP-53 T0 未來要拍板的 formal 角尺寸/呈現政策（`OQ-53-1`/`OQ-53-4` 相關），故在此留一筆指標供 T0 開工時參考。
- **已知缺口**（同一則記於 WP-52 progress.md，此處提醒 WP-53 T0 若要引用）：masked pilot 的匯出 JSON 與 replay 目前不含 `visualSize`（只回溯真實 hitbox），若 formal freeze 決策需要用匯出資料稽核「遮罩是否確實達到視覺無差異」，需要先補上這段管線。
- Verification：無（本節純文件記錄，未觸碰 WP-53 scope 的 production code）。

## Decision log

| ID | 決策 | 理由 | 狀態 |
|---|---|---|---|
| D-53.1 | `peek_click_transfer_v1` 使用新的 formal drill id | exact history/trend cohort 不能與 pilot ids 混用 | Proposed |
| D-53.2 | Formal release 需要 `meta.assessment` 與 compatibility key | WP-48/49 只保存與趨勢化 Assessment | Proposed |
| D-53.3 | formal Session Plan 不改 stage6 default roster | 避免既有四家族 Assessment 順序漂移 | Proposed |

## Open Questions

| ID | 問題 | Owner | Deadline | Impact |
|---|---|---|---|---|
| OQ-53-1 | formal protocol version string | 使用者 + 研究者 | T0 | T1/T2 |
| OQ-53-2 | formal Session Plan policy | 使用者 | T0 | T4 |
| OQ-53-3 | primary trend metrics | 使用者 + 研究者 | T3 | T3 |
| OQ-53-4 | minimum participant/evidence threshold | 研究者 | T0 | T0 |

## Verification log

| Date | Command | Result |
|---|---|---|
| 2026-08-28 | Planning-only | No production verification run |
