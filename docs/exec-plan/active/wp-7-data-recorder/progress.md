# WP-7 — Progress Log ★M3

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: 🟡 T0 entry gate 完成，T1 待執行（達成即 M3）

| Phase | State |
|-------|-------|
| T0 Entry gate | ✅ 完成（2026-07-02） |
| T1 Ring buffer | ⬜ 待執行 |
| T2 事件記錄 | ⬜ 待執行 |
| T3 Metadata | ⬜ 待執行 |
| T4 JSON/CSV 匯出 | ⬜ 待執行 |
| T5 Schema 文件 | ⬜ 待執行 |
| T6 Exit gate（M3） | ⬜ 待執行 |

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
