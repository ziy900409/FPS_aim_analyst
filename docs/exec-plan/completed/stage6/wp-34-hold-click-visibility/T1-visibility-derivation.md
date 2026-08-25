# T1 — `visibilityDerivation.ts`:連續可見度時間線(離線,零 render/sim 依賴)

> Part of [WP-34 hold-click-visibility](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(候選②拍板) |
| **Risk / Cplx** | Med / Med |
| **Touches** | `src/metrics/visibilityDerivation.ts`(新)、`docs/operational/analysis-visibility.md`(起稿) |
| **狀態** | ✅ 完成(2026-08-19) |

## Objective

把 T0 拍板的候選②(scene 層封閉幾何離線解析)實作為純函式:給定一份 `ExportPayload` + `SceneConfig`,逐 tick 算出 `visibleFraction`,並推導 `tFirstVisible`/`tMeasurementOnset`/`tFullExposure` 三個時間點,填入 WP-33 已凍結的 `AssessmentTimelinePoint` 型別。

## In scope

1. `src/metrics/visibilityDerivation.ts`:
   - 目標當前 tick 的 N 個取樣點(中心 + 8 角,沿用 `clearance.ts` `sampleAabb()` 的取樣邏輯,改寫為吃 `TickRecord.tx/ty/tz` + hitbox 而非靜態 envelope)。
   - 逐取樣點呼叫既有 `segmentIntersectsAabb(eyeOriginForTick(tick, resolved), point, prop)`,對 `SceneConfig.propBounds` 逐一檢查。
   - `visibleFraction(tick) = 未被任何 prop 擋住的取樣點數 / N`。
   - `tFirstVisible`/`tMeasurementOnset`/`tFullExposure` 依 `VisibilityTimeline` 型別([README §5](README.md))推導,門檻/N 為建構參數(pre-registered,非硬編碼常數)。
2. 合成 fixture:純幾何已知案例(目標完全遮蔽/完全曝光/部分遮蔽/邊緣掠過遮蔽物角落)驗證 `visibleFraction` 數值正確。
3. `analysis-visibility.md` 起稿:記錄取樣點數 N、`t_*` 定義、與既有 `t_visible`(pop-in)/`t_detect` 的差異說明(承 WP-33 T2 `AssessmentTimelinePoint` 註解)。

## Out of scope

- Occlusion-aware `validateClearance`(T2)。
- `hold-click-v1` 協定本身(T3)。
- 可見度門檻/N 的最終凍結數值(WP-39 pilot)。

## Steps

- [x] 讀 `clearance.ts` 的 `sampleAabb`/`segmentIntersectsAabb`/`eyeOrigin.ts` 的 `eyeOriginForTick`,確認可直接 import 重用(不重寫)。
- [x] 實作 `deriveVisibilityTimeline()`。
- [x] 合成 fixture:至少四案例(全遮蔽/全曝光/部分遮蔽/邊緣掠過)+ OQ-S6-12 的 N 敏感度分析。
- [x] 起稿 `analysis-visibility.md`。
- [x] 單元測試涵蓋:`propBounds` 為空陣列(零遮蔽,等同現行 pop-in 語意的邊界情況)、目標為 `null`(無目標 tick)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | `deriveVisibilityTimeline` 對合成 fixture 逐案例正確 | 單元測試綠 |
| ② | 不 import `src/render/`/`src/sim/`/`SharedState` | code review 檢查點 + `eslint` import 邊界(若已有規則) |
| ③ | N 敏感度分析記錄於 `analysis-visibility.md`(OQ-S6-12) | 文件章節存在 |
| ④ | `npm run test:ci` 全綠 | 貼原始輸出到 progress.md |

## Commit

`feat(wp-34): T1 — visibilityDerivation.ts(離線連續可見度,FR-F5)`
