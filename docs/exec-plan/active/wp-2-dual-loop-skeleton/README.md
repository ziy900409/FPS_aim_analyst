# WP-2 — SharedState + 雙迴圈骨架 ★脊椎（M1）

> 執行計畫 / 技術規格。索引：[`../../README.md`](../../README.md) · 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **WP** | WP-2（PLAN §5）— *共享狀態 + 雙迴圈骨架* |
| **里程碑** | **M1 — 專案脊椎**：雙迴圈可空跑 + 決定性驗證通過。**未過不要往下做。** |
| **相依** | WP-0（scaffold）、WP-1（2.3 內插需要 1.4 視角） |
| **Type** | 核心架構（ADR-2 雙迴圈 + fixed-timestep） |
| **Module / 觸及路徑** | NEW `src/state/SharedState.ts`、`src/loop/SimLoop.ts`、`src/loop/RenderLoop.ts`、`src/loop/clock.ts`；MODIFY `src/main.ts`；NEW `src/loop/__tests__/determinism.test.ts` |
| **必讀** | 規格 §2 ADR-2（雙迴圈解耦）· ADR-3（128 Hz tick）· ADR-4（`performance.now()`）· §4（雙迴圈核心 + 4.3 accumulator 虛擬碼）· §6 可重現性 · [CONTEXT.md](../../../../CONTEXT.md) |
| **估時** | 3–4 dev-days |

---

## 1. 需求壓縮 (Requirements)

### Problem statement

把邏輯（sim）與渲染（render）解耦：物理/量測跑在固定步長 128 Hz sim loop，渲染跑在 `requestAnimationFrame`，兩者**互不直接呼叫、全透過 `SharedState` 溝通**（ADR-2）。這是整個專案的脊椎——唯有 fixed-timestep 才能產生**與幀率無關、deterministic** 的 velocity 軌跡，沒有它後續所有量測都失去可重現性（規格 §6、附錄 F）。M1 的門檻是：同一輸入序列在不同 render FPS 下，sim 結果一致（決定性驗證通過）。

### Functional Requirements

| ID | Requirement | Maps to task |
|----|-------------|--------------|
| **FR-2.1** | `SharedState` 結構：輸入緩衝、player velocity、準心、目標狀態、`t_visible`；型別定義 + 單例。三迴圈唯一溝通管道。 | T1 |
| **FR-2.2** | `SimLoop` accumulator 固定 128 Hz（`TICK = 1/128`，夾住 0.25s 避免 spiral of death）；與 `RenderLoop` 解耦（附錄 4.3）。 | T2 |
| **FR-2.3** | `RenderLoop` 用 `alpha = acc/TICK` 在兩個 sim tick 間做內插，高 render FPS 下畫面不抖；接 WP-1 視角。 | T3 |
| **FR-2.4** | 決定性驗證（Vitest）：同一輸入序列、不同 render FPS（模擬不同 frame delta）→ sim 結果逐 tick 一致。**M1 gate**。 | T4 |

### Non-functional Requirements

- **計時源**：所有時間取自 `performance.now()`（ADR-4），禁用 `Date.now()`、禁用 render frame 推時間。
- **無 GC 卡頓**：sim step 不每 tick 配置物件（為 WP-7 ring buffer 鋪路；本 WP 至少避免在熱路徑 new 物件）。
- **tick rate 為常數**：`SIM_HZ = 128` 設定常數，不寫死在邏輯（ADR-3，可提升 256/384）。

### Constraints

- **三迴圈不互相直接呼叫**：input/sim/render 只經 `SharedState`（ADR-2）。
- **sim 與 render 各自維護 accumulator**；render 只讀 sim 最新狀態 + alpha 內插，不改 sim 狀態。
- 決定性的定義：**給定相同輸入事件序列（含時間戳），sim 的逐 tick 輸出與 render FPS 無關**。
- 階段 A sim 跑主執行緒；Web Worker + `SharedArrayBuffer` 是階段 B（架構需預留 seam，不實作）。

### Out of scope
- 真正的 movement 物理 / 急停（→ WP-5；本 WP sim step 用佔位邏輯如等速位移即可驗證決定性）。
- 高頻輸入採集細節（→ WP-3；本 WP 用合成輸入序列驗證決定性）。
- 目標 / `t_visible` 寫入時機（→ WP-4；`SharedState` 先留欄位）。
- 資料記錄 ring buffer（→ WP-7）。

### Open Questions

| ID | Question | 建議解法 | Blocks |
|----|----------|---------|--------|
| **OQ-2.1** | 決定性驗證的「sim step」用什麼佔位邏輯？ | 等速位移 + 一個由合成輸入切換的 velocity（如按鍵 toggle vx），足以暴露 frame-dependent bug。 | T4 |
| **OQ-2.2** | render FPS 如何在測試中變化？ | 餵不同 frame delta 序列（如 60/144/240 Hz + 抖動 + 一次大 spike）給同一 accumulator 驅動函式，比對 sim tick 輸出。 | T4 |
| **OQ-2.3** | sim 時間以 `performance.now()` 還是注入式 clock？ | 抽 `clock.ts`（`now(): number`）介面，正式用 `performance.now()`，測試注入合成時間 → 可測 + 不違 ADR-4。 | T2, T4 |
| **OQ-2.4** | 階段 B worker seam 要不要現在留？ | 留**邏輯純函式邊界**（`simStep(state, dt)` 為純函式），不引入 worker；足以日後搬遷。 | T2 |

---

## 2. 系統架構與設計 (Technical Design)

### System boundary

```
src/loop/clock.ts          ← NEW (now(): number; 正式=performance.now()，測試可注入)   [FR-2.2/OQ-2.3]
src/state/SharedState.ts   ← NEW (輸入緩衝/velocity/準心/目標/t_visible；單例)          [FR-2.1]
src/loop/SimLoop.ts        ← NEW (accumulator 128 Hz；simStep 純函式邊界)               [FR-2.2]
src/loop/RenderLoop.ts     ← NEW (rAF；alpha 內插；讀 SharedState)                      [FR-2.3]
src/main.ts                ← MODIFY (組三迴圈：input→state、sim、render)
src/loop/__tests__/determinism.test.ts ← NEW (M1 gate：同輸入不同 FPS → 一致)          [FR-2.4]
```

### Data flow（雙迴圈，ADR-2 / §4.3）

```
輸入(事件) ──寫──> SharedState.inputBuffer
                         │
SimLoop (128 Hz)：  while (acc >= TICK) { simStep(state, TICK); acc -= TICK; }   ← 消費 inputBuffer、推進 velocity/位置
                         │  (state.prev / state.curr 雙快照供內插)
RenderLoop (rAF)：  alpha = acc / TICK; render(lerp(prev, curr, alpha))         ← 只讀，不改 sim 狀態；接 WP-1 camera
```

### Interface contracts

```ts
// src/loop/clock.ts (OQ-2.3)
export interface Clock { now(): number; }                 // 毫秒
export const realClock: Clock = { now: () => performance.now() };

// src/state/SharedState.ts (FR-2.1) — 單例，三迴圈唯一溝通管道
export interface SharedState {
  input: InputEvent[];            // 緩衝（WP-3 填，sim 消費清空）
  player: { vx: number; vz: number; x: number; z: number };
  prev: PlayerSnapshot; curr: PlayerSnapshot;  // 內插用雙快照
  crosshair: { cx: number; cy: number };
  targets: TargetState[];         // WP-4 用，先留空陣列
  tVisible: Map<string, number>;  // WP-4 用
}

// src/loop/SimLoop.ts (FR-2.2) — simStep 為純函式邊界（OQ-2.4）
export function simStep(state: SharedState, dtSec: number): void;   // 推進一個固定 tick
export function createSimLoop(state: SharedState, clock: Clock, simHz: number): {
  pump(nowMs: number): { ticks: number; alpha: number };           // accumulator；回傳本幀 tick 數與 alpha
};

// src/loop/RenderLoop.ts (FR-2.3)
export function createRenderLoop(state: SharedState, onFrame: (alpha: number) => void): { start(): void; stop(): void };
```

### accumulator（§4.3 對齊）

```
const TICK = 1 / SIM_HZ;          // 128 → 7.8125 ms
acc += Math.min(now - last, 0.25);  // 夾住避免 spiral of death
while (acc >= TICK) { simStep(state, TICK); acc -= TICK; }
alpha = acc / TICK;               // [0,1) 內插係數
```

### Failure modes

| Mode | Trigger | Handling |
|------|---------|----------|
| spiral of death | 分頁背景 / 長卡頓累積大 acc | `Math.min(delta, 0.25)` 夾住；T2 測一次大 spike 不爆 tick 數 |
| frame-dependent sim | 誤用 frame delta 當 sim dt | sim 只用固定 `TICK`；T4 決定性驗證把關 |
| 內插改到 sim 狀態 | render 寫 state | RenderLoop 只讀；prev/curr 由 sim 維護；程式審查 + 測試 |
| 用 `Date.now()` | 誤用 wall clock | `clock.ts` 封裝 `performance.now()`；lint/審查禁 `Date.now` |
| 浮點累積漂移 | 長 session acc 累加 | 固定 `TICK` 相減（非乘 tick 數）；決定性測試覆蓋長序列 |

### Concurrency model

階段 A：單執行緒，三迴圈在主執行緒協作（input 事件、sim 在 rAF 內 pump、render 在 rAF）。`simStep` 為純函式以預留階段 B 搬入 Web Worker + `SharedArrayBuffer`（OQ-2.4），本 WP 不實作 worker。

---

## 3. 風險分析 (Risk Analysis)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **決定性驗證做不出來** → M1 不成立 | Med | **Critical** | OQ-2.1/2.2 明確佔位邏輯 + frame delta 序列；T4 為門控，未過 STOP 全專案 |
| frame-dependent 偷渡（render 改 sim 狀態） | Med | High | RenderLoop 唯讀；prev/curr 雙快照；審查 + 測試斷言 render 前後 sim 狀態不變 |
| 注入式 clock 與正式路徑不一致 | Low | Med | `clock.ts` 單一介面，正式/測試共用 `pump(now)` 同函式 |
| GC 卡頓污染（雖未量測仍鋪壞習慣） | Low | Med | sim 熱路徑避免 new；WP-7 ring buffer 接手 |

### Technical debt
- sim step 為佔位等速邏輯（OQ-2.1）。*Trigger*：WP-5 換真 movement/急停（介面 `simStep` 不變）。

---

## 4. 任務拆解 (Task Breakdown)

| Task | File | Objective | Deps | Risk | Cplx |
|------|------|-----------|------|------|------|
| **T0** Entry gate | [T0-entry-gate.md](T0-entry-gate.md) | 確認 WP-0/WP-1 exit 綠燈；鎖 OQ-2.1~2.4（決定性測試設計）。 | WP-0, WP-1 | Low | Low |
| **T1** SharedState | [T1-shared-state.md](T1-shared-state.md) | 型別 + 單例：輸入緩衝/velocity/準心/目標/t_visible/prev-curr（FR-2.1）。 | T0 | Low | Med |
| **T2** SimLoop accumulator | [T2-sim-loop.md](T2-sim-loop.md) | `clock.ts` + 128 Hz accumulator + `simStep` 純函式邊界（FR-2.2）。 | T1 | Med | High |
| **T3** Render 內插 | [T3-render-interpolation.md](T3-render-interpolation.md) | rAF + alpha 內插，接 WP-1 視角，高 FPS 不抖（FR-2.3）。 | T2 | Med | Med |
| **T4** 決定性驗證 ★M1 | [T4-determinism.md](T4-determinism.md) | Vitest：同輸入序列、不同 FPS → 逐 tick 一致（FR-2.4，**M1 gate**）。 | T2 | High | High |
| **T5 / T-exit** Exit gate（M1） | [T5-exit-gate.md](T5-exit-gate.md) | 雙迴圈空跑 + 決定性綠燈；宣告 **M1 達成**；交棒 WP-3/WP-4。 | T1–T4 | Med | Low |

### Acceptance criteria（PLAN WP-2 / M1）→ task map
- [ ] `SharedState` 型別 + 單例，三迴圈唯一溝通管道 → **T1**
- [ ] 雙迴圈可空跑、sim 固定 128 Hz、render 解耦 → **T2 + T3**
- [ ] render 內插高 FPS 不抖 → **T3**
- [ ] **決定性驗證通過（M1 gate）** → **T4**

## Assumptions
- **A1**：WP-0 scaffold + WP-1 camera 可用（T3 內插接視角）。
- **A2**：sim step 用佔位等速邏輯即可證明決定性；真 movement 為 WP-5。
- **A3**：`performance.now()` 在 isolated 環境達 5 µs（WP-0 已驗）；測試用注入 clock。
- **A4**：階段 A 單執行緒；`simStep` 純函式邊界保留階段 B worker 搬遷可能。
