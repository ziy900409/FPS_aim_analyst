# DECISIONS — 全域決策與跨文件矛盾帳本

> 專案的**全域 episodic memory**:記跨 WP / 跨文件的決策、未解問題、文件間的不一致。
> per-WP 的決策與意外寫在各 WP 的 `progress.md`;**跨界的**(影響規格 / PLAN / 多個 WP)才寫這裡。
> 索引:[exec-plan/README.md](README.md) · 術語:[CONTEXT.md](../../CONTEXT.md) · 導航:[docs/MAP.md](../MAP.md)
> 語言:繁體中文,術語保留英文(D4)。最新在上。

---

## 1. 既有決策的權威來源(本檔不複製,只指路)

| 類別 | 出處 | 內容 |
|---|---|---|
| 架構決策 **ADR-1~9** | [規格書](../規格書_Three.js_WebGPU_反向急停瞄準訓練器.md) | 1 WebGPU+fallback、2 雙迴圈、3 固定步長 128Hz、4 計時/cross-origin、5 Pointer Lock 原始輸入、6 目標 motion registry、7 兩個時鐘、8 peek 推進 P2、9 source unit |
| 規劃補充決策 **D1~D5** | [PLAN.md §1](../PLAN.md) | 2D UI 技術、測試框架、COOP/COEP 部署、文件語言、PLAN 顆粒度 |

> 上述為已定案的權威決策,改動須回原文件並在此記一筆變更。

---

## 2. 未解 / 待對帳項(OPEN)

> 狀態:🔴 矛盾待解 · 🟡 待決策 · ✅ 已解(移至 §3 並標日期)

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
| **發現處** | [stage2 README](active/stage2/README.md) 已整合規格 §1.3 階段 B、CS2 壓槍軌跡復刻研究計畫、2026-07-03 後座力整合稽核報告,但採納決策尚未進全域帳本;[WP-10 T0](active/stage2/wp-10-recoil-core/T0-entry-gate.md) 要求在寫 recoil code 前完成拍板。 |
| **決議** | 採納 stage2 範圍:CS2 後座力系統(固定彈道表 / punch 動力學 / inaccuracy)、武器層、sim/camera 接線、movement physics、schema v2、壓槍指標與整合驗收。 |
| **六個決策點** | 1. recoil 衰減公式以 **1/64s** 步長定義,在 128Hz sim 內以偶數 tick 的 64Hz 子節奏執行(OQ-S2-1)。2. 彈匣盡即停火,本階段不做 reload;drill 一 peek ≤ 一匣(OQ-S2-6)。3. 感度語意改為 CS2 `0.022°/count`,舊匯出資料以 `sensitivityModel` / `schemaVersion` 斷代。4. WP-14 movement integrator 會改變決定性 baseline,屬預期 breaking change;先重驗 M1 決定性契約再重錄 baseline。5. `src/sim` / `src/recoil` 禁 `Math.random()`,所有隨機性以 seeded RNG 注入並記錄 seed。6. movement model 以 `MovementProfile` 留資料接口;Valorant 不進 stage2,僅在 WP-14/WP-16 保留 profile/meta 斷代能力。 |
| **WP-12 T0 補充** | OQ-S2-3 標注方式拍板:T1 先加 `sensitivityModel: 'cs2-0.022deg'` 字串欄;舊匯出無此欄即代表階段 A 佔位感度模型 `0.0022 rad/count`;`schemaVersion` bump 留給 WP-16 schema v2 一次處理,避免兩次 schema 斷代;舊資料不回溯轉換。(2026-07-06) |
| **權威來源** | [stage2 README §1.3](active/stage2/README.md#13-constraint%E7%A1%AC%E7%B4%84%E6%9D%9F%E6%96%B0%E5%A2%9E%E9%A0%85%E5%B0%87%E5%9B%9E%E5%AF%AB-claudemd-4)、[§2.4](active/stage2/README.md#24-tick-%E7%AF%80%E5%A5%8F%E8%A8%AD%E8%A8%88%E9%97%9C%E9%8D%B5%E6%B1%BA%E7%AD%96%E8%A6%8B-oq-s2-1)、[§8](active/stage2/README.md#8-open-questions)、[WP-10 T0](active/stage2/wp-10-recoil-core/T0-entry-gate.md)。 |
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
