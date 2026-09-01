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

### 2026-09-01 — T2a KI-016 fix（session family allowlist single-source）

- 落地 [KI-016](../../../known_issue/KI-016-session-plan-family-order-validator-stale-allowlist.md) §3 修復計畫：`src/session/sessionSchedule.ts` 新增匯出 `KNOWN_SESSION_FAMILY_IDS`（`TEST_FAMILY_IDS ∪ TRANSFER_PILOT_FAMILY_IDS`）；`SessionRunner.ts` 刪除本地重複定義改為 import；`src/data/metadata.ts` 的 `requireSessionPlanFamilyOrder` 改用同一份允許清單，不再寫死 `TEST_FAMILY_IDS`。
- 新增回歸測試（`metadata.test.ts`）：`sessionPlanFamilyOrder` 含 `'peek-click-transfer'` 時 `buildMetadata()` 不再 throw；既有四家族正向/負向 case 零修改全綠。
- `SessionRunner.test.ts`/`sessionPlanPresets.test.ts`/`sessionSchedule.test.ts` 既有行為零修改全綠。
- 已同步更新 [KI-016](../../../known_issue/KI-016-session-plan-family-order-validator-stale-allowlist.md) 狀態頭與 DoD、[BUGFIX-DECISIONS.md](../../../known_issue/BUGFIX-DECISIONS.md) BD-016。
- T2 尚未完成：`SessionPlanSetup` preset 選擇 UI 與 `main.ts` 的 `sessionPlanPreset` 匯出接線（KI-016 診斷中標記的「preset 切換開放給操作端 UI」本體功能）留待 T2b。

### 2026-09-01 — T2b 發現並解決跨 WP 決策矛盾：preset 下拉 vs. WP-43 FR-H3 自由選擇

- 依 WP-52 README/task-checklist 字面著手在 `SessionPlanSetup.ts` 加回具名 preset `<select>`（呼應 GD-26 記載的 FR-G9② 缺口）時，讀 `tests/e2e/session-orchestrator.spec.ts` 才發現 WP-43（stage8，T2/T-exit 完成於 2026-08-26，與 GD-26 記錄同一天）已用 FR-H3 把 preset 下拉**整個移除**，改成自由 checkbox 家族子集 + 自由休息秒數輸入，且該 E2E 明確斷言 `select[name="sessionPlanPreset"]` count 為 0。GD-26 與 WP-43 FR-H3 是同批時間互相矛盾、從未對帳的兩份決策記錄。
- 已 revert 當下未 commit 的 preset `<select>` 重寫（`SessionPlanSetup.ts`/`.test.ts`/`main.ts`），改用 `AskUserQuestion` 請使用者拍板方向，而非自行選一邊蓋過去。
- 使用者拍板：**保留 WP-43 自由選擇設計，只擴充家族清單**——`SessionPlanSetup.ts` 的 `families` 型別從 `TestFamilyId` 放寬為 `SessionFamilyId`；`main.ts` 傳入的家族清單改為 `[...KNOWN_SESSION_FAMILY_IDS]`（KI-016 T2a 同一份單一來源允許清單），從 4 個擴充為 5 個（新增 `'peek-click-transfer'`）。不重新引入 preset 下拉，不寫入 `sessionPlanPreset` 匯出欄位（`SESSION_PLAN_PRESETS`/`findSessionPlanPreset` 維持原樣，非本次範圍）。
- 已將此矛盾與解法記入全域 [DECISIONS.md](../../../DECISIONS.md) GD-26（移至 §3 已解決，2026-09-01）。
- 落地：`SessionPlanSetup.ts`/`.test.ts` 型別放寬 + 新增「自由勾選含 peek-click-transfer」regression test；`main.ts` 改用 `KNOWN_SESSION_FAMILY_IDS`；`tests/e2e/session-orchestrator.spec.ts` 既有 DOM 接線測試改為斷言 5 個 checkbox，並新增一個「只勾 peek-click-transfer → 走到 eligibility gate」的 WP-52 T2 專屬 E2E case（Playwright edge channel 全綠，4/4）。
- v1/v2 pilot config 與既有 4 家族流程零回歸：focused unit suite（見 Verification log）與 Playwright `session-orchestrator.spec.ts` 皆全綠。

## Decision log

| ID | 決策 | 理由 | 狀態 |
|---|---|---|---|
| D-52.1 | 新增 `peek_click_transfer_pilot_v2`，不原地改 `peek-click-transfer-pilot-v1` | 保留 WP-45 pilot-ready evidence 與舊資料語意 | Confirmed，T0 v1 guard 驗證零修改 |
| D-52.2 | Pilot v2 仍是 `mode:'practice'` | 調整階段尚未完成 formal freeze，不應進 Assessment history | Proposed |
| D-52.3 | Session wiring 必須同步修 KI-016/GD-26 | transfer family 一旦進 UI，metadata allowlist 會成為阻塞 bug | Confirmed，T0 blast radius 證實 gap 仍在，範圍收斂為 KI-016 §3 方案 |
| D-52.4 | OQ-52-1：pilot v2 保留 `[1.5, 2, 3]` deg 三候選，沿用 v1 `PEEK_CLICK_ANGULAR_SIZE_CANDIDATES_DEG` 常數集合，不窄化為單一候選 | T0 尚無真人 pilot evidence 可支持窄化；README 預設本就是「保留候選集合，T0 用 evidence 拍板」，而 evidence 蒐集正是 WP-52 本身的目的，不能倒果為因 | Confirmed，T1 直接沿用同一候選集合 |
| D-52.5 | OQ-52-2：pilot v2 維持 spawn-anchored `peekTimeoutMs`/`countdownMs` 3000 ms，不改 split timeout | 同上，T0 無明確 evidence 支持變更；v1 現行 3000 ms 已是 WP-45 拍板值，變更門檻應由 pilot 資料而非臆測驅動 | Confirmed，T1 timing 沿用 v1 數值 |
| D-52.6 | OQ-52-3：pilot v2 不新增獨立 warmup drill，沿用 WP-45 D-45.16（`resolveWarmupDrillId` 對 `'peek-click-transfer'` 落既有 `else` 分支回 `unavailable`） | T3 只交付單一 pilot drill，未建熱身 config；WP-43 UI contract 未定義此家族熱身入口，現在新增屬臆造未定案設計，與 D-45.14/D-45.16 一致的立場 | Confirmed，T2 沿用現行 `resolveWarmupDrillId` 行為，不修改該函式 |
| D-52.7 | T2 不重新引入 preset `<select>`；`SessionPlanSetup` 改為放寬 `families` 型別至 `SessionFamilyId`，`main.ts` 傳入 `[...KNOWN_SESSION_FAMILY_IDS]`（5 家族），沿用 WP-43 FR-H3 的自由 checkbox 設計 | WP-43（stage8）已用 FR-H3 移除 preset 下拉並有 E2E 鎖定（`session-orchestrator.spec.ts` 斷言 count 0）；WP-52 task-checklist 字面假設的「preset 選擇」與此矛盾，使用者拍板保留已交付/已測試設計而非回退；詳見全域 [DECISIONS.md](../../../DECISIONS.md) GD-26（2026-09-01 已解決） | Confirmed，使用者 2026-09-01 拍板 |

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
| 2026-09-01 | `npx vitest run src/session/sessionSchedule.test.ts src/session/SessionRunner.test.ts src/session/SessionRunnerPoll.test.ts src/data/metadata.test.ts src/session/sessionPlanPresets.test.ts` | 5 files / 81 tests passed（T2a KI-016 fix） |
| 2026-09-01 | `npx tsc --noEmit`（T2a 後） | exit 0（全專案） |
| 2026-09-01 | `npx vitest run src/ui/SessionPlanSetup.test.ts src/session/sessionSchedule.test.ts src/session/SessionRunner.test.ts src/session/SessionRunnerPoll.test.ts src/data/metadata.test.ts src/session/sessionPlanPresets.test.ts src/drill/peek_click_transfer_pilot_v1.test.ts src/drill/peek_click_transfer_pilot_v2.test.ts src/pilot/pilotConfigs.test.ts` | 9 files / 115 tests passed（T2b 家族清單擴充後） |
| 2026-09-01 | `npx tsc --noEmit`（T2b 後） | exit 0（全專案） |
| 2026-09-01 | `npx playwright test tests/e2e/session-orchestrator.spec.ts`（edge channel） | 4/4 passed（含新增 WP-52 T2 transfer-family case） |
