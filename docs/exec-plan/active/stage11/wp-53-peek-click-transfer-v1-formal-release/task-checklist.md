# WP-53 — task checklist

> 狀態符號：`[ ]` pending · `[-]` in progress · `[x]` complete。每個 task 完成後更新 [progress.md](progress.md) 與 stage11 [progress.md](../progress.md)。

> **2026-09-01**：以下全數仍 `[ ]` pending——WP-53 尚未開工（No-go，見 [stage11 README](../README.md) §6）。本輪上游 WP-52 新增了 `peek_click_transfer_pilot_v2_masked` 變體（GD-7 記名例外，見 [progress.md](progress.md) 同日條目），但這不是 WP-53 的 task，此處不勾動任何項目，避免造假進度。
>
> **2026-09-01（同日，後續）**：使用者明確 override 上述 No-go，要求先建 T1~T3 的 **placeholder 骨架**（見全域 [DECISIONS.md GD-28](../../../DECISIONS.md)、本 WP [progress.md](progress.md) D-53.4）。T1~T3 骨架完成但凍結數值全為 provisional 占位值，故當時 T0~T3 checkbox 全數未勾選。
>
> **2026-09-01（同日，第三輪）**：使用者提供 3 場真人 `peek_click_transfer_pilot_v2_masked` session 匯出，並確認 WP-52 T4 manual checklist 已逐項走查完成（見 [wp-52 T4-manual-pilot-gate.md](../wp-52-peek-click-transfer-pilot-v2/T4-manual-pilot-gate.md)「Evidence collected」）。使用者在被告知「n=1 是 smoke test，非 population-level pilot sample」的限制後，明確拍板 n=1 對本次 WP-53 T0 已足夠（OQ-52-4）。**WP-53 go/no-go 由 No-go 改為 Go**，T0 formal freeze 拍板（全域 [DECISIONS.md GD-29](../../../DECISIONS.md)），T1~T3 的 provisional 骨架已轉為正式凍結值——以下 T0/T1/T3 全數 checkbox 回填，T2 除「main.ts 即時組裝 meta.assessment」（等 T4 Session Plan 整合才有實際可跑的 formal run）外回填。T4（Session Plan 整合）與 T5（E2E）仍不在本次範圍。

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

- [ ] formal run 寫入 `meta.assessment`（main.ts 即時組裝——目前這個 drill 尚無法在 app 中被選到/跑起來，需要 T4 Session Plan 整合才有實際的「formal run」可寫）
- [x] 新增 formal condition cell builder
- [x] compatibility key positive/negative tests
- [x] 缺 assessment（T2）／wrong drill id（T3 registry 隔離測試）負向 tests

## T3 — Metric registry and history/trend projection

- [x] `DrillMetricRegistry` 註冊 exact `peek_click_transfer_v1`
- [x] descriptors 定義 primary/non-primary metrics
- [x] projection 使用 `derivePeekClickTransferMetrics`
- [x] pilot ids 不進 formal registry/trend
- [x] history/trend focused tests 通過（registry 層測試全綠；真正 `status:'ready'` 數值投影測試仍是已知缺口，見 progress.md，留給 T5）

## T4 — Formal Session Plan integration

- [ ] 新增 formal transfer roster/preset
- [ ] 不修改 stage6 default four-family roster golden output
- [ ] `SessionRunner` resolve formal transfer id
- [ ] `SessionPlanSetup` 可選 formal preset
- [ ] metadata 包含 formal preset/session context

## T5 — E2E acceptance and regression

- [ ] Playwright：formal transfer run 完成並 auto-save
- [ ] Playwright：history exact drill list 出現 `peek_click_transfer_v1`
- [ ] Playwright：trend registry 顯示 primary metric
- [ ] Practice pilot v1/v2 不出現在 history
- [ ] Stage6 Session Plan regression 通過

## T-exit

- [ ] full CI exit 0
- [ ] transfer-focused E2E exit 0
- [ ] operational docs synced
- [ ] `docs/MAP.md` / `docs/exec-plan/README.md` synced
- [ ] 若修改 code，`graphify update .` 已執行
- [ ] staged file audit complete
