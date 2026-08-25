# T3 — 結果呈現整合:ResultScreen diagnosis 區塊 + 個人歷史呈現

> Part of [WP-38 diagnosis-recommendation](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T2(`SessionHistoryResult` + T1 `DiagnosisResult`) |
| **Risk / Cplx** | Med(比照 WP-32 `research-promoted` 既有型式,設計風險低,組裝工作量中等) |
| **Touches** | MODIFY `src/ui/ResultScreen.ts`(新增 diagnosis 區塊)、`src/main.ts`(additive 參數);ADD `src/ui/HistoryView.ts`(若 T0 候選①落地) |
| **狀態** | ✅(2026-08-25;`npm.cmd run test:ci` exit 0 — TypeScript、Vitest 122 files / 935 tests、Playwright 21 tests) |

## Objective

交付 FR-F16:結果頁對每個診斷/歷史指標顯示來源指標/`n`/flags/版本;樣本不足或不相容時顯示「資料不足」而非進步/退步箭頭。

## In scope

1. `ResultScreen.ts` 新增封閉 `DIAGNOSIS_METRIC_IDS`(README §2④),比照 WP-32 `PROMOTED_METRIC_IDS`/`createPromotedSummary` 型式。
2. Diagnosis 卡片:primary/secondary 弱項標籤 + 對應 `nextTrainingDirection` + 每筆來源證據的 `metricId`/`value`/`n`/`flags` + `recommendationVersion`。
3. `status: 'insufficient-data'` 態顯示理由文字,不顯示任何標籤或建議。
4. 個人歷史區塊(若 T0 候選①,新增 `HistoryView.ts` 純 TS + DOM 視圖;若候選②,結果頁改為顯示「另見 Python 報告」的靜態連結說明,不在瀏覽器內即時渲染歷史)。
5. `main.ts` 由同一次 `buildCurrentExportPayload()`(比照 WP-32 D-32.9 統計=匯出同源接線)取得 diagnosis 輸入,不另建第二條資料來源。
6. E2E 斷言(比照 `tests/e2e/full-drill.spec.ts` 既有路徑):實機 drill 結束後 diagnosis 區塊有非 `insufficient-data` 內容(至少在合成 harness 資料充足時)。

## Out of scope

- 個人歷史聚合邏輯本身(T2 已完成,本 task 只呈現)。
- 任何新增指標推導。

## Steps

- [x] `ResultScreen.ts` 新增 diagnosis 區塊 + 封閉 metric id 測試(斷言 id 集合等於封閉清單,多一個即 fail,比照 WP-32 C-D3 紀律)。
- [x] `insufficient-data` 態 UI 測試。
- [x] 依 T0 候選落地歷史呈現(`HistoryView.ts` 或靜態連結說明)。
- [x] `main.ts` 接線 + 統計=匯出同源測試。
- [x] E2E 斷言擴充。
- [x] `npm run test:ci` 全綠。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | Diagnosis 卡片對每個晉升量顯示來源/`n`/flags/版本 | DOM 測試斷言 `data-metric-id` 集合 + 內容 |
| ② | `insufficient-data` 態不顯示標籤/箭頭 | UI 測試綠 |
| ③ | 統計 = 匯出同源(同一 `ExportPayload` 派生) | E2E 斷言綠 |
| ④ | 歷史呈現依 T0 候選正確落地 | 端到端測試或文件說明審查 |
| ⑤ | `npm run test:ci` 全綠 | CI 輸出貼 progress.md |

## Commit

`feat(wp-38): T3 — ResultScreen diagnosis 區塊 + 個人歷史呈現整合`
