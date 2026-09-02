# WP-53 — task checklist

> 狀態符號：`[ ]` pending · `[-]` in progress · `[x]` complete。每個 task 完成後更新 [progress.md](progress.md) 與 stage11 [progress.md](../progress.md)。

> **2026-09-01**：以下全數仍 `[ ]` pending——WP-53 尚未開工（No-go，見 [stage11 README](../README.md) §6）。本輪上游 WP-52 新增了 `peek_click_transfer_pilot_v2_masked` 變體（GD-7 記名例外，見 [progress.md](progress.md) 同日條目），但這不是 WP-53 的 task，此處不勾動任何項目，避免造假進度。
>
> **2026-09-01（同日，後續）**：使用者明確 override 上述 No-go，要求先建 T1~T3 的 **placeholder 骨架**（見全域 [DECISIONS.md GD-28](../../../DECISIONS.md)、本 WP [progress.md](progress.md) D-53.4）。T1~T3 骨架完成但凍結數值全為 provisional 占位值，故當時 T0~T3 checkbox 全數未勾選。
>
> **2026-09-01（同日，第三輪）**：使用者提供 3 場真人 `peek_click_transfer_pilot_v2_masked` session 匯出，並確認 WP-52 T4 manual checklist 已逐項走查完成（見 [wp-52 T4-manual-pilot-gate.md](../wp-52-peek-click-transfer-pilot-v2/T4-manual-pilot-gate.md)「Evidence collected」）。使用者在被告知「n=1 是 smoke test，非 population-level pilot sample」的限制後，明確拍板 n=1 對本次 WP-53 T0 已足夠（OQ-52-4）。**WP-53 go/no-go 由 No-go 改為 Go**，T0 formal freeze 拍板（全域 [DECISIONS.md GD-29](../../../DECISIONS.md)），T1~T3 的 provisional 骨架已轉為正式凍結值——以下 T0/T1/T3 全數 checkbox 回填，T2 除「main.ts 即時組裝 meta.assessment」（等 T4 Session Plan 整合才有實際可跑的 formal run）外回填。T4（Session Plan 整合）與 T5（E2E）仍不在本次範圍。
>
> **2026-09-01（同日，第四輪）**：完成 T4 — formal `'peek-click-transfer-v1'` Session Plan 家族、`SessionRunner` 解析、`main.ts` scene/clearance/`meta.assessment.protocolVersion` 佈線全數落地，不改 stage6 default 四家族與 pilot 家族。T2 的「formal run 寫入 `meta.assessment`」隨之補齊，回填。T5（E2E）仍不在本次範圍。
>
> **2026-09-01（同日，第五輪）**：完成 T5 — E2E 證實 T3 當時標記的「無真人手感 round-runner」缺口其實不成立：既有 `runCounterStrafeRound()` 對 `peek-ad-corridor-v1` 真實遮蔽幾何一樣能跑出真實命中、真正跑到 `ended`。新增 `tests/e2e/peek-click-transfer-v1-formal.spec.ts` 三個測試涵蓋 DoD 全五項。WP-53 僅剩 T-exit。

## T0 — Freeze decision gate

- [x] 確認 WP-52 T-exit 完成
- [x] 收集 WP-52 pilot evidence links
- [x] 拍板 formal protocol version（`peek-click-transfer-v1.0.0`）
- [x] 拍板 formal frozen parameters（`angularSizeDeg=2.5`／`distanceU=8`／`targetCount=20`／既有 timing/visibility）
- [x] 拍板 formal Session Plan policy（獨立 formal transfer preset，不改 stage6 default；**實作**待 T4）
- [x] 拍板 primary trend metrics（`validFirstShotRate` + median `onsetToHitMs`）
- [x] `DECISIONS.md` 新增 formal freeze GD（GD-29）

## T1 — Formal Assessment drill config

- [x] 新增 `peek_click_transfer_v1` config
- [x] `mode:'assessment'` 與 `drillId:'peek_click_transfer_v1'` tests
- [x] formal config 與 freeze decision 逐欄對齊 tests
- [x] pilot v1/v2 practice-only tests 維持全綠

## T2 — Assessment metadata and compatibility

- [x] formal run 寫入 `meta.assessment`（T4 落地：`main.ts` `ASSESSMENT_PROTOCOL_VERSION_BY_DRILL_ID` 依 drillId 分派 `protocolVersion`，stage6 四家族 fallback 回 `STAGE6_PROTOCOL_VERSION` 逐位不變）
- [x] 新增 formal condition cell builder
- [x] compatibility key positive/negative tests
- [x] 缺 assessment（T2）／wrong drill id（T3 registry 隔離測試）負向 tests

## T3 — Metric registry and history/trend projection

- [x] `DrillMetricRegistry` 註冊 exact `peek_click_transfer_v1`
- [x] descriptors 定義 primary/non-primary metrics
- [x] projection 使用 `derivePeekClickTransferMetrics`
- [x] pilot ids 不進 formal registry/trend
- [x] history/trend focused tests 通過（registry 層 unit test 全綠；真正 `status:'ready'` 數值投影改由 T5 的真人 E2E 覆蓋，而非在此另補一個手工 fixture 的 unit test——見 T5 條目）

## T4 — Formal Session Plan integration

- [x] 新增 formal transfer roster/preset（`TRANSFER_FORMAL_FAMILY_IDS = ['peek-click-transfer-v1']`，獨立於 pilot 的 `'peek-click-transfer'`）
- [x] 不修改 stage6 default four-family roster golden output（`TEST_FAMILY_IDS`/`buildFamilyOrder` 逐位不動；golden checkbox 順序/count 測試已更新以反映新增的第 6 個家族，而非改變既有四家族本身）
- [x] `SessionRunner` resolve formal transfer id（`resolveFamilyDrillId('peek-click-transfer-v1')` → `peekClickTransferV1.id`）
- [x] `SessionPlanSetup` 可選 formal preset（無需改動——泛型消費 `KNOWN_SESSION_FAMILY_IDS`，新 checkbox 自動出現）
- [x] metadata 包含 formal preset/session context（`main.ts` `availableDrills`/`PEEK_CLICK_TRANSFER_VISIBILITY_BY_DRILL_ID`/`ASSESSMENT_PROTOCOL_VERSION_BY_DRILL_ID` 三處佈線）

## T5 — E2E acceptance and regression

- [x] Playwright：formal transfer run 完成並 auto-save（`runCounterStrafeRound()` 真跑到 `ended`，20/20 命中，`showResultAndSaveToHistory` 真存）
- [x] Playwright：history exact drill list 出現 `peek_click_transfer_v1`
- [x] Playwright：trend registry 顯示 primary metric（2 場真實 run，metric selector + trend chart）
- [x] Practice pilot v1/v2 不出現在 history（真 practice run 被 guard 排除；即使強制帶 assessment override 也不會併入 formal cohort，仍是「尚未註冊」的獨立卡片，FR-53-6）
- [x] Stage6 Session Plan regression 通過（全 Playwright 套件 81/81，含既有 session-orchestrator/history-library/stage10-* 全數重跑）

## T-exit

- [ ] full CI exit 0
- [ ] transfer-focused E2E exit 0
- [ ] operational docs synced
- [ ] `docs/MAP.md` / `docs/exec-plan/README.md` synced
- [ ] 若修改 code，`graphify update .` 已執行
- [ ] staged file audit complete
