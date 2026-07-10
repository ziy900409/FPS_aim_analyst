# T0 — Entry gate(四上游 exit 驗證 + WP-18 交付形狀對帳)

> Part of [WP-22 perception-integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Docs-only。NO production code。**

| | |
|---|---|
| **相依** | WP-19 exit(M9)✅ + WP-20 exit ✅ + WP-21 exit ✅ + WP-18 entry ✅ / **exit ✅(2026-07-09 交付)** |
| **Risk / Cplx** | Low / Low |
| **Touches** | 本資料夾 docs + [../README.md §8](../README.md)(OQ 回填) |
| **狀態** | ✅ PASS(2026-07-09):四上游 exit 全 verified;WP-18 交付形狀 OQ-S3-5 對帳完成 → WP-22 T1 blocked 解除 |

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

- [x] WP-19 / WP-20 / WP-21 exit 證據連結 + `test:ci` 基準記 progress。
- [x] WP-18 exit 證據連結:[WP-18 T-exit](../../stage2/wp-18-f5-subtick/T-exit-gate.md)✅ 2026-07-09(T0–T5 全綠、`test:ci` exit 0 = 62 files / 487 vitest + 11 playwright)。
- [x] OQ-S3-5 形狀對帳表(假設 vs 實際)記 ledger:六項交付形狀逐項對齊、無漂移(見下方 Log 2026-07-09 對帳表);T1 假設無需修正。
- [x] OQ-22.1 / OQ-22.2 決議記 ledger + §8 回填。
- [x] 清單 C 條目草稿記 progress。
- [x] progress.md 記 entry-gate PASS 宣告(2026-07-09;四上游 exit + WP-18 對帳)。

## Current Gate Result(2026-07-09,updated)

**PASS**。四條上游 exit 證據皆已驗證(WP-19/M9、WP-20、WP-21 + **WP-18 T-exit 2026-07-09 交付**),
且 WP-18 交付形狀 OQ-S3-5 逐項對帳完成(追蹤 drill config 型、timed presentation policy、target
render alpha 內插、`t_acquire`/TOT%/RMS ε 離線推導 spec + `SpawnMeta.presentationMs` 匯出欄——
與本 WP T1 消費假設一致,無漂移)。`npm run test:ci` exit 0(WP-18 交付時 62 files / 487 vitest +
11 playwright)。**WP-22 T1 blocked 解除,可開跑。**

> 原始 BLOCKED 判定(2026-07-09 上午,WP-18 尚為 stub)保留於下方 progress Log 供稽核。

## Definition of Done

- progress 含四上游證據 + 對帳表 + 兩條 OQ 決議;清單 C 草稿存在;
  `git diff --stat` 不含 `src/`。

## Commit

`docs(wp-22): T0 entry gate precheck — 上游 exit 證據 + WP-18 blocker`
