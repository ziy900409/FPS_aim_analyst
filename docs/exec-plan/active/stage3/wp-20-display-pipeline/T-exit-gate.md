# T-exit — Exit gate(顯示管線四件套交付)

> Part of [WP-20 display-pipeline](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1–T4 |
| **Risk / Cplx** | — / Low |
| **Touches** | docs(progress/checklist/上層索引) |
| **狀態** | ⬜ |

## Objective

宣告 WP-20 收斂:解析度模式/資格閘/frame log/setup 表單四件套齊備且互相接妥——
WP-22 T2 的受試者內解析度 protocol 自此有完整的顯示面可消費。

## Steps

- [ ] `npm run test:ci` exit 0。
- [ ] 四件套逐項證據記 progress:
  - 三解析度模式實機切換 + buffer 尺寸斷言(測試名)。
  - 資格閘拒入/放行 + DPI 矩陣(三檔結果)。
  - frames 區塊匯出 + 三模式實測分佈。
  - setup 表單 + 手動欄匯出。
- [ ] 斷言複查:準心置中/感度無像素項/sim 跨模式不變性(測試名 + 結果)。
- [ ] T2↔T3 對帳收斂:資格閘 warmup 改用 frameLog 來源(雙方 progress 互記)。
- [ ] OQ ledger 收斂:OQ-S3-1/S3-4/20.1/20.2 回填 [../README.md §8](../README.md)。
- [ ] [../README.md §3](../README.md) WP-20 翻 ✅;[task-checklist.md](task-checklist.md) 全 ✅。
- [ ] progress.md 寫 Outcomes(交付了什麼 / Surprises / 帶著走的決定)。

## Definition of Done

- `test:ci` exit 0;四件套證據可追;**WP-22 T2 可直接消費**(gate → 條件切換 →
  匯出含 display/frames 全鏈就緒)。

## Commit

`docs(wp-20): exit gate — 顯示管線四件套交付(模式/資格閘/frames/setup)`
