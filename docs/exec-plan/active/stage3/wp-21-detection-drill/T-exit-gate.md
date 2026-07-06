# T-exit — Exit gate(偵測鏈交付)

> Part of [WP-21 detection-drill](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1–T3 |
| **Risk / Cplx** | — / Low |
| **Touches** | docs(progress/checklist/上層索引) |
| **狀態** | ⬜ |

## Objective

宣告 WP-21 收斂:seeded spawn 零破壞、偵測 drill 可跑、推導鏈 round-trip 可證——
WP-22 T2 的解析度 × 偵測 protocol 自此有完整的 drill 與分析介面可消費。

## Steps

- [ ] `npm run test:ci` exit 0。
- [ ] 三項證據記 progress:
  - 零破壞:既有決定性回歸零修改全綠(測試名 + 結果)。
  - 重現:同 seed spawn 序列 golden 鎖定(測試名)。
  - 推導:round-trip fixture 誤差 ≤ 1 tick(四組結果)。
- [ ] WP-19 對帳複查:淨空驗證涵蓋 spawnArea 極值(雙方 progress 互記)。
- [ ] OQ ledger 收斂:OQ-S3-2 / OQ-21.1 / OQ-21.2 回填 [../README.md §8](../README.md)。
- [ ] [../README.md §3](../README.md) WP-21 翻 ✅;[task-checklist.md](task-checklist.md) 全 ✅。
- [ ] progress.md 寫 Outcomes(交付了什麼 / Surprises / 帶著走的決定)。

## Definition of Done

- `test:ci` exit 0;三項證據可追;**WP-22 T2 可直接消費**(偵測 drill + meta.spawn +
  推導 spec 全就緒)。

## Commit

`docs(wp-21): exit gate — 偵測鏈交付(零破壞/seed 重現/推導 round-trip)`
