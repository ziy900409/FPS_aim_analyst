# WP-53 — progress / decision log

## Status

- **Current**：✅ T0 formal freeze 已拍板（2026-09-01，見全域 [DECISIONS.md GD-29](../../../DECISIONS.md)）。T1~T3 的 provisional 骨架已轉為正式凍結值（此前的 [GD-28](../../../DECISIONS.md) override 狀態已關閉）。T4（Session Plan 整合）與 T5（E2E）尚未開工。
- **Scope state**：根據 WP-52 evidence（人工 checklist + 3 場真人 `peek_click_transfer_pilot_v2_masked` session）新增 formal `peek_click_transfer_v1` Assessment，不修改 pilot v1/v2。凍結值：`protocolVersion=peek-click-transfer-v1.0.0`、`angularSizeDeg=2.5`、`distanceU=8`、`targetCount=20`，timing/visibility 沿用 pilot v1/v2 既有值。
- **Dependency state**：T0~T3 已完成。T4 需要 formal Session Plan preset/roster 設計與實作（不改 stage6 default）；T5 需要 E2E 驗收，兩者皆待後續切片。

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

### 2026-09-01 — T2 placeholder 骨架：formal condition cell + compatibility key

- **不是 T0 freeze 完成**：仍是 GD-28 override 下的骨架切片，task-checklist.md T2 checkbox 維持未勾選。
- 新增 [src/metrics/peekClickTransferConditions.ts](../../../../src/metrics/peekClickTransferConditions.ts)：`buildPeekClickTransferV1ConditionCell()`，單一來源（GD-7 風格）直接從凍結的 `peekClickTransferV1` config 讀 angularSize/distance/timeout/count/visibility，而非另開一份硬寫常數；config 一動這個 cell 就跟著動。沒有另外寫 `meta.assessment` 組裝的 helper——那只是一個物件字面量（`{ protocolVersion, assessmentFeedbackPolicy }`），寫一個函式包一行字面量不划算，測試直接構造。main.ts 的即時組裝（把這個 protocolVersion 接進正式跑一場 formal run 的即時 export）留給 T4（Session Plan 整合，尚未執行），現在的 config 還沒有任何方式能在 app 裡被選到。
- 新增 [src/metrics/peekClickTransferConditions.test.ts](../../../../src/metrics/peekClickTransferConditions.test.ts)：condition cell 決定性/欄位覆蓋、`buildCompatibilityKey` 正向組 key、缺 `meta.assessment` 負向 throw、相同 cell 兩場 run 視為 compatible、不同 cell 視為 incompatible。
- Verification：`npx vitest run src/metrics/` 25 files / 153 tests 全綠；`npx tsc --noEmit` 乾淨。

### 2026-09-01 — T3 placeholder 骨架：`DrillMetricRegistry` 註冊 `peek_click_transfer_v1`

- **不是 T0 freeze 完成**：仍是 GD-28 override 下的骨架切片，task-checklist.md T3 checkbox 維持未勾選。
- 修改 [src/history/DrillMetricRegistry.ts](../../../../src/history/DrillMetricRegistry.ts)：比照既有 `spider-shot-v2` 的 registration 寫法（同檔案內 colocate condition cell / descriptors / project()，而非另開檔案——沿用既有單一先例，不新建第二套 registry 模式），新增 `peek_click_transfer_v1` 的 `DrillMetricRegistration`：4 個 descriptors（2 個 primary：`valid-first-shot-rate`、`median-onset-to-hit-ms`，對齊 OQ-53-3 預設答案；2 個 non-primary：`first-shot-hit-rate`、`fire-before-gate-rate`），`project()` 呼叫既有 `derivePeekClickTransferMetrics()`（WP-45 交付，未新增/未修改該函式本體）搭配真實 `peek-ad-corridor-v1` 場景與 `peekClickTransferV1.visibility`；`registry version` 標 `0.1.0-provisional`（不是 `1.0.0`，避免被誤認為定案）。`targetConditionCellForRegistration` 分支呼叫 T2 的 `buildPeekClickTransferV1ConditionCell()`。
- 新增測試（[DrillMetricRegistry.test.ts](../../../../src/history/DrillMetricRegistry.test.ts)）：registration/descriptor 形狀、8 個 pilot v1/v2 cohort id（含 masked/randomized 變體）逐一驗證 `registrationForExactDrill` 回 `undefined` 且 `project()` 回 `unregistered-drill`（FR-53-6/NFR-53-3）、缺 `meta.assessment` 的 `not-assessment` guard。
- **已知缺口，刻意不補**：沒有寫一個真正 `status:'ready'` 的數值投影測試。原因：`peek-ad-corridor-v1` 的視覺遮蔽（on-target 離線推導)是**真實场景幾何**（`cover-wall-l/r` 的 AABB），玩家必須實際往左右 strafe 才能看到任一側目標；手工拼一組 tick/event fixture 若要通過真實 occlusion 判定，需要正確換算 `SIM_TO_WORLD`(=0.01) 與目標座標的座標系關係，容易做錯而不自知。要正確驗證這條路徑,應該像 `peek_click_transfer_pilot_v2.test.ts` 的 `runCadenceTimeoutExport` 一樣,真的跑一次 `SimLoop`。這件事留給 T5（E2E，目前不在本次骨架範圍內）或未來需要時的獨立切片,不在此處為了「補一個綠燈」而硬做一個可能語意錯誤的 fixture。
- Verification：`npx vitest run src/history/ src/metrics/ src/drill/` 50 files / 439 tests 全綠；`npx tsc --noEmit` 乾淨。

### 2026-09-01 — T0 formal freeze + T1~T3 un-provisioned (GD-29)

- 使用者提供 3 場真人 `peek_click_transfer_pilot_v2_masked` session 匯出並確認 WP-52 T4 manual checklist 已逐項走查（見 [wp-52 T4-manual-pilot-gate.md](../wp-52-peek-click-transfer-pilot-v2/T4-manual-pilot-gate.md)「Evidence collected」）。使用者明確拍板 n=1 對本次 WP-53 T0 已足夠（OQ-52-4），WP-53 go/no-go 由 No-go 改為 **Go**。凍結內容見全域 [DECISIONS.md GD-29](../../../DECISIONS.md) 與上表 D-53.5。
- 把 GD-28 的 T1~T3 provisional 骨架轉為正式凍結值：
  - [peek_click_transfer_v1.ts](../../../../src/drill/peek_click_transfer_v1.ts)：`protocolVersion` 由 `peek-click-transfer-v1.0.0-provisional` 改為 `peek-click-transfer-v1.0.0`；`angularSizeDeg` 從「借用 pilot v2 目前預設值」的 import 改成獨立 frozen literal `2.5`（刻意脫鉤，避免日後 pilot v2 改預設值時正式版被靜默牽動）；檔頭註解換成 GD-29 的凍結理由（1° floor / 5° ceiling risk，2.5° 保留鑑別度）。
  - [peek_click_transfer_v1.test.ts](../../../../src/drill/peek_click_transfer_v1.test.ts)：移除「provisional 標記必須存在」的測試，換成「carries the GD-29 formal freeze values」的正向驗證。
  - [peekClickTransferConditions.ts](../../../../src/metrics/peekClickTransferConditions.ts) + `.test.ts`：condition cell 的計算邏輯不變（本來就是從 config 單一來源讀值），只更新 PLACEHOLDER/provisional 用語為 GD-29 引用。
  - [DrillMetricRegistry.ts](../../../../src/history/DrillMetricRegistry.ts)：registry version 由 `0.1.0-provisional` 升為 `1.0.0`；檔頭與 section 註解同步更新為 GD-29。[DrillMetricRegistry.test.ts](../../../../src/history/DrillMetricRegistry.test.ts) 新增 `registration!.version === '1.0.0'` 斷言。
- **仍未做**：main.ts 即時組裝正式 run 的 `meta.assessment`、formal Session Plan preset/roster、E2E（T4/T5），超出本次範圍。
- Verification：`npx tsc --noEmit` 全專案乾淨；`npx vitest run` 190 files / 1724 tests passed（1 skipped，既有、與本次無關）。

## Decision log

| ID | 決策 | 理由 | 狀態 |
|---|---|---|---|
| D-53.1 | `peek_click_transfer_v1` 使用新的 formal drill id | exact history/trend cohort 不能與 pilot ids 混用 | ✅ Confirmed，T1 已實作 |
| D-53.2 | Formal release 需要 `meta.assessment` 與 compatibility key | WP-48/49 只保存與趨勢化 Assessment | ✅ Confirmed，T2 condition cell/compatibility 已實作（main.ts 即時組裝仍待 T4） |
| D-53.3 | formal Session Plan 不改 stage6 default roster | 避免既有四家族 Assessment 順序漂移 | ✅ Confirmed（政策拍板，實作待 T4） |
| D-53.4 | 使用者 2026-09-01 明確 override No-go，允許先建 T1~T3 placeholder 骨架（不含 T4/T5） | 縮短未來真人 evidence 到位後的落地時間；骨架不寫入正式 history/trend，風險收斂在事後換掉 placeholder 數值 | ✅ 已拍板並完成，見全域 [DECISIONS.md GD-28](../../../DECISIONS.md)（已由 GD-29 轉正） |
| D-53.5 | T0 formal freeze：n=1 真人 evidence 已足夠，`protocolVersion=peek-click-transfer-v1.0.0`、`angularSizeDeg=2.5`，OQ-53-1~4 全數拍板 | 2.5° 避開 1°(42.9% valid-first-shot,floor risk)與 5°(100%,ceiling risk)；使用者在被告知 smoke-test 限制後仍拍板 n=1 足夠 | ✅ 已拍板，見全域 [DECISIONS.md GD-29](../../../DECISIONS.md) |

### 2026-09-01 — No-go 期間 override：開始 T1~T3 placeholder 骨架

- **仍未通過 T0 freeze gate**：WP-52 真人 pilot evidence（[T4-manual-pilot-gate.md](../wp-52-peek-click-transfer-pilot-v2/T4-manual-pilot-gate.md)）尚未執行；本節記錄的是使用者明確 override 後的骨架工作，不代表 WP-53 T0 已完成，task-checklist.md 對應項目**不勾選**。
- 決策見上表 D-53.4 與全域 [DECISIONS.md GD-28](../../../DECISIONS.md)。
- Placeholder 數值來源：沿用 `peek_click_transfer_pilot_v2` 的 2.5° 預設候選（widthU/heightU/depthU、8u distance、20 count、既有 timing/visibility），因為這是目前唯一有任何（即便只是研究者手動走查）驗證過的候選；protocol version 使用 `peek-click-transfer-v1.0.0-provisional`，刻意不採用 OQ-53-1 預定的正式字串，避免混淆。
- 真人 evidence 到位、WP-53 T0 真正拍板後，須：(1) 把上述 placeholder 常數換成 freeze decision 產出的實際值；(2) 移除程式碼與文件中的 provisional/placeholder 標記；(3) 回填 task-checklist.md 對應 box；(4) 視差異決定是否需要重新跑一輪 T1~T3 測試。

## Open Questions

| ID | 問題 | Owner | Deadline | Impact |
|---|---|---|---|---|
| OQ-53-1 | formal protocol version string | 使用者 + 研究者 | T0 | ✅ Resolved（D-53.5，2026-09-01：`peek-click-transfer-v1.0.0`） |
| OQ-53-2 | formal Session Plan policy | 使用者 | T0 | ✅ Resolved（D-53.5，2026-09-01：獨立 formal transfer preset，不改 stage6 default；實作待 T4） |
| OQ-53-3 | primary trend metrics | 使用者 + 研究者 | T3 | ✅ Resolved（D-53.5，2026-09-01：`validFirstShotRate` + median `onsetToHitMs`） |
| OQ-53-4 | minimum participant/evidence threshold | 研究者 | T0 | ✅ Resolved（見 [wp-52 progress.md D-52.13](../wp-52-peek-click-transfer-pilot-v2/progress.md)：n=1 對本次 WP-53 T0 已足夠） |

## Verification log

| Date | Command | Result |
|---|---|---|
| 2026-08-28 | Planning-only | No production verification run |
| 2026-09-01 | `npx tsc --noEmit`（T1 骨架後） | exit 0 |
| 2026-09-01 | `npx vitest run src/drill/`（T1 骨架後） | 18 files / 154 tests passed |
| 2026-09-01 | `npx tsc --noEmit`（T2 骨架後） | exit 0 |
| 2026-09-01 | `npx vitest run src/metrics/`（T2 骨架後） | 25 files / 153 tests passed |
| 2026-09-01 | `npx tsc --noEmit`（T3 骨架後） | exit 0 |
| 2026-09-01 | `npx vitest run src/history/ src/metrics/ src/drill/`（T3 骨架後） | 50 files / 439 tests passed |
| 2026-09-01 | `npx tsc --noEmit`（T0 freeze + T1~T3 un-provisioned） | exit 0（全專案） |
| 2026-09-01 | `npx vitest run`（T0 freeze + T1~T3 un-provisioned，全專案） | 190 files / 1724 tests passed（1 skipped，既有） |
