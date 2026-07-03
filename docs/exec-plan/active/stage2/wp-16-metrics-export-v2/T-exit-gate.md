# T-exit — Exit gate(schema v2 + 壓槍指標交付)

> Part of [WP-16 metrics-export-v2](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1–T3 |
| **Risk / Cplx** | — / Low |
| **Touches** | docs(progress/checklist/上層索引) |
| **狀態** | ⬜ |

## Objective

宣告 WP-16 收斂:v2 匯出對帳一致、不變式與溢位保護全綠、壓槍指標可呈現——
WP-17 全鏈路 E2E 自此有穩定的資料面可消費。

## Steps

- [ ] `npm run test:ci` exit 0。
- [ ] 不變式抽查:統計=匯出、schema.md=payload(兩個 assert 測試名與結果記 progress)。
- [ ] 溢位保護確認:滿載 drill 測試綠(容量公式與測得餘裕記 progress)。
- [ ] 與 WP-14 T3 對帳點收斂:殘速連續欄落位確認,雙方 progress 互記連結。
- [ ] OQ ledger 收斂:OQ-S2-3 / `targetCenterOffsetDeg` 決議回填 [../README.md §8](../README.md)。
- [ ] [../README.md §3](../README.md) WP-16 翻 ✅;[task-checklist.md](task-checklist.md) 全 ✅。
- [ ] progress.md 寫 Outcomes(交付了什麼 / Surprises / 帶著走的決定)。

## Definition of Done

- `test:ci` exit 0;v2 對帳證據可追(assert 測試 + schema.md);
  **WP-17 T2 可直接消費 v2 匯出**(欄位齊、不變式綠)。

## Commit

`docs(wp-16): exit gate — schema v2 + 壓槍指標交付(不變式/溢位/對帳全綠)`
