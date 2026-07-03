# T-exit — Exit gate(M5:數學核心鎖定)

> Part of [WP-10 recoil-core](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1–T4 |
| **Risk / Cplx** | — / Low |
| **Touches** | docs(progress/checklist/上層索引)+ `../../../../規格書_…md`、`../../../../../CONTEXT.md`(對帳) |
| **狀態** | ⬜ |

## Objective

宣告 **M5**:recoil 數學核心 golden 全綠、fixture 入 repo、文件對帳完成——
此後 WP-13 整合中的任何偏差都歸因於接線,不再歸因於公式。

## Steps

- [ ] `npx vitest run` 全綠(exit 0);`src/recoil/` 新增測試數 ≥ 12,記入 progress。
- [ ] Golden fixtures 齊備:`ak47-table.json`(64 筆)+ `ak47-10shot-punch.json`(逐 tick 快照)。
- [ ] 硬約束抽查:`Math.random` 於 `src/recoil/` grep = 0;`recoilTick` 呼叫點 dtSec 恆 1/64。
- [ ] T4 形狀 sanity 截圖已在 progress(AK 直升→之字)。
- [ ] 文件對帳(T0 遺留的大件):規格書升 **v1.2** §1.3 補「CS2 後座力系統」條目;
      [CONTEXT.md](../../../../../CONTEXT.md) 新術語(aimPunch / rawPunch×2 / recoil index /
      HybridDecay / cycletime / inaccuracy 三成分 / 理想壓槍路徑)。
- [ ] [../README.md §3](../README.md) WP-10 翻 ✅、M5 標日期;[exec-plan/README.md](../../../README.md) 同步。
- [ ] progress.md 寫 Outcomes(交付了什麼 / Surprises / 帶著走的決定)。

## Definition of Done

- `test:ci` 的 vitest 段 exit 0;兩份 golden fixture 在 repo;M5 於兩層索引標記 ✅ + 日期;
  規格書/CONTEXT 對帳 commit 可追(連結記入 progress)。
- **M5 未過(任一 golden 紅)不得開 WP-13**;WP-11/12/14 不受此門限制(見 [../README.md §5](../README.md))。

## Commit

`docs(wp-10): exit gate — 宣告 M5 數學核心鎖定 + 規格 v1.2/CONTEXT 術語對帳`