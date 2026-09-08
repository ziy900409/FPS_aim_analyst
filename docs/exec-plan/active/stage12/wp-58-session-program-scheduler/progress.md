# WP-58 — progress.md

> Running log。Tech spec：[README.md](README.md) · Checklist：[task-checklist.md](task-checklist.md)

## Progress

- **2026-09-07**：依 brainstorming 對話收斂需求，並以 engineering-planning skill 完成 repository-grounded 規劃。盤點 `SessionRunner`／`sessionSchedule`／`sessionPlanPresets`／`SessionPlanSetup`／`RestOverlay`／`metadata` 與 `main.ts` 的 Session Plan 全鏈路；尚未修改 production code。
- **2026-09-07**：確認四個需求缺口——`resolveFamilyDrillId()` 把 family 硬編碼 1:1 對到單一 drill、`requireFamilyOrder()` 明文禁止重複、`restDurationMs` 為單一模組級變數、無任何 rep 概念。決定採「先編譯成 `ProgramStep[]`、Runner 退化成游標」的架構。
- **2026-09-07**：工作拆為 T0～T6 + T-exit。WP 編號一度暫用 WP-57／GD-32，但同日另一個平行 session 的 [WP-57 — Spider Shot Wide Flick](../wp-57-spider-shot-wide-flick/README.md) 先建立資料夾並認領同一組編號；依 GD-15「先採納先得」本計畫順延重編為 **WP-58**，全域決策待以 ~~GD-33~~ **GD-35** 入帳（`GD-33`／`GD-34` 已於 2026-09-07 分別由 WP-57 T3 與 KI-026 取用，見 §T0 §9）。WP-56（進行中的 micro-flick 場景 WP）不受影響。
- **2026-09-08**：**T0 完成**。baseline 全綠（typecheck exit 0；Vitest 2,442 passed／2 skipped）、CodeGraph impact 已對帳 README §0.1（發現 2 處需更正）、36 個 exact drillId 的歸屬表已凍結、OQ-58.1／58.2／58.4 已由使用者收斂、GD-35 已入帳、production diff = 0。詳見 §T0。
- **2026-09-08**：**T1 完成**。新增 `src/session/drillFamily.ts`（drill ↔ family 雙向單一來源，36 個 drill／10 個家族）、`sessionSchedule.ts` 純加法納入 4 個新家族 id、`SessionRunner.ts` 移除全部 7 個 drill import。四條不變量 + 解耦負向矩陣共 **49 個新測試**全綠；全量 Vitest **2,491 passed／2 skipped**（= baseline 2,442 + 49，既有測試零失敗）；typecheck / build exit 0；更新後的 Session Plan e2e 於真實 Edge 通過。詳見 §T1。
- **2026-09-08**：**T2 完成**。新增 `src/session/sessionProgram.ts`（`compileSessionProgram()` 純函式編譯器 + `summarizeProgram()` + typed `SessionProgramCompileError`）與 47 個測試。全量 Vitest **2,538 passed／2 skipped**（= T1 的 2,491 + 47，既有測試零失敗）；typecheck / build exit 0；400 run steps 編譯 P95 **0.0398 ms**（限額 1 ms）。production 接線為零——T2 只交付可獨立測試的純函式。詳見 §T2。
- **2026-09-08**：**T3 完成**。`SessionRunner` 由家族狀態機改為 `ProgramStep[]` 上的游標；新增 `buildFrozenSessionPlan()` 讓 frozen 路徑走同一個編譯器與同一個 runtime；模組級 `restDurationMs` 移除，兩級休息各自由 step 攜帶；`main.ts` 完成分支鏈四路收斂為三路。全量 Vitest **2,570 passed／2 skipped**（= T2 的 2,538 + 32，既有測試零失敗）；typecheck／build exit 0；Session Plan e2e 於真實 Edge 通過。詳見 §T3。

- **2026-09-08**：**T4 完成**。`SessionPlanSetup` 新增「自訂 program」軌：drill 清單（依家族分組的 36 項選單）、每項 reps、兩級休息秒數，並在提交前顯示由 `compileSessionProgram()` 產出的逐步驟預覽表；`RestOverlay` 改帶邊界標籤與下一個 drill（OQ-58.3）。frozen 軌的 DOM、訊息與提交負載逐位不變（`mode:'frozen'` 為新增欄位）。新增 **25 個測試**；全量 Vitest **2,595 passed／2 skipped**（= T3 的 2,570 + 25，既有測試零失敗）；typecheck／build exit 0；`session-orchestrator.spec.ts` **8 條零修改**於真實 Edge 全綠。詳見 §T4。

- **2026-09-08**：**T5 完成**。匯出 metadata 新增 5 個 additive optional 欄位記錄實際執行的 program（`sessionPlanMode`／`sessionPlanItems`／`sessionPlanDrillRestSeconds`／`sessionPlanItemIndex`／`sessionPlanRepIndex`），寫入端對 `FAMILY_BY_DRILL_ID` 嚴驗、讀取端只驗形狀；`sessionPlanMode==='custom'` 的 run 由 `DrillMetricRegistry.project()` 以新的 `excluded-cohort` status 排除於 frozen trend cohort （history 保存不受影響，OQ-58.4）。frozen 軌匯出**逐位不變**（不寫 `sessionPlanMode`，D-58-T5-1）。8 個既有 fixture 的 canonical JSON digest 逐位相同；`research/` ingest 零修改相容。新增 **66 個測試**；全量 Vitest **2,661 passed／2 skipped**；typecheck／build exit 0；`session-orchestrator.spec.ts` **8 條零修改**全綠。詳見 §T5。

## Decision Log

- **D-58-P1 / 次數語意**：「設定 drill 次數」= **reps（重複跑 N 輪）**，不是修改 drill 內的 `endCondition.value`。排程層永不寫 drill 參數，`protocolVersion 1.0.0` 與跨 session 可比性不受影響。
- **D-58-P2 / 資料模型**：plan 為**扁平**的 `(drillId, reps)` 有序清單；家族由 `drillId` 推導，不採兩層「家族包含多個 drill」結構。
- **D-58-P3 / drill 範圍**：`availableDrills` **全部開放**排程，每個 drill 在單一來源對照表中宣告家族；表外 drill 不可排程（不給 fallback 家族）。
- **D-58-P4 / 雙軌**：保留 frozen「標準 Assessment」一鍵路徑逐位不變；自由清單另走一條並標 `sessionPlanMode='custom'`，兩軌共用同一 runtime，差別只在誰產生 program。
- **D-58-P5 / 休息邊界**：兩個全域值。`rep↔rep` 與 `drill↔drill` 皆吃 `drillRestSeconds`；只有 `family↔family` 吃 `familyRestSeconds`。使用者情境的 60 秒因此要求 A／B／C **各屬不同家族**；同家族相鄰 drill 拿 30 秒是模型定義，由預覽表使其可見。
- **D-58-P6 / 架構**：採「編譯成扁平 step 清單 + Runner 游標化」。三種邊界、reps 展開、家族推導與「結尾不補休息」全部在編譯期以純函式決定，而非留給狀態機臨場前瞻判斷。
- **D-58-P7 / 熱身**：自訂路徑**取消** `includeWarmup`——熱身即清單第一項。frozen 路徑保留原行為。
- **D-58-P8 / 解耦**：家族歸屬**不授予** Assessment 資格。`micro_flick_three_target_test_v1.test.ts:228` 的負向測試意圖（practice-only drill 不進 Participant/Assessment session）以顯式解耦不變量延續，而非靠「不在 allowlist 裡」這個副作用。

## Surprises

- **2026-09-07**：`sessionPlanPresets.ts` 的 `perFamilyTrialShape` 原始碼註解明示「刻意引用 drill config 而非另存一份 trial 數」。本 WP 的 reps 語意與這條既有紀律天然相容——這不是巧合，而是同一個「排程層不得成為 drill 參數第二來源」原則的兩次體現。
- **2026-09-07**：`TrackingPilotRunner` + `trackingPilotManifest` 的 `orderedBlocks[] + restSeconds` 已經是「先算成陣列、runner 只跑陣列」的既有前例。本 WP 等於把同一模式套回主 Session Plan；未來兩者的型別有收斂機會（記為 handoff，不在本 WP 範圍）。
- **2026-09-07**：`main.ts` 的 drill 完成分支已是 pilot／warmup／family／protocol 四路 if-else。游標化把 warmup 併入 run 之後，這條鏈反而**變短**為三路——這是本重構的附帶收益，不是代價。

## Open Questions（狀態）

- **OQ-58.1**：同一 drill 連跑 N 輪的 seed 應逐輪相同或變化。✅ **已收斂（使用者，2026-09-08）：逐輪相同，維持現況**（**未**採規劃時建議的「逐輪變化」）。**T3 已落地**：drill 載入路徑零改動，並補上三次連續 rep 的逐位一致回歸測試（§T3 §6）。代價是 reps = 重複同一組刺激、存在練習效應，分析端不得視為 i.i.d. 取樣。證據與限制見 §T0 §5。
- **OQ-58.2**：三輪匯出的檔名唯一性。✅ **已收斂（使用者，2026-09-08）：不加 rep 序號**。`exportBasename` 已含每次 `activateDrill()` 重設的毫秒級 `startedAt`，實測三輪唯一；T5 只補唯一性回歸測試，不改格式。證據見 §T0 §4。 **T5 已落地**：`exportBasename` 零修改，回歸測試釘死「5 個 run step → 5 個唯一檔名」並反向明寫同毫秒撞名的已知邊界（§T5 §4b）。
- **OQ-58.3**：休息 overlay 是否顯示邊界種類與下一個 drill。✅ **T4 依規劃建議的預設值落地（要，2026-09-08）**：`show(remainingMs, detail?)` 新增 optional `{ boundary, nextDrillId }`，兩個值皆直接取自編譯後的 `RestStep`，因此 overlay 與預覽表**不可能不一致**（共用 `programBoundaryLabel.ts` 單一詞彙表）。省略 detail 時逐位回到 WP-58 之前的兩行倒數。
- **OQ-58.4**：`custom` session 是否可進 history。✅ **已收斂（使用者，2026-09-08）：沿用既有兩道閘（`DrillConfig.mode` + exact-id registry），額外標記 `sessionPlanMode`**，**不**在 `HistoryPersistence` 新增第三道攔截；隔離落在 T5 的 trend cohort 判定層。證據見 §T0 §6。**T5 已落地**：`DrillMetricRegistry.project()` 對 `sessionPlanMode === 'custom'` 回 `excluded-cohort`；`HistoryPersistence` 零修改，並補一條「custom 的 assessment run 仍照常保存」正向測試。
- **OQ-58.5**：stage12 是否需要獨立里程碑（下一個可用編號 **M22**；M20／M21 已由 stage11 WP-54／WP-55 取用）。⬜ 待 stage12 範圍收斂（**非 T0 exit blocker**）。

---

## T0 — Entry gate 稽核紀錄（2026-09-08）✅

### 0. Baseline

| 項目 | 值 |
|---|---|
| HEAD | `a9a13eb4d2f9d88f75539892091a820731426a13`（`update stage 12 plan and graphify`） |
| `git status --short` | 乾淨（唯一 untracked `docs/exec-plan/active/stage13/` 屬平行 session，未觸碰） |
| `npm run typecheck` | exit 0（browser + node 兩個 tsconfig 皆綠） |
| `npx vitest run` | exit 0 — **241 passed / 1 skipped（242 files）、2,442 passed / 2 skipped（2,444 tests）** |
| baseline failure | **無**。後續 task 的任何紅燈皆不得歸因於既存問題 |
| production diff | **0**。PoC 產物 `src/session/_wp58_t0_audit.test.ts`／`_wp58_t0_poc.test.ts` 已於 T0 結束前刪除 |

### 1. CodeGraph impact（步驟 2）— 對帳 README §0.1

以 `codegraph_explore` 量測 + 逐符號 consumer 檔案掃描：

| Symbol | 實測 consumers | 分級 | 與 README §0.1 規劃值對帳 |
|---|---|---|---|
| `createSessionRunner` | `src/main.ts`（3 個 call sites）、`SessionRunner.test.ts`、`SessionRunnerPoll.test.ts` | cross-module High | ✅ 相符 |
| `SessionPlan` | `SessionRunner.ts`（2）、`SessionRunner.test.ts` | cross-module High | ✅ 相符 |
| `SessionRunnerPhase` | **僅 `SessionRunner.ts`** 具名引用；`main.ts` 以 structural `phase.kind` 比對（`:756`／`:1477`／`:1639`～`:1649`） | cross-module High | ⚠️ **README 未點出型別未被具名 import** ⇒ 改 union 不會在 `main.ts` 立刻型別錯，只會在 `.kind` 比對處靜默失配。T3 必須顯式 import 該型別以取回編譯期保護 |
| `resolveFamilyDrillId` | `SessionRunner.ts`（2）、`SessionRunner.test.ts`、`src/main.ts`（`:283` **僅註解引用**） | cross-module High | ⚠️ README §0.1 未列 `main.ts`；已確認**無 production call site**，遷入 `drillFamily.ts` 安全 |
| `KNOWN_SESSION_FAMILY_IDS` | `sessionSchedule.ts`、`SessionRunner.ts`、`src/data/metadata.ts`、`src/main.ts`、`SessionPlanSetup.test.ts`、`micro_flick_three_target_test_v1.test.ts`、`spider_shot_wide_v1.test.ts`、`tests/e2e/session-orchestrator.spec.ts` = **8 檔** | cross-module High | ✅ 相符（README 少列 `main.ts`／`spider_shot_wide_v1.test.ts`） |
| `TEST_FAMILY_IDS` | `sessionSchedule.ts`、`sessionSchedule.test.ts`、`main.ts`、`SessionPlanSetup.test.ts`、`session-orchestrator.spec.ts` = 5 檔 | cross-module | ✅ 相符（凍結四元素） |
| `buildFamilyOrder` | 1 caller、`sessionSchedule.test.ts` | local | ✅ 相符 |
| `buildFamilyOrderForRoster` | `sessionSchedule.ts`、`sessionSchedule.test.ts`、`trackingPilotManifest.ts` | local + 1 | ✅ 相符 |
| `createSessionPlanSetup` | `main.ts`、`SessionPlanSetup.test.ts` | local + 1 E2E | ✅ 相符 |
| `createRestOverlay` | `main.ts`（2 call sites）、`RestOverlay.test.ts` | local | ✅ 相符 |
| `requireSessionPlanFamilyOrder` | `src/data/metadata.ts`（唯一實際 consumer；`sessionSchedule.ts` 只在 KI-016 註解提及） | cross-module High | ✅ 相符 |

**main.ts 的 Session Plan 接縫（T3 必改點，實測行號）**：`:756-759`（metadata 注入，`phase.kind === 'family'` gate）、`:1472-1479`（runner + rest overlay 建構）、`:1481-1501`（`startSessionPlan()`）、`:1589`（`poll(now)`）、`:1639-1650`（完成分支鏈，pilot / warmup / family / protocol 四路）。

### 2. 歸屬表（步驟 3）— **T0 凍結，入帳 GD-35**

`availableDrills` 實測 **36 個 exact drillId、零重複**。Assessment 資格欄位證據取自 ① `DrillConfig.mode`（決定 `meta.assessment` 是否寫入，`main.ts:850-855`）與 ② `DrillMetricRegistry` 的 exact-id 登記（`DrillMetricRegistry.ts` 的 `REGISTRATIONS`，僅 3 筆）。

| # | exact drillId | 家族 | `mode` | registry 登記？ | history 可保存？ | 可排程？ |
|---|---|---|---|---|---|---|
| 1 | `counterstrafe_ad_v1` | `counterstrafe` | practice（省略） | 否 | 否（無 `meta.assessment`） | 是 |
| 2 | `detection_popin_v1` | **`detection`**（新） | practice（省略） | 否 | 否 | 是 |
| 3 | `tracking_v1` | **`tracking`**（新） | practice（省略） | 否 | 否 | 是 |
| 4 | `tracking_scene_v1` | **`tracking`** | practice（省略） | 否 | 否 | 是 |
| 5 | `tracking_longrange_v1` | **`tracking`** | practice（省略） | 否 | 否 | 是 |
| 6 | `hold_click_v1` | `hold-click` | **assessment** | 否 | 是（存 history，但 registry 未登記 ⇒ `unregistered-drill`，不入 trend） | 是 |
| 7 | `hold_track_v1` | `hold-track` | **assessment** | 否 | 是（同上） | 是 |
| 8 | `spider-shot-v1` | `spider-shot` | **assessment** | 否 | 是（同上） | 是 |
| 9 | `spider-shot-v2` | `spider-shot` | **assessment** | **是** | 是（入 trend cohort） | 是 |
| 10 | `spider-shot-v3` | `spider-shot` | **assessment** | **是** | 是（入 trend cohort） | 是 |
| 11 | `spider-shot-wide-v1` | **`spider-shot-wide`**（新） | practice | 否 | 否 | 是（arm-time resolved） |
| 12 | `counterstrafe-reversal-v1` | `counterstrafe` | **assessment** | 否 | 是（`unregistered-drill`） | 是 |
| 13 | `counterstrafe-free-v1` | `counterstrafe` | practice | 否 | 否 | 是 |
| 14 | `peek_click_transfer_pilot_v1_2deg` | `peek-click-transfer` | practice | 否 | 否 | 是 |
| 15 | `peek_click_transfer_pilot_v2_1deg` | `peek-click-transfer` | practice | 否 | 否 | 是 |
| 16 | `peek_click_transfer_pilot_v2_2_5deg` | `peek-click-transfer` | practice | 否 | 否 | 是 |
| 17 | `peek_click_transfer_pilot_v2_5deg` | `peek-click-transfer` | practice | 否 | 否 | 是 |
| 18 | `peek_click_transfer_pilot_v2_randomized` | `peek-click-transfer` | practice | 否 | 否 | 是 |
| 19 | `peek_click_transfer_pilot_v2_masked` | `peek-click-transfer` | practice | 否 | 否 | 是 |
| 20 | `peek_click_transfer_v1` | `peek-click-transfer-v1` | **assessment** | **是** | 是（入 trend cohort） | 是 |
| 21–28 | `micro_flick_three_target_test_v1` … `_v8`（8 個） | **`micro-flick`**（新） | practice（8 個皆是） | 否 | 否 | 是 |
| 29–36 | `tracking_br_v1`、`tracking_br_v1__ads_{off,on}__{hitscan,projectile}__{0p5,2}deg`（共 8 個） | **`tracking`** | practice（省略） | 否 | 否 | 是 |

**Off-roster（不可排程，非 `availableDrills` 成員）**：`counterstrafe-cued-v1`（`src/drill/counterstrafe_cued_v1.ts` 存在但未註冊）、`tracking_core_pr_pilot_v1`／`tracking_reversal_pilot_v1`（走 `loadDrillConfigDirect()`，由 `TrackingPilotRunner` 擁有）。

⇒ **新家族 id 為 4 個**（非 README 原寫的 3 個）：`tracking`／`detection`／`micro-flick`／`spider-shot-wide`。

### 3. README §2.3 規劃表的實測更正（步驟 3 的主要產出）

規劃時的 §2.3 表**多處與實況不符**，已於 T0 更正 README：

| 規劃表寫的 | 實況 | 性質 |
|---|---|---|
| `spider-shot` → `spider_shot_v1, spider_shot_v2` | exact id 是 `spider-shot-v1`／`v2`（**連字號**），且 `resolveFamilyDrillId('spider-shot')` 回的是 **`spider-shot-v3`**；roster 另有 `spider-shot-wide-v1` | 代表 drill 認錯 + id 拼法錯 |
| `counterstrafe` 含 `counterstrafe_cued_v1` | `counterstrafe-cued-v1` **不在 `availableDrills`**，不可排程 | 列了不存在的可排程項 |
| `counterstrafe_reversal_v1`／`counterstrafe_free_v1`／`counterstrafe_ad_v1` | 實際為 `counterstrafe-reversal-v1`／`counterstrafe-free-v1`（連字號）與 `counterstrafe_ad_v1`（**底線**，來自 `drills/*.json`，且是 roster 第一項／預設 drill） | id 拼法混用 |
| `peek-click-transfer` → `peek_click_transfer_pilot_v1, _v2` | v1 的 exact id 是 `peek_click_transfer_pilot_v1_2deg`；v2 有 5 個（3 個固定候選 + randomized + masked） | id 不完整 |
| `tracking` → `tracking_br_v1` 一項 | `tracking_br` 有 **8 個變體 id** | 數量錯 |
| `micro-flick` → `micro_flick_three_target_test_v1` | roster 有 **v1～v8** 全部 8 個 | 數量錯 |

> **紀律結論**：drill id 在本 repo **連字號與底線混用**（`spider-shot-v3` vs `micro_flick_three_target_test_v1`）。T1 的 `FAMILY_BY_DRILL_ID` 必須以 **drill 模組匯出的 `drillId`／`id` 常數**建表，**不得**手打字面值——否則會重現本節的六個錯誤。此為 T1 的硬性設計約束。

### 4. `exportBasename` 三輪唯一性（步驟 4）→ **OQ-58.2 收斂**

- 實作：`exportBasename(payload)` 回 `` `${meta.drillId}${condition}-${meta.startedAt}` ``（`src/results/ResultPresentation.ts:178-182`）。
- `meta.startedAt` = `recorderStartedAt`，由 `resetRunPresentation()` 在**每次** `activateDrill()`／`restartActiveDrill()` 重設為 `new Date().toISOString()`（`main.ts:1224`、`:326`）⇒ **每一 rep 都拿到新的毫秒級時間戳**。
- 實測樣本（三輪）：

```
spider-shot-v2-2026-09-08T06:41:12.104Z
spider-shot-v2-2026-09-08T06:42:33.877Z
spider-shot-v2-2026-09-08T06:43:59.002Z
```

  經 `export.ts` 的 `sanitizeFilename()`（`[^a-zA-Z0-9._-]+` → `_`）後：`spider-shot-v2-2026-09-08T06_41_12.104Z` …（冒號轉底線，唯一性不受影響）。
- 唯一性：`UNIQUE=true`。碰撞條件為**同一毫秒啟動兩次**（`SAME_MS_COLLIDES=true`）——跨一整場 drill + 休息不可能發生。
- **✅ OQ-58.2 決議（使用者，2026-09-08）：不加 rep 序號，現況已足夠。** T5 只需補一條唯一性回歸測試釘死此性質，**不改 basename 格式**（既有匯出檔名逐位不變）。

### 5. reps 的 seed 行為（步驟 5）→ **OQ-58.1 收斂**

- 讀碼：`activateDrill()` 走 `loadDrill(source, scene, opts)`，`source` 是**靜態 drill 模組常數**；`buildSimLoop()` 取 `activeDrillConfig.spiderShot?.seed ?? activeDrillConfig.sequence.seed`（`main.ts:1022`）⇒ 同一 `drillId` 的每次載入拿到**同一個 seed 常數**。
- PoC 實證（與步驟 7 同一支測試）：

```
SEEDS=[260826,260826,260826]                       // spider-shot-v2 三輪
POPIN_SEEDS=[21021,21021,21021]                    // detection_popin_v1 三輪
POPIN_FIRST_8_DISTINCT_POSES → 三輪逐位相同：
  0.7239966401139047,1.5,-3.4012409867511715
  0.786818106628821,1.5,-3.107224876113357
  0.42955745782154425,1.5,-3.28080828990762
  0.7472770744966033,1.5,-4.121082795277891
POPIN_ALL_THREE_IDENTICAL=true
```

- **✅ OQ-58.1 決議（使用者，2026-09-08）：逐輪相同，維持現況。** 不新增 seed 推導、**T3 不動 drill 載入路徑**。
- **⚠️ 已知並接受的限制（入帳 GD-35 與 §Conscious debt）**：reps 的語意因此是「**重複同一組刺激**」，而非「同一難度的多次獨立取樣」。三輪之間存在**練習效應**（受試者第二、三輪已見過同一組 spawn 位置）。分析端**不得**把同一 item 的多個 rep 當成 i.i.d. 重複取樣處理。

### 6. Assessment／history 攔截層（步驟 6）→ **OQ-58.4 收斂**

讀碼證據——資格判定與**家族完全無關**，且已有兩道獨立閘：

1. **`DrillConfig.mode === 'assessment'`** ⇒ `main.ts:850-855` 才寫 `meta.assessment`；`HistoryPersistence.save()`（`HistoryPersistence.ts:75-79`）對 `meta.assessment === undefined` 直接回 `{ kind:'excluded', reason:'practice' }`。
2. **`DrillMetricRegistry.registrationForExactDrill(drillId)`** ⇒ 僅 3 筆登記（`spider-shot-v2`／`spider-shot-v3`／`peek_click_transfer_v1`），其餘一律 `unregistered-drill`，**無 prefix／family fallback**（原始碼註解明示）；`project()` 另有 defense-in-depth 的 `not-assessment` 檢查。

⇒ **FR-58.3 的解耦在現況已成立**：新增家族 id 是 `sessionSchedule.ts` 的純加法，**不可能**經由任何路徑授予 Assessment 資格。T1 的「解耦不變量」測試是把這個**既有事實**釘死成回歸保護，而非新建行為。

- **✅ OQ-58.4 決議（使用者，2026-09-08）：沿用既有兩道閘，額外標記 `sessionPlanMode`。** **不**在 `HistoryPersistence` 新增第三道攔截。custom program 中的 assessment-mode drill 仍正常存 history；隔離改由 metadata 的 `sessionPlanMode==='custom'` 在 **trend cohort 判定**層完成（T5）。

### 7. 三次連續 restart 的 sim 起始狀態（步驟 7）

PoC 重建 `activateDrill()` 每 rep 重建的整條物件圖（`loadDrill` → `createSharedState` → `createTargetManager` → `createDrillRunner` → `createDataRecorder` → `createSimLoop`），跑固定 tick 序列後比對 `DataRecorder` snapshot：

| 量測 | spider-shot-v2（400 ticks） | detection_popin_v1（2000 ticks ≈ 15.6 s） |
|---|---|---|
| 起始 `{px,pz,vx,vz}` | `{0,0,0,0}` ×3，逐位相同 | 同左 |
| `visible` 事件數 | `[1,1,1]` | `[4,4,4]` |
| snapshot 三輪 `toEqual` | ✅ 通過 | ✅ 通過（另 `JSON.stringify` 全等 = `true`） |

⇒ **無殘留 velocity／recoil／arena 狀態**。reps 走既有 restart 語意即可，T3 不需為 rep 邊界新增重置邏輯。

### 8. WP-56 不受影響之確認

`micro_flick_three_target_test_v1.test.ts:228-237` 的負向測試斷言的是 **drill id** 不在 `KNOWN_SESSION_FAMILY_IDS`／`DrillMetricRegistry`／Assessment 儲存路徑。新增**家族 id** `'micro-flick'` 與 drill id `'micro_flick_three_target_test_v1'` 是不同字串 ⇒ 該測試**零修改仍綠**。其保護意圖由 T1 的解耦不變量正向承接（§6）。WP-56 的場景本體不在本 WP 範圍。

### 9. GD-35 入帳（步驟 8）

⚠️ **編號更正**：T0 計畫書寫的 `GD-33` **已被 WP-57 T3 取用**（`validateClearance()` props-only 分工），`GD-34` 亦已由 KI-026 取用。依 GD-15「先採納先得」，本 WP 的全域決策編為 **GD-35**，已寫入 [DECISIONS.md](../../../DECISIONS.md)。

### T0 Decision Log 補記

- **D-58-T0-1 / 家族數**：新家族由 3 個增為 **4 個**（加 `spider-shot-wide`）。理由：WP-57 明示 wide 是 spider-shot 的 *sibling construct*（~40–70° vs ~10–25°），併入同一家族會讓兩個不同構念之間只拿到 drill 休息（30s）而非家族休息（60s），與 D-58-P5 的休息語意衝突。
- **D-58-T0-2 / 建表方式**：`FAMILY_BY_DRILL_ID` 必須引用 drill 模組匯出的 id 常數，禁止手打字面值（§3 的六個規劃錯誤即為證據）。
- **D-58-T0-3 / reps 語意降級**：OQ-58.1 採「逐輪相同」後，reps 不再是獨立取樣。T5 的 metadata 與 `docs/operational/` 分析契約必須明寫此限制，避免分析端誤用（C-D3 教練報告紅線的延伸）。
- **D-58-T0-4 / `SessionRunnerPhase` 未被具名 import**：T3 改 union 前必須先讓 `main.ts` 顯式 import 該型別，否則 `phase.kind` 的 structural 比對會靜默失配而非編譯期報錯。

### T0 Surprises

- **Assessment 解耦不是要新建，而是已經成立**。規劃時 FR-58.3 被寫成「必須建立解耦」，實測發現兩道閘（`DrillConfig.mode` 與 exact-id registry）本來就與家族正交。T1 的工作因此從「建立解耦」降級為「把既有解耦釘死成回歸測試」——範圍縮小，但測試的必要性不變（防止未來有人加 family fallback）。
- **規劃期的 drill id 表六處錯誤**，全部源自「憑記憶寫 id」而非「讀 roster」。這正是 T0 entry gate 存在的理由：若直接開 T1，`FAMILY_BY_DRILL_ID` 會建出一張查不到任何 drill 的表，且 §2.3 不變量 2（`∀ id ∈ FAMILY_BY_DRILL_ID.keys() : id ∈ availableDrills`）會在 T1 才紅燈。
- **roster 比規劃想像大得多**：36 個 drill，其中 `micro-flick` 8 個、`tracking_br` 8 個、`peek-click-transfer` pilot 6 個。T4 的下拉選單直接列 36 項會很難用——已記入 §Conscious debt（本 WP 不做分組／搜尋，但表單需按家族分組顯示）。

---

## T1 — Drill ↔ Family 雙向單一來源（2026-09-08）✅

### 1. 交付物

| 檔案 | 動作 | 內容 |
|---|---|---|
| `src/session/drillFamily.ts` | **新增** | `FAMILY_BY_DRILL_ID`（36 → 10 家族）、`SCHEDULABLE_DRILL_IDS`（依家族分組排序）、遷入的 `resolveFamilyDrillId()` 與 `resolveWarmupDrillId()` |
| `src/session/drillFamily.test.ts` | **新增** | README §2.3 四條不變量 + FR-58.2 加法性 + FR-58.3 解耦負向矩陣，**49 tests** |
| `src/session/sessionSchedule.ts` | 加法 | `SCHEDULABLE_FAMILY_IDS`（4 個）+ `SchedulableFamilyId` 併入 `SessionFamilyId` 與 `KNOWN_SESSION_FAMILY_IDS` |
| `src/session/SessionRunner.ts` | 減法 | 刪除 7 個 drill import 與兩支 resolver 主體；改 re-export `drillFamily.ts`，公開介面逐位不變 |
| `src/ui/SessionPlanSetup.test.ts` | 對帳 | 預期家族清單 6 → 10（consequence，非行為改動） |
| `tests/e2e/session-orchestrator.spec.ts` | 對帳 | 家族 checkbox 數 6 → 10 |

### 2. 實測契約

- `FAMILY_BY_DRILL_ID.size === 36`，零重複（建表函式對重複 drill id 直接 throw）。
- 家族分佈：`tracking` 11、`micro-flick` 8、`peek-click-transfer` 6、`spider-shot` 3、`counterstrafe` 3、`hold-click`／`hold-track`／`spider-shot-wide`／`peek-click-transfer-v1`／`detection` 各 1 —— 與 T0 §2 凍結表逐項相符。
- `KNOWN_SESSION_FAMILY_IDS` 6 → **10**；`TEST_FAMILY_IDS`／`TRANSFER_PILOT_FAMILY_IDS`／`TRANSFER_FORMAL_FAMILY_IDS` 內容與順序逐位不變，`buildFamilyOrder()` 四個 sessionIndex 的輪轉集合仍恰為 `TEST_FAMILY_IDS`。
- 新家族代表 drill（T1 決定，納入不變量 1）：`tracking` → `tracking_v1`、`detection` → `detection_popin_v1`、`micro-flick` → `micro_flick_three_target_test_v1`、`spider-shot-wide` → `spider-shot-wide-v1`。六個既有家族的回傳值逐位不變（含 `spider-shot` → `spider-shot-v3`）。
- Off-roster 三個 drill（`counterstrafe-cued-v1`／`tracking_core_pr_pilot_v1`／`tracking_reversal_pilot_v1`）查表為 `undefined`，無 fallback 家族。
- 解耦（FR-58.3）：25 個 practice-only drill 逐一斷言「在表內」且「registry 無登記」；`SCHEDULABLE_DRILL_IDS` 中僅 `spider-shot-v2`／`spider-shot-v3`／`peek_click_transfer_v1` 三筆有 registration。10 個家族 id 本身既非 drill id 亦無 registration。

### 3. 驗證

| 閘 | 結果 |
|---|---|
| `npm run typecheck` | exit 0（browser + node） |
| `npx vitest run` | **242 passed / 1 skipped（243 files）、2,491 passed / 2 skipped** —— 相對 T0 baseline 淨增 49，既有測試零失敗 |
| `npm run build` | exit 0 |
| `npx playwright test session-orchestrator.spec.ts -g "Session Plan 真實 DOM 接線"` | 1 passed（真實 Edge，10 個家族 checkbox） |
| 家族 id 字面值全 repo grep | 無第二份清單；唯二命中為 `spider_shot_wide_v1.test.ts` 對 registry 的 near-miss **drill id** 字串 |

### T1 Decision Log

- **D-58-T1-1 / `resolveWarmupDrillId` 一併遷出**：T1 步驟只點名 `resolveFamilyDrillId`，但 DoD 要求「`SessionRunner.ts` 不再 import 任何 drill 模組」，而 `resolveWarmupDrillId` 持有第 7 個 drill import（`counterstrafeFreeV1`）。兩支一起遷入 `drillFamily.ts`，`SessionRunner.ts` 以 `export { ... } from` re-export 保留公開介面 ⇒ `SessionRunner.test.ts` **零修改**仍綠。
- **D-58-T1-2 / 不變量 2 的可測形式**：`availableDrills` 位於 `main.ts`（top-level await + WebGPU + DOM），單元測試無法 import。改以 `node:fs` 讀取 `main.ts` 原始碼、擷取 `availableDrills` 陣列字面值並計數（18 個明列項 + 3 個 spread：`PEEK_CLICK_TRANSFER_PILOT_V2_CANDIDATES` 3、行內陣列 7、`trackingBrVariants` 8 = 36），與 `FAMILY_BY_DRILL_ID.size` 對齊。解析器遇到**無法辨識的 spread 來源即 fail**，而非靜默少算 —— 這正是要擋的漂移（有人加 drill 卻忘了建表）。id 值本身無需比對：兩側都讀同一批 drill 模組常數，唯一可能的分歧就是數量。
- **D-58-T1-3 / 家族清單擴張是既有政策的延伸，非新決策**：`main.ts:554` 早在 WP-52 T2 就把 Session Plan 表單的家族來源設為 `[...KNOWN_SESSION_FAMILY_IDS]`（刻意避免第二份清單）。新增 4 個家族因此讓表單自動從 6 個 checkbox 變 10 個。兩處計數斷言（`SessionPlanSetup.test.ts`、e2e）隨之更新——這是 consequence 對帳，不是行為改動；`SessionPlanSetup.ts` production code 零修改。

### T1 Surprises

- **`resolveFamilyDrillId` 的 switch 是 T1 的隱形安全網**。函式對 `SessionFamilyId` 做 exhaustive switch 且無 `default`，所以 `sessionSchedule.ts` 一加入 4 個家族 id，TypeScript 立刻在「並非所有程式路徑都有回傳值」上報錯——四個新家族的代表 drill 不可能被忘記。這與 T0 §1 記錄的 `SessionRunnerPhase` 情況正好相反（該型別未被具名 import，改 union 只會靜默失配），同一個 repo 裡兩種相反的編譯期保護強度，值得 T3 留意。
- **T0 凍結表的價值在 T1 立刻兌現**：建表過程零 id 錯誤，`FAMILY_BY_DRILL_ID.size` 第一次執行就是 36。若照規劃期的舊表手打，會有六處查不到任何 drill 的鍵。

---

## T2 — Session Program 純函式編譯器（2026-09-08）✅

### 1. 交付物

| 檔案 | 動作 | 內容 |
|---|---|---|
| `src/session/sessionProgram.ts` | **新增** | `SessionProgramItem`／`SessionProgramPlan`／`ProgramBoundary`／`RunStep`／`RestStep`／`ProgramStep`、`compileSessionProgram()`、`summarizeProgram()`、`SessionProgramCompileError` |
| `src/session/sessionProgram.test.ts` | **新增** | 五條規則表格測試 + 17 步 golden + 四組情境 + 12 列非法輸入矩陣 + 決定性 + benchmark + 純度掃描，**47 tests** |

無其他檔案改動：T2 是純交付，**零接線**（`compileSessionProgram()` 目前沒有 production call site，T3／T4 才接）。

### 2. 實測契約

- **型別**：`ProgramStep` 拆為具名的 `RunStep`／`RestStep` 兩個 exported interface（README §2.5 的 phase union 直接引用這兩個名字，T3 免再拆一次）。
- **`RestStep.nextDrillId` 恆存在**：因為 program 永不以 rest 結尾（規則 4），這個欄位不需要 optional —— T4 的 overlay 標籤（OQ-58.3）因此拿得到無條件的「下一個 drill」。
- **錯誤契約**：`SessionProgramCompileError` 帶 `field: 'items' | 'drillId' | 'reps' | 'drillRestSeconds' | 'familyRestSeconds'` 與 optional `itemIndex`，比照既有 `SpiderWideResolveError` 的 typed-error 慣例（呼叫端分類不需解析訊息字串）。T4 的表單可據此直接標記出錯的那一列。
- **驗證先於建構**：全部輸入在產出第一個 step 之前驗完，因此「丟錯 ⇒ 呼叫端不可能拿到半編譯的 program」是結構保證，而非測試碰巧覆蓋到的性質。
- **golden 逐元素通過**：`[(hold_click_v1,3),(spider-shot-v2,3),(counterstrafe-reversal-v1,3)]` + 30／60 → **17 步**（9 run、6×30s `rep`、2×60s `family`），`summarizeProgram()` = `{ runCount: 9, totalRestSeconds: 300 }`。
- **同 drillId 的兩個 item** 判為 `'drill'` 邊界而非 `'rep'`：reps 是 **item** 的屬性，操作員列兩次就是兩個 block。秒數雖相同，但預覽表與 metadata 報的標籤不同。
- **fixture 家族自我驗證**：測試開頭先斷言 A／B／C 確實分屬三個家族、sibling 確實同家族——若日後有 WP 搬動 drill 的家族歸屬，這裡會先紅，而不是讓 golden 靜默改測別的邊界。

### 3. 驗證

| 閘 | 結果 |
|---|---|
| `npx vitest run src/session/sessionProgram.test.ts` | **47 passed** |
| `npx vitest run`（全量） | **243 passed / 1 skipped（244 files）、2,538 passed / 2 skipped** —— 相對 T1 淨增 47，既有測試零失敗 |
| `npm run typecheck` | exit 0（browser + node） |
| `npm run build` | exit 0 |
| benchmark（NFR-58.4） | 20 items × 20 reps = **400 run steps**；warm 50、samples 500 → **p95 = 0.0398 ms**、max 0.8764 ms，限額 1 ms |
| 模組純度掃描（NFR-58.1／58.5） | `sessionProgram.ts` 無 `three`／`node:`／`Date.now`／`performance.now`／`Math.random`／`requestAnimationFrame`／`document.`／`window.` |

### T2 Decision Log

- **D-58-T2-1 / `RunStep`／`RestStep` 具名匯出**：README §2.4 把 `ProgramStep` 寫成 inline union，但 §2.5 的 phase union 又以 `RunStep`／`RestStep` 之名引用其兩支。直接匯出具名 interface 讓兩節對齊，T3 不必自行 `Extract<ProgramStep, {kind:'run'}>`。契約內容逐欄與 §2.4 相同。
- **D-58-T2-2 / 錯誤型別採 `field` + `itemIndex` 而非把索引編進 `field`**：把 `items[2].drillId` 塞進 `field` 會讓「分類」退化成字串解析，正是 `SpiderWideResolveError` 的註解要避免的事。分成兩個欄位後，T4 既能分類（`field`）也能定位（`itemIndex`）。
- **D-58-T2-3 / benchmark 用 500 samples 而非 micro-flick perf test 的 10,000**：單次編譯已是 ~0.04 ms，10,000 次會讓這支測試比整個 session 測試檔還久而不增加任何鑑別力。warm 50 + samples 500 足以穩定取到 p95，且整支檔案仍在 ~20 ms 完成。
- **D-58-T2-4 / 不驗證「同一 drill 不得重複出現」**：FR-58.8 明文允許 A-B-A 與同 drill 重複，`requireFamilyOrder()` 的禁重複只約束 frozen 路徑。編譯器對重複完全沉默是刻意的。

### T2 Surprises

- **`RestStep.nextDrillId` 之所以能是必填，是規則 4 的免費副產品**。規劃時把它寫成 rest 的一個欄位，並未說明「program 不以 rest 結尾」正好保證每個 rest 都有下一步。這讓 OQ-58.3（overlay 要不要顯示下一個 drill）在型別層面已經沒有「沒有下一個」的分支要處理——T4 不需要 fallback 文案。
- **「同 drillId 的兩個 item」是規劃文件沒點名的第四種相鄰情況**。FR-58.5 只列了「同 item／不同 item 同 family／不同 family」三種；兩個 item 用同一個 drill 落在第二種（`'drill'`），秒數與 `'rep'` 相同，所以行為無歧義——但標籤不同，且那個標籤會進預覽表與 metadata。已補一條測試釘死，避免日後有人為了「看起來合理」把它改判成 `'rep'`。

---

## T3 — SessionRunner 游標化與 runtime 接線（2026-09-08）✅

### 1. 交付物

| 檔案 | 動作 | 內容 |
|---|---|---|
| `src/session/SessionRunner.ts` | **重寫** | phase union 收斂為 `idle/run/rest/done`；`SessionPlan` 改攜 `mode`／`items`／`program`；新增 `buildFrozenSessionPlan()`；模組級 `restDurationMs` 移除 |
| `src/session/sessionProgram.ts` | 加法 | `SessionProgramItem.warmup?` → `RunStep.warmup?`（純透傳，不影響邊界／秒數） |
| `src/session/SessionRunner.test.ts` | 改寫 | 8 個既有 frozen 情境逐一改寫為新 phase union 的等價斷言（**13 tests**） |
| `src/session/SessionRunnerPoll.test.ts` | 改寫 + 加測 | 自動推進、載入失敗復原、兩級倒數時基、零配置 identity、dispose（**5 tests**） |
| `src/session/SessionRunnerProgram.test.ts` | **新增** | frozen program 形狀（1～4 家族）、warmup 前置、0 秒休息、custom reps + 兩級休息實測時長、run 編號、`start()` 拒絕矩陣、ADR-2 邊界掃描（**23 tests**） |
| `src/session/sessionRepRestart.test.ts` | **新增** | 三次連續 rep 的 sim 起始狀態／`DataRecorder` snapshot／spawn 序列逐位一致（**4 tests**） |
| `src/session/sessionProgram.test.ts` | 加測 | warmup 標記透傳 + 不改邊界（**+2 tests**，47 → 49） |
| `src/main.ts` | 接線 | 顯式 import `SessionRunnerPhase`；`startSessionPlan()` 改走 `buildFrozenSessionPlan()`；完成分支鏈四路 → 三路；metadata 注入 gate `'family'` → `'run'` |

### 2. CodeGraph impact（對帳 T0 §1）

改動符號與實測 consumer 完全落在 T0 量測的清單內，無新增跨模組 consumer：

| Symbol | 動作 | consumers | 結果 |
|---|---|---|---|
| `SessionRunnerPhase` | union 由 5 kind 改 4 kind | `main.ts`（原僅 structural）、`SessionRunner.ts` | ⚠️→✅ **T0 的擔憂已消除**：改 union 後 `main.ts` 的三處 `.kind` 比對**直接編譯期爆掉**（TS2367「no overlap」），並非靜默失配。另依 D-58-T0-4 於 `main.ts:1639` 加上顯式 `: SessionRunnerPhase` 標註，讓未來新增 kind 時 `step` 欄位存取也受保護 |
| `SessionPlan` | 欄位換血（families/restSeconds/includeWarmup → mode/items/program） | `SessionRunner.ts`、`SessionRunner.test.ts`、`main.ts` | 3 檔全部編譯期紅燈後逐一修正 |
| `createSessionRunner` | 行為改寫、簽章不變 | `main.ts`（3 call sites）+ 2 測試檔 | 介面不變 |
| `resolveFamilyDrillId`／`resolveWarmupDrillId` | 呼叫端由 runner 移到 `buildFrozenSessionPlan()` | 同上 | re-export 不變，`main.ts:283` 註解仍成立 |
| `KNOWN_SESSION_FAMILY_IDS` | 僅 `requireFamilyOrder()` 換位置 | 8 檔 | 零改動 |

### 3. 行為等價證明（frozen 路徑）

**編譯期形狀**：N 個家族（無熱身）→ **N 個 `run` + (N−1) 個 `family` rest**，每個 rest 秒數 = `restSeconds`，run 的 drill 序列 = `families.map(resolveFamilyDrillId)`。1／2／3／4 家族四個 case 逐一斷言。

**關鍵映射（D-58-T3-1）**：frozen 編譯用 `drillRestSeconds: 0` + `familyRestSeconds: restSeconds`。理由不是巧合而是可證的：
- `requireFamilyOrder()` 禁重複 ⇒ 家族兩兩相異 ⇒ 家族之間的每個接縫都是 `'family'` 邊界，吃 `restSeconds`（與舊 `restDurationMs` 同值）。
- frozen program 唯一可能的非 family 接縫是「熱身 → 第一個家族」，而熱身 drill（`counterstrafe-free-v1`）與它熱身的家族同屬 `counterstrafe` ⇒ `'drill'` 邊界 ⇒ 吃 0 秒 ⇒ 依規則 5 於編譯期省略 ⇒ **與舊狀態機「warmup 直接 advance 進正式測試、中間無休息」逐位相同**。

**逐項對照**（皆有測試）：

| 舊行為 | 新行為 | 狀態 |
|---|---|---|
| `phase.kind==='family'`、`familyIndex` 遞增 | `phase.kind==='run'`、`cursor` 遞增，`step.itemIndex` 帶家族序 | 等價 |
| `rest` 帶 `nextFamily` + `remainingMs` | `rest` 帶 `step`（含 `boundary`／`nextDrillId`）+ `cursor` + `remainingMs` | 資訊嚴格增加 |
| warmup 為獨立 phase | warmup 為 program 第 0 個 `run`，帶 `warmup: true` | 等價（見下方匯出） |
| status `熱身: X` / `正式測試 n/N: X` / `休息後開始: X` / 完成 / 切換失敗 | 五條字串逐字保留；`n/N` 仍**排除熱身** | 逐字等價 |
| `本家族無熱身，直接開始正式測試。` | 改由 `buildFrozenSessionPlan().warmupAvailability` 回報，`main.ts` 於 `runner.start()` 前顯示 | 同文字、同順序 |
| 家族順序驗證錯誤訊息 3 條 + `restSeconds` 錯誤 1 條 | 同 4 條訊息，改由 `buildFrozenSessionPlan()` 於編譯期丟出；`main.ts` 既有 try/catch 已涵蓋 | 同訊息，時機提前 |

### 4. 刻意的行為差異（兩處，皆已判定不影響 frozen 資料）

1. **`restSeconds === 0` 不再產生 rest step**（FR-58.6 明文要求）。舊行為會進 `rest` phase、overlay 閃現一幀、且必須等一次 `poll()` 才推進；新行為直接 run→run。屬規格要求的改善，非回歸。
2. **熱身 run 的 payload 現在會帶 `sessionPlanRestSeconds`／`sessionPlanFamilyOrder`**（metadata gate 由 `'family'` 改 `'run'`，T3 步驟 7 明文指定）。**不可觀測**：熱身 payload 從不 `downloadJSON`（見下），且 `counterstrafe-free-v1` 為 practice mode ⇒ `HistoryPersistence` 直接 `excluded/practice`。

**熱身不匯出這件事被明確保留**：`RunStep.warmup` 標記讓 `main.ts` 的單一 run 分支寫成 `if (step.warmup !== true) downloadJSON(...)`。若無此標記，四路收斂為三路會讓熱身開始產生匯出檔——那是研究者看得見的差異（每場多一份 `counterstrafe-free-v1` JSON）。

### 5. `poll()` 零配置（NFR-58.3）

舊實作每幀 `setPhase({ ...phase, remainingMs })` ⇒ **每幀配置一個新 phase 物件**（休息期間 60 秒 × 60fps ≈ 3,600 個）。新實作把 rest phase 做成單一重用物件、就地寫 `remainingMs`，且只在數值真的改變時才回呼。

**證據（identity 而非 heap 量測）**：3,000 次 `poll()` 後 `runner.phase` 仍 `toBe` 首次取得的同一個物件，且 `onPhaseChange` 收到的 rest phase 去重後 `size === 1`。採 identity 斷言而非 `process.memoryUsage()`：後者在 vitest 下受 GC 時機影響而不決定性，identity 則直接證明「沒有第二個物件被造出來」——這正是本 repo 其他熱路徑（`HitDetector`／`ImpactRing`／`mouseGain`）既有的「模組層級重用」證明方式。

`poll()` 其餘部分為 `O(1)`：只讀 `rest.step.seconds` 與兩個數字，無陣列掃描。倒數時基仍只用傳入的 `nowMs`（render 迴圈的 `performance.now()` 域，ADR-4）；模組掃描確認 `SessionRunner.ts` 無 `Date.now`／`three`／`SharedState`／`SimLoop`／`InputSampler`／`DataRecorder`／`document.`／`window.`／`Math.random`（ADR-2 + NFR-58.5）。

### 6. 三次連續 rep 的 sim 起始狀態（OQ-58.1 落地）

`sessionRepRestart.test.ts` 重建 `activateDrill()` 的整條物件圖（`loadDrill` → `createSharedState` → `createTargetManager` → `createDrillRunner` → `createDataRecorder` → `createSimLoop`）三次，跑固定 tick 序列：

| 量測 | `detection_popin_v1`（2,000 ticks） | `spider-shot-v2`（400 ticks） |
|---|---|---|
| 起始 `{x,z,vx,vz}` | `{0,0,0,0}` ×3 | 同左 |
| `DataRecorder` snapshot 三輪 `toEqual` | ✅ | ✅ |
| seed 三輪相同 | ✅ | ✅ |
| 逐目標 spawn 座標序列三輪 `toEqual` | ✅ | ✅ |

⇒ **無殘留 velocity／recoil／arena 狀態**，且 **OQ-58.1「逐輪相同」已是既有行為**：T3 因此對 drill 載入路徑零改動，沒有新增任何 seed 推導。代價（練習效應、reps 非 i.i.d.）由 T5 寫入 metadata 與分析契約（D-58-T0-3）。

### 7. 驗證

| 閘 | 結果 |
|---|---|
| `npm run typecheck` | exit 0（browser + node） |
| `npx vitest run`（全量） | **245 passed / 1 skipped（246 files）、2,570 passed / 2 skipped** —— 相對 T2 的 2,538 淨增 32，既有測試零失敗 |
| `npm run build` | exit 0 |
| `npx playwright test session-orchestrator.spec.ts -g "Session Plan 真實 DOM 接線"` | 1 passed（真實 Edge） |
| 既有決定性回歸（NFR-58.2） | `tests/regression/*`、`src/loop/__tests__/*` **零修改**全綠 |
| `main.ts` 完成分支鏈 | pilot / run / protocol **三路**（原四路） |

### T3 Decision Log

- **D-58-T3-1 / frozen 以 `drillRestSeconds: 0` 編譯**：讓 frozen 走同一個編譯器而不需要在編譯器裡開 frozen 特例。0 秒休息會被規則 5 於編譯期省略，恰好複製「熱身→正式測試之間無休息」的舊行為；家族兩兩相異則保證其餘接縫全是 family 邊界。等價性因此是**可證的**，不是靠測試碰巧覆蓋到。
- **D-58-T3-2 / `buildFrozenSessionPlan()` 放在 `SessionRunner.ts` 而非 `sessionProgram.ts`**：編譯器必須維持「不知道有 frozen 這回事」的純度（它只認識 items 與兩個秒數）。frozen 的 counterbalance 語意（禁重複、代表 drill、熱身解析）屬 session plan 層，與 `SessionPlan` 型別同住最短。`sessionProgram.ts` 因此完全未被 frozen 需求污染。
- **D-58-T3-3 / 新增 `RunStep.warmup?`（T2 契約的加法擴充）**：README §2.5 要求四路收斂為三路，但「熱身不匯出」是 frozen 的可觀測行為。若不標記，三路收斂會讓每場 session 多下載一份熱身 JSON。標記為 optional 且只在 `true` 時出現 ⇒ T2 既有 47 個逐元素 `toEqual` 斷言**零修改**仍綠。編譯器對它完全被動（不影響邊界／秒數），另補 2 個測試釘死這點。
- **D-58-T3-4 / 錯誤驗證上移到編譯期**：家族順序與 `restSeconds` 的四條錯誤訊息逐字保留，但改由 `buildFrozenSessionPlan()` 丟出。語意不是放寬而是收緊——非法 plan 現在連「被表達成 program」都做不到，更不可能到達 runtime（§2.8 failure-mode 表的第一列）。既有測試從 `rejects.toThrow` 改為 `expect(() => …).toThrow`，斷言強度不變。
- **D-58-T3-5 / rest phase 就地寫入**：為滿足 NFR-58.3 的零配置，rest phase 是唯一一個生命週期內可變的物件（型別上以 `MutableRestPhase` 內部介面表達，對外仍是 `readonly`）。代價寫在原始碼註解：overlay 擁有者必須每次回呼即讀 `remainingMs`，不得保留 phase 參考。
- **D-58-T3-6 / `enterStep()` 一律先載入再發 phase**：舊碼在 warmup 路徑是「先發 phase 再載入」、family 路徑是「先載入再發 phase」。統一為後者——載入失敗時 phase 不會停在一個其實沒載起來的 run，且與 rest overlay 的隱藏時機（載入完成才切走）一致。

### T3 Surprises

- **T0 §1 記錄的「`SessionRunnerPhase` 未被具名 import ⇒ 改 union 會靜默失配」在實作時沒有發生**。把 5-kind union 改成 4-kind 後，`main.ts` 的三處 `phase.kind === 'family' | 'warmup'` 立刻報 **TS2367**（"comparison appears to be unintentional … have no overlap"），因為 TypeScript 對字面值聯集的比較本來就會檢查交集。靜默失配的真正風險在**反方向**：未來若**新增**一個 kind，既有比對仍然合法而只是漏接。D-58-T0-4 的顯式標註因此仍然值得做，但它防的是「加 kind」而不是「減 kind」。
- **收斂後的分支鏈比預期更短**。README §0.1 預期「四路變三路」，實際上 warmup 與 family 兩路合併後，`downloadJSON` 與 `advance()` 也一併去重，只剩一個 `if (step.warmup !== true)` 的守衛——熱身與正式測試的差別在生命週期上收斂成「要不要匯出」這**單一**問題，而不再是兩條各自呼叫 `advance()` 的路徑。
- **舊 `poll()` 每幀配置一個 phase 物件這件事，是這次才被量到的**。NFR-58.3 原本讀起來像在防「別在 `poll()` 裡重編 program」，但真正在配置的是 `{ ...phase, remainingMs }`——一場 60 秒休息約 3,600 個短命物件。修法（單一重用物件 + 只在數值變動時回呼）順帶讓 `RestOverlay.show()` 的呼叫次數從「每幀」降為「毫秒數真的改變時」。

---

## T4 — Session Plan 表單改版與程式預覽（2026-09-08）✅

### 1. 交付物

| 檔案 | 動作 | 內容 |
|---|---|---|
| `src/ui/SessionPlanSetup.ts` | **改版** | 模式切換（frozen／custom）、drill 選單（依家族分組的 36 項 `optgroup`）、有序清單（reps／▲▼／移除／拖曳）、兩級休息秒數、由編譯器驅動的預覽表 |
| `src/ui/programBoundaryLabel.ts` | **新增** | `PROGRAM_BOUNDARY_LABEL` + `describeBoundary()` —— 邊界詞彙的單一來源，預覽表與 rest overlay 共用 |
| `src/ui/RestOverlay.ts` | 加法 | `show(remainingMs, detail?)`；`RestOverlayDetail = { boundary, nextDrillId }`（OQ-58.3） |
| `src/main.ts` | 接線 | `startSessionPlan()` 依 `selection.mode` 分兩路；overlay 帶 `phase.step` 的邊界與下一個 drill；metadata 注入條件收斂到 frozen 分支 |
| `src/ui/SessionPlanSetup.test.ts` | 改寫 + 加測 | frozen 6 條（既有 5 條逐項保留）+ custom 編輯 5 條 + 預覽 3 條 + 編譯失敗 12 條（`it.each`）+ 鍵盤／ARIA 3 條 + benchmark 1 條 = **33 tests** |
| `src/ui/RestOverlay.test.ts` | 加測 | 三種邊界的標籤 + 省略 detail 的逐位回歸（**+1 test**） |

### 2. UI 契約

- **`SessionPlanSelection` 改為 discriminated union**：`{ mode:'frozen', families, restSeconds, includeWarmup }` ∪ `{ mode:'custom', items, drillRestSeconds, familyRestSeconds }`。frozen 臂的三個欄位語意與型別逐位不變，只是多了一個 `mode` 標籤；custom 臂**沒有** `includeWarmup`（FR-58.17：熱身就是清單第一項）。
- **預覽表只渲染 `compileSessionProgram()` 的輸出**。UI 層不判斷任何邊界、不計算任何秒數；golden 測試逐 step 拿 UI 的 `data-program-step`／`data-step-boundary`／`data-step-next-drill-id` 與編譯器輸出對表，所以「UI 偷算一套」會直接紅燈而不是靜默分岔。
- **選單來源 = `SCHEDULABLE_DRILL_IDS`，分組來源 = `FAMILY_BY_DRILL_ID`**，兩者都是 T1 的單一來源。測試斷言選單的 36 個 option 逐位等於 `SCHEDULABLE_DRILL_IDS`，且 off-roster 的 `counterstrafe-cued-v1` 加不進清單。
- **失敗即禁用提交**：`compileSessionProgram()` 丟出的 `SessionProgramCompileError` 直接當作錯誤文案（例：`items[0].reps 必須為 >= 1 的整數`），`error.itemIndex` 用來在該列打上 `data-invalid`，`submit.disabled = true`。修好輸入後兩者同時解除。
- **秒數欄位有兩層驗證**：先過表單的 `[min,max]` 邊界（沿用 frozen 既有的 0–3600 與同一句錯誤文案），再交給編譯器。編譯器只認「有限非負」，上限屬 UI 政策。
- **預覽表頭**：`預覽（17 步 · 執行 9 輪 · 休息合計 5 分 00 秒）`，步數與休息合計取自 `summarizeProgram()`；**不估 drill 本身耗時**（因人而異，假裝知道比不說更糟）。

### 3. 驗證

| 閘 | 結果 |
|---|---|
| `npx vitest run src/ui/SessionPlanSetup.test.ts` | **33 passed** |
| `npx vitest run src/ui/RestOverlay.test.ts` | **3 passed** |
| `npx vitest run`（全量） | **245 passed / 1 skipped（246 files）、2,595 passed / 2 skipped** —— 相對 T3 的 2,570 淨增 25，既有測試零失敗 |
| `npm run typecheck` | exit 0（browser + node） |
| `npm run build` | exit 0 |
| `npx playwright test session-orchestrator.spec.ts` | **8 passed**（真實 Edge），spec **零修改** |
| 預覽重繪 benchmark（NFR-58.4） | 20 items × 20 reps = 400 runs → **799 steps**；warm 20、samples 100 → **p95 = 1.0756 ms**、max 6.4080 ms，限額 50 ms |

**benchmark 的誠實範圍**：本 repo 無 jsdom，UI 測試一律跑在手寫的 fake DOM 上（既有慣例）。因此 1.08 ms 量到的是「編譯 + 建 799 個節點 + `replaceChildren`」這段**我們自己的工作**，**不含**真實瀏覽器的 layout／paint。限額 50 ms 有 46× 餘裕，且預覽框是固定高度的 `overflow:auto` 容器（真實 layout 只做可視範圍），因此不加 debounce；真實瀏覽器的端到端量測留給 T6。

### 4. frozen 逐位不變的證據

- `session-orchestrator.spec.ts` 三條 Session Plan 端到端（10 個家族 checkbox、拖曳排序、`sessionPlanRestSeconds` 的 value／min／max、只勾一個家族的兩條）**零修改**在真實 Edge 全綠 —— frozen 的 DOM 結構、`name` 屬性與唯一的 `button[type=submit]` 都沒動。
- 既有 5 條 frozen component test 逐條保留（含「至少選擇一個測試家族」「休息秒數必須介於 0 到 3600 秒」兩句錯誤文案、0／3600 閉區間、10 個家族的順序），唯一改動是預期值多了 `mode: 'frozen'`。
- 新增一條 frozen↔custom 切換測試釘死：custom 空清單會禁用提交，**切回 frozen 必須解除禁用**——否則操作員會被自訂軌的錯誤鎖死在凍結軌上。

### T4 Decision Log

- **D-58-T4-1 / 邊界詞彙獨立成 `programBoundaryLabel.ts`**：預覽表與 rest overlay 在同一場 session 對同一位操作員說同一組詞。若各寫一份，預覽就會對「等一下會看到什麼」說謊，而這正是 FR-58.13 存在的理由（R-58.8）。詞彙是 UI 文案，因此**不**放進 `sessionProgram.ts`（純編譯器不碰呈現，NFR-58.1）。
- **D-58-T4-2 / `SessionPlanSelection` 用 discriminated union 而非 optional 欄位堆疊**：兩軌的欄位集合互斥（frozen 有 `families`／`includeWarmup`，custom 有 `items`／兩個秒數）。做成一個都是 optional 的大物件，會讓 `main.ts` 必須在執行期猜「這是哪一軌」；union 讓 `selection.mode === 'custom'` 這一個判斷同時完成分軌與型別窄化，`activeSessionPlanSelection.restSeconds` 在 custom 下**編譯期就不存在**。
- **D-58-T4-3 / reps 輸入只重繪預覽、不重繪該列**：`renderItems()` 會重建整列 DOM，若綁在 reps 的 `input` 上，真實瀏覽器每敲一鍵就會摧毀正在輸入的欄位（焦點與游標位置一起丟失）。清單只在加入／移動／移除時重繪；reps 直接寫回 item 物件後只重跑預覽。
- **D-58-T4-4 / T4 順帶把 custom 軌接進 `main.ts`**：step 6 改了 `onSubmit` 的形狀，`main.ts` 本來就必須跟著改才編得過。既然 T3 的 runner 已能跑任意 `ProgramStep[]`，只讓表單能編、不讓它能跑，會留下一個「按了開始卻什麼都沒發生」的半成品。因此 `startSessionPlan()` 一併分兩路：custom 走同一個 `compileSessionProgram()` → 同一個 runner。**未落地的部分明確界定為 T5**：custom 的匯出稽核欄位（`sessionPlanMode`／`sessionPlanItems`／`sessionPlanDrillRestSeconds`／`itemIndex`／`repIndex`）尚未寫入 metadata，因此本 task 把注入條件收斂到 `mode === 'frozen'` —— **寧可缺欄位，不可寫一個 custom session 根本沒有的 `sessionPlanFamilyOrder`**。
- **D-58-T4-5 / 秒數上限留在 UI、不上推編譯器**：`compileSessionProgram()` 只驗「有限非負」（FR-58.7 原文）。0–3600 是操作介面的合理範圍政策，frozen 軌沿用同一組 bounds 與同一句錯誤文案；把它塞進純函式會讓編譯器開始持有 UI 政策。
- **D-58-T4-6 / 用 ▲▼ 按鈕承擔鍵盤排序，拖曳只是加值**：原生 HTML 沒有可鍵盤操作的拖放。NFR-58.7 要求「不使用拖曳也能改變順序」，因此排序的**主要**機制是兩個具 `aria-label` 的真按鈕，drag/drop 監聽器額外掛上給滑鼠使用者。邊界（第一列的 ▲、最後一列的 ▼）為 no-op 而非環繞——有測試釘死，否則長按 ▲ 會把清單整個旋轉。

### T4 Surprises

- **`RestStep.nextDrillId` 必填在 T2 是型別上的小事，到 T4 才兌現成 UI 上的大事**。overlay 與預覽表都不需要「沒有下一個 drill」的 fallback 文案，因為編譯規則 4（program 不以 rest 結尾）在型別層就消掉了那個分支。T2 的 Surprises 已預告，這裡確認：兩個消費端各省下一條死路徑。
- **frozen 軌完全沒被這次改版碰到，證據強度超出預期**。原以為加模式切換會逼著改 e2e selector（R-58.9 給的機率是「高」），實際上把 custom 區塊做成獨立的 `[data-plan-section="custom"]` 容器、沿用同一個 `button[type=submit]` 之後，三條 Session Plan e2e **一個字都沒動**就全綠。R-58.9 的緩解（「更新既有 spec 而非新開平行 spec」）最後連更新都不需要。
- **編譯器的 typed error 讓表單的錯誤處理縮成三行**。`error.field` 分類、`error.itemIndex` 定位、`error.message` 直接當文案——T4 完全不需要自己寫一套 reps／drillId 的驗證訊息。D-58-T2-2（不把索引編進 `field`）在這裡拿到回報：如果當初把 `items[2].drillId` 塞進 `field`，這裡就得解析字串才知道要標哪一列。

---

## T5 — Metadata 稽核欄位、逐輪匯出與 cohort 隔離（2026-09-08）✅

### 1. 交付物

| 檔案 | 動作 | 內容 |
|---|---|---|
| `src/data/metadata.ts` | 加法 | `SessionPlanItemMeta` + 5 個 optional 欄位（`sessionPlanMode`／`Items`／`DrillRestSeconds`／`ItemIndex`／`RepIndex`）；`requireSessionPlanMode()`／`requireSessionPlanItems()`（查 `FAMILY_BY_DRILL_ID`，不新增第二份清單）／`requireSessionProgramCoherence()` 跨欄位驗證 |
| `src/data/exportPayloadSchema.ts` | 加法 | 同 5 欄的 reader 側解析 + `parseSessionPlanItems()` |
| `src/session/sessionProgram.ts` | 加法 | `deriveProgramFamilyOrder(program)` —— 由 `RunStep.family` 去連續重複 |
| `src/history/DrillMetricRegistry.ts` | 加法 | `HistoryProjectionResult` 新增 `excluded-cohort` variant；`project()` 加一條 `sessionPlanMode === 'custom'` 顯式規則 |
| `src/history/HistoryTrend.ts` | 加法 | `excluded-cohort` 以自己的 reason 計數，不併入 `not-ready` |
| `src/ui/history/DrillOverview.ts` | 加法 | `custom-session-program` 的排除理由文案 |
| `src/main.ts` | 接線 | `sessionPlanAuditFields(phase)` 取代 inline 三元；custom 軌寫入完整 program + 本次 rep 座標；`activeCustomProgramFamilyOrder` 於 `start()` 一次導出 |
| `src/session/sessionProgramExport.test.ts` | **新增** | `deriveProgramFamilyOrder` 4 條 + 逐 rep 匯出身分 3 條（**7 tests**） |
| `src/data/metadata.test.ts` | 加測 | 正負向矩陣（mode 字面值 5、items 9+1、秒數 3、跨欄位 4+2、索引 3、邊界 2、frozen 逐位不變 1、加法性 1）（**+39 tests**） |
| `src/data/exportPayloadSchema.test.ts` | 加測 | 8 個既有 fixture 的 canonical JSON digest 對表 + 新欄位正負向 11 條（**+19 tests**） |
| `src/history/DrillMetricRegistry.test.ts` | 加測 | cohort 隔離 4 條 |
| `src/history/HistoryTrend.test.ts` | 加測 | 排除理由分流 1 條 |
| `src/history/HistoryPersistence.test.ts` | 加測 | custom 仍照常保存 1 條（OQ-58.4 零修改的正向證據） |
| `src/ui/history/DrillOverview.test.ts` | 加測 | 排除文案 1 條 |
| `docs/operational/schema.md` | 文件 | 新增 `meta.sessionPlan*` 小節（含 stage8 三個既有欄位——原本從未入 schema 文件）、缺席規則、cohort 規則、reps 非 i.i.d. 警語 |
| `docs/operational/analysis-assessment-contract.md` | 文件 | §2 補「第六軸：排程來源」——custom 不入 frozen cohort、reps 非獨立取樣（D-58-T0-3 落地） |

### 2. Schema diff（全部 optional，缺席對舊 payload 合法）

| 欄位 | 型別 | 誰寫 | 語意 |
|---|---|---|---|
| `sessionPlanMode` | `'frozen' \| 'custom'` | **只有 custom 軌** | 缺席 = 「非 custom」 |
| `sessionPlanItems` | `{ drillId, reps }[]` | custom | 實際執行的 program 來源清單 |
| `sessionPlanDrillRestSeconds` | number | custom | rep／drill 接縫秒數 |
| `sessionPlanItemIndex` / `sessionPlanRepIndex` | number | custom | 本次匯出在 program 中的 0-based 座標 |
| `sessionPlanRestSeconds`（既有） | number | 兩軌 | **語意不變** = family 接縫秒數 |
| `sessionPlanFamilyOrder`（既有） | string[] | 兩軌 | custom 由 `deriveProgramFamilyOrder()` 推導（去連續重複） |

### 3. 驗證

| 閘 | 結果 |
|---|---|
| `npx vitest run`（全量） | **246 passed / 1 skipped（247 files）、2,661 passed / 2 skipped** —— 相對 T4 的 2,595 淨增 66，既有測試零失敗 |
| `npm run typecheck` | exit 0（browser + node） |
| `npm run build` | exit 0 |
| `npx playwright test session-orchestrator.spec.ts` | **8 passed**（真實 Edge），spec **零修改** |
| 既有 golden fixture 逐位不變（NFR-58.6） | 8/8 canonical JSON digest 與 T5 前（HEAD `84483a6`）逐位相同；另斷言 5 個新 key 皆不出現在解析結果 |
| `research/` ingest 相容（C-D1） | 真實 `load_export()` 讀含 5 個新欄位的 payload：`ticks`／`events` 與原始 payload `equals=True`、既有 meta 逐鍵不變、新欄位原樣帶出 ⇒ **Python 側零修改** |

**Fixture 逐位不變的量法**：先在改動前以 sha256 記錄 8 個 fixture 的 `canonicalExportJSON(parseExportPayload(x).payload)`，改完後以同一組 sha256 覆驗通過；committed 的測試改用檔內自寫的 FNV-1a 摘要，因為 `exportPayloadSchema.test.ts` 檔頭明示自己不引 `node:*`（不為了一個雜湊破壞該檔既有性質）。

### 4. 兩處值得記錄的取捨

**(a) frozen 不寫 `sessionPlanMode`（D-58-T5-1）**。FR-58.14 字面要求「新增 `sessionPlanMode`」，但 FR-58.10 與 WP 的 Delivery policy 要求 frozen 軌**匯出內容逐位不變**。兩者在 frozen 軌上直接衝突，取後者：frozen 的 payload 一個 byte 都沒動，`sessionPlanMode` 只出現在 custom 軌。可行的前提是 FR-58.16 的判定本來就寫成 `=== 'custom'`（README §2.7 原文），因此「缺席」在 frozen 軌與所有 WP-58 前的 payload 上是同一個、且正確的意思：可比較。代價是「這是 frozen」只能由 `sessionPlanFamilyOrder`＋`sessionPlanRestSeconds` 間接指認——已寫入 schema 文件。

**(b) 三輪匯出檔名不加 rep 序號（OQ-58.2 落地，`exportBasename` 零修改）**。T0 已證 `startedAt` 逐 rep 重設到毫秒；T5 只補回歸測試釘死「5 個 run step → 5 個唯一檔名」，**外加一條反向測試**明寫唯一性的來源與邊界：兩個 run 若真的同毫秒啟動就會撞名。把已知邊界寫成斷言，比讓它留在文件裡更難被誤改。

### T5 Decision Log

- **D-58-T5-1 / frozen 匯出逐位不變優先於「每個 run 都標 mode」**：見上 §4(a)。判定規則一律正向（`=== 'custom'`），缺席即可比較。
- **D-58-T5-2 / `excluded-cohort` 是自己的 status，不是 `invalid-metric` 的一個 reasonCode**：`invalid-metric` 在 UI 上的文案是「無法計算（projection 失敗或不支援）」。custom run 的指標**算得出來**，只是不可比；沿用 `invalid-metric` 會讓教練報告對操作員說一句假話，正是 GD-20／C-D3 要擋的。新 variant 的擴散面實測極小：`project()` 一處產生、`HistoryTrend` 一處分流、`DrillOverview` 一條文案，`HistoryAnalysisService` 純透傳。
- **D-58-T5-3 / 隔離落在 `DrillMetricRegistry.project()` 而非 `buildHistoryTrend()`**：trend 只看得到 `HistoryRunProjection`，其 `run` 是 `HistoryRunSummary`（無 `sessionPlanMode`）。要在 trend 層判定就得把欄位推進 repository index DTO——跨 browser/Node 邊界的 schema 改動，為一個布林值不值得。`project()` 本來就拿著整份 payload，且 `not-assessment` 那道防線已經在同一處。
- **D-58-T5-4 / 寫入端嚴、讀取端寬**：`collectMeta()` 對 `sessionPlanItems[].drillId` 查 `FAMILY_BY_DRILL_ID`；`parseExportPayload()` 只驗形狀。理由與既有 `sessionPlanFamilyOrder`（`requireSessionPlanFamilyOrder` vs `parseStringArray`）完全一致：roster 日後改名或移除 drill 時，**已存下的 run 不可以因此變成讀不了的檔案**。兩側各有一條測試明寫這個不對稱。
- **D-58-T5-5 / 索引在 `collectMeta` 就做界內檢查**：`sessionPlanItemIndex` 必須落在 `sessionPlanItems` 內、`sessionPlanRepIndex` 必須小於該 item 的 `reps`，且兩者必須成對出現。`main.ts` 的接線若哪天錯位（例如拿 cursor 當 itemIndex），會在匯出當下就爆，而不是產出一份「自稱是第 4 輪」但 program 只有 3 輪的檔案。
- **D-58-T5-6 / 家族順序由編譯後的 `RunStep.family` 導出，不重查 drill id**：`deriveProgramFamilyOrder(program)` 與預覽表、rest overlay、runner 走的是同一份 program，因此匯出寫的家族順序不可能與操作員看到的邊界不一致。於 `startSessionPlan()` 收斂一次存起來，逐 rep 匯出直接讀。

### T5 Surprises

- **stage8 的三個 `sessionPlan*` 欄位從來沒進過 `docs/operational/schema.md`**。原本只打算補新欄位，翻文件才發現 `sessionPlanPreset`／`sessionPlanRestSeconds`／`sessionPlanFamilyOrder` 三個既有欄位在 schema 文件裡完全不存在——匯出格式的權威文件缺了一整個欄位家族。T5 順手補齊整組（不只新的五個），否則新欄位會被寫進一份對它的鄰居沉默的文件裡。
- **`invalid-metric` 差一點就成為預設解**。重用既有 variant 是零型別改動的路，但把 UI 文案讀出來（「無法計算（projection 失敗或不支援）」）就看得出它會對操作員說錯話。C-D3 的「寧可少一個指標，不能有一個會說錯話的指標」在這裡不是關於指標本身,而是關於**指標為什麼不在那裡**的說明。
- **FR-58.14 與 FR-58.10 在 frozen 軌上是直接衝突的**，規劃時兩條各自看都合理（「記錄 mode」vs「匯出逐位不變」),放在一起才發現不能同時成立。這類衝突只有在寫到那一行時才會現形——記為 D-58-T5-1 而不是靜默選一邊。

