# WP-53 — progress / decision log

## Status

- **Current**：🟡 T0 freeze 仍未成立（No-go，真人 pilot evidence 尚未存在）；使用者已明確 override，允許先建 T1~T3 **placeholder 骨架**（見 [DECISIONS.md GD-28](../../../DECISIONS.md#gd-28-🟡-wp-53-no-go-期間-override--允許先建-t1t3-placeholder-骨架凍結值不得引用真人-evidence2026-09-01)）。
- **Scope state**：根據 WP-52 evidence 新增 formal `peek_click_transfer_v1` Assessment，不修改 pilot v1/v2。骨架階段沿用 pilot v2 2.5° 預設值作 placeholder，protocol version 帶 `-provisional` 後綴，不得視為正式凍結。
- **Dependency state**：Formal freeze（T0）仍 Blocked until WP-52 真人 pilot evidence 到位；T1~T3 骨架切片本身不受此阻擋（GD-28 override），T4/T5 仍不執行。

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

### 2026-09-01 — T1 placeholder 骨架：`peek_click_transfer_v1` config

- **不是 T0 freeze 完成**：task-checklist.md T0/T1 checkbox 維持未勾選；本節只記錄 GD-28 override 下的骨架切片。
- 新增 [src/drill/peek_click_transfer_v1.ts](../../../../src/drill/peek_click_transfer_v1.ts)：`peekClickTransferV1`（`id`/`drillId` = `peek_click_transfer_v1`、`mode:'assessment'`、`sceneId:'peek-ad-corridor-v1'`），沿用 pilot v1/v2 的 wrapper shape（`sceneId`/`clearanceOptions`/`visibility` 隨 `drill` 一起帶），因為正式版沿用同一個 corridor 場景，T4 Session Plan 整合會需要這兩個欄位。
- Placeholder 數值：角尺寸沿用 pilot v2 的 2.5° 預設候選、8u distance、20 count、既有 timing/visibility；`protocolVersion` = `peek-click-transfer-v1.0.0-provisional`（刻意帶 `-provisional` 後綴，不用 OQ-53-1 預定的正式字串）；seed 96000（獨立於 pilot v1 的 94000 系列與 pilot v2 的 95000/95100/95200 系列，匯出資料不會與任一 pilot cohort 混淆）。
- 新增 [src/drill/peek_click_transfer_v1.test.ts](../../../../src/drill/peek_click_transfer_v1.test.ts)：覆蓋 id/mode/scene/cue/count/timeout/visibility/hitbox、seed 不與 pilot v1/v2 衝突、`loadDrill` 對 `peek-ad-corridor-v1` 的 clearance 驗證，以及一個「provisional 標記存在」的測試——這個測試設計成之後若有人直接把正式凍結值套進來卻忘記拿掉 provisional 標記會紅燈。
- Verification：`npx vitest run src/drill/` 18 files / 154 tests 全綠；`npx tsc --noEmit` 乾淨。

## Decision log

| ID | 決策 | 理由 | 狀態 |
|---|---|---|---|
| D-53.1 | `peek_click_transfer_v1` 使用新的 formal drill id | exact history/trend cohort 不能與 pilot ids 混用 | Proposed |
| D-53.2 | Formal release 需要 `meta.assessment` 與 compatibility key | WP-48/49 只保存與趨勢化 Assessment | Proposed |
| D-53.3 | formal Session Plan 不改 stage6 default roster | 避免既有四家族 Assessment 順序漂移 | Proposed |
| D-53.4 | 使用者 2026-09-01 明確 override No-go，允許先建 T1~T3 placeholder 骨架（不含 T4/T5） | 縮短未來真人 evidence 到位後的落地時間；骨架不寫入正式 history/trend，風險收斂在事後換掉 placeholder 數值 | ✅ 已拍板，見全域 [DECISIONS.md GD-28](../../../DECISIONS.md) |

### 2026-09-01 — No-go 期間 override：開始 T1~T3 placeholder 骨架

- **仍未通過 T0 freeze gate**：WP-52 真人 pilot evidence（[T4-manual-pilot-gate.md](../wp-52-peek-click-transfer-pilot-v2/T4-manual-pilot-gate.md)）尚未執行；本節記錄的是使用者明確 override 後的骨架工作，不代表 WP-53 T0 已完成，task-checklist.md 對應項目**不勾選**。
- 決策見上表 D-53.4 與全域 [DECISIONS.md GD-28](../../../DECISIONS.md)。
- Placeholder 數值來源：沿用 `peek_click_transfer_pilot_v2` 的 2.5° 預設候選（widthU/heightU/depthU、8u distance、20 count、既有 timing/visibility），因為這是目前唯一有任何（即便只是研究者手動走查）驗證過的候選；protocol version 使用 `peek-click-transfer-v1.0.0-provisional`，刻意不採用 OQ-53-1 預定的正式字串，避免混淆。
- 真人 evidence 到位、WP-53 T0 真正拍板後，須：(1) 把上述 placeholder 常數換成 freeze decision 產出的實際值；(2) 移除程式碼與文件中的 provisional/placeholder 標記；(3) 回填 task-checklist.md 對應 box；(4) 視差異決定是否需要重新跑一輪 T1~T3 測試。

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
