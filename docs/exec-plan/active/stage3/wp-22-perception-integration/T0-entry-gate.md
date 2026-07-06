# T0 — Entry gate(四上游 exit 驗證 + WP-18 交付形狀對帳)

> Part of [WP-22 perception-integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Docs-only。NO production code。**

| | |
|---|---|
| **相依** | WP-19 exit(M9)✅ + WP-20 exit ✅ + WP-21 exit ✅ + WP-18 exit ✅(stage2) |
| **Risk / Cplx** | Low / Low |
| **Touches** | 本資料夾 docs + [../README.md §8](../README.md)(OQ 回填) |
| **狀態** | ⬜ |

## Objective

整合之前先驗四條上游全綠,並把 WP-18 的實際交付形狀(追蹤 drill config 型、
presentation policy、目標 render 內插)與本 WP 的消費假設對帳——OQ-S3-5 的收斂點。

## In scope
- **四上游 exit 證據**:WP-19(M9 四證據)/ WP-20(四件套)/ WP-21(三證據)/
  WP-18(移動 drill + sub-tick 內插 + 追蹤指標)各 exit-gate progress 連結記 progress;
  `npm run test:ci` 乾淨基準 exit 0。
- **OQ-S3-5 對帳**:WP-18 交付的追蹤 drill config 形狀(motion 欄用法、presentation
  時長機制、`t_acquire`/TOT 結果頁欄位)逐項與本 WP T1 假設對照;差異記 ledger
  並修 T1 task 檔(plan 修正屬 docs,合規)。
- **OQ-22.1**:protocol 條件標記落點定稿(建議:`meta.protocol = { protocolId, conditionIndex,
  conditionLabel }`,v2 additive 區塊,比照 scene/display 模式)。
- **OQ-22.2**:pilot protocol 文件範圍定稿(行政欄是否進 app;建議:不進,文件層記錄)。
- 驗收清單 C 條目草稿(T3 定稿的骨架):逐項列出 + 判定方式(自動測試名/手動步驟)。

## Out of scope
- 任何 `src/` 變更;E2E 實作(T1/T2)。

## Steps

- [ ] 四上游 exit 證據連結 + `test:ci` 基準記 progress。
- [ ] OQ-S3-5 形狀對帳表(假設 vs 實際)記 ledger;必要時修 T1 檔。
- [ ] OQ-22.1 / OQ-22.2 決議記 ledger + §8 回填。
- [ ] 清單 C 條目草稿記 progress。
- [ ] progress.md 記 entry-gate PASS 宣告。

## Definition of Done

- progress 含四上游證據 + 對帳表 + 兩條 OQ 決議;清單 C 草稿存在;
  `git diff --stat` 不含 `src/`。

## Commit

`docs(wp-22): T0 entry gate — 四上游 exit 驗證 + WP-18 交付形狀對帳(OQ-S3-5 收斂)`
