# T2 — Pointer Lock 整合（手勢 / Esc / 失焦重取）

> Part of [WP-1 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1 |
| **Risk / Complexity** | Med / Med |
| **Touches** | NEW `src/input/PointerLock.ts`；MODIFY `src/main.ts` |
| **Status** | ✅ DONE（2026-06-30）— lock 生命週期狀態機綠（onChange/onMove gating/error/blur），tsc/build 綠 |

## Objective
以使用者手勢（click）取得 Pointer Lock；Esc / 失焦自動解除並可重取。封裝成 `PointerLockHandle`，視角（T4）與設定面板（T5）訂閱其狀態（FR-1.2）。

## In scope
- `PointerLock.ts`：`request()`、`locked`、`onChange()`、`onMove()`；監聽 `pointerlockchange`、`pointerlockerror`、`blur`。
- click canvas → request；Esc → 瀏覽器自動解除 → `onChange(false)`。

## Out of scope
- `unadjustedMovement` 原始輸入（→ T3，本 task 先用一般 `requestPointerLock()`）。
- 視角套用（→ T4）。

## Design notes
- 本 task `request()` 先呼叫一般 `canvas.requestPointerLock()`；T3 再包成 try unadjusted → catch fallback。
- `onMove` 在 locked 時轉發 `movementX/Y`；unlocked 不轉發（避免殘留 delta）。

```ts
export interface PointerLockHandle {
  request(): Promise<void>;
  readonly locked: boolean;
  onChange(cb: (locked: boolean) => void): void;
  onMove(cb: (dx: number, dy: number) => void): void;
}
```

## Steps
- [x] 建 `src/input/PointerLock.ts`：事件監聽 + 狀態機（document 級事件為權威 + blur 防禦）。
- [x] `main.ts`：canvas click → `request()`；`onChange` 切換「點擊以鎖定」提示（DOM overlay）。
- [x] 驗 click/Esc/失焦/重取：狀態機在真實 Edge 以合成 `pointerlockchange`/`blur`/`pointerlockerror` 驅動全綠（`onChange` 序列 `[t,f,t,f,t,f]` = 鎖定→解除→重取循環）。**真人 UX spot-check（游標真消失/Esc/alt-tab）建議上線前補**（見 progress.md 驗證取向）。
- [x] alt-tab 失焦 → unlocked：`blur` → `locked=false` 已驗。
- [x] `tsc` 乾淨（+ `vite build` ✓）。

## Definition of Done
- [x] click 鎖定、Esc 解除、失焦解除、可重取 → 狀態機驗證並記 progress.md（真鎖定的 UX 留真人 spot-check）。
- [x] `onMove` 僅 locked 時觸發（`movesWhileLocked=1`、解鎖後不再增加）。

## Commit
`feat(wp-1): Pointer Lock 整合（手勢/Esc/失焦重取）（FR-1.2）`
