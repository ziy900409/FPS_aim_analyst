# WP-58 T5 — Metadata 稽核欄位、逐輪匯出與 cohort 隔離

## Objective

以 additive optional 欄位把「實際執行的 program」寫入匯出 metadata，保證每一輪 rep 產生唯一且可定位的匯出，並把 `custom` session 隔離於 frozen protocol 的 history/trend cohort 之外（FR-58.14～58.16、OQ-58.2／58.4）。

## Steps

1. 於 `src/data/metadata.ts` 新增 optional 欄位：`sessionPlanMode`、`sessionPlanItems`、`sessionPlanDrillRestSeconds`、`sessionPlanItemIndex`、`sessionPlanRepIndex`。
2. 實作 strict validation：`sessionPlanMode` 限兩個字面值；`sessionPlanItems[].drillId` 對 `FAMILY_BY_DRILL_ID` 驗證（**沿用 T1 的同一來源**，不新增清單）；`reps`／索引為非負整數。
3. `sessionPlanFamilyOrder` 在 custom 模式下由 items 推導後寫入（去連續重複），既有欄位語意不變。
4. `main.ts` 匯出注入點改帶 `itemIndex` / `repIndex`（來自 `phase.step`）。
5. 依 OQ-58.2 決議處理檔名唯一性：若 `exportBasename` 不足以區分三輪，於 basename 追加 rep 序號；**不改 payload 內容**。
6. 依 OQ-58.4 決議實作 cohort 隔離：`sessionPlanMode === 'custom'` 的 run 不進 frozen trend cohort；判定為 metadata 驅動的顯式規則，不得從 drill id 猜測。
7. 撰寫正負向 validation 矩陣測試（合法組合、未登記 drillId、reps=0／負數／小數、mode 非法字面值、索引越界）。
8. 跑既有 golden／canonical fixture 的 parse／serialize 回歸，證明逐位不變（NFR-58.6）。
9. 驗證 `research/` ingest 對新欄位相容（additive optional，不需改 Python 側；若需改則停下並入帳，屬 C-D1 邊界）。

## Invariants

- 全部新欄位 optional；缺席對舊 payload 合法。
- family allowlist 仍只有一份（T1 的 `drillFamily.ts`）。
- 不新增、不修改任何既有欄位的語意。
- `custom` 隔離為 metadata 驅動的顯式規則，符合 GD-20 教練報告紅線（C-D3）。

## Definition of Done

- [ ] 既有 golden／canonical fixture 的 parse／serialize 結果逐位不變。
- [ ] 新欄位 strict validation 正負向矩陣全綠。
- [ ] 三輪同一 drill 的匯出檔名唯一，且每份可定位到 `itemIndex`／`repIndex`（有測試）。
- [ ] `custom` session 不進 frozen trend cohort 有測試；frozen session 行為不變有測試。
- [ ] `research/` ingest 相容性有證據（或已入帳的偏差）。
- [ ] progress 記錄 schema diff、測試數與相容性證據。

## Commit

```text
feat(data): record executed session program in export metadata
```
