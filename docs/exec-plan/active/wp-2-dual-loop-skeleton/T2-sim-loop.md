# T2 — SimLoop accumulator（固定 128 Hz）

> Part of [WP-2 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T1 |
| **Risk / Complexity** | Med / High |
| **Touches** | NEW `src/loop/clock.ts`、`src/loop/SimLoop.ts`、`src/loop/constants.ts` |
| **Status** | ⬜ TODO |

## Objective
實作 accumulator 模式的固定步長 sim loop（`SIM_HZ=128`，`TICK=1/128`，夾住 0.25s 避免 spiral of death），`simStep(state, dt)` 為純函式邊界；與 render 解耦（FR-2.2，§4.3）。

## In scope
- `constants.ts`：`SIM_HZ = 128`（常數，可改 256/384）。
- `clock.ts`：`Clock` 介面 + `realClock`（`performance.now()`）。
- `SimLoop.ts`：`createSimLoop(state, clock, simHz)` 回傳 `pump(nowMs) → { ticks, alpha }`；內含 accumulator。
- `simStep(state, dtSec)`：佔位邏輯（依輸入緩衝切換 vx，等速推進 x/z），更新 `prev`←`curr`、寫新 `curr`。

## Out of scope
- 真 movement/急停（→ WP-5）；render（→ T3）；決定性測試（→ T4，但本 task 要讓 `pump` 可被注入 clock 驅動）。

## Design notes（§4.3）
```ts
export function createSimLoop(state, clock, simHz) {
  const TICK = 1 / simHz; let acc = 0; let last = clock.now() / 1000;
  return { pump(nowMs) {
    const now = nowMs / 1000;
    acc += Math.min(now - last, 0.25);   // 夾住
    last = now;
    let ticks = 0;
    while (acc >= TICK) { simStep(state, TICK); acc -= TICK; ticks++; }
    return { ticks, alpha: acc / TICK };
  }};
}
```
- `simStep` 只用固定 `TICK`，**絕不**用 frame delta（決定性根源）。
- 每 tick 前 `state.prev = snapshot(state.curr)`，供 T3 內插。

## Steps
- [ ] 建 `constants.ts`、`clock.ts`。
- [ ] 建 `SimLoop.ts`：accumulator + `simStep` 佔位邏輯 + prev/curr 維護。
- [ ] Vitest：餵固定步進 → tick 數正確（如 1s @128Hz ≈ 128 ticks）；一次 0.5s spike 被夾成 ≤ 0.25s 對應 tick 數（不爆）。
- [ ] `npx vitest run` + `npx tsc --noEmit` 綠燈。

## Definition of Done
- [ ] `pump` 在固定步進下產生正確 tick 數；spike 被夾住不 spiral。
- [ ] `simStep` 為純函式（不讀 `performance.now()`、不碰 DOM）。

## Commit
`feat(wp-2): SimLoop accumulator 128 Hz + clock 注入 + simStep 純函式（FR-2.2）`
