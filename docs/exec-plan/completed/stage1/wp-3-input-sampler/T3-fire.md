# T3 — 開火事件採集（mousedown + timeStamp）

> Part of [WP-3 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T0 |
| **Risk / Complexity** | Low / Low |
| **Touches** | MODIFY `src/input/InputSampler.ts`（開火部分）、`src/main.ts`（注入 lock 閘門） |
| **Status** | ✅ DONE (2026-07-01) |

## Objective
mousedown（左鍵）蓋 `event.timeStamp` 寫入緩衝 `{type:'fire', t}`（FR-3.3）。此為「開火」量測事件的來源（WP-5 命中判定、WP-7 事件流消費）。

## In scope
- `mousedown`（button 0）→ `{type:'fire', t:event.timeStamp}` 入緩衝。

## Out of scope
- 命中判定（→ WP-5）；首發判定（→ WP-5）。

## Design notes
- 只記開火**事件**與時間戳；命中與否由 sim 在消費 fire 事件時用 Raycaster 判（WP-5）。
- Pointer Lock 鎖定中才採計（避免 UI 點擊誤判為開火）。

## Steps
- [x] `mousedown` handler（僅 locked + button 0）寫 fire 事件。
- [x] Vitest：合成 mousedown → 緩衝含 fire 事件 + 時間戳（+ 未鎖定不入、非左鍵不入、detach 移除監聽）。
- [ ] 手動驗：鎖定中點左鍵入緩衝；未鎖定不入。（→ WP-3 exit gate 手動 spot-check）
- [x] `vitest run` + `tsc` 綠燈（37 passed / tsc 0 / build ✓）。

## Definition of Done
- [x] 開火事件帶 `event.timeStamp` 入緩衝；僅鎖定中採計。

## Commit
`feat(wp-3): 開火事件 mousedown + event.timeStamp（FR-3.3）`
