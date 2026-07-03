# T0 — Entry gate(OQ-S2-3 拍板)

> Part of [WP-12 input-seams](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Docs-only。NO production code。**

| | |
|---|---|
| **相依** | 無(GD-5 若尚未落地——wp-10 T0 負責——本 task 可先行,僅需此一問拍板) |
| **Risk / Cplx** | Low / Low |
| **Touches** | 本資料夾 docs、`../../../DECISIONS.md`(GD-5 補充一行) |
| **狀態** | ⬜ |

## Objective

拍板感度語意斷代的標注方式(OQ-S2-3),使 T1 的 metadata 變更有明確契約;
並確認既有 meta 欄位鏈(collectMeta → export → schema.md)的插入點。

## In scope
- 向使用者/研究者確認 OQ-S2-3,計畫建議:**T1 先加 `sensitivityModel: 'cs2-0.022deg'`
  字串欄**(無此欄 = 階段 A 佔位語意 0.0022 rad/count),`schemaVersion` bump 留給
  WP-16 schema v2 一次做——避免兩次 schema 斷代。
- 盤點插入點(記入 progress):[metadata.ts](../../../../../src/data/metadata.ts) `collectMeta`
  簽名、[export.ts](../../../../../src/data/export.ts) payload、`docs/operational/schema.md` meta 節。

## Out of scope
- 任何 `src/` 變更;舊匯出資料的回溯轉換(明確不做,GD-5 記錄)。

## Steps

- [ ] OQ-S2-3 拍板,決議記 [progress.md](progress.md) ledger + 回填 [../README.md §8](../README.md)。
- [ ] 若 GD-5 已存在([DECISIONS.md](../../../DECISIONS.md)):補「標注方式」一行;
      若尚未(wp-10 T0 未跑):在本 WP ledger 記決議 + 標注「待 GD-5 落地時併入」。
- [ ] 插入點盤點三處(檔案:行號)記 progress。
- [ ] progress.md 記 entry-gate PASS 宣告。

## Definition of Done

- OQ-S2-3 ✅ 且有明確欄名/值域文字;插入點清單在 progress;
  `git diff --stat` 不含 `src/`。

## Commit

`docs(wp-12): T0 entry gate — 感度語意標注方式拍板(sensitivityModel 欄)`