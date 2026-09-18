# WP-71 T2 — `OpeningTargetCueView` render-only component

> FR-71.6／71.10 · NFR-71.3／71.4 · FM-71.3／71.5／71.8 · aim-analyst-ui

## Objective

交付一個不持有 gameplay state 的單 mesh view，以已凍結的 dark sports-science live-HUD 語言呈現非互動 cue。

## Steps

1. 新增 `src/render/OpeningTargetCueView.ts`，實作 README §2.3 handle；不得 import `SharedState`／`TargetState`／HitDetector。
2. 建構期建立一個 mesh/material；`configure()` 只更新 geometry/position/scale，`setVisible()` 只寫 boolean；dispose 移除 scene child 並釋放 GPU resource。
3. 樣式依 T0 決議：預設 neutral wireframe + 40% opacity，無動畫、無 hit flash；正式 target 維持 solid red，形成填法 + 顏色冗餘區分。
4. box/sphere 都有測試；同 shape 重 configure 不重建 resource，換 shape 才 dispose 舊 geometry。
5. 測 `configure(null)`、重複 hide/show、dispose 後 scene child 計數與 material/geometry dispose spy。
6. 跑一次真 WebGPU smoke，記錄首次顯示是否新增 compile hitch；若透明管線不穩，採 README FM-71.8 fallback 並入 Decision Log。

## Definition of Done

- [ ] component tests 覆蓋 configure/visibility/shape/dispose，scene child 不洩漏。
- [ ] rAF 可重複呼叫 `setVisible()`，allocation spy／heap counter 證明零新物件。
- [ ] cue 與正式 target 不只靠顏色區分；無動畫、無 DOM、無網路字體。
- [ ] WebGPU smoke 的 draw call、mesh、首次顯示 frame 數值已記入 `progress.md`。
- [ ] `npm run typecheck`、`npx vitest run src/render/OpeningTargetCueView.test.ts` exit 0。

## Commit

```text
feat(wp-71): render a distinct opening target cue
```
