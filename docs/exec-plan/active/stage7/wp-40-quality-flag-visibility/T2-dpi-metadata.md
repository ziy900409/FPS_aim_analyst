# T2 — `metadata.ts` additive `dpi`(FR-G2)

> Part of [WP-40 quality-flag-visibility](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(可與 T1 並行,檔案熱區不重疊) |
| **Risk / Cplx** | Low(additive optional 欄位 + 一個表單輸入) |
| **Touches** | `src/data/metadata.ts`(MODIFY,additive)、`src/data/metadata.test.ts`(ADD)、`src/ui/SessionSetup.ts`(MODIFY,additive)、`src/ui/SessionSetup.test.ts`(ADD)、`src/main.ts`(MODIFY,`collectMeta()` 呼叫點) |
| **狀態** | ⬜ 待執行 |

## Objective

`Meta`/`CollectMetaArgs` additive 新增 `dpi?: number`(與既有 `sensitivity`/`fovDeg`/`displayHz` 同一頂層區塊);`SessionSetupValues` additive 新增 `dpi?: number` 並在 `createSessionSetupForm()` 補一個數字輸入欄位(比照既有 `panelInches`/`viewingDistanceCm` 型式);`main.ts` 的 `buildCurrentExportPayload()` 在呼叫 `collectMeta()` 時併入 `sessionSetupValues?.dpi`。

## In scope

1. `src/data/metadata.ts`:
   - `Meta.dpi?: number`(緊鄰 `sensitivity`/`fovDeg` 附近,文件排版上同一區塊)。
   - `CollectMetaArgs.dpi?: number`。
   - `collectMeta()` 內:若提供則以 `requirePositiveFiniteNumber(args.dpi, 'dpi')` 驗證,寫入回傳物件;未提供則整個欄位不存在(不得寫 `undefined` 的顯式鍵,比照既有 `fovDeg` optional 型式)。
2. `src/ui/SessionSetup.ts`:
   - `SessionSetupValues.dpi?: number`。
   - `createSessionSetupForm()` 表單新增一個數字輸入欄位(比照 `makeNumberField()` 既有型式),邊界常數 `DPI_MIN`/`DPI_MAX`(T0 §2④ 拍板方向,初判 100–32000)。
   - `readValues()` 解析邏輯 additive 補上 `dpi` 欄位(選填,留空不擋 submit)。
3. `src/main.ts`:
   - `buildCurrentExportPayload()` 的 `collectMeta({...})` 呼叫補上 `dpi: sessionSetupValues?.dpi`(`sessionSetupValues` 為 `undefined` 時不傳)。

## Out of scope

- `ResultScreen.ts`/quality-flag 卡片(T1)。
- `dpi` 進入任何 `src/metrics/*` 計算(README §3 明文禁止)。

## Steps

- [ ] `metadata.ts`:新增 `dpi?: number` 於 `Meta`/`CollectMetaArgs`;`collectMeta()` 補驗證與寫入邏輯。
- [ ] `metadata.test.ts`:新增測試——提供 `dpi` 時正確驗證與寫入;不提供時 `Meta` 不含該鍵;提供非正數/非 finite 值時拋錯(比照既有 `sensitivity` 驗證測試型式)。
- [ ] `SessionSetup.ts`:新增 `dpi` 表單欄位(`makeNumberField()`)+ `readValues()` 解析。
- [ ] `SessionSetup.test.ts`:新增測試——填 `dpi` 正確產出 `SessionSetupValues.dpi`;留空時該欄位不存在於回傳值;超出 `DPI_MIN`/`DPI_MAX` 邊界時的既有驗證行為(比照 `panelInches` 既有測試型式)。
- [ ] `main.ts`:`collectMeta()` 呼叫點補 `dpi` 引數。
- [ ] 既有匯出/相容性回歸測試(WP-33/38 既有 fixture)零修改,確認 `npm run test:ci` 全綠。
- [ ] `rg "\.dpi\b" src/metrics` 確認零命中(README §3 失效模式)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | `Meta.dpi`/`CollectMetaArgs.dpi` additive,未提供時欄位不存在 | 單元測試覆蓋 |
| ② | `SessionSetupValues.dpi` 表單接線,留空不擋 submit | 單元測試覆蓋 |
| ③ | `main.ts` `collectMeta()` 正確接線 `sessionSetupValues?.dpi` | 手動核對 + e2e 不迴歸 |
| ④ | `dpi` 未流入 `src/metrics/*` | `rg "\.dpi\b" src/metrics` 零命中 |
| ⑤ | 既有匯出/相容性 fixture 零修改全綠 | `npm run test:ci` exit 0 |

## Commit

`feat(wp-40): T2 — metadata dpi additive field(FR-G2)`
