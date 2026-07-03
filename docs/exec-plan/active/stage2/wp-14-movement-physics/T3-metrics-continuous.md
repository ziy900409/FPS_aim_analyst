# T3 — 殘速/過衝指標連續化(結果頁呈現)

> Part of [WP-14 movement-physics](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **不等 WP-16**;與 [WP-16 T1](../wp-16-metrics-export-v2/T1-schema-v2.md) 的 schema 對帳點見 Design notes。

| | |
|---|---|
| **相依** | T2(residualSpeed 連續值已產出) |
| **Risk / Cplx** | Low / Low |
| **Touches** | MODIFY `src/metrics/compute.ts`、`src/ui/ResultScreen.ts` + 對應測試 |
| **狀態** | ⬜ |

## Objective

結果頁殘速/過衝從「分類呈現」升為連續 u/s(解除階段 A 的指標分層,規格 §5 註),
counter-strafe 品質自此可讀出程度而非只有級別。

## In scope
- `compute.ts`:殘速/過衝統計改吃連續 u/s(mean / p50 / 分布輸入);分類邏輯退場
  或降為由連續值衍生的標籤(取既有 UI 最小改)。
- `ResultScreen`:數值顯示 u/s(含單位字串);既有分類徽章改「數值 + 級別」並存或移除。

## Out of scope
- 匯出欄位/schema 變更(WP-16 T1);壓槍補償指標(WP-16 T2);
  HUD 即時顯示(現況 stopped 燈已涵蓋,T1 改寫語意後自動生效)。

## Design notes

- **schema 對帳點(WP-16 T1)**:本 task 只動計算/呈現。若 compute 需要 per-fire
  residualSpeed 新欄,先確認 DataRecorder 現有欄位是否足夠——不足時記 progress
  並留給 WP-16 T1 擴欄時對帳,**本 task 不動 recorder**。

## Steps

- [ ] compute 改連續輸入 + 單測更新(合成 fire 序列 → mean/p50 殘速解析對照)。
- [ ] ResultScreen 呈現改 u/s;DOM/快照測試更新。
- [ ] 規格 §5「指標分層解除」的對帳需求記 progress(規格書回寫排 T-exit)。
- [ ] `npx vitest run` 全綠。

## Definition of Done

- ResultScreen 顯示連續 u/s(測試斷言含單位字串);compute 單測解析對照綠;既有回歸綠。

## Commit

`feat(wp-14): T3 殘速/過衝指標連續化(結果頁 u/s 呈現)`
