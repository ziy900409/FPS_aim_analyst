# T1 — tracer 軌跡顯示(shotRays 環形格 + TracerView + UI 開關;render-only)

> Part of [WP-25 ballistics-tracer](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(OQ-25.1 端點語意);**不依賴 T2–T4/M11**,可與 WP-23/24 並行 |
| **Risk / Cplx** | Med / Med(風險在 GC 紀律與雙迴圈邊界,非演算法) |
| **Touches** | MODIFY `src/state/SharedState.ts`(`ShotRayRing` + `pushShotRay` + reset)、`src/loop/SimLoop.ts`(產彈點寫入一行)、`src/main.ts`(佈線);ADD `src/render/TracerView.ts`;MODIFY `src/ui/`(Controls 開關)+ 測試 |
| **狀態** | ✅ PASS(2026-07-13) |

## Objective

子彈軌跡可視化(FR-E7):sim 產彈點寫 `shotRays`(origin→endpoint),
`TracerView` render 唯讀繪製(單 draw call、壽命漸隱),UI Enabled/Disabled——
**sim 演進零改動、純顯示不記錄**。

## In scope

- `SharedState`:`ShotRayRing`(`ox,oy,oz,ex,ey,ez,seq: Float64Array` + `total/cursor`,
  `TRACER_CAP` 常數)+ `pushShotRay` + reset——**全面比照 `ImpactRing`**
  (預配置、seq 高水位、環狀覆寫最舊)。
- `SimLoop` 產彈點:命中 → endpoint = 命中點;未命中 → endpoint 依 OQ-25.1 語意
  (engagement plane 投影,重用 `projectMissOntoEngagementPlane` 幾何)。
  **僅新增一筆寫入,不動方向/命中計算**。
- `TracerView`(比照 `ImpactView`):單一 `InstancedMesh(TRACER_CAP)` 細長片段
  (origin→endpoint 定向縮放);壽命漸隱為 **render-only**(以 render 幀時間衰減
  opacity/縮尾,不讀 sim 時鐘);增量同步(seq 高水位早退);`dispose()` 完整。
- UI 開關:Controls 增「Tracer Enabled/Disabled」(預設依 T0;顯示層 state,
  **不進匯出**);關閉 = TracerView 不同步(零工作)。
- 測試:pushShotRay 環狀/覆寫/reset;TracerView 增量同步 + count;
  **sim 決定性零改動證據**(既有回歸零修改全綠——shotRays 為決定性演進的純函數輸出,
  不參與狀態演進)。

## Out of scope

- projectile 弧線 tracer(T3 落地後 endpoint 自然反映;曲線分段渲染觸發 = 視覺需求)、
  tracer 記錄/匯出、彈道模型(T2+)。

## Steps

- [x] (2026-07-13 12:00+02:00) `ShotRayRing` + push/reset + 單元測試。
- [x] (2026-07-13 12:00+02:00) 產彈點寫入(hit/miss 兩端點語意)+ SimLoop 測試。
- [x] (2026-07-13 12:00+02:00) **既有決定性/開火回歸零修改全綠**(證據記 progress)。
- [x] (2026-07-13 12:00+02:00) `TracerView` + 增量同步測試 + draw call 證據(單一 `InstancedMesh(TRACER_CAP)`)。
- [x] (2026-07-13 12:00+02:00) UI 開關 + browser smoke 證據記 progress(人工視覺檢視未執行)。
- [x] (2026-07-13 12:00+02:00) `npx vitest run` 全綠。

## Definition of Done

- sim 零改動證據(既有回歸零修改全綠);單 draw call;熱路徑零配置
  (預配置 + scratch 重用);開關可用;手動證據記 progress。

## Commit

`feat(wp-25): T1 tracer 軌跡顯示(shotRays 環形格 + TracerView;render-only 可開關)`
