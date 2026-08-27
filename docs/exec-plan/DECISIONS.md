# DECISIONS — 全域決策與跨文件矛盾帳本

> 專案的**全域 episodic memory**:記跨 WP / 跨文件的 **feature/WP 決策**(`GD-n`)、未解問題、文件間的不一致。
> per-WP 的決策與意外寫在各 WP 的 `progress.md`;**跨界的**(影響規格 / PLAN / 多個 WP)才寫這裡。
> **修 bug 的決策(`BD-n`)另記** [known_issue/BUGFIX-DECISIONS.md](../known_issue/BUGFIX-DECISIONS.md);本檔只收 feature/WP 決策。
> 索引:[exec-plan/README.md](README.md) · 術語:[CONTEXT.md](../../CONTEXT.md) · 導航:[docs/MAP.md](../MAP.md)
> 語言:繁體中文,術語保留英文(D4)。最新在上。

---

## 1. 既有決策的權威來源(本檔不複製,只指路)

| 類別 | 出處 | 內容 |
|---|---|---|
| 架構決策 **ADR-1~9** | [規格書](../規格書_Three.js_WebGPU_反向急停瞄準訓練器.md) | 1 WebGPU+fallback、2 雙迴圈、3 固定步長 128Hz、4 計時/cross-origin、5 Pointer Lock 原始輸入、6 目標 motion registry、7 兩個時鐘、8 peek 推進 P2、9 source unit |
| 規劃補充決策 **D1~D5** | [PLAN.md §1](../PLAN.md)（該檔 🧊 **已凍結**;僅 §1 仍為權威,其餘段落停在階段 A 不得引用) | 2D UI 技術、測試框架、COOP/COEP 部署、文件語言、PLAN 顆粒度 |

> 上述為已定案的權威決策,改動須回原文件並在此記一筆變更。

---

## 2. 未解 / 待對帳項(OPEN)

> 狀態:🔴 矛盾待解 · 🟡 待決策 · ✅ 已解(移至 §3 並標日期)

### GD-26 🟡 GD-24/FR-G9 缺口 — Session Plan preset 切換決議未實際接線(2026-08-26)

| | |
|---|---|
| **發現處** | 使用者詢問「Session Plan 固定測試家族能否改成下拉選單置換」,讀碼稽核 [SessionPlanSetup.ts](../../src/ui/SessionPlanSetup.ts)、[sessionPlanPresets.ts](../../src/session/sessionPlanPresets.ts)、[main.ts](../../src/main.ts) 三處時發現:`main.ts:360-361` 建立 `createSessionPlanSetup({ families: TEST_FAMILY_IDS, ... })` 是**寫死餵入四家族常數**,`sessionPlanPresets.ts` 的 `SESSION_PLAN_PRESETS` 註冊表(`pilot-default`/`transfer-pilot-v1`)完全沒有被操作端 UI 消費——只用在 `metadata.ts` 的 `sessionPlanPreset` 欄位驗證(`findSessionPlanPreset`),但該欄位在匯出時也從未被實際填值([main.ts:516-521](../../src/main.ts#L516) 只填 `sessionPlanRestSeconds`/`sessionPlanFamilyOrder`,漏了 `sessionPlanPreset`)。 |
| **與既有決議的落差** | [GD-24](#gd-24-✅-stage7-採納--選手測試流程前端優化wp-40~42--m17--session-plan-preset-分層決策2026-08-25-採納m17-達成2026-08-25) 的「決議(FR-G9,Session Plan 兩類可調性)」明文:「**②session-plan preset**……**切換既有 preset 對任何操作者開放**」,且驗收清單 G 的 G-5 已標示通過(`docs/operational/acceptance-stage-g.md`)。但實測程式碼 = 操作端從未真的能選第二個 preset(`transfer-pilot-v1`),UI 只有寫死的單一四家族清單。G-5「只能選具名常數不得自由輸入數字」字面上成立(因為根本沒有輸入框),但 FR-G9 承諾的「可切換」能力並未交付。 |
| **未決** | 這屬於**已決議但未落地**,不是新的 feature 決策,也不是單純的程式 bug(沒有錯誤行為,只是缺功能)——暫不歸入 `known_issue/`(該處已就緊鄰的一個獨立 latent bug 開 [KI-016](../known_issue/KI-016-session-plan-family-order-validator-stale-allowlist.md),但 KI-016 只涵蓋 `metadata.ts` 驗證漏洞,不涵蓋這裡的「UI 沒接 preset 切換」本身)。要不要落地、何時落地、算補完 WP-42 還是開新 WP,留待使用者後續拍板;此條僅記錄落差存在,不預先假設處置方式。 |
| **影響面** | [SessionPlanSetup.ts](../../src/ui/SessionPlanSetup.ts)(型別目前鎖 `TestFamilyId`,若要接 `transfer-pilot-v1` 需放寬至 `SessionFamilyId`)、[main.ts:360-361](../../src/main.ts#L360)、[main.ts:516-521](../../src/main.ts#L516) 的 `sessionPlanPreset` 匯出欄位補值;落地前必須先解決 [KI-016](../known_issue/KI-016-session-plan-family-order-validator-stale-allowlist.md)(否則含 `'peek-click-transfer'` 的 session 匯出會 throw)。 |
| **狀態** | 🟡 落差已記錄(2026-08-26),處置方式待使用者拍板;`active/stage7/` 相關文件與驗收清單 G 暫不回改,待決定是否需要更正 G-5/FR-G9 的完成度敘述。 |

### GD-25 ✅ WP-45 pilot-ready — peek-click transfer 與元件量測邊界、共用遮擋 kernel(2026-08-26)

| | |
|---|---|
| **發現處** | 使用者將 Kovaak's Peek and Click 的「移出掩體→目標曝光→反向急停→首發／補槍」循環帶入本專案。讀碼確認既有 `hold-click-v1` 已量測目標自身移動造成的曝光、`counterstrafe-reversal-v1` 已量測固定 hold→reversal 制動，但沒有「玩家自身 A/D 位移造成曝光」的整合情境；同時既有 hitscan 只測 target AABB，會穿過 scene prop。 |
| **決議** | 交付 `peek-click-transfer-pilot-v1` 作為 **Practice/pilot-only integrated transfer test**：20 個嚴格 L/R presentations、A/D cue、9-point `0.5` visibility onset、反向急停首發、miss 可補槍、hit/3000 ms timeout 推進。它不取代 hold-click 或 counterstrafe component assessments，沒有 composite score，不進 stage6 Assessment history/compatibility/diagnosis。正式 Assessment、樣本數/power、target size/timeout numeric freeze 必須由真人 pilot 後另立 WP。 |
| **決議(遮擋)** | 新增 `occlusionGeometry` 作為 offline visibility derivation 與 runtime hitscan gate 的共同 segment/AABB 權威：target ray 先碰 prop 時不 kill，impact/tracer 停在 blocker。`hitscanOcclusion` 是 `SimLoop` 的 additive context；省略時既有 drills 走原路，projectile 不讀該 context。 |
| **理由** | 同一個遊戲循環同時混合曝光、獲取、制動、首發與補槍；把它壓成一個診斷或分數會失去可歸因性。共用幾何 kernel 防止「畫面已曝光但射擊仍穿牆／或反之」的雙重定義。以 versioned transfer roster 而非修改 stage6 四家族 roster，確保既有順序與 frozen protocol 不漂移。 |
| **影響面** | `src/scene/occlusionGeometry.ts`、visibility/hitscan path、`peek-ad-corridor-v1`、pilot drill/metrics、transfer-pilot session roster；術語與操作契約見 [CONTEXT.md](../../CONTEXT.md) 與 [analysis-peek-click-transfer.md](../operational/analysis-peek-click-transfer.md)。 |
| **狀態** | ✅ WP-45 T-exit：程式與自動化驗收已完成，僅宣告 pilot-ready；不等於構念效度、信度或 Assessment 採納。**WP-49 T0 應用（2026-08-27）**：使用者原提議 WP-49 metric registry 同時涵蓋 spider-shot-v2 與 peek-click-transfer；稽核確認 `peek_click_transfer_pilot_v1` 仍是 `mode: 'practice'`，依本決議結構上不可能產生 `meta.assessment`、故不可能被 WP-48 保存進歷史，WP-49 T4 registry 因此只註冊 `spider-shot-v2`。peek-click-transfer 要納入 history/trend，前提是先有 assessment-mode 變體，屬另立的跨 WP 決定，本決議不預先假設處置方式。詳見 [wp-49 progress.md D-49.P9](active/stage10/wp-49-history-library-and-trends/progress.md)。 |

### GD-24 ✅ stage7 採納 — 選手測試流程前端優化:WP-40~42 / M17 + Session Plan preset 分層決策(2026-08-25 採納;M17 達成 2026-08-25)

| | |
|---|---|
| **發現處** | 使用者提出選手測試流程(pilot 階段版)SOP,要求盤點現有前端能否支撐;讀碼稽核(對話紀錄)發現 stage6(WP-33~39)交付的是四個測試家族的**引擎/指標能力**,但「一整場測試怎麼被操作」這層幾乎不存在:無跨家族排程(僅 `loadDrillById()` 單次載入一個 drill)、無家族順序 seeded counterbalance、`ResultScreen` quality-gate 卡片值硬編 `'ok'`([`ResultScreen.ts:383`](../../src/ui/ResultScreen.ts#L383))、metadata 缺 DPI 欄位。詳細落差表見 [stage7 README §0](completed/stage7/README.md#0-背景與讀碼依據)。 |
| **決議(編號)** | 採納為 **WP-40~42 / M17 / 驗收清單 G**(`docs/operational/acceptance-stage-g.md`,待建)。依 GD-15「先採納先得」,字母標籤取下一個未用字母 **G**(A=stage1、B=stage2、C=stage3、D=stage4、E=stage5、F=stage6)。三個 WP:WP-40 quality-flag 呈現(`ResultScreen` 動態化 + DPI)、WP-41 seeded 家族順序純函式(`buildFamilyOrder`,家族內條件排程範圍待 T0 判定)、WP-42 session orchestrator(`SessionRunner` 狀態機 + 休息 overlay + 熱身 + 家族子集/preset 選擇)。 |
| **決議(FR-G9,Session Plan 兩類可調性)** | Session Plan 總覽允許操作者調整兩類參數,可調性刻意不對稱:① **家族子集**——自由勾選,不動任何凍結數值,對應 SOP 本身「聚焦診斷可只跑部分家族但仍需跑滿平衡條件」的既有允許。② **session-plan preset**(trial 數/休息秒數的具名組合)——**只能選既有具名 preset,不得渲染任何自由數字輸入框**。理由:相容比較鍵(`compatibilityKey.ts`)未把這些數字納入判定式,若可自由填數字,同一 `protocolVersion` 下的 session 可能悄悄變得不可比較;且自由輸入會重開「調參數到資料好看為止」的門(GD-20 要防的事)。「切換既有 preset」對任何操作者開放,「新增/修改 preset 本身」限研究者,走跟協定凍結常數(WP-39 模式)同一套「新增具名常數 + 記錄」流程。 |
| **決議(Spider Shot 特例)** | Spider Shot 的「量」參數形狀與其他三家族不同:v1 只有**單一總目標數**(`targets.count`/`endCondition.value`,現 20)+ 時間上限 backstop(`timing.timeLimitMs`),沒有「每個條件格 N trial」這個維度(因為目前只有一個 `D_deg`/`W_deg` 條件格,已由 GD-23 凍結)。`SessionPlan` preset 的型別設計不得對四家族假設同一套「trial 數」欄位形狀,須用 discriminated union 分開表達;若未來 Spider Shot 需要多個條件格水準,那是 stage6 **OQ-S6-4** 範疇,stage7 不越俎代庖新增。 |
| **決議(與 stage6 邊界)** | 本階段**不修改**stage6 已交付的任何協定/指標邏輯或 `pilotConfigs.ts`;stage6 的 pilot-candidate 常數(校準用)與 stage7 的 session-plan preset(操作排程用)獨立管理,不共用同一套「pilot 態」標記機制(關閉 OQ-S7-3)。 |
| **理由** | 呼應既有 GD-5/GD-8/GD-20 pre-registration 紀律(凍結參數不得為了讓資料好看而事後調整)與 C-D4(既有構念不得有第二定義):Session Plan UI 若允許自由改動協定層數值,等同在 orchestration 層開一個繞過協定凍結流程的後門。三層架構(協定原始碼 → DECISIONS.md 記錄 → stage7 preset 呈現)把「真正改參數」與「操作當下選哪組」明確分開。 |
| **影響面** | [stage7 README](completed/stage7/README.md) 全篇;[exec-plan/README.md](README.md) §2/§3/§4/§6;[docs/MAP.md](../MAP.md) §3。 |
| **狀態** | ✅ **stage7 全數交付(2026-08-25),M17 達成**:WP-40~42 全部 T0~T-exit 完成,驗收清單 G(`docs/operational/acceptance-stage-g.md`)G-1~G-5 全項通過。`active/stage7/` 已於 T-exit 移入 `completed/stage7/`(使用者拍板,2026-08-25)。 |

### GD-23 ✅ Stage6 v1 provisional numeric freeze and coordinated release (2026-08-25, WP-39 T2)

| | |
|---|---|
| **Decision** | Freeze `STAGE6_PROTOCOL_VERSION = '1.0.0'`, `DIAGNOSIS_THRESHOLDS_V1.version = 'recommendation-v1.0.0'`, baseline window/minimum `5/3`, hold-click/hold-track distance levels `near/mid/far = 6/8/10u` (formal default = mid), Spider Shot `D_deg = 15` with hitbox `1×2×1u` (canonical `W_deg` remains derived from exported geometry), reversal `holdDurationMs = 500`, visibility `N=9` / threshold `0.5`, and default feedback policy `minimal-end-of-block`. All four assessment task ids release together on 2026-08-25. |
| **Evidence / limitation** | No human pilot export is committed in this repository. Per WP-39 T2, the existing pre-registered candidates are provisionally frozen to validate the release mechanism; a future data-backed change must preserve this record, create a new version string, and cite its pilot sessions/statistic rather than mutate these values in place. |
| **Alternatives considered** | (1) Leave the candidate version in production until a human study completes: rejected because it prevents a versioned formal baseline and leaves athlete-facing diagnosis marked pilot-only. (2) Freeze each family independently: rejected for this release; one coordinated `1.0.0` makes compatibility behavior unambiguous. (3) Store `W_deg` as a second constant: rejected because `deriveSpiderShotTransitions()` must remain the sole geometry conversion authority. |
| **Impact** | `main.ts` reads formal version, diagnosis table, and history constants; four protocol configs expose their frozen values as named constants; pilot candidate thresholds stay in source for audit. |

### GD-22 ✅ stage6 採納 — 個人瞄準能力測試框架 v1:WP-33~39 / M16 + WP-34 獨立 T0 spike(2026-08-19;M16 達成 2026-08-25)

| | |
|---|---|
| **發現處** | [stage6 計畫](completed/stage6/README.md)(源自 [`completed/stage6/aim-assessment-framework-v1.md`](completed/stage6/aim-assessment-framework-v1.md),2026-08-19 提案)採納規劃。讀碼對帳發現框架草稿隱含的「架槍可見度時間線是既有能力延伸」與現況不符:`events` 目前只有二元 `visible`(WP-21 pop-in),而場景幾何依 **GD-6** 硬約束永不進 sim runtime,只能被 render/scene validation 層讀取——連續 `visibleFraction(t)` 是全新能力,工程量未知,結構上類似 WP-32 讀碼後才發現隱藏 ω/SG/分段鏈的情況(見 GD-19/GD-21 先例)。 |
| **決議(編號)** | 採納為 **WP-33~39 / M16**、驗收清單 F(`docs/operational/acceptance-stage-f.md`,待建)。依 GD-15「先採納先得」,字母標籤取下一個未用字母 **F**(A=stage1、B=stage2、C=stage3、D=stage4、E=stage5)。七個 WP:WP-33 共同契約、WP-34 `hold-click-v1`+可見度、WP-35 `hold-track-v1`、WP-36 `spider-shot-v1`、WP-37 急停三協定包裝、WP-38 診斷推薦、WP-39 calibration pilot + 凍結(M16)。 |
| **決議(WP-34 獨立 T0 spike)** | **WP-34 的 task 切分與估時不在本次採納鎖定**。WP-34 T0 定義為零程式碼的獨立讀碼 spike:評估三個可見度計算候選方案(render 層逐幀投影/raycast、scene validation 層封閉幾何解析、兩者混合的離線重建)的成本,允許降級為離散可見度階梯作為 fallback。spike 可提前於 WP-33 完成前執行(不寫入任何 `DrillConfig`/`TargetManager` 欄位,無跨 WP 依賴風險)。若 spike 判定成本過高需要拆分 WP,**WP-35 起編號依 GD-15 原則順延**,回本檔補一筆決議。 |
| **理由** | ① **可見度時間線是全框架唯一觸碰 GD-6 邊界的新能力**,若不先驗證可行性就依框架草稿的樂觀估時排程,後段 WP-35(依賴 WP-34 的 emergence 機制)與整體交付順序都可能被打亂,重演 WP-32 D-32.0「規劃稿 2–3d → 讀碼後上修為 4.5–5.75d」的教訓。② **獨立 spike 可提前跑**是因為它是純調查、零程式碼,不佔用 WP-33 的檔案熱區,提前暴露風險的成本趨近零。③ 三個候選方案分別對應專案已有的三種先例做法(WP-20 frame-time log 的 render 層記錄模式、`clearance.ts` 的封閉幾何驗證模式、WP-21 的離線推導模式),spike 的產出應優先評估能否複用既有模式而非發明新機制。 |
| **未決** | WP-38 診斷推薦引擎的落點(TS 即時 vs 比照 stage4 走 Python offline `research/`)列為 **OQ-S6-8**,留待 WP-38 T0 讀碼後拍板,不在本次採納預先假設。框架草稿的六項 calibration 數值(可見門檻/世界距離/角距角尺寸/樣本數/回饋時機)維持 pilot 後凍結(OQ-S6-1~6),不阻塞本次 WP 拆分採納。 |
| **影響面** | [stage6 README](completed/stage6/README.md) 全篇;[exec-plan/README.md](README.md) §2/§3/§4/§6;[docs/MAP.md](../MAP.md) §3。 |
| **狀態** | ✅ **stage6 全數交付(2026-08-25),M16 達成**:WP-33~39 全部 T0~T-exit 完成,驗收清單 F(`docs/operational/acceptance-stage-f.md`)F-1~F-12 全項通過。凍結細節另記 **GD-23**。`active/stage6/` 已於 T-exit 移入 `completed/stage6/`(使用者拍板,2026-08-25)。 |

### GD-21 ✅ 晉升指標雙實作對表紀律升為硬約束(2026-08-17,WP-32 T-exit;關閉 OQ-S4-24)

| | |
|---|---|
| **發現處** | [WP-32 T0](completed/stage4/wp-32-dashboard-integration/progress.md#0.6)(2026-08-17)開帳 OQ-S4-24:`phase-v1`/`sync-v1`/`curve-v1`/`seg-v2`/ω/SG 六個新構念晉升進 `src/metrics/` 後,Python(`research/`)為權威、TS 為 port 的關係若無明文紀律,日後任一端改動語意都可能不重跑對表,讓 dashboard 數字悄悄偏離研究數字而無人發現(GD-19 parity 雙向機制原本要防的正是這個)。 |
| **決議** | 升為 [CLAUDE.md §4](../../CLAUDE.md) **C-D5** 硬約束:`seg-v2` / `phase-v1` / `curve-v1` / `sync-v1` / `sg-seg-v2` 任一端(Python `research/` 或 TS `src/metrics/`)語意或參數變更,**必須同步重跑 `research/fixtures/golden/` 產生腳本並讓 `promoted-*.test.ts` 全綠**;版本字串只能升版,不得原地改語意。 |
| **理由** | 六個構念已進生產結果頁(WP-32 T5),漂移的代價從「研究筆記不準」升級為「教練看到錯的數字」;既有 golden 對表閘只能擋「這次 commit 改了卻沒重跑」,擋不了「日後某次改動忘記兩邊都動」——需要一條明文硬約束把「雙實作維護是義務而非慣例」寫進 procedural memory,供未來 session 開場即載入。 |
| **影響面** | [CLAUDE.md §4](../../CLAUDE.md)(新增 C-D5)、[WP-32 progress.md OQ-S4-24](completed/stage4/wp-32-dashboard-integration/progress.md)(關閉)、[acceptance-stage-d.md](../operational/acceptance-stage-d.md)(D-5/D-8 引用)。 |
| **狀態** | ✅ 已拍板 + 落地(2026-08-17,WP-32 T-exit)。 |

### GD-20 ✅ 教練報告紅線 — 構念驗證 gate 為進報告前提;P3 儀器研究延遲決策(2026-08-04)

| | |
|---|---|
| **發現處** | [stage4 計畫](completed/stage4/README.md) 採納(§1.3 C-D3、§0.0 P2/P3 分層)。stage4 的 P2 指標(Key-Velocity Coupling xcorr、SPARC、Fitts)有兩類效度風險:**構念未驗證**(xcorr 是本專案原創構念,128Hz + 階段 A 二元移動速度下是否穩定未知)與**資料不足**(Fitts 需 D 變異)。若這類指標直接進教練報告,教練會據以下訓練處方——說錯話的成本高於少一個指標。 |
| **決議(紅線)** | **未通過構念驗證的指標不得進教練報告**。P2 指標必須內建 gate 並輸出**明確二元判定**:`coach_report`(可對選手解讀)或 `research_only`(僅研究記錄)。xcorr 的 gate = split-half reliability + shuffle baseline(門檻 OQ-S4-3,WP-31 T0 **pre-register 凍結**,事後不得調整);Fitts 的 gate = D 變異充足性,不足時輸出 `blocked-by-data` 而非硬給回歸結論。判定與證據記該 WP `progress.md`。 |
| **決議(P3 延遲)** | 下列項目**明文不進 stage4**,各附觸發條件:① **LDJ-V**(觸發 = SPARC 上線後需第二平滑度指標交叉驗證,且先解 128Hz jerk 頻帶放大問題)② **velocity scaling 回歸**(觸發 = 每條件 n ≥ 5 primary_flick 且 D 跨 ≥ 2 倍)③ **RawInputTrace + schema v3 / 瀏覽器輸入保真度 bench / polling rate 1k–8k 實驗**(唯一需動輸入-匯出鏈者;觸發 = 明確硬體研究委託 → 另立 stage,先跑保真度 spike 並以 performance_analysis 原生採集為 ground-truth)④ **即時 drill 中指標回饋**(觸發 = 教練工作流需 drill 中介入)⑤ **跨 session/選手縱貫資料庫**(觸發 = 累積 ≥ 3 session 或 ≥ 3 選手)。 |
| **理由** | 效度優先於指標數量:一個未驗證構念進報告,會讓教練把雜訊當訊號並改動訓練處方,傷害不可逆且事後難稽核;而少一個指標的成本只是資訊量。pre-registration(先凍門檻再看資料)是避免「調門檻直到指標好看」的唯一機制,與 GD-5/GD-8 既有 pre-registered 紀律一致。P3 全列觸發條件而非直接刪除,是為了讓後續委託有可引用的判準,避免每次重新爭論範圍。 |
| **影響面** | [stage4 README](completed/stage4/README.md) §1.3 C-D3 / §2.1 out of scope / §6 WP-31 / §7;WP-31 T0(門檻凍結)與 T2/T3(判定產出);[CLAUDE.md](../../CLAUDE.md) §4(WP-28 T0 回寫);教練報告模板(WP-29 T-exit)。 |
| **狀態** | ✅ 採納生效(2026-08-04);各 P2 指標判定於 WP-31 各 task 產出。 |

### GD-19 ✅ stage4 採納 — WP-28~32 / M14~M15 重編 + research 層邊界 + parity 雙向(2026-08-04)

| | |
|---|---|
| **發現處** | [stage4 計畫](completed/stage4/README.md)(2026-07-09 草稿;2026-08-04 採納)。採納期讀碼對帳發現草稿的**一項核心技術假設與實況不符**:草稿把 ε(t) 當作本 stage 新推導,但 ε(t) 語意、`eyeY = 1.6`、hitbox 來源與 peek 窗界 `[t_visible, nextVisible.t)` **已被 TS 實作與 operational spec 釘死**([trackingDerivation.ts](../../src/metrics/trackingDerivation.ts)、[detectionDerivation.ts](../../src/metrics/detectionDerivation.ts)、[analysis-tracking.md](../operational/analysis-tracking.md)、[analysis-t-detect.md](../operational/analysis-t-detect.md))。若照草稿只做單向 parity,stage4 全部逐段指標會建在一個未對表的 ε 上。 |
| **決議(編號)** | 採納為 **WP-28~32 / M14~M15 / 驗收清單 D**(`docs/operational/acceptance-stage-d.md`)。依 GD-15「先採納先得」,草稿原編號重編:WP-23→**28**(research 地基,M14)、WP-24→**29**(教練時間軸)、WP-25→**30**(軌跡診斷)、WP-26→**31**(進階診斷)、WP-27→**32**(晉升整合,M15);M11/M12→**M14/M15**。**`OQ-S4-n` 編號不變**(草稿期已被引用,保留追溯性),新增者續編 OQ-S4-7/8。 |
| **決議(research 層邊界)** | **C-D1 單向隔離**:`research/` 只讀匯出 JSON/CSV 與 committed fixture,**不得 import 任何 TS 模組**;`src/` 不得 import Python 產物(唯一例外 = committed golden/parity JSON)。**C-D2 `algorithms/` 純函式**(禁 matplotlib/print/file I/O,繪圖與 I/O 落 `notebooks/`)。**C-D4 既有構念不得有第二定義**:ε(t)/on-target/t_acquire/t_detect/peek 窗界以 `docs/operational/analysis-*.md` + `src/metrics/` 為權威,Python 側差異視為 bug 或須入帳的語意分歧,不得靜默各算一套。 |
| **決議(parity 雙向 + CI 落點)** | parity **雙向**且共用一套機制:**TS → Python**(既有構念)Python 產 `research/fixtures/parity/*.json`(逐 presentation 的 `tAcquireMs`/`totPercent`/`rmsEpsilonDeg`/`medianEpsilonDeg`/`p95EpsilonDeg`),由 `tests/golden/research/*.test.ts` 對同一匯出跑 `deriveTrackingMetrics` 比對 ≤1e-9;**Python → TS**(新構念,WP-32)Python 產 `fixtures/golden/*.json`,`src/metrics/` 新實作 table-driven 對表。對表面**限 TS 既有公開輸出,不為對表新增任何 TS API**。**CI 落點(OQ-S4-7)**:Python 閘 **不進** `npm run test:ci`(避免引擎工作被 Python 工具鏈綁住),改為 `uv run pytest` 獨立閘 + 雙向 fixture 進 `test:ci`(跨語言漂移仍會紅)+ M15 要求雙閘證據。 |
| **決議(工具鏈與 fixture)** | **OQ-S4-1:Python 3.12 + uv + pyproject**(環境已驗 Python 3.12.10 / uv 0.9.18);移植對象是 performance_analysis Python 實作,scipy 生態必要。**OQ-S4-8 fixture 政策**:真實匯出 fixture ≤ 30s drill(≈3840 ticks)+ `participantId` 匿名化,存 `research/fixtures/exports/`;長 drill 只在本機分析不進 repo。 |
| **理由(三項讀碼發現)** | **(a) ε 已有權威實作** → parity 必須雙向,否則 M14 綠燈是假的(見上)。**(b) schema 沒有 `kill`/`timeout` 事件**([schema.md](../operational/schema.md) events = visible/counter/ads/fire/hit):草稿 FR-D6 的 `t_kill/timeout` 必須推導(hitscan → `fire.hit`;projectile → `shotSeq` 關聯的 `hit` 事件;timeout → 窗內無命中),窗界沿用 TS 定義不得另立。**(c) `counter` 事件是條件性的**([SimLoop.ts:73-76](../../src/loop/SimLoop.ts#L73-L76) 僅在 `ev.down && !held(反向) && vx 反號` 時記錄)→ 已停住才開槍的 peek 沒有 counter 事件,故 Sync 族缺事件是常態語意,必須是 `flag` 而非 NaN;t_release 無事件,只能自 `ticks[].keys` 取(±1 tick = 7.8125ms),升級判準見 stage4 §2.4d。 |
| **未決** | 真實 drill 匯出樣本尚未取得(使用者後補)→ **M14 ①④(真實 ingest / 真實分段報告)為阻塞項**;WP-28 T1 交付**合成匯出產生器**解鎖演算法與 parity 開發,但合成不得替代 M14 的真實資料項。其餘見 stage4 §8(OQ-S4-2/3/4/5/6)。 |
| **影響面** | [stage4 README](completed/stage4/README.md) 全篇;[exec-plan/README.md](README.md) §2/§3/§4/§6;[docs/MAP.md](../MAP.md) §3;[CLAUDE.md](../../CLAUDE.md) §4(C-D1~C-D4,WP-28 T0);[CONTEXT.md](../../CONTEXT.md)(research 層術語,各 task 隨切片);新檔 `docs/operational/analysis-segments.md`(WP-28 T-exit)、`acceptance-stage-d.md`(WP-32 T-exit);新增 `tests/golden/research/`(對表閘)。 |
| **狀態** | ✅ 採納生效(2026-08-04);WP-28 子資料夾已展開,T0 待執行。 |

### GD-18 ✅ muzzle-tracer 採納 — WP-27 編號 + 五項設計拍板(tracer 槍口起點)(2026-08-03)

| | |
|---|---|
| **發現處** | [muzzle-tracer 計畫](completed/muzzle-tracer/README.md)(2026-07-15 提案；2026-08-04 交付)之採納規劃。規劃期讀碼發現草稿的**三項技術假設與實況不符**,若照草稿施作會破壞命中物理或決定性,故採納同時一併拍板設計方向。 |
| **決議(編號)** | 採納為 **WP-27**,單 WP 自足資料夾(交付後歸檔 `completed/muzzle-tracer/`),**無獨立里程碑**(T-exit gate 即交付判定)。依 GD-15「先採納先得」,[stage4 草稿](completed/stage4/README.md)原預留之 WP-27 順延重編為 **WP-28+ / M14+**。 |
| **決議(設計五項)** | ① **OQ-MT-1 offset 落點**:`src/render/muzzleOffset.ts`,與 `WeaponConfig` 解耦(保 weapon config = 命中/彈道語意純淨);`SimLoop` 的 import 為 render-only 常數的刻意單向引用。② **OQ-MT-3 凍結語意**:**capture-at-fire**(開火 tick 算好寫入,顯示端不重算)。③ **OQ-MT-4 hip 偏移初值**:`{rightU 0.15, upU −0.12, forwardU 0.60}`(THREE camera-local,前 = −Z);**前向必須 ≫ 側向**。④ **OQ-MT-6 ADS 切換**:**階躍**,不做平滑內插。⑤ **旋轉來源**:複用既有 sim 側 `ballisticQ`(`state.aim + rawPunch×2`),**禁用** `camera.getWorldQuaternion()`。 |
| **理由(三項讀碼發現)** | **(a) `arena.ox/oy/oz` 是雙重角色**——既是 projectile tracer origin([SimLoop.ts:324](../../src/loop/SimLoop.ts#L324)/[:353](../../src/loop/SimLoop.ts#L353)),**也是** `maxRangeU` 與落地判定的距離基準([:339-343](../../src/loop/SimLoop.ts#L339-L343));草稿「三個 `pushShotRay` 點都改用 muzzleOrigin」會改變子彈存活長度與命中數 → 故另立 `BulletArena.mx/my/mz` 三欄僅供 tracer 消費。**(b) camera quaternion 由 render loop 每幀寫入**(`CameraController` + 內插 punch);sim 讀它會使決定性依賴 render FPS。既有 `ballisticRaycast` 刻意不讀之([:127-133](../../src/loop/SimLoop.ts#L127-L133))→ muzzle 沿用同一 `ballisticQ`,零額外計算且與彈道方向同源。**(c) 平滑內插與 capture-at-fire 互斥**——tracer origin 是 sim 值,內插必然是 render 幀狀態;階躍亦與 GD-16「ADS gain 階躍」慣例一致。 |
| **紅線(繼承 WP-25 / GD-6)** | muzzle 偏移**只可**寫入 `shotRays` 與 `BulletArena.mx/my/mz`;**不得**進入 raycast 原點、`arena.ox/oy/oz`、`arena.x/y/z` 或 `pushImpact`(彈孔 = 命中點)。tracer 維持 render-only:不進匯出、不進指標、`schemaVersion` 不動。 |
| **前置** | **KI-002 D1 ✅ 已落地**([BD-002](../known_issue/BUGFIX-DECISIONS.md),2026-07-15):相機中心 = sim origin = 準心,偏移基準正確。草稿列為阻塞相依者已解。 |
| **未決** | 無。OQ-MT-2 已實測回填 `{rightU:0,upU:−0.065,forwardU:0.60}`；OQ-MT-7 經使用者委託 Codex 代測後判定 260 ms origin-fixed 縮尾可接受、維持現狀。 |
| **影響面** | [WP-27 README](completed/muzzle-tracer/README.md) 全篇契約 C-1b/C-4/C-6/C-7、T0–T-exit 四個 task 檔、[exec-plan/README.md](README.md) §2/§4/§6、[stage4 README](completed/stage4/README.md) 編號重編標註、[docs/MAP.md](../MAP.md)、[CLAUDE.md](../../CLAUDE.md) §4 tracer 條目補句(T0)、[CONTEXT.md](../../CONTEXT.md) §H muzzle origin 術語(T-exit)。 |
| **狀態** | ✅ 已交付(2026-08-04)：T0/T1/T2/T-exit 全綠；命中／彈道／匯出三不變；V-1～V-5 PASS。 |

### GD-17 ✅ Projectile 參數域 — flight ticks × distance tier 反推 speed/gravity/maxRange(2026-07-13)

| | |
|---|---|
| **發現處** | stage5 WP-25 T0 entry gate([wp-25 README](completed/stage5/wp-25-ballistics-tracer/README.md)、[T0](completed/stage5/wp-25-ballistics-tracer/T0-entry-gate.md))。Projectile 彈道若直接以任意 `speedU/gravityU` 寫進 weapon config,會與 WP-23 遠距 drill 的距離/角尺寸設計脫鉤,使飛行時間低於 1–2 ticks 時退化 hitscan、lead 構念空轉。 |
| **決議** | Projectile 參數以**飛行時間 tick 數**為主設計參數,與 WP-23 OQ-S5-4 的距離檔位聯動。公式:`speedU = distanceU * 128 / flightTicks`;`gravityU = 2 * (dropRatio * targetHeightU) / flightSec^2`;`maxRangeU = distanceU * 1.25`。預設 weapon profile 為 8/16/32 ticks 三檔,下墜分別為 0.10/0.25/0.50 × target height。 |
| **參數表** | canonical 0.5° longrange(`distanceU=114.59`,target height=1u):8 ticks flat `{ speedU:1833.45, gravityU:51.20, maxRangeU:143.24 }`;16 ticks standard `{ speedU:916.73, gravityU:32.00, maxRangeU:143.24 }`;32 ticks heavy `{ speedU:458.36, gravityU:16.00, maxRangeU:143.24 }`。2° sanity(`distanceU=28.65`):8 ticks `{ speedU:458.37, gravityU:51.20, maxRangeU:35.81 }`;16 ticks `{ speedU:229.18, gravityU:32.00, maxRangeU:35.81 }`;32 ticks `{ speedU:114.59, gravityU:16.00, maxRangeU:35.81 }`。 |
| **驗證/警告政策** | T3 config validation 對到靶飛行時間 `< 2 ticks` 的 `bullet` 組合發 warning(退化 hitscan);M12 未過前 `bullet` 欄不得進任何 drill config。hitscan 仍為 `WeaponConfig.bullet` 省略時的預設路徑,且必須逐位不變。 |
| **未命中端點** | OQ-25.1 同步拍板:hitscan tracer 端點沿用 `projectMissOntoEngagementPlane` 既有交戰平面投影;projectile tracer 端點用子彈消滅點(`maxRangeU` 到達或後續 T2/T3 spec 定義的失活點)。tracer 純視覺,不記錄。 |
| **理由** | tick 數直接對齊 128Hz sim 與決定性 golden,避免以真實世界槍速導致 <1 tick 到靶;距離聯動則維持 WP-23 角尺寸設計的效度。下墜以 target height fraction 表達,研究者可用相同角尺寸語言理解可見彈道差異。 |
| **影響面** | WP-25 T2(`src/ballistics/` golden 的速度/重力表)、T3(`WeaponConfig.bullet` validation、SimLoop projectile gate)、T4(timeOfFlight/lead 語意)、stage5 README §8 OQ-S5-2、WP-25 progress ledger、CLAUDE.md §4 projectile 硬約束。 |
| **狀態** | ✅ 已拍板(2026-07-13 WP-25 T0);WP-25 T1 unblocked,T2 開工仍需複驗 M11 ✅。 |

### GD-16 ✅ ADS 感度模型 — CS2 式 FOV-ratio gain + hold 語意凍結(2026-07-10)

| | |
|---|---|
| **發現處** | stage5 WP-24 T0 entry gate([wp-24 README](completed/stage5/wp-24-ads-optics/README.md)、[T0](completed/stage5/wp-24-ads-optics/T0-entry-gate.md))。ADS 會改變滑鼠 count → 視角角度的換算;若模型未先拍板,同一瞄準資料在 hip/ADS 條件間不可比較,離線分析也無法可靠還原構念。 |
| **決議** | ADS 有效感度採 **CS2 式 FOV-ratio gain**:`effectiveSensitivity = sensitivity × sensitivityRatio × (adsFov / hipFov)`。`sensitivityRatio` 預設 `1.0`;`hipFov` 取當前未開鏡 camera FOV,`adsFov` 取 `WeaponConfig.ads.fovDeg`。此模型於 stage5 pre-registered 後凍結;後續若要研究 monitor-distance match,另開新條件/新決策,不得重解釋既有 ADS 資料。 |
| **理由** | CS2 式與本專案既有 GD-5 感度慣例相容(count→angle 線性、`0.022°/count` 為底);FOV ratio 讓縮 FOV 後的角速度同步下降,模型可由 `sensitivity`、`sensitivityRatio`、hip/ads FOV 與 tick `ads` flag 完整重建。monitor-distance match 較偏顯示器座標/螢幕距離不變,引入 monitor coefficient 與解析度/視角假設,不符合本階段「角度制、跨解析度不變」的資料模型。 |
| **操作語意** | OQ-S5-6 同步拍板為 **hold**:右鍵按住 = ADS down,放開 = ADS up。toggle 僅保留為未來 config 候補欄形狀,不在 stage5 預設啟用;理由是 hold 與 CS2 慣例一致,且 PointerLock 解鎖補 ads-up 的 stuck 防護可直接比照 fire down/up 鏈。 |
| **影響面** | WP-24 T1(`EV_ADS` packed `b=down`、`heldAds`、stuck-ads 防護)、T2(`WeaponConfig.ads` + `CameraController.applyDelta` gain/FOV 內插)、T3(tick row `ads` + events `ads` 必記錄)、stage5 README §8 OQ-S5-1/S5-6、CLAUDE.md §4 ADS 硬約束。 |
| **狀態** | ✅ 已拍板(2026-07-10 WP-24 T0);WP-24 T1/T2/T3 unblocked。 |

### GD-15 ✅ WP 編號分配 — stage5(BR 遠距跟槍測試模組)取用 WP-23~26 / M11~M13 / 清單 E;stage4 草稿採納時重編(2026-07-10)

| | |
|---|---|
| **發現處** | stage5 規劃(2026-07-10,使用者指示 WP-23~25 + WP-26 落 `completed/stage5/`)與 [stage4 README 草稿](completed/stage4/README.md)(2026-07-09,**未採納**,原預留 WP-23~27 / M11~M12 / 清單 D)發生 WP 編號衝突——兩份文件對同一組編號有主張,屬跨文件矛盾。 |
| **決議** | 編號歸屬以「**採納入 [exec-plan/README.md](README.md) §2 索引**」為準。stage4 草稿明文「採納前不展開 WP 子資料夾、不動索引」,故無正式編號主張;stage5 即時採納展開,取 **WP-23~26、M11~M13、驗收清單 E**(清單字母對齊階段字母:stage5 = 階段 E)。stage4 採納時 WP 重編為 **WP-27+**、里程碑 **M14+**(清單 D 字母保留給階段 D),其 README 已標註對帳提醒。 |
| **理由** | 使用者明示 stage5 使用 WP-23~26;草稿之「預留」不構成佔用(其自身協議即如此宣告);先採納者先得編號可避免索引出現空號或雙重主張。 |
| **影響面** | [stage4 README](completed/stage4/README.md)(重編標註)、[exec-plan/README.md](README.md)(§2 stage5 索引 + §3 M11~M13 + §4 相依圖)、[docs/MAP.md](../MAP.md)、[stage5 README](completed/stage5/README.md)(引用本決議)。 |
| **狀態** | ✅ 已拍板(2026-07-10,使用者指示 stage5 編號)。 |

### GD-14 ✅ WP-15 T-exit — M7 caveated 通過(T2 pattern 差異分層歸因 + 研究者接受)(2026-07-07)

| | |
|---|---|
| **發現處** | WP-15 T-exit 閘門([wp-15 progress](completed/stage2/wp-15-calibration/progress.md))。T2 AK pattern 對 Aiming.Pro fixture 逐彈對表 yaw maxAbs **3.941°**(shot 15),遠超 OQ-S2-2 ±0.05°;T1 為 theory surrogate(承 OQ-15.1 / [[GD-13]])。M7 的「pattern 對上外部真值」直路不成立,走「差異已分層歸因並被研究者接受」路徑。 |
| **差異分層歸因** | **(公式)** recoil 數學已由 M5 golden 對 CS2 vdata 逐位釘死(10 發 punch −10.18°/−1.56° ±0.01°)——非公式錯。**(常數/scale)** 水平 yaw scale 與 recoil table seed 與 WP-10 10-shot golden 相依,盲調追齊會破壞既有校準基準。**(資料品質/來源模型)** Aiming.Pro 為第三方訓練器模型、**非 CS2 權威真值**;其 shot 1 已有非零 offset,與本專案 post-fire/pre-tick 純 punch 首發為 0 的語意不符,暗示其含 bullet-impact/compensation 或自有訓練模型。→ 差異主因判為**來源模型不匹配**,非引擎 error(pitch 軌跡同量級、yaw 在 shot 15/19/24/28/30 有 2°–4° 級偏差,非角度→公分換算問題)。 |
| **決議** | 研究者**接受**分層歸因,M7 以 **caveated pass** 宣告。權威 recoil 校準以 M5 golden(CS2 vdata)為終審;Aiming.Pro 差異記為已知 caveat,**不盲調 recoil 追齊**(協議 [README §2](completed/stage2/wp-15-calibration/README.md):比對不過是歸因不是調參)。velocity gate 連續模型已上線(WP-14)。 |
| **caveat(M7 措辭降級)** | 「速度曲線於 sim cadence 公式/常數對表通過(theory surrogate,**非** `cl_showpos` 實錄行為級)+ recoil pattern 已對 CS2 vdata golden 逐位釘死;對第三方 Aiming.Pro pattern 的逐彈對表**未通過** ±0.05°,歸因為來源模型差異並被研究者接受」。 |
| **遺留 OQ** | OQ-15.4(Aiming.Pro 30 點語意:CS2 bullet-impact / compensation path / 自有模型?)、OQ-15.5(是否以外部 pattern 為權威改動 recoil model)。**若立案改動 → 另開校準切片**評估對 WP-10 10-shot golden、pattern viewer、ballistic compose 的整體影響。 |
| **影響面** | WP-15 exit(M7 ✅ caveated;兩層索引標日期)、解鎖 WP-17/M8 的校準側前置(WP-15 相依滿足)。 |
| **狀態** | ✅ 已拍板(2026-07-07 T-exit;研究者接受歸因)。 |

### GD-13 ✅ WP-15 calibration 抓到 WP-14 CS2_PROFILE 常數 bug + T1 cadence 定案(2026-07-07)

| | |
|---|---|
| **發現處** | WP-15 T1 首輪對表 RED([wp-15 progress](completed/stage2/wp-15-calibration/progress.md))。歸因兩層:(1) production `CS2_PROFILE` 常數與 surrogate fixture meta 不一致;(2) fixture 為單一 64Hz step 曲線、sim 為 128Hz 每 2 tick 取樣,cadence 不對齊——即使常數對齊仍紅(起步 tick0:單步 21.484 vs 2×128Hz 積分 18.234,差 3.25 u/s > ±1)。 |
| **查證** | 2026-07-07 遊戲內 console 查 CS2 default:`sv_accelerate=5.5`、`sv_friction=5.2`、`sv_stopspeed=80`(二手 totalcsgo 頁自相矛盾 5.5/5.6,以遊戲 binary default 為終審)。production `CS2_PROFILE` 原為 accelerate=**5.6**、stopSpeed=**75** → **兩常數偏離權威 default**,為真實 bug(calibration 的目的即抓此)。 |
| **決議** | **(OQ-15.3)** `CS2_PROFILE` 修正為 5.5/5.2/80(commit `347ce78`,WP-14 correctness fix);受影響的 WP-14/WP-2 逐 tick 回歸斷言以**獨立參考實作**(hand-rolled Source friction→accelerate,不 import controller)重算,非以讓測試變綠推導。**(OQ-15.2)** T1 reference cadence 採「128Hz 積分、每 2 sim tick 取樣(64Hz)」重產 surrogate fixture,對表 sim 實際積分路徑,而非單一 64Hz step 公式。 |
| **理由** | 常數偏差是事實問題,以遊戲內權威 default 解、非以讓測試變綠解(協議 [README §1](completed/stage2/wp-15-calibration/README.md) 禁盲調參)。fixture 既為 theory-derived surrogate(OQ-15.1),可提供的最高效度即「Source 公式於 sim cadence 下的 regression/公式對表」,故 cadence 對齊 sim。 |
| **影響面** | WP-14(`CS2_PROFILE` + MovementController/SimLoop/determinism 回歸 baseline;**gameplay 移動手感隨之改變**,待瀏覽器實測手感驗收)、WP-15 T1(fixture 重產 + 對表綠)、WP-2 determinism gate(baseline 重錄)。 |
| **caveat** | T-exit/M7 仍**不得**宣稱 `cl_showpos` 實錄行為級通過(仍為 theory surrogate);結論措辭降級為「公式/常數曲線於 sim cadence 對表通過」(承 OQ-15.1)。 |
| **狀態** | ✅ 已拍板 + 落地(2026-07-07;commit `347ce78` WP-14 fix + 本次 T1 calibration 切片)。 |

### GD-12 ✅ FPSci 建議採納對帳 — R1~R7 處置(2026-07-07)

| | |
|---|---|
| **發現處** | FPSci 比較評估 grill(2026-07-07;[docs/research/FPSci_評估與建議.md](../research/FPSci_評估與建議.md) §5 R1~R7)。 |
| **採納** | **R1(縮限)**:FPSci 欄位對映表入 WP-16 T1(schema.md 附錄,相同/近似/無對應三類);**命名 CONTEXT.md 優先、既有欄位不改名**——R1 原文「沿用其命名慣例」與 CLAUDE.md §2 命名協議衝突,以後者為準,可比性由對映表承擔。**R3(縮限)**:三層實驗結構正名入 CONTEXT §A(experiment = 分析端概念、引擎不實作;session = `ProtocolConfig`;drill 既有);WP-20 T4 加 `participantId`/`sessionLabel` 進 meta `session` 區塊(v2 reserved,形狀歸 WP-16 T1)——前後測離線串接不靠檔名紀律;FPSci 的 userstatus/config `#include`/受試者管理後端不採納。**R4**:pilot 分析文件(WP-22 T3 pilot-protocol 起)納 FPSci 論文反應時間分布(150–250ms)作效度 baseline。**R7**:→ GD-11(授權紅線)。 |
| **不採納** | **R2(click-to-photon 硬體校準)**:不做——與研究筆記「高優先」評級相悖,使用者拍板。接受瀏覽器 compositor 盲區為先天限制;審稿回應 = 誤差界線陳述(規格 §15)+ 受試者內對比設計(GD-10 防線②)+ frame-time log(WP-20 T3)。 |
| **停車(backlog + 觸發條件)** | **R5(注入式延遲)**:觸發 = 「延遲 × counter-strafe 時序」成為研究問題;架構縫已存在(render 讀落後 N tick 的 `RenderSnapshot`,render-only、不動決定性),晚做不變貴。**R6(問卷模組)**:觸發 = WP-22 T2 pilot protocol 題組定案;屆時複用 WP-20 T4 DOM 表單模式(D1 相容);過渡期可用外部問卷 + `participantId` 離線串接。 |
| **影響面** | WP-16 T1(對映表 + `session` reserved)、WP-20 T4(session 識別欄)、WP-22 T2/T3(R6 觸發、R4 引用)、CONTEXT §A(三層實驗結構)、CLAUDE.md §4(GD-11)。各落點已於 2026-07-07 回寫(見各 WP progress.md)。 |
| **狀態** | ✅ 已拍板(2026-07-07 grill;使用者逐項確認)。 |

### GD-11 ✅ FPSci 授權紅線 — 禁複製程式碼,僅參考方法學與 schema 語意(2026-07-07)

| | |
|---|---|
| **發現處** | FPSci 比較評估 grill(2026-07-07;[docs/research/FPSci_評估與建議.md](../research/FPSci_評估與建議.md) R7)。NVlabs/FPSci 為 **CC BY-NC-SA 4.0**:禁商用、share-alike 具傳染性、非 OSI 認可的軟體授權。 |
| **決議** | **禁止**:複製/改寫/翻譯 FPSci 任何程式碼進本 repo(C++ → TS 翻譯亦屬衍生著作),包含其 `.Any` config 檔內容。**允許**:閱讀其文件與論文、參考 SQLite schema 的欄位語意與命名慣例、複刻公開發表的方法學(click-to-photon 校準、experiment/session/trial 三層結構)。 |
| **理由** | share-alike 會把整個專案傳染進 NC-SA;BenQ 商業脈絡下 NC 是地雷(先例:GD-9 已整類排除 CC-BY-NC 資產)。方法學與欄位語意非著作權保護的表達,參考安全。 |
| **影響面** | 全域協議(CLAUDE.md §4 硬約束加一行)、WP-16 schema v2(R1 欄位對映)、WP-20(R2 校準 / R3 session 結構)——皆為「參考語意/方法」,不移植程式碼。 |
| **狀態** | ✅ 已拍板(2026-07-07 grill;使用者確認)。 |

### GD-10 ✅ 顯示硬體策略 — 全遠端 + 三道防線(2026-07-06)

| | |
|---|---|
| **發現處** | 解析度感知實驗 grill(2026-07-06)。瀏覽器無法切換 OS 顯示模式:「解析度條件」= render buffer 解析度 + upscale;面板原生解析度/PPI/觀看距離皆瀏覽器不可控。 |
| **決議** | **全遠端 + metadata + 統計控制**,但以下**三道防線為 blocking requirements**(缺一即實驗無效):① **軟體資格閘(eligibility gate)**——session 開始自動檢查:原生解析度 ≥ 實驗最高條件(`screen.width × devicePixelRatio`)、fullscreen 強制、效能地板(per-frame time log 超標 → session 標 `suspect`/剔除);**不合格拒入,非僅記錄**。② **受試者內對比**——每人同面板同 session 跑全部解析度條件、順序對抗平衡;面板 PPI/尺寸/觀看距離/scaler 特性在受試者內對比中一階抵銷。③ **metadata 地板**——自動:render buffer/CSS 尺寸、`devicePixelRatio`、fullscreen、upscale 模式、backend(既有)、更新率估計(rAF deltas)、per-frame render-time log(GD-8);手動(session setup 表單):螢幕型號/原生解析度/面板尺寸/觀看距離自陳——降級為 moderator,不承擔混淆控制。 |
| **實驗語意精確化** | 量測構念 = 「**同一面板上的 render 解析度效應**」(QHD 面板玩家降 render 解析度的感知代價),**非**「不同螢幕的比較」。FHD 條件在 QHD 面板上 = compositor upscale,屬操弄本身(真實世界語意)。 |
| **失效防範** | 無資格閘時,FHD 原生面板受試者的「QHD 條件」= 降階超取樣 → **方向性錯誤資料**(非雜訊)且無聲混入——資格閘防的是統計必然,不是罕見邊角。 |
| **影響面** | display-settings WP(解析度切換 + fullscreen + 資格閘 + session setup 表單 + metadata 欄位)、WP-16 schema v2(display metadata + frame-time log)、偵測實驗 protocol、追蹤實驗共用同一 metadata 地板(遠端天然可行)。 |
| **狀態** | ✅ 已拍板(2026-07-06 grill)。 |

### GD-9 ✅ BR 場景資產 — 寫實原創 + CC0/CC-BY 授權紀律(2026-07-06)

| | |
|---|---|
| **發現處** | BR 場景 grill(2026-07-06)。repo 為 **public**(`ziy900409/FPS_aim_analyst`),commit 資產即公開發布。 |
| **決議(場景原則)** | **寫實原創 BR 場景**:攝影級寫實品質的軍事島嶼/城鎮戰場,**不複製任何特定遊戲地圖的配置**——地圖 layout 是受保護的創作表達,資產來源乾淨不能洗白配置抄襲。場景依**雜亂度階層(clutter tier)**定義並中性命名(`field-low`/`urban-high`/`mixed-mid`),發表報告雜亂度操弄、不掛遊戲名。特定地圖可辨識復刻**排除**;熟悉度若成為未來研究變因 → 授權取得或受試者玩原版遊戲的獨立實驗臂,不自建復刻。 |
| **決議(授權)** | **CC0 優先、CC-BY 補充**(附 `ATTRIBUTIONS.md`),直接 commit。**CC-BY-NC 整類排除**(BenQ 商業脈絡地雷)。付費包僅在美術方向強烈需要時再議(`.gitignore` + 私有儲存 + fetch script)。**遊戲抽取資產/遊戲截圖背景永久排除**(EULA + 著作權;截圖背板另有無視差的深度線索問題)。 |
| **決議(版本紀律)** | 場景 = **有版本的 config 資料**:`sceneId` + `assetPackVersion` + prop-bounds(GD-6)進匯出 metadata;資產改版即斷代——與 drill config / schema 同一套紀律。 |
| **影響面** | 場景 WP(資產管線 + SceneConfig registry)、匯出 metadata、發表措辭(中性命名)、GD-6 prop-bounds 版本化。 |
| **狀態** | ✅ 已拍板(2026-07-06 grill)。 |

### GD-8 ✅ 偵測實驗操作化 — pop-in 刺激 + t_detect 瞄準 onset + 偏心度共變數(2026-07-06)

| | |
|---|---|
| **發現處** | 解析度感知實驗 grill(2026-07-06)。偵測依變因(`t_detect`)與 slide-in `t_visible` 判準是 CONTEXT §D 明文「尚未定義」的空缺。 |
| **決議(刺激)** | 偵測刺激 = **pop-in**:`t_visible` = spawn tick,沿用現行正規語意、零新判準;位置/時序由 `sequence.seed`(既有保留欄啟用)隨機化。**slide-in 判準預先釘死**:目標中心穿越 DrillConfig 宣告可見性邊界面的那一 tick 蓋 `t_visible`(camera 無關、決定性、sim 可算)——落地待 GD-6 升級路徑 C 觸發(需生態效度時),本階段不實作。 |
| **決議(t_detect)** | **t_detect = 瞄準移動 onset(離線)**:`t_visible` 後第一個「ε(t) 以超過雜訊底的角速度下降、持續 k tick」的 tick;雜訊底以 **per-trial 前刺激窗口**(spawn 前 aim 抖動)校準,θ_v/k 為 pre-registered 分析參數。**偵測反應時間 = t_detect − t_visible**(量測時鐘域)。副指標:**engagement time = t_first_fire − t_visible**(不同構念,免費)。專用反應鍵不做(破壞任務自然性、需擴 KEY_CODE/ring/schema);首發 fire 不當主指標(混入獲取+決策)。 |
| **決議(偏心度)** | spawn 瞬間偏心度(aim 與目標的角距)= **記錄共變數**,由 aim@spawn + 目標位置離線推導(零引擎工作、不動 GD-4「aim 僅觀測」契約)。**fixation gate**(注視閘控 spawn)列為升級選項——代價 = aim 成為 sim 演進輸入(GD-4 契約變更)+ simStep②/GD-4 aim 寫入路徑的描述張力須先對齊;pilot 顯示偏心度變異吞掉解析度效應時再議。 |
| **工程含意** | 偵測指標鏈**零 sim 改動**(pop-in 沿用 spawn 語意;t_detect/偏心度離線推導,原始資料 = 既有 aim + GD-7 schema v2 欄位)。偵測 drill 的引擎面 = spawn 佈局隨機化(seeded)+ **per-frame render time log**(跨解析度顯示鏈延遲差的效度防線,見顯示硬體決策)。 |
| **影響面** | 偵測 drill WP(新)、解析度實驗設計、CONTEXT §D F5 接縫列(已回改)、GD-4(fixation gate 若啟用需重開)。 |
| **狀態** | ✅ 已拍板(2026-07-06 grill)。 |

### GD-7 ✅ OQ-S2-5 解決 — 追蹤指標定義與獲取/追隨分離(2026-07-06)

| | |
|---|---|
| **發現處** | BR 場景/移動目標 grill(2026-07-06)。OQ-S2-5(移動 + counter-strafe 能力混淆,附錄 F/GD-1 遺留)是 WP-18 唯一研究側門控。 |
| **決議(能力混淆)** | 採規格附錄 F 預設緩解:**純追蹤 drill 與急停 drill 分離**;複合 drill 維持「進階複合技能」標註、不入 WP-18。追蹤 drill 內部再做**指標層**第二道分離:獲取(acquisition,flick 構念)vs 追隨(pursuit,連續控制構念)以窗口定義切開,不靠 drill 設計硬切。 |
| **指標定義** | ① **on-target(逐 tick 二元)**= 準心射線(camera 正向)∩ H1 hitbox(Box3)——與命中判定同一套幾何、零新門檻參數。② **追蹤誤差 ε(t)** = 準心射線與目標 hitbox 中心夾角(deg)——「準心對齊偏移」由 fire 瞬間推廣到逐 tick。③ **t_acquire** = `t_first_on_target − t_visible`(獲取時間);整段未 on-target → 記**獲取失敗**(計入獲取失敗率、不進 TOT 聚合;失敗是資料不是缺失值)。④ **追蹤窗口** = [t_first_on_target, presentation 結束)。⑤ **TOT%** = 窗內 on-target tick 比例;**pre-registered 主統計量 = RMS(ε)**(窗內);median/P95/streak 為離線副指標。⑥ 128Hz 取樣對連續控制足夠,sub-tick 僅留 WP-18 命中內插,不參與追蹤指標。 |
| **資料策略** | **記錄全套(raw-over-derived)**:WP-16 schema v2 逐 tick 加目標中心 `(tx,ty,tz)` + 玩家位置 `(px,pz)`(~1.5MB/drill,preallocated arena 紀律不變);`sequence.seed` + motion config 進 metadata(供 drill 重現與交叉驗證,非 ε 的資料來源)。**拒絕離線重建路線**——motion 函數兩份實作 = 兩份真相源漂移風險;velocity 積分重建玩家位置會被未來 clamp/teleport 無聲破功。 |
| **工程含意** | 指標全部離線推導,**零 sim 改動、零熱路徑成本**;引擎交付面 = schema v2 欄位(WP-16)+ WP-18 既有範圍。GD-6(淨空驗證)保證 presentation 期間目標恆可見 → TOT 時間軸連續、無遮擋窗特例。 |
| **影響面** | WP-18(研究側門控解除,entry 僅餘 M8)、WP-16 schema v2 欄位、stage2 README §8(OQ-S2-5 已回改)、規格附錄 F(緩解方式具體化)、結果頁顯示(TOT% / RMS ε / t_acquire)。 |
| **狀態** | ✅ 已拍板(2026-07-06 grill)。 |

### GD-6 ✅ 場景遮擋路線 — 純裝飾場景 + 淨空驗證,排除 mesh 衍生 collision(2026-07-06)

| | |
|---|---|
| **發現處** | BR 場景背景 + 移動目標/解析度感知實驗的可行性 grill(2026-07-06)。場景遮擋語意是 OQ-S2-5(追蹤指標)與偵測實驗(slide-in `t_visible` / `t_detect`)的上游前提。 |
| **事實基礎** | sim 對場景零知識,且 `src/sim` 全目錄無任何位置 clamp——玩家位置無界、佔位房間四牆只存在 render 層([SceneManager.ts](../../src/render/SceneManager.ts) 註記「數字不得流入 sim」)。**純裝飾是本系統既有本體論**,非新選擇;「視覺≠物理」今日已存在,僅因 drill 設計未被觀測。 |
| **決議** | **場景 = 純裝飾(render-only)+ 淨空驗證(clearance validation)**:(a) 場景資產附 **prop-bounds 清單**(僅驗證器可讀,**永不進 sim runtime**);(b) drill 載入時驗證**視線走廊**(玩家 strafe 走廊 ∪ 目標運動包絡之凸包,保守過近似)與 prop bounds 不相交,**相交即拒載**(自動化大聲失敗,不靠人工紀律);(c) 玩家活動範圍以 config 宣告假設,runtime 逸出走廊 → 標 `suspect`(純觀測,不動 sim 演進);(d) 走廊淨空 ⇒ 對場景 raycast 與無場景逐位元等價 ⇒ 決定性 baseline 不分裂、F4「換場景零引擎碼」成立。 |
| **排除與升級路徑** | **B-full(render mesh 自動衍生 collision)永久排除**——proxy 生成變異會無聲流入量測資料。B-lite(授權 collision 進 runtime)/ C(DrillConfig 宣告式 occluder)保留為升級路徑,prop-bounds 即其前身資料;觸發條件 = 研究需要「目標躲藏(reacquisition)/ 擋彈(blocked shot)/ LOS 自動 t_visible」任一。 |
| **理由** | 需求訊問收斂到唯一訴求「視覺=物理一致性,且不靠人工紀律」:一致性是**保證**非能力——建構期幾何證明(載入 gate,~1 dev-day)取得與 runtime 機械(1+ WP + per-scene determinism baseline 維護)等價的保證;且一致性原則若當本體論貫徹會層層擴張(玩家-場景 collision → movement physics),無自然停點。 |
| **影響面** | 未來場景 WP(SceneConfig + prop-bounds + 驗證器)、WP-18(追蹤指標**無需**處理遮擋窗)、偵測 drill(slide-in 需宣告式 occluder 時走 C)、規格附錄 F(遮擋風險緩解方式)。 |
| **狀態** | ✅ 已拍板(2026-07-06 grill;落地待場景 WP)。 |

### GD-5 ✅ stage2 範圍採納與 recoil/movement 跨 WP 契約(2026-07-05)

| | |
|---|---|
| **發現處** | [stage2 README](completed/stage2/README.md) 已整合規格 §1.3 階段 B、CS2 壓槍軌跡復刻研究計畫、2026-07-03 後座力整合稽核報告,但採納決策尚未進全域帳本;[WP-10 T0](completed/stage2/wp-10-recoil-core/T0-entry-gate.md) 要求在寫 recoil code 前完成拍板。 |
| **決議** | 採納 stage2 範圍:CS2 後座力系統(固定彈道表 / punch 動力學 / inaccuracy)、武器層、sim/camera 接線、movement physics、schema v2、壓槍指標與整合驗收。 |
| **六個決策點** | 1. recoil 衰減公式以 **1/64s** 步長定義,在 128Hz sim 內以偶數 tick 的 64Hz 子節奏執行(OQ-S2-1)。2. 彈匣盡即停火,本階段不做 reload;drill 一 peek ≤ 一匣(OQ-S2-6)。3. 感度語意改為 CS2 `0.022°/count`,舊匯出資料以 `sensitivityModel` / `schemaVersion` 斷代。4. WP-14 movement integrator 會改變決定性 baseline,屬預期 breaking change;先重驗 M1 決定性契約再重錄 baseline。5. `src/sim` / `src/recoil` 禁 `Math.random()`,所有隨機性以 seeded RNG 注入並記錄 seed。6. movement model 以 `MovementProfile` 留資料接口;Valorant 不進 stage2,僅在 WP-14/WP-16 保留 profile/meta 斷代能力。 |
| **WP-12 T0 補充** | OQ-S2-3 標注方式拍板:T1 先加 `sensitivityModel: 'cs2-0.022deg'` 字串欄;舊匯出無此欄即代表階段 A 佔位感度模型 `0.0022 rad/count`;`schemaVersion` bump 留給 WP-16 schema v2 一次處理,避免兩次 schema 斷代;舊資料不回溯轉換。(2026-07-06) |
| **WP-14 T-exit 補記** | 決策點 4 已執行完畢:M1 決定性契約(異 render FPS 同 per-tick 狀態)先重驗通過,determinism baseline 於 T1 重錄(commit `112d6a6`;[determinism.test.ts](../../src/loop/__tests__/determinism.test.ts)、[regression determinism](../../tests/regression/determinism.test.ts),連同相鄰解析契約 `MovementController.test.ts` / `SimLoop.test.ts` 一併改寫);T2(`6be8d59`)/T3(`417fb5e`)未再動 baseline。`test:ci` 全綠 + Edge 實測手感驗證(觀察值)見 [wp-14 progress](completed/stage2/wp-14-movement-physics/progress.md)。規格 §5 指標分層註記已補節解除。(2026-07-06) |
| **權威來源** | [stage2 README §1.3](completed/stage2/README.md#13-constraint%E7%A1%AC%E7%B4%84%E6%9D%9F%E6%96%B0%E5%A2%9E%E9%A0%85%E5%B0%87%E5%9B%9E%E5%AF%AB-claudemd-4)、[§2.4](completed/stage2/README.md#24-tick-%E7%AF%80%E5%A5%8F%E8%A8%AD%E8%A8%88%E9%97%9C%E9%8D%B5%E6%B1%BA%E7%AD%96%E8%A6%8B-oq-s2-1)、[§8](completed/stage2/README.md#8-open-questions)、[WP-10 T0](completed/stage2/wp-10-recoil-core/T0-entry-gate.md)。 |
| **影響面** | 跨 WP-10~WP-17:golden test 定義、sim/recoil 接線、感度轉換、movement calibration、export metadata、determinism baseline 與 lint/grep 閘。 |
| **狀態** | ✅ 已採納(2026-07-05;WP-10 T0 docs-only slice)。 |

### GD-4 🟡 `crosshair` 未由 production 路徑寫入 — 匯出恆 `[0,0]`(2026-07-03)

| | |
|---|---|
| **發現處** | WP-7 T6 exit-gate 審查:`TickArena.recordState` 讀 `state.crosshair.cx/cy`([RingBuffer.ts](../../src/data/RingBuffer.ts):122),但 grep 全 `src/` 僅 [SharedState.ts](../../src/state/SharedState.ts) `resetState` 歸零與測試手動設值寫入 `crosshair`——**無 production writer**。 |
| **問題** | `SharedState.crosshair` 於 WP-2 建為佔位(SharedState.ts:40「本 task 佔位、語意待該二 WP 定」,原計畫 WP-3 滑鼠樣本寫入 / WP-5 raycast 消費),但 WP-3/WP-5 交付時**未落地寫入**。故 recorder 每 tick 忠實記錄的 `crosshair` 恆為 `[0,0]`,匯出 JSON/CSV 的 `crosshair`/`cx`/`cy` 為常數 0。`schema.md` 將 crosshair 描述為「normalized overlay/camera-center offset」,與實際常數 0 不符——WP-8 消費會誤以為有瞄準偏移資料。 |
| **影響面** | 跨 WP:WP-3/WP-5(應寫入 crosshair)、WP-7(忠實記錄,非缺陷)、WP-8(消費 crosshair 得常數 0)、pilot 研究效度(準心軌跡不可用)。**不 blocking M3 機制門**:5 項 M3 驗收皆機制層(ring/事件/metadata/匯出/schema)均綠,recorder plumbing 正確。 |
| **待辦/結論** | 交棒 WP-8 前釐清:(a) crosshair 語意是否為階段 A 範圍(camera yaw/pitch 已走 `CameraController`,準心恆在螢幕中心 → 或許 crosshair 本應為 camera 朝向投影,而非常數);(b) 若階段 A 不需 → schema.md 標註 crosshair 為 reserved/placeholder,避免 WP-8 誤用;(c) 若需 → 補 WP-3/WP-5 writer。 |
| **權威來源** | [SharedState.ts](../../src/state/SharedState.ts):40 佔位註記、[RingBuffer.ts](../../src/data/RingBuffer.ts):122 讀取點。 |
| **實機佐證** | WP-7 T6 手動驗證(2026-07-03,22,219 ticks 實跑 drill):`ticks[].crosshair` 全為 `[0,0]`(CSV `cx`/`cy` 欄無任一非零),證實常數 0。 |
| **決議(2026-07-03,使用者拍板 B + C2)** | **B**：把「準心對齊偏移」記在 canonical 位置——`fire` 事件。擴充 `DrillEvent.fire` 加 `targetId` + `offsetDeg`(fire 當下 camera 正向射線 vs hitbox 中心夾角,CONTEXT:22),於 [SimLoop.ts](../../src/loop/SimLoop.ts) fire 分支既有 `raycastFromCenter` 處一併算出。**C2**：per-tick `TickRecord.crosshair:[cx,cy]`(語意已空、恆置中)改記 **camera 朝向 `aim:{yaw,pitch}`**(逐 tick 瞄準軌跡)。plumbing 守 ADR-2 雙迴圈邊界：[CameraController](../../src/view/CameraController.ts) 經 input/render 路徑把 yaw/pitch 寫進 `SharedState`(如同 `held`),`recordTickFromState` 只讀 `SharedState`——sim 不伸手進 render 物件圖。aim 為 input 衍生、不影響 sim 狀態演進,決定性不變(僅觀測)。**落地在 WP-8 entry-gate**：動 `DrillEvent`/`SimLoop` fire 分支/`SharedState`/`CameraController`/`RingBuffer`/`schema.md`,並註記與規格附錄 C(`crosshair`)分歧、回改附錄 C。 |
| **狀態** | 🟡 已定解法(2026-07-03,B+C2);落地待 WP-8 T0 → T1。詳見 [wp-8 T0-entry-gate.md](completed/stage1/wp-8-metrics-hud/T0-entry-gate.md) OQ-8.5。 |

> GD-1(F5 範圍)已於 2026-06-29 解決,見 §3。

---

## 3. 已解決(CLOSED)

### GD-3 ✅ 輸入消費 tick 邊界語意 — WP-2 `<` vs WP-3 契約 `<=` 矛盾(2026-07-01)

| | |
|---|---|
| **發現處** | WP-3 T0 審查:WP-2 佔位 [`SimLoop.consumeInput`](../../src/loop/SimLoop.ts)(`buf[consumed].t < tickEndMs`,嚴格 `<`、半開窗 `[tickStart,tickEnd)`)與 WP-3 契約([wp-3 README §2](completed/stage1/wp-3-input-sampler/README.md) `consume` + [T4-sim-consume.md](completed/stage1/wp-3-input-sampler/T4-sim-consume.md))原寫「取 `t <= untilT`」不一致。 |
| **問題** | 若 WP-3 照 `<=` 實作且以 `untilT = tickEndMs` 呼叫,`t == tickEndMs` 的事件會比 WP-2 佔位早一個 tick 被消費 → 事件落入的 tick index 位移 → **破壞 M1 已鎖的決定性回歸**(T4 「重跑 WP-2 決定性測試仍綠」在邊界事件上會紅)。 |
| **決議** | 統一為**嚴格 `<`**、半開窗 `[tickStart, untilT)`,caller 傳 `tickEndMs`。**理由**:WP-2 決定性已鎖定且 M1 綠燈(2026-07-01),改 WP-2 會破壞已證性質;故 WP-3 向 WP-2 對齊,而非反向。 |
| **對帳結果** | 已回寫 [wp-3 README §2](completed/stage1/wp-3-input-sampler/README.md) interface contract + Failure modes、[T4-sim-consume.md](completed/stage1/wp-3-input-sampler/T4-sim-consume.md)(Objective/In scope/Design notes/Steps/DoD 全改 `<`,並加「回歸須驗邊界未漂移成 `<=`」)。WP-2 `SimLoop.ts` 無需改(已是 `<`)。 |
| **權威來源** | [SimLoop.ts](../../src/loop/SimLoop.ts) `consumeInput`(既有 `<` 為準)、CONTEXT「輸入分桶」半開窗。 |
| **狀態** | ✅ 已解(2026-07-01;commit 待補) |

### GD-1 ✅ F5(移動目標)範圍 — 已統一 seam-in / drills-out(2026-06-29)

| | |
|---|---|
| **決議** | 階段 A **只建 F5 架構接縫**(`SimLoop` target-motion slot、`TargetManager` motion registry、`DrillConfig.targets.motion?` 選填、預設 `static` 恆等),**不交付移動目標 drill / 追蹤指標 / slide-in `t_visible`**。 |
| **對帳結果** | 已回寫:規格 §1.2(範圍修正註)+ 附錄 E(移動 drill 標延後、新增接縫驗收)、[PLAN.md](../PLAN.md) §1/§9、[README.md](README.md)、WP-4/WP-6 README。 |
| **權威來源** | [CONTEXT.md §D](../../CONTEXT.md)「F5 接縫」、規格 §1.2。 |
| **狀態** | ✅ 已解(2026-06-29;commit 待補) |

### GD-2 ✅ 規劃 grill — 一批執行期契約決策(2026-06-29)

| | |
|---|---|
| **決議** | 經 grill-with-docs 釘死一批跨 WP 執行期契約,已回寫權威文件並反映進 WP-2/3/4/5/6/7/8 README:**ADR-7** 兩個時鐘(量測 `performance.now()` / 決定性邏輯 tick index;Chromium 同源假設須重驗)、**ADR-8** peek 推進 P2(命中才推進)、**ADR-9** 正規單位 source unit;**輸入分桶**(timeStamp 落 tick 邏輯窗消費)、**輸入緩衝 = 真 ring** vs **`DataRecorder` = preallocated arena**(非環狀,`maxDrillSeconds` 300s)、**`SharedState` 兩道階段 B 跨界縫**(輸入佇列 + `RenderSnapshot`)、**移動模型 M1**(瞬間 snap、反向鍵穿越 tick 歸零)+ **指標分層**(時序可量 / 精度二元待階段 B)、**H1 單一 hitbox**、**開火 inline 評估**(sub-tick 忠實)。 |
| **權威來源** | [CONTEXT.md](../../CONTEXT.md)、[DESIGN.md](../DESIGN.md) §1、規格 ADR-7/8/9。 |
| **新增 metadata** | `unit`、`vStrafe`、`maxDrillSeconds`、`lateEventCount`、`bufferOverflow`、`recorderOverflow`、`suspect`(規格附錄 C / WP-7 `Meta`);`schema.md`(WP-7.5)產出時一併納入。 |
| **狀態** | ✅ 已解(2026-06-29;commit 待補) |

> **實作進度交叉註記(2026-07-01,WP-3 T4)**:GD-2 的兩個輸入端 metadata 於 WP-3 分兩切片落地——**`lateEventCount` 已於 T4 實作**(`SharedState.inputMeta`,[consume.ts](../../src/input/consume.ts) 依 `lastConsumedT` 低水位偵測遲到、夾進當前 tick 消費不丟棄)。**`bufferOverflow` 延後至 T4b**([wp-3 T4b](completed/stage1/wp-3-input-sampler/T4b-ring-buffer-overflow.md)):T4 仍在 WP-2 佔位 **plain array** 上消費,無靜態容量故無溢位語意;溢位須待 **OQ-3.2 固定欄位 ring buffer**(靜態容量、滿升 `bufferOverflow`、不靜默丟最舊)就緒才成立。拆分理由見 [wp-3 progress D-T4.1](completed/stage1/wp-3-input-sampler/progress.md)。GD-3(嚴格 `<` 邊界)已於 T4 落實並經決定性回歸(9 tests)確認未漂移成 `<=`。

> **實作進度交叉註記(2026-07-01,WP-3 T4b — GD-2 / OQ-3.2 完成)**:輸入緩衝已換成 **固定欄位真 ring**([SharedState.ts](../../src/state/SharedState.ts) `createInputRing`:packed 並行 typed-array 槽位 `type,t,a,b`、`head`/`count` 游標、靜態 `RING_CAPACITY=512`(2 的冪、`& MASK` 繞圈,**執行期不動態 resize**))。**`bufferOverflow` 落地**:容量滿時 `push*` 回 `false`、[InputSampler.ts](../../src/input/InputSampler.ts) 升 `inputMeta.bufferOverflow`、**拒收新事件、不覆寫尚未消費的最舊槽**(GD-2「不靜默丟最舊」)。code(`KeyA/KeyD/KeyW/KeyS`)編碼為小整數 enum(`KEY_CODE`/`CODE_KEY`,見 [types.ts](../../src/state/types.ts));`consume` 用寫入端 bounded insertion 保序取代 T4 的 `due.sort` scratch(GC 紀律),交付用單一重用 `InputEventView` 解碼。GD-3 嚴格 `<` + `lateEventCount` 低水位語意不變,決定性回歸(9 tests)+ T4 consume(5 tests)遷移後全綠。至此 GD-2 兩個輸入端 metadata(`lateEventCount` / `bufferOverflow`)皆就緒。

---

## 寫入慣例

- 新增條目編號 `GD-n`(global decision),最新放 §2 最上方。
- 一條目至少含:**發現處**、**問題/決策**、**理由**、**影響面**、**待辦/結論**、**狀態**。
- 解決時:更新狀態為 ✅、補日期與 commit、整條移到 §3。
- 影響到 ADR/D 決策時,回改原權威文件,並在 §1 留變更註記。
