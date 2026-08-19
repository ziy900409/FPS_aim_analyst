# T1 — diagnosisRules.ts:七模式規則表 + evaluateDiagnosis() + recommendationVersion

> Part of [WP-38 diagnosis-recommendation](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(落點拍板 + 上游介面覆核) |
| **Risk / Cplx** | Med(純函式,零新幾何;風險集中在優先序規則與門檻版本化紀律是否落實) |
| **Touches** | ADD `src/metrics/diagnosisRules.ts`;REUSE `src/metrics/holdClickMetrics.ts`/`trackingDerivation.ts`/`spiderShotMetrics.ts`/`counterstrafeMetrics.ts`(只讀,不改) |
| **狀態** | ⬜ |

## Objective

交付 FR-F14:純函式 `evaluateDiagnosis()` 消費 WP-34/35/36/37 已計算好的指標,依框架 v1 七模式證據規則表判定至多一主一次弱項,附來源指標/`n`/flags,並以版本化 `DiagnosisThresholds`/`recommendationVersion` 管理門檻。

## In scope

1. `diagnosisRules.ts` 定義 [README §5](README.md#5-interface-contracts草案wp-3637-部分待其-t-exit-後由-t0-覆核) 的型別:`DiagnosisLabel`/`DiagnosisEvidence`/`DiagnosisFinding`/`DiagnosisResult`/`DiagnosisThresholds`/`DiagnosisInputs`。
2. 七模式判定邏輯,逐模式列出輸入來源(至少覆蓋一個非唯一家族的交叉案例,例如 `flick-control` 同時檢查 WP-34 `acquisitionFromDetectMs` 與 WP-36 `stopControl.overshootDeg`,承 README Failure modes 表最後一列)。
3. 優先序規則(依 OQ-S6-24 的 T0 初判定案):證據鏈由上而下依序判定,前一模式成立即排除後續模式的判定資格(或依 T0 讀碼結果調整為其他明確規則,寫入 `analysis-diagnosis.md` 起稿段落)。
4. `qualityGateStatus !== 'ok'` 短路:直接回傳 `{ status: 'insufficient-data' }`,不進入七模式判定(FR-F16/C-D3)。
5. `DiagnosisThresholds` 以建構參數注入,不寫死字面常數;預設值標記為「pilot 前候選」。
6. 至少七組合成 fixture(每模式一組,含來源指標與門檻邊界值),外加一組「兩模式同時滿足證據條件」的邊界案例驗證優先序規則,外加一組「只有單一測試家族資料」的案例(承 README Failure modes 表)。

## Out of scope

- 個人歷史聚合(T2)。
- 結果頁呈現(T3)。
- 門檻最終凍結數值(WP-39 pilot)。

## Steps

- [ ] 定義型別 + `evaluateDiagnosis()` 骨架。
- [ ] 逐模式實作判定邏輯,對照 README §0-5 的家族輸入對照表。
- [ ] 優先序規則實作 + 邊界案例測試。
- [ ] `qualityGateStatus` 短路邏輯 + 測試(品質閘失敗但指標數值正常的案例)。
- [ ] 單家族案例測試(只有架槍/只有 Spider Shot 資料)。
- [ ] `analysis-diagnosis.md` 起稿:七模式表 + 優先序規則 + 門檻版本化紀律。
- [ ] `npx vitest run` 全綠。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 七模式各自至少一組合成 fixture 通過 | `diagnosisRules.test.ts` 綠 |
| ② | 優先序規則在「兩模式同時成立」邊界案例下產生確定性結果 | 邊界案例測試綠 |
| ③ | 品質閘失敗一律短路,不進入七模式判定 | 短路測試綠 |
| ④ | 門檻無裸露字面常數(全數經 `DiagnosisThresholds` 注入) | code review / grep 數字字面量 |
| ⑤ | `npm run test:ci` 全綠 | CI 輸出貼 progress.md |

## Commit

`feat(wp-38): T1 — diagnosisRules.ts(七模式規則表 + evaluateDiagnosis + recommendationVersion)`
