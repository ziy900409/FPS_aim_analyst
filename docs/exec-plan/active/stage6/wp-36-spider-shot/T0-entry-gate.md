# T0 — entry-gate:驗上游 exit + 排程落點/欄位命名拍板

> Part of [WP-36 spider-shot](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | WP-33 T-exit |
| **Risk / Cplx** | Low / Low |
| **Touches** | 無程式碼;產出決策記錄於 `progress.md` + 本 WP README §2/§7 覆核 |
| **狀態** | ⬜ |

## Objective

驗上游 WP-33 exit 已綠燈;覆核 [README §0 讀碼對帳](README.md) 的五條發現在執行當下仍成立(尤其確認 `SpawnAreaConfig`/`TargetManager.sampleSpawnPose()`/`trackingDerivation.ts` 自規劃至今未被其他並行 WP 改動出乎意料的形狀);拍板本 WP 兩個懸而未決的設計決策——`DrillConfig.spiderShot` 排程落點的最終欄位命名(§2①)與 `zone`/`Meta.spawn.spiderShot` 欄位形狀。零程式碼,零測試異動。

## In scope

1. **驗 WP-33 T-exit**:讀 [`analysis-assessment-contract.md`](../../../../operational/analysis-assessment-contract.md) 確認七項凍結契約仍為權威,尤其 `CompatibilityKey.targetConditionCell`(OQ-S6-11,caller-owned 非空字串)與 `buildCompatibilityKey()` 簽名未變。
2. **覆核 README §0 五條讀碼發現**:逐條對照當下 `src/drill/DrillConfig.ts`(`SpawnAreaConfig`)、`src/sim/TargetManager.ts`(`sampleSpawnPose`/`hasAliveTarget`/`nextSide`)、`src/data/DataRecorder.ts`(`DrillEvent{type:'visible'}`)、`src/data/metadata.ts`(`SpawnMeta`)、`src/metrics/trackingDerivation.ts` 是否與規劃階段讀到的行/邏輯一致;若並行的 WP-34/35 落地時改了這幾個檔案的相關段落,更新對帳結論並記錄於 Decision Log。
3. **拍板排程落點細節(§2①)**:確認 `DrillConfig.spiderShot`(top-level,`SpiderShotScheduleConfig`)與 `SpiderPeripheralConfig`(`angularRadiusDegRange`/`azimuthDegRange`/`distanceURange`)的最終欄位名是否需要調整,並確認 `schema.ts` 的驗證是否需要新增「`spiderShot` 與 `targets.spawnArea`/`sequence.spawnDelayMsRange` 併用規則」(建議:兩套排程機制互斥,同時提供應報錯,避免歧義)。
4. **拍板 `zone`/`Meta.spawn.spiderShot` 欄位形狀**:確認 `DrillEvent{type:'visible'}.zone?: 'center' | 'peripheral'` 與 `SpawnMeta.spiderShot?: unknown` 的加入位置不會與 WP-34(`AssessmentTimelinePoint`)、WP-35(`TargetState` additive 欄位)的並行修改衝突(檢查 git blame / 最新 diff)。
5. **確認 §0-5 的 `trackingDerivation.ts` overshoot 覆蓋面初判**(OQ-S6-16):grep `overshoot\|undershoot\|dropCount\|reacquire` 於 `src/metrics/trackingDerivation.ts`,初步判斷是否已有可用輸出,或需要等 T3 才能定案(若 WP-35 T2 已交付 `trackingTransitions.ts`,評估能否直接複用其模式甚至其 dropCount/reacquire 函式本身,而非重新發明)。

## Out of scope

- 任何程式碼實作(T1/T2/T3)。
- `D_deg`/`W_deg` 公式的最終數值範圍(WP-39 pilot)。

## Steps

- [ ] 讀 `analysis-assessment-contract.md` 確認七項契約仍為權威;讀 `../wp-35-hold-track/progress.md`(若已有進度)確認是否有可複用的 `trackingTransitions.ts` 產出。
- [ ] `grep -rn "spawnArea\|sampleSpawnPose\|hasAliveTarget\|nextSide" src/sim/TargetManager.ts` 覆核 §0-1/§0-2/§0-3 讀碼發現是否仍準確。
- [ ] `grep -rn "overshoot\|undershoot\|dropCount\|reacquire" src/metrics/` 覆核 OQ-S6-16 初判。
- [ ] 針對排程落點與欄位命名寫決策記錄(D-36.1)。
- [ ] 針對 `spiderShot` 與既有 `spawnArea`/`spawnDelayMsRange` 的併用規則拍板(互斥 vs 允許共存),記錄理由(D-36.2)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | WP-33 T-exit 契約已覆核 | progress.md 記錄核對結果 |
| ② | 排程落點/欄位命名拍板 | Decision Log D-36.1 |
| ③ | `spiderShot` 與既有 spawn 機制併用規則拍板 | Decision Log D-36.2 |
| ④ | OQ-S6-16 初判記錄(即使結論是「留待 T3 定案」) | progress.md 記錄 |
| ⑤ | 零程式碼、零測試改動 | `git diff` 為空(僅 `docs/`) |

## Commit

`docs(wp-36): T0 — entry-gate(排程落點 + zone/spiderShot 欄位拍板)`
