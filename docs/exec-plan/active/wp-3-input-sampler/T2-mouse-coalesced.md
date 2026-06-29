# T2 — 滑鼠 coalesced 採集（次幀軌跡）

> Part of [WP-3 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T0 |
| **Risk / Complexity** | Med / Med |
| **Touches** | MODIFY `src/input/InputSampler.ts`（滑鼠部分） |
| **Status** | ⬜ TODO |

## Objective
以 `pointermove` 的 `getCoalescedEvents()` 抓回次幀樣本，1000 Hz 滑鼠下不遺失中間軌跡，每樣本帶 `timeStamp` 入緩衝（FR-3.2，ADR-5 / 附錄 B）。

## In scope
- `pointermove` handler：`(e.getCoalescedEvents?.() ?? [e])` 逐一 `{type:'mouse', dx:ev.movementX, dy:ev.movementY, t:ev.timeStamp}` 入緩衝。
- 與 WP-1 視角共存：WP-1 即時用 movement 驅動 camera；本 task 把 coalesced 樣本入緩衝供量測（兩者獨立）。

## Out of scope
- 視角套用（WP-1 已負責）；消費（→ T4）。

## Design notes
- 每個 coalesced event 各自一筆（保留次幀解析度）。
- `movementX/Y` 在 Pointer Lock + `unadjustedMovement` 下為原始位移（WP-1 T3）。

## Steps
- [ ] `pointermove` handler 加 coalesced 展開入緩衝。
- [ ] Vitest：mock 一個帶多個 coalesced 子事件的 pointermove → 緩衝含全部樣本、時間戳遞增、無遺漏。
- [ ] 手動驗：快速移動滑鼠時緩衝樣本數 > pointermove 事件數（證明次幀採樣生效）。
- [ ] `vitest run` + `tsc` 綠燈。

## Definition of Done
- [ ] coalesced 樣本全數入緩衝、各帶 `timeStamp`；高頻移動不遺失。

## Commit
`feat(wp-3): 滑鼠 pointermove + getCoalescedEvents 次幀採樣（FR-3.2）`
