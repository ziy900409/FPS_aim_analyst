# T-exit — Exit gate(M10:stage3 交付宣告)

> Part of [WP-22 perception-integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1–T3 |
| **Risk / Cplx** | — / Low |
| **Touches** | docs(progress/checklist/上層索引/exec-plan 索引) |
| **狀態** | ✅ PASS(2026-07-10;M10 stage3 交付宣告;auto-gate 全綠 + 真 fullscreen 實機 walkthrough 證據) |

## Objective

宣告 M10 = stage3 交付:兩個感知實驗(追蹤 × 場景、解析度 × 偵測)可開 pilot,
所有防線(淨空/資格閘/決定性/清單 C)有可追證據。

## Steps

- [x] `npm run test:ci` exit 0(最終基準)。→ 2026-07-10 exit 0:`tsc` clean + Vitest 65 files / 505 tests + Playwright 14 tests(見 [progress.md](progress.md))。
- [x] 驗收清單 C **全 10 項** ✅([acceptance-checklist-c.md](../../../../operational/acceptance-checklist-c.md);C-1~C-4、C-6~C-10 有測試入口;C-5 = auto E2E + 真 fullscreen 實機證據)。
- [x] 兩實驗「可施測」宣告:pilot protocol 文件 ✅([pilot-protocol-stage3.md](../../../../operational/pilot-protocol-stage3.md))+ **實機 walkthrough 證據 ✅**(三份 `resolution_detection_v1` 匯出,見 [progress.md](progress.md) 2026-07-10 T-exit 證據表)。
- [x] OQ ledger 收斂:OQ-22.1 / OQ-22.2 ✅([progress.md](progress.md) ledger);OQ-S3-5 ✅ 回填 [../README.md §8](../README.md);stage3 OQ-S3-1~4 先前皆 ✅。
- [x] [../README.md §3](../README.md) WP-22 → ✅ + §4 M10 記日期(2026-07-10);[exec-plan/README.md](../../../README.md) §2/§3 stage3 交付狀態同步(含 WP-20/21 staleness 校正)。
- [x] 文件對帳複查([../README.md §9](../README.md)):CLAUDE.md 三條新約束已落(WP-19/20/21 T0);規格書 v1.3 項狀態確認(⬜ 保留,owner 待指派)。
- [x] progress.md 寫 Outcomes(交付了什麼 / Surprises / 帶著走的決定)。
- [ ] 視需要把 stage3 資料夾移入 `completed/`(協議 §5)——**保留**;wp-19/20/21/22 全數交付後另立 housekeeping slice 一次移,避免大量相對連結變動混入 M10 commit。

## Definition of Done

- `test:ci` exit 0 ✅;清單 C 全 10 項 ✅(含 C-5 真 fullscreen 實機證據);兩實驗 pilot-ready(文件 ✅ + 實機證據 ✅);
  上層索引 stage3 交付狀態同步 ✅。**M10 已宣告(2026-07-10);WP-22 ✅。**

## Commit

`docs(wp-22): exit gate — M10 stage3 交付(驗收清單 C 全綠,兩感知實驗 pilot-ready)`
