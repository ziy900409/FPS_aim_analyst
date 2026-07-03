# 執行計畫索引 — FPS 反向急停瞄準訓練器（階段 A）

> 頂層索引。把 [`../PLAN.md`](../PLAN.md) 的 10 個工作包（WP-0 ~ WP-9）展開成**每 WP 一個自足子資料夾**的可執行實作計畫。
> 規格書：[`../規格書_Three.js_WebGPU_反向急停瞄準訓練器.md`](../規格書_Three.js_WebGPU_反向急停瞄準訓練器.md) v1.0 · 專有名詞：[`../../CONTEXT.md`](../../CONTEXT.md)
> 格式參照 `performance_analysis` repo 的 `issue-26` exec-plan（每 task 一個自足檔案，單 task 執行時 context 用量 < 40%）。

| | |
|---|---|
| **Repo** | [ziy900409/FPS_aim_analyst](https://github.com/ziy900409/FPS_aim_analyst) |
| **交付範圍** | 階段 A：F1–F4 + 1 個完整 counter-strafe drill（簡化「立即停止」急停） |
| **技術棧** | Three.js `WebGPURenderer`（`three/webgpu`）+ TypeScript + Vite；UI = 純 TS + DOM overlay；測試 = Vitest + Playwright |
| **估時** | 25–39 dev-days（≈5–8 週，含 WebGPU 設定與學習爬升） |
| **狀態** | 🟡 執行中（WP-0 ~ WP-8 完成 **M3 達成**；WP-9 規劃完成待執行） |

---

## 1. 規劃補充決策（全域，沿用 PLAN §1）

| # | 決策 | 結論 |
|---|---|---|
| D1 | 2D UI 層技術 | **純 TS + DOM overlay** |
| D2 | 測試框架 | **Vitest + Playwright** |
| D3 | COOP/COEP 部署 | **本機 Vite plugin + 靜態主機（後定）** |
| D4 | 文件語言 | **繁體中文（術語保留英文）** |
| D5 | PLAN 顆粒度 | **Agent 可執行的階段步驟（保留人工估時）** |

> **grill 對帳補充（2026-06）**：規格/PLAN 已併入一批規劃討論決策（F5 接縫 in·drills out、ADR-7 兩時鐘、輸入分桶、`DataRecorder` arena、M1 移動模型 + 指標分層、P2 推進、H1 單一 hitbox、source unit、開火 inline 評估）。權威定義見 [`../../CONTEXT.md`](../../CONTEXT.md)、[`../DESIGN.md`](../DESIGN.md)、規格 ADR-7 與 PLAN §1 決策表。**下列 WP 的舊 OQ/假設若與上述衝突，一律以 CONTEXT/規格為準**：WP-4 OQ-4.1（→ H1 單一 hitbox）、WP-6（→ `targets.motion?` 接縫、`spawnDelayMs`=0、`peekTimeoutMs`）、WP-7 OQ-7.1（→ arena 不繞圈 + `recorderOverflow`）、WP-8 過衝/殘速（→ 階段 A 分類呈現）。

---

## 2. 階段資料夾索引（WP-0 ~ WP-9）

> 每個 WP = 一個自足子資料夾，內含 `README.md`（tech spec）、`task-checklist.md`、`progress.md`、`T0-entry-gate` → `Tn` → `T-exit-gate`。
> ⬜ 待建立 · 🟡 進行中 · ✅ 完成

| WP | 子資料夾 | 目標 | 里程碑 | 相依 | 估時 | 狀態 |
|---|---|---|---|---|---|---|
| **WP-0** | [`active/wp-0-environment-setup/`](active/wp-0-environment-setup/README.md) | 空場景 + cross-origin isolation + backend 偵測 | → M1 | — | 3–5 | ✅ 完成（2026-06-30） |
| **WP-1** | [`active/wp-1-fps-pointerlock/`](active/wp-1-fps-pointerlock/README.md) | FPS 控制 + Pointer Lock + 原始輸入 | → M1 | WP-0 | 2–3 | ✅ 完成（2026-06-30） |
| **WP-2** | [`active/wp-2-dual-loop-skeleton/`](active/wp-2-dual-loop-skeleton/README.md) | `SharedState` + 雙迴圈骨架 + 決定性驗證 ★脊椎 | **M1 ✅** | WP-0, WP-1 | 3–4 | ✅ 完成（2026-07-01）|
| **WP-3** | [`active/wp-3-input-sampler/`](active/wp-3-input-sampler/README.md) | `InputSampler`（F1）高解析度時間戳採集 | — | WP-2 | 2–3 | ✅ 完成（2026-07-01） |
| **WP-4** | [`active/wp-4-target-tvisible/`](active/wp-4-target-tvisible/README.md) | `TargetManager` + `t_visible`（F2）左右交替 | — | WP-1, WP-2 | 2–3 | ✅ 完成（2026-07-02） |
| **WP-5** | [`active/wp-5-hit-counterstrafe/`](active/wp-5-hit-counterstrafe/README.md) | `HitDetector` + 橫移 + 簡化急停（F3） | **M2 ✅** | WP-3, WP-4 | 2–3 | ✅ 完成（2026-07-02） |
| **WP-6** | [`active/wp-6-drill-system/`](active/wp-6-drill-system/README.md) | `DrillConfig` 資料驅動 drill（F4） | — | WP-4, WP-5 | 2–4 | ✅ 完成（2026-07-02） |
| **WP-7** | [`active/wp-7-data-recorder/`](active/wp-7-data-recorder/README.md) | `DataRecorder` ring buffer + JSON/CSV 匯出（[`schema`](../operational/schema.md)） | **M3 ✅** | WP-2, WP-4, WP-5 | 3–5 | ✅ 完成（2026-07-03） |
| **WP-8** | [`active/wp-8-metrics-hud/`](active/wp-8-metrics-hud/README.md) | `MetricsDashboard` + 即時 HUD | — | WP-5, WP-6, WP-7 | 3–4 | ✅ 完成（2026-07-03） |
| **WP-9** | [`active/wp-9-integration/`](active/wp-9-integration/README.md) | 端到端整合 + 計時效度 + 決定性回歸 | **M4** | 全部 | 3–5 | 🟡 規劃完成 |

---

## 3. 里程碑門控（gates）

| 里程碑 | 完成條件 | 對應 WP | 意義 |
|---|---|---|---|
| **M1 ✅（2026-07-01）** | 雙迴圈骨架可空跑 + 決定性驗證通過 | WP-2 | 脊椎，量測效度基礎，**已達成 → WP-3 / WP-4 可並行展開** |
| **M2 ✅（2026-07-02）** | 場景中可橫移、急停、開火、命中 | WP-5 | 核心玩法成立，**已達成 → WP-6（drill 編排）/ WP-7（記錄）可展開** |
| **M3 ✅（2026-07-03）** | 完整 drill 能端到端匯出資料 | WP-7 | 資料層（F1/F2）端到端綠燈，**已達成 → 可開始 pilot / WP-8 metrics 可展開**（先讀 GD-4 crosshair 缺口） |
| **M4** | 階段 A 全部驗收清單通過 | WP-9 | 階段 A 交付 |

---

## 4. 跨階段相依圖（關鍵路徑，來自 PLAN §6）

```
WP-0 → WP-1 → WP-2 →┬→ WP-3 →┐
                     ├→ WP-4 →┼→ WP-5 → WP-6 → WP-7 → WP-8 → WP-9
                     └────────┘
```

- WP-2（脊椎，M1）是門控閘：完成且決定性驗證通過前，不展開 WP-3 之後。
- WP-3 / WP-4 在 WP-2 之後可並行。

---

## 5. 執行規則（每 task 一個切片）

- **一個 task = 一個垂直切片 = 一個原子 commit**。先驗證再 commit；當前 task 未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message。
- task 完成時更新該 WP 的 `progress.md`（Progress / Decision Log / Surprises / Open Questions），與切片一起 stage。
- task 完成把該 WP `task-checklist.md` 的 **Done** box 翻 ✅；WP 完成把本索引 §2 的狀態翻 ✅。
- 跨 WP entry-gate 先驗證上游 WP 的 exit-gate 已綠燈。
- PR 步驟以本 repo remote（`ziy900409/FPS_aim_analyst`）為準；CI 不可用時記錄本機紅綠燈證據。

---

## 6. 目錄慣例

```
docs/exec-plan/
├── README.md                       ← 本檔（頂層索引）
├── active/                         ← 進行中的 WP
│   └── wp-0-environment-setup/     ← 本批產出（格式模板）
│       ├── README.md               ← WP tech spec
│       ├── task-checklist.md       ← master task index
│       ├── progress.md             ← running log
│       ├── T0-entry-gate.md
│       ├── T1..Tn.md
│       └── T-exit-gate.md
├── completed/                      ← WP 交付後移入
└── superseded/                     ← 被取代的計畫
```
