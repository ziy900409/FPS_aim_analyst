# T1 — Ring buffer 每 tick 記錄（無 GC 卡頓）

> Part of [WP-7 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T0 |
| **Risk / Complexity** | Med / High |
| **Touches** | NEW `src/data/RingBuffer.ts`、`src/data/DataRecorder.ts`；MODIFY `src/loop/SimLoop.ts` |
| **Status** | ✅ DONE（2026-07-02） |

## Objective
每 sim tick 記錄 velocity、準心、按鍵、開火到 **preallocated arena（非環狀）**，**物件重用、零每-tick 配置**，避免 GC 週期性卡頓污染量測（FR-7.1，規格 §6 / 附錄 F）。

## In scope
- recorder arena：預配置（typed array 或 slot 物件池），容量 OQ-7.1（= `maxDrillSeconds`×simHz + 餘裕），**drill 內不繞圈（非環狀）**，超量升 `recorderOverflow`（**不覆寫最舊**——匯出需整場）。
- `DataRecorder.recordTick(r)`：寫入重用 slot（不 new）。
- `SimLoop.simStep` 末呼叫 `recordTick`。

## Out of scope
- 事件記錄（→ T2）；匯出（→ T4）。

## Design notes
- 欄位 `{t,vx,vz,crosshair:[cx,cy],keys}`（附錄 C）。
- **無分配**：crosshair/keys 用重用結構（如固定長度 + 計數），匯出時才轉陣列。
- 容量估算：單場 drill ticks（endCondition 推算）+ 餘裕。

## Steps
- [x] 建 recorder arena（預配置 + 非環狀 + `recorderOverflow` 旗標）。
- [x] 建 `DataRecorder.recordTick`（重用 slot）。
- [x] sim tick 串入。
- [x] Vitest：寫滿觸發 `recorderOverflow`（**不覆寫**）、旗標設定；snapshot 順序正確。
- [x] **無 GC 佐證**：壓測長序列（如 1e5 ticks）記錄，觀察無週期性 GC spike（dev 量測，記 progress.md）。
- [x] `vitest run` + `tsc` 綠燈。

## Definition of Done
- [x] 每 tick 記錄正確、arena 非環狀 + `recorderOverflow` 旗標正確、無每-tick 配置（壓測佐證記 progress.md）。

## Commit
`feat(wp-7): DataRecorder ring buffer 每 tick 記錄（物件重用，無 GC）（FR-7.1）`
