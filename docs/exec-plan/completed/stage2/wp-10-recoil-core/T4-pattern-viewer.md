# T4 — 2D 彈道檢查頁(dev-only)

> Part of [WP-10 recoil-core](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> 對應[研究計畫 Phase 3](../../../completed/stage2/CS2%20壓槍軌跡復刻研究計畫.md) 的單檔驗證工具(縮
> 減版:先驗「理論彈道圖」;Pointer Lock 練習模式與補償對照移 WP-16 結果頁)。

| | |
|---|---|
| **相依** | T2(punch)、T3(spread) |
| **Risk / Cplx** | Low / Low |
| **Touches** | NEW `src/recoil/patternViewer.ts`;MODIFY `src/main.ts`(dev-only 掛載,+3 行) |
| **狀態** | ✅ 完成(2026-07-05) |

## Objective

提供人工視覺驗證面:2D canvas 畫出理論彈道(逐發 `−aimPunch×2` 累積點 + 擴散雲),
讓 T1/T2 的 golden 之外有「形狀」層級的 sanity(AK 直升 9 發 → 左右之字)。

## In scope
- `patternViewer.ts`:給定武器參數(AK inline 預設)→ 跑 T1/T2/T3 純函式模擬 30 發
  → canvas 繪逐發彈著點(pitch/yaw 平面,Source 慣例 y 軸向下為正)+ 每發擴散半徑圈。
- 參數輸入:seed / magnitude / variance / angleVariance / cycletime(DOM 欄位,改值即重畫)。
- 掛載:`import.meta.env.DEV` 閘門 + 動態 import(比照 `__fpsTest` 模式,
  [src/main.ts:228](../../../../../src/main.ts) 附近);URL hash `#pattern` 才顯示。

## Out of scope
- Three.js 場景/相機(WP-13);Pointer Lock 練習模式;截圖比對自動化(人工目視即可)。

## Design notes

- 只消費 T1–T3 公開 API,**不**另寫模擬邏輯——檢查頁跑的就是之後進 sim 的同一套函式。
- 純 TS + DOM/canvas(D1);production build 因動態 import + DEV 閘門剝除。

## Steps

- [x] `patternViewer.ts`:模擬 30 發(0.1s 間隔、tick 1/64)→ 繪點/圈/連線 + 發數標記。
- [x] 參數面板(seed 等 5 欄)+ 重畫;預設 AK(seed 223)。
- [x] `main.ts` dev-only 掛載(hash `#pattern`)。
- [x] 人工驗證並截圖存 `progress.md` 證據:AK 形狀 = 直升 ~9 發後左右之字;M4 參數(38965)形狀不同。
- [x] `npm run build` 後 `dist/` grep `patternViewer` = 0(剝除證明);`vitest run` 不受影響。

## Definition of Done

- dev server `#pattern` 可視、參數即改即重畫;AK 形狀 sanity 通過並留截圖;production bundle 無此模組。

## Commit

`feat(wp-10): T4 dev-only 2D 彈道檢查頁(理論 pattern 形狀 sanity)`
