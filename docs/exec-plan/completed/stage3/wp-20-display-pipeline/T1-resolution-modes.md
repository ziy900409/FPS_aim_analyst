# T1 — 解析度模式(顯式 buffer + CSS upscale)+ display 自動 meta

> Part of [WP-20 display-pipeline](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(效能地板/落點決議) |
| **Risk / Cplx** | Med / Med |
| **Touches** | ADD `src/display/resolutionMode.ts`;MODIFY `src/main.ts`(resize 改走模式)、`src/ui/SettingsPanel.ts`(模式選擇)、`src/data/metadata.ts`(display 自動欄填值)+ 測試 |
| **狀態** | ✅ 2026-07-08 |

## Objective

解析度成為可控條件(FR-C6):`native`/`fhd-1080`/`qhd-1440` 三模式——固定模式下
render buffer 尺寸**顯式指定** + `setPixelRatio(1)` + CSS 全螢幕 upscale;`DisplayState`
進 `meta.display`。GD-10 實驗構念「同一面板上的 render 解析度效應」的機械基礎。

## In scope
- `resolutionMode.ts`:`applyResolutionMode(renderer, mode): DisplayState`
  ([../README.md §2.3](../README.md) 簽名)。固定模式:`renderer.setSize(w, h, false)`
  (updateStyle=false)+ canvas CSS `100%`;`native` 保留既有 `min(dpr, 2)` 路徑。
- `main.ts` resize() 重構:視窗 resize 時依當前模式重算(固定模式只更新 CSS/camera aspect,
  buffer 不動;`native` 照舊)。`SceneManager.resize` aspect 語意不變。
- SettingsPanel 模式選擇(非實驗 session 時可自由切換;實驗 session 由 protocol 鎖定
  ——鎖定機制 WP-22 T2,本 task 留 `lockMode()` 接口)。
- `meta.display` 自動欄填值:`DisplayState` + `screenW/screenH`(`screen.width/height × dpr`);
  更新率估計(rAF deltas 中位數,OQ-20.1 演算法)。
- **三條斷言**:DOM 準心置中不受模式影響(三模式實機截圖記 progress);感度角度制
  無像素項(單元斷言:模式切換不動 `RAD_PER_COUNT` 鏈);合成輸入下 sim 狀態序列
  跨模式逐位一致(單元級;E2E 版歸 WP-22 T3)。

## Out of scope
- fullscreen 流程/資格閘(T2)、frames log(T3)、對抗平衡(WP-22)。

## Steps

- [x] `resolutionMode.ts` + 單元測試(模式 → buffer/CSS/DisplayState 各欄)。
- [x] `main.ts` resize 重構 + SettingsPanel 掛線;三模式實機驗證(buffer 尺寸以
  `renderer.domElement.width/height` 斷言)記 progress。
- [x] meta.display 填值 + 匯出測試。
- [x] 三條斷言(準心/感度/sim 不變性)綠。
- [x] `npx vitest run` 全綠。

## Definition of Done

- 三模式實機可切換且 buffer 尺寸正確(證據記 progress);`meta.display` 全欄出現於匯出;
  三條斷言綠;`native` 模式行為與改動前逐位相容(既有測試零修改全綠)。

## Commit

`feat(wp-20): T1 解析度模式(顯式 buffer + CSS upscale)+ meta.display 自動欄`
