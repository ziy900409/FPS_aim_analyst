# WP-7 — Progress Log ★M3

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: 🟢 M3 達成 — 完整 drill 資料層端到端匯出（WP-7 完成，交棒 WP-8）

| Phase | State |
|-------|-------|
| T0 Entry gate | ✅ 完成（2026-07-02） |
| T1 Ring buffer | ✅ 完成（2026-07-02） |
| T2 事件記錄 | ✅ 完成（2026-07-02） |
| T3 Metadata | ✅ 完成（2026-07-02） |
| T4 JSON/CSV 匯出 | ✅ 完成（2026-07-02） |
| T5 Schema 文件 | ✅ 完成（2026-07-02） |
| T6 Exit gate（M3） | ✅ 完成（2026-07-03）— **M3 達成** |

---

## Open Questions ledger（T0 解決）

| ID | Status | Resolution |
|----|--------|-----------|
| OQ-7.1 recorder 容量/超量 | ✅ 鎖定（T0） | **preallocated arena（非環狀）**；容量 = `maxDrillSeconds`(300s)×simHz + 餘裕；超量 `recorderOverflow`（不覆寫）|
| OQ-7.2 每 tick 欄位 | ✅ 鎖定（T0） | `{t,vx,vz,crosshair,keys}`（附錄 C） |
| OQ-7.3 CSV 結構 | ✅ 鎖定（T0） | JSON 為主 + ticks.csv / events.csv |
| OQ-7.4 重用 vs 匯出快照 | ✅ 鎖定（T0） | 記錄重用、匯出一次性序列化 |

---

## Log

### 2026-07-03 — T6 Exit gate ✅ PASS — **M3 達成**

**驗收 map（PLAN WP-7 / F1/F2 / M3）→ 證據**

| 驗收 | Task | 證據 |
|---|---|---|
| ring buffer 每 tick 記錄、無 GC 卡頓 | T1 | `TickArena` typed arrays（`t/vx/vz/cx/cy/keyMask`），`recordTickFromState` 熱路徑零配置；`DataRecorder.test.ts` 100,000-tick 壓測無 per-tick 物件、無溢位；overflow 不繞圈、保留最舊列。 |
| 事件流完整（visible/counter/fire） | T2 | `SimLoop.ts` 於 target tick 後掃 `tVisible` emit `visible`、反向鍵轉換 emit `counter`、fire 分支 emit `fire`（hit/firstShot/residualSpeed/part）；`DataRecorder.test.ts` 三 variant 斷言。 |
| 環境 metadata 完整 | T3 | `collectMeta` 強制必填 + finite 驗證（backend/displayHz/simHz/sensitivity/COI/…）；`metadata.test.ts` 5 tests。 |
| JSON/CSV 可下載 | T4 | `export.ts` `serializeJSON`/`serializeCSV`（ticks.csv + events.csv）+ `downloadJSON`/`downloadCSV`；non-finite 丟錯、CSV escape、suspect 傳播；`export.test.ts` 對附錄 C 範例 byte-exact 斷言 + `main.ts`/`ExportPanel.ts` UI 串接。 |
| schema 與文件一致 | T5 | `docs/operational/schema.md` 逐欄對照 `Meta`/`TickRecord`/`DrillEvent`/CSV 欄位。 |

**全域紅綠燈證據**
- `tsc --noEmit` exit 0。
- `vitest run` — **20 files / 153 tests passed**，含 `determinism.test.ts`（9 tests）決定性回歸未漂移。
- 匯出鏈端到端序列化證據：`export.test.ts` 對附錄 C 範例產生 byte-exact JSON + `ticks.csv`/`events.csv`，並驗 `NaN`/`Infinity` 丟錯、CSV quote/escape、`recorderOverflow`→`suspect` 傳播。
- 無 GC 佐證：`recordTickFromState` 直讀 `SharedState` primitive 寫 typed arrays；100k-tick 壓測快照配置只發生在匯出時（非熱路徑）。

**Outcomes & Retrospective**
- **無 GC 壓測**：arena = preallocated 非環狀 typed arrays + slot 重用，熱路徑無 `new`；overflow 升 `recorderOverflow` 標 suspect、拒寫不覆寫（研究需整場資料）。100k-tick 通過。
- **schema 一致性**：型別 = 單一真相，`schema.md` 對照無漂移；WP-9 整合測試將再驗匯出符合 schema。
- **metadata 完整性**：`collectMeta` 缺欄／非 finite 即丟錯，杜絕靜默缺值污染研究效度。
- **Surprise / 已知限制（不 blocking M3 機制門）**：production 路徑目前**不寫入** `SharedState.crosshair`（僅 `resetState` 歸零、測試手動設值），故每筆 tick 匯出 `crosshair: [0,0]`。recorder 忠實記錄 state；缺口在上游（WP-3/WP-5 明示佔位「語意待該二 WP 定」，SharedState.ts:40）。5 項 M3 驗收皆為機制層、均綠；此為跨 WP 資料完整性缺口，已記 [DECISIONS.md](../../DECISIONS.md) GD-4，交棒 WP-8 前需釐清（WP-8 消費 crosshair 會得到常數 0）。
- **本 session 未能執行**：① 瀏覽器實機下載點擊；② 實跑 `counterstrafe_ad_v1` drill 由玩法填 crosshair。二者需 live browser + pointer lock（非互動 session 無法驅動）。序列化/資料鏈已由 vitest 全覆蓋；建議使用者做一次實機 click-test 收尾。

**交棒 WP-8**：資料層（F1/F2）機制端到端綠燈，`{meta,ticks,events}` 可供 `MetricsDashboard` 消費。WP-8 進場前先讀 GD-4（crosshair 常數 0）與 schema.md。

### 2026-07-02 — T5 Schema 文件 ✅ PASS
- **實作**：新增 `docs/operational/schema.md`，文件化 JSON root `{meta,ticks,events}`、`Meta`、`TickRecord`、`DrillEvent` 三種事件 variant，以及 `ticks.csv` / `events.csv` 欄位。
- **對齊內容**：逐欄對照 `src/data/metadata.ts`、`src/data/DataRecorder.ts`、`src/data/export.ts`；補上時間基準（`performance.now()` ms）、source velocity 單位、backend enum、finite number 防線、CSV sparse event table 與 quote 規則。
- **索引**：WP-7 README 與頂層 exec-plan WP-7 row 連到 `docs/operational/schema.md`。
- **Verification**：docs-only 變更；以 `npm.cmd run typecheck` 驗證既有 TypeScript 仍通過。
- **Next**：T6 Exit gate（M3）：確認完整 drill 可匯出、schema 一致、無卡頓證據，宣告 M3 並交棒 WP-8。

### 2026-07-02 — T4 JSON/CSV 匯出 ✅ PASS
- **實作**：新增 `src/data/export.ts`，提供 `buildExportPayload(meta,snapshot)`、`serializeJSON()`、`serializeCSV()`、`downloadJSON()`、`downloadCSV()`；payload 結構為 `{meta,ticks,events}`，CSV 分成 `ticks.csv` / `events.csv` 兩個扁平表。
- **資料防線**：匯出時若 tick/event 數值含 `NaN` / `Infinity` 會丟錯，避免 JSON 靜默轉成 `null` 污染研究資料；snapshot overflow 會回寫 `meta.recorderOverflow` 並標 `suspect`。
- **UI 串接**：新增 `src/ui/ExportPanel.ts`，`src/main.ts` 建立 `DataRecorder` 並傳入 `createSimLoop(..., recorder)`；右上角 JSON / CSV 按鈕會讀當下 snapshot、量測 `displayHz`、收集 `backend` / `SIM_HZ` / sensitivity / COI / input overflow metadata 後下載檔案。
- **Verification**：`npm test -- --run src/data/export.test.ts` PASS（5 passed）；`npm run typecheck` PASS；`npm test` PASS（20 files / 153 tests passed）；`npm run build` PASS（僅 Vite chunk size warning）。
- **Tooling note**：已於 code edit 後執行 `graphify update .`，更新 `graphify-out/`。
- **Next**：T5 `docs/operational/schema.md`，把 JSON / CSV schema 文件化並與 `export.ts` 欄位對齊。

### 2026-07-02 — T3 環境 metadata ✅ PASS
- **實作**：新增 `src/data/metadata.ts`，提供 `collectMeta(args)` 組裝 `{drillId,backend,displayHz,simHz,browser,sensitivity,crossOriginIsolated,startedAt}`，並納入附錄 C / grill 欄位 `unit:'source'`、`vStrafe`、`maxDrillSeconds`、`lateEventCount`、`bufferOverflow`、`recorderOverflow`、`suspect`。
- **必填驗證**：`backend` 僅接受 `webgpu|webgl2`；`sensitivity`、`displayHz`、`simHz` 等數值必須為正 finite；`crossOriginIsolated` 必須是 boolean（`false` 代表環境有效讀取但非 isolated，不視為缺欄）。
- **displayHz**：新增 `measureDisplayHz()`，以連續 `requestAnimationFrame` timestamp 間隔中位數估算 refresh rate；量測邏輯獨立於 `collectMeta`，供 T4/main 在匯出前呼叫。
- **Verification**：`npm test -- --run src/data/metadata.test.ts` PASS（5 passed；sandbox 需外部執行，因 esbuild 載入 Vite config 時父層目錄被拒）；`npm run typecheck` PASS；`npm test` PASS（148 passed）；`npm run build` PASS（僅 Vite chunk size warning）。
- **Next**：T4 JSON/CSV 匯出可消費 `Meta` + `DataRecorder.snapshot()` 組 `{meta,ticks,events}`。

### 2026-07-02 — T2 事件記錄 ✅ PASS
- **實作**：`DataRecorder` 補上 `recordEvent(event)`，snapshot 既有 `events[]` 現在由實際事件掛點填入；`reset()` 清空 events，維持 drill 邊界。
- **SimLoop 串接**：target tick / drill runner tick 後掃描本 tick 新寫入 `tVisible` 的 visible target，記錄 `{type:'visible',targetId,t}`；input consume handle 於反向鍵 keydown 轉換時記錄 `{type:'counter',key,t}`；fire event 以 input `t` 記錄 `{type:'fire',hit,firstShot,residualSpeed,part?}`，並沿用既有 raycast / firstShot / markKilled 順序。
- **時間源**：visible 用 sim tick `tickEndMs`；counter/fire 用 input ring 交付的 `event.t`（來源為 `event.timeStamp`），對齊 ADR-4 / 附錄 C。
- **Verification**：`npm test -- --run src/data/DataRecorder.test.ts src/loop/SimLoop.test.ts` PASS（15 passed，需 sandbox 外執行，因 esbuild 載入 Vite config 時父層目錄被拒）；`npm run typecheck` PASS；`npm test` PASS（143 passed）；`npm run build` PASS（僅 Vite chunk size warning）。
- **Tooling note**：已於 code edit 後執行 `graphify update .`，更新 `graphify-out/`。
- **Next**：T3 Metadata 可接續執行，T4 需等待 T3 後組合 `{meta,ticks,events}` 匯出。

### 2026-07-02 — T1 Ring buffer tick 記錄 ✅ PASS
- **實作**：新增 `src/data/RingBuffer.ts` 的 `TickArena`（typed arrays：`t/vx/vz/cx/cy/keyMask`）與 `src/data/DataRecorder.ts`。arena 為 preallocated、非環狀；容量預設 `ceil(maxDrillSeconds * simHz) + extraTicks`（300s × 128Hz + 128 = 38,528）。
- **SimLoop 串接**：`simStep` 末端於 movement / `curr` 更新後呼叫可選 `recorder.recordTickFromState(tickEndMs, state)`；既有呼叫者不傳 recorder 時行為不變。選擇不改 `SharedState`，降低 blast radius。
- **溢位策略**：寫滿後 `recorderOverflow=true`，後續 tick 拒寫且不覆寫最舊資料；snapshot 仍保留已記錄順序。
- **無 GC 佐證**：熱路徑由 `recordTickFromState` 直接讀 `SharedState` primitive 欄位並寫 typed arrays，不建立 tick object / crosshair array / keys array；Vitest 壓測 100,000 ticks 覆蓋此路徑，snapshot 配置只發生在匯出時。
- **Verification**：`npm test -- --run src/data/DataRecorder.test.ts src/loop/SimLoop.test.ts` PASS；`npm run typecheck` PASS；`npm test` PASS（141 passed）；`npm run build` PASS。
- **Tooling note**：GitNexus MCP 仍回報 0 indexed repos，無法執行 AGENTS 指定的 `impact` / `detect_changes`；改用 CodeGraph impact（`simStep` 5 symbols、`createSimLoop` 4 symbols、`SharedState` 45 symbols，故未改 `SharedState`）與 `graphify update .`。
- **Next**：T2 事件記錄（visible/counter/fire）與 T3 metadata 可並行。

### 2026-07-02 — T0 Entry gate ✅ PASS
- **上游狀態確認**：WP-4 progress 宣告完成（F2 `t_visible` 全綠），WP-5 progress 宣告完成並達成 **M2 核心玩法成立**（`vitest run` 99/99、`tsc --noEmit` exit 0、手動驗 PASS）。T0 依賴 WP-2/WP-4/WP-5 成立。
- **事件來源確認**：
  - `TargetManager.tick(state, nowMs)` 在 sim tick 內寫 `state.tVisible.set(id, nowMs)`，`nowMs` 由 `SimLoop` 的 sim clock `tickEndMs` 傳入。
  - `InputSampler` 已將左鍵 `mousedown` 以 `event.timeStamp` 寫入 input ring 的 `fire` 事件。
  - `SimLoop.applyInput` fire 分支已 inline 計算 `firstShot`、`accurate`、`residualSpeed`，並透過 `raycastFromCenter` 得到 hit / targetId / part；目前以 `void` 保留給 WP-7 emit。
  - `MovementController.step` 已在反向鍵穿越 tick 寫 `stopped=true` / `vx=0`，供 fire 分支形成 counter / residualSpeed 事件。
- **metadata 來源確認**：`createRenderer(canvas)` 回傳 `{renderer, backend}`（`webgpu|webgl2`）；`SettingsPanelHandle.sensitivity` getter 可讀；`assertIsolation()` 回傳 `crossOriginIsolated`；`SIM_HZ=128`；browser / displayHz 留 T3 runtime collect。
- **sim tick 掛點確認**：`simStep` 現在於 target tick → consume/fire → movement step → `curr` 更新後結束。T1 可在末端掛 `recordTick`；T2 可在 fire 分支與 t_visible/counter seam emit `recordEvent`。未觸發 STOP。
- **OQ-7.1~7.4 鎖定**：arena 非環狀 + `recorderOverflow` 不覆寫；tick 欄位 `{t,vx,vz,crosshair,keys}`；CSV 採 JSON 主 + `ticks.csv` / `events.csv`；記錄階段重用、匯出一次性序列化。
- **Tooling note**：已讀 graphify report 並執行 `graphify query` 驗證 WP-7 T0 與 `simStep` / metadata seam 關聯。GitNexus MCP `query` 回報 `No indexed repositories. Run: gitnexus analyze`，與 AGENTS.md 索引宣告不一致；本切片 docs-only，無 production symbol impact 可執行。
- **Next**：T1 Ring buffer tick 記錄（建立 `DataRecorder` preallocated arena，於 `simStep` 末端 `recordTick`）。

### （規劃）— WP-7 計畫產出
- 依 PLAN WP-7（7.1–7.5）+ 規格 §6 + 附錄 C 展開為 T0–T6。
- **M3 = 完整 drill 能端到端匯出**。核心紀律：`DataRecorder` = **preallocated arena（非環狀）** + 物件重用（無 GC 卡頓）；metadata 完整（backend/COI/sensitivity/Hz/browser + `lateEventCount`/`bufferOverflow`/`recorderOverflow`/`suspect`）；schema 對齊附錄 C。
- **Next**：確認 M2 + WP-4/5 事件來源後執行 **T0**（[T0-entry-gate.md](T0-entry-gate.md)）。
