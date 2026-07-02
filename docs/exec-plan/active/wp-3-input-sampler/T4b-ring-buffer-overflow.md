# T4b — 固定欄位 ring buffer + 溢位（bufferOverflow）

> Part of [WP-3 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> 承接 [T4-sim-consume.md](T4-sim-consume.md)（T4 已在 plain array 佔位上完成排序消費 + 排空 + 遲到計數）。

| | |
|---|---|
| **Depends on** | T4 |
| **Risk / Complexity** | Med / Med |
| **Touches** | MODIFY `src/state/SharedState.ts`（真環狀 ring + 靜態容量 + `bufferOverflow` metadata）；`src/input/InputSampler.ts`（T1/T2/T3 的 `push` → ring 槽位寫入 + 寫入端 bounded insertion 保序）；`src/input/consume.ts`（游標排空、槽位重用，取代 plain array 掃描/壓實 + scratch sort） |
| **Status** | ✅ DONE (2026-07-01) |

## 背景（為何從 T4 拆出）
T4 依「拆分」決策（見 [progress.md](progress.md) Decision Log）只在 WP-2 佔位 plain array 上做「依 `timeStamp` 升冪消費 + 半開窗嚴格 `<` 排空 + `lateEventCount` + WP-2 決定性回歸」，**刻意不**引入固定欄位 ring buffer 與 `bufferOverflow`，也不回頭改動剛提交的 T1/T2/T3 採集端。理由：符合 T4 Touches（僅 `consume.ts` + `SimLoop.ts`）、Med/Med 風險、Rule 0 簡單優先。ring/overflow 屬正交關切，獨立成本切片降低回歸面。

## Objective
把輸入緩衝從 plain array 佔位換成 **CLAUDE.md §4 要求的固定欄位「真 ring」**（消費後繞圈、靜態容量、物件重用、不 `push` 物件），並落實**溢位**語意（GD-2 / OQ-3.2）。

## In scope（承接自 T4 移交）
- **固定欄位 ring buffer**（OQ-3.2）：靜態容量、不動態 resize；每事件壓成固定數值槽位（如 `type,t,a,b`，CONTEXT「ring buffer」），寫入/消費皆游標推進、槽位重用（非 `push`/`splice`/scratch）。
- **`bufferOverflow`**（GD-2 metadata）：ring 容量滿時**升 `bufferOverflow`、不靜默丟最舊**；`SharedState.inputMeta` 加此欄位 + `resetState` 歸零。
- **寫入端 bounded insertion 保序**（D-3b）：T1/T2/T3 的 `push` 改為 ring 寫入並在罕見亂序時就地修正 → 使 `consume` 端可移除 T4 的局部窗排序 scratch（守 GC 紀律）。
- `consume` 改為 ring 游標排空（取代 T4 的整段掃描 + 壓實 + `due.sort`）。

## Out of scope
- 命中/急停/首發處理（→ WP-5）；朝向/準心真消費（→ WP-5）。

## Design notes
- **決定性不得回歸**：換 ring + 保序寫入後，重跑 WP-2 決定性測試（含輸入消費）與 T4 的 `consume.test.ts` 仍須全綠；邊界語意維持嚴格 `<`（GD-3）。
- **GC 紀律（CLAUDE.md §4）**：這是本切片的主要動機——T4 的 `due` 收集 + `sort` scratch 為每 tick 配置，ring + 寫入端保序可消除之。
- 遲到事件語意（`lateEventCount`）沿用 T4（`inputMeta.lastConsumedT` 低水位）；ring 下低水位判定不變。

## Steps
- [x] `SharedState` 立固定欄位 ring（`createInputRing`：靜態 `RING_CAPACITY=512` 常數、`head`/`count` 游標、`Uint8Array type` + 三 `Float64Array t/a/b` 槽位）；`inputMeta` 加 `bufferOverflow` + `resetState` 原地歸零（`ring.clear()`）。
- [x] T1/T2/T3 採集端 `push` → ring `pushKey/pushMouse/pushFire`（+ 寫入端 bounded insertion 保序）；容量滿 `push*` 回 `false` → 升 `bufferOverflow`、拒收、不丟最舊。
- [x] `consume` 改 ring 游標排空（`peekT()<untilT` 沿 head 排空 + 重用 view 解碼）、移除 `due` scratch 與 `due.sort`。
- [x] Vitest：新增 `InputRing.test.ts`（繞圈重用槽位、容量滿拒收不丟最舊、寫入端亂序 → 升冪、packed 解碼保真、clear 續用）+ `InputSampler` 溢位 wiring；回歸 `consume.test.ts` + WP-2 決定性測試遷移後仍綠。
- [x] `tsc` / `vitest run` / `vite build` 全綠（tsc exit 0、**53 passed**、✓ built）。

## Definition of Done
- [x] 輸入緩衝為固定欄位真 ring（靜態容量、槽位繞圈重用、熱路徑不配置物件——寫入 primitive、消費解碼進單一重用 view）。
- [x] 容量滿升 `bufferOverflow`、不靜默丟最舊（`push*` 回 `false` = 拒收新事件）。
- [x] 寫入端 bounded insertion 保序 → `consume` 無需每 tick 排序 scratch（GC 紀律達標）。
- [x] `consume.test.ts` 與 WP-2 決定性測試仍通過；邊界維持嚴格 `<`（GD-3 未漂移）。

## Commit
`feat(wp-3): 輸入緩衝換固定欄位 ring buffer + 溢位 bufferOverflow（OQ-3.2/GD-2）`