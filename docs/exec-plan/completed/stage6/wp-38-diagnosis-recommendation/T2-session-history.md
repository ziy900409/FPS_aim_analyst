# T2 — sessionHistory.ts:相容比較鍵複測判定 + 個人歷史聚合 + loader

> Part of [WP-38 diagnosis-recommendation](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1(`DiagnosisResult` 作為 `SessionSummary.diagnosis` 的輸入) |
| **Risk / Cplx** | **Med–High**(依 T0 OQ-S6-23 候選,個人歷史資料來源是全新能力,見 README §0-4/§2②) |
| **Touches** | ADD `src/metrics/sessionHistory.ts`;ADD `src/data/sessionHistoryLoader.ts`(或 Python 對應物,依 T0 候選);REUSE `src/metrics/compatibilityKey.ts`(`checkCompatibility`/`checkQualityGate`,只讀) |
| **狀態** | ✅(2026-08-25;`npm.cmd run test:ci` exit 0) |

## Objective

交付 FR-F15:以 WP-33 既有 `checkCompatibility()` 過濾歷史 session,聚合近期固定窗口的中位數與變異,能力與 speed–accuracy trade-off 並陳;並依 T0 拍板的候選落地資料載入機制。

## In scope

1. `sessionHistory.ts`:`SessionSummary`/`SessionHistoryResult` 型別 + `buildSessionHistory()` 純函式(README §5)。
2. 相容性過濾:對每筆歷史 `SessionSummary` 呼叫 `checkCompatibility(current.compatibilityKey, past.compatibilityKey)`,不相容者排除在 `eligible` 之外。
3. `n < minN` 短路為 `insufficient-data`(承 T1 的短路紀律,同一原則套用到歷史層)。
4. Assessment/Practice 守門:loader 層依 `Meta.assessment.mode`(或其等價欄位)排除 Practice 匯出,合成測試覆蓋「歷史清單混入一筆 Practice 匯出」案例。
5. 依 OQ-S6-23 拍板結果落地 `sessionHistoryLoader`:
   - 若候選①(TS):新增多檔載入介面(純 TS + DOM,D1),職責僅止於「檔案 → `ExportPayload[]` → `SessionSummary[]`」,不做聚合判斷。
   - 若候選②(Python):`research/` 新增目錄掃描工具,讀取同一 `participantId` 的多個匯出檔,產出與 TS `SessionSummary` 逐欄一致的中介格式(JSON),供 T3 呈現層消費。
6. speed–accuracy 代表指標對照表(OQ-S6-26):依測試家族分別定義 `speedMetric`/`accuracyMetric` 來源,寫入 `analysis-diagnosis.md`。

## Out of scope

- 結果頁呈現(T3)。
- 跨玩家聚合儀表板(stage6 out of scope)。

## Steps

- [x] `sessionHistory.ts` 型別 + `buildSessionHistory()` + 相容性過濾測試。
- [x] `n < minN` 短路測試。
- [x] Practice 守門測試(混入 Practice 匯出案例)。
- [x] 依 T0 候選落地 loader(TS 多檔上傳)。
- [x] OQ-S6-26 speed/accuracy 對照表定案,寫入 `analysis-diagnosis.md`。
- [x] `npm.cmd run test:ci` 全綠(TypeScript、Vitest 121 files / 930 tests、Playwright 21 tests)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 不相容 session 一律被排除,輸出不含箭頭/德爾塔符號欄位 | `sessionHistory.test.ts` 綠 + 型別審查 |
| ② | `n < minN` 短路為 `insufficient-data` | 短路測試綠 |
| ③ | Practice 匯出一律被 loader 排除 | 守門測試綠 |
| ④ | Loader 依 T0 候選落地並可產生 `SessionSummary[]` | 端到端合成測試綠 |
| ⑤ | `npm run test:ci`(+ 視候選另加 `uv run pytest`)全綠 | CI 輸出貼 progress.md |

## Commit

`feat(wp-38): T2 — sessionHistory.ts(相容比較鍵複測 + 個人歷史聚合 + loader)`
