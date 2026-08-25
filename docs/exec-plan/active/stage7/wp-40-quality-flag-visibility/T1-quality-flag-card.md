# T1 — `ResultScreen` quality-flag 卡片(FR-G1)

> Part of [WP-40 quality-flag-visibility](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0 |
| **Risk / Cplx** | Low(additive 新函式/新參數,不修改既有渲染路徑) |
| **Touches** | `src/ui/ResultScreen.ts`(ADD)、`src/ui/ResultScreen.test.ts`(ADD)、`src/main.ts`(MODIFY,兩個 `show()` 呼叫點) |
| **狀態** | ⬜ 待執行 |

## Objective

新增封閉 `QUALITY_FLAG_IDS`(六個旗標卡片)+ 純函式 `createQualityFlagSummary()`(輸入 `QualityFlagsInput`,輸出 `overallSeverity` + 逐卡 `severity`)+ `ResultScreenHandle.show()` additive 第 4 參數 `qualityFlags?`;`main.ts` 兩個既有呼叫點(`main.ts:788` dev harness、`main.ts:1222` 正式流程)補上以 `payload.meta` 建構的引數。**不修改** WP-38 的 `DIAGNOSIS_METRIC_IDS`/`createDiagnosisSummary()`(README §0-1/§3)。

## In scope

1. `src/ui/ResultScreen.ts`:
   - `QUALITY_FLAG_IDS`(六個 id,見 README §5)+ `QualityFlagId` type。
   - `QualityFlagSeverity`(`'ok' | 'warn' | 'retest-recommended'`)。
   - `QualityFlagsInput` interface(`lateEventCount`/`bufferOverflow`/`recorderOverflow`/`suspect`/`validity?`)。
   - `createQualityFlagSummary(flags: QualityFlagsInput)`:純函式,依 README §2② 的兩層嚴重度表產出逐卡 `severity` + `overallSeverity`(六卡中最嚴重者;`retest-recommended` > `warn` > `ok`)。
   - 具名常數 `QUALITY_FLAG_WARN_COLOR = '#f5a623'`(註解指回 `tokens.css:29`)+ 渲染函式在卡片 `severity !== 'ok'` 時套用此色(邊框/文字,比照既有 `renderDiagnosisInsufficient` 的警示配色型式)。
   - `ResultScreenHandle.show()` 簽名 additive 加第 4 個 optional 參數 `qualityFlags?: QualityFlagsInput`;未提供時該區塊不渲染(不得顯示假的「全部 ok」)。
2. `src/main.ts`:
   - `main.ts:788`(dev test harness `showResult()`):從 `payload.meta` 組出 `QualityFlagsInput` 傳入第 4 參數。
   - `main.ts:1222`(正式流程):同樣從 `payload.meta` 組出並傳入。

## Out of scope

- `metadata.ts`/`SessionSetup.ts`/`dpi`(T2)。
- 任何 `DIAGNOSIS_METRIC_IDS`/`createDiagnosisSummary()` 修改。
- `tokens.css` 整份注入。

## Steps

- [ ] 新增 `QUALITY_FLAG_IDS`/`QualityFlagId`/`QualityFlagSeverity`/`QualityFlagsInput`/`QualityFlagCard` 型別。
- [ ] 實作 `createQualityFlagSummary()`,依 README §2② 表格分類六個旗標,回傳逐卡 severity + overallSeverity。
- [ ] 實作渲染函式(卡片 + 警示配色),additive 接入 `show()`/render 流程。
- [ ] `show()` 簽名補 additive 第 4 參數;確認既有呼叫端(未傳第 4 參數)行為不變(不渲染該區塊,不是渲染「假 ok」)。
- [ ] `main.ts` 兩處呼叫點補上引數。
- [ ] 單元測試(`ResultScreen.test.ts`):
  - 六個旗標各自觸發時對應正確卡片 id + severity。
  - 僅 `lateEventCount=1`(其餘 false)→ `overallSeverity` 為 `'warn'`,不是 `'retest-recommended'`(對應 §3 失效模式第二項)。
  - `suspect=true` 或 `recorderOverflow=true` → `overallSeverity` 為 `'retest-recommended'`。
  - 未提供 `qualityFlags` 時該區塊不渲染。
  - `git diff` 對 `DIAGNOSIS_METRIC_IDS`/`createDiagnosisSummary` 為空(人工核對 + 既有 WP-38 測試零修改全綠)。
- [ ] `npm run test:ci` 全綠。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 六個旗標各自觸發對應正確卡片與 `--warn` 配色 | 單元測試逐旗標覆蓋 |
| ② | 兩層嚴重度邏輯正確(warn vs retest-recommended) | 單元測試覆蓋 §3 失效模式案例 |
| ③ | `show()` 第 4 參數 additive,未提供時零渲染(非假 ok) | 單元測試覆蓋 |
| ④ | WP-38 既有符號/測試零修改 | `git diff` 核對 + 既有測試全綠 |
| ⑤ | `main.ts` 兩處呼叫點接線正確 | 手動核對 + e2e(`tests/e2e/full-drill.spec.ts`)不迴歸 |
| ⑥ | `npm run test:ci` exit 0 | CI 輸出貼 progress.md |

## Commit

`feat(wp-40): T1 — ResultScreen quality-flag card(FR-G1)`
