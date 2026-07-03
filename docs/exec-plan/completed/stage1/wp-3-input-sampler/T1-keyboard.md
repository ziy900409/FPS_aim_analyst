# T1 — 鍵盤採集（keydown/keyup + timeStamp）

> Part of [WP-3 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T0 |
| **Risk / Complexity** | Low / Low |
| **Touches** | NEW `src/input/InputSampler.ts`（鍵盤部分）+ `InputSampler.test.ts`；MODIFY `src/main.ts` |
| **Status** | ✅ DONE (2026-07-01) |

## Objective
監聽 keydown/keyup（A/D/反向鍵及 W/S 預留），蓋 `event.timeStamp`（高解析度）寫入 `SharedState.input`（FR-3.1）。

## In scope
- `InputSampler` 鍵盤部分：`keydown`/`keyup` → `{type:'key', code, down, t: event.timeStamp}`。
- 去除自動重複（keydown 重複觸發）：以 `event.repeat` 過濾或自維護 held set。

## Out of scope
- 滑鼠（→ T2）、開火（→ T3）、消費（→ T4）、反向語意（→ WP-5）。

## Design notes
- `code`（如 `'KeyA'`/`'KeyD'`）而非 `key`，避免 layout 差異。
- `event.repeat===true` 的 keydown 不重複入緩衝（只記真實狀態轉換）。

## Steps
- [x] 建 `InputSampler.ts` 骨架 + 鍵盤監聽（`attach`/`detach`，冪等）。
- [x] keydown（非 repeat）/keyup 寫 `{type:'key',...,t:event.timeStamp}`；過濾 A/D/W/S。
- [x] Vitest（6）：時間戳正確、A/D/W/S 過濾、repeat 不重複、時間戳原樣、detach 移除監聽、attach 冪等。
- [x] `vitest run`（33 passed）+ `tsc`（exit 0）+ `vite build`（✓）綠燈。

## Definition of Done
- [x] A/D（及反向鍵）keydown/keyup 帶 `event.timeStamp` 入緩衝；無 repeat 污染。

## Commit
`feat(wp-3): 鍵盤採集 keydown/keyup + event.timeStamp（FR-3.1）`
