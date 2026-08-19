# T3 — `hold-click-v1` 協定 config + 預瞄/反應/取得/首發指標

> Part of [WP-34 hold-click-visibility](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1(可見度時間線)+ T2(occlusion 場景) |
| **Risk / Cplx** | Low / Med |
| **Touches** | `src/drill/`(`hold-click-v1` drill config)、`src/metrics/`(指標組裝,複用既有 `detectionDerivation.ts`/`compute.ts`) |
| **狀態** | ⬜ |

## Objective

交付 FR-F6:`hold-click-v1` Assessment 協定——目標出現後允許立即開火,構念 = 預瞄偏差、`t_detect − t_measurement_onset`、取得、首發。

## In scope

1. `hold-click-v1` drill config(使用 T2 的 `peek-corridor` 場景 + `allowedOcclusionPropIds`/`exposedRestEnvelope`,`mode: 'assessment'`,承 WP-33 契約)。
2. 指標組裝(複用既有函式,不重推):
   - 預瞄偏差 / 預期出現線高度偏差:出現前的瞄準狀態(讀 `ticks[].aim`,不需要新推導)。
   - `t_detect − t_measurement_onset`:呼叫既有 `deriveDetectionMetrics`(`t_detect`)與 T1 的 `tMeasurementOnset`,兩者相減。
   - 取得 `t_first_on_target − t_detect`:複用既有 on-target 幾何(`trackingDerivation.ts`/`detectionDerivation.ts` 既有邏輯)。
   - 首發 `t_fire − t_first_on_target`:複用 `compute.ts`/`peekWindows.ts` 既有首發判定。
3. `anticipation` flag:提早開火(曝光前開火)標記,呼應 README §3 failure mode(承既有 hit detection 不檢查遮蔽的事實)。

## Out of scope

- `hold-track-v1`(WP-35,獨立協定)。
- 任何既有構念(`t_detect`/on-target/首發)的重新定義——一律呼叫既有函式(C-D4)。

## Steps

- [ ] `hold-click-v1` drill config 落地,套用 T2 的 occlusion 場景。
- [ ] 指標組裝函式:呼叫 T1 `deriveVisibilityTimeline` + 既有 `deriveDetectionMetrics`/`trackingDerivation`/`compute.ts`,不重推任何既有量。
- [ ] `anticipation` flag 邏輯(開火時刻早於 `tFirstVisible` 或 `tMeasurementOnset`)。
- [ ] 端到端測試:合成 drill 跑一輪,驗證各指標數值與時間點合理。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | `hold-click-v1` 不重新定義任何既有構念(`t_detect`/on-target/首發皆呼叫既有函式) | code review 檢查點;grep 確認無重複實作 |
| ② | 端到端合成 drill 測試綠 | 單元/整合測試 |
| ③ | `anticipation` flag 正確標記提早開火案例 | 單元測試(提早/準時/逾時三案例) |
| ④ | 框架 v1 驗收條件「`hold-click` 不宣稱獨立 tracking 能力」成立 | 文件/程式碼未輸出任何 tracking 專屬指標 |
| ⑤ | `npm run test:ci` 全綠 | 貼原始輸出到 progress.md |

## Commit

`feat(wp-34): T3 — hold-click-v1 協定 + 預瞄/反應/取得/首發指標(FR-F6)`
