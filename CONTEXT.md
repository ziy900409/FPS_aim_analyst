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
| **peek** | 一次「探頭—對齊—開火」的循環。左右 peek 的對稱性是量測指標之一。 |
| **首發（first shot / firstShot）** | 每個循環的**第一發**。首發命中率只計第一發，不被後續掃射稀釋。 |
| **急停反應時間** | `t_counter − t_visible`：敵人可見 → 按下反向鍵的時間差。 |
| **速度歸零誤差（residual speed）** | 開火瞬間殘餘速度的絕對值，越接近 0 越精準。 |
| **停火時序對齊** | `t_fire − t_velocity_zero`：速度歸零到開火的時間差；負值代表「人未停先開槍」。 |
| **首發命中率** | （首發命中 / 總 peek）× 100%。 |
| **準心對齊偏移** | 開火 tick 時準心座標與目標 hitbox 中心的距離／角度。 |
| **切換時間** | `t_next_acquisition − t_prev_kill`：擊殺一目標到對下一目標有效對齊的時間。 |
| **節奏穩定度** | 各循環耗時的標準差／變異係數。 |
| **左右對稱性** | 左 peek 與右 peek 在反應時間與命中率上的差異。 |
| **速度 gate（velocity gate）** | 以速度是否夠低（階段 A 為「已停止」flag；階段 B 為精準度門檻 ~88 u/s）決定開火是否精準的判定機制。 |
| **pre/post（前後測）** | 研究方法學：證明訓練成效需前後測對照與適應週期。**單純本地觀察只能得到受試者內相對值。** |

---

## B. 架構元件（components — 系統內部正規名）

| 元件 | 職責 | 層 |
|---|---|---|
| **`InputSampler`** | ~1000 Hz 事件驅動採樣鍵鼠、蓋高解析度時間戳、寫入輸入緩衝（F1） | 輸入 |
| **`SharedState`** | 三迴圈唯一溝通管道：輸入緩衝、player velocity、準心、目標狀態、`t_visible`（單例） | 狀態 |
| **`SimLoop`** | 128 Hz 固定步長 accumulator 迴圈：消費輸入 → movement → 急停判定 → 命中判定 → 記錄（F2/F3） | 模擬 |
| **`MovementController`** | A/D 橫移 + 急停（階段 A 簡化「立即停止」/ 階段 B physics）；介面跨階段不變（F3） | 模擬 |
| **`TargetManager`** | 目標 spawn／可見性、左右交替序列、蓋 `t_visible`（F2/F4） | 模擬 |
| **`HitDetector`** | Raycaster 命中判定、首發判定（F3） | 模擬 |
| **`RenderLoop`** | rAF 迴圈，讀 sim 最新狀態做 alpha 內插後繪製 | 渲染 |
| **`SceneManager`** | Three.js 場景、camera、room、crosshair、HUD 容器 | 渲染 |
| **`DataRecorder`** | 每 tick 記錄、**ring buffer**、JSON/CSV 匯出（F1/F2） | 資料 |
| **`DrillConfig`** | 由資料定義 drill 的 schema（F4） | 設定 |
| **`MetricsDashboard`** | drill 後統計第 5 節全部指標 | 指標 |

---

## C. 架構概念（concepts）

| 術語 | 定義 |
|---|---|
| **雙迴圈（dual-loop）** | 邏輯（sim）與渲染（render）解耦，加上事件驅動的輸入採樣，共三條速率不同的迴圈，互不直接呼叫、全透過 `SharedState` 溝通（ADR-2）。 |
| **fixed-timestep** | sim 以固定步長（128 Hz / 7.8125 ms）推進，產生與幀率無關、deterministic 的 velocity 軌跡。 |
| **accumulator** | fixed-timestep 的實作模式：累加經過時間，每滿一個 TICK 就跑一次 `simStep`，餘量夾住避免 spiral of death。 |
| **alpha 內插（interpolation）** | render 在兩個 sim tick 之間用係數 `alpha = acc / TICK` 內插，畫面才不抖。 |
| **決定性（determinism）** | 同一輸入序列在不同 render FPS 下，sim 結果一致。WP-2.4 / WP-9.3 的驗收基準。 |
| **`t_visible`** | 目標可見瞬間，在 **sim tick 內**蓋上的 `performance.now()` 時間戳（F2）；所有反應時間量測的起點。 |
| **sim tick rate** | 階段 A = 128 Hz（= 64×2，便於對照 CS2 的 15.625 ms tick）；設為設定常數，不寫死。 |
| **ring buffer** | 固定大小、物件重用的環狀緩衝，避免每 tick 配置物件造成 GC 週期性卡頓。 |
| **cross-origin isolation** | 經 COOP（`same-origin`）/COEP（`require-corp`）標頭啟用，把 `performance.now()` 解析度從 100 µs 提升到 5 µs，並解鎖 `SharedArrayBuffer`（ADR-4）。 |
| **原始輸入（`unadjustedMovement`）** | Pointer Lock 關閉 OS 滑鼠加速，確保 sensitivity 可重現；僅 Chromium 支援，須捕捉 `NotSupportedError` fallback（ADR-5）。 |
| **coalesced events** | `getCoalescedEvents()` 取回次幀的滑鼠樣本，1000 Hz 滑鼠下不遺失中間軌跡（ADR-5）。 |
| **backend（render backend）** | 實際使用的渲染後端：`webgpu` 或 `webgl2`（fallback）。延遲特性不同，必須寫入匯出資料 metadata（ADR-1）。 |

---

## D. 階段定義

| 術語 | 定義 |
|---|---|
| **階段 A（Stage A）** | 本次交付：F1–F4 + 1 個 counter-strafe drill，急停為簡化「立即停止」判定。鎖定 Chrome/Edge 桌面版。 |
| **階段 B（Stage B）** | 未來：以 Source friction + acceleration integrator 復刻 CS2 真實 physics、速度 gate 精準度模型、sim loop 移入 Web Worker。架構已預留。 |

---

## E. CS2 physics 常數（階段 B 校準起點，附錄 D）

| 常數 | 值 | 用途 |
|---|---|---|
| 最大跑速 | ~250 u/s | movement 上限 |
| `sv_friction` | 5.2 | 地面摩擦 |
| `sv_accelerate` | 5.6 | 加速度 |
| `sv_stopspeed` | 75 | 摩擦下限速度 |
| 精準度門檻 | ~max 的 34%（步槍 ~88 u/s） | 速度 gate |
