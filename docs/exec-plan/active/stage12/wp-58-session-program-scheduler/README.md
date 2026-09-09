# WP-58（暫用編號）— Session Program Scheduler

> Stage 12 的第二個 Work Package。把 Session Plan 從「四家族固定排程」升級為「可自由編排的 drill 程式（program）」：選 drill、設重複次數（reps）、設兩級休息秒數。
>
> Companion：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
>
> 本計畫依 `.claude/skills/engineering-planning/SKILL.md`、`references/design_standards.md` 與 `assets/tech_spec_template.md` 制定，結構參照 [WP-50](../../stage10/wp-50-3d-state-replay/README.md)。**本 WP 只做排程層；不新增 drill、不改任何 `DrillConfig`、不改 sim/命中/指標語意。**

| | |
|---|---|
| **Problem** | Session Plan 只能勾選四家族固定子集，`resolveFamilyDrillId()` 把 family 硬編碼 1:1 對到單一 drill、`requireFamilyOrder()` 明文禁止重複，全域只有一個 `restSeconds`。研究者無法表達「Drill A ×3（每輪間 30s）→ 60s → Drill B ×3 → 60s → Drill C ×3」這種標準區塊化測試流程 |
| **Outcome** | 研究者可在 Session Plan 表單編出一份有序的 `(drillId, reps)` 清單，設定 drill 休息與家族休息兩個秒數；系統在開始前顯示編譯後的完整步驟表與總時長估計，然後無人工介入跑完 |
| **Truth model** | `compileSessionProgram()` 產出的 `ProgramStep[]` 是本次 session 排程的唯一真相；`SessionRunner` 只是這份陣列上的游標；drill 內部行為（trial 數、seed、命中、指標）完全不受排程層影響 |
| **Delivery policy** | 雙軌：既有「標準 Assessment」一鍵路徑逐位不變；新的自由清單一律標記 `sessionPlanMode='custom'`，不與 frozen protocol 的 history/trend cohort 混合 |
| **Estimate** | 7.5–12.5 dev-days（T0～T6 + T-exit） |
| **Risk** | Med/High：`SessionRunner` 是 Session Plan 唯一 runtime；`KNOWN_SESSION_FAMILY_IDS` 是 KI-016 修過的 metadata allowlist 單一來源；新增家族 id 會擦撞 practice-only drill 的既有隔離意圖 |
| **Milestone** | 無獨立里程碑，**T-exit gate 即交付判定**（比照 WP-27）。stage12 整體里程碑待 owner 定義（[OQ-58.5](#15-open-questions)） |
| **Status** | ✅ **T-exit 交付 2026-09-09**（T0～T5 2026-09-08／T6・T-exit 2026-09-09）。T0：36 個 exact drillId 的歸屬表已凍結（§2.3）、CodeGraph impact 已對帳（§0.1）、OQ-58.1／58.2／58.4 已收斂（§1.5）、[GD-35](../../../DECISIONS.md) 已入帳。T1：`drillFamily.ts` 雙向單一來源上線，4 個新家族純加法納入 allowlist。T2：`sessionProgram.ts` 編譯器交付。T3：`SessionRunner` 游標化，frozen 與 custom 兩軌共用同一 runtime；`main.ts` 分支鏈四路收斂為三路。T4：`SessionPlanSetup` 新增自訂 program 軌（分組 drill 選單／reps／兩級秒數／編譯器驅動的預覽表）、`RestOverlay` 帶邊界與下一個 drill（OQ-58.3）；frozen 軌 e2e **零修改**全綠。T5：5 個 additive optional 稽核欄位上線、逐 rep 匯出可定位且檔名唯一、custom run 由 `excluded-cohort` status 排除於 frozen trend cohort；**frozen 軌匯出逐位不變**（D-58-T5-1）；8 個既有 fixture digest 逐位相同、`research/` ingest 零修改相容。T6：spec 擴充為 4 條自訂 program 表單 DOM 案例 + 3 條真實瀏覽器 live run，由一條**只跳過資格閘拒入、不偽造通過**的 dev-only seam 驅動。**T-exit：兩個 blocker 落地**——[OQ-58.6](#15-open-questions) 的 `tracking` 代表 drill 改為 `tracking_scene_v1` + 新增不變量 5（代表 drill 必須自綁場景）+ frozen live e2e 實跑該家族；[OQ-58.7](#15-open-questions) 的中止 session 改為一律 `exit()`（收斂為單一 `done` 掛點）；gate 5 三份邊界掃描全部寫進 suite。新增 27 測試 ⇒ 全量 Vitest **2,688 passed／2 skipped**、`npm run test:ci` exit 0（含全量 Playwright **99 passed**、build／兩個 typecheck exit 0）、A-58.1～9 逐項具名測試證據。證據見 [progress.md](progress.md) |

---

## 0. Repository-grounded discovery（2026-09-07）

1. `SessionPlan`（[SessionRunner.ts:10-16](../../../../../src/session/SessionRunner.ts)）目前是 `{ participantId, sessionIndex, families[], restSeconds, includeWarmup }`。**沒有 drill 概念**——drill 由 `resolveFamilyDrillId()` 從 family 硬編碼推出。
2. `requireFamilyOrder()`（`SessionRunner.ts:44-53`）**明文拒絕重複家族**。使用者情境的「同一 drill 連跑三輪」在現行契約下是非法輸入。
3. `restDurationMs` 是 `createSessionRunner()` closure 內的**單一模組級變數**，`poll()` 直接讀它。支援 30s/60s 兩種休息，必須讓時長隨 step 攜帶，而不是再加一個變數。
4. `poll()` 的自動推進含錯誤復原（載入失敗 → `setPhase({kind:'done'})` + status），這條路徑必須在游標化後保留，否則 rest overlay 會永久卡在畫面上。
5. `SessionRunnerPhase` 是 5 個 kind 的 union（`idle/warmup/family/rest/done`）；`main.ts` 的 drill 完成分支（[main.ts:1571-1583](../../../../../src/main.ts)）用 `phase.kind === 'warmup' | 'family'` 決定要不要 `advance()` 與是否 `downloadJSON`。這是 pilot / warmup / family / protocol 四路 if-else 鏈，**不應再加第五路**。
6. `main.ts:692-695` 只在 `phase.kind === 'family'` 時把 `sessionPlanRestSeconds` / `sessionPlanFamilyOrder` 注入匯出 metadata。游標化後這個判斷要跟著改，否則自訂 session 的匯出會缺 plan 稽核欄位。
7. `KNOWN_SESSION_FAMILY_IDS`（[sessionSchedule.ts:32-36](../../../../../src/session/sessionSchedule.ts)）是 **KI-016 專門建立的單一來源 allowlist**，`SessionRunner` 與 `src/data/metadata.ts` 的 `requireSessionPlanFamilyOrder()` 都對它驗證。新增家族 id 是加法、安全；但**不得**再長出第二份清單。
8. `buildFamilyOrderForRoster()` 已經泛化成「任意 roster 的決定性 counterbalance 輪轉」，不綁死四家族。自由清單不使用它，但它必須維持可用於 frozen 路徑。
9. `sessionPlanPresets.ts` 的 `perFamilyTrialShape` **刻意引用 drill config 的 `endCondition.value` 而非另存一份**（原始碼註解明示）。本 WP 採 reps 語意，正好與這條紀律相容——排程層永遠不寫 trial 數。
10. `TrackingPilotRunner` + `trackingPilotManifest`（`orderedBlocks[] + restSeconds`）已經是「先把排程算成陣列、runner 只跑陣列」的既有前例。本 WP 等於把同一模式套回主 Session Plan，而不是發明新東西。
11. `RestOverlay` 只吃 `show(remainingMs)` / `hide()`，與休息的**原因**無關，兩級休息可直接沿用；若要顯示邊界種類（「家族休息」vs「組間休息」）需擴充參數。
12. `src/drill/micro_flick_three_target_test_v1.test.ts:228-237` 有負向測試：該 practice drill **不得**出現在 `KNOWN_SESSION_FAMILY_IDS`、`DrillMetricRegistry` 與 Assessment 儲存路徑。此測試斷言的是 **drill id**，故新增家族 id `'micro-flick'` 不會讓它變紅——但它的**意圖**是「practice-only drill 不進 Participant/Assessment session」。本 WP 因此必須把「家族歸屬」與「Assessment 資格」明確解耦，並補正向測試釘死這個解耦。
13. `tests/e2e/session-orchestrator.spec.ts:212` 已有 Session Plan 真實 DOM 端到端（按鈕 → 表單 → 家族拖曳排序/自由休息秒數 → eligibility gate）。UI 改版必須更新這條，而不是新開一條平行 spec。
14. `SESSION_PLAN_MIN_CONDITION`（`src/display/constants.ts`）讓 Session Plan 走較寬的 eligibility 門檻（GD-10：不操弄解析度）。自訂清單沿用同一門檻，不新增顯示條件。
15. `exportBasename(payload)`（`src/results/ResultPresentation.ts`）產生匯出檔名。同一 drill 連跑三輪會產生三份 payload，檔名唯一性需驗證（[OQ-58.2](#15-open-questions)）。

### 0.1 Planning-time blast radius

| Symbol / file | 依賴面 | 分級 |
|---|---|---|
| `SessionRunner.ts`（`SessionPlan`、`SessionRunnerPhase`、`createSessionRunner`、`resolveFamilyDrillId`） | `main.ts`、`SessionRunner.test.ts`、`SessionRunnerPoll.test.ts` | **cross-module High**（Session Plan 唯一 runtime） |
| `sessionSchedule.ts`（`KNOWN_SESSION_FAMILY_IDS`、`TEST_FAMILY_IDS`、`buildFamilyOrder*`） | `SessionRunner.ts`、`src/data/metadata.ts`、`TrackingPilotRunner.ts`、`trackingPilotManifest.ts`、`micro_flick_*.test.ts`、`sessionSchedule.test.ts` | **cross-module High**（KI-016 allowlist 單一來源） |
| `src/data/metadata.ts`（`sessionPlan*` 欄位 + `requireSessionPlanFamilyOrder`） | 匯出 schema 全體 consumers、`research/` ingest、history/trend | **cross-module High**（schema 相容性） |
| `SessionPlanSetup.ts` | `main.ts`、`SessionPlanSetup.test.ts`、`session-orchestrator.spec.ts` | local + 1 E2E |
| `sessionPlanPresets.ts` | `metadata.ts`（`requireSessionPlanPreset`）、`sessionPlanPresets.test.ts` | local |
| `RestOverlay.ts` | `main.ts`、`RestOverlay.test.ts` | local |
| `main.ts` 完成分支鏈 + metadata 注入 | live run 全鏈路 | **cross-module High** |

> ~~T0 必須以當時的 CodeGraph impact 重新量測並記錄實際 consumer 數；上表為規劃時的讀碼結果，不是量測值。~~
>
> ✅ **已於 T0（2026-09-08）量測完成**，逐符號 consumer 數與分級見 [progress.md](progress.md) §T0 §1。上表大致相符，**兩處需補正**：
>
> 1. **`SessionRunnerPhase` 未被任何檔案具名 import** —— `main.ts` 只做 structural 的 `phase.kind` 比對（`:756`／`:1477`／`:1639`～`:1649`）。⇒ T3 改 phase union **不會**在 `main.ts` 產生型別錯誤，只會靜默失配。**T3 必須先讓 `main.ts` 顯式 import 該型別**，才拿得回編譯期保護。
> 2. **`resolveFamilyDrillId` 在 `main.ts:283` 出現**，但僅為註解引用，**無 production call site** ⇒ 遷入 `drillFamily.ts` 安全。
>
> `KNOWN_SESSION_FAMILY_IDS` 實測 **8 個 consumer 檔**（上表少列 `main.ts` 與 `spider_shot_wide_v1.test.ts`），cross-module High 分級不變。

---

## 1. 需求壓縮（Requirements）

### 1.1 Functional Requirements

| ID | Requirement |
|---|---|
| **FR-58.1** | 系統**必須**提供一份 drill → family 的**單一來源**對照表，涵蓋所有可排程 drill；並與既有 family → 代表 drill 的映射放在同一模組，兩個方向的一致性由測試斷言，不得散落成第二份清單。 |
| **FR-58.2** | 系統**必須**把 ~~三~~ **四**個新家族 id（`tracking` / `detection` / `micro-flick` / **`spider-shot-wide`**）以**純加法**方式加入 `KNOWN_SESSION_FAMILY_IDS`；`TEST_FAMILY_IDS` 的四元素內容與順序、`buildFamilyOrder()` 的輪轉結果逐位不變。<br>**T0 更正**：`spider-shot-wide` 為 T0 新增（使用者 2026-09-08 決議）——`spider-shot-wide-v1` 是 spider-shot 的 *sibling construct*（~40–70° vs ~10–25°，WP-57），併入 `spider-shot` 會讓兩個不同構念之間只拿到 drill 休息而非家族休息，與 FR-58.5 的邊界語意衝突。 |
| **FR-58.3** | 家族歸屬**不得**單獨授予任何 drill Assessment 資格。practice-only drill 可被排入自訂 program，但仍不得進入 `DrillMetricRegistry`、history 保存或 frozen protocol cohort。<br>**T0 發現**：此解耦在**現況已成立**——資格由兩道與家族正交的閘決定（`DrillConfig.mode === 'assessment'` → `meta.assessment`；`DrillMetricRegistry` 的 3 筆 exact-id 登記，無 family fallback）。⇒ T1 的工作是把既有事實**釘死成回歸測試**，而非建立新行為。 |
| **FR-58.4** | 系統**必須**提供純函式 `compileSessionProgram(plan)`，把 `{ items: (drillId, reps)[], drillRestSeconds, familyRestSeconds }` 編譯成有序 `ProgramStep[]`；函式不得接觸 DOM、Three、時鐘、檔案系統或亂數。 |
| **FR-58.5** | 編譯器**必須**依下列規則插入休息：相鄰兩個 `run` 之間，同一 item → `boundary='rep'`；不同 item 但同 family → `'drill'`；不同 family → `'family'`。`seconds` 取 `boundary === 'family' ? familyRestSeconds : drillRestSeconds`。 |
| **FR-58.6** | 編譯結果的第一個與最後一個 step **必須**是 `run`；程式開頭與結尾不得有休息。秒數為 0 的休息在編譯期即省略，不產生會閃現一幀的 overlay step。 |
| **FR-58.7** | 編譯器**必須**驗證輸入：`items` 非空、每個 `drillId` 存在於對照表、`reps` 為 ≥1 的整數、兩個秒數為有限非負數。違反時丟出具名錯誤，**不得**靜默截斷或補預設值。 |
| **FR-58.8** | 自訂 program **必須**允許同一 drill 重複出現與家族交錯（A-B-A）；`requireFamilyOrder()` 的「禁止重複」只繼續約束 frozen Assessment 路徑。 |
| **FR-58.9** | `SessionRunner` **必須**改以 `ProgramStep[]` 上的游標驅動：`run` → 載入 drill 並等待結束；`rest` → 依該 step 的 `seconds` 倒數；游標走完即 `done`。休息時長不得再由單一模組級變數提供。 |
| **FR-58.10** | frozen「標準 Assessment」路徑**必須**編譯成同一種 `ProgramStep[]` 並走同一個 runtime；其可觀測行為（家族順序、休息時長、熱身解析、匯出內容）與本 WP 之前逐位一致。 |
| **FR-58.11** | 休息期間的自動推進與**載入失敗復原**行為必須保留：`run` step 載入失敗時中止本次 session、顯示錯誤、進入 `done`，不得讓 rest overlay 永久停留。 |
| **FR-58.12** | Session Plan 表單**必須**支援：從全部可排程 drill 挑選並加入清單、拖曳排序、移除、每項設定 reps、兩個獨立的休息秒數欄位。 |
| **FR-58.13** | 表單**必須**在提交前顯示編譯後的完整步驟表（每一步的 drill / rep 序號 / 休息秒數與邊界種類）與總時長估計；操作員因此能看見「相鄰同家族 drill 只拿到 drill 休息」這類非直覺結果。 |
| **FR-58.14** | 匯出 metadata **必須**新增 additive 欄位記錄實際執行的 program：`sessionPlanMode`（`'frozen' \| 'custom'`）、`sessionPlanItems`、`sessionPlanDrillRestSeconds`，並保留既有 `sessionPlanRestSeconds` / `sessionPlanFamilyOrder` 語意。缺席欄位對舊 payload 合法。 |
| **FR-58.15** | 每一輪（rep）**必須**產生自己的一份匯出 payload 與唯一檔名，並在 metadata 中可定位到 `itemIndex` / `repIndex`。 |
| **FR-58.16** | `sessionPlanMode='custom'` 的 run **不得**進入 frozen protocol 的 history/trend cohort；判定必須是 metadata 驅動的顯式規則，不得依賴 drill id 猜測。 |
| **FR-58.17** | 自訂路徑**不得**保留 `includeWarmup`——熱身即「把熱身 drill 放在清單第一項」。frozen 路徑的 `includeWarmup` 行為不變。 |

### 1.2 Non-functional Requirements

| ID | Requirement / measurable gate |
|---|---|
| **NFR-58.1** | `compileSessionProgram()` 為純函式：相同輸入恆產生逐位相同輸出；模組掃描證明無 `document`/`window`/`three`/`node:*`/`Date.now`/`performance.now`/`Math.random` 參照。 |
| **NFR-58.2** | 排程層**零 sim 影響**：`SIM_HZ`、tick 演進、輸入鏈、命中判定與 seeded spawn 皆無改動；既有決定性回歸測試**零修改**全綠。 |
| **NFR-58.3** | `poll()` 為每幀熱路徑，**不得**配置物件或陣列；program 陣列在 `start()` 時一次編譯完成（固定佈局紀律）。 |
| **NFR-58.4** | 合理上限（20 items × 20 reps = 400 run steps）下，`compileSessionProgram()` P95 < **1 ms**，表單預覽渲染 P95 < **50 ms**。 |
| **NFR-58.5** | 休息倒數只使用 render 迴圈傳入的 `nowMs`（`performance.now()` 域，ADR-4）；模組內**不得**出現 `Date.now()`。 |
| **NFR-58.6** | metadata 擴充為 additive：既有 golden/canonical fixture 的 parse、serialize 與 `research/` ingest 結果逐位不變。 |
| **NFR-58.7** | 表單可只用鍵盤完成（加入 / 排序 / 設 reps / 提交）；reps 與秒數輸入具 ARIA 標籤，錯誤訊息可被螢幕閱讀器讀取。 |
| **NFR-58.8** | `npm run build`、browser + node typecheck、全量 Vitest、全量 Playwright 皆 exit 0。 |

### 1.3 Constraints

- 純 TS + DOM overlay（D1）；不引入 React/Vue/Lit、不引入排程或狀態機函式庫。
- 排程層不得寫入 `SharedState`、不得呼叫 `SimLoop.pump`／`simStep`、不得讀寫 `DataRecorder` arena（ADR-2 三迴圈邊界）。
- reps **只**重複執行 drill，**永不**寫 `DrillConfig.endCondition.value` 或任何 drill 參數；`sessionPlanPresets.ts` 的「引用而非另存」紀律延續。
- `TEST_FAMILY_IDS` 的四元素內容與順序凍結；新家族只能加在 `KNOWN_SESSION_FAMILY_IDS`。
- 不得新增第二份 family allowlist、第二個 Session Plan runtime 或第二條 rest overlay 路徑（KI-016 教訓）。
- frozen `protocolVersion = 1.0.0` 的 Assessment 定義不動；本 WP 不觸碰 drill 參數、指標定義或 `research/` 演算法（C-D1～C-D5）。
- 不做：跨 session 的 program 儲存/載入、program 範本庫、暫停/跳過休息、中途插入 drill、program 匯入匯出檔。

### 1.4 Assumptions

- 使用者情境「A ×3 / 30s，60s，B ×3 / 30s，60s，C ×3 / 30s」成立的前提是 **A、B、C 各屬不同家族**；同家族相鄰 drill 依 FR-58.5 拿到 drill 休息（30s），這是模型定義而非缺陷，由 FR-58.13 的預覽表使其可見。
- 每一輪 rep 等同一次完整的 drill restart，沿用既有 `loadDrillById` → `activateDrill` 語意；本 WP 不改變 restart 的 seed 行為。**OQ-58.1 已於 T0 收斂為「逐輪相同」**（使用者 2026-09-08）⇒ T3 **不動** drill 載入路徑。
- ⚠️ **reps 的語意限制（T0 實證，已接受）**：同一 drill 的每一輪拿到**同一個 config seed**，spawn 序列逐位相同（`detection_popin_v1` 三輪的目標座標完全一致）。reps 因此是「**重複同一組刺激**」而非「同一難度的多次獨立取樣」，輪與輪之間存在**練習效應**。分析端**不得**把同一 item 的多個 rep 當成 i.i.d. 重複取樣；此限制須由 T5 寫入 metadata 契約與 `docs/operational/` 分析文件（C-D3 延伸）。
- 休息倒數在 tab 隱藏時的行為沿用現況（`poll()` 由 rAF 驅動，背景分頁會停擺）；本 WP 不新增背景計時補償。
- 自訂 program 的參與者仍走既有 eligibility gate 與 `SESSION_PLAN_MIN_CONDITION`，不新增顯示條件。
- 表單的 drill 清單來源為 `availableDrills`；未在對照表中登記家族的 drill 不出現在清單，而不是給一個 fallback 家族。

### 1.5 Open Questions

| ID | Question | Recommended default | Owner | Deadline | Impact if unresolved |
|---|---|---|---|---|---|
| **OQ-58.1** | 同一 drill 連跑 N 輪時，seeded spawn 序列應逐輪相同還是逐輪變化？ | ~~逐輪變化~~ ✅ **已收斂（使用者，2026-09-08）：逐輪相同，維持現況**——**未**採規劃建議。T0 實證三輪 seed 與 spawn 座標逐位相同（progress §T0 §5） | 使用者 | ~~T0 exit~~ 已收斂 | — ⇒ T3 **不動** drill 載入路徑；代價為練習效應，見 §1.4 |
| **OQ-58.2** | 同一 drill 三輪的匯出檔名如何保證唯一？ | ✅ **已收斂（使用者，2026-09-08）：不加 rep 序號**。T0 讀碼證實 basename **已含**每次 `activateDrill()` 重設的毫秒級 `startedAt`，實測三輪唯一（progress §T0 §4） | 使用者 | ~~T0 exit~~ 已收斂 | — ⇒ T5 只補唯一性回歸測試，**不改** basename 格式（既有匯出檔名逐位不變） |
| **OQ-58.3** | 休息 overlay 是否要顯示邊界種類與「下一個 drill 是什麼」？ | **要**：顯示剩餘秒數 + 邊界標籤 + 下一個 drill id，長 program 下操作員需要方位感 | 使用者 | T4 前 | 決定 `RestOverlay.show()` 的簽章擴充範圍 |
| **OQ-58.4** | 自訂 program 的 run 是否完全排除於 history 之外，還是可保存但標記為 custom cohort？ | ✅ **已收斂（使用者，2026-09-08）：沿用既有兩道閘 + 標記 `sessionPlanMode`**——**不**在 `HistoryPersistence` 新增第三道攔截（T0 證實兩道閘已與家族正交，progress §T0 §6） | 使用者 | ~~T0 exit~~ 已收斂 | — ⇒ 隔離落在 T5 的 **trend cohort 判定層**；`HistoryPersistence` 零修改 |
| **OQ-58.6** | frozen 軌 `tracking` 家族的代表 drill `tracking_v1` 未綁 `sceneId`，於開機場景 `field-low` 載入即 clearance throw ⇒ 勾該家族的 frozen session 開場即中止。要修嗎？怎麼修？ | ✅ **已收斂（使用者，2026-09-09）：採選項 ①**——`resolveFamilyDrillId('tracking')` 改為 `tracking_scene_v1`。選項 ② 被排除：單補 `sceneId` 不會修好（range 1 本來就過不了 `field-low`），還得一併收窄 motion range，那是改 `DrillConfig` 量測語意，違反本 WP 紅線且會讓 `tracking_v1` 既有資料不可比 | 使用者 | ~~T-exit 前~~ 已收斂 | — ⇒ **T-exit 已落地**：一行代表 drill 修正 + 不變量 5（每個家族代表 drill 必須自綁場景）+ frozen live e2e 實跑 `tracking` 家族 |
| **OQ-58.7** | 中止的 session 是否應呼叫 `experimentSession.exit()`？ | ✅ **已收斂（使用者，2026-09-09）：視為缺陷，修**。**T-exit 已落地**，且收斂成**一條規則**而非兩個 catch 各補一次：Session Plan 一旦進入 `done`（正常收工或中止）就 `exit()`，實作在 `main.ts` 的 `onPhaseChange`；完成分支原本那一行改為由此涵蓋，另在 `startSessionPlan()` 的 catch 補上（該路徑從未發佈 `done` phase） | 使用者 | ~~T-exit 前~~ 已收斂 | — ⇒ T6 失效案例的 `experimentActive` 斷言由 `true` 翻為 `false`，即修復的回歸證據 |
| **OQ-58.5** | stage12 是否需要一個獨立里程碑（下一個可用編號為 **M22**；M20／M21 已由 stage11 的 WP-54／WP-55 取用），涵蓋 WP-56 + WP-58？ | 待 stage12 範圍收斂後再定；本 WP 先以 T-exit 為交付判定 | 使用者 | stage12 收斂前 | 不影響本 WP 執行，影響 stage 層文件對帳 |

---

## 2. 系統架構與設計（Technical Design）

### 2.1 System boundary

#### In scope

| 檔案 | 動作 |
|---|---|
| `src/session/drillFamily.ts` | **新增**。drill ↔ family 雙向單一來源；`resolveFamilyDrillId()` 從 `SessionRunner.ts` 遷入 |
| `src/session/sessionProgram.ts` | **新增**。`SessionProgramPlan`／`ProgramStep`／`compileSessionProgram()` 純函式編譯器 |
| `src/session/sessionSchedule.ts` | 加入三個新家族 id 至 `KNOWN_SESSION_FAMILY_IDS`（加法） |
| `src/session/SessionRunner.ts` | 游標化；`SessionPlan` 擴充為可帶 program；移出 drill import |
| `src/ui/SessionPlanSetup.ts` | 改版為 drill 清單 + reps + 兩個秒數 + 編譯預覽 |
| `src/ui/RestOverlay.ts` | 擴充 `show()` 以顯示邊界與下一個 drill（依 OQ-58.3） |
| `src/data/metadata.ts` | additive 欄位 + strict validation |
| `src/main.ts` | 完成分支鏈改讀游標；metadata 注入條件更新；表單接線 |
| `tests/e2e/session-orchestrator.spec.ts` | 更新 Session Plan DOM 端到端 |

#### Out of scope

- 任何 `DrillConfig` / `SceneConfig` / drill 參數改動。
- `src/sim`、`SharedState`、`HitDetector`、`TargetManager`、`DataRecorder` 的任何改動。
- `src/metrics/`、`research/` 的指標定義與演算法。
- WP-56 micro-flick 場景本體（本 WP 只把它登記為可排程 drill）。
- program 的持久化、範本庫、跨 session 重用、匯入匯出。
- 休息期間的暫停／跳過／延長操作。

### 2.2 Data flow

```
操作員表單
   │  items: (drillId, reps)[]  +  drillRestSeconds  +  familyRestSeconds
   ▼
compileSessionProgram()            ← 純函式；查 FAMILY_BY_DRILL_ID 決定邊界
   │  ProgramStep[]
   ├──────────────► 預覽表（FR-58.13）：步驟列表 + 總時長估計
   ▼
SessionRunner.start(program)
   │
   ├─ step.kind==='run'  → loadDrillById(step.drillId) → 等 drill 結束
   │                        └→ main.ts 完成分支：匯出 payload（帶 itemIndex/repIndex）→ advance()
   └─ step.kind==='rest' → poll(nowMs) 倒數 step.seconds → RestOverlay → advance()
   │
   ▼
cursor === program.length → done → experimentSession.exit()
```

frozen 路徑差別只在**誰產生 program**：

```
frozen:  participantId + sessionIndex
           → buildFamilyOrder()            （counterbalance 輪轉，不變）
           → families.map(resolveFamilyDrillId) + reps=1
           → compileSessionProgram()       （同一個編譯器）
```

### 2.3 `drillFamily.ts` — drill ↔ family 雙向單一來源

```ts
/** drill → family。所有可排程 drill 的家族歸屬。表外的 drill 不可被排程。 */
export const FAMILY_BY_DRILL_ID: ReadonlyMap<string, SessionFamilyId>;

/** family → 該家族的代表 drill（自 SessionRunner.ts 遷入，行為不變）。 */
export function resolveFamilyDrillId(family: SessionFamilyId): string;

/** 可排程 drill 的有序清單，供 UI 建構選單。 */
export const SCHEDULABLE_DRILL_IDS: readonly string[];
```

歸屬表（**T0 已凍結，2026-09-08**；入帳 [GD-35](../../../DECISIONS.md)。下表為 `availableDrills` 的**實測** exact id，共 **36 個、零重複**；規劃期的舊表有六處 id 錯誤，逐項對照見 [progress.md](progress.md) §T0 §3）：

| 家族 | exact drill id（全部來自 `availableDrills`） | 數 |
|---|---|---|
| `hold-click` | `hold_click_v1` | 1 |
| `hold-track` | `hold_track_v1` | 1 |
| `spider-shot` | `spider-shot-v1`, `spider-shot-v2`, `spider-shot-v3` | 3 |
| **`spider-shot-wide`**（新） | `spider-shot-wide-v1` | 1 |
| `counterstrafe` | `counterstrafe-reversal-v1`, `counterstrafe-free-v1`, `counterstrafe_ad_v1` | 3 |
| `peek-click-transfer` | `peek_click_transfer_pilot_v1_2deg`, `peek_click_transfer_pilot_v2_1deg`, `peek_click_transfer_pilot_v2_2_5deg`, `peek_click_transfer_pilot_v2_5deg`, `peek_click_transfer_pilot_v2_randomized`, `peek_click_transfer_pilot_v2_masked` | 6 |
| `peek-click-transfer-v1` | `peek_click_transfer_v1` | 1 |
| **`tracking`**（新） | `tracking_v1`, `tracking_scene_v1`, `tracking_longrange_v1`, `tracking_br_v1`, `tracking_br_v1__ads_off__hitscan__0p5deg`, `tracking_br_v1__ads_on__hitscan__0p5deg`, `tracking_br_v1__ads_off__projectile__0p5deg`, `tracking_br_v1__ads_off__hitscan__2deg`, `tracking_br_v1__ads_on__hitscan__2deg`, `tracking_br_v1__ads_off__projectile__2deg`, `tracking_br_v1__ads_on__projectile__2deg` | 11 |
| **`detection`**（新） | `detection_popin_v1` | 1 |
| **`micro-flick`**（新） | `micro_flick_three_target_test_v1` … `_v8` | 8 |
| — | **合計** | **36** |

**代表 drill（`resolveFamilyDrillId()`，六個 frozen 家族行為不變）**：`spider-shot` → **`spider-shot-v3`**（**不是** v1/v2；規劃表誤植）、`counterstrafe` → `counterstrafe-reversal-v1`、`peek-click-transfer` → `peek_click_transfer_pilot_v1_2deg`。四個新家族的代表 drill 由 T1 決定並納入不變量 1。

> ⚠️ **T-exit 更正（OQ-58.6）**：`tracking` 的代表 drill 由 T1 的 `tracking_v1` 改為 **`tracking_scene_v1`**。代表 drill 是 frozen 軌**無人值守載入**的那一個，起點永遠是開機場景 `field-low`；`tracking_v1` 未綁場景且 1 u 的 motion range 過不了 `field-low` 的 rock/tree clearance ⇒ 勾該家族的 frozen session 開場即中止。`tracking_scene_v1` 是同家族、同 `endCondition` 的同一構念，差別只在綁 `field-low` 並把 range 收到 0.25 u。`tracking_v1` **仍可**排入自訂 program（由操作員決定它前面是什麼場景），只是不再代表家族——新增**不變量 5** 把「每個家族的代表 drill 都必須自己綁場景」釘死（唯一例外 `counterstrafe`，其三個 drill 早於場景綁定機制且本就是 `field-low` 原生）。

**Off-roster（不可排程）**：`counterstrafe-cued-v1`（模組存在但未註冊於 `availableDrills`）、`tracking_core_pr_pilot_v1`／`tracking_reversal_pilot_v1`（走 `loadDrillConfigDirect()`，由 `TrackingPilotRunner` 擁有）。

> ⚠️ **T1 硬性設計約束（D-58-T0-2）**：drill id 在本 repo **連字號與底線混用**（`spider-shot-v3` vs `micro_flick_three_target_test_v1`）。`FAMILY_BY_DRILL_ID` **必須**引用 drill 模組匯出的 `drillId`／`id` 常數建表，**禁止手打字面值**——規劃表的六處錯誤即由手打字面值造成。

不變量（測試斷言）：

1. `∀ f ∈ KNOWN_SESSION_FAMILY_IDS : FAMILY_BY_DRILL_ID.get(resolveFamilyDrillId(f)) === f`
2. `∀ id ∈ FAMILY_BY_DRILL_ID.keys() : id ∈ availableDrills`
3. `∀ id ∈ FAMILY_BY_DRILL_ID.keys() : FAMILY_BY_DRILL_ID.get(id) ∈ KNOWN_SESSION_FAMILY_IDS`
4. **解耦不變量（FR-58.3）**：`FAMILY_BY_DRILL_ID` 有登記 **⇏** `DrillMetricRegistry.registrationForExactDrill()` 有值；practice-only drill（micro-flick、pilot v1/v2、tracking/detection 系列）逐一負向斷言。

### 2.4 `sessionProgram.ts` — 編譯器契約

```ts
export interface SessionProgramItem {
  readonly drillId: string;
  readonly reps: number;               // 整數，≥ 1
}

export interface SessionProgramPlan {
  readonly items: readonly SessionProgramItem[];
  readonly drillRestSeconds: number;   // rep↔rep 與 drill↔drill
  readonly familyRestSeconds: number;  // family↔family
}

export type ProgramBoundary = 'rep' | 'drill' | 'family';

export type ProgramStep =
  | {
      readonly kind: 'run';
      readonly drillId: string;
      readonly family: SessionFamilyId;
      readonly itemIndex: number;
      readonly repIndex: number;       // 0-based
      readonly repCount: number;
    }
  | {
      readonly kind: 'rest';
      readonly seconds: number;
      readonly boundary: ProgramBoundary;
      readonly nextDrillId: string;
    };

export function compileSessionProgram(plan: SessionProgramPlan): readonly ProgramStep[];

/** 供預覽表用；不含 drill 本身耗時（未知），只加總休息秒數與 run 步數。 */
export function summarizeProgram(program: readonly ProgramStep[]): {
  readonly runCount: number;
  readonly totalRestSeconds: number;
};
```

編譯規則（FR-58.5～58.7），五條：

1. 每個 item 展開成 `reps` 個 `run` step，`repIndex` 自 0 遞增。
2. 相鄰兩個 `run` 之間插入一個 `rest`，`boundary` 依 item 與 family 判定。
3. `seconds = boundary === 'family' ? familyRestSeconds : drillRestSeconds`。
4. 頭尾不補 rest。
5. `seconds === 0` 的 rest 於編譯期省略。

**Golden 案例（使用者情境，T2 逐元素斷言）**：`items = [(A,3),(B,3),(C,3)]`、`drillRest=30`、`familyRest=60`，且 A/B/C 分屬三個不同家族 → 產生 17 個 step，`run` 9 個、`rest` 8 個（6×30s `rep` + 2×60s `family`），`program[0].kind === 'run'`、`program.at(-1)!.kind === 'run'`。

### 2.5 `SessionRunner` 游標化

```ts
export type SessionRunnerPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'run';  readonly step: RunStep;  readonly cursor: number }
  | { readonly kind: 'rest'; readonly step: RestStep; readonly cursor: number; readonly remainingMs: number }
  | { readonly kind: 'done' };
```

- `restDurationMs` 模組級變數移除，改讀 `phase.step.seconds`（FR-58.9 / 發現 3）。
- `warmup` phase 併入 `run`：frozen 路徑的熱身在編譯期就是 program 的第 0 個 `run` step（FR-58.17）。`main.ts` 的完成分支因此從「warmup / family 兩路」收斂成「run 一路」，四路 if-else 鏈變三路（發現 5）。
- `advance()`：`cursor += 1`；若 `cursor >= program.length` → `done`；否則依 step kind 進入 `run`（`await loadDrillById`）或 `rest`（重置倒數起點）。
- `poll(nowMs)`：僅在 `phase.kind === 'rest'` 生效，語意與現行一致，時長改讀 step。錯誤復原路徑原樣保留（FR-58.11 / 發現 4）。
- `runTransition()` 的 promise 序列化與 `.catch()` bookkeeping 原樣保留。

**行為等價證明**：T3 必須保留一組「frozen plan → 現行 `SessionRunnerPhase` 序列」的既有測試，改寫為對新 phase union 的等價斷言，並新增一條「frozen program 的 step 序列 = 四個 run + 三個 60s family rest」的編譯期斷言。

### 2.6 表單與預覽（FR-58.12／58.13）

```
┌─ Session Plan ─────────────────────────────┐
│ 模式：( ) 標準 Assessment   (•) 自訂 program │
│                                             │
│ 可排程 drill  [下拉]  [加入]                 │
│                                             │
│ 執行清單（拖曳排序）                          │
│  ⋮⋮ hold_click_v1          × [3] [移除]     │
│  ⋮⋮ spider_shot_v1         × [3] [移除]     │
│  ⋮⋮ counterstrafe_reversal × [3] [移除]     │
│                                             │
│ drill 休息秒數   [30]                        │
│ 家族休息秒數     [60]                        │
│                                             │
│ ── 預覽（17 步 · 休息合計 5 分 00 秒）──      │
│  1. ▶ hold_click_v1 (1/3)                   │
│  2. ⏸ 30s · rep                             │
│  …                                          │
│  6. ⏸ 60s · family → spider_shot_v1         │
│  …                                          │
│ [開始 Session Plan]  [取消]                  │
└─────────────────────────────────────────────┘
```

預覽在每次清單／秒數變動時重新編譯並重繪；編譯拋錯時顯示錯誤訊息並禁用提交（FR-58.7）。選「標準 Assessment」時清單區塊隱藏，走 frozen 路徑並保留 `includeWarmup`。

### 2.7 Metadata 擴充（FR-58.14～58.16）

```ts
/** 'frozen' = counterbalance 四家族凍結協定；'custom' = 操作員自訂 program。 */
sessionPlanMode?: 'frozen' | 'custom';
/** 實際執行的 program items；custom 模式必填。 */
sessionPlanItems?: readonly { readonly drillId: string; readonly reps: number }[];
/** custom 模式的 drill 休息秒數；既有 sessionPlanRestSeconds 繼續表示家族休息。 */
sessionPlanDrillRestSeconds?: number;
/** 本次匯出對應 program 中的哪一步。 */
sessionPlanItemIndex?: number;
sessionPlanRepIndex?: number;
```

- 全部 optional；缺席對舊 payload 合法（NFR-58.6）。
- `sessionPlanItems[].drillId` 對 `FAMILY_BY_DRILL_ID` 驗證，`reps` 對正整數驗證——沿用 `requireSessionPlanFamilyOrder()` 的同一 allowlist 來源，**不新增第二份**。
- `sessionPlanFamilyOrder` 在 custom 模式下由 items 推導後寫入（去除連續重複），維持既有欄位語意。
- history/trend 判定：`sessionPlanMode === 'custom'` → 排除於 frozen cohort（依 OQ-58.4 定案）。

### 2.8 Failure-mode design

| 失效 | 偵測 | 行為 |
|---|---|---|
| 清單含未登記 drill | 編譯期 `compileSessionProgram()` | 具名錯誤 + 表單顯示 + 禁用提交；永不到達 runtime |
| `reps` 非正整數 / 秒數為負 | 編譯期 | 同上 |
| `run` step 的 drill 載入失敗 | `advance()` reject | 中止 session、status 顯示原因、進 `done`、隱藏 rest overlay（FR-58.11） |
| 休息中 dispose / 離開 | `disposed` flag | `poll()` no-op，overlay 隱藏，無殘留 rAF |
| 匯出檔名碰撞 | T0 稽核 + T5 測試 | 依 OQ-58.2 於 basename 加 rep 序號 |
| 相鄰同家族 drill 拿到 drill 休息（非直覺） | 預覽表 | 顯式呈現邊界標籤，讓操作員在開始前看見（FR-58.13） |
| program 過長導致預覽卡頓 | NFR-58.4 | 400 run steps 上限量測；超出則預覽虛擬化（本 WP 不實作，記為 debt） |

### 2.9 硬約束衝擊（CLAUDE.md §4 逐條過閘）

| 硬約束 | 衝擊 | 處置 |
|---|---|---|
| 禁 `Date.now()`（ADR-4） | 休息倒數 | 沿用 `poll(nowMs)`，`nowMs` 來自 render 迴圈的 `performance.now()` 域；模組掃描斷言無 `Date.now`（NFR-58.5） |
| `three/webgpu` import | 無 | 排程層不 import Three |
| cross-origin isolation | 無 | 不改 COOP/COEP 或 gate 邏輯 |
| 決定性（同輸入序列跨 FPS 一致） | **需驗證** | 排程層不進 sim；既有決定性回歸測試零修改全綠（NFR-58.2）。編譯器本身為決定性純函式（NFR-58.1） |
| 移動目標以 `age` 純函式演進 | 無 | 不碰目標演進 |
| 三迴圈只透過 `SharedState`（ADR-2） | **需守** | `SessionRunner` 不引用 `SharedState`，只透過既有 `loadDrillById` seam；T-exit 邊界掃描斷言 |
| 固定佈局紀律 | **需守** | program 在 `start()` 一次編譯；`poll()` 熱路徑零配置（NFR-58.3） |
| UI = 純 TS + DOM（D1） | 適用 | 表單與預覽皆為原生 DOM |
| 鎖 Chrome/Edge | 無 | 不新增瀏覽器相依 |
| sim/recoil 禁 `Math.random()`（GD-5） | 無 | 編譯器無亂數 |
| spawn 隨機化一律 seeded（GD-5/GD-8） | ~~需決策~~ ✅ **已決** | OQ-58.1 收斂為「逐輪相同」⇒ **不新增 seed 推導、不動載入路徑**，既有 `sequence.seed` 寫入 metadata 的機制原樣沿用。代價（練習效應）見 §1.4，並須由 T5 寫入分析契約 |
| recoil 1/64s 步長 | 無 | 不碰 recoil |
| FPSci 授權紅線（GD-11） | 無 | 無外部程式碼引入 |
| 場景幾何不進 sim（GD-6） | 無 | 不碰場景 |
| 場景資產授權（GD-9） | 無 | 無新資產 |
| 解析度/場景切換不改 sim（GD-6/GD-10） | 適用 | 排程層落在 UI/session 層，沿用 `SESSION_PLAN_MIN_CONDITION` |
| 目標 hitbox 單一來源（GD-7/WP-23/WP-46） | 無 | 不碰命中幾何 |
| ADS 只落輸入/render/data 層（GD-16） | 無 | 不碰 ADS |
| 彈道 config-gated（GD-17） | 無 | 不碰彈道 |
| tracer render-only | 無 | 不碰 tracer |
| C-D1 `research/` ↔ `src/` 單向隔離 | **需守** | metadata 為 additive optional，`research/` ingest 不需改動即相容（NFR-58.6）；若 ingest 需讀新欄位，屬後續 WP |
| C-D2 `algorithms/` 純函式紀律 | 無 | 不動 `research/` |
| C-D3 教練報告紅線（GD-20） | **需守** | custom session 不得混入 frozen cohort 的趨勢與診斷（FR-58.16） |
| C-D4 既有構念不得有第二定義 | 無 | 不新增/修改任何指標構念 |
| C-D5 晉升指標雙實作對表 | 無 | 不觸及 `seg-v2`/`phase-v1`/`curve-v1`/`sync-v1`/`sg-seg-v2` |

### 2.10 決定性契約衝擊

本 WP **不修改** sim 迴圈、`SharedState`、輸入鏈或命中判定，因此對「同一輸入序列在不同 render FPS 下 sim 狀態一致」的契約**無直接衝擊**。三個間接風險與處置：

1. **reps 的 seed 語意**（OQ-58.1）——若採逐輪變化，seed 推導必須是決定性純函式且寫入 metadata，否則同一 program 的兩次執行不可重現。
2. **drill restart 路徑**——reps 走既有 `loadDrillById` → `activateDrill`，T3 必須驗證連續三次 restart 的 sim 起始狀態逐位一致（無殘留 velocity / recoil / arena 狀態）。
3. **`poll()` 熱路徑配置**——每幀配置會引入 GC 抖動，間接影響 render 迴圈；由 NFR-58.3 的零配置要求擋住。

### 2.11 三迴圈邊界（ADR-2）

`SessionRunner` 屬**應用編排層**，不屬三迴圈任何一環：

- 不 import `SharedState`、`SimLoop`、`InputSampler`、`DataRecorder`。
- 對 sim 的唯一影響是「載入哪個 drill」，且透過既有 `loadDrillById` seam，與現行 Session Plan 完全相同。
- `poll(nowMs)` 由 render 迴圈呼叫，只讀時間、寫自己的 phase，不寫任何共享狀態。
- T-exit 以模組邊界掃描斷言上述三點。

---

## 3. 風險分析（Risk Analysis）

### 3.1 Risk register

| ID | Risk | 影響 | 機率 | 緩解 | Failure mode |
|---|---|---|---|---|---|
| **R-58.1** | 游標化改壞 frozen Assessment 路徑 | 高（正式測試資料失真） | 中 | frozen 路徑編譯成同一 program 並保留既有行為測試；T3 加「frozen program = 4 run + 3×family rest」編譯斷言 | 家族順序或休息時長悄悄改變，資料看起來正常但不可比 |
| **R-58.2** | 新家族 id 讓 practice-only drill 取得 Assessment 資格 | 高（研究效度） | 中 | FR-58.3 解耦 + §2.3 不變量 4 的逐一負向斷言 | micro-flick 練習資料混入正式 cohort |
| **R-58.3** | 家族 allowlist 長出第二份（KI-016 重演） | 中 | 中 | `drillFamily.ts` 為唯一來源，metadata 與 runner 共用；T-exit 全 repo 掃描 family id 字面值 | 兩份清單漂移，某 drill 在 UI 可選但 metadata 拒絕 |
| **R-58.4** | `poll()` 熱路徑配置造成 GC 抖動 | 中 | 低 | NFR-58.3 零配置 + T3 配置計數測試 | 休息期間 frame time 尖峰，污染 frame log |
| **R-58.5** | ~~reps 的 seed 語意未定就實作~~ **已由 T0 關閉為「已知並接受的限制」** | 中 | — | OQ-58.1 已收斂為「逐輪相同」（使用者決議）。風險**不再是「未定」**，而是**已接受的設計限制**：三輪確實練到同一組位置 ⇒ 緩解改為**文件化**（§1.4 + T5 的 metadata／分析契約），而非技術防護 | 分析端誤把同一 item 的多個 rep 當 i.i.d. 取樣 ⇒ 由 T5 的契約文字擋 |
| **R-58.6** | ~~匯出檔名碰撞覆蓋前一輪資料~~ **T0 實證為低風險** | 高（資料遺失） | ~~中~~ **極低** | T0 已稽核 `exportBasename` 組成：含每次 `activateDrill()` 重設的毫秒級 `startedAt`，碰撞條件為同一毫秒啟動兩次（跨一整場 drill + 休息不可能）。T5 補一條唯一性回歸測試釘死 | 三輪只留下一份檔案且無警告 |
| **R-58.7** | metadata 擴充破壞既有 parse / `research/` ingest | 高 | 低 | 全部 optional additive + golden fixture 逐位不變回歸（NFR-58.6） | 既有分析管線在新欄位上炸掉 |
| **R-58.8** | 相鄰同家族 drill 只拿 30s，操作員未察覺 | 中（協定偏差） | 高 | FR-58.13 預覽表顯式標註每個休息的邊界種類 | 實際執行的休息時長與研究設計不符，事後才從 metadata 發現 |
| **R-58.9** | 表單複雜度上升破壞既有 E2E | 低 | 高 | 更新 `session-orchestrator.spec.ts` 而非新開平行 spec | 舊 selector 失效，E2E 紅但非真實缺陷 |

### 3.2 Conscious technical debt

- **預覽表不虛擬化**：400 run steps 以內直接全量渲染；超大 program 的效能問題明知而暫不處理（NFR-58.4 只涵蓋到 400）。
- **program 不持久化**：每次都要重新編排；範本庫與跨 session 重用留給後續 WP。
- **休息無法暫停/跳過**：沿用現行自動倒數；操作員中斷只能整場中止。
- **背景分頁計時**：rAF 停擺時休息倒數會停住，沿用現況不補償。
- **reps 重播同一組刺激（T0 新增）**：OQ-58.1 決議「逐輪相同」⇒ 同一 item 的各輪 spawn 序列逐位相同，存在練習效應。若日後需要「同難度多次獨立取樣」，須另開 WP 定義 `seed_rep = f(baseSeed, itemIndex, repIndex)` 並改動 drill 載入路徑。
- **表單需列 36 個 drill（T0 新增）**：roster 實測 36 項（`tracking` 11、`micro-flick` 8、`peek-click-transfer` 6）。T4 的選單**必須按家族分組**顯示才可用；本 WP 不做搜尋／過濾／我的最愛。

### 3.3 Performance bottlenecks

| 位置 | 風險 | Gate |
|---|---|---|
| `compileSessionProgram()` | 巢狀展開 items × reps | NFR-58.4：400 run steps P95 < 1 ms |
| 表單預覽重繪 | 每次輸入變動全量重建 DOM | NFR-58.4：P95 < 50 ms；必要時 debounce |
| `poll()` 每幀 | 物件配置 / 陣列掃描 | NFR-58.3：零配置，`O(1)` |

---

## 4. 任務拆解（Task Breakdown）

| Task | Objective | Dependencies | Risk | Complexity | Definition of Done |
|---|---|---|---|---|---|
| **T0** | Entry gate：blast radius 量測、drill→family 表凍結、OQ-58.1／2／4 收斂、~~GD-33~~ **GD-35** 入帳 | WP-56 不受影響之確認 | Med | 0.5–1d | ✅ **2026-09-08 完成**：production diff = 0、PoC 產物已刪；baseline typecheck exit 0 + Vitest 2,442 passed／2 skipped 且無既存失敗；CodeGraph impact 已入 progress 並對帳 §0.1（2 處補正）；36 個 exact drillId 歸屬表凍結（§2.3，更正規劃表六處 id 錯誤，新增第 4 個家族 `spider-shot-wide`）；`exportBasename` 三輪樣本有證據；三次連續 restart snapshot 逐位相同；OQ-58.1／58.2／58.4 皆有 owner 結論；GD-35 已寫入 DECISIONS.md |
| **T1** | `drillFamily.ts` 雙向單一來源 + 三個新家族 id + 解耦不變量 | T0 | Med | 0.5–1d | §2.3 四條不變量測試全綠；`resolveFamilyDrillId` 遷移後 `SessionRunner` 行為逐位不變；既有 `micro_flick` 負向測試零修改仍綠 |
| **T2** | `sessionProgram.ts` 純函式編譯器 + golden 表 | T1 | Med | 1–1.5d | ✅ **2026-09-08 完成**：47 個新測試全綠（五條規則表格測試、17 步 golden 逐元素、12 列非法輸入矩陣、決定性、同家族相鄰／0 秒省略／單步／A-B-A 四組情境）；400 run steps 編譯 p95 **0.0398 ms**（限額 1 ms）；模組純度掃描通過；全量 Vitest 2,538 passed／2 skipped、typecheck／build exit 0 |
| **T3** | `SessionRunner` 游標化 + `main.ts` runtime 接線 + reps seed 落地 | T2 | **High** | 1.5–2.5d | ✅ **2026-09-08 完成**：phase union 收斂為 `idle/run/rest/done`、模組級 `restDurationMs` 移除、`buildFrozenSessionPlan()` 讓 frozen 走同一編譯器與同一 runtime；`poll()` 以就地寫入達成每幀零配置（identity 斷言）；載入失敗復原保留；三次連續 rep restart 的 sim 起始狀態與 spawn 序列逐位一致；OQ-58.1「逐輪相同」落地（drill 載入路徑零改動）。全量 Vitest 2,570 passed／2 skipped、typecheck／build exit 0、Session Plan e2e 真實 Edge 通過 |
| **T4** | `SessionPlanSetup` 改版 + 預覽表 + `RestOverlay` 擴充 | T2（可與 T3 並行） | Med | 1.5–2.5d | ✅ **2026-09-08 完成**：`SessionPlanSelection` 改為 frozen／custom discriminated union；custom 軌提供依家族分組的 36 項 drill 選單、reps、▲▼／拖曳排序、兩級秒數與**由 `compileSessionProgram()` 直接渲染**的預覽表（UI 層零邊界推導）；`SessionProgramCompileError` 直接當錯誤文案並以 `itemIndex` 標列 + 禁用提交；`RestOverlay.show()` 帶邊界與 `nextDrillId`（OQ-58.3）；`main.ts` 兩軌共用同一編譯器與 runner。新增 25 測試（全量 **2,595 passed／2 skipped**）、typecheck／build exit 0、Session Plan e2e **零修改** 8 條全綠、799-step 預覽重繪 p95 **1.0756 ms**（限額 50 ms） |
| **T5** | metadata additive 欄位 + 每輪匯出 + history/trend 隔離 | T3 | Med/High | 1–1.5d | ✅ **2026-09-08 完成**：8 個既有 fixture 的 canonical JSON digest 逐位不變且 5 個新 key 皆不出現；validation 正負向矩陣全綠（寫入端查 `FAMILY_BY_DRILL_ID`、跨欄位成對／界內檢查，讀取端只驗形狀——roster 變動不得讓已存 run 讀不了，D-58-T5-4）；5 個 run step 產生 5 個唯一檔名且各自可定位到 `itemIndex`／`repIndex`；custom run 以新的 `excluded-cohort` status 排除於 trend cohort 而 `HistoryPersistence` 零修改（正反兩向皆有測試）；frozen 軌匯出逐位不變（D-58-T5-1）；`research/` ingest 以真實 `load_export()` 驗證零修改相容。新增 66 測試（全量 **2,661 passed／2 skipped**）|
| **T6** | E2E 整合 + 決定性/回歸對帳 | T3 + T4 + T5 | Med | 1–1.5d | ✅ **2026-09-09 完成**：擴充既有 spec（未新開平行 spec）；custom live run 走完 11 步 program，5 段休息各服完自己 step 的秒數、6 份匯出檔名互異、收工後 `experimentSession.active=false` 且 overlay 隱藏；frozen live run 家族順序／單一休息秒數／無熱身提示皆如舊；中途載入失敗以**真實故障**（`tracking_v1` 於 `field-low` 的 clearance 失敗）注入，證明中止且 overlay 不殘留。全量 Playwright **99 passed** exit 0、全量 Vitest 2,661 passed／2 skipped、既有決定性回歸零修改全綠 |
| **T-exit** | WP-58 驗收 | T1～T6 | Med | 0.5–1d | 自動閘全綠 + 驗收情境 A-58.1～9 皆有客觀證據 + 邊界掃描 + docs/graph 對帳 |

Task 詳細步驟與 local DoD 見同資料夾 `T*.md`。

### 4.1 Requirements traceability

| Requirement | Tasks | Verification |
|---|---|---|
| FR-58.1／58.2 | T1 | 雙向一致性不變量測試、allowlist 加法斷言 |
| FR-58.3 | T1／T5 | 解耦負向斷言、history 隔離測試 |
| FR-58.4～58.8 | T2 | 編譯器規則表格測試、17 步 golden、非法輸入矩陣 |
| FR-58.9～58.11 | T3 | phase 序列測試、失敗復原測試、零配置量測 |
| FR-58.12／58.13／58.17 | T4 | component test、預覽表快照、鍵盤/ARIA |
| FR-58.14～58.16 | T5 | metadata 正負向矩陣、檔名唯一性、cohort 隔離 |
| NFR-58.1／58.5 | T2／T3／T-exit | 模組邊界掃描 |
| NFR-58.2 | T3／T6／T-exit | 既有決定性回歸零修改全綠 |
| NFR-58.3／58.4 | T3／T4 | 配置計數、400-step benchmark |
| NFR-58.6 | T5 | golden fixture 逐位不變 |
| NFR-58.7 | T4 | 鍵盤操作 + ARIA 測試 |
| NFR-58.8 | T-exit | build／typecheck／Vitest／Playwright exit 0 |

---

## 5. 後續 WP handoff

WP-58 完成後，後續工作可依賴：

- `FAMILY_BY_DRILL_ID` / `SCHEDULABLE_DRILL_IDS` 作為「哪些 drill 可排程、屬哪個家族」的唯一問答點；
- `compileSessionProgram()` 作為任何排程 UI／manifest／自動化的共用編譯器（`TrackingPilotRunner` 的 `orderedBlocks` 未來可考慮收斂到同一型別，本 WP 不做）；
- `ProgramStep[]` 作為 Session Plan runtime 的穩定契約；
- `sessionPlanMode` / `sessionPlanItems` 作為分析端判斷 session 可比性的 metadata 依據。

後續 WP **不應**重新定義休息邊界語意或在 UI 層補編譯邏輯。

---

## 6. Execution rules

- 一個 task = 一個垂直切片 = 一個原子 commit；未完成 tests/evidence/progress，不開下一 task。
- 修改既有 symbol 前執行 CodeGraph impact 並記錄 affected files/symbols 與 local/cross-module 分級；pending file 直接讀。
- **不得**在本 WP 內修改任何 `DrillConfig`、drill 參數、指標定義或 `research/` 程式；發現需要時停下並入帳。
- **不得**新增第二份 family allowlist、第二個 Session Plan runtime 或第二條 rest overlay 路徑。
- 排程層 pure/deterministic；`sessionProgram.ts` 與 `drillFamily.ts` 不得 import DOM／Three／`node:*`／時鐘／亂數／sim。
- T3 修改 `main.ts` 前先確認完成分支鏈可收斂成三路；不得以 `if (customPlan)` 散落多處作為生命週期設計。
- 測試不得寫入真實 `data/session-history/`；不得把 Participant 資料加入 git。
- production code 修改後執行 `graphify update .`；T-exit 檢查 `git status --short`、staged names 與 CodeGraph pending。
