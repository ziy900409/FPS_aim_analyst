# 執行計畫 — FPS 反向急停瞄準訓練器（階段 A）

> 對應規格書：[`規格書_Three.js_WebGPU_反向急停瞄準訓練器.md`](./規格書_Three.js_WebGPU_反向急停瞄準訓練器.md) v1.0
> 本文件為「大框架執行計畫」。技術骨幹與架構決策以規格書的 ADR-1~5 為準；本文件補充規格未釘死、但執行必須先定的決策，並把 WBS 轉成 **agent 可執行的階段步驟**（保留原 dev-days 估時供人工參考）。
> 專有名詞定義見 [`../CONTEXT.md`](../CONTEXT.md)。

---

## 0. 一句話目標

在瀏覽器中執行的第一人稱 **counter-strafe** 訓練器，精準採集鍵鼠輸入與遊戲狀態，量測「急停時機」與「首發命中」，並匯出資料供研究分析。階段 A 交付 **4 項必要功能（F1–F4）+ 1 個完整 counter-strafe drill**，並為階段 B（真 CS2 physics）預留架構。

---

## 1. 規劃補充決策（本計畫新增，規格未定）

> 這 5 項是規格書沒講清楚、但 PLAN 必須先定的分支。已逐一確認。

| # | 決策點 | 結論 | 理由 |
|---|---|---|---|
| D1 | **2D UI 層技術**（HUD / 設定面板 / 賽後統計頁） | **純 TS + DOM overlay**（HTML/CSS 蓋在 canvas 上） | 零額外框架，避免 React reconciliation / virtual DOM 在量測期間造成不可預期卡頓，符合「無 GC 週期性卡頓」「可重現」的非功能需求。UI 與 sim 解耦，只在 rAF 讀 `SharedState` 更新文字。 |
| D2 | **測試框架** | **Vitest + Playwright** | Vitest 與 Vite 原生整合、跑 unit（決定性重播、指標計算、輸入緩衝排序）；Playwright 跑 E2E（Pointer Lock、`crossOriginIsolated`、完整 drill → 匯出）並可驗證 Chromium 原生輸入。WP-2.4 決定性驗證用 Vitest 純邏輯重播、不需瀏覽器。 |
| D3 | **COOP/COEP 部署** | **本機 Vite plugin（dev）+ 靜態主機（後定）** | 現階段只需本機開發：`vite.config` 設 dev server 回傳 `COOP: same-origin` / `COEP: require-corp`。上線主機（Netlify / Cloudflare Pages / nginx）以 `_headers` 或 server config 設同樣標頭，列為可插拔選項，不鎖死廠商。 |
| D4 | **文件語言** | **繁體中文（術語保留英文）** | 與規格書一致；元件名與技術術語（`SimLoop`、`counter-strafe`、`t_visible` 等）保留英文原文，開發者讀規格與 PLAN 無需切換語言。 |
| D5 | **PLAN 顆粒度** | **Agent 可執行的階段步驟（保留人工估時）** | 以規格 WBS 為骨架，每個 WP 拆成 agent/人都能獨立拿走的垂直切片，附驗收條件與相依；同時保留原 dev-days 供人類參考。 |

---

## 2. 技術棧（固定）

| 類別 | 選型 | 來源 |
|---|---|---|
| 渲染 | Three.js `WebGPURenderer`（`three/webgpu`），自動 fallback WebGL2 | ADR-1 |
| 語言 | TypeScript | 規格 |
| 建置 | Vite | 規格 |
| 計時 | `performance.now()` + cross-origin isolation（5 µs 解析度），禁用 `Date.now()` | ADR-4 |
| 輸入 | Pointer Lock + `unadjustedMovement` 原始輸入 + `getCoalescedEvents()` | ADR-5 |
| 2D UI | 純 TS + DOM overlay | **D1** |
| 測試 | Vitest（unit）+ Playwright（E2E） | **D2** |
| 部署 | Vite dev plugin（標頭）+ 靜態主機 | **D3** |

---

## 3. 架構總覽

### 3.1 雙迴圈（核心，ADR-2）

三條速率不同、**互不直接呼叫、全透過 `SharedState` 溝通**的迴圈：

| 迴圈 | 速率 | 角色 |
|---|---|---|
| 輸入採樣 | ~1000 Hz（事件驅動） | `InputSampler`：每個 keydown/keyup/pointermove/mousedown 蓋高解析度時間戳寫入輸入緩衝 |
| 模擬迴圈 | 128 Hz 固定步長（accumulator） | `SimLoop`：消費輸入 → movement → 急停判定 → 命中判定 → `DataRecorder` 記錄 |
| 渲染迴圈 | ~螢幕更新率（rAF） | `RenderLoop`：讀 sim 最新狀態做 alpha 內插後繪製 |

> **里程碑 M1（WP-2 完成）是專案的脊椎**：雙迴圈骨架可空跑且決定性驗證通過。未過不要往下做。

### 3.2 元件 → 功能 對照

| 層 | 元件 | 對應功能 |
|---|---|---|
| 輸入 | `InputSampler` | F1 |
| 狀態 | `SharedState` | F1–F4 |
| 模擬 | `SimLoop` / `MovementController` / `TargetManager` / `HitDetector` | F2, F3 |
| 渲染 | `RenderLoop` / `SceneManager` | F3 |
| 資料 | `DataRecorder` | F1, F2 |
| 設定 | `DrillConfig` | F4 |
| 指標 | `MetricsDashboard` | — |

---

## 4. 里程碑

| 里程碑 | 完成條件 | 對應 WP | 意義 |
|---|---|---|---|
| **M1** | 雙迴圈骨架可空跑 + 決定性驗證通過 | WP-2 | 脊椎，量測效度的基礎，門控閘 |
| **M2** | 場景中可橫移、急停、開火、命中 | WP-5 | 核心玩法成立 |
| **M3** | 完整 drill 能端到端匯出資料 | WP-7 | 可開始 pilot |
| **M4** | 階段 A 全部驗收清單通過 | WP-9 | 階段 A 交付 |

---

## 5. 執行階段（WP-0 ~ WP-9）

> 每個 WP 標示：目標、agent 可執行步驟、產出、驗收、相依、估時（dev-days）。相依以 WP/子任務編號表示。

### WP-0 環境建置與學習爬升 — 3–5 天
- **目標**：可跑的空場景 + cross-origin isolation 生效 + 後端偵測。
- **步驟**
  1. `npm create vite` 建 TS 專案，安裝 `three`，以 `three/webgpu` 跑空場景。 *(0.1)*
  2. `vite.config.ts` 設 dev server COOP/COEP 標頭，驗證 `crossOriginIsolated === true`。 *(0.2, ← 0.1)*
  3. `WebGPURenderer.init()` async 初始化，console 印出實際 backend（webgpu/webgl2），驗證 fallback 偵測。 *(0.3, ← 0.1, 附錄 A)*
  4. 部署 pipeline：靜態主機 `_headers` 或 server config 設同樣標頭，產出線上可開 URL。 *(0.4, ← 0.2)*
  5.（學習）研讀 `PointerLockControls`、three-fps repo，輸出學習筆記。 *(0.5)*
- **驗收**：`crossOriginIsolated===true`；console 印出後端；線上 URL 可開。
- **相依**：—

### WP-1 FPS 控制 + Pointer Lock — 2–3 天
- **目標**：可環顧四周的封閉房間，原始滑鼠輸入。
- **步驟**
  1. `SceneManager`：room、地板、光源、camera。 *(1.1, ← 0.1)*
  2. Pointer Lock 整合：使用者手勢觸發、Esc/失焦重取。 *(1.2, ← 1.1)*
  3. 原始輸入 `requestPointerLock({ unadjustedMovement: true })` + `NotSupportedError` fallback。 *(1.3, ← 1.2, 附錄 B)*
  4. yaw/pitch 視角，pitch 夾角。 *(1.4, ← 1.3)*
  5. sensitivity / FOV 設定面板（**DOM overlay**），即時生效。 *(1.5, ← 1.4)*
- **驗收**：點擊鎖定、Esc 解除、無 OS 加速、可調 sensitivity/FOV。
- **相依**：WP-0

### WP-2 共享狀態 + 雙迴圈骨架 — 3–4 天 ★脊椎（M1）
- **目標**：雙迴圈可空跑 + 決定性驗證通過。
- **步驟**
  1. `SharedState` 結構（輸入緩衝、velocity、準心、目標狀態、`t_visible`）：型別 + 單例。 *(2.1, ← 0.1)*
  2. `SimLoop` accumulator 固定 128 Hz，與 render 解耦（附錄 4.3 虛擬碼）。 *(2.2, ← 2.1)*
  3. render alpha 內插，高 FPS 下不抖。 *(2.3, ← 2.2, 1.4)*
  4. **決定性驗證（Vitest）**：同輸入序列、不同 render FPS → sim 結果一致。 *(2.4, ← 2.2)*
- **驗收**：雙迴圈空跑；M1 決定性測試報告通過。
- **相依**：WP-0、WP-1（2.3）

### WP-3 輸入採集層（F1） — 2–3 天
- **目標**：鍵鼠事件帶高解析度時間戳入緩衝，sim 正確消費。
- **步驟**
  1. `InputSampler`：keydown/keyup（A/D/反向鍵）蓋 `event.timeStamp`。 *(3.1, ← 2.1)*
  2. `pointermove` + `getCoalescedEvents()` 次幀採樣入緩衝。 *(3.2, ← 2.1)*
  3. 開火事件（mousedown）蓋時間戳。 *(3.3, ← 2.1)*
  4. sim 從緩衝消費（時間排序、無遺漏，緩衝正確排空）。 *(3.4, ← 3.1–3.3, 2.2)*
- **驗收**：所有 F1 事件帶時間戳入緩衝且被 sim 依時序消費。
- **相依**：WP-2

### WP-4 目標系統 + `t_visible`（F2） — 2–3 天
- **目標**：左右交替目標生成，可見瞬間蓋 `t_visible`。
- **步驟**
  1. 目標 entity（mesh + hitbox）顯示/隱藏。 *(4.1, ← 1.1)*
  2. spawn/可見性邏輯，可見瞬間在 **sim tick 內**蓋 `t_visible`。 *(4.2, ← 4.1, 2.2)*
  3. 左右交替序列（擊殺右 → 生成左）。 *(4.3, ← 4.2)*
  4. crosshair 渲染（螢幕中心準心，DOM 或 canvas）。 *(4.4, ← 1.1)*
- **驗收**：目標依序左右交替；`t_visible` 時間戳正確（sim tick 內）。
- **相依**：WP-1、WP-2

### WP-5 命中判定 + 簡化急停（F3） — 2–3 天 ★M2
- **目標**：能橫移、急停、開火、命中、首發判定。
- **步驟**
  1. `HitDetector`：Raycaster 從 camera 中心命中判定（命中/未命中 + 部位）。 *(5.1, ← 4.1, 3.3)*
  2. 首發判定：每循環只計第一發。 *(5.2, ← 5.1, 4.3)*
  3. `MovementController`：A/D 橫移（速度 + 位移，固定步長）。 *(5.3, ← 2.2)*
  4. 簡化急停：反向鍵 = 立即「停止」flag；以停止 gate 開火精準。 *(5.4, ← 5.3)*
- **驗收**：橫移正確；急停停止狀態正確 gate 開火；首發判定不被掃射稀釋。
- **相依**：WP-3、WP-4
- **階段 B 預留**：`MovementController` 介面不變，僅把 5.4 的「立即停止」換成 friction + acceleration integrator（附錄 D 常數）。

### WP-6 Drill 系統（F4） — 2–4 天
- **目標**：drill 由 config（資料）定義，新增 drill 不改引擎程式碼。
- **步驟**
  1. `DrillConfig` schema（目標數、位置、時序、方向交替、結束條件）：型別 + 範例 JSON。 *(6.1)*
  2. drill 載入器：由 config 驅動 `TargetManager`。 *(6.2, ← 6.1, 4.3)*
  3. 至少 1 個完整 counter-strafe drill 設定檔。 *(6.3, ← 6.2)*
  4. drill 生命週期（開始/倒數/結束/重來）。 *(6.4, ← 6.2)*
- **驗收**：換 config 即換 drill；1 個 counter-strafe drill 可玩；生命週期完整。
- **相依**：WP-4、WP-5

### WP-7 資料記錄與匯出（F1/F2） — 3–5 天 ★M3
- **目標**：完整 drill 可匯出 JSON/CSV，schema 與文件一致，無 GC 卡頓。
- **步驟**
  1. `DataRecorder` **ring buffer**：每 tick 記錄 velocity、準心、按鍵、開火（物件重用，避免每 tick 配置）。 *(7.1, ← 2.2)*
  2. 事件記錄：`t_visible`、命中、首發、急停。 *(7.2, ← 4.2, 5.2, 5.4)*
  3. 環境中繼資料（backend、displayHz、simHz、browser、sensitivity、`crossOriginIsolated`）。 *(7.3, ← 0.3)*
  4. JSON / CSV 匯出（可下載檔案）。 *(7.4, ← 7.1–7.3, 附錄 C schema)*
  5. 匯出 schema 文件 `schema.md`。 *(7.5, ← 7.4)*
- **驗收**：完整 drill 可匯出；schema 與文件一致；無週期性卡頓。
- **相依**：WP-2、WP-4、WP-5

### WP-8 指標儀表板與 HUD — 3–4 天
- **目標**：賽後統計（第 5 節全部指標）+ 即時 HUD。
- **步驟**
  1. `MetricsDashboard`：drill 後計算全部 8 項指標（純機械、無主觀評分）。 *(8.1, ← 7.2)*
  2. 結果畫面（DOM）：反應時間、命中率、停止時間、過衝、左右對稱。 *(8.2, ← 8.1)*
  3. 即時 HUD（DOM）：分數、計時、命中率、velocity 指示。 *(8.3, ← 5.1, 5.3)*
  4. 重新開始 / 換 drill 控制。 *(8.4, ← 6.4)*
- **驗收**：賽後統計顯示第 5 節全部指標；HUD 即時更新；可循環使用。
- **相依**：WP-5、WP-6、WP-7

### WP-9 整合、測試與緩衝 — 3–5 天 ★M4
- **目標**：階段 A 交付，全部驗收清單通過。
- **步驟**
  1. 端到端整合測試（Playwright）：完整 drill → 匯出 → 統計。 *(9.1, ← 全部)*
  2. 計時效度驗證：反應時間分布對照文獻 150–250 ms。 *(9.2, ← 8.1)*
  3. 決定性回歸測試（Vitest，自動化）。 *(9.3, ← 2.4)*
  4. 緩衝（未預期問題）。 *(9.4)*
- **驗收**：附錄 E 驗收清單全數通過。
- **相依**：全部

---

## 6. 關鍵路徑與估時

```
WP-0 → WP-1 → WP-2 →┬→ WP-3 →┐
                     ├→ WP-4 →┼→ WP-5 → WP-6 → WP-7 → WP-8 → WP-9
                     └────────┘
```

| 工作包 | dev-days |
|---|---|
| WP-0 ~ WP-9 | 25–39（≈5–8 週，含 WebGPU 設定與學習爬升） |

> 若開發者已熟 Three.js，可砍 WP-0 約 2–3 天。WP-3 / WP-4 在 WP-2 之後可並行。

---

## 7. 測試策略（對應 D2）

| 層級 | 工具 | 涵蓋 |
|---|---|---|
| 決定性 | Vitest（純邏輯重播） | WP-2.4、WP-9.3：同輸入序列、不同 FPS → 結果一致 |
| 指標計算 | Vitest | 第 5 節 8 項指標的數值正確性、輸入緩衝時序排序 |
| 計時效度 | Vitest + 分析腳本 | WP-9.2：反應時間分布對照 150–250 ms |
| E2E | Playwright（Chromium） | Pointer Lock、`crossOriginIsolated`、完整 drill → 匯出、原生輸入 |

---

## 8. 風險與緩解（重點，詳見規格附錄 F）

| 風險 | 緩解 |
|---|---|
| 計時效度被破壞（誤用 render frame / `Date.now()`） | 強制 `performance.now()` + COOP/COEP + fixed-timestep；WP-2.4 把關 |
| 幀率相依的 movement | accumulator 固定步長；WP-2 為脊椎里程碑 |
| WebGPU 後端差異 | 後端寫入 metadata；研究時固定或分層分析 |
| Pointer Lock 跨瀏覽器 | 捕捉 `NotSupportedError` fallback；階段 A 鎖 Chrome/Edge |
| GC 週期性卡頓 | ring buffer + 物件重用，避免每 tick 配置 |
| 瀏覽器計時本質限制 | 反應時間以受試者內相對值呈現 + 顯示延遲誤差界線 |

---

## 9. 明確不在範圍（階段 A）

美術資產、音效、帳號系統、排行榜、多人連線、anti-cheat、行動裝置最佳化、跨瀏覽器全面 QA（鎖定 Chrome/Edge 桌面版）、真 CS2 physics（階段 B）。

---

## 10. 階段 B 預留（不在本次交付）

- 以 Source friction + acceleration integrator 取代「立即停止」，復刻 CS2 counter-strafe 物理（附錄 D 常數）。
- 速度 gate 精準度模型（v≈0 才精準）。
- sim loop 移入 Web Worker + `SharedArrayBuffer`（cross-origin isolation 已預先解鎖）。
- 對照 CS2 `cl_showpos` 軌跡校準；sim tick 可提升至 256/384 Hz。
