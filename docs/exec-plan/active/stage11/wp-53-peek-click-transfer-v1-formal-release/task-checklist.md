# WP-53 — task checklist

> 狀態符號：`[ ]` pending · `[-]` in progress · `[x]` complete。每個 task 完成後更新 [progress.md](progress.md) 與 stage11 [progress.md](../progress.md)。

> **2026-09-01**：以下全數仍 `[ ]` pending——WP-53 尚未開工（No-go，見 [stage11 README](../README.md) §6）。本輪上游 WP-52 新增了 `peek_click_transfer_pilot_v2_masked` 變體（GD-7 記名例外，見 [progress.md](progress.md) 同日條目），但這不是 WP-53 的 task，此處不勾動任何項目，避免造假進度。
>
> **2026-09-01（同日，後續）**：使用者明確 override 上述 No-go，要求先建 T1~T3 的 **placeholder 骨架**（見全域 [DECISIONS.md GD-28](../../../DECISIONS.md)、本 WP [progress.md](progress.md) D-53.4）。T1 的 `peek_click_transfer_v1.ts` config + tests、T2 的 `peekClickTransferConditions.ts`(condition cell) + compatibility key tests、T3 的 `DrillMetricRegistry` 註冊 + pilot 隔離測試已完成，但凍結數值全為 provisional 占位值，不是真人 evidence 拍板的結果——故 T0/T1/T2/T3 checkbox **仍不勾選**；只有等真人 pilot evidence 到位、T0 真正拍板後，才會把 placeholder 換成正式值並回填這裡的 box。T3 沒有真正 `status:'ready'` 的數值投影測試（見 progress.md 同日條目「已知缺口」），留給 T5 或未來獨立切片。T4（Session Plan 整合）與 T5（E2E）不在本次骨架範圍內。

## T0 — Freeze decision gate

- [ ] 確認 WP-52 T-exit 完成
- [ ] 收集 WP-52 pilot evidence links
- [ ] 拍板 formal protocol version
- [ ] 拍板 formal frozen parameters
- [ ] 拍板 formal Session Plan policy
- [ ] 拍板 primary trend metrics
- [ ] `DECISIONS.md` 新增 formal freeze GD

## T1 — Formal Assessment drill config

- [ ] 新增 `peek_click_transfer_v1` config
- [ ] `mode:'assessment'` 與 `drillId:'peek_click_transfer_v1'` tests
- [ ] formal config 與 freeze decision 逐欄對齊 tests
- [ ] pilot v1/v2 practice-only tests 維持全綠

## T2 — Assessment metadata and compatibility

- [ ] formal run 寫入 `meta.assessment`
- [ ] 新增 formal condition cell builder
- [ ] compatibility key positive/negative tests
- [ ] 缺 assessment / wrong drill id 負向 tests

## T3 — Metric registry and history/trend projection

- [ ] `DrillMetricRegistry` 註冊 exact `peek_click_transfer_v1`
- [ ] descriptors 定義 primary/non-primary metrics
- [ ] projection 使用 `derivePeekClickTransferMetrics`
- [ ] pilot ids 不進 formal registry/trend
- [ ] history/trend focused tests 通過

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
