# T0 — entry-gate:驗上游 exit + cue/reversal 落點拍板

> Part of [WP-37 counterstrafe-protocols](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | WP-33 T-exit |
| **Risk / Cplx** | Low / Low |
| **Touches** | 無程式碼;產出決策記錄於 `progress.md` + 本 WP README §2/§7 覆核 |
| **狀態** | ✅ 完成(2026-08-24) |

## Objective

驗上游 WP-33 exit 已綠燈;覆核 [README §0 讀碼對帳](README.md) 的八條發現在執行當下仍成立(尤其確認 `MovementController.CS2_PROFILE`、`peekWindows.ts`、WP-32 已晉升的 `sync-v1`、`compute.ts` 的 `leftRightSymmetry` 自規劃至今未被其他並行 WP 改動出乎意料的形狀);拍板本 WP 兩個懸而未決的設計決策——`CueScheduleConfig` 的最終欄位形狀(§2①②③)與 `reversal-v1` hold→reversal 狀態機該落在 `DrillRunner` 還是 `TargetManager`(OQ-S6-19)。零程式碼,零測試異動。

## In scope

1. **驗 WP-33 T-exit**:讀 [`analysis-assessment-contract.md`](../../../../operational/analysis-assessment-contract.md) 確認七項凍結契約仍為權威,尤其 `AssessmentMode`(`DrillConfig.mode?`)與 `buildCompatibilityKey()`/`checkQualityGate()` 簽名未變。
2. **覆核 README §0 八條讀碼發現**:逐條對照當下 `src/sim/MovementController.ts`(`CS2_PROFILE.accuracyThreshold`)、`src/sim/TargetManager.ts`(`pendingSpawnAtMs`/`nextSide`/spawn 排程)、`src/drill/DrillRunner.ts`(`peekTimeoutMs`/`presentationMs` 到期迴圈)、`src/metrics/peekWindows.ts`(`tCounter`/`counterKey`/`tRelease`/`releaseKey`)、`src/metrics/researchMetrics.ts`(已晉升 `sync-v1` 的 `SyncRow`/`counterHoldMsForPeek`)、`src/metrics/compute.ts`(`leftRightSymmetry`/`fireTimingAlignmentMs`)是否與規劃階段讀到的行/邏輯一致;若並行的 WP-34/35/36 落地時改了這幾個檔案的相關段落,更新對帳結論並記錄於 Decision Log。
3. **拍板 `CueScheduleConfig` 落點細節(§2①②③)**:確認 `DrillConfig.cue?: CueScheduleConfig` 與 `kind: 'single' | 'hold-reversal'` 的欄位命名是否需要調整;確認 `schema.ts` 是否需要新增「`kind==='single'` 時 `holdDurationMs` 必須省略」的互斥驗證。
4. **拍板 reversal 狀態機落點(OQ-S6-19)**:比較 WP-35 fire-gating 落在 `DrillConfig.timing`/生命週期判定層的先例,與 WP-36 zone 落在 `TargetManager` 內部狀態的先例,決定 `holdDurationMs` 追蹤該放在 `DrillRunner.tick()`(讀 `state.held`)還是 `TargetManager.tick()`;記錄理由。
5. **初判 OQ-S6-20/OQ-S6-21**:grep `peekTimeoutMs` 於 `DrillRunner.ts` 確認到期迴圈是否可與 hold→reversal 狀態機共存;grep `mode\b` 於 `main.ts`/`ResultScreen.ts`/`buildCompatibilityKey` 呼叫端,初判 Practice 匯出是否已有守門。

## Out of scope

- 任何程式碼實作(T1/T2/T3)。
- 制動門檻/cue lead time 的凍結數值(WP-39 pilot)。

## Steps

- [x] (2026-08-24) 讀 `analysis-assessment-contract.md` 確認七項契約仍為權威。
- [x] (2026-08-24) 覆核 `pendingSpawnAtMs`/`nextSide`/`accuracyThreshold`，§0-1/§0-3/§0-8 發現仍準確。
- [x] (2026-08-24) 覆核 `peekTimeoutMs`/`presentationMs` 到期迴圈與 hold→reversal 的共存風險(OQ-S6-20 初判)。
- [x] (2026-08-24) 覆核 `mode`、主匯出與 `buildCompatibilityKey` 呼叫端，記錄 Practice 守門現況(OQ-S6-21 初判)。
- [x] (2026-08-24) 針對 `CueScheduleConfig` 欄位命名與 reversal 狀態機落點寫決策記錄(D-37.1)。
- [x] (2026-08-24) 針對 `cue` 與既有 `spawnDelayMsRange`/`peekTimeoutMs`/`presentationMs` 的併用規則拍板,記錄理由(D-37.2)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | WP-33 T-exit 契約已覆核 | progress.md 記錄核對結果 |
| ② | `CueScheduleConfig` 欄位命名拍板 | Decision Log D-37.1 |
| ③ | reversal 狀態機落點拍板(OQ-S6-19 關閉) | Decision Log D-37.1 |
| ④ | `cue` 與既有到期閘併用規則拍板 | Decision Log D-37.2 |
| ⑤ | OQ-S6-20/21 初判記錄(即使結論是「留待 T2/T3 定案」) | progress.md 記錄 |
| ⑥ | 零程式碼、零測試改動 | `git diff` 為空(僅 `docs/`) |

## Commit

`docs(wp-37): T0 — entry-gate(cue schedule 落點 + reversal 狀態機歸屬拍板)`
