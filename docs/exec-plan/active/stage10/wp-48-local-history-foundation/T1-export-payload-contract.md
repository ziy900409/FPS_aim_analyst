# WP-48 T1 — ExportPayload Runtime Contract

## Objective

建立唯一的 `unknown → ExportPayload` strict runtime parser 與 canonical serializer，供 browser loader、Node repository 與後續 WP 共用；移除 `sessionHistoryLoader.ts` 的 shallow second definition。

## Planned files

```text
src/data/exportPayloadSchema.ts       NEW
src/data/exportPayloadSchema.test.ts  NEW
src/data/sessionHistoryLoader.ts      MODIFY
src/data/sessionHistoryLoader.test.ts MODIFY
src/history/contracts.ts              NEW（pure DTO only）
research/fixtures/exports/*.json      READ-ONLY test inputs
```

實作前對 `sessionHistoryLoader`、`ExportPayload`、`Meta`、`TickRecord`、`DrillEvent` 執行 CodeGraph impact；若 schema source 已被其他 WP 修改，先更新本 task。

## Interface to implement

```ts
export type ExportPayloadParseResult =
  | { readonly ok: true; readonly payload: ExportPayload }
  | { readonly ok: false; readonly errors: readonly ExportPayloadParseError[] };

export function parseExportPayload(value: unknown): ExportPayloadParseResult;
export function canonicalExportJSON(payload: ExportPayload): string;
```

完整 error/type 契約見 [README.md](README.md) §2.4。

## Steps

1. 先寫 table-driven failing tests：非 object、schema 不支援、meta identity 缺失、invalid startedAt、tick/event discriminant、NaN/Infinity、wrong array shape、unknown required enum。
2. 實作 pure parser：無 DOM、無 Node、無 wall-clock、無 mutation input。
3. parser 成功結果依固定 property order 重建；canonical serializer 對同語意不同 key order 產生相同 bytes/hash input。
4. 所有 8 份現有 research export fixtures與合法 Practice payload 必須 parse 成功；另用現有 synthetic/golden payload tests 覆蓋 event variants。Assessment-only 是 repository policy，不可讓 parser 把 Practice 當 invalid schema。
5. `sessionHistoryLoader.ts` 改用共用 parser；刪除 private `isExportPayload()`／重複 parse logic。
6. 新增 `src/history/contracts.ts` 的 DTO/type-only contract；禁止 import Node 或 UI。
7. 跑 targeted Vitest、`npx tsc --noEmit`，再跑全 Vitest。

## Failure modes

- Parser 只驗 identity、未驗 ticks/events → corrupt file 延遲到 metrics/replay 才 crash。
- Parser 過度嚴格拒絕合法 additive optional metadata → 現有 fixture 回歸。
- Canonical serializer 重新排序 arrays → tick/event 時序被破壞。
- `sessionHistoryLoader` 保留另一套 guard → schema 漂移。

## Definition of Done

- [ ] README §2.4 parser signatures 逐位成立；error 含 field path + stable code，不含 absolute path。
- [ ] 8/8 現有 export fixtures parse 成功；每個 `DrillEvent` variant 至少一正向測試。
- [ ] negative matrix 至少涵蓋 12 類 invalid input；另有正向測試證明合法 Practice 可 parse，且 parser 不執行 history archival policy。
- [ ] canonical tests 證明 object key order/whitespace 不影響 canonical content，array order 保持。
- [ ] `rg "function isExportPayload" src` 不再找到 shallow second definition。
- [ ] `sessionHistoryLoader` 既有 Assessment filtering tests 全綠。
- [ ] `npx tsc --noEmit` 與全 Vitest exit 0；progress 記錄 test counts。

## Commit

```text
feat(history): add strict export payload runtime contract
```
