# T3 — per-frame render-time log + frames 匯出 + 效能地板 suspect

> Part of [WP-20 display-pipeline](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1(display 語意就緒);與 T2 可並行 |
| **Risk / Cplx** | Med / Med |
| **Touches** | ADD `src/display/frameLog.ts`;MODIFY `src/loop/RenderLoop.ts`(每幀 push 一行)、`src/data/export.ts`(frames 區塊)、`src/data/metadata.ts`(摘要 + suspect)+ 測試 |
| **狀態** | ✅ 2026-07-08 |

## Objective

顯示鏈延遲差**外顯化**(FR-C8;GD-8/GD-10 效度防線):逐幀 rAF timestamp 進
preallocated log,隨匯出輸出完整序列 + 摘要;drill 中 p95 超效能地板 → `suspect`。
跨解析度條件的 frame time 差異自此可報告、可共變。

## In scope
- `frameLog.ts`:`createFrameLog(capacity)`([../README.md §2.3](../README.md));
  `Float64Array` + 游標,容量 = `maxDrillSeconds × MAX_DISPLAY_HZ`(OQ-20.1);
  滿 = 停記 + `frameLogOverflow` 旗標(**不繞圈**——完整序列語意,比照 arena)。
- `RenderLoop` 掛線:每幀 `push(now)`(一行;熱路徑零配置——測試斷言)。
- drill 邊界:drill start 重置游標、end 凍結;`summary()`(p50/p95/p99/超標窗數)
  進 meta;p95 > `PERF_FLOOR_MS` → drill 標 `suspect`(比照 `recorderOverflow` 語意)。
- `export.ts`:`frames` 區塊——JSON 完整 deltas 序列 + 摘要;CSV 只摘要(OQ-S3-4 決議)。
- 更新率估計來源統一:T1 的 `refreshEstimateHz` 改由 frameLog 中位數計算(單一來源)。

## Out of scope
- 資格閘 warmup 探測整合(T2 已留接口;本 task 落地後 T2 改用 frameLog 來源,
  雙方 progress 互記)、幀時間的分析端統計(離線)。

## Steps

- [x] `frameLog` 單元測試(容量/溢位/摘要正確性;合成 timestamps)。
- [x] `RenderLoop` 掛線 + 零配置斷言;drill 邊界重置/凍結測試。
- [x] `suspect` 門檻測試(合成超標序列)。
- [x] `export` frames 區塊 + schema 對帳(`docs/operational/schema.md` frames 節)。
- [x] 實機:一場 drill 的 frames 分佈(三解析度模式各一)記 progress——跨模式
  frame time 差異的首份實測。
- [x] `npx vitest run` 全綠。

## Definition of Done

- frames 區塊出現於 JSON 匯出且與 schema.md 一致;溢位/摘要/suspect 測試綠;
  熱路徑零配置斷言綠;三模式實測分佈記 progress。

## Commit

`feat(wp-20): T3 per-frame render-time log + frames 匯出 + 效能地板 suspect`
