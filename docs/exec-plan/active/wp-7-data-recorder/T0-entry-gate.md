# T0 — Entry gate

> Part of [WP-7 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Read-only 驗證 + 文件。NO production code.**

| | |
|---|---|
| **Depends on** | WP-2 ✅、WP-4 ✅、WP-5 ✅（M2） |
| **Risk / Complexity** | Low / Low |
| **Touches** | docs only |
| **Status** | ✅ DONE（2026-07-02） |

## Objective
確認事件來源（WP-4 t_visible、WP-5 fire/hit/firstShot/counter）與 metadata 來源（WP-0 backend seam、WP-1 sensitivity、WP-0 T2 COI）就緒；敲定 ring buffer 容量/欄位/CSV 結構（OQ-7.1~7.4）。

## Steps
- [x] 確認 WP-4/5 產生 t_visible/fire/hit/firstShot/counter；sim tick 有 recorder 掛點。
- [x] 確認 WP-0 `createRenderer().backend` seam + WP-1 sensitivity getter + `crossOriginIsolated` 可讀。
- [x] 鎖 OQ-7.1：arena 容量 = `maxDrillSeconds`×simHz + 餘裕、**非環狀**、超量升 `recorderOverflow`（不覆寫）。
- [x] 鎖 OQ-7.2：tick 欄位 `{t,vx,vz,crosshair,keys}`（附錄 C）。
- [x] 鎖 OQ-7.3：JSON 主 + ticks.csv/events.csv。
- [x] 鎖 OQ-7.4：記錄重用、匯出一次性序列化。
- [x] README §1 + progress.md 翻 ✅；加 dated log。

## Evidence（2026-07-02）

### 上游 gate
- WP-4 progress 宣告完成（2026-07-02）：`TargetManager.tick` 在 sim tick 內蓋 `t_visible`，F2 全綠。
- WP-5 progress 宣告完成（2026-07-02）：M2 核心玩法成立；fire/hit/firstShot/counter-strafe gate 均已上線並有 `vitest run` 99/99 + `tsc --noEmit` exit 0 證據。
- 頂層索引已標示 WP-0 / WP-4 / WP-5 完成，WP-5 達成 M2。

### 事件來源
- `src/sim/TargetManager.ts`：`tick(state, nowMs)` 對 `visible && !state.tVisible.has(id)` 寫入 `state.tVisible.set(id, nowMs)`，來源為 `SimLoop` 傳入的 sim clock `tickEndMs`。
- `src/input/InputSampler.ts`：左鍵 `mousedown` 在 pointer lock 中以 `event.timeStamp` 寫入 input ring 的 `fire` 事件；buffer overflow 已累積在 `state.inputMeta.bufferOverflow`。
- `src/loop/SimLoop.ts`：`applyInput` 的 fire 分支在 consume 串流該點 inline 計算 `firstShot`、`accurate`、`residualSpeed`，並呼叫 `raycastFromCenter` 取得 hit / targetId / part；目前以 `void` 標記保留給 WP-7 emit，T2 可直接接 `DataRecorder.recordEvent`。
- `src/sim/MovementController.ts`：反向鍵穿越 tick 寫 `state.player.stopped=true` 並 `vx=0`；fire 分支讀此狀態形成急停 / residualSpeed 事件來源。
- `src/loop/SimLoop.ts`：`simStep` 末端目前在 `MovementController.step` 與 `curr` 更新後結束；T1 可在此位置加入 `recordTick`，T2 可在 fire/t_visible/counter seam emit 事件。未見 STOP 條件。

### metadata 來源
- `src/render/createRenderer.ts`：`createRenderer(canvas)` 回傳 `{ renderer, backend }`，backend 由 renderer 實際 backend 判定，型別為 `'webgpu' | 'webgl2'`。
- `src/main.ts`：bootstrap 已取得 `backend`；目前 `void backend`，可在 T3 傳入 `collectMeta`。
- `src/ui/SettingsPanel.ts`：`SettingsPanelHandle.sensitivity` getter 為 WP-7 metadata 來源。
- `src/env/isolation.ts`：`assertIsolation()` 回傳 `{ crossOriginIsolated, timerResolutionUs }`，COI 可讀；browser 可由 T3 在匯出時讀 `navigator.userAgent` / `navigator.userAgentData`。
- `src/loop/constants.ts`：`SIM_HZ = 128`；displayHz 待 T3 以 runtime measurement / fallback args 收集。

### tooling note
- 已讀 `graphify-out/wiki/index.md`（不存在時讀 `graphify-out/GRAPH_REPORT.md`）並執行 `graphify query "WP-7 T0 data recorder event sources metadata backend sensitivity crossOriginIsolated simStep"`；圖譜指向 `simStep()`、WP-7 T1/T2/T3、`createRenderer` metadata seam。
- GitNexus MCP `query` 回報 `No indexed repositories. Run: gitnexus analyze`，與 AGENTS.md 的索引宣告不一致；本 T0 為 docs-only、未修改 production symbol，故無 code-symbol impact 可執行。提交前仍會嘗試 `detect_changes()` 並記錄結果。

## Definition of Done
- **PASS 條件**：事件 + metadata 來源齊備；否則 STOP（缺源無法完整記錄）。→ ✅ PASS
- OQ-7.1~7.4 翻 ✅。→ ✅ DONE

## Commit
`docs(wp-7): T0 entry gate — 確認事件/metadata 來源 + 鎖 OQ-7.1~7.4`
