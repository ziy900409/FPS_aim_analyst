# T-exit — Exit gate(顯示管線四件套交付)

> Part of [WP-20 display-pipeline](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1–T4 |
| **Risk / Cplx** | — / Low |
| **Touches** | docs(progress/checklist/上層索引) + `src/display/eligibilityGate.ts`(T2↔T3 warmup 來源收斂) |
| **狀態** | ✅ 2026-07-08 |

## Objective

宣告 WP-20 收斂:解析度模式/資格閘/frame log/setup 表單四件套齊備且互相接妥——
WP-22 T2 的受試者內解析度 protocol 自此有完整的顯示面可消費。

## Steps

- [x] `npm run test:ci` exit 0。→ typecheck 綠;vitest **55 files / 412 tests**;playwright **10/10**(Edge)。
- [x] 四件套逐項證據記 progress:
  - 三解析度模式實機切換 + buffer 尺寸斷言(`resolutionMode.test.ts` 3 tests + T1 Playwright 三模式 buffer/CSS 量測)。
  - 資格閘拒入/放行 + DPI 矩陣(`eligibilityGate.test.ts` 14 tests;100%/125%/150% → native 還原 PASS、FHD FAIL)。
  - frames 區塊匯出 + 三模式實測分佈(T3 Edge live export;native/fhd/qhd frames.summary 記 progress)。
  - setup 表單 + 手動欄匯出(`SessionSetup.test.ts` + `metadata`/`export` self-report/session)。
- [x] 斷言複查:準心置中/感度無像素項/sim 跨模式不變性(見下方 Outcomes「斷言複查」)。
- [x] T2↔T3 對帳收斂:資格閘 warmup **已改用 frameLog 來源**(`probeWarmupP95Ms` 走 frameLog nearest-rank,刪除重複 percentile);雙方 progress 互記。
- [x] OQ ledger 收斂:OQ-S3-1/S3-4/20.1/20.2 已回填 [../README.md §8](../README.md)(T0 收斂);OQ-20.3 實機 DPI 留 moderator(非阻塞)。
- [x] [../README.md §3](../README.md) WP-20 翻 ✅;[task-checklist.md](task-checklist.md) 全 ✅。
- [x] progress.md 寫 Outcomes(交付了什麼 / Surprises / 帶著走的決定)。

## Definition of Done

- `test:ci` exit 0;四件套證據可追;**WP-22 T2 可直接消費**(gate → 條件切換 →
  匯出含 display/frames 全鏈就緒)。

## Commit

`docs(wp-20): exit gate — 顯示管線四件套交付(模式/資格閘/frames/setup)`
