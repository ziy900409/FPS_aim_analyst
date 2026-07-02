# T5 — 匯出資料 schema 文件

> Part of [WP-7 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T4 |
| **Risk / Complexity** | Low / Low |
| **Touches** | NEW `docs/operational/schema.md` |
| **Status** | ✅ DONE（2026-07-02） |

## Objective
撰寫匯出資料的 schema 文件，與實際匯出格式（型別 + 附錄 C）一致，供研究分析端解讀（FR-7.5）。

## In scope
- `docs/operational/schema.md`：`meta` / `ticks[]` / `events[]` 每欄位的型別、單位、來源、範例。
- 註明時間單位（ms，`performance.now()` 基準）、velocity 單位、backend 列舉值。

## Out of scope
- 指標定義（屬 §5 / WP-8）。

## Design notes
- schema.md 以匯出型別（`Meta`/`TickRecord`/`DrillEvent`）為單一真相，逐欄說明。
- 附一個真實匯出範例（對齊附錄 C JSONC）。

## Steps
- [x] 寫 `docs/operational/schema.md`：欄位表 + 單位 + 來源 + 範例。
- [x] 對照 T4 實際匯出，逐欄一致（無漏欄/型別不符）。
- [x] 連結到 README / 頂層索引。

## Definition of Done
- [x] schema.md 與實際匯出逐欄一致；含單位、來源、範例。

## Commit
`docs(wp-7): 匯出資料 schema.md（FR-7.5）`
