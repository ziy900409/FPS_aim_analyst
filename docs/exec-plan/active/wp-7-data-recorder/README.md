# WP-7 — 資料記錄與匯出（F1/F2）★M3

> 執行計畫 / 技術規格。索引：[`../../README.md`](../../README.md) · 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **WP** | WP-7（PLAN §5）— *資料記錄與匯出（F1/F2）* |
| **里程碑** | **M3 — 完整 drill 能端到端匯出資料**（可開始 pilot） |
| **相依** | WP-2（sim tick）、WP-4（t_visible/命中事件）、WP-5（fire/急停/首發） |
| **Type** | 資料層（F1/F2）：preallocated arena 記錄 + 事件流 + metadata + JSON/CSV 匯出 |
| **Module / 觸及路徑** | NEW `src/data/DataRecorder.ts`、`src/data/RingBuffer.ts`、`src/data/metadata.ts`、`src/data/export.ts`、[`docs/operational/schema.md`](../../../operational/schema.md)；MODIFY `src/loop/SimLoop.ts` |
| **必讀** | 規格 §5（指標來源）· §6（無 GC 卡頓 / 資料完整性）· 附錄 C（匯出 schema）· ADR-1（backend metadata）· ADR-4（時間源）· [CONTEXT.md](../../../../CONTEXT.md) |
| **估時** | 3–5 dev-days |

---

## 1. 需求壓縮 (Requirements)

### Problem statement

把每 sim tick 的狀態與關鍵事件記錄下來並可匯出 JSON/CSV，供研究分析（F1/F2）。記錄必須**無 GC 週期性卡頓**（用 preallocated arena + 物件重用，避免每 tick 配置物件；**非環狀**、drill 內不繞圈），且帶完整環境 metadata（後端類型、更新率、瀏覽器、sensitivity）。匯出 schema 與文件一致（附錄 C）。完成即達 **M3：完整 drill 能端到端匯出資料**，可開始 pilot。

### Functional Requirements

| ID | Requirement | Maps to task |
|----|-------------|--------------|
| **FR-7.1** | `DataRecorder` **preallocated arena**（**非環狀**，物件重用，無 GC 卡頓）：每 tick 記錄 velocity、準心、按鍵、開火。 | T1 |
| **FR-7.2** | 事件記錄：`t_visible`、命中、首發、急停（事件流完整）。 | T2 |
| **FR-7.3** | 環境 metadata：backend、displayHz、simHz、browser、sensitivity、`crossOriginIsolated`。 | T3 |
| **FR-7.4** | JSON / CSV 匯出（可下載檔案）。 | T4 |
| **FR-7.5** | 匯出資料的 schema 文件 `schema.md`。 | T5 |

### Non-functional Requirements

- **無 GC 卡頓**：arena 預配置（非環狀）+ 物件重用，每 tick 不 new（規格 §6）。
- **資料完整性**：每筆 drill 可完整匯出，含環境 metadata。
- **時間源同源**：所有時間戳 `performance.now()`（ADR-4）；tick 用 sim 時間、事件用其 `timeStamp`。
- backend 取自 WP-0 `createRenderer` seam（ADR-1）。

### Constraints

- `DataRecorder` = **preallocated arena（非環狀）**：容量 = `maxDrillSeconds`(300s) × simHz ≈ 38400 ticks + 餘裕；drill 內**不繞圈**，超量升 `recorderOverflow` 標 suspect（**不覆寫最舊**——匯出需整場）。容量上限與 drill 雙閘「總時長」是同一個數。**輸入緩衝**才是真 ring（WP-3，溢位升 `bufferOverflow`）。
- 匯出 schema 對齊附錄 C（`meta` / `ticks[]` / `events[]`）。
- 記錄在 sim tick 內寫入（決定性、與量測同源）。

### Out of scope
- 指標計算（→ WP-8，消費匯出資料/記錄）。
- 後端上傳/儲存（階段 A 純前端下載；帳號系統 out of scope）。
- 階段 B `SharedArrayBuffer` 記錄（架構預留）。

### Open Questions

| ID | Question | 建議解法 | Blocks |
|----|----------|---------|--------|
| **OQ-7.1** | recorder 容量與超量策略？ | ✅ **已定（T0 / grill）**：`DataRecorder` = **preallocated arena（非環狀、drill 內不 wrap）**，容量 = `maxDrillSeconds`(300s)×simHz ≈ 38400 + 餘裕；超量**升 `recorderOverflow`、不覆寫**（容量＝drill 雙閘總時長，正常碰不到）。**輸入緩衝**才是真 ring（WP-3，溢位 `bufferOverflow`）。 | T1 |
| **OQ-7.2** | 每 tick 記錄哪些欄位（對齊附錄 C）？ | ✅ **已定（T0）**：`{ t, vx, vz, crosshair:[cx,cy], keys:[...] }`（附錄 C ticks 範例）。 | T1 |
| **OQ-7.3** | CSV 結構（ticks 與 events 異質）？ | ✅ **已定（T0）**：JSON 為主；CSV 匯出兩個扁平表 `ticks.csv` / `events.csv`。 | T4 |
| **OQ-7.4** | 物件重用如何兼顧匯出快照？ | ✅ **已定（T0）**：記錄階段重用；匯出時一次性序列化（讀取，不在熱路徑配置）。 | T1, T4 |

---

## 2. 系統架構與設計 (Technical Design)

### System boundary

```
src/data/RingBuffer.ts    ← NEW (預配置 typed 結構 + 物件重用)                       [FR-7.1/NFR]
src/data/DataRecorder.ts  ← NEW (每 tick 寫 ring buffer；事件流 append)              [FR-7.1/7.2]
src/data/metadata.ts      ← NEW (蒐集 backend/displayHz/simHz/browser/sensitivity)   [FR-7.3]
src/data/export.ts        ← NEW (組 {meta,ticks,events} → JSON / CSV 下載)           [FR-7.4]
docs/operational/schema.md ← NEW (匯出 schema 文件)                                  [FR-7.5]
src/loop/SimLoop.ts       ← MODIFY (simStep 末呼叫 recorder.recordTick / recordEvent)
```

### Data flow（附錄 C 對齊）

```
SimLoop tick：recorder.recordTick({ t, vx, vz, crosshair, keys })   ← ring buffer，重用 slot
事件（WP-4/5）：recorder.recordEvent({type:'visible'|'counter'|'fire', ...})  ← events[]
drill ended（WP-6）→ export.build():
    meta ← metadata.collect()  (backend from WP-0 seam, sensitivity from WP-1, sim/display Hz, browser, COI)
    {meta, ticks: ringBuffer.snapshot(), events} → downloadJSON() / downloadCSV()
```

### Interface contracts（附錄 C）

```ts
// src/data/DataRecorder.ts
export interface TickRecord { t: number; vx: number; vz: number; crosshair: [number, number]; keys: string[]; }
export type DrillEvent =
  | { type: 'visible'; targetId: string; t: number }
  | { type: 'counter'; key: string; t: number }
  | { type: 'fire'; t: number; hit: boolean; firstShot: boolean; residualSpeed: number; /* 階段 A 二元 {0,±v} */ part?: 'head'|'body' };
export interface DataRecorder {
  recordTick(r: TickRecord): void;       // ring buffer，重用 slot，不 new
  recordEvent(e: DrillEvent): void;
  snapshot(): { ticks: TickRecord[]; events: DrillEvent[] };
  reset(): void;
}

// src/data/metadata.ts (FR-7.3, 附錄 C meta)
export interface Meta { drillId: string; backend: 'webgpu'|'webgl2'; displayHz: number; simHz: number;
  browser: string; sensitivity: number; crossOriginIsolated: boolean; startedAt: string;
  unit: 'source'; vStrafe: number; maxDrillSeconds: number;                       // grill
  lateEventCount: number; bufferOverflow: boolean; recorderOverflow: boolean; suspect: boolean; }
export function collectMeta(args: {...}): Meta;

// src/data/export.ts (FR-7.4)
export function downloadJSON(payload: { meta: Meta; ticks: TickRecord[]; events: DrillEvent[] }): void;
export function downloadCSV(payload: ...): void;   // ticks.csv + events.csv（OQ-7.3）
```

### Failure modes

| Mode | Trigger | Handling |
|------|---------|----------|
| GC 卡頓污染 | 每 tick new 物件 | arena 預配置 + slot 重用（FR-7.1）；T1 以無分配斷言/壓測佐證 |
| arena 溢位 | drill 過長 | 容量 = `maxDrillSeconds`×simHz + 餘裕；超量升 `recorderOverflow` 標 suspect（**不覆寫**、非環狀）（OQ-7.1） |
| metadata 缺欄 | seam 未接 | `collectMeta` 強制必填；backend 來自 WP-0、sensitivity 來自 WP-1、COI 來自 WP-0 T2 |
| schema 與文件不符 | 手改漏同步 | schema.md 與型別並列；T5 對照；WP-9 整合測試驗證匯出符合 schema |
| 時間源混用 | 誤記 `Date.now()` | tick 用 sim 時間、event 用 `event.timeStamp`（皆 `performance.now()` 基準） |

### Concurrency model
記錄在 sim tick 內同步寫；匯出在 drill ended 後一次性讀。無 worker（階段 B 可移 `SharedArrayBuffer`）。

---

## 3. 風險分析 (Risk Analysis)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **GC 週期性卡頓污染量測** | Med | High | ring buffer + 物件重用（規格 §6 / 附錄 F）；T1 壓測無週期性 GC spike |
| 匯出 schema 與文件漂移 | Med | Med | 型別 = 單一真相，schema.md 對照；WP-9 驗證匯出合 schema |
| metadata 不完整損及研究效度 | Med | High | 強制必填（backend/COI/sensitivity/Hz/browser）；缺即匯出失敗報錯 |
| arena 溢位 | Low | High | 容量綁 `maxDrillSeconds`×simHz + 餘裕；超量升 `recorderOverflow`（**不丟資料**）；drill endCondition 限制總量 |

### Technical debt
- 純前端下載、無後端儲存。*Trigger*：pilot 需集中收資料時加上傳（階段 B/外部）。

---

## 4. 任務拆解 (Task Breakdown)

| Task | File | Objective | Deps | Risk | Cplx |
|------|------|-----------|------|------|------|
| **T0** Entry gate | [T0-entry-gate.md](T0-entry-gate.md) | 確認 M2 + WP-4/5 事件來源 + WP-0 backend seam；鎖 OQ-7.1~7.4。 | WP-2, WP-4, WP-5 | Low | Low |
| **T1** Ring buffer tick 記錄 | [T1-ring-buffer.md](T1-ring-buffer.md) | 每 tick velocity/準心/按鍵/開火，物件重用無 GC（FR-7.1）。 | T0 | Med | High |
| **T2** 事件記錄 | [T2-event-recording.md](T2-event-recording.md) | t_visible/命中/首發/急停事件流（FR-7.2）。 | T1 | Med | Med |
| **T3** 環境 metadata | [T3-metadata.md](T3-metadata.md) | backend/displayHz/simHz/browser/sensitivity/COI（FR-7.3）。 | T0 | Low | Low |
| **T4** JSON/CSV 匯出 | [T4-export.md](T4-export.md) | 組 payload → 下載 JSON + CSV（FR-7.4）。 | T1, T2, T3 | Med | Med |
| **T5** Schema 文件 | [T5-schema-doc.md](T5-schema-doc.md) | [`schema.md`](../../../operational/schema.md) 對齊匯出格式（FR-7.5）。 | T4 | Low | Low |
| **T6 / T-exit** Exit gate（M3） | [T6-exit-gate.md](T6-exit-gate.md) | 完整 drill 可匯出、schema 一致、無卡頓；宣告 **M3**；交棒 WP-8。 | T1–T5 | Med | Low |

### Acceptance criteria（PLAN WP-7 / F1/F2 / M3）→ task map
- [ ] ring buffer 每 tick 記錄、無 GC 卡頓 → **T1**
- [ ] 事件流完整（t_visible/命中/首發/急停）→ **T2**
- [ ] 環境 metadata 完整 → **T3**
- [ ] JSON/CSV 可下載 → **T4**
- [ ] schema 與文件一致 → **T5**

## Assumptions
- **A1**：M2 達成；WP-4/5 產生 t_visible/fire/hit/counter 事件；WP-0 backend seam + WP-1 sensitivity 可讀。
- **A2**：匯出 schema 對齊附錄 C。
- **A3**：階段 A 純前端下載，無後端。
