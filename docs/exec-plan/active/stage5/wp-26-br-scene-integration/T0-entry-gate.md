# T0 — Entry gate(上游三 WP 驗證 + OQ-S5-3 資產路線拍板)

> Part of [WP-26 br-scene-integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Docs-only。NO production code。**

| | |
|---|---|
| **相依** | 上游:WP-23(M11)/WP-24(exit)/WP-25(M12)——T1 僅需 OQ-S5-3,可提前;T2+ 開工前上游須全綠 |
| **Risk / Cplx** | Low / Low |
| **Touches** | 本資料夾 docs + [../README.md §8](../README.md)(OQ 回填) |
| **狀態** | ✅ PASS(2026-07-14) |

## Objective

整合動工前先鎖:上游三 WP 的交付形狀對帳(整合消費面清單)、資產路線、
br-field 的雜亂度定位與走廊幾何需求。

## In scope

- **上游對帳**(各 exit-gate 證據引用 + 消費面清單記 progress):
  - WP-23:hitbox/distance/motion 檔位表(T2 走廊幾何的輸入)+ OQ-23.2 移交項;
  - WP-24:ads 武器檔形狀 + 記錄欄(T3 條件宣告的輸入);
  - WP-25:`bullet` 武器檔形狀 + M12 門控狀態(**M12 未過 → T3 先落 hitscan-only,
    `bullet` 條件後補**,記 ledger)。
- **OQ-S5-3 拍板**:資產路線(預設程序化生成 CC0);寫實度目標與預算
  (三角形 < 20k、材質數上限)定稿。
- **OQ-26.1 拍板**:`clutterTier` 定位。
- **走廊幾何需求**:WP-23 遠距檔位 → br-field 視線走廊長度/寬度需求表
  (T1 地形設計的硬輸入)。
- **驗收清單 E 骨架**:條目草案(比照清單 C 十項式)列 progress,T4 定稿。

## Out of scope

- 任何 `src/`/資產變更(T1 起)。

## Steps

- [x] `npm run test:ci` 乾淨基準 exit 0 記 progress。
- [x] 上游三 WP exit 證據 + 消費面清單記 progress(M12 未過則記門控備案)。
- [x] OQ-S5-3 / OQ-26.1 決議記 ledger + 上層 §8 回填。
- [x] 走廊幾何需求表記 progress(供 T1)。
- [x] 驗收清單 E 條目草案記 progress。
- [x] progress.md 記 entry-gate PASS 宣告。

## Definition of Done

- progress 含:上游對帳(證據連結)、兩條 OQ 決議、走廊需求表(具體數字)、
  清單 E 草案;`git diff --stat` 不含 `src/`。

## Commit

`docs(wp-26): T0 entry gate — 上游對帳 + br-field 資產路線/走廊需求拍板`
