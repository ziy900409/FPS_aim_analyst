# T0 — Entry gate(上游驗證 + schema 語意決議)

> Part of [WP-16 metrics-export-v2](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Docs-only。NO production code。**

| | |
|---|---|
| **相依** | WP-13 exit ✅(M6) |
| **Risk / Cplx** | Low / Low |
| **Touches** | 本資料夾 docs + [../README.md §8](../README.md)(OQ 回填) |
| **狀態** | ⬜ |

## Objective

擴欄之前先鎖三件事:v2 斷代政策(OQ-S2-3 收尾)、`targetCenterOffsetDeg` 語意
(稽核不確定清單 #4)、punch/spread 資料在 fire 時點的實際形狀(WP-13 產物)。

## In scope
- WP-13 `task-checklist.md` 全 ✅ 與 exit 證據連結記 progress。
- 資料形狀抽查:fire 時點可讀到的 `SharedState.recoil` / fireOneShot 暫存欄
  (punch、spread、recoilIndex、ammo)逐項確認,記 progress——T1 擴欄的輸入依據。
- **OQ-S2-3 收尾**:`sensitivityModel`(WP-12 已落)+ `schemaVersion` bump(T1)合併
  定稿為 v2 斷代政策;舊資料視為不同 model,不回溯轉換。記 ledger + 回填 [../README.md §8](../README.md)。
- **稽核不確定清單 #4**:`targetCenterOffsetDeg` 語意(相對誰的中心 / 正負號)查核定稿,
  記 ledger(T1 寫 schema.md 時一併寫清)。

## Out of scope
- 任何 `src/` 變更;欄位實作(T1)。

## Steps

- [ ] WP-13 exit 證據記 progress;`npm run test` 乾淨基準 exit 0。
- [ ] 資料形狀抽查(codegraph 或讀碼)四欄逐項記 progress。
- [ ] OQ-S2-3 斷代政策文字定稿記 ledger + §8 回填。
- [ ] `targetCenterOffsetDeg` 語意定稿記 ledger。
- [ ] progress.md 記 entry-gate PASS 宣告。

## Definition of Done

- progress 含:上游證據、四欄資料形狀抽查、兩條語意決議(明確文字,非「傾向」);
  `git diff --stat` 不含 `src/`。

## Commit

`docs(wp-16): T0 entry gate — WP-13 上游驗證 + schema v2 斷代/欄位語意決議`
