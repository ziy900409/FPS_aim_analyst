# T-exit — Exit gate(M10:stage3 交付宣告)

> Part of [WP-22 perception-integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1–T3 |
| **Risk / Cplx** | — / Low |
| **Touches** | docs(progress/checklist/上層索引/exec-plan 索引) |
| **狀態** | ⬜ |

## Objective

宣告 M10 = stage3 交付:兩個感知實驗(追蹤 × 場景、解析度 × 偵測)可開 pilot,
所有防線(淨空/資格閘/決定性/清單 C)有可追證據。

## Steps

- [ ] `npm run test:ci` exit 0(最終基準)。
- [ ] 驗收清單 C 全項 ✅(結果矩陣連結;紅項 = 不得宣告)。
- [ ] 兩實驗「可施測」宣告:pilot protocol 文件 + 實機各走一輪的證據連結。
- [ ] OQ ledger 收斂:OQ-S3-5 / OQ-22.1 / OQ-22.2 回填 [../README.md §8](../README.md);
  stage3 全部 OQ(S3-1~5)狀態複查。
- [ ] [../README.md §3](../README.md) WP-22 翻 ✅ + §4 M10 記日期;
  [exec-plan/README.md](../../../README.md) §2/§3 stage3 交付狀態同步。
- [ ] 文件對帳複查([../README.md §9](../README.md)):CLAUDE.md 三條新約束已落
  (WP-19/20/21 T0)、規格書 v1.3 項狀態確認(未做則保留 ⬜ 並記 owner)。
- [ ] progress.md 寫 Outcomes(交付了什麼 / Surprises / 帶著走的決定)。
- [ ] 視需要把 stage3 資料夾移入 `completed/`(協議 §5)。

## Definition of Done

- `test:ci` exit 0;清單 C 全 ✅;兩實驗 pilot-ready(文件 + 實機證據);
  上層索引全部同步(stage3 README / exec-plan README)。

## Commit

`docs(wp-22): exit gate — M10 stage3 交付(驗收清單 C 全綠,兩感知實驗 pilot-ready)`
