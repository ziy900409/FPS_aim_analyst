# WP-4 — 目標系統 + t_visible（F2）

> 執行計畫 / 技術規格。索引：[`../../README.md`](../../README.md) · 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **WP** | WP-4（PLAN §5）— *目標系統 + `t_visible`（F2）* |
| **里程碑** | M1 之後；通往 M2（WP-5 需要目標）。可與 WP-3 並行。 |
| **相依** | WP-1（場景）、WP-2（sim tick 蓋 `t_visible`） |
| **Type** | 模擬 + 渲染（F2）：目標 spawn / 可見性 / 左右交替 / `t_visible` |
| **Module / 觸及路徑** | NEW `src/sim/TargetManager.ts`、`src/render/TargetView.ts`、`src/ui/Crosshair.ts`；MODIFY `src/state/SharedState.ts`（targets / tVisible） |
| **必讀** | 規格 §5（急停反應時間 = `t_counter − t_visible`）· ADR-2/3/4 · §1.2 F2 · [CONTEXT.md](../../../../CONTEXT.md) |
| **估時** | 2–3 dev-days |

---

## 1. 需求壓縮 (Requirements)

### Problem statement

F2：記錄每個敵人 spawn／可見時間戳 `t_visible`——**每個目標可見的瞬間在 sim tick 內蓋上 `performance.now()` 時間戳**。`t_visible` 是所有反應時間量測的起點（規格 §5），其正確性直接決定資料效度。目標以左右交替序列出現（擊殺右 → 生成左），模擬 counter-strafe 的 peek 節奏。

### Functional Requirements

| ID | Requirement | Maps to task |
|----|-------------|--------------|
| **FR-4.1** | 目標 entity：mesh + hitbox，可顯示/隱藏。 | T1 |
| **FR-4.2** | spawn/可見性邏輯：目標可見的瞬間**在 sim tick 內**蓋 `t_visible`（`performance.now()` 同源）。 | T2 |
| **FR-4.3** | 左右交替序列：擊殺/消失一側 → 生成另一側（依序交替）。 | T3 |
| **FR-4.4** | crosshair（準心）渲染於螢幕中心（DOM overlay 或 canvas）。 | T4 |

### Non-functional Requirements

- **`t_visible` 在 sim tick 內蓋**：不在 render frame 蓋（避免幀率相依污染，ADR-2/4）。
- **時間戳同源**：`t_visible` 取自 sim 的 `clock.now()`（= `performance.now()`）。
- 目標狀態存於 `SharedState`（三迴圈溝通），render 只讀。
- **F5 接縫（seam-in，grill）**：`TargetManager` 保留 motion registry slot、`SimLoop` 在命中判定**之前**呼叫（階段 A 預設 `static` 恆等、不移動）；`TargetState.motion?`/`age` 欄預留。移動 drill／追蹤指標延後（規格 §1.2 修正）。

### Constraints

- 目標的可見性轉換屬 **sim 職責**（在 tick 內決定 + 蓋戳）；render 只反映 `SharedState.targets`。
- 左右交替序列為確定性（給定 drill 種子/序列，目標出現順序可重現）——與 WP-2 決定性相容。
- hitbox 與 mesh 分離（hitbox 供 WP-5 Raycaster；**階段 A 單一 hitbox**，`part` 選填保留）。

### Out of scope
- 命中判定（→ WP-5，消費 hitbox）。
- drill config 驅動的目標數/位置/時序（→ WP-6；本 WP 用內建佔位序列）。
- 反應時間計算（→ WP-8，消費 `t_visible`）。

### Open Questions

| ID | Question | 建議解法 | Blocks |
|----|----------|---------|--------|
| **OQ-4.1** | 目標幾何 / hitbox 部位？ | **已定 H1（grill）**：階段 A **單一 hitbox**（命中/未命中）；`part` 欄保留選填、向後相容；頭/身分解與爆頭率延後。正式形狀延後。**T0 鎖定 ✅（2026-07-01）**——對齊 CONTEXT.md `HitDetector`。 | T1 |
| **OQ-4.2** | 「可見」的定義（spawn 即可見 vs 進視野才算）？ | 階段 A：**spawn 瞬間即視為可見**（固定左右位置在視野內），`t_visible` = spawn tick 時間；遮擋/進視野模型延後。**T0 鎖定 ✅（2026-07-01）**——對齊 CONTEXT.md `t_visible` 條目。 | T2 |
| **OQ-4.3** | 交替序列由誰驅動？ | 本 WP 用內建確定性序列（左/右輪替）；WP-6 drill loader 之後接管。介面預留。**T0 鎖定 ✅（2026-07-01）**——確定性函式、與 WP-2 決定性契約相容。 | T3 |
| **OQ-4.4** | 目標消失條件（本 WP）？ | 本 WP 先支援「被標記擊殺 → 消失 → 生成對側」；擊殺訊號暫由測試/佔位觸發，WP-5 命中接上。**T0 鎖定 ✅（2026-07-01）**。 | T3 |

---

## 2. 系統架構與設計 (Technical Design)

### System boundary

```
src/sim/TargetManager.ts   ← NEW (spawn/可見性/左右交替/蓋 t_visible；在 sim tick 內)      [FR-4.1/4.2/4.3]
src/render/TargetView.ts   ← NEW (依 SharedState.targets 顯示/隱藏 mesh；唯讀)             [FR-4.1]
src/ui/Crosshair.ts        ← NEW (螢幕中心準心 overlay)                                     [FR-4.4]
src/state/SharedState.ts   ← MODIFY (targets: TargetState[]; tVisible: Map<id, number>)
src/loop/SimLoop.ts        ← MODIFY (simStep 內呼叫 TargetManager.tick)
```

### Data flow

```
SimLoop tick (128 Hz)：TargetManager.tick(state, nowMs)
    若需生成下一目標 → 建 TargetState（位置=左/右輪替）→ 可見瞬間：state.tVisible.set(id, nowMs)   [t_visible 在 tick 內蓋]
    若目標被標記擊殺 → 移除 → 排程生成對側
RenderLoop (rAF)：TargetView 讀 state.targets → 顯示/隱藏對應 mesh（唯讀）
Crosshair：靜態置中 overlay
```

### Interface contracts

```ts
// src/state/SharedState.ts (MODIFY)
export interface TargetState {
  id: string; side: 'L' | 'R';
  pos: { x: number; y: number; z: number };   // u（source unit）
  visible: boolean; alive: boolean;
  hitbox: { /* 幾何參數 */ part?: 'head' | 'body' };   // 階段 A 單一 hitbox（H1）；part 選填保留
  motion?: TargetMotion; age?: number;          // F5 接縫：省略 = static；sim tick 更新 age/pos
}

// src/sim/TargetManager.ts (FR-4.1/4.2/4.3)
export interface TargetManager {
  tick(state: SharedState, nowMs: number): void;   // sim tick 內：可見即蓋 t_visible
  markKilled(state: SharedState, id: string): void; // WP-5 命中後呼叫
  reset(state: SharedState, seq?: 'LR' | 'RL'): void;
}
export function createTargetManager(opts?: { distance?: number }): TargetManager;
```

### Failure modes

| Mode | Trigger | Handling |
|------|---------|----------|
| `t_visible` 蓋在 render frame | 誤在 rAF 寫戳 | 強制在 `TargetManager.tick`（sim）內蓋；審查 + 測試斷言來源為 sim clock |
| 同一目標重複蓋戳 | 多 tick 都判可見 | 只在 visible 由 false→true 的轉換 tick 蓋一次 |
| 交替序列不確定 | 隨機亂數無種子 | 確定性輪替（或帶種子 PRNG）；與 WP-2 決定性相容 |
| render 改目標狀態 | TargetView 寫 state | TargetView 唯讀；狀態只由 TargetManager（sim）改 |

### Concurrency model
TargetManager 在 sim tick 內同步執行；render 唯讀 `SharedState.targets`。無 worker。

---

## 3. 風險分析 (Risk Analysis)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **`t_visible` 幀率相依** | Med | **High**（反應時間失真） | 在 sim tick 內蓋戳（FR-4.2）；T2 測試斷言戳來自 sim clock 且只在可見轉換蓋一次 |
| 交替序列破壞決定性 | Low | Med | 確定性輪替 / 種子 PRNG；回歸 WP-2 決定性測試 |
| hitbox 與 mesh 不一致 | Med | Med（命中誤差） | hitbox 與 mesh 由同 TargetState 衍生；WP-5 用同一來源 |

### Technical debt
- 內建佔位序列 + 固定位置（OQ-4.2/4.3）。*Trigger*：WP-6 drill loader 接管目標生成。

---

## 4. 任務拆解 (Task Breakdown)

| Task | File | Objective | Deps | Risk | Cplx |
|------|------|-----------|------|------|------|
| **T0** Entry gate ✅ | [T0-entry-gate.md](T0-entry-gate.md) | 確認 M1 + WP-1 場景；鎖 OQ-4.1~4.4。 | WP-1, WP-2 | Low | Low |
| **T1** 目標 entity | [T1-target-entity.md](T1-target-entity.md) | mesh + 單一 hitbox（H1；`part` 選填）顯示/隱藏（FR-4.1）。 | T0 | Low | Med |
| **T2** 可見性 + t_visible | [T2-visibility-tvisible.md](T2-visibility-tvisible.md) | spawn/可見瞬間在 **sim tick 內**蓋 `t_visible`（FR-4.2）。 | T1 | Med | Med |
| **T3** 左右交替序列 | [T3-alternation.md](T3-alternation.md) | 擊殺一側 → 生成對側，確定性輪替（FR-4.3）。 | T2 | Med | Med |
| **T4** Crosshair | [T4-crosshair.md](T4-crosshair.md) | 螢幕中心準心 overlay（FR-4.4）。 | T0 | Low | Low |
| **T5 / T-exit** Exit gate | [T5-exit-gate.md](T5-exit-gate.md) | 目標依序交替、`t_visible` 正確（sim tick 內）；交棒 WP-5/WP-6。 | T1–T4 | Low | Low |

### Acceptance criteria（PLAN WP-4 / F2）→ task map
- [ ] 可生成目標（mesh + hitbox）→ **T1**
- [ ] `t_visible` 在 sim tick 內正確蓋戳 → **T2**
- [ ] 目標左右交替生成 → **T3**
- [x] 螢幕中心準心 → **T4**

## Assumptions
- **A1**：M1 達成、WP-1 場景可用。
- **A2**：階段 A「可見」= spawn 瞬間即可見（OQ-4.2）。
- **A3**：本 WP 目標序列為內建佔位，WP-6 接管。
