# 規格書與工作分解（WBS）
## FPS 反向急停（Counter-strafe）瞄準訓練器 — Three.js + WebGPU 架構

> 版本 v1.2（新增 §1.3「CS2 後座力系統」條目；數學核心 WP-10 M5 鎖定 2026-07-05）· 交付對象：負責實作的開發者 · 技術棧：Three.js (`WebGPURenderer`) + TypeScript + Vite
> 適用範圍：階段 A 簡化版原型（5 項必要功能 + 1 個 counter-strafe drill + 至少 1 個移動目標 drill），並為階段 B（真 CS2 physics + 目標 sub-tick 內插）預留架構

---

## 0. 文件目的與閱讀方式

這份文件分三層：

1. **規格書（第 1–6 節）** — 定義「要做什麼」「為什麼這樣做」「驗收標準」。
2. **工作分解 WBS（第 7 節）** — 把工作拆成可指派、可估時、有相依關係的任務包（work packages）。
3. **附錄（第 8 節起）** — 虛擬碼骨架、資料 schema、CS2 physics 常數、測試與驗收清單。

開發者請先讀第 2 節（架構決策）與第 4 節（雙迴圈），那是整個專案的脊椎。其餘可依 WBS 順序展開。

---

## 1. 專案目標與範圍

### 1.1 一句話定義
一個在瀏覽器中執行的第一人稱 counter-strafe 訓練器，能精準採集鍵盤／滑鼠輸入與遊戲狀態，量測玩家的「急停時機」與「首發命中」，並把資料匯出供研究分析。

### 1.2 必要功能（階段 A 驗收門檻）
| 編號 | 功能 | 驗收條件 |
|---|---|---|
| F1 | 採集鍵盤與滑鼠操作資料 | 每個 A/D／反向鍵的 keydown/keyup、滑鼠位移、開火事件，皆帶高解析度時間戳並可匯出 |
| F2 | 記錄敵人 spawn／可見時間戳 `t_visible` | 每個目標可見的瞬間在 sim tick 內蓋上 `performance.now()` 時間戳 |
| F3 | 第一人稱視角 + CS 風格反向急停 | Pointer Lock 滑鼠視角；A/D 橫移；反向鍵觸發急停（階段 A 為簡化「立即停止」判定） |
| F4 | 多 drill 支援 | drill 以 config（資料）定義，新增 drill 不需改動引擎程式碼 |
| F5 | 移動目標支援 | 目標位置由 sim loop 每 tick 依 `DrillConfig.targets.motion` 策略更新（**不在 render loop**）；新增移動 drill 只改 config、不改引擎；命中與量測對齊當前 tick 的目標位置（見 ADR-6、附錄 G） |

> **F5 階段 A 範圍修正（grill 對帳，2026-06）**：階段 A **只建 F5 的架構接縫**（`SimLoop` 的 target-motion slot、`TargetManager` 的 motion registry、`DrillConfig.targets.motion?` 選填欄、預設 `static` 恆等策略），**不交付移動目標 drill**。移動 drill、追蹤誤差／追蹤穩定度指標、slide-in 的 `t_visible` 判準延後至階段 A+／B——理由：「移動＋急停的能力混淆」是未解的研究設計問題（附錄 F），slide-in 判準也尚未定義。詳見 [`CONTEXT.md`](../CONTEXT.md) D 節「F5 接縫（seam-in, drills-out）」。

### 1.3 階段 B（未來，預留但不在本次交付）
- **CS2 後座力系統**（三層：固定彈道表 + punch 動力學 + inaccuracy 三成分）：以武器 `seed` 決定性生成 64 筆彈道表、每 recoil tick（1/64s）HybridDecay + leapfrog 積分、θ/半徑注入式 seeded RNG 取樣。**數學核心（`src/recoil/`，零 three/DOM 相依）於 WP-10 完成、M5 golden 全綠 2026-07-05**；相機/射線接線見 WP-13（M6）。詳見 [`docs/exec-plan/completed/stage2/README.md`](exec-plan/completed/stage2/README.md) 與 [`CONTEXT.md §F`](../CONTEXT.md)。
- 以 Source friction + acceleration integrator 取代「立即停止」，復刻 CS2 counter-strafe 物理
- 速度 gate 的精準度模型（v≈0 才精準）
- 對照 CS2 `cl_showpos` 軌跡校準
- 移動目標的 sub-tick 命中位置內插（階段 A 用最近 tick 位置；見 ADR-6 與附錄 F）

### 1.4 明確不在範圍內（Out of scope）
美術資產、音效、帳號系統、排行榜、多人連線、anti-cheat、行動裝置最佳化、跨瀏覽器全面 QA（階段 A 鎖定 Chrome/Edge 桌面版）。

---

## 2. 架構決策與理由（ADR 摘要）

> 開發者最該先理解這一節。每個決策都附「為什麼」，避免日後誤改。

### ADR-1：渲染用 Three.js `WebGPURenderer`，自動 fallback 到 WebGL2
- **決策**：`import * as THREE from 'three/webgpu'`，使用 `WebGPURenderer`；在不支援的瀏覽器自動退回 WebGL2。
- **理由**：WebGPU 降低 draw-call 的 CPU 開銷、frame pacing 更穩定（減少 shader 編譯卡頓）、長 session 下熱節流更輕——這些對「量測反應時間」的工具直接有利，因為單次 micro-stutter 就可能污染一筆資料。Three.js 自 r171 起內建 WebGPU + 自動 WebGL2 fallback，遷移成本極低。
- **注意**：WebGPU 需要 `navigator.gpu` 存在；務必實作 fallback 偵測（見附錄 D）。WebGPU 在 2026 已跨瀏覽器成熟，但研究資料收集時應記錄每位受試者實際用的是 WebGPU 還是 WebGL2 後端（兩者延遲特性不同）。

### ADR-2：邏輯與渲染解耦——雙迴圈 + fixed-timestep
- **決策**：物理／量測跑在固定步長 sim loop，渲染跑在 `requestAnimationFrame`，兩者只透過共享狀態溝通。
- **理由**：瀏覽器的 rAF 被 vsync 綁定，畫面更新率無法超過螢幕；但研究儀器需要的是「高頻、可重現、與幀率無關」的模擬與量測。把兩者分開，sim 才能跑在固定 tick、產生 deterministic 的 velocity 軌跡。

### ADR-3：sim tick rate = 128 Hz（階段 A），架構支援提升至 256/384 Hz
- **決策**：階段 A 用 128 Hz（7.8125 ms/tick）。tick rate 設為設定常數，不寫死在邏輯中。
- **理由**：128 Hz 對人類反應時間（150–250 ms）的量測已綽綽有餘。**選 64 的倍數**（128 = 64×2）是為了階段 B 能乾淨地對照 CS2 的 15.625 ms tick 做逐 tick 校準，避免取樣錯位漂移。若階段 B 要更嚴格對齊，可提升到 256（64×4）或 384（64×6）。
- **關鍵觀念**：CS2 的「精準感」來自 sub-tick 的輸入時間戳，不是 tick 頻率本身。所以本專案的精準度真正來源是 F1 的高解析度輸入時間戳，而非把 sim tick 拉得很高。

### ADR-4：時間量測一律用 `performance.now()` + cross-origin isolation
- **決策**：設定 COOP/COEP 標頭啟用 cross-origin isolation，把 `performance.now()` 解析度從 100 µs 提升到 5 µs。所有時間戳取自 `performance.now()`，禁用 `Date.now()`。
- **理由**：這是研究效度的硬性要求。順帶解鎖 `SharedArrayBuffer`，供階段 B 把 sim loop 移入 Web Worker。

### ADR-5：滑鼠用 Pointer Lock + 原始輸入 + coalesced events
- **決策**：`requestPointerLock({ unadjustedMovement: true })` 關閉 OS 滑鼠加速；以 `pointermove` 的 `getCoalescedEvents()` 抓回次幀樣本。
- **理由**：原始輸入確保 sensitivity 一致可重現；coalesced events 確保在 1000 Hz 滑鼠下不遺失中間軌跡樣本。`unadjustedMovement` 僅 Chromium 支援，須捕捉 `NotSupportedError` 並 fallback。

### ADR-6：目標移動策略——位置在 sim loop 每 tick 更新，策略以註冊表集中
- **決策**：目標位置成為隨時間演化的狀態，由 `TargetManager` 在固定步長 sim loop 內每 tick 更新（**絕不在 render loop**）。移動類型（static / linear / pingpong / sine / waypoints）以註冊表集中、寫一次共用，由 `DrillConfig.targets.motion` 啟用（見附錄 G）。
- **理由**：與玩家 movement 同理——render 被 vsync 綁定、幀率因人而異，若把目標移動寫在 render loop，目標速度會隨螢幕更新率變動，量測不可重現。把位置更新放進 sim tick 才能 deterministic。位置更新須排在**命中判定之前**（consume input → player movement → 急停判定 → **target motion** → 命中判定），命中才打在當前 tick 的目標位置。
- **注意**：開火事件帶 sub-tick 時間戳、目標位置在 tick 上更新，兩者存在時間錯位。階段 A 採「最近 tick 位置」並記為已知偏差（附錄 F）；階段 B 對目標位置做時間戳內插以對齊 CS2 sub-tick 精神。`MovementController`／`HitDetector` 介面不變，只在 `TargetManager` 內新增 motion 更新。

### ADR-7：量測時間戳採「兩個時鐘」——量測時鐘（`performance.now()`）與決定性時鐘（邏輯 tick index）
- **決策**：所有跨角色延遲指標（反應時間、停火時序對齊、切換時間）一律在 `performance.now()` wall-clock 域計算。`t_visible` 等 sim 內事件，以「狀態翻轉那個 tick 執行當下的 `performance.now()`」蓋戳，與輸入事件的 `event.timeStamp` 同 time origin、可**直接相減**。另設一條**決定性時鐘** = 邏輯 tick index（`tick0 + n·TICK`），`DataRecorder` 每-tick row 以 tick index 為鍵；決定性測試（WP-2.4 / WP-9.3）只斷言「同一 tick index 的狀態（位置／velocity／命中與否／事件落在第幾 tick）」相等，**不**斷言 wall-clock 時間戳。
- **理由**：反應時間是招牌指標，其兩端（`t_visible` 與 `t_counter`）必須同源可減才無系統性偏差；在 Chromium，`Event.timeStamp` 與 `performance.now()` 同 time origin，故統一用後者。但 wall-clock 時間戳本質非決定性（tick 在 rAF frame 開頭爆發執行），拿它當決定性斷言基準會誤判，故把「可重現」交給邏輯 tick index、把「可量測」交給 wall-clock，各司其職。
- **注意**：(1) `t_visible` 帶 ≤1 render-frame／1 tick 的量化（240Hz≈4ms、tick≈7.8ms），須記為已知誤差界線，與 §15 顯示延遲誤差同數量級。(2) `event.timeStamp` 與 `performance.now()` 同源可減**僅在 Chromium（鎖定的 Chrome/Edge）成立**；若日後支援非 Chromium，此假設須重新驗證。

### ADR-8：peek 推進政策採 P2（命中才推進），而非 P1（首發即推進）
- **決策**：目標可見後**持續存在、未命中不撤**；**第一次命中＝kill → 撤掉並生成下一個**（左右交替「擊殺右→生成左」原樣成立）。每 peek 開槍數可變（0+ 次 miss 後 1 次命中）。`peekTimeoutMs`（config）逾時未 kill → 記 `timeout`、推進，避免卡死；drill 結束＝目標數達標 **或** 總時長到（雙閘）。`spawnDelay`（config）預設 0（即時交替）；`t_next_acquisition` = 準心射線首次命中下一目標 hitbox（parameter-free time-to-target）。
- **理由**：本工具量「完整清目標（含補槍）」的行為。P2 讓 `t_prev_kill` 真的是 kill、左右交替原樣、`切換時間` 前錨乾淨。對照 P1（首發即推進）雖讓 `peek⇄首發` 1:1 更乾淨，但不像遊戲、且把補槍剔除在量測外；本專案選 P2。代價：**每 peek 耗時含 cleanup**，故節奏穩定度須同時可由 `t_visible→t_kill` 與首發間隔兩個錨計算。
- **注意**：首發命中率**靠 `firstShot` 旗標**保證不被掃射稀釋（非靠推進政策）；counter-strafe 的時序/精度指標一律錨在首發。

### ADR-9：內部正規單位採 CS Source unit（u, u/s），非公尺
- **決策**：sim 與**所有記錄／匯出資料**一律用 Source unit。最大跑速 ~250 u/s、`sv_stopspeed` 75、精準度門檻 ~88 u/s、`v_strafe` 預設 ~250 u/s 原樣落地。`DrillConfig` 座標/range/速度、`velocity`、`residualSpeed` 全部 u/s。render 端可另套 **display scale** 做直覺場景尺度，但 sim/資料不得用公尺。附錄 G 的 `motion.speed/range` 單位為 u/s、u（修正先前誤標的 m/s）。
- **理由**：階段 B 對照 CS2 `cl_showpos` 軌跡校準時**零換算**；若用公尺，「1 unit = ? m」的換算因子本身有多種慣例，會在量測鏈埋入人為誤差。
- **注意**：`sv_friction`/`sv_accelerate` 為無單位係數、不受影響；`sv_stopspeed`/速度上限/門檻為 source unit/s，採本決策後直接套用。

---

## 3. 系統元件總覽

| 層 | 元件 | 職責 | 對應功能 |
|---|---|---|---|
| 輸入層 | `InputSampler` | 1000 Hz 採樣鍵鼠事件、蓋時間戳、寫入共享狀態 | F1 |
| 狀態層 | `SharedState` | 輸入緩衝、player velocity、準心、目標狀態、`t_visible` | F1–F4 |
| 模擬層 | `SimLoop` (fixed-timestep) | 推進 movement、急停判定、命中判定、記錄資料 | F2, F3 |
| 模擬層 | `MovementController` | A/D 橫移 + 急停（階段 A 簡化 / 階段 B physics） | F3 |
| 模擬層 | `TargetManager` | 目標 spawn／可見性、左右交替序列、`t_visible`、**每 tick 移動策略更新（motion registry）** | F2, F4, F5 |
| 模擬層 | `HitDetector` | Raycaster 命中判定、首發判定 | F3 |
| 渲染層 | `RenderLoop` (rAF) | 讀 sim 狀態、內插、畫面輸出 | — |
| 渲染層 | `SceneManager` | Three.js 場景、camera、room、準心、HUD | F3 |
| 資料層 | `DataRecorder` | 每 tick 記錄、ring buffer、JSON/CSV 匯出 | F1, F2 |
| 設定層 | `DrillConfig` | 由資料定義 drill（目標數、位置、時序、方向、**目標 motion**） | F4, F5 |
| 指標層 | `MetricsDashboard` | drill 後統計：反應時間、命中率、停止時間、過衝、**追蹤誤差** | — |

---

## 4. 雙迴圈架構（核心）

### 4.1 三條速率不同的迴圈
- **輸入採樣（~1000 Hz）**：事件驅動，不在固定迴圈。每個 `pointermove`／`keydown`／`keyup` 蓋上 `event.timeStamp`（高解析度）寫入共享狀態的輸入緩衝。
- **模擬迴圈（128 Hz 固定步長）**：用 accumulator 模式。從輸入緩衝消費事件 → 推進 movement → 急停判定 → 命中判定 → `DataRecorder` 記錄。
- **渲染迴圈（~螢幕更新率，例如 240 Hz）**：`requestAnimationFrame`，讀取 sim 最新狀態做內插後繪製。

### 4.2 同步機制
- 三者**不互相直接呼叫**，全部透過 `SharedState` 溝通。
- sim 與 render 各自維護 accumulator；render 在兩個 sim tick 之間做**內插**（interpolation），畫面才不抖。
- 階段 B 可把 sim loop 移入 Web Worker + `SharedArrayBuffer`，即使主執行緒渲染卡頓，物理 tick 仍準時——此為量測效度的最高保障，但增加複雜度，故列階段 B。

### 4.3 accumulator 虛擬碼
```
const TICK = 1 / 128;            // 7.8125 ms
let acc = 0, last = performance.now() / 1000;

function frame(now_ms) {
  const now = now_ms / 1000;
  acc += Math.min(now - last, 0.25);   // 夾住避免 spiral of death
  last = now;

  while (acc >= TICK) {
    simStep(TICK);                      // 固定步長：物理 + 量測
    acc -= TICK;
  }

  const alpha = acc / TICK;             // 內插係數 [0,1)
  render(alpha);                        // 渲染用 alpha 內插
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

---

## 5. 量測指標定義（資料層輸出）

> 這些指標是專案存在的理由。每個都必須能從時間戳與座標純機械地算出，不含主觀評分。

| 指標 | 定義 | 量測方式 |
|---|---|---|
| 急停反應時間 | 敵人可見 → 按下反向鍵 | `t_counter − t_visible` |
| 速度歸零誤差 | 開火瞬間殘餘速度 | 開火事件點（排序串流）讀 `velocity` 絕對值 |
| 停火時序對齊 | 速度歸零 → 開火 | `t_fire − t_velocity_zero`（負值=人未停先開槍） |
| 首發命中率 | 每循環第一發是否命中 | (首發命中 / 總 peek) × 100% |
| 準心對齊偏移 | 開火時準心與 hitbox 偏移 | 開火事件點（排序串流）算準心射線與目標中心的距離／角度（sub-tick 忠實、零內插） |
| 切換時間 | 擊殺 → 對下一目標有效對齊 | `t_next_acquisition − t_prev_kill` |
| 節奏穩定度 | 各循環耗時的變異 | 循環時長的標準差 / 變異係數 |
| 左右對稱性 | 左右 peek 的反應與命中差異 | 分別統計左/右，計算差值 |
| 追蹤誤差（tracking error）★F5 | 對移動目標，準心與目標中心的持續偏移 | 每 tick 算準心射線與目標中心的角距離，取平均／RMS（僅移動 drill） |
| 追蹤穩定度 ★F5 | 追蹤誤差隨時間的變異 | 追蹤誤差時間序列的標準差／變異係數（僅移動 drill） |

> **移動目標的 `t_visible` 語意**：靜止目標的「可見」是乾淨的瞬間；移動目標須區分兩種 spawn——**pop-in（原地顯現）**：`t_visible` 仍為乾淨的 spawn tick；**slide-in（滑入視野）**：須定義「進入可命中區」的判準作為 `t_visible`。由 `DrillConfig.targets.motion.spawnKind` 指定；兩者混用會污染反應時間量測效度。
> **追蹤指標只在移動 drill 計算**；靜止 drill 不產生追蹤誤差／追蹤穩定度（欄位留空）。
> **階段 A 可量測性分層（grill 對帳）**：採「立即停止」簡化（M1），§5 指標分三層——**完整可量（時序維度）**：急停反應時間、首發命中率、準心對齊偏移、切換時間、節奏穩定度、左右對稱性；**語意改變但可用**：停火時序對齊（`t_velocity_zero` 塌縮成 `t_counter`，量的是「開火相對**急停輸入**」的時序）；**階段 A 退化成二元（精度維度，待階段 B physics）**：速度歸零誤差（velocity ∈ {0,±v}）、過衝（僅「有無反向」）——結果頁以**分類**呈現、不顯示誤導性 u/s。追蹤誤差／追蹤穩定度因 F5 drills 延後而**不在階段 A**。詳見 CONTEXT「速度歸零誤差」「首發」「節奏穩定度」「準心對齊偏移」。
> **階段 B(1)(2) 部分解除（WP-14，2026-07-06）**：Source friction/accelerate integrator + velocity gate（88 u/s）上線後，上述「二元退化」層解除——**速度歸零誤差**回歸連續 u/s（fire 事件 `residualSpeed`；結果頁 mean/p50/SD + 88 u/s gate 對照）、**過衝**由連續殘速／反向速度呈現，不再只有「有無反向」。**停火時序對齊**維持以 `t_counter` 為 `t_velocity_zero` 代理（連續模型下真 velocity-zero 事件的記錄與回寫，隨 WP-16 schema v2 對帳）。完整可量層與追蹤指標（F5 延後）不變。

---

## 6. 非功能需求

| 類別 | 需求 |
|---|---|
| 效能 | sim loop 穩定 128 Hz 不掉 tick；render 達螢幕更新率；無因 GC 造成的週期性卡頓（用 ring buffer，避免每 tick 配置物件） |
| 計時精度 | `performance.now()` 5 µs（cross-origin isolated）；所有量測時間戳同源 |
| 可重現性 | 同一輸入序列在不同 render FPS 下，sim 結果 deterministic |
| 資料完整性 | 每筆 drill 可完整匯出，包含環境中繼資料（後端類型、更新率、瀏覽器） |
| 瀏覽器 | 階段 A：Chrome/Edge 桌面版（WebGPU）。記錄實際後端 |
| 可維護性 | tick rate、sensitivity、drill 皆為設定，不寫死 |

---

## 7. 工作分解結構（WBS）

> 估時單位 dev-days（1 dev-week = 5 dev-days）。假設一位稱職 web 開發者，初期不熟 3D，含學習爬升。相依欄標示前置任務編號。

### WP-0 環境建置與學習爬升 — 3–5 天
| ID | 任務 | 產出 | 相依 | 估時 |
|---|---|---|---|---|
| 0.1 | 建立 Vite + TS + `three/webgpu` 專案 | 可跑的空場景 | — | 0.5 |
| 0.2 | 設定 COOP/COEP 標頭、驗證 cross-origin isolation 生效 | `crossOriginIsolated === true` | 0.1 | 0.5 |
| 0.3 | 驗證 WebGPU 後端啟用 + WebGL2 fallback 偵測 | console 印出實際後端 | 0.1 | 0.5 |
| 0.4 | 部署 pipeline（含標頭，例如 Vite plugin 或 host 設定） | 線上可開的 URL | 0.2 | 0.5 |
| 0.5 | 研讀 Three.js `PointerLockControls` 範例、Redblock / three-fps repo | 學習筆記 | — | 1–2.5 |

### WP-1 FPS 控制 + Pointer Lock — 2–3 天
| ID | 任務 | 產出 | 相依 | 估時 |
|---|---|---|---|---|
| 1.1 | 場景：room、地板、光源、camera | 可見的封閉房間 | 0.1 | 0.5 |
| 1.2 | Pointer Lock 整合（需使用者手勢、Esc/失焦重取） | 點擊鎖定、Esc 解除 | 1.1 | 0.5 |
| 1.3 | 原始滑鼠輸入（`unadjustedMovement`）+ `NotSupportedError` fallback | 無 OS 加速的視角 | 1.2 | 0.5 |
| 1.4 | 滑鼠視角（yaw/pitch，pitch 夾角） | 可環顧四周 | 1.3 | 0.5 |
| 1.5 | sensitivity / FOV 設定面板 | 可調並即時生效 | 1.4 | 0.5 |

### WP-2 共享狀態 + 雙迴圈骨架 — 3–4 天 ★先於 drill
| ID | 任務 | 產出 | 相依 | 估時 |
|---|---|---|---|---|
| 2.1 | `SharedState` 結構（輸入緩衝、velocity、準心、目標） | 型別定義 + 單例 | 0.1 | 0.5 |
| 2.2 | `SimLoop` accumulator（固定 128 Hz）與 render 解耦 | 雙迴圈可空跑 | 2.1 | 1 |
| 2.3 | render 內插（alpha）讓畫面平滑 | 高 FPS 下不抖 | 2.2, 1.4 | 1 |
| 2.4 | 決定性驗證：同輸入序列、不同 FPS、sim 結果一致 | 通過的測試報告 | 2.2 | 0.5–1 |

### WP-3 輸入採集層（F1） — 2–3 天
| ID | 任務 | 產出 | 相依 | 估時 |
|---|---|---|---|---|
| 3.1 | `InputSampler`：keydown/keyup（A/D/反向鍵）蓋 `event.timeStamp` | 鍵盤事件入緩衝 | 2.1 | 0.5 |
| 3.2 | `pointermove` + `getCoalescedEvents()` 次幀採樣 | 滑鼠軌跡入緩衝 | 2.1 | 1 |
| 3.3 | 開火事件（mousedown）蓋時間戳 | 開火事件入緩衝 | 2.1 | 0.5 |
| 3.4 | sim 從緩衝消費事件（時間排序、無遺漏） | 緩衝正確排空 | 3.1–3.3, 2.2 | 0.5–1 |

### WP-4 目標系統 + `t_visible`（F2）+ 移動目標（F5） — 3–4 天
| ID | 任務 | 產出 | 相依 | 估時 |
|---|---|---|---|---|
| 4.1 | 目標 entity（mesh + hitbox）與顯示/隱藏 | 可生成目標 | 1.1 | 0.5 |
| 4.2 | spawn/可見性邏輯，可見瞬間在 sim tick 蓋 `t_visible` | 時間戳正確 | 4.1, 2.2 | 1 |
| 4.3 | 左右交替序列（擊殺右側 → 生成左側） | 依序交替 | 4.2 | 0.5–1 |
| 4.4 | 準心（crosshair）渲染 | 螢幕中心準心 | 1.1 | 0.25 |
| 4.5 | 目標移動策略（motion registry；sim tick 更新、排在命中判定之前）（F5） | 移動目標可重現移動 | 4.2, 2.2 | 1–1.5 |

### WP-5 命中判定 + 簡化急停（F3） — 2–3 天
| ID | 任務 | 產出 | 相依 | 估時 |
|---|---|---|---|---|
| 5.1 | Raycaster 從 camera 中心開火命中判定 | 命中/未命中 + 部位 | 4.1, 3.3 | 1 |
| 5.2 | 首發判定（每循環只計第一發） | 首發命中旗標 | 5.1, 4.3 | 0.5 |
| 5.3 | A/D 橫移（速度 + 位移，固定步長） | 可左右移動 | 2.2 | 0.5 |
| 5.4 | 簡化急停：反向鍵 = 立即「停止」flag；以停止 gate 開火精準 | 停止判定正確 | 5.3 | 0.5–1 |

### WP-6 Drill 系統（F4 + F5 移動目標 config） — 2–4 天
| ID | 任務 | 產出 | 相依 | 估時 |
|---|---|---|---|---|
| 6.1 | `DrillConfig` schema（目標數、位置、時序、方向交替、結束條件） | 型別 + 範例 JSON | — | 0.5 |
| 6.2 | drill 載入器：由 config 驅動 `TargetManager` | 換 config 即換 drill | 6.1, 4.3 | 1–1.5 |
| 6.3 | 至少 1 個完整 counter-strafe drill 設定檔 | 可玩的 drill | 6.2 | 0.5 |
| 6.4 | drill 生命週期（開始/倒數/結束/重來） | 完整流程 | 6.2 | 0.5–1 |
| 6.5 | `TargetMotion` 納入 schema + 至少 1 個移動目標 drill 範例（F5） | 移動 drill 可玩 | 6.1, 4.5 | 0.5–1 |

### WP-7 資料記錄與匯出（F1/F2） — 3–5 天
| ID | 任務 | 產出 | 相依 | 估時 |
|---|---|---|---|---|
| 7.1 | `DataRecorder` ring buffer：每 tick 記錄 velocity、準心、按鍵、開火 | 無 GC 卡頓的記錄 | 2.2 | 1–1.5 |
| 7.2 | 事件記錄：`t_visible`、命中、首發、急停 | 事件流完整 | 4.2, 5.2, 5.4 | 1 |
| 7.3 | 環境中繼資料（後端、更新率、瀏覽器、sensitivity） | metadata 區塊 | 0.3 | 0.5 |
| 7.4 | JSON / CSV 匯出 | 可下載檔案 | 7.1–7.3 | 0.5–1 |
| 7.5 | 匯出資料的 schema 文件 | schema.md | 7.4 | 0.5 |

### WP-8 指標儀表板與 HUD — 3–4 天
| ID | 任務 | 產出 | 相依 | 估時 |
|---|---|---|---|---|
| 8.1 | drill 後統計計算（第 5 節全部指標） | 指標數值 | 7.2 | 1.5 |
| 8.2 | 結果畫面（反應時間、命中率、停止時間、過衝、左右對稱；移動 drill 加追蹤誤差） | 統計頁 | 8.1 | 1 |
| 8.3 | 即時 HUD（分數、計時、命中率、velocity 指示） | 遊戲中 HUD | 5.1, 5.3 | 1 |
| 8.4 | 重新開始 / 換 drill 控制 | 可循環使用 | 6.4 | 0.5 |

### WP-9 整合、測試與緩衝 — 3–5 天
| ID | 任務 | 產出 | 相依 | 估時 |
|---|---|---|---|---|
| 9.1 | 端到端整合測試（完整 drill → 匯出 → 統計） | 通過清單 | 全部 | 1–2 |
| 9.2 | 計時效度驗證：反應時間分布對照文獻（150–250 ms） | 驗證報告 | 8.1 | 1 |
| 9.3 | 決定性回歸測試 | 自動化測試 | 2.4 | 0.5 |
| 9.4 | 緩衝（未預期問題） | — | — | 1–1.5 |

### 7.x 估時彙整
| 工作包 | 估時（dev-days） |
|---|---|
| WP-0 環境建置與學習 | 3–5 |
| WP-1 FPS 控制 | 2–3 |
| WP-2 雙迴圈骨架 | 3–4 |
| WP-3 輸入採集 | 2–3 |
| WP-4 目標 + t_visible | 2–3 |
| WP-5 命中 + 簡化急停 | 2–3 |
| WP-6 Drill 系統 | 2–4 |
| WP-7 資料記錄匯出 | 3–5 |
| WP-8 指標儀表板 | 3–4 |
| WP-9 整合測試緩衝 | 3–5 |
| **總計** | **約 25–39 dev-days（≈5–8 週）** |

> 註：含 WebGPU 設定與學習爬升，比純 WebGL2 版本略高。若開發者已熟 Three.js，可砍 WP-0 約 2–3 天。
> 註（F5 移動目標）：WP-4.5（motion registry）+ WP-6.5（schema + 移動 drill）+ 追蹤指標約 **+2–3.5 dev-days**，總計上修至 **約 27–42.5 dev-days**。引擎工作量小，真正要先想清楚的是附錄 F 的三個耦合點（特別是「移動 + counter-strafe 能力混淆」——這是研究設計問題，不是工程問題）。

### 7.y 關鍵路徑與里程碑
```
WP-0 → WP-1 → WP-2 →┬→ WP-3 →┐
                     ├→ WP-4 →┼→ WP-5 → WP-6 → WP-7 → WP-8 → WP-9
                     └────────┘
```
- **里程碑 M1（WP-2 完成）**：雙迴圈骨架可空跑且決定性驗證通過 — 這是專案的脊椎，未過不要往下做。
- **里程碑 M2（WP-5 完成）**：能在場景中橫移、急停、開火、命中 — 核心玩法成立。
- **里程碑 M3（WP-7 完成）**：完整 drill 能匯出資料 — 可開始 pilot。
- **里程碑 M4（WP-9 完成）**：階段 A 交付。

---

## 8. 附錄 A：WebGPU + fallback 初始化骨架
```ts
import * as THREE from 'three/webgpu';

async function createRenderer(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
  await renderer.init();                     // WebGPU 需要 async init
  const backend = (navigator as any).gpu ? 'webgpu' : 'webgl2';
  console.info('[render backend]', backend); // 研究：記錄到 metadata
  return { renderer, backend };
}
```
> 若 `navigator.gpu` 不存在，`WebGPURenderer` 會自動走 WebGL2 路徑。務必把 `backend` 寫進匯出資料的 metadata。

## 9. 附錄 B：Pointer Lock + 原始輸入骨架
```ts
canvas.addEventListener('click', async () => {
  try {
    await canvas.requestPointerLock({ unadjustedMovement: true });
  } catch (e) {
    if ((e as DOMException).name === 'NotSupportedError') {
      await canvas.requestPointerLock();     // fallback：OS 調整後的 delta
    } else throw e;
  }
});

canvas.addEventListener('pointermove', (e) => {
  const events = e.getCoalescedEvents?.() ?? [e];
  for (const ev of events) {
    sharedState.input.push({
      type: 'mouse', dx: ev.movementX, dy: ev.movementY, t: ev.timeStamp,
    });
  }
});
```

## 10. 附錄 C：匯出資料 schema（建議）
```jsonc
{
  "meta": {
    "drillId": "counterstrafe_ad_v1",
    "backend": "webgpu",          // 或 webgl2
    "displayHz": 240,
    "simHz": 128,
    "browser": "Chrome/...",
    "sensitivity": 1.8,
    "crossOriginIsolated": true,
    "startedAt": "ISO-8601",
    "unit": "source",             // 正規單位 = CS source unit（u, u/s），非公尺（grill）
    "vStrafe": 250,               // u/s；階段 A 瞬間 snap 橫移速度
    "maxDrillSeconds": 300,       // DataRecorder arena 容量上限 = 此 × simHz
    "lateEventCount": 0,          // 落在已關閉 tick 的遲到事件數（輸入分桶）
    "bufferOverflow": false,      // 輸入 ring buffer 溢位
    "recorderOverflow": false,    // DataRecorder arena 溢位
    "suspect": false              // 任一 overflow → true；分析端可據此剔除該 drill
  },
  "ticks": [                       // 每 sim tick 一筆（ring buffer 匯出）
    { "t": 12345.6, "vx": 0, "vz": 210.4, "crosshair": [cx, cy], "keys": ["D"],
      "targetId": "r1", "targetPos": [tx, ty, tz], "trackingErrorDeg": 1.4 }   // 後三欄僅移動 drill
  ],
  "events": [
    { "type": "visible", "targetId": "r1", "t": 12300.1, "spawnKind": "pop-in" },
    { "type": "counter", "key": "A", "t": 12480.7 },
    { "type": "fire", "t": 12495.2, "hit": true, "firstShot": true,
      "residualSpeed": 3.1, "part": "head", "targetPosAtFire": [tx, ty, tz] }   // targetPosAtFire 僅移動 drill
  ]
}
```

## 11. 附錄 D：階段 B 預留——CS2 physics 常數（校準起點）
| 常數 | 值 | 用途 |
|---|---|---|
| 最大跑速 | ~250 u/s | movement 上限 |
| `sv_friction` | 5.2 | 地面摩擦 |
| `sv_accelerate` | 5.6 | 加速度 |
| `sv_stopspeed` | 75 | 摩擦下限速度 |
| 精準度門檻 | ~max 的 34%（步槍 ~88 u/s） | 速度 gate |

> 階段 B 把 WP-5.4 的「立即停止 flag」換成 friction + acceleration integrator（見前述研究文件公式）。架構上 `MovementController` 介面不變，只替換內部實作。

## 12. 附錄 E：驗收清單（階段 A）
- [ ] `crossOriginIsolated === true`，`performance.now()` 達 5 µs 解析度
- [ ] 渲染後端（WebGPU/WebGL2）正確偵測並寫入 metadata
- [ ] sim loop 穩定 128 Hz，決定性驗證在多種 render FPS 下通過
- [ ] A/D 橫移 + 反向鍵急停，停止狀態正確 gate 開火
- [ ] 目標左右交替生成，`t_visible` 時間戳正確
- [ ] 首發命中判定正確（不被後續掃射稀釋）
- [ ] 1 個完整 counter-strafe drill 可端到端遊玩
- [ ] F5 **接縫**就位：`DrillConfig.targets.motion?` 選填欄存在、`SimLoop` 保留 target-motion slot（預設 `static` 恆等、排在命中判定之前）、無 motion 欄即靜止目標（向後相容）
- [ ] （**階段 A+／延後**）至少 1 個移動目標 drill 可端到端遊玩；目標位置由 sim tick 更新且與 render FPS 無關（決定性驗證涵蓋移動 drill）
- [ ] （**階段 A+／延後**）移動 drill 匯出含每 tick 目標位置，追蹤誤差指標有數值
- [ ] 資料可匯出 JSON/CSV，schema 與文件一致
- [ ] drill 後統計顯示第 5 節全部指標
- [ ] 反應時間分布落在合理範圍（對照 150–250 ms 文獻）

## 附錄 E-B：驗收清單（階段 B，M8 交付門）

> stage2（CS2 後座力系統 + 真急停物理）交付門。~10 項客觀可勾，涵蓋 M5–M7 證據 + schema v2 + 決定性 + NFR 抽查。
> 執行記錄與逐項證據連結見 [`exec-plan/completed/stage2/wp-17-integration/progress.md`](exec-plan/completed/stage2/wp-17-integration/progress.md)（T-exit 2026-07-07）。

- [x] **[M5] recoil 數學核心 golden 全綠**：AK-47（seed 223）前 8 筆彈道表逐位一致、10 發 punch 向量（pitch −10.18°／yaw −1.56°，±0.01°）、前 4 發抑制係數 = 30×Lerp(j/4, 0.75, 1) 精確 — `src/recoil/recoilTable.test.ts` + `spread.test.ts` 綠
- [x] **[M6] 壓槍手感全鏈路分離**：按住連發時視覺 = viewAngles + aimPunch、彈道 = viewAngles + rawPunch×2 + spread 分離生效；held 10 發 rawPunch 漂移方向（上+右）且逼近 M5 向量 — `tests/e2e/full-drill.spec.ts`「recoil 分離」綠 + M6 手動視覺 4 項使用者確認（2026-07-06）
- [x] **[M7 caveated] 校準**：速度曲線於 sim cadence surrogate 對表 ±1 u/s 內；AK pattern 對 CS2 vdata M5 golden 逐位釘死；第三方 Aiming.Pro pattern 逐彈差異（yaw maxAbs 3.941°）分層歸因為來源模型不匹配並經研究者接受（GD-14，外部實錄真值仍列 caveat） — `tests/calibration/showpos.test.ts` 綠 + WP-15 progress
- [x] **schema v2 對帳 + 溢位保護**：匯出 `meta.schemaVersion === 2` 且 fire 事件含 `viewYaw/viewPitch/aimPunchPitch/aimPunchYaw/spreadX/spreadY/recoilIndex/ammo`；統計 = 匯出（`metricsFromExport(payload)` round-trip 逐欄一致）；30 發滿匣 spray `recorderOverflow === false` — `src/data/export.test.ts`/`metadata.test.ts`/`DataRecorder.test.ts` 綠 + spray baseline `recorderOverflow:false`
- [x] **決定性 punch/彈著 × 3 FPS（FR-B16）**：同 `rngSeed` + 同合成輸入序列 → 30 發出彈 punch/spread/彈著（tick-index 鍵）序列 bit-exact，60/144/240 FPS pump 下 `final.ticks === expectedTicks` — `tests/regression/spray-determinism.test.ts` + `determinism.test.ts` 綠
- [x] **COI 三計時防線不退化**：dev server 與 preview server 皆 `crossOriginIsolated === true`（COOP/COEP）；全鏈路與 spray drill E2E 內重申 COI — `tests/e2e/isolation.spec.ts` + `full-drill.spec.ts` + `spray-drill.spec.ts` 綠
- [x] **sim/recoil 無 `Math.random()`**：`src/sim`／`src/recoil` grep `Math.random(` 呼叫數 = 0（僅 `TargetManager.ts` 註解提及禁用，非呼叫） — grep 抽查（2026-07-07）
- [x] **彈孔單一 draw call**：`ImpactView` 以單一 `InstancedMesh(IMPACT_CAP)` render-only 繪彈孔，不入 sim/匯出 — `src/render/ImpactView.ts` + `ImpactView.test.ts` 綠
- [x] **壓 30 發不掉 tick（NFR 抽查）**：30 發 spray 於 60/144/240 FPS pump 下 `final.ticks` 等於 canonical `expectedTicks`（accumulator 全數處理、無 tick 缺口），`impactTotal === 30` — `tests/regression/spray-determinism.test.ts` 綠
- [x] **`npm run test:ci` exit 0**：`tsc --noEmit` + Vitest 43 files／326 tests + Playwright 10 passed，退出碼 0 — 本機 run（2026-07-07）

## 13. 附錄 F：風險登記（重點）
| 風險 | 影響 | 緩解 |
|---|---|---|
| 計時效度被破壞（誤用 render frame / `Date.now()`） | 資料不可信 | 強制 `performance.now()` + COOP/COEP + fixed-timestep；WP-2.4 決定性驗證把關 |
| 幀率相依的 movement | 急停手感與資料隨螢幕變動 | accumulator 固定步長，WP-2 為脊椎里程碑 |
| WebGPU 後端差異 | 不同裝置延遲特性不同 | 記錄後端到 metadata；研究時固定或分層分析 |
| Pointer Lock 跨瀏覽器 | 原始輸入僅 Chromium | 捕捉 `NotSupportedError` fallback；階段 A 鎖 Chrome/Edge |
| 瀏覽器計時本質限制 | 無法測真實「硬體到光子」延遲 | 反應時間以受試者內相對值呈現 + 顯示延遲誤差界線；要絕對精度才評估 Tauri 桌面包裝 |
| GC 造成週期性卡頓 | 污染量測 | ring buffer + 物件重用，避免每 tick 配置 |
| 移動目標命中時間錯位（fire sub-tick vs 目標 tick 位置）★F5 | 高速移動目標的命中資料系統性偏差 | 階段 A 用最近 tick 位置並**明確記錄為已知偏差**；階段 B 對目標位置做時間戳內插（ADR-6） |
| 移動 + counter-strafe 能力混淆 ★F5 | 無法乾淨歸因「急停」vs「追蹤」 | 預設拆成獨立 drill（急停 drill / 追蹤 drill）；複合 drill 須在實驗設計明確標註為進階複合技能（§15） |
| slide-in 的 `t_visible` 判準不明 ★F5 | 反應時間量測失準 | `motion.spawnKind` 明確指定 pop-in / slide-in；slide-in 須定義「進入可命中區」判準（§5 註） |

---

## 14. 附錄 G：移動目標 schema（`DrillConfig.targets.motion`）★F5

> F5 的資料定義。沒有 `motion` 欄即為靜止目標（向後相容）。移動策略以註冊表集中（ADR-6），由 `SimLoop` 每 tick 呼叫、排在命中判定之前。

```ts
interface TargetMotion {
  type: 'static' | 'linear' | 'pingpong' | 'sine' | 'waypoints';
  speed?: number;        // u/s（source unit；見 CONTEXT「正規單位」，非 m/s）
  axis?: 'horizontal' | 'vertical';
  range?: number;        // 擺盪範圍（u，source unit；pingpong / sine 用）
  waypoints?: Vec3[];    // waypoints 用
  spawnKind?: 'pop-in' | 'slide-in';   // 影響 t_visible 語意（見 §5 註）；預設 pop-in
}

// DrillConfig.targets 範例（pingpong 水平移動）：
targets: {
  count: 30,
  sequence: 'alternate_lr',
  motion: { type: 'pingpong', axis: 'horizontal', speed: 150, range: 120, spawnKind: 'pop-in' }  // u/s, u（示意值）
}

// 移動策略註冊表（寫一次、所有 drill 共用）：
const motionStrategies = {
  static:    (t, cfg, age) => t.spawnPos,
  linear:    (t, cfg, age) => addAxis(t.spawnPos, cfg.axis, cfg.speed * age),
  pingpong:  (t, cfg, age) => addAxis(t.spawnPos, cfg.axis, triangleWave(age * cfg.speed, cfg.range)),
  sine:      (t, cfg, age) => addAxis(t.spawnPos, cfg.axis, Math.sin(age * cfg.speed) * cfg.range),
  waypoints: (t, cfg, age) => lerpAlongPath(cfg.waypoints, age, cfg.speed),
};

// SimLoop.simStep(dt) 內，命中判定之前（ADR-6 順序）：
for (const target of targetManager.activeTargets) {
  target.age += dt;                                  // 固定步長累積
  const strategy = motionStrategies[target.motion.type];
  target.position = strategy(target, target.motion, target.age);
}
```

> render loop 維持不變——只讀 `target.position` 做 alpha 內插後繪製（ADR-2 / ADR-6）。新增移動類型 = 在註冊表加一個策略函式（一次性），之後所有 drill 透過 config 啟用、無需再改引擎。

---

## 15. 重要方法論提醒（給研究者，非工程）
即使這套儀器做得再精準，**單純從本地觀察資料只能得到受試者內的相對值**。要證明「某項訓練真的提升 peek 表現」，仍需前後測（pre/post）對照與足夠的適應週期——這點請在 pilot 之前就設計進實驗架構。瀏覽器無法量測真實硬體到光子延遲，所有反應時間都應附上顯示+輸入的誤差界線；高更新率螢幕能縮小這個誤差，但不能消除。
