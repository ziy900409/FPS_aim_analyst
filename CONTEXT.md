# CONTEXT — 專有名詞詞彙表

> 本專案：FPS 反向急停（counter-strafe）瞄準訓練器（Three.js + WebGPU）。
> 本檔記錄領域與架構的「正規術語」（canonical terms），供開發者與 agent 對齊用語。撰寫語言：繁體中文，技術術語保留英文原文。
> 相關文件：[`docs/PLAN.md`](./docs/PLAN.md)、[`docs/規格書_Three.js_WebGPU_反向急停瞄準訓練器.md`](./docs/規格書_Three.js_WebGPU_反向急停瞄準訓練器.md)。

---

## A. 領域術語（domain — 對研究者/玩家有意義）

| 術語 | 定義 |
|---|---|
| **counter-strafe（反向急停）** | CS 系列的核心技巧：移動中按下**反向鍵**讓角色速度迅速歸零，在 `v≈0` 的瞬間開火以取得最高精準度。本專案量測的目標行為。 |
| **反向鍵（counter key）** | 與當前移動方向相反的按鍵（向右 D 移動時的 A，反之亦然）。按下即觸發急停判定。 |
| **drill** | 由**資料（config）**定義的一次訓練單元，規定目標數、位置、時序、左右交替方向與結束條件。新增 drill 不需改引擎程式碼（F4）。 |
| **peek** | 一次「探頭—對齊—開火」的循環，**1 個目標 presentation ⇄ 1 個 peek**。**推進政策 = P2（命中才推進）**：目標可見後持續存在，未命中不撤；**第一次命中 = kill → 撤掉、生成下一個**（左右交替「擊殺右→生成左」因此原樣成立）。每 peek 開槍數可變（0+ 次 miss 後 1 次命中）。設 `peekTimeoutMs`（config）：逾時未 kill → 記為 `timeout`、推進，避免卡死。drill 結束 = 目標數達標 **或** 總時長到（雙閘）。左右 peek 對稱性是量測指標之一。 |
| **首發（first shot / firstShot）** | 每個 peek 的**第一發**，帶 `firstShot=true` 旗標。首發命中率 = 首發命中 peek 數 / peek 數；不被後續掃射稀釋（P2 下靠**旗標**保證，非靠推進政策）。**counter-strafe 的時序/精度指標（急停反應、停火對齊、殘餘速度、準心偏移）一律錨在首發**；後續補槍只為 kill、不計入 counter-strafe 量測。`DataRecorder` 須能還原兩個錨點 `t_firstShot` 與 `t_kill`（首發即命中時兩者相同），故每 peek 記 `shotCount` 與逐發事件。**full-auto(WP-11)下 `firstShot` 仍錨定 peek**(每 peek 的第一發 shot),不隨扳機開合移動;與 `recoil index=0`(每段連續射擊,§F)為**可分岔**的兩件事——同一 peek 內 double-tap 的第二次 fire-down,其 shot `firstShot=false` 但 recoil index 重新從 0。 |
| **急停反應時間** | `t_counter − t_visible`：敵人可見 → 按下反向鍵的時間差。 |
| **速度歸零誤差（residual speed）** | 開火瞬間殘餘速度的絕對值，越接近 0 越精準。⚠️ **階段 A 立即停止（M1）下退化成二元**（velocity ∈ {0, ±v}），量不出連續精度；屬 counter-strafe 的「停得多準」維度，要等階段 B physics。`DataRecorder` 仍每 tick 記 velocity、開火 tick 記此欄（欄位先存、階段 B 自動升級成連續值）；結果頁以**分類**（開火時「已停止/移動中」、「有無反向」）呈現，不顯示誤導性 u/s。 |
| **停火時序對齊** | `t_fire − t_velocity_zero`：速度歸零到開火的時間差；負值代表「人未停先開槍」。階段 A 立即停止下 `t_velocity_zero` 塌縮成 `t_counter`，故量的是「開火相對**急停輸入**」的時序（語意改變但仍可用）。 |
| **首發命中率** | （首發命中 / 總 peek）× 100%。 |
| **準心對齊偏移** | 開火事件在排序串流中那一點，準心射線與目標 hitbox 中心的距離／角度（**sub-tick 忠實、零內插**，見 simStep 順序）。「準心射線」≡ **camera 正向（螢幕中心）射線**，HitDetector raycast 同此；畫面十字（階段 A = DOM overlay）純裝飾、**必須精確置中**（注意 `devicePixelRatio`），指標**不讀**該元素座標。 |
| **追蹤誤差 ε(t)（tracking error）／on-target** | ε(t) = 逐 tick 的「準心射線 vs 目標 hitbox 中心」夾角（deg）——**準心對齊偏移由 fire 瞬間推廣到逐 tick**，同一數學、同一單位。**on-target（逐 tick 二元）**= 準心射線 ∩ H1 hitbox（與命中判定同幾何，**零新門檻參數**）。全部由 schema v2 原始欄位（aim + 玩家/目標位置）**離線推導**，不進 sim 熱路徑（GD-7）。 |
| **獲取時間（t_acquire）** | `t_first_on_target − t_visible`：目標可見到首次 on-target 的時間——flick／獲取構念，與追隨（pursuit）分離。整段 presentation 未 on-target → 記**獲取失敗**（計入獲取失敗率、該 presentation 不進 TOT 聚合；失敗是資料不是缺失值）（GD-7）。 |
| **time-on-target（TOT%）／追蹤窗口** | **追蹤窗口 = [t_first_on_target, presentation 結束)**——TOT% 與 ε 統計只在窗內算，獲取能力不污染追隨量測（能力混淆的**指標層**緩解）。TOT% = 窗內 on-target tick 比例；**pre-registered 主統計量 = RMS(ε)**（對跟丟瞬間平方級敏感）；median／P95／streak 為離線副指標（GD-7）。 |
| **偵測反應時間（detection RT）／t_detect** | `t_detect − t_visible`（量測時鐘域）。**t_detect = 瞄準移動 onset**：`t_visible` 後第一個「ε(t) 以超過雜訊底的角速度下降、持續 k tick」的 tick——**離線**從 128Hz aim 流推導，雜訊底以 **per-trial 前刺激窗口**（spawn 前 aim 抖動）校準，θ_v／k 為 pre-registered 分析參數。無眼動儀下的標準 proxy（含動作啟動成分）。副構念 **engagement time** = `t_first_fire − t_visible`（GD-8）。 |
| **偏心度（eccentricity）** | spawn 瞬間「玩家瞄準方向 vs 目標」的角距離——偵測 RT 的最強預測子之一。**記錄為共變數**（aim@spawn + 目標位置離線推導）；不做 fixation gate（那會讓 aim 成為 sim 演進輸入，動 GD-4「aim 僅觀測」契約）（GD-8）。 |
| **pop-in／slide-in（偵測刺激）** | **pop-in**：目標瞬現，`t_visible` = spawn tick（現行語意，OQ-4.2）；偵測 drill 起手式。**slide-in**：目標自宣告式 occluder 後滑出；判準已預先釘死＝**目標中心穿越 DrillConfig 宣告可見性邊界的那一 tick** 蓋 `t_visible`（camera 無關、決定性）——落地待 GD-6 升級路徑 C 觸發（GD-8）。 |
| **切換時間** | `t_next_acquisition − t_prev_kill`：擊殺一目標到對下一目標有效對齊的時間。 |
| **節奏穩定度** | 各循環耗時的標準差／變異係數。⚠️ P2 下「循環耗時」有兩種錨可選：`t_visible→t_kill`（含補槍 cleanup）或首發間隔（`t_firstShot`）；兩者量的是不同技能（清目標節奏 vs 首發節奏），分析端擇一——**兩個錨都要記**。 |
| **左右對稱性** | 左 peek 與右 peek 在反應時間與命中率上的差異。 |
| **速度 gate（velocity gate）** | 以速度是否夠低（階段 A 為「已停止」flag；階段 B 為精準度門檻 ~88 u/s）決定開火是否精準的判定機制。 |
| **pre/post（前後測）** | 研究方法學：證明訓練成效需前後測對照與適應週期。**單純本地觀察只能得到受試者內相對值。** |
| **雜亂度階層（clutter tier）** | 場景的實驗定義軸：以可量測的視覺統計（雜亂度／對比分佈／深度線索密度）分階（`field-low`／`urban-high`／`mixed-mid`），取代品牌擬真作為場景需求規格。偵測 RT 受背景雜亂度調變——雜亂度是要控制／操弄的自變因，「像哪款遊戲」不是。場景為**寫實原創**：不複製特定遊戲地圖配置（GD-9）。 |
| **資格閘（eligibility gate）** | 遠端施測 session 開始的**軟體自動檢查**：原生解析度 ≥ 實驗最高條件（`screen.width × devicePixelRatio`）、fullscreen 強制、效能地板（frame-time 超標 → `suspect`／剔除）；**不合格拒入實驗，非僅記錄**。搭配**受試者內解析度對比**（同面板跑全部條件、順序對抗平衡，面板特性一階抵銷）；解析度實驗構念＝「同一面板上的 render 解析度效應」。螢幕型號／觀看距離等自陳欄位僅作 moderator（GD-10）。 |
| **三層實驗結構（experiment→session→drill）** | 對映 FPSci 的 experiment→session→trial。**drill** = 本表既有定義；**session** = 一次施測（資格閘 → setup 表單 → 條件序列 → 匯出），引擎面宣告 = `ProtocolConfig`（WP-22 T2）；**experiment** = 多 session 的組合與統計設計，屬**分析端概念、引擎不實作**。跨場次串接鍵 = **`participantId`**（研究者發放代號）+ **`sessionLabel`**（pre/post/day-N），setup 表單自陳、進 meta `session` 區塊——前後測資料離線串接不靠檔名人工紀律（2026-07-07 grill，FPSci R3 對齊；授權紅線 GD-11）。 |
| **ADS（開鏡 / aim-down-sight）** | 右鍵**按住**開瞄準鏡（hold 語意，OQ-S5-6）：視野收窄（FOV↓）放大目標、滑鼠感度依 **GD-16** 換算（通常變慢），放開回復。屬**視覺/操作**層，**不改** sim 演進、命中幾何或彈道語意（GD-16）。研究構念 = ADS 條件下的獲取／首發／追蹤表現；效度靠逐 tick `ads` flag ＋ ads 事件離線還原（FR-E6，缺記錄該 drill 分析無效）。管線術語見 §G。 |

---

## B. 架構元件（components — 系統內部正規名）

| 元件 | 職責 | 層 |
|---|---|---|
| **`InputSampler`** | ~1000 Hz 事件驅動採樣鍵鼠、蓋高解析度時間戳、寫入輸入緩衝（F1） | 輸入 |
| **`SharedState`** | 三迴圈唯一溝通管道：輸入緩衝（固定欄位 ring buffer）、player velocity、準心、目標狀態、`t_visible`（單例）。階段 B 的兩道跨執行緒縫＝**輸入佇列**（主→worker）與 **`RenderSnapshot`**（worker→主）；其餘狀態跟著 sim 進 worker、不跨界。 | 狀態 |
| **`SimLoop`** | 128 Hz 固定步長 accumulator 迴圈：消費輸入 → movement → 急停判定 → 命中判定 → 記錄（F2/F3） | 模擬 |
| **`MovementController`** | A/D 橫移 + 急停（階段 A 簡化「立即停止」/ 階段 B physics）；介面跨階段不變（F3）。**狀態機 = M1**：鍵恆為移動鍵，反向鍵在穿越方向那一 tick 把 velocity **snap 到 0**（即「立即停止」）＋升 `stopped` flag，續按反向鍵 → 下一 tick `−v`（反向/過衝）。橫移亦為**瞬間 snap**（按 A/D → velocity 瞬間 ±`v_strafe`、放開 → 0；無 accel ramp，velocity 為純階梯函數），`v_strafe` config 預設 ~250 u/s。階段 B 把起步與停止都換成 friction+accel integrator，狀態機外形不變。 | 模擬 |
| **`TargetManager`** | 目標 spawn／可見性、左右交替序列、蓋 `t_visible`（F2/F4） | 模擬 |
| **`HitDetector`** | Raycaster 命中判定、首發判定（F3）。**階段 A 單一 hitbox**（命中/未命中；`part` 欄位保留選填、向後相容，頭/身分解延後至「精準射擊」維度）。**hitbox 尺寸為資料**（WP-23）：`DrillConfig.targets.hitbox?` 省略 = 唯一預設 H1 `{1,2,1}` 逐位不變;H1 **單一 hitbox 語意不變**,只是尺寸從寫死常數變成 config 值。**單一來源**貫穿 sim 命中(`TargetState.hitbox`)、渲染、淨空、離線 on-target 推導(讀 `meta.targets.hitbox`),同幾何零新門檻由測試釘死(GD-7)。 | 模擬 |
| **`RenderLoop`** | rAF 迴圈，讀 sim 最新狀態做 alpha 內插後繪製 | 渲染 |
| **`SceneManager`** | Three.js 場景、camera、room、crosshair、HUD 容器 | 渲染 |
| **`DataRecorder`** | 每 tick 記錄、**preallocated arena**（**非環狀**；drill 內線性不 wrap，容量 `N = ceil(maxDrillSeconds × simHz)` + 裕度，`maxDrillSeconds` 預設 **300s（5 分鐘）** → ≈ 38,400 槽；跨 drill index 歸零、覆寫同一塊；超出升 `recorderOverflow` 標 suspect）、JSON/CSV 匯出（F1/F2）。容量上限與 drill 雙閘的「總時長」是**同一個數**，正常會先因總時長結束、碰不到上限。定位在 **sim 下游**，由 `simStep` 末端呼叫（非被 render／UI 直接讀）；階段 B 跟著 sim 進 worker、worker 內記錄、drill 結束才 `postMessage` 匯出，故不經 SAB。 | 資料 |
| **`DrillConfig`** | 由資料定義 drill 的 schema（F4） | 設定 |
| **`MetricsDashboard`** | drill 後統計第 5 節全部指標 | 指標 |

---

## C. 架構概念（concepts）

| 術語 | 定義 |
|---|---|
| **雙迴圈（dual-loop）** | 邏輯（sim）與渲染（render）解耦，加上事件驅動的輸入採樣，共三條速率不同的迴圈，互不直接呼叫、全透過 `SharedState` 溝通（ADR-2）。 |
| **fixed-timestep** | sim 以固定步長（128 Hz / 7.8125 ms）推進，產生與幀率無關、deterministic 的 velocity 軌跡。 |
| **accumulator** | fixed-timestep 的實作模式：累加經過時間，每滿一個 TICK 就跑一次 `simStep`，餘量夾住避免 spiral of death。 |
| **simStep 順序（tick 內）** | 每 tick 依序：① 階段 B 目標 motion 更新到本 tick 位置（ADR-6）；② 依 `timeStamp` 排序處理事件串流——鍵事件更新 strafe velocity 與急停 snap（M1）、滑鼠樣本更新準心、**開火事件就地 raycast**（打「本 tick 目標位置 × `t_fire` 當下準心」）；③ 由 velocity 推進玩家位置（固定步長，tick 解析度可接受）；④ `DataRecorder` 記錄 tick row 與事件。玩家側因就地評估而 **sub-tick 忠實、零內插**；目標側 ADR-6 最近-tick 偏差只剩階段 B 移動目標。 |
| **alpha 內插（interpolation）** | render 在兩個 sim tick 之間用係數 `alpha = acc / TICK` 內插，畫面才不抖。 |
| **決定性（determinism）** | 同一輸入序列在不同 render FPS 下，sim **狀態**一致。WP-2.4 / WP-9.3 斷言「同一 tick index 的位置／velocity／命中與否／事件落在第幾 tick」相等，**不**斷言 wall-clock 時間戳（後者本質非決定性）。 |
| **量測時鐘 vs 決定性時鐘（two-clock model）** | 系統用兩個時鐘、各司其職。**量測時鐘** = `performance.now()`，與 `event.timeStamp` 同 time origin、**直接可減**，所有跨角色延遲指標（反應時間、停火時序對齊、切換時間）都在此域計算；非決定性、接受 ≤1 tick／render-frame 量化，量化寫成誤差界線（同 §15 顯示延遲誤差數量級）。**決定性時鐘** = 邏輯 tick index（`tick0 + n·TICK`），`DataRecorder` 每-tick row 以 tick index 為鍵，供決定性測試斷言狀態。⚠️ `event.timeStamp` 與 `performance.now()` 同源可減**僅在 Chromium（鎖定的 Chrome/Edge）成立**；若哪天要支援非 Chromium，這個假設要重新驗。 |
| **`t_visible`** | 目標可見瞬間，在**狀態翻轉那個 sim tick 執行當下**蓋的 `performance.now()` 時間戳（量測時鐘域，F2）；所有反應時間量測的起點。因 tick 在 rAF frame 開頭爆發執行，帶 ≤1 render-frame／1 tick 的量化，記為已知誤差界線。 |
| **sim tick rate** | 階段 A = 128 Hz（= 64×2，便於對照 CS2 的 15.625 ms tick）；設為設定常數，不寫死。 |
| **ring buffer** | 固定大小、物件重用的環狀緩衝，避免配置物件造成 GC 週期性卡頓。**ring buffer 專指輸入緩衝**：真環狀、**消費後槽位重用、drill 內持續繞圈**（事件被 sim 消費即不再需要）；每個 ~1000Hz 事件壓成固定數值欄位 `type,t,a,b`、不 `push` 物件——當下擋 GC、未來 SAB-portable。⚠️ `DataRecorder` 雖也預配置+重用防 GC，但**不是環狀**（每 tick row 要留到匯出）——見 `DataRecorder` 元件列的 **preallocated arena**。<br>**實作定案（WP-3 T4b，[SharedState.ts](src/state/SharedState.ts) `createInputRing`）**：`RING_CAPACITY=512`（2 的冪、`& MASK` 繞圈）；`Uint8Array type`（`EV_KEY=0`/`EV_MOUSE=1`/`EV_FIRE=2`）+ `Float64Array t/a/b`（key：`a`=code enum、`b`=down 0/1；mouse：`a`=dx、`b`=dy；fire 無 payload）。**code enum**（[types.ts](src/state/types.ts)）：`KEY_CODE = { KeyA:0, KeyD:1, KeyW:2, KeyS:3 }` + 反向 `CODE_KEY`。寫入端 **bounded insertion** 保序、`consume` 沿 head 游標排空並解碼進**單一重用 `InputEventView`**（handle 不得保留參考）；滿則 `bufferOverflow++`、拒新不丟舊（GD-2）。 |
| **`RenderSnapshot`** | render 讀 sim 狀態的**唯一窄介面**：一束數值化、可複製的快照（velocity、crosshair、active targets 的 id/position）。render **不得**伸手進 sim 物件圖。語意是「讀一份一致快照」，階段 A 為 plain struct，階段 B 換成 SAB + seqlock／double-buffer 做無撕裂讀取而 consumer 不改。 |
| **cross-origin isolation** | 經 COOP（`same-origin`）/COEP（`require-corp`）標頭啟用，把 `performance.now()` 解析度從 100 µs 提升到 5 µs，並解鎖 `SharedArrayBuffer`（ADR-4）。 |
| **原始輸入（`unadjustedMovement`）** | Pointer Lock 關閉 OS 滑鼠加速，確保 sensitivity 可重現；僅 Chromium 支援，須捕捉 `NotSupportedError` fallback（ADR-5）。 |
| **coalesced events** | `getCoalescedEvents()` 取回次幀的滑鼠樣本，1000 Hz 滑鼠下不遺失中間軌跡（ADR-5）。 |
| **輸入分桶（input bucketing）** | `InputSampler`↔`SimLoop` 的消費契約：事件以 `event.timeStamp` 落在哪個 tick 的**邏輯時間窗 `[tickStart, tickEnd)`** 決定它在哪個 tick 被消費（**非** rAF 爆發時把緩衝清空）——這是決定性的前提。桶內先依 `timeStamp` 排序再處理（解 coalesced 樣本與鍵盤事件的 append 亂序）。遲到落在已關閉 tick 的事件，夾進當前最舊未關閉 tick 並計入 `lateEventCount`；ring buffer 溢位升 `bufferOverflow` flag、該 drill 標 suspect（**不靜默丟最舊**）。`lateEventCount` / `bufferOverflow` 須寫進匯出 metadata。**容量政策**：`RING_CAPACITY = nextPow2(MAX_EVENT_RATE_HZ × MAX_STALL_S × SAFETY)` 為**靜態常數**，彈性放在設定/建置期、**執行期不動態 resize**（resize 會在 burst 當下 realloc+copy、正是 ring buffer 要消除的 GC 抖動，且 SAB 不可調整大小；溢位已由 `bufferOverflow` flag 兜底）。要支援 8000Hz 只改 `MAX_EVENT_RATE_HZ` 重建（最壞 ≈ 8000×0.25 ≈ 2K → next-pow2 4096），記憶體成本可忽略。 |
| **backend（render backend）** | 實際使用的渲染後端：`webgpu` 或 `webgl2`（fallback）。延遲特性不同，必須寫入匯出資料 metadata（ADR-1）。 |
| **正規單位（canonical unit）** | sim 與**所有記錄/匯出資料**一律用 **CS Source unit（u、u/s）**：最大跑速 ~250 u/s、`sv_stopspeed` 75、精準度門檻 ~88 u/s 原樣落地，階段 B 對照 CS2 `cl_showpos` 校準時零換算。`DrillConfig` 座標/range/速度、`velocity`、`residualSpeed` 全部 u/s。render 端可另套 **display scale** 做直覺場景尺度，但 **sim/資料不得用公尺**——避免換算因子在量測鏈埋人為誤差。 |
| **純裝飾場景（decorative scene）** | 場景（佔位房間、未來 BR 背景）只存在 render 層，sim 對其**零知識**；玩家位置在 sim 無界、牆不擋人——本系統既有本體論。場景幾何**不得**成為 sim 輸入（決定性 baseline 不分裂、F4 換場景零引擎碼）。視覺=物理一致性由**淨空驗證**在載入期保證，非 runtime 計算（GD-6）。 |
| **淨空驗證（clearance validation）** | drill 載入時的自動幾何 gate：**視線走廊（sightline corridor）**＝「玩家 strafe 走廊 ∪ 目標運動包絡」之凸包（保守過近似），與場景資產附帶的 **prop-bounds** 清單（僅驗證器可讀、**永不進 sim**）相交即**拒載 drill**（大聲失敗，不靠人工紀律）。玩家活動範圍為 config 宣告假設，runtime 逸出 → 標 `suspect`（純觀測）。走廊淨空 ⇒ 對場景 raycast 與無場景逐位元等價。prop-bounds 為未來宣告式 occluder / 授權 collision 的前身資料（GD-6）。 |
| **SceneConfig／sceneId（場景為資料）** | 場景比照 drill 為**資料驅動**：`sceneId`（中性命名，不掛遊戲名）＋ `assetPackVersion` ＋ prop-bounds 清單，全部進匯出 metadata；資產改版即斷代。授權紀律：CC0 優先、CC-BY 附 `ATTRIBUTIONS.md` 可 commit；NC／遊戲抽取資產／付費包原始檔**不得**入 public repo（GD-9）。 |

---

## D. 階段定義

| 術語 | 定義 |
|---|---|
| **階段 A（Stage A）** | 本次交付：F1–F4 + 1 個靜止 counter-strafe drill，急停為簡化「立即停止」判定。鎖定 Chrome/Edge 桌面版。 |
| **F5 接縫（seam-in, drills-out）** | 階段 A **建好 F5 的架構接縫**（`SimLoop` step 順序保留 target-motion slot、`TargetManager` 帶 motion registry、`DrillConfig.targets.motion?` 選填欄位、預設 `static` 為恆等策略），但**不交付移動目標 drill**。～2026-07-06 更新：當年延後的三個未決已全數拍板——能力混淆已解（GD-7：drill 分離＋指標層獲取／追隨分離）、追蹤指標已定義（GD-7：TOT%／RMS ε／t_acquire）、slide-in `t_visible` 判準已定義（GD-8：中心穿越宣告邊界；落地待 GD-6 路徑 C 觸發）。移動 drill 交付時程隨 WP-18（entry 僅餘 M8）。規格 v1.1 把 F5 列為階段 A 必要功能，與 seam-in/drills-out 決議不一致，**規格／PLAN／exec-plan 待做一次版本對帳**。 |
| **階段 B（Stage B）** | 未來：以 Source friction + acceleration integrator 復刻 CS2 真實 physics、速度 gate 精準度模型、sim loop 移入 Web Worker、移動目標 sub-tick 命中位置內插。架構已預留。 |

---

## E. CS2 physics 常數（階段 B 校準起點，附錄 D）

| 常數 | 值 | 用途 |
|---|---|---|
| 最大跑速 | ~250 u/s | movement 上限 |
| `sv_friction` | 5.2 | 地面摩擦 |
| `sv_accelerate` | 5.6 | 加速度 |
| `sv_stopspeed` | 75 | 摩擦下限速度 |
| 精準度門檻 | ~max 的 34%（步槍 ~88 u/s） | 速度 gate |

---

## F. CS2 後座力系統術語（階段 B / WP-10；數學核心 `src/recoil/`）

> 後座力數學核心於 WP-10 移植為純數學 TS 模組（零 three/DOM 相依），M5 golden 全綠 2026-07-05。模組輸出一律 **degree**（Source 慣例：pitch 正值朝下）；`degToRad` 與符號翻轉由 WP-13 接線處一次完成。

| 術語 | 定義 |
|---|---|
| **彈道表（recoil table）** | 以武器 `seed` 決定性生成的 64 筆 `(angleDeg, magnitude)` 序列（[recoilTable.ts](src/recoil/recoilTable.ts) `generateRecoilTable`）。ran1 RNG（IA=16807/IM=2147483647）+ full-auto 相鄰彈 Lerp 平滑（0.55）+ 前 4 發抑制係數（0.75→1.0）。AK-47（seed 223）前 8 筆逐位鎖定於 golden。 |
| **ran1** | Numerical Recipes 可攜式 seeded PRNG（[rng.ts](src/recoil/rng.ts) `createRan1`），Valve `CUniformRandomStream` 慣用序列的移植。輸出 `Rng = () => number` ∈ [0,1)；**sim/recoil 禁 `Math.random()`**（GD-5），所有隨機性注入此 stream 且 seed 寫入 metadata。 |
| **aimPunch** | 命中/開火造成的準心角度偏移狀態（pitch/yaw，degree）。每 recoil tick 以 HybridDecay 衰減，開火時由角速度 leapfrog 積分累積。 |
| **rawPunch×2（`aimPunch × 2`）** | 實際**彈道方向**採用的 punch 量 = `aimPunch` 的兩倍（Source 慣例：視覺 punch 與彈道 punch 分離）。AK 10 發後 `rawPunch×2` = pitch −10.18° / yaw −1.56°（golden，±0.01°）。視覺渲染角度用 `viewPunch`（另存、render 端內插）。 |
| **punch 動力學** | [punch.ts](src/recoil/punch.ts) 的 `RecoilState` + `recoilTick`（固定 1/64s）+ `recoilOnFire`。積分順序：先 HybridDecay → leapfrog 半步 → 角速度 `exp(−4.5·dt)` 衰減 → leapfrog 半步；對齊 CS2「先 decay 再 kick」。`recoilTick` 對非 1/64 dt 拋錯（硬約束）。 |
| **HybridDecay** | punch 每 tick 的混合衰減：指數項 `exp(−8·dt)` × 線性項（每 tick 減 `18·dt`，過零即歸零）。以 1/64s 步長定義，禁用變動 dt 代入。 |
| **recoil index** | 已連續開火發數計數，決定查彈道表第幾筆。停火超過 `cycletime × 1.1` 後以 `exp(−dt·ln10·2)` 衰減歸零；開槍時遞增。 |
| **cycletime** | 武器連射週期（秒）。AK-47 = 0.1s。決定產彈節奏（WP-11）與 recoil index 衰減延遲門檻（`× 1.1`）。 |
| **inaccuracy 三成分** | 擴散總量 = 站立基礎值（stand）+ 每發累積 `inaccuracyFire`（以 `exp(−dt·ln10/recoveryTime)` 回復）+ 移動附加 `(v/vmax)^0.25 × move`（[spread.ts](src/recoil/spread.ts) `sampleSpread`）。取樣 θ 均勻、半徑 = U(0,1)×inaccuracy（中心偏置），每發固定 2 次注入式 RNG 取樣（θ 先、radius 後）。 |
| **理想壓槍路徑（ideal recoil-compensation path）** | 完美抵銷 `rawPunch×2` 累積偏移所需的反向滑鼠軌跡；結果頁以玩家實際補償 vs 此理想路徑對照量測壓槍表現（WP-16）。彈道檢查頁（[patternViewer.ts](src/recoil/patternViewer.ts)，dev-only `#pattern`）以 `-aimPunch×2` 逐發點與連線人工核對 pattern 形狀。 |

---

## G. CS2 開火 / ADS 管線術語（WP-11 開火；WP-24 ADS 開鏡；武器抽象 `src/weapon/` + 輸入事件鏈）

> full-auto 開火管線於 WP-11 建立：武器抽象 → fire down/up 事件 → `heldFire` → tick 內 cycletime 產彈 + 彈匣；產彈點保留為 WP-13 recoil `onFire` 的唯一掛點。
> **ADS 開鏡管線**於 WP-24 建立，全面比照 fire 事件模式：`WeaponConfig.ads` → ads down/up 事件（`EV_ADS`）→ `heldAds` → render 端 FOV/感度 gain + scope overlay + 逐 tick 記錄。**只落 input/render/data 層**，不改 sim/命中/彈道（GD-16）。
> **「fire」正名（消歧）**：input 端 = **fire down/up**（扣／放扳機的*意圖*）；產出的一次擊發 = **shot（發）**（≡「產彈」），與既有 `首發`／`shotCount` 一致。`DataRecorder`／metrics 內既有的 `type:'fire'` row 語意是「一發 shot」（legacy 欄名，**不改**）。

| 術語 | 定義 |
|---|---|
| **`WeaponConfig`** | 武器抽象 schema（[WeaponConfig.ts](src/weapon/WeaponConfig.ts)）：`cycletimeSec`、`magSize`、`recoil{seed, magnitude, magnitudeVariance, angleVariance}`、`inaccuracy{stand, crouch, fire, move, recoveryTimeStand, recoveryTimeCrouch}`、選填 `recoveryTransition{startBullet, endBullet}`。`validateWeapon` 為零相依 runtime guard（比照 [drill/schema.ts](src/drill/schema.ts)），field-path 錯誤訊息、成功回窄化 config。⚠️ 階段 A（靜止站立 + strafe）僅用到 `inaccuracy.stand/move` 與 recoil 欄；`crouch`／`recoveryTimeCrouch` 為未來預留。 |
| **內建三把（`WEAPONS`）** | [weapons.ts](src/weapon/weapons.ts)：`ak47`（seed 223）、`m4a4`（seed 38965）、`m4a1s`（seed 38965）。`getWeapon(id)` 取用，未知 id 拋錯。M4 系列的 stand/crouch/move/recovery 暫繼承 AK 同一 stage2 baseline（`BASE_INACCURACY`），待 **WP-15 calibration** 補齊 per-weapon CS2 vdata 後再調。 |
| **fire down/up 事件** | input 端的擊發**意圖**：`{ type:'fire'; down: boolean; t: number }`。ring packed 以既有閒置 `b` 欄存 `down`（0/1），容量／佈局不變。fire-up（`down=false`）與 PointerLock 解鎖時補送的 **stuck-fire 防護** fire-up，共同維護 `heldFire`。⚠️ 與 §A 的「shot（發）」是不同層次的事件，勿混。 |
| **`heldFire`** | `SharedState` 旗標：扳機是否按住。fire-down 置真、fire-up／解鎖置假；為 full-auto 產彈排程的閘之一。 |
| **產彈排程（shot scheduler）** | `SimLoop` tick 內的**累加制**產彈（防漂移）：`while (heldFire && ammo > 0 && nextFireT <= tickEndMs) { 產一發 shot; nextFireT += cycletimeSec*1000 }`。首發（從閒置／停火後）`nextFireT = fire-down 事件的 t`。**禁**用 `nextFireT = now + cycletime` 重設制（會累積漂移；T3 DoD：30 發 span = 2900ms ± 1 tick）。 |
| **`nextFireT`** | 下一發 shot 預定產出的量測時鐘時間（ms）。以 `+= cycletimeSec*1000` 累加推進，非「當下 + cycletime」重設。 |
| **彈匣政策（ammo / magSize）** | `ammo` 每發遞減，`ammo === 0` 即停火；**stage2 不做 reload**（OQ-S2-6）。**`ammo` 於每個 peek／每次目標 spawn 重置回 `magSize`**——每 peek 一整匣，噴射獨立、左右 peek 可對照（不被殘彈污染），「drill 一 peek ≤ 一匣」由此成立。 |
| **產彈點 = recoil 掛點 seam** | WP-11 的產彈仍走既有 camera-center raycast（WP-5 路徑）；WP-13 在**同一點**呼叫 `recoilOnFire` + `sampleSpread` 並替換方向來源。此點是 recoil `onFire` 的**唯一**掛點。 |
| **`recoveryTransition`（選填）** | 每武器覆寫前段彈抑制斜坡的彈序窗 `{startBullet, endBullet}`，對應 §F 彈道表「前 4 發抑制係數 0.75→1.0」；未給則用預設。 |
| **`WeaponConfig.ads`（選填）** | 武器 ADS 光學：`{ fovDeg, sensitivityRatio }`。**省略 = 該武器不可開鏡**（ADS 為 no-op，維持 hip 視角）。`fovDeg` 只驗**正有限**（zoom-in 由 `fovDeg < hipFov` 於相機層自然成立；hipFov 為使用者/相機設定，不在武器資料內，validator 無從夾）；`sensitivityRatio` 正有限、預設 `1.0`。additive optional 加欄，對既有武器資料／schema **零破壞**；示範值加在 `ak47`（預設 drill 武器）。 |
| **ADS down/up 事件** | input 端開鏡**意圖**：`{ type:'ads'; down: boolean; t: number }`，event code `EV_ADS = 3`。ring packed 佈局**比照 fire**（`a=0`、`b=down` 0/1），容量／佈局不變、既有解碼零破壞。右鍵（`button===2`）down 走 pointer-lock 採計閘門、up 不受閘門（但需已採計 down）；鎖定中 `contextmenu` 抑制。走既有升冪分桶消費（`consume` 零改）。 |
| **stuck-ads 防護** | PointerLock 解鎖／blur 時若右鍵仍按住，由 `InputSampler.releaseAds(t)` 補送一筆**可被消費/記錄**的 ads-up（非直接寫旗標），避免 `heldAds` 永真跨 drill 汙染。比照 stuck-fire，掛在 `main.ts` 的 PointerLock onChange。 |
| **`heldAds`** | `SharedState` 旗標：右鍵是否按住開鏡。ads-down 置真、ads-up／解鎖置假（比照 `heldFire`）。**只 input/render/data 層可讀**：render 端切 camera FOV 目標 + 感度 gain、資料端逐 tick 記為 `ads` flag；`SimLoop.applyInput` 的 ads 分支**只翻此旗標**，不觸發 raycast／weapon schedule／目標演進（GD-16）。 |
| **ADS 感度換算（GD-16）** | 開鏡有效感度 = `sensitivity × sensitivityRatio × (adsFov / hipFov)`（CS2 式 FOV-ratio；pre-registered 後凍結）。gain 只乘 `CameraController.applyDelta` 的**使用者 delta**，**不**套到 punch／彈道／sim（避免雙重計入）。gain 為**階躍**（切換即完整目標態，分析可分），非隨 FOV 漸變。 |
| **ADS FOV 過渡（render-only）** | 開鏡切 camera FOV 目標值（hip↔ads），實際 FOV 以 render 幀線性內插趨近（`ADS_FOV_TRANSITION_MS = 120`，OQ-24.1）；**不進 sim／記錄**（記錄的是 `heldAds` 事件與 flag，非視覺過渡）。`CameraController.setAds(active, nowMs)` 顯式收 render `now`、不讀時鐘（可測、守時鐘域紀律）；過渡中反向切換自當前值起不跳變。 |
| **scope overlay** | 純 TS + DOM overlay（D1，[ScopeOverlay.ts](src/ui/ScopeOverlay.ts)）：ADS 時顯示圓形鏡框 + 周邊暗化，120ms 淡入淡出。`pointer-events:none`（不影響 Pointer Lock／canvas click）；準心（`Crosshair`）以較高 z-index **維持精確置中**（§A 準心紀律不變）。顯隱有效態 = `heldAds && weapon.ads !== undefined`。 |
| **ADS 記錄（FR-E6，效度必要條件）** | aim 資料已含 gain，離線分析**必須**靠 `ads` flag 還原構念：tick row required `ads` boolean（取 `state.heldAds`）+ ads down/up 進 `events[]`；JSON／CSV 皆含。metadata `meta.weapon`（additive optional snapshot：`id` + `ads{fovDeg,sensitivityRatio}`）供分析端重建 gain。缺記錄 = 測試紅。 |
