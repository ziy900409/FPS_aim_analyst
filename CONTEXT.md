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
| **首發（first shot / firstShot）** | 每個 peek 的**第一發**，帶 `firstShot=true` 旗標。首發命中率 = 首發命中 peek 數 / peek 數；不被後續掃射稀釋（P2 下靠**旗標**保證，非靠推進政策）。**counter-strafe 的時序/精度指標（急停反應、停火對齊、殘餘速度、準心偏移）一律錨在首發**；後續補槍只為 kill、不計入 counter-strafe 量測。`DataRecorder` 須能還原兩個錨點 `t_firstShot` 與 `t_kill`（首發即命中時兩者相同），故每 peek 記 `shotCount` 與逐發事件。 |
| **急停反應時間** | `t_counter − t_visible`：敵人可見 → 按下反向鍵的時間差。 |
| **速度歸零誤差（residual speed）** | 開火瞬間殘餘速度的絕對值，越接近 0 越精準。⚠️ **階段 A 立即停止（M1）下退化成二元**（velocity ∈ {0, ±v}），量不出連續精度；屬 counter-strafe 的「停得多準」維度，要等階段 B physics。`DataRecorder` 仍每 tick 記 velocity、開火 tick 記此欄（欄位先存、階段 B 自動升級成連續值）；結果頁以**分類**（開火時「已停止/移動中」、「有無反向」）呈現，不顯示誤導性 u/s。 |
| **停火時序對齊** | `t_fire − t_velocity_zero`：速度歸零到開火的時間差；負值代表「人未停先開槍」。階段 A 立即停止下 `t_velocity_zero` 塌縮成 `t_counter`，故量的是「開火相對**急停輸入**」的時序（語意改變但仍可用）。 |
| **首發命中率** | （首發命中 / 總 peek）× 100%。 |
| **準心對齊偏移** | 開火事件在排序串流中那一點，準心射線與目標 hitbox 中心的距離／角度（**sub-tick 忠實、零內插**，見 simStep 順序）。「準心射線」≡ **camera 正向（螢幕中心）射線**，HitDetector raycast 同此；畫面十字（階段 A = DOM overlay）純裝飾、**必須精確置中**（注意 `devicePixelRatio`），指標**不讀**該元素座標。 |
| **切換時間** | `t_next_acquisition − t_prev_kill`：擊殺一目標到對下一目標有效對齊的時間。 |
| **節奏穩定度** | 各循環耗時的標準差／變異係數。⚠️ P2 下「循環耗時」有兩種錨可選：`t_visible→t_kill`（含補槍 cleanup）或首發間隔（`t_firstShot`）；兩者量的是不同技能（清目標節奏 vs 首發節奏），分析端擇一——**兩個錨都要記**。 |
| **左右對稱性** | 左 peek 與右 peek 在反應時間與命中率上的差異。 |
| **速度 gate（velocity gate）** | 以速度是否夠低（階段 A 為「已停止」flag；階段 B 為精準度門檻 ~88 u/s）決定開火是否精準的判定機制。 |
| **pre/post（前後測）** | 研究方法學：證明訓練成效需前後測對照與適應週期。**單純本地觀察只能得到受試者內相對值。** |

---

## B. 架構元件（components — 系統內部正規名）

| 元件 | 職責 | 層 |
|---|---|---|
| **`InputSampler`** | ~1000 Hz 事件驅動採樣鍵鼠、蓋高解析度時間戳、寫入輸入緩衝（F1） | 輸入 |
| **`SharedState`** | 三迴圈唯一溝通管道：輸入緩衝（固定欄位 ring buffer）、player velocity、準心、目標狀態、`t_visible`（單例）。階段 B 的兩道跨執行緒縫＝**輸入佇列**（主→worker）與 **`RenderSnapshot`**（worker→主）；其餘狀態跟著 sim 進 worker、不跨界。 | 狀態 |
| **`SimLoop`** | 128 Hz 固定步長 accumulator 迴圈：消費輸入 → movement → 急停判定 → 命中判定 → 記錄（F2/F3） | 模擬 |
| **`MovementController`** | A/D 橫移 + 急停（階段 A 簡化「立即停止」/ 階段 B physics）；介面跨階段不變（F3）。**狀態機 = M1**：鍵恆為移動鍵，反向鍵在穿越方向那一 tick 把 velocity **snap 到 0**（即「立即停止」）＋升 `stopped` flag，續按反向鍵 → 下一 tick `−v`（反向/過衝）。橫移亦為**瞬間 snap**（按 A/D → velocity 瞬間 ±`v_strafe`、放開 → 0；無 accel ramp，velocity 為純階梯函數），`v_strafe` config 預設 ~250 u/s。階段 B 把起步與停止都換成 friction+accel integrator，狀態機外形不變。 | 模擬 |
| **`TargetManager`** | 目標 spawn／可見性、左右交替序列、蓋 `t_visible`（F2/F4） | 模擬 |
| **`HitDetector`** | Raycaster 命中判定、首發判定（F3）。**階段 A 單一 hitbox**（命中/未命中；`part` 欄位保留選填、向後相容，頭/身分解延後至「精準射擊」維度）。 | 模擬 |
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

---

## D. 階段定義

| 術語 | 定義 |
|---|---|
| **階段 A（Stage A）** | 本次交付：F1–F4 + 1 個靜止 counter-strafe drill，急停為簡化「立即停止」判定。鎖定 Chrome/Edge 桌面版。 |
| **F5 接縫（seam-in, drills-out）** | 階段 A **建好 F5 的架構接縫**（`SimLoop` step 順序保留 target-motion slot、`TargetManager` 帶 motion registry、`DrillConfig.targets.motion?` 選填欄位、預設 `static` 為恆等策略），但**不交付移動目標 drill**。移動 drill、追蹤誤差／追蹤穩定度指標、slide-in 的 `t_visible` 判準延後至階段 A+／B——因為「移動＋急停的能力混淆」是未解的研究設計問題（附錄 F），slide-in 判準也尚未定義。規格 v1.1 把 F5 列為階段 A 必要功能，與此決議不一致，**規格／PLAN／exec-plan 待做一次版本對帳**。 |
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
