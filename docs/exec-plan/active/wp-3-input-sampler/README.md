# WP-3 — 輸入採集層 InputSampler（F1）

> 執行計畫 / 技術規格。索引：[`../../README.md`](../../README.md) · 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **WP** | WP-3（PLAN §5）— *輸入採集層（F1）* |
| **里程碑** | M1 之後；通往 M2/M3（資料來源） |
| **相依** | WP-2（`SharedState` 緩衝 + sim 消費）。可與 WP-4 並行。 |
| **Type** | 資料採集（F1）：高解析度時間戳的鍵鼠事件入緩衝 |
| **Module / 觸及路徑** | NEW `src/input/InputSampler.ts`、`src/input/consume.ts`；MODIFY `src/state/SharedState.ts`（緩衝）、`src/loop/SimLoop.ts`（消費） |
| **必讀** | 規格 §2 ADR-4（`performance.now()` / `event.timeStamp`）· ADR-5（coalesced events）· §5（量測指標需要的事件）· 附錄 B/C · [CONTEXT.md](../../../../CONTEXT.md) |
| **估時** | 2–3 dev-days |

---

## 1. 需求壓縮 (Requirements)

### Problem statement

F1：採集每個 A/D／反向鍵的 keydown/keyup、滑鼠位移、開火事件，**皆帶高解析度時間戳並可匯出**。精準度的真正來源是這層的 sub-tick 輸入時間戳（規格 ADR-3 關鍵觀念），不是 sim tick 頻率。事件寫入 `SharedState` 輸入緩衝，由 128 Hz sim loop 依時間排序消費（ADR-2 三迴圈經 `SharedState` 溝通）。

### Functional Requirements

| ID | Requirement | Maps to task |
|----|-------------|--------------|
| **FR-3.1** | `InputSampler` 監聽 keydown/keyup（A/D/反向鍵），蓋 `event.timeStamp`（高解析度）寫入緩衝。 | T1 |
| **FR-3.2** | `pointermove` + `getCoalescedEvents()` 次幀採樣，1000 Hz 滑鼠下不遺失中間軌跡樣本，每樣本帶 `timeStamp`。 | T2 |
| **FR-3.3** | 開火事件（mousedown）蓋時間戳寫入緩衝。 | T3 |
| **FR-3.4** | sim 從緩衝**依時間排序、無遺漏**消費事件，緩衝正確排空。 | T4 |

### Non-functional Requirements

- **時間戳同源**：一律用 `event.timeStamp`（與 `performance.now()` 同基準，ADR-4），禁 `Date.now()`。
- **無遺漏**：coalesced events 全數入緩衝；高頻滑鼠不丟樣本。
- **無 GC 卡頓**：輸入緩衝即**固定欄位 ring buffer**（本 WP 實作、不 `push` 物件）；`DataRecorder` 的 arena 屬 WP-7，兩者不同（前者真環狀、後者非環狀不繞圈）。

### Constraints

- 事件採集為**事件驅動**（~1000 Hz），不在固定迴圈（ADR-2 三速率）。
- sim 消費時以時間戳排序；同 tick 內多事件按 timeStamp 先後處理。
- 視角用滑鼠（WP-1）與量測用滑鼠軌跡（本 WP）共用 `pointermove` 但目的不同：WP-1 驅動 camera、WP-3 入緩衝供量測。

### Out of scope
- 命中/急停判定（→ WP-5，消費這些事件的下游）。
- `t_visible`（→ WP-4）。
- ring buffer 記錄/匯出（→ WP-7）。

### Open Questions

| ID | Question | 解法 | Status | Blocks |
|----|----------|---------|--------|--------|
| **OQ-3.1** | 反向鍵如何定義？ | 「反向鍵」= 與當前移動方向相反者（D 中按 A、A 中按 D）；採集層只記原始鍵碼，反向語意在 WP-5 急停判定處理。 | ✅ locked T0 (2026-07-01) | T1 |
| **OQ-3.2** | 緩衝資料結構？ | **已定（grill）**：固定欄位 **ring buffer**（真環狀；每事件壓成 `type,t,a,b` 數值欄、不 `push` 物件）——當下擋 GC、未來 SAB-portable。容量 = `nextPow2(MAX_EVENT_RATE_HZ×MAX_STALL_S×SAFETY)` 靜態常數、**執行期不動態 resize**；溢位升 `bufferOverflow`。 | ✅ grill / locked T0 | T4 |
| **OQ-3.3** | `event.timeStamp` 與 sim clock 對齊？ | 兩者皆 `performance.now()` 同 time origin（ADR-4/7），可直接相減。⚠️ **僅 Chromium 成立**；支援非 Chromium 須重驗。 | ✅ grill / locked T0 | T4 |

---

## 2. 系統架構與設計 (Technical Design)

### System boundary

```
src/input/InputSampler.ts   ← NEW (keydown/keyup/pointermove/mousedown → SharedState.input)   [FR-3.1/3.2/3.3]
src/input/consume.ts        ← NEW (sim 端：依 t 排序消費緩衝，排空)                            [FR-3.4]
src/state/SharedState.ts    ← MODIFY (input 緩衝既有欄位，補消費游標/清空語意)
src/loop/SimLoop.ts         ← MODIFY (simStep 開頭呼叫 consume，處理 ≤ 本 tick 時間的事件)
```

### Data flow

```
keydown/keyup(A/D/...)     ─┐
pointermove→coalesced[]    ─┼─ event.timeStamp ─→ SharedState.input.push(evt)      [採集 ~1000 Hz]
mousedown(fire)            ─┘
SimLoop tick (128 Hz)：consume(state, [tickStart,tickEnd)) → 取該邏輯窗事件、**桶內按 t 升冪**交 simStep（決定性前提）→ 移除。遲到落在已關閉 tick 的事件夾進當前最舊 tick、計 `lateEventCount`；溢位升 `bufferOverflow`。
```

### Interface contracts

```ts
// src/input/InputSampler.ts
export interface InputSampler { attach(target: EventTarget): void; detach(): void; }  // target=EventTarget（鍵盤落 window，D-T1.1）
export function createInputSampler(state: SharedState): InputSampler;
// 寫入 state.input：
//   { type:'key', code:'KeyA'|'KeyD'|..., down:boolean, t:number }
//   { type:'mouse', dx:number, dy:number, t:number }   // 每個 coalesced event 一筆
//   { type:'fire', t:number }

// src/input/consume.ts (FR-3.4)
export function consume(state: SharedState, untilT: number,
  handle: (e: InputEvent) => void): void;
  // 取 t < untilT、按 t 升冪、處理後移除。
  // ⚠️ 邊界為**半開窗** [tickStart, untilT)：caller 傳 tickEndMs，嚴格 `<`（GD-3）。
  //    與 WP-2 佔位 consumeInput（SimLoop.ts `t < tickEndMs`）一致，否則邊界事件
  //    落錯 tick → 破壞 M1 已鎖的決定性回歸。**不可**用 `<=`。
```

### Failure modes

| Mode | Trigger | Handling |
|------|---------|----------|
| coalesced 不支援 | 舊瀏覽器 | `getCoalescedEvents?.() ?? [e]`（附錄 B） |
| 時間戳亂序入緩衝 | 多來源事件交錯 | **採集端保序寫入**：`event.timeStamp` 近單調 → append 即近有序；罕見亂序時寫入端做 bounded insertion 修正。consume 端只游標排空、**不每 tick 全排序**（避免 per-tick scratch 配置，守 CLAUDE.md §4 GC 紀律）。⚠️ ring buffer 為 packed 數值槽，就地全排序困難 → 保序寫入是較深的解。 |
| 遲到事件（落已關閉 tick） | 事件 `t` 早於當前最舊未消費 tick 窗 | 夾進當前最舊 tick 消費、計 `lateEventCount`（GD-2 metadata）。⚠️ 此路徑**本質 wall-clock 相依、非決定性**（真實輸入抖動）；決定性回歸只涵蓋預排序合成事件路徑。 |
| 緩衝溢位 | 長停頓 burst | 靜態容量 ring；溢位升 `bufferOverflow` 標 suspect（**不靜默丟最舊**，GD-2 metadata） |
| 視角與量測雙重消費衝突 | 同 pointermove | WP-1 即時用 movementX/Y 驅動 camera；WP-3 另把 coalesced 樣本入緩衝；互不干擾 |

### Concurrency model
事件驅動採集（主執行緒事件回呼）+ sim tick 內同步消費。無 worker。

---

## 3. 風險分析 (Risk Analysis)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| 高頻滑鼠丟樣本 | Med | High（軌跡失真） | `getCoalescedEvents()` 全收（ADR-5）；T2 以合成多樣本驗證無遺漏 |
| 時間戳基準不一致 | Low | High | 全用 `event.timeStamp`（= `performance.now()` 基準，ADR-4）；OQ-3.3 |
| 消費順序錯亂污染量測 | Med | High | consume 端排序 + 排空契約；T4 單元測試覆蓋亂序 |
| 緩衝 GC 卡頓 | Low | Med | 陣列重用 / 移除而非重建；ring buffer 留 WP-7 |

### Technical debt
- （原列「普通陣列緩衝」為債）已改**固定欄位 ring buffer**（OQ-3.2，grill）：當下擋 GC、未來 SAB-portable，此債項取消。

---

## 4. 任務拆解 (Task Breakdown)

| Task | File | Objective | Deps | Risk | Cplx |
|------|------|-----------|------|------|------|
| **T0** Entry gate | [T0-entry-gate.md](T0-entry-gate.md) | 確認 **M1 已達成**（WP-2 exit ✅）；鎖 OQ-3.1/3.2/3.3。 | WP-2 | Low | Low |
| **T1** 鍵盤採集 | [T1-keyboard.md](T1-keyboard.md) | keydown/keyup（A/D/反向鍵）蓋 `event.timeStamp` 入緩衝（FR-3.1）。 | T0 | Low | Low |
| **T2** 滑鼠 coalesced 採集 | [T2-mouse-coalesced.md](T2-mouse-coalesced.md) | `pointermove` + `getCoalescedEvents()` 次幀樣本入緩衝（FR-3.2）。 | T0 | Med | Med |
| **T3** 開火事件採集 | [T3-fire.md](T3-fire.md) | mousedown 蓋時間戳入緩衝（FR-3.3）。 | T0 | Low | Low |
| **T4** sim 消費緩衝 | [T4-sim-consume.md](T4-sim-consume.md) | 依時間排序、無遺漏消費 + 排空（FR-3.4）。 | T1, T2, T3 | Med | Med |
| **T5 / T-exit** Exit gate | [T5-exit-gate.md](T5-exit-gate.md) | 全部事件帶時間戳入緩衝且被 sim 依時序消費；交棒 WP-5。 | T1–T4 | Low | Low |

### Acceptance criteria（PLAN WP-3 / F1）→ task map
- [ ] 鍵盤事件帶高解析度時間戳入緩衝 → **T1**
- [ ] 滑鼠 coalesced 次幀樣本無遺漏入緩衝 → **T2**
- [ ] 開火事件帶時間戳 → **T3**
- [ ] sim 依時序、無遺漏消費並排空 → **T4**

## Assumptions
- **A1**：**M1 已達成**（WP-2 exit ✅，決定性驗證通過）——否則不應開始 WP-3。
- **A2**：`event.timeStamp` 與 `performance.now()` 同基準（ADR-4）。
- **A3**：滑鼠視角（WP-1）與量測軌跡（WP-3）並存、互不干擾。
