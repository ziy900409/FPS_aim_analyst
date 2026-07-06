# WP-12 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: 🟡 進行中(T0 ✅ 2026-07-06)

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ 2026-07-06 |
| T1 感度 CS2 化 | ⬜ |
| T2 射線注入 | ⬜ |
| T-exit | ⬜ |

---

## Open Questions ledger(T0 解決)

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S2-3 感度語意斷代標注:`sensitivityModel` 欄 vs `schemaVersion` bump(建議:先加前者,後者 WP-16 一併) | ✅ closed | T1 先加 `sensitivityModel: 'cs2-0.022deg'` 字串欄;舊匯出無此欄即代表階段 A 佔位語意 `0.0022 rad/count`;`schemaVersion` bump 留給 WP-16 schema v2,避免 WP-12 與 WP-16 兩次 schema 斷代;舊資料不回溯轉換。 |

---

## Log

### 2026-07-06 10:09+02:00 — T0 entry gate PASS
- OQ-S2-3 拍板:`sensitivityModel` 欄名固定,值域先固定為 `'cs2-0.022deg'`;無此欄 = 階段 A 佔位感度模型(`0.0022 rad/count`)。`schemaVersion` bump 延到 WP-16 schema v2 一次處理。
- GD-5 已存在([../../../DECISIONS.md](../../../DECISIONS.md));本 slice 已補標注方式一行。舊匯出資料不做回溯轉換,以欄位缺席區隔。
- T1 插入點盤點:
  - [metadata.ts](../../../../../src/data/metadata.ts):`Meta` 介面第 7/13 行加欄;`CollectMetaArgs` 第 25 行可不加參數,由 `collectMeta` 固定寫入;`collectMeta` 第 46/64 行回傳 `sensitivityModel`。
  - [export.ts](../../../../../src/data/export.ts):`ExportPayload.meta` 第 5/6 行透過 `Meta` 型別承接;`buildExportPayload` 第 20/24 行 spread meta,欄位會自動保留。
  - [schema.md](../../../../../docs/operational/schema.md):`meta` 節第 50 行;`sensitivity` 列第 59 行後新增 `sensitivityModel` 欄位說明與缺席語意。
- CodeGraph blast radius for future T1 `collectMeta`:`src/data/metadata.ts`, `src/main.ts` `buildCurrentExportPayload`, `src/testharness/fpsTestHarness.ts` `createFpsTestHarness`, `src/data/export.ts`, `src/data/export.test.ts`;判定為資料匯出局部路徑,非 gameplay cross-module 行為改動。
- Verification:docs-only;`src/` 未修改。

### 2026-07-03 — Plan authored
- 由 stage2 計畫([../README.md](../README.md))展開;修補稽核 A4(感度佔位 0.0022 rad/count ≈ 5.73× CS2)與 A3(`setFromCamera` 寫死)。
- 兩 task 互不相依,T2 可先行;T1 需 T0 的標注方式決議。
- **Next**:T1([T1-cs2-sensitivity.md](T1-cs2-sensitivity.md))。
