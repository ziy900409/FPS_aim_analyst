# T1 — SharedState（型別 + 單例）

> Part of [WP-2 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T0 |
| **Risk / Complexity** | Low / Med |
| **Touches** | NEW `src/state/SharedState.ts`、`src/state/types.ts`、`src/state/SharedState.test.ts` |
| **Status** | ✅ DONE（2026-06-30）— tsc 0 + vitest 8 passed |

## Objective
定義 `SharedState`——三迴圈（input / sim / render）唯一溝通管道——的型別與單例：輸入緩衝、player velocity/位置、prev-curr 內插快照、準心、目標狀態、`t_visible`（FR-2.1）。

## In scope
- `types.ts`：`InputEvent`（discriminated union: key/mouse/fire）、`PlayerSnapshot`、`TargetState`。
- `SharedState`：上述欄位 + `input: InputEvent[]`、`prev/curr: PlayerSnapshot`、`targets: TargetState[]`（先空）、`tVisible: Map`（先空）。
- 單例 + `resetState()`（測試/重開 drill 用）。

## Out of scope
- 填入緩衝（→ WP-3）、目標寫入（→ WP-4）、ring buffer 記錄（→ WP-7）。
- sim/ render 邏輯（→ T2/T3）。

## Design notes
- 欄位先齊備但多數由後續 WP 寫入；本 task 只立結構，避免日後改型別牽動全域。
- velocity/位置用 plain number 欄位（vx/vz/x/z），避免在熱路徑配置 vector 物件（GC 紀律）。
- prev/curr 兩份快照供 T3 內插。

## Steps
- [x] 建 `src/state/types.ts`：`InputEvent` union（`{type:'key',code,down,t}` / `{type:'mouse',dx,dy,t}` / `{type:'fire',t}`）、`PlayerSnapshot`、`TargetState`。
- [x] 建 `src/state/SharedState.ts`：介面 + 單例（+ `createSharedState()` 工廠供 T4）+ `resetState()`。
- [x] `npx tsc --noEmit` 乾淨；寫一個最小 Vitest 確認單例 + reset。
- [x] `npx vitest run` 綠燈。

## Definition of Done
- [x] `SharedState` 型別完整、單例可取、`resetState()` 清空緩衝與快照（原地重用、守 GC 紀律）。
- [x] `tsc` + vitest 綠燈（tsc exit 0；`vitest run src` 8 passed）。

## Commit
`feat(wp-2): SharedState 型別 + 單例（三迴圈溝通管道）（FR-2.1）`
