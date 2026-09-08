# WP-58 — progress.md

> Running log。Tech spec：[README.md](README.md) · Checklist：[task-checklist.md](task-checklist.md)

## Progress

- **2026-09-07**：依 brainstorming 對話收斂需求，並以 engineering-planning skill 完成 repository-grounded 規劃。盤點 `SessionRunner`／`sessionSchedule`／`sessionPlanPresets`／`SessionPlanSetup`／`RestOverlay`／`metadata` 與 `main.ts` 的 Session Plan 全鏈路；尚未修改 production code。
- **2026-09-07**：確認四個需求缺口——`resolveFamilyDrillId()` 把 family 硬編碼 1:1 對到單一 drill、`requireFamilyOrder()` 明文禁止重複、`restDurationMs` 為單一模組級變數、無任何 rep 概念。決定採「先編譯成 `ProgramStep[]`、Runner 退化成游標」的架構。
- **2026-09-07**：工作拆為 T0～T6 + T-exit。WP 編號一度暫用 WP-57／GD-32，但同日另一個平行 session 的 [WP-57 — Spider Shot Wide Flick](../wp-57-spider-shot-wide-flick/README.md) 先建立資料夾並認領同一組編號；依 GD-15「先採納先得」本計畫順延重編為 **WP-58**，全域決策待以 ~~GD-33~~ **GD-35** 入帳（`GD-33`／`GD-34` 已於 2026-09-07 分別由 WP-57 T3 與 KI-026 取用，見 §T0 §9）。WP-56（進行中的 micro-flick 場景 WP）不受影響。
- **2026-09-08**：**T0 完成**。baseline 全綠（typecheck exit 0；Vitest 2,442 passed／2 skipped）、CodeGraph impact 已對帳 README §0.1（發現 2 處需更正）、36 個 exact drillId 的歸屬表已凍結、OQ-58.1／58.2／58.4 已由使用者收斂、GD-35 已入帳、production diff = 0。詳見 §T0。

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

- **OQ-58.1**：同一 drill 連跑 N 輪的 seed 應逐輪相同或變化。✅ **已收斂（使用者，2026-09-08）：逐輪相同，維持現況**（**未**採規劃時建議的「逐輪變化」）。T3 不動 drill 載入路徑；代價是 reps = 重複同一組刺激、存在練習效應，分析端不得視為 i.i.d. 取樣。證據與限制見 §T0 §5。
- **OQ-58.2**：三輪匯出的檔名唯一性。✅ **已收斂（使用者，2026-09-08）：不加 rep 序號**。`exportBasename` 已含每次 `activateDrill()` 重設的毫秒級 `startedAt`，實測三輪唯一；T5 只補唯一性回歸測試，不改格式。證據見 §T0 §4。
- **OQ-58.3**：休息 overlay 是否顯示邊界種類與下一個 drill。建議**要**。⬜ 待 T4 前確認（**非 T0 exit blocker**，T0 未收斂此項）。
- **OQ-58.4**：`custom` session 是否可進 history。✅ **已收斂（使用者，2026-09-08）：沿用既有兩道閘（`DrillConfig.mode` + exact-id registry），額外標記 `sessionPlanMode`**，**不**在 `HistoryPersistence` 新增第三道攔截；隔離落在 T5 的 trend cohort 判定層。證據見 §T0 §6。
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
