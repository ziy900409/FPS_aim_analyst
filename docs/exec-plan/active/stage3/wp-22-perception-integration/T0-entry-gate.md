# T0 — Entry gate(四上游 exit 驗證 + WP-18 交付形狀對帳)

> Part of [WP-22 perception-integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Docs-only。NO production code。**

| | |
|---|---|
| **相依** | WP-19 exit(M9)✅ + WP-20 exit ✅ + WP-21 exit ✅ + WP-18 entry ✅ / exit ⬜(stage2 stub) |
| **Risk / Cplx** | Low / Low |
| **Touches** | 本資料夾 docs + [../README.md §8](../README.md)(OQ 回填) |
| **狀態** | 🟡 blocked(2026-07-09):WP-19/20/21 exit verified;WP-18 尚無 exit/交付形狀 |

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
- [ ] WP-18 exit 證據連結。Blocked:current main 只有 [WP-18 stub](../../stage2/wp-18-f5-subtick/README.md),無 task/progress/T-exit。
- [ ] OQ-S3-5 形狀對帳表(假設 vs 實際)記 ledger;必要時修 T1 檔。Blocked:WP-18 尚無實際交付形狀。
- [x] OQ-22.1 / OQ-22.2 決議記 ledger + §8 回填。
- [x] 清單 C 條目草稿記 progress。
- [ ] progress.md 記 entry-gate PASS 宣告。Blocked:progress 已記 T0 BLOCKED,不得宣告 PASS。

## Current Gate Result(2026-07-09)

**BLOCKED,not PASS**。WP-19(M9)、WP-20、WP-21 三條上游 exit 證據已驗證,且本次
`npm.cmd run test:ci` exit 0(`tsc` pass;Vitest 58 files / 438 tests;Playwright 11 tests)。
但 WP-18 目前仍是「entry 全達成、未展開、待排程」stub,沒有可對帳的追蹤 drill config 型、
presentation policy、target render interpolation 或 `t_acquire`/TOT/RMS ε 欄位。WP-18 exit
前不得展開 T1;WP-18 交付後重跑本 T0 的 OQ-S3-5 對帳。

## Definition of Done

- progress 含四上游證據 + 對帳表 + 兩條 OQ 決議;清單 C 草稿存在;
  `git diff --stat` 不含 `src/`。

## Commit

`docs(wp-22): T0 entry gate precheck — 上游 exit 證據 + WP-18 blocker`
