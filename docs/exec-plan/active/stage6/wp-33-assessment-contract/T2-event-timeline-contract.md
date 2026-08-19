# T2 — 共同事件時間線型別凍結(欄位形狀,不含計算)

> Part of [WP-33 assessment-contract](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(可與 T1 並行,不需要 `AssessmentMeta`) |
| **Risk / Cplx** | Low / Low |
| **Touches** | `src/data/assessmentTimeline.ts`(新) |
| **狀態** | ⬜ |

## Objective

凍結 FR-F3 的事件時間線契約:**只定義欄位形狀**,不寫任何計算邏輯——`visibleFraction(t)`/`t_measurement_onset` 的實際算法是 WP-34 T0 spike 之後才能決定(README §2.3a 三個候選方案未拍板)。本 task 的產出是讓 WP-34~37 有共同型別可以 import,且同名事件不會被各自重新定義。

## In scope

1. `src/data/assessmentTimeline.ts`(新檔):

   ```ts
   /**
    * 共同事件時間線契約(FR-F3)。欄位形狀凍結於 WP-33;計算邏輯留給各家族 WP
    * (`tFirstVisible`/`tMeasurementOnset`/`tFullExposure` 的引擎實作見 WP-34)。
    * 任一欄位若已由既有 TS 構念定義(如 `t_visible`/`t_detect`),下游 WP 必須呼叫既有函式,
    * 不得在此新賦語意(C-D4)。
    */
   export interface AssessmentTimelinePoint {
     readonly tFirstVisible?: number;
     readonly tMeasurementOnset?: number;
     readonly tFullExposure?: number;
     readonly tStop?: number;
   }

   /** 逐 tick 可見比例;WP-34 T0 spike 決定產生方式後,此型別的實作方 module 由 WP-34 補上。 */
   export type VisibleFractionSeries = readonly number[];
   ```

2. 於 `docs/operational/analysis-assessment-contract.md` §1 補一段「事件時間線欄位對照表」,列出：
   - 既有(不得重新定義):`t_visible`(WP-21 pop-in,`DrillEvent.type==='visible'`)、`t_detect`(`detectionDerivation.ts`)、`t_first_on_target`/`target_stop`/`t_fire`(`compute.ts`/`peekWindows.ts`)。
   - 新增(本契約定義,計算留待 WP-34):`tFirstVisible`、`tMeasurementOnset`、`tFullExposure`、`tStop`。
   - 明文:`tFirstVisible` 與既有 `t_visible` 的差異——`t_visible` 是 WP-21 的二元 pop-in 事件時刻,`tFirstVisible` 是 WP-34 連續可見度模型下的「幾何首次可見」,兩者在 pop-in 場景數值上可能相等,但概念上不是同一個欄位(pop-in 沒有漸進可見度可言)。

## Out of scope

- `visibleFraction(t)` 的實際計算(WP-34)。
- 任何家族協定(`hold-click-v1` 等)如何填入 `AssessmentTimelinePoint`(WP-34~37)。

## Steps

- [ ] 新增 `src/data/assessmentTimeline.ts`,定義 `AssessmentTimelinePoint`/`VisibleFractionSeries`。
- [ ] 型別層單元測試:斷言介面欄位存在性(TypeScript 編譯期即可保證,額外補一個 smoke test 建構最小合法物件,確認全欄位可省略)。
- [ ] `analysis-assessment-contract.md` 補「事件時間線欄位對照表」小節,含既有 vs 新增的差異說明。
- [ ] 覆核:`grep -rn "tFirstVisible\|tMeasurementOnset\|t_visible\|t_detect" src/` 確認新型別的命名不與既有 camelCase/snake_case 混用慣例衝突(既有匯出欄位多為 camelCase,如 `t_visible` 實際型別欄位需以 `src/metrics/peekWindows.ts` 現行命名為準核對)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | `AssessmentTimelinePoint`/`VisibleFractionSeries` 型別落地 | `tsc --noEmit` 通過 |
| ② | 事件時間線欄位對照表寫入 `analysis-assessment-contract.md`,含既有/新增對照與 `tFirstVisible` vs `t_visible` 差異說明 | 文件章節存在 |
| ③ | smoke test 綠 | 最小合法物件建構測試通過 |
| ④ | **不含任何計算邏輯**(零函式,只有型別) | code review 檢查點;檔案內容只有 `interface`/`type` 宣告與註解 |
| ⑤ | `npm run test:ci` 全綠 | 貼原始輸出到 progress.md |

## Commit

`feat(wp-33): T2 — 共同事件時間線型別凍結(AssessmentTimelinePoint,欄位形狀不含計算,FR-F3)`
