# T4 — sim 依時序消費緩衝 + 排空

> Part of [WP-3 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1, T2, T3 |
| **Risk / Complexity** | Med / Med |
| **Touches** | NEW `src/input/consume.ts`；MODIFY `src/loop/SimLoop.ts`（simStep 開頭呼叫 consume） |
| **Status** | ⬜ TODO |

## Objective
sim 在每個 tick 從緩衝**依時間排序、無遺漏**消費 `t ≤ tick 結束時間` 的事件並排空（FR-3.4）。維持 WP-2 決定性：消費順序只依 timeStamp，與事件 push 順序無關。

## In scope
- `consume(state, untilT, handle)`：取 `t ≤ untilT` 的事件、按 `t` 升冪、逐一 `handle`、從緩衝移除。
- `SimLoop` 在 `simStep` 開頭（或 tick 前）呼叫 consume，handle 暫只更新按鍵 held 狀態 / 標記 fire（真處理在 WP-5）。

## Out of scope
- 命中/急停/首發處理（→ WP-5）；本 task 只證明排序消費 + 排空。

## Design notes
- **決定性關鍵**：consume 排序 + 以固定 tick 邊界切分，確保同輸入序列在不同 FPS 下消費結果一致（與 WP-2 T4 一致性相容）。
- 緩衝消費後移除已處理項（splice 或游標推進）；剩餘（t > untilT）留待下一 tick。

## Steps
- [ ] 建 `consume.ts`（排序 + 過濾 + 排空）。
- [ ] `SimLoop` tick 內呼叫 consume(state, tickEndTime)。
- [ ] Vitest：亂序 push（時間戳交錯）→ consume 依 t 升冪交付；跨 tick 邊界事件正確分批；緩衝最終排空。
- [ ] **回歸**：重跑 WP-2 決定性測試（含輸入消費）仍綠。
- [ ] `vitest run` + `tsc` 綠燈。

## Definition of Done
- [ ] 事件依時序、無遺漏被消費；緩衝正確排空；跨 tick 分批正確。
- [ ] WP-2 決定性測試（納入輸入消費）仍通過。

## Commit
`feat(wp-3): sim 依時序消費輸入緩衝 + 排空（FR-3.4）`
