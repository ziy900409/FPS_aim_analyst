# T4 — sim 依時序消費緩衝 + 排空

> Part of [WP-3 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1, T2, T3 |
| **Risk / Complexity** | Med / Med |
| **Touches** | NEW `src/input/consume.ts`；MODIFY `src/loop/SimLoop.ts`（simStep 開頭呼叫 consume）；`src/state/SharedState.ts` + `src/state/types.ts`（最小 `inputMeta` metadata） |
| **Status** | ✅ DONE (2026-07-01) |

> **範圍拆分（2026-07-01）**：本 task 只在 WP-2 佔位 **plain array** 上做「依 `timeStamp` 升冪消費 + 半開窗嚴格 `<` 排空 + `lateEventCount` + WP-2 決定性回歸」。**固定欄位 ring buffer（OQ-3.2）+ `bufferOverflow`（GD-2）已移交 → [T4b-ring-buffer-overflow.md](T4b-ring-buffer-overflow.md)**（含把 T1/T2/T3 的 `push` 與 consume 改為 ring 槽位重用 + 寫入端 bounded insertion 保序）。理由見 [progress.md](progress.md) Decision Log。下方 In scope / Steps / DoD 中屬 ring/overflow 者已標「→ T4b」。

## Objective
sim 在每個 tick 從緩衝**依時間排序、無遺漏**消費 `t < tick 結束時間` 的事件並排空（FR-3.4）。維持 WP-2 決定性：消費順序只依 timeStamp，與事件 push 順序無關。

## In scope
- `consume(state, untilT, handle)`：取 `t < untilT`（**半開窗** `[tickStart, untilT)`，嚴格 `<`）的事件、按 `t` 升冪、逐一 `handle`、從緩衝移除。
  - ⚠️ **邊界語意（GD-3）**：必須與 WP-2 佔位 `consumeInput`（[SimLoop.ts](../../../../src/loop/SimLoop.ts) `buf[consumed].t < tickEndMs`）一致的嚴格 `<`；**不可**用 `<=`，否則 `t == tickEndMs` 事件落錯 tick → M1 決定性回歸紅。
- `SimLoop` 在 `simStep` 開頭（或 tick 前）呼叫 consume，handle 暫只更新按鍵 held 狀態 / 標記 fire（真處理在 WP-5）。
- **遲到事件**：`t` 早於當前最舊未消費 tick 窗者，夾進當前最舊 tick 消費並計 `lateEventCount`（GD-2 metadata）。lateEventCount 存放於 `SharedState.inputMeta`（+ `lastConsumedT` 低水位游標），`resetState` 歸零。
- ~~**溢位**：ring 容量滿時升 `bufferOverflow`（GD-2 metadata），**不靜默丟最舊**。~~ **→ 移交 [T4b](T4b-ring-buffer-overflow.md)**（plain array 佔位無靜態容量、無溢位語意）。

## Out of scope
- 命中/急停/首發處理（→ WP-5）；本 task 只證明排序消費 + 排空。

## Design notes
- **決定性關鍵**：consume 依 t 升冪 + 以固定 tick 邊界（嚴格 `<`）切分，確保同輸入序列在不同 FPS 下消費結果一致（與 WP-2 T4 一致性相容）。
- **排序責任（D-3b）**：理想上放採集端（`event.timeStamp` 近單調 → append 即近有序，罕見亂序寫入端 bounded insertion 修正）。**但 T1–T3 目前為到達順序 plain `push`（尚未實作寫入端 bounded insertion）**，故本切片於 consume **僅對本 tick 窗內到期子集**做局部排序（小範圍、非整 buffer）補齊「亂序 → 升冪交付」；佔位 array 階段可接受。**寫入端保序 + 消除 consume 排序 scratch（GC-strict）→ 移交 [T4b](T4b-ring-buffer-overflow.md)**（ring 為 packed 數值槽、就地全排序困難，每 tick 配置 sort scratch 違反 CLAUDE.md §4）。
- ~~ring buffer 消費後推進游標（槽位重用，非 `push`/`splice` 物件）~~ **→ T4b**。本切片為 plain array：一趟掃描收集到期子集 + 就地壓實殘留（原地縮長、同一陣列參考、不 realloc）；剩餘（`t >= untilT`）留待下一 tick。
- **決定性邊界**：逐 tick 全等只在**預排序合成事件**路徑成立；遲到事件（`lateEventCount` 路徑）本質 wall-clock 相依、非決定性，不納入 exact 斷言。

## Steps
- [x] 建 `consume.ts`（一趟掃描收集到期子集 + 局部窗排序 + 嚴格 `< untilT` 過濾 + 就地壓實排空）。
- [x] `SimLoop` `simStep` 內呼叫 `consume(state, tickEndMs, handle)`（取代佔位 `consumeInput`；沿用 WP-2 `simTimeMs` 邏輯時鐘與 tickEndMs 分桶，不改 accumulator）。
- [x] `SharedState.inputMeta`（`lateEventCount` + `lastConsumedT`）+ `resetState` 歸零（`types.ts` 加 `InputMeta`）。
- [x] Vitest（`consume.test.ts`）：亂序 push（時間戳交錯）→ consume 依 t 升冪交付；跨 tick 邊界事件正確分批；**邊界事件 `t == untilT` 落下一 tick（嚴格 `<`）**；緩衝最終排空。
- [x] Vitest：遲到事件夾進當前最舊 tick + `lateEventCount` 遞增（不丟棄）；`resetState` 歸零 inputMeta。~~ring 滿升 `bufferOverflow`、不丟最舊~~ **→ [T4b](T4b-ring-buffer-overflow.md)**。
- [x] **回歸**：重跑 WP-2 決定性測試（含輸入消費）仍綠（9 tests）——邊界語意未從 `<` 漂移成 `<=`。
- [x] `tsc --noEmit`（exit 0）+ `vitest run src`（45 passed）+ `vite build`（✓ built）全綠。

## Definition of Done
- [x] 事件依時序、無遺漏被消費；緩衝正確排空；跨 tick 分批正確；邊界用嚴格 `<`。
- [x] 遲到事件計入 `lateEventCount`。~~溢位升 `bufferOverflow`（不靜默丟最舊）~~ **→ [T4b](T4b-ring-buffer-overflow.md)**（plain array 佔位無靜態容量，本切片無溢位語意）。
- [x] WP-2 決定性測試（納入輸入消費）仍通過。

## Commit
`feat(wp-3): sim 依時序消費輸入緩衝 + 排空（FR-3.4）`
