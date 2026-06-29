# T2 — Pointer Lock 整合（手勢 / Esc / 失焦重取）

> Part of [WP-1 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1 |
| **Risk / Complexity** | Med / Med |
| **Touches** | NEW `src/input/PointerLock.ts`；MODIFY `src/main.ts` |
| **Status** | ⬜ TODO |

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
- [ ] 建 `src/input/PointerLock.ts`：事件監聽 + 狀態機。
- [ ] `main.ts`：canvas click → `request()`；`onChange` 切換「點擊以鎖定」提示。
- [ ] 手動驗：click 鎖定（游標消失）、Esc 解除（游標回來 + 提示重現）、再 click 重取成功。
- [ ] alt-tab 失焦 → unlocked，回前景再 click 可重取。
- [ ] `tsc` 乾淨。

## Definition of Done
- [ ] click 鎖定、Esc 解除、失焦解除、可重取，全部手動驗過並記 progress.md。
- [ ] `onMove` 僅 locked 時觸發。

## Commit
`feat(wp-1): Pointer Lock 整合（手勢/Esc/失焦重取）（FR-1.2）`
