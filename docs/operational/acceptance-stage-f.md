# 階段 F 驗收清單 F — WP-39 T-exit / M16(stage6 交付)

> M16(stage6 交付)的個人瞄準能力測試框架 v1 驗收對照。逐項對應 [stage6 README §4 里程碑門控](../exec-plan/completed/stage6/README.md#4-里程碑門控)列舉的 10 條可機械判定條件,由 WP-33~39 既有測試證據覆核,不新增額外構念判準。
> Companion:[pilot-protocol-stage6.md](pilot-protocol-stage6.md) · [analysis-assessment-contract.md](analysis-assessment-contract.md) · [analysis-diagnosis.md](analysis-diagnosis.md) · [WP-39 progress](../exec-plan/completed/stage6/wp-39-calibration-freeze/progress.md)。

---

## 0. T-exit 執行基線(2026-08-25)

| 命令 | 結果 |
|---|---|
| `npm run test:ci`(首次覆核) | ❌ Playwright `full-drill.spec.ts:150` 斷言舊 `recommendation-pilot-candidate-v1` 版本字串;T2 已將 `main.ts` 診斷讀取源改為 `DIAGNOSIS_THRESHOLDS_V1`(`recommendation-v1.0.0`),該筆 e2e 斷言未同步更新——判定為 T2 遺留的回歸,非新設計缺陷 |
| 修復 | [`tests/e2e/full-drill.spec.ts`](../../tests/e2e/full-drill.spec.ts) 斷言改為 `recommendation-v1.0.0`(對齊 T2 凍結後的正式版本字串;`recommendation-pilot-candidate-v1` 常數本身保留於 [`diagnosisRules.ts`](../../src/metrics/diagnosisRules.ts) 作歷史記錄,未刪除) |
| `npx playwright test tests/e2e/full-drill.spec.ts -g "crossOriginIsolated" --project=edge` | ✅ 1 passed(修復後複驗) |
| `npm run test:ci`(複驗) | ✅ exit 0;Vitest **125 files / 944 tests** passed;Playwright **21 tests** passed |

---

## 1. 清單 F 驗收項

| # | 驗收項(對應 README §4 條件) | 判定方式 | 證據入口 | 狀態 |
|---:|---|---|---|---|
| F-1 | Assessment/Practice 契約封閉,`mode` 二態語意省略即 `'practice'` | **A**:契約型別 + 相容鍵/品質旗標判定式單元測試。 | [`assessmentContract.ts`](../../src/drill/assessmentContract.ts)、[`compatibilityKey.test.ts`](../../src/metrics/compatibilityKey.test.ts) | ✅ |
| F-2 | 三家族同名事件時間語意一致;各家族專屬事件型別不外洩到其他家族匯出 | **A**:跨家族一致性回歸測試同時斷言正向(同名事件語意一致)與反向(專屬事件不出現在他家族匯出)。 | [`tests/regression/stage6-cross-family-consistency.test.ts`](../../tests/regression/stage6-cross-family-consistency.test.ts) | ✅ |
| F-3 | `hold-click-v1` 可見度時間線由幾何離線推導,不宣稱獨立 tracking 能力 | **A**:合成 fixture 驗證 `visibleFraction`/`tMeasurementOnset` 幾何推導;指標組裝測試確認不重推 tracking 構念。 | [`visibilityDerivation.test.ts`](../../src/metrics/visibilityDerivation.test.ts)、[`holdClickMetrics.test.ts`](../../src/metrics/holdClickMetrics.test.ts) | ✅ |
| F-4 | `hold-track-v1` 停止/追蹤窗與開火時序互不宣稱對方構念(fire-gating 不進 sim 狀態機) | **A**:鎖定/解鎖 fire 單元測試 + 固定窗口不受提早擊殺影響的合成 fixture。 | [`holdTrackWindowInvariant.test.ts`](../../src/metrics/holdTrackWindowInvariant.test.ts) | ✅ |
| F-5 | Spider Shot 每次 transition 保存方向/`D_deg`/`W_deg`,`W_deg` 唯一換算來源 | **A**:座標→角度換算對表 + 既有 hitbox 單一來源(GD-7)決定性零修改回歸。 | [`spiderShotConditions.test.ts`](../../src/metrics/spiderShotConditions.test.ts)、[`spiderShotMetrics.test.ts`](../../src/metrics/spiderShotMetrics.test.ts) | ✅ |
| F-6 | 急停三子協定(`cued`/`reversal`/`free`)不共用未分層總分,L/R 各自 `n`/分布 | **A**:對稱指標單元測試驗證各側獨立輸出,無跨側合成分數。 | [`counterstrafeMetrics.test.ts`](../../src/metrics/counterstrafeMetrics.test.ts) | ✅ |
| F-7 | Assessment/Practice 不共用正式 baseline;pilot config 一律 `mode:'practice'` 且不可達 `buildCompatibilityKey()` | **A**:pilot config 產生器輸出全數斷言 `mode==='practice'`;session history 只接受含 `meta.assessment` 的匯出。 | [`pilotConfigs.test.ts`](../../src/pilot/pilotConfigs.test.ts)、[`sessionHistory.test.ts`](../../src/metrics/sessionHistory.test.ts) | ✅ |
| F-8 | 不相容比較鍵/樣本不足的 session 不產生進步/退步結論 | **A**:相容比較鍵欄位不等即不相容的正反例;`n < minN` 短路為 `'insufficient-data'`,無德爾塔/箭頭欄位。 | [`compatibilityKey.test.ts`](../../src/metrics/compatibilityKey.test.ts)、[`sessionHistory.test.ts`](../../src/metrics/sessionHistory.test.ts) | ✅ |
| F-9 | 結果呈現對每個診斷顯示來源指標/`n`/flags/`recommendationVersion` | **A**:`ResultScreen` 診斷卡片欄位契約測試 + E2E `full-drill.spec.ts` 同一匯出 payload 驗證封閉欄位集合與版本字串。 | [`diagnosisRules.test.ts`](../../src/metrics/diagnosisRules.test.ts)、[`ResultScreen.test.ts`](../../src/ui/ResultScreen.test.ts) | ✅ |
| F-10 | 品質閘失敗短路診斷,未過 validity/quality gate 的指標不得進推薦規則 | **A**:`qualityGateStatus !== 'ok'` 時 `evaluateDiagnosis()` 直接回傳 blocked/insufficient,不計算主/次弱項。 | [`diagnosisRules.test.ts`](../../src/metrics/diagnosisRules.test.ts) | ✅ |
| F-11 | Pilot 參數(候選值/seed roster)與正式凍結常數分開保存,可稽核 | **A**:pilot seed roster(`90000` 起)與四協定既有 assessment seed 逐一不相等;`PILOT_CANDIDATE_DIAGNOSIS_THRESHOLDS` 舊常數保留未刪除。 | [`pilotConfigs.test.ts`](../../src/pilot/pilotConfigs.test.ts)、[`protocolFreeze.test.ts`](../../src/pilot/protocolFreeze.test.ts) | ✅ |
| F-12 | `protocolVersion = 1.0.0` 正式發布可重現,凍結一律升版不原地改語意 | **A**:`STAGE6_PROTOCOL_VERSION`/`DIAGNOSIS_THRESHOLDS_V1.version` 常數化測試;凍結決策記錄於 [DECISIONS.md](../exec-plan/DECISIONS.md) GD-23。 | [`protocolVersion.ts`](../../src/drill/protocolVersion.ts)、[`protocolFreeze.test.ts`](../../src/pilot/protocolFreeze.test.ts) | ✅ |

---

## 2. 已知限制(隨 T-exit 一併記錄,非阻塞項)

- **無真人 pilot 匯出資料**:GD-23 明文記錄本次凍結是「以既有 pre-registered 候選值驗證發布機制」的**暫定**凍結,非資料驅動的最終數值。未來若有真人 pilot 統計量支持修改,必須升版並在 `DECISIONS.md` 附上依據,不得原地覆寫(承 §3 執行規則第 2/4 條)。
- **四家族同步發布**:OQ-S6-27 拍板為同步發布 `1.0.0`,而非逐家族分批;若未來某家族需要獨立於其他家族凍結,需新開決策記錄,不得沿用本次的單一全域版本敘事。

---

## 3. M16 判定

✅ **驗收清單 F 全項(F-1~F-12)通過**:對應 stage6 README §4 的 10 條機械判定條件全數覆核;T-exit 覆核過程中發現並修復一筆 T2 遺留的 e2e 斷言回歸(舊版本字串),修復後 `npm run test:ci` 全綠(Vitest 125 files / 944 tests;Playwright 21 tests)。

**M16(stage6 交付)達成**:個人瞄準能力測試框架 v1 的三個測試家族(架槍/Spider Shot/急停)+ 共同 Assessment/Practice 契約 + 診斷推薦引擎 + calibration pilot 工具 + `protocolVersion = 1.0.0` 凍結發布,全部落地並通過驗收清單 F。§2 已知限制不阻塞 M16(框架設計本身不要求真人資料才能發布可重現的骨架),但限制了「凍結值」目前的效度聲稱範圍,已如實記錄。
