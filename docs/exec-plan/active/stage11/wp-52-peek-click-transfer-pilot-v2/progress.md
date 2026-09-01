# WP-52 — progress / decision log

## Status

- **Current**：✅ T0–T-exit 完成（2026-09-01）。真人手動走查後追加 D-52.9（角尺寸候選拉寬），詳見下方 2026-09-01 T-exit 追加項。**WP-53 go/no-go 已由 No-go 改為 Go（2026-09-01，D-52.13）**：使用者提供 3 場真人 `peek_click_transfer_pilot_v2_masked` session 匯出，加上人工 checklist 全數走查完成，見 [T4-manual-pilot-gate.md](T4-manual-pilot-gate.md)「Evidence collected」與全域 [DECISIONS.md GD-29](../../../DECISIONS.md)。
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

### 2026-09-01 — T3 Pilot evidence harness/report

- 新增 `src/pilot/peekClickTransferPilotEvidence.ts`：純函式 `buildPeekClickTransferPilotEvidenceReport(sessions)` 聚合任意數量 session 的 `PeekClickTransferPresentation[]`，輸出 `presentationCount`／`completionRate`／`timeoutRate`／`validFirstShotRate`／`leftRightBalance`／`flagCounts`；不產生 composite score（C-D3），不含 I/O（C-D2）。輸入型別只要求 `{ presentations }`，可直接吃 `derivePeekClickTransferMetrics()` 的回傳值或手工合成的測試 fixture。
- `peekClickTransferPilotEvidence.test.ts`：一組 committed synthetic fixture（5 個 presentation）覆蓋 timeout、first-miss→second-hit（`shotsToKill:2`）、pre-onset fire（`fire_before_measurement_onset`）、no-counter、外加一個 clean valid-first-shot hit；並驗證跨多 session 聚合不重複計算/不漏算，以及空樣本不除以零。
- `HistoryPersistence.test.ts` 新增 pilot v2 專屬 practice guard case：`drillId: 'peek_click_transfer_pilot_v2_2deg'` 且 `meta.assessment` 缺席時，`save()` 直接短路成 `excluded`，`client.saveRun` 未被呼叫——證明既有（drill-id-agnostic）practice guard（`payload.meta.assessment === undefined` 短路，`HistoryPersistence.ts:75-80`）自動涵蓋 pilot v2，不需要新增程式碼（D-52.2 保證 pilot v2 永不設 `meta.assessment`）。

### 2026-09-01 — T4 Manual pilot gate and documentation

- 新增 [T4-manual-pilot-gate.md](T4-manual-pilot-gate.md)：比照 WP-45 T-exit-gate.md 的「自動化證據 vs. 人工 checklist」分軌慣例。自動化證據小節列出 T1-T3 已綠燈的項目；人工 checklist 小節列出 pointer-lock/視覺手感/三候選手感/timeout 節奏/無 composite score 洩漏等 9 項，全部標記待真人研究者回填,明文聲明自動化測試不得冒充人工證據。
- 更新 `docs/operational/analysis-peek-click-transfer.md` 新增 §Pilot v2：v2 與 v1 的關係(獨立 module/id/seed,參數逐項沿用)、operator 如何透過既有自由 checkbox 排入 session、evidence report 介面、以及一段「Sampling limitations and what must not be claimed yet」——明確聲明本 repo 尚無真人 pilot 匯出,evidence report 只在 synthetic input 上被驗證過正確性。
- 更新 `CONTEXT.md`：`peek-click-transfer-pilot-v1` 詞條後新增 `peek_click_transfer_pilot_v2` 詞條,說明其為獨立 evidence-collection round、T0 拍板沿用 v1 數值、operator 如何排入 session、evidence report 用途。
- **WP-53 go/no-go：No-go,待人工執行**。本輪 WP-52 交付的 config/session wiring/evidence report 皆已機械驗證,但本 repo 尚無任何真人 trial 跑過 pilot v2。WP-53 開始凍結數值前需要:(1) 人工 checklist 回填且標註日期,(2) 至少一批真人 pilot session 的 evidence report,(3) 上述證據附掛回 [T4-manual-pilot-gate.md](T4-manual-pilot-gate.md) 或其後續 addendum。OQ-52-4(最小 participant 數)owner 為研究者,本輪不預設數字。

### 2026-09-01 — T-exit Pilot v2 acceptance and WP-53 handoff

- 新增 [T-exit-gate.md](T-exit-gate.md)，比照 WP-45 T-exit-gate.md 格式：Automated gate／Manual gate（連結 T4 文件）／Documentation gate／Exit result（明確列出「exit 不代表什麼」，防止過度宣稱）。
- Automated gate 全綠：`npm run typecheck` exit 0；全專案 `npx vitest run` 188 files / 1668 tests passed（2 skipped，既有、與本 WP 無關）；全專案 `npx playwright test`（edge channel）72 passed，含 WP-45 既有 `peek-click-transfer.spec.ts` 與 WP-52 T2 新增 case。
- 未修改 production code（本次只更新文件），仍執行 `graphify update .` 確認索引與最終狀態一致（3832 nodes / 9004 edges）。
- Documentation gate：`analysis-peek-click-transfer.md`／`CONTEXT.md`／`DECISIONS.md` GD-26／`KI-016`／`BUGFIX-DECISIONS.md` BD-016／stage11 `README.md`/`task-checklist.md`/`progress.md` 全數同步。
- WP-52 README 狀態頭更新為「T0–T4/T-exit 完成；WP-53 No-go 待人工執行」。

### 2026-09-01 — T4 追加：pilot v2 缺研究員模式入口（回答使用者「如何手動驗證」時發現）

- 使用者詢問如何手動驗證 T4 checklist 時,讀碼發現 pilot v2 當時**在跑起來的 app 裡完全點不到**:Session Plan 的 `'peek-click-transfer'` 家族仍解析到 v1 的 drill(`SessionRunner.ts` `resolveFamilyDrillId`,WP-45 既有語意,T2 未改也不該改——v1/v2 是分離 cohort,D-52.1);而 `main.ts` 的 `availableDrills`(研究員模式「單一 Drill 調整」選單)從未登記 v2。T4 checklist 文件本身雖然「就緒」,但沒有入口可實際執行,是本輪交付的一個缺口。
- 修復:`main.ts` 的 `availableDrills` 新增 `peekClickTransferPilotV2`(2° 預設候選)一筆,比照 v1 既有登記模式(v1 也只登記 2° 預設,1.5°/3° 未進選單——非新引入的限制)。
- 連帶發現並修復第二個「同一構念兩處定義」漂移:`main.ts` 的 `collectMeta()` 與 `src/testharness/fpsTestHarness.ts` 各自獨立寫了一份 `drillId === peekClickTransferPilotV1.id ? { visibility: ... } : {}` 的 visibility-meta 分支(WP-45 遺留,兩份平行維護)。只改 `main.ts` 那份會讓 `__fpsTest.forceExportJSON()`(Playwright 測試走的路徑)匯出缺 `visibility`——已在 `fpsTestHarness.ts` 同步補上 v2 分支,兩份維持一致(未動 v1 既有行為)。
- 新增 `tests/e2e/session-orchestrator.spec.ts` 案例：`startDrill('peek_click_transfer_pilot_v2_2deg')` → phase `running` → export 含正確 `drillId`/`visibility`。
- Verification：`npm run typecheck` exit 0；`npx playwright test tests/e2e/session-orchestrator.spec.ts` 5/5 passed；全專案 `npx vitest run` 188 files / 1672 tests passed（+4 於前次 T-exit，新增 e2e 不計入 vitest 但既有 suite 零回歸）；`graphify update .`（3835 nodes / 9019 edges）。
- `T4-manual-pilot-gate.md` 新增「How to reach it in the running app」小節，給出具體 dev-server 操作步驟；明確聲明 Session Plan 的 checkbox 路徑仍指向 v1，v2 手動測試要走研究員模式選單。

### 2026-09-01 — T-exit 追加：D-52.9 拉寬角尺寸候選（使用者真人手動走查回報）

- 使用者依上述步驟實際跑了一輪 `peek_click_transfer_pilot_v2_2deg`（匯出檔已核對：`drillId`/`rngSeed: 95020`/`hitbox.widthU: 0.279` 皆對得上 v2），回報三個角尺寸候選(1.5°/2°/3°)手感差異太小。
- 換算 widthU（distance 固定 8u,公式 `2×8×tan(deg/2)`）：1.5°→0.2095u,2°→0.2793u,3°→0.4188u——min→max 只差 2×,佐證回報屬實。
- 用 `AskUserQuestion` 提供三個選項（1/2/4°、1/2.5/5°、自訂），使用者選 **1/2.5/5°**（min→max ≈5×，widthU≈0.140/0.349/0.699u）。
- 落地：`peek_click_transfer_pilot_v2.ts` 的 `PEEK_CLICK_TRANSFER_PILOT_V2_ANGULAR_SIZE_CANDIDATES_DEG` 改為 `[1, 2.5, 5]`,`PEEK_CLICK_TRANSFER_PILOT_V2_DEFAULT_ANGULAR_SIZE_DEG` 改為 `2.5`(新預設 drill id 因此變成 `peek_click_transfer_pilot_v2_2_5deg`,取代前一則進度所述的 `..._2deg`)。同步更新 `.test.ts`、`pilotConfigs.test.ts`、`HistoryPersistence.test.ts`、`tests/e2e/session-orchestrator.spec.ts`、`T4-manual-pilot-gate.md`、`analysis-peek-click-transfer.md` §Pilot v2、`CONTEXT.md` 的所有 2° 預設參照。
- 順手修正 `analysis-peek-click-transfer.md` 一處既有錯誤敘述：先前寫「Session Plan checkbox 家族解析到 v2 的預設」，實際上一直是解析到 **v1** 的 drill（`resolveFamilyDrillId`，WP-45 語意，未變）；已改正並在同一段落補充手動測 v2 要走研究員模式選單。
- v1 guard 持續有效：本次未修改 `peek_click_transfer_pilot_v1.ts`／`.test.ts` 任何一行。
- Verification：`npm run typecheck` exit 0；全專案 `npx vitest run` 188 files / 1672 tests passed；`npx playwright test tests/e2e/session-orchestrator.spec.ts` 5/5 passed；`graphify update .`（3835 nodes / 9019 edges）。
- OQ-52-1 狀態由「Resolved（D-52.4）」改記為「Revised（D-52.9）」——這是研究方法上誠實的做法：D-52.4 在「無 evidence」前提下拍板，D-52.9 是在有 evidence 後的修訂，不是同一個決定被推翻，是決策鏈往前走一步。

### 2026-09-01 — T5（T-exit 後追加）：三個角尺寸候選同一輪內平衡隨機出現（使用者要求，D-52.10/11）

使用者問「是否可以讓目標是三個間距，隨機出現？」。讀碼後發現這比表面看起來大：現有架構是「一個 drill instance 建立時算好一個固定 hitbox、整輪共用」，而離線可見度推導（`visibilityDerivation.ts`）也只讀**單一** `meta.targets.hitbox` 快照套用到全部 tick——若不修正，隨機變動 hitbox 會讓非快照尺寸的 presentation 算出錯誤的 `tMeasurementOnsetMs`，進而讓 `validFirstShot`/`onsetToFirstShotMs` 等核心指標失真，違反 C-D4（onset 只能有一個權威定義）。用 `AskUserQuestion` 確認範圍（仍要做）、隨機化方式（平衡 shuffle，非純 IID）、trial 數（21，7/7/7 均分）後，分 6 個 commit 落地：

- **D-52.10**（新增引擎能力）：`DrillConfig.targets.hitboxCandidates?: readonly TargetHitboxConfig[]`——與 `hitbox` 互斥、需 `sequence.seed`、`count` 必須整除候選數（`schema.ts` 驗證）。`TargetManager` 建一個 seeded balanced-shuffle 佇列（比照 spider-shot WP-44 zone queue 模式：每候選出現次數相等、Fisher-Yates 洗牌，一次用完不重洗，因為總數與候選數整除），每次 spawn 彈出一個候選並標記新欄位 `TargetState.hitboxVaries`。`SimLoop` 的 `visible` event 只在 `hitboxVaries===true` 時額外帶出該次 presentation 的實際 hitbox（`hitboxWidthU/HeightU/DepthU/Shape`）——其餘所有既有 drill 的 `visible` event 逐位不變。`visibilityDerivation.ts` 新增選填 `hitboxAtTick` per-tick resolver（省略時行為完全不變）；`holdClickMetrics.ts` 從 `visibleEvents` 建這個 resolver 餵進去，修正了「單一全域 hitbox 快照」的正確性缺口——這是本次最關鍵的修復，不是這個 feature 的裝飾。`peekClickTransferMetrics.ts` 新增 `hitboxWidthU` 透傳；`peekClickTransferPilotEvidence.ts` 新增 `byCandidate` 分組（依 `hitboxWidthU` 或呼叫端提供的 label 函式）。
- **D-52.11**（新增 v2 randomized drill）：`peek_click_transfer_pilot_v2.ts` 新增 `buildPeekClickTransferPilotV2RandomizedConfig()`/`peekClickTransferPilotV2Randomized`（21 trials、seed 95100，與三個 fixed-candidate seed 95010/95025/95050 不重疊）+ `peekClickTransferPilotV2CandidateLabel(widthU)` 供 evidence report 標籤。註冊進 `main.ts`／`fpsTestHarness.ts` 的 `availableDrills`（兩處平行的 visibility-meta 分支比照既有 v1/v2 慣例各加一條——這是 WP-45 遺留的既有重複模式，本次未重構，只是照樣延伸）。
- 每個 slice 都先跑 focused tests 再跑全專案 `npx tsc --noEmit`/`npx vitest run`/相關 Playwright，確認零回歸才進下一步（增量實作紀律）；最終跑過一次全專案 `npx playwright test`（76 passed）。
- v1 guard 持續有效：`peek_click_transfer_pilot_v1.ts`／`.test.ts` 全程未修改一行。
- 1.5/2/3° 或新 1/2.5/5° 的**單一固定候選** drill（`peek_click_transfer_pilot_v2_<size>deg`）維持原樣、未被 randomized 變體取代——兩者是研究員模式選單裡並存的不同入口，各自服務不同比較方式。
- 寫 manual gate 文件時發現先前只登記了 2.5° 預設，1°/5° 沒有選單入口——與「比較候選」的目的不符。補上 `PEEK_CLICK_TRANSFER_PILOT_V2_CANDIDATES`（單一來源，`peek_click_transfer_pilot_v2.ts` 匯出全部三個固定候選），`main.ts`／`fpsTestHarness.ts` 的 `availableDrills` 註冊全部三個 + randomized；順手把兩處各自重複的 `drillId === X ? {visibility...} : {}` 條件鏈（v1 + 3 個 v2 固定候選 + randomized，共 5 條）收斂成一個 `Map` 查表，避免候選數再增加時繼續累加分支。新增 e2e 案例證明 1°/5° 個別可選可載入。全專案 typecheck/vitest（1697）/playwright（77）全綠。

### 2026-09-01 — masked-visual pilot variant（T5 之後，使用者請求）

- 使用者在準備人工走查 T4 checklist 時提出：想要一個受試者全程看到同一固定視覺大小、無法用「這顆看起來比較小」視覺線索猜出目前是哪個角尺寸候選的模式，用來排除意識性策略調整這個混淆。這與 GD-7（CLAUDE.md 硬約束：hitbox render/命中判定單一來源）字面牴觸，已透過 `AskUserQuestion` 呈現利弊，使用者明確拍板破例（見全域 [DECISIONS.md](../../../DECISIONS.md) GD-27）。
- 落地：`TargetHitboxConfig`/`TargetHitboxSize` 新增 opt-in `visualSize?`（[DrillConfig.ts](../../../../src/drill/DrillConfig.ts)），`schema.ts` 驗證，`TargetManager.pickHitbox()` 往下傳遞，`TargetView.sync()` 是**唯一**消費端——`HitDetector`/`SimLoop.targetAabb`/`clearance.ts`/`occlusionGeometry.ts`/離線 `trackingDerivation.ts` 一律不變,省略時任何既有 drill 逐位不變。
- 新增獨立 drill `peek_click_transfer_pilot_v2_masked`（同檔）：hitbox 仍逐一使用真實 1°/2.5°/5° 候選（balanced-shuffle,同 randomized cell 機制），每個候選額外帶同一個 2.5° 參考 `visualSize`；獨立 id/seed（95200 系），不影響既有固定候選與 T5 randomized 兩個 config。已註冊進 `main.ts` 研究員模式 drill 清單。
- 3 個垂直切片、各自 commit：(1) 型別 + schema 驗證（`DrillConfig.ts`/`schema.ts`/`schema.test.ts`），(2) render 佈線（`TargetManager.ts`/`TargetView.ts`/`TargetView.test.ts`/`state/types.ts`），(3) 新 drill + main.ts 註冊 + 專屬測試（`peek_click_transfer_pilot_v2.ts`/`.test.ts`/`main.ts`）。每個切片後 `tsc --noEmit` 全專案 exit 0；切片 3 後跑全專案 `npx vitest run`：188 files / 1708 tests passed（2 skipped，既有、與本次無關），零回歸。
- **已知缺口（記入 GD-27，非本輪範圍）**：匯出稽核軌跡尚未擴及——`SimLoop.ts` 的 `visible` event（`hitboxVaries` 分支）目前只帶真實 `hitboxWidthU` 等欄位，不含 `visualSize`；`ReplayTargetView.ts` replay 仍只會 render 真實 hitbox 尺寸。也就是說：**匯出的 JSON 目前無法回溯「受試者當下實際看到的視覺尺寸」**，只能回溯真實 hitbox。若之後要靠匯出資料做「遮罩是否確實達到視覺無差異」的稽核，需要補這段（`SimLoop.ts` 寫入 + `exportPayloadSchema.ts` 解析 + `ReplayTargetView.ts` 讀取），屆時另開切片。
- `graphify update .` 待本輪三個 commit 完成後執行一次確認索引狀態。

### 2026-09-01 — T4 manual gate 完成 + WP-53 go/no-go 改為 Go（D-52.13）

- 使用者親自逐項走查 [T4-manual-pilot-gate.md](T4-manual-pilot-gate.md) 的 9 項 manual checklist（直接在 IDE 內勾選），並提供 3 場真人 `peek_click_transfer_pilot_v2_masked` session 匯出（`rngSeed 95200`，同一 seeded 序列重跑 3 次）。
- 跑過 `derivePeekClickTransferMetrics()`（對真實 `peek-ad-corridor-v1` 場景）+ `buildPeekClickTransferPilotEvidenceReport()`：63 個 presentation、100% 完成率、0% 逾時率、`validFirstShotRate` 依候選呈現清楚梯度（1°=42.9%、2.5°=95.2%、5°=100%），零 flag 異常。完整表格與逐項 checklist 對應說明寫入 [T4-manual-pilot-gate.md](T4-manual-pilot-gate.md)「Evidence collected」章節。
- 使用者被明確告知 T4 文件原文「一兩位研究者是 smoke test，非 population-level pilot sample」的限制後，仍拍板 n=1 對本次 WP-53 T0 已足夠（D-52.13，OQ-52-4 Resolved）。WP-53 go/no-go 由 No-go 改為 Go，記入全域 [DECISIONS.md GD-29](../../../DECISIONS.md)。
- 本節本身不修改 production code（`derivePeekClickTransferMetrics`/`buildPeekClickTransferPilotEvidenceReport` 皆為既有函式，未變動任何一行）；後續把 WP-53 T1~T3 的 provisional 骨架轉為正式凍結值是 WP-53 自己的 progress.md 條目，不記在這裡。
- Verification：上述數據透過一次性 scratch 腳本（讀 3 個匯出檔 → `derivePeekClickTransferMetrics` → `buildPeekClickTransferPilotEvidenceReport`）人工核對後刪除，未留痕於 repo；未變動任何既有測試或 production code，故未重跑全專案測試（該次 verification 屬於既有函式的資料層驗算，非程式變更）。

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
| D-52.8 | WP-53 go/no-go：**No-go**，待真人執行 [T4-manual-pilot-gate.md](T4-manual-pilot-gate.md) 人工 checklist + 至少一批真人 pilot session evidence | 本 repo 尚無任何真人 trial；不得讓機械驗證(config/wiring/report 正確性)冒充真人 pilot evidence，否則違反 GD-20 pre-registration 紀律精神 | ⏭️ Superseded by D-52.13（2026-09-01，真人 checklist + evidence 到位後改為 Go） |
| D-52.9 | 修訂 D-52.4：v2 角尺寸候選由 `[1.5, 2, 3]` deg 改為 `[1, 2.5, 5]` deg，預設候選由 2° 改為 2.5° | 使用者親自跑過 T4 manual gate 後回報「三個候選手感差異太小」——原候選 min→max hitbox 寬度只差約 2×(0.21u→0.42u)；新候選拉大到約 5×(0.14u→0.70u)。這是本輪第一份真人 pilot 證據，D-52.4 當時「無 evidence 支持變更」的前提已不成立，故修訂而非新增平行決策 | Confirmed，使用者 2026-09-01 拍板（AskUserQuestion 三選一：1/2/4°、**1/2.5/5°**、自訂） |
| D-52.10 | 新增引擎能力 `DrillConfig.targets.hitboxCandidates`（balanced-shuffle seeded 候選集合）+ 連帶修正 `visibilityDerivation.ts`/`holdClickMetrics.ts` 原本「單一全域 hitbox 快照」對變動尺寸 presentation 算錯 onset 的正確性缺口 | 使用者要求「三個間距隨機出現」；讀碼發現不修正 onset 推導會讓 evidence report 的核心指標（`validFirstShot`/`onsetToFirstShotMs`）算錯，違反 C-D4 單一權威定義——這不是可以跳過的裝飾，是做對這個 feature 的必要前提 | Confirmed，使用者 2026-09-01 拍板「繼續做」（AskUserQuestion 確認範圍後） |
| D-52.11 | 新增 `peek_click_transfer_pilot_v2_randomized` drill（21 trials，7/7/7 平衡，seed 95100），與既有三個固定候選 drill 並存於研究員模式選單，不取代它們 | 平衡 shuffle（非純 IID）比照 spider-shot WP-44 zone queue 既有機制；21 是能被 3 整除、最接近 v1/v2 既有 20-trial 慣例的數字 | Confirmed，使用者 2026-09-01 拍板（AskUserQuestion：平衡 shuffle + 21 trials） |
| D-52.12 | 新增 `TargetHitboxConfig.visualSize?`（GD-7 記名例外，見全域 [DECISIONS.md](../../../DECISIONS.md) GD-27）+ 新 drill `peek_click_transfer_pilot_v2_masked`：render 固定套用 2.5° 參考尺寸，hitbox（命中判定/clearance/occlusion）仍逐一使用真實 1°/2.5°/5° 候選 | 使用者要求「受試者看不出目前是哪個候選」以排除意識性視覺線索混淆；`visualSize` 為 opt-in 欄位、省略時任何既有 drill 逐位不變，例外範圍收斂到單一新 drill | Confirmed，使用者 2026-09-01 拍板「明確破例」（AskUserQuestion 呈現 GD-7 衝突與兩個設計選項後） |
| D-52.13 | OQ-52-4 拍板：n=1（使用者本人）× 3 場 `peek_click_transfer_pilot_v2_masked` session 已足夠支持 WP-53 T0 formal freeze；WP-53 go/no-go 由 No-go 改為 Go | 使用者在被告知 T4-manual-pilot-gate.md 原文「一兩位研究者是 smoke test，非 population-level pilot sample」的前提下，仍明確選擇以此推進——是研究者本人的自主判斷，非本文件逕自假設達標 | Confirmed，使用者 2026-09-01 拍板；詳見全域 [DECISIONS.md GD-29](../../../DECISIONS.md) |

## Open Questions

| ID | 問題 | Owner | Deadline | Impact |
|---|---|---|---|---|
| OQ-52-1 | target angular size policy | 使用者 + 研究者 | T0 | 🔁 Revised（D-52.9，2026-09-01：首份真人手動走查回報候選間距太小，拉寬為 1/2.5/5°；不再是 D-52.4 的 1.5/2/3°） |
| OQ-52-2 | timeout policy | 使用者 + 研究者 | T0 | ✅ Resolved（D-52.5） |
| OQ-52-3 | transfer warmup policy | 使用者 | T0 | ✅ Resolved（D-52.6） |
| OQ-52-4 | formal go/no-go evidence threshold | 研究者 | T4 | ✅ Resolved（D-52.13，2026-09-01：n=1 本人 × 3 session 對本次 WP-53 T0 已足夠；非未來其他 formal assessment 的通用門檻） |

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
| 2026-09-01 | `npx vitest run src/pilot/peekClickTransferPilotEvidence.test.ts src/history/HistoryPersistence.test.ts` | 2 files / 17 tests passed（T3） |
| 2026-09-01 | `npx tsc --noEmit`（T3 後） | exit 0（全專案） |
| 2026-09-01 | `npm run typecheck`（T-exit） | exit 0（`tsc --noEmit` + `tsc --noEmit -p tsconfig.node.json`） |
| 2026-09-01 | `npx vitest run`（T-exit，全專案） | 188 files / 1668 tests passed，2 skipped（既有、與本 WP 無關） |
| 2026-09-01 | `npx playwright test`（T-exit，全專案，edge channel） | 72 passed |
| 2026-09-01 | `graphify update .`（T-exit 確認） | 3832 nodes / 9004 edges rebuilt，與 T4 後一致 |
| 2026-09-01 | `npm run typecheck`（researcher-mode 入口修復後） | exit 0 |
| 2026-09-01 | `npx playwright test tests/e2e/session-orchestrator.spec.ts` | 5/5 passed（新增 v2 入口 case） |
| 2026-09-01 | `npx vitest run`（全專案） | 188 files / 1672 tests passed |
| 2026-09-01 | `graphify update .` | 3835 nodes / 9019 edges rebuilt |
| 2026-09-01 | `npm run typecheck`（D-52.9 角尺寸候選拉寬後） | exit 0（全專案） |
| 2026-09-01 | `npx vitest run`（全專案，D-52.9 後） | 188 files / 1672 tests passed |
| 2026-09-01 | `npx playwright test tests/e2e/session-orchestrator.spec.ts`（D-52.9 後） | 5/5 passed |
| 2026-09-01 | `graphify update .`（D-52.9 後） | 3835 nodes / 9019 edges rebuilt |
| 2026-09-01 | T5 slice 1/N：`npx vitest run src/drill/schema.test.ts src/sim/TargetManager.test.ts` + 全專案 `npx vitest run`（後） | schema 48 tests；TargetManager 49 tests；全專案 1676 tests passed |
| 2026-09-01 | T5 slice 2/N：`npx vitest run src/loop src/data/exportPayloadSchema.test.ts src/sim/TargetManager.test.ts` + 全專案 | 184 tests（focused）；全專案 1683 tests passed |
| 2026-09-01 | T5 slice 3/N：`npx vitest run src/metrics/holdClickMetrics.test.ts src/metrics/visibilityDerivation.test.ts src/metrics/peekClickTransferMetrics.test.ts` + 全專案 + `tests/golden` | focused 16 tests；golden/parity 52 tests；全專案 1686 tests passed |
| 2026-09-01 | T5 slice 4/N：`npx vitest run src/pilot/peekClickTransferPilotEvidence.test.ts src/metrics/peekClickTransferMetrics.test.ts` + 全專案 | focused 16 tests；全專案 1691 tests passed |
| 2026-09-01 | T5 slice 5/N（randomized config + main.ts/fpsTestHarness.ts 註冊）：`npx vitest run src/drill/peek_click_transfer_pilot_v2.test.ts` + 全專案 + `npx playwright test tests/e2e/session-orchestrator.spec.ts`（6 cases）+ 全專案 `npx playwright test` | v2 config 14 tests；全專案 1697 vitest tests；session-orchestrator 6/6；全專案 playwright 76/76 |
| 2026-09-01 | `graphify update .`（T5 最終） | 3843 nodes / 9044 edges rebuilt |
