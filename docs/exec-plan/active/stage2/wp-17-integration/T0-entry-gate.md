# T0 — Entry gate(M7 + WP-16 雙上游驗證)

> Part of [WP-17 integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Docs-only。NO production code。**

| | |
|---|---|
| **相依** | WP-15 exit ✅(**M7**)、WP-16 exit ✅ |
| **Risk / Cplx** | Low / Low |
| **Touches** | 本資料夾 docs |
| **狀態** | ⬜ |

## Objective

M8 是 stage2 的交付宣告,不能建立在未收斂的上游上:驗證 M7(校準)與 WP-16
(schema v2)雙雙落地,並確認全鏈路 E2E 需要的入口都已存在。

## In scope
- 驗證 wp-15 / wp-16 的 `task-checklist.md` 全 ✅ 與 exit 證據
  (M7 兩層索引日期、v2 不變式測試名)連結記 progress。
- 入口存在性抽查(記 progress):`__fpsTest` debug API 的 drill 驅動 + 合成 fire 能力
  (缺 fire(n) 合成入口 → 記入 T2 的最小擴充範圍,不是 blocker)、
  v2 匯出欄位(schemaVersion/aimPunch/spread)可由 E2E 讀取。
- 上游 OQ 抽查:OQ-S2-1/2/3/6 皆已收斂(各 WP ledger ✅);未收斂者記 blocker。

## Out of scope
- 任何 `src/`、`tests/` 變更(T1/T2 的事);驗收清單 B 撰寫(T-exit)。

## Steps

- [ ] 兩份上游 checklist 全 ✅;exit 證據連結記 progress。
- [ ] `npm run test:ci` 當前全綠(exit 0)——整合前的乾淨基準。
- [ ] `__fpsTest` 入口抽查 + v2 欄位可讀性抽查,結果記 progress。
- [ ] 上游 OQ 收斂抽查(四項),記 progress。
- [ ] progress.md 記 entry-gate PASS 宣告。

## Definition of Done

- progress 含:雙上游 ✅ 證據、乾淨基準(test:ci exit 0)、入口抽查、OQ 收斂抽查;
  `git diff --stat` 不含 `src/`。
- 任一上游未綠 → **STOP**,記 blocker,不開 T1。

## Commit

`docs(wp-17): T0 entry gate — M7/WP-16 雙上游收斂驗證`
