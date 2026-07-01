# T4b — 固定欄位 ring buffer + 溢位（bufferOverflow）

> Part of [WP-3 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> 承接 [T4-sim-consume.md](T4-sim-consume.md)（T4 已在 plain array 佔位上完成排序消費 + 排空 + 遲到計數）。

| | |
|---|---|
| **Depends on** | T4 |
| **Risk / Complexity** | Med / Med |
| **Touches** | MODIFY `src/state/SharedState.ts`（真環狀 ring + 靜態容量 + `bufferOverflow` metadata）；`src/input/InputSampler.ts`（T1/T2/T3 的 `push` → ring 槽位寫入 + 寫入端 bounded insertion 保序）；`src/input/consume.ts`（游標排空、槽位重用，取代 plain array 掃描/壓實 + scratch sort） |
| **Status** | ⬜ TODO |

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
- [ ] `SharedState` 立固定欄位 ring（靜態容量常數、頭/尾游標、數值槽位陣列）；`inputMeta` 加 `bufferOverflow` + `resetState` 歸零。
- [ ] T1/T2/T3 採集端 `push` → ring 寫入（+ bounded insertion 保序）；容量滿升 `bufferOverflow`、不丟最舊。
- [ ] `consume` 改游標排空、移除 `due` scratch 與局部排序。
- [ ] Vitest：ring 繞圈重用槽位、容量滿升 `bufferOverflow`（不丟最舊）、寫入端亂序 → 保序;回歸 T4 `consume.test.ts` + WP-2 決定性測試仍綠。
- [ ] `tsc` / `vitest run` / `vite build` 全綠。

## Definition of Done
- [ ] 輸入緩衝為固定欄位真 ring（靜態容量、槽位重用、熱路徑不配置物件）。
- [ ] 容量滿升 `bufferOverflow`、不靜默丟最舊。
- [ ] 寫入端保序 → `consume` 無需每 tick 排序 scratch（GC 紀律達標）。
- [ ] T4 `consume.test.ts` 與 WP-2 決定性測試仍通過；邊界維持嚴格 `<`。

## Commit
`feat(wp-3): 輸入緩衝換固定欄位 ring buffer + 溢位 bufferOverflow（OQ-3.2/GD-2）`