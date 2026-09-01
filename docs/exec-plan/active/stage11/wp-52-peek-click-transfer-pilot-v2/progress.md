# WP-52 — progress / decision log

## Status

- **Current**：🟡 規劃完成，尚未開工。
- **Scope state**：新增 `peek_click_transfer_pilot_v2` 作為調整後 pilot；不修改 `peek-click-transfer-pilot-v1` 的既有語意。
- **Dependency state**：依賴 WP-45 T-exit；T2 會處理 GD-26/KI-016 造成的 session wiring 阻塞。

## Progress

### 2026-08-28 — Planning

- 依 stage11 方向建立 WP-52 自足 spec。
- 明確將 pilot 調整與 formal release 分離，避免同一 drill id 混用不同協定。
- 本次只新增文件，未修改 production code。

### 2026-09-01 — T0 Entry gate／v1 audit／parameter candidates

- HEAD `d142baf`；`git status --short` 於稽核當下僅有 stage10/graphify-out 既存未 commit 變更與 stage11 WP-54 相關新檔，與 WP-52 無關，未觸碰。
- CodeGraph blast radius（`codegraph_explore`）：
  - `buildPeekClickTransferPilotConfig`（v1）：5 callers，僅限 `peek_click_transfer_pilot_v1.ts` 自身與 `src/pilot/pilotConfigs.ts`；`derivePeekClickTransferMetrics`：1 caller，對 `ExportPayload` 泛型運作、不綁 drill id，T3 evidence harness 可直接重用不必改動。
  - Session wiring 缺口與 [KI-016](../../../known_issue/KI-016-session-plan-family-order-validator-stale-allowlist.md) 診斷一致：`src/data/metadata.ts:346` `requireSessionPlanFamilyOrder` 仍寫死 `TEST_FAMILY_IDS`（4 家族），未含 `TRANSFER_PILOT_FAMILY_IDS` 的 `'peek-click-transfer'`；`SessionRunner.ts` 自己有一份 `KNOWN_SESSION_FAMILY_IDS` 聯集，與 metadata 那份是兩個獨立定義。`src/session/sessionPlanPresets.ts` 已存在 `SESSION_PLAN_PRESET_TRANSFER_PILOT_V1`（WP-45 T5 留下），但 `main.ts:360-361` 的 `createSessionPlanSetup({ families: TEST_FAMILY_IDS })` 從未接上這個 preset 或 `SessionPlanSetup` 的 preset 選擇——T2 範圍精確對應 KI-016 §3 修復計畫（單一來源允許清單）＋把既有 preset 接進 `SessionPlanSetup`/`main.ts`。
  - Baseline focused suite（`npx vitest run` 8 個 v1/metrics/session/metadata 相關檔）：**8 files / 111 tests 全綠**，記於 Verification log。
- v1 guard：本次 T0 未修改 `src/drill/peek_click_transfer_pilot_v1.ts`／`.test.ts` 任一行；v1 baseline 測試（12 tests）零修改全綠。T1 起一律新增獨立 `peek_click_transfer_pilot_v2.ts`／`.test.ts`，不原地改 v1 檔案、不重用 v1 的 `buildPeekClickTransferPilotConfig`（避免候選型別耦合），與 D-52.1 一致。
- OQ-52-1/2/3 拍板（見下方 Decision log D-52.4/5/6）；OQ-52-4 維持 T4 owner 不變。
- 本次只更新文件（progress/task-checklist/stage11 progress），未修改 production code。

### 2026-09-01 — T1 Pilot v2 config and contracts

- 新增 `src/drill/peek_click_transfer_pilot_v2.ts`（+ `.test.ts`）：獨立模組，具名常數（`PEEK_CLICK_TRANSFER_PILOT_V2_DISTANCE_U`／`_ANGULAR_SIZE_CANDIDATES_DEG`／`_TARGET_COUNT`／`_TIMING`／`_VISIBILITY`／`_CLEARANCE_OPTIONS`／`_SEED_BASE`），數值與 v1 相同（D-52.4/5/6），但 id/seed 範圍（`peek_click_transfer_pilot_v2_*`、seed base 95000）與 v1（94000 系）不重疊，兩個 evidence cohort 可稽核區分（D-52.1）。`angularSizeToHitboxWidthU` 從 v1 檔案 import 重用（純函式、無狀態，不構成對 v1 的修改風險）。
- `buildPeekClickTransferPilotV2Config(angularSizeDeg)` 回傳含 `candidateLabel`（如 `'2°'`）的 config，供 T2 UI 只消費具名候選（FR-52-3）。
- `src/pilot/pilotConfigs.ts` 新增 `buildPeekClickTransferPilotV2Configs`，鏡射既有 `buildPeekClickTransferPilotConfigs` 慣例；`pilotConfigs.test.ts` 納入 v2 candidates 進 `allConfigs()` 與獨立 preserves-candidate 斷言。
- 新測試涵蓋：candidate 集合等同 v1、hitbox 幾何公式、id/seed 唯一且不與 v1 碰撞、practice/scene/cue/timing/visibility contract、strict/pilot clearance（scene geometry compatibility）、researcher-mode 預設、60/120/240 Hz tick/event-identical determinism（NFR-52-1）。
- v1 guard 持續有效：本次未修改 `peek_click_transfer_pilot_v1.ts`／`.test.ts` 任何一行；只從中 import 既有 export。
- Verification：見下方 Verification log；`npx tsc --noEmit` 全專案 exit 0；`graphify update .` 已執行（3826 nodes / 8993 edges / 240 communities）。

## Decision log

| ID | 決策 | 理由 | 狀態 |
|---|---|---|---|
| D-52.1 | 新增 `peek_click_transfer_pilot_v2`，不原地改 `peek-click-transfer-pilot-v1` | 保留 WP-45 pilot-ready evidence 與舊資料語意 | Confirmed，T0 v1 guard 驗證零修改 |
| D-52.2 | Pilot v2 仍是 `mode:'practice'` | 調整階段尚未完成 formal freeze，不應進 Assessment history | Proposed |
| D-52.3 | Session wiring 必須同步修 KI-016/GD-26 | transfer family 一旦進 UI，metadata allowlist 會成為阻塞 bug | Confirmed，T0 blast radius 證實 gap 仍在，範圍收斂為 KI-016 §3 方案 |
| D-52.4 | OQ-52-1：pilot v2 保留 `[1.5, 2, 3]` deg 三候選，沿用 v1 `PEEK_CLICK_ANGULAR_SIZE_CANDIDATES_DEG` 常數集合，不窄化為單一候選 | T0 尚無真人 pilot evidence 可支持窄化；README 預設本就是「保留候選集合，T0 用 evidence 拍板」，而 evidence 蒐集正是 WP-52 本身的目的，不能倒果為因 | Confirmed，T1 直接沿用同一候選集合 |
| D-52.5 | OQ-52-2：pilot v2 維持 spawn-anchored `peekTimeoutMs`/`countdownMs` 3000 ms，不改 split timeout | 同上，T0 無明確 evidence 支持變更；v1 現行 3000 ms 已是 WP-45 拍板值，變更門檻應由 pilot 資料而非臆測驅動 | Confirmed，T1 timing 沿用 v1 數值 |
| D-52.6 | OQ-52-3：pilot v2 不新增獨立 warmup drill，沿用 WP-45 D-45.16（`resolveWarmupDrillId` 對 `'peek-click-transfer'` 落既有 `else` 分支回 `unavailable`） | T3 只交付單一 pilot drill，未建熱身 config；WP-43 UI contract 未定義此家族熱身入口，現在新增屬臆造未定案設計，與 D-45.14/D-45.16 一致的立場 | Confirmed，T2 沿用現行 `resolveWarmupDrillId` 行為，不修改該函式 |

## Open Questions

| ID | 問題 | Owner | Deadline | Impact |
|---|---|---|---|---|
| OQ-52-1 | target angular size policy | 使用者 + 研究者 | T0 | ✅ Resolved（D-52.4） |
| OQ-52-2 | timeout policy | 使用者 + 研究者 | T0 | ✅ Resolved（D-52.5） |
| OQ-52-3 | transfer warmup policy | 使用者 | T0 | ✅ Resolved（D-52.6） |
| OQ-52-4 | formal go/no-go evidence threshold | 研究者 | T4 | WP-53 T0 |

## Verification log

| Date | Command | Result |
|---|---|---|
| 2026-08-28 | Planning-only | No production verification run |
| 2026-09-01 | `npx vitest run src/drill/peek_click_transfer_pilot_v1.test.ts src/metrics/peekClickTransferMetrics.test.ts src/session/sessionSchedule.test.ts src/session/SessionRunner.test.ts src/data/metadata.test.ts src/session/sessionPlanPresets.test.ts src/ui/SessionPlanSetup.test.ts src/pilot/pilotConfigs.test.ts` | 8 files / 111 tests passed（T0 baseline，HEAD `d142baf`） |
| 2026-09-01 | `npx vitest run src/drill/peek_click_transfer_pilot_v2.test.ts src/drill/peek_click_transfer_pilot_v1.test.ts src/pilot/pilotConfigs.test.ts` | 3 files / 25 tests passed（T1，v1 零修改全綠） |
| 2026-09-01 | `npx tsc --noEmit` | exit 0（全專案） |
| 2026-09-01 | `graphify update .` | 3826 nodes / 8993 edges / 240 communities rebuilt |
