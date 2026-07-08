# WP-20 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: 🟡 T1 complete;T2 next

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ |
| T1 解析度模式 | ✅ |
| T2 fullscreen + 資格閘 | ⬜ |
| T3 frame-time log | ⬜ |
| T4 session setup 表單 | ⬜ |
| T-exit | ⬜ |

---

## Open Questions ledger(T0 解決)

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S3-1 效能地板門檻(warmup p95 ≤ ?ms;drill 中 suspect 門檻)起點值 | ✅ resolved | `PERF_FLOOR_MS = 8.33ms`。資格閘 warmup p95 `<= 8.33ms` 才可進實驗 session;drill 中 frame p95 `> 8.33ms` 標 `suspect`。此為 120Hz 等效起點, pilot 後另以獨立 task/commit 校準。 |
| OQ-S3-4 frames 匯出形式(JSON 完整序列 + 摘要;CSV 只摘要)確認 | ✅ resolved | JSON 匯出 `frames.series` 完整 delta 序列 + `summary`(`p50/p95/p99/overBudgetWindows/overflow`);CSV 只輸出 summary 欄位,不展開逐幀序列。 |
| OQ-20.1 `MAX_DISPLAY_HZ` 容量常數(計畫預設 240)與更新率估計演算法(rAF deltas 中位數) | ✅ resolved | `MAX_DISPLAY_HZ = 240`;frame log 容量 = `maxDrillSeconds * MAX_DISPLAY_HZ`(現行 300s → 72,000 samples)。更新率估計:丟棄前 30 個 rAF deltas,採接續 120 個 deltas 的 median,`refreshEstimateHz = round(1000 / medianDeltaMs)`,同時保留 median delta 供 meta/debug。 |
| OQ-20.2 meta.display 落點:WP-16 已留 optional 區塊縫?(未留 → 與 WP-16 對帳,比照 OQ-19.2) | ✅ resolved | WP-16 已留 v2 optional reserved 縫: `meta.display`, `meta.frames`, `meta.session` 見 `src/data/metadata.ts` 與 `docs/operational/schema.md`。形狀歸 WP-16/schema,填值歸 WP-20;本 WP 不 bump schema。 |

---

## Log

### 2026-07-08 — T1 解析度模式 PASS(顯式 buffer + CSS upscale + display meta)
- **實作檔案**:
  - 新增 `src/display/resolutionMode.ts`: `ResolutionMode`/`DisplayState`/`applyResolutionMode()`;固定模式走 `setPixelRatio(1)` + `setSize(1920×1080|2560×1440,false)` + canvas CSS `100%`;`native` 保留 `Math.min(dpr,2)` 路徑。
  - 修改 `src/main.ts`:所有 window resize 與 scene reload 走同一個 active resolution mode path;SettingsPanel 切換即重套 buffer 並更新 camera aspect;匯出 `meta.display` 由目前 `DisplayState` + rAF refresh estimate 填值。
  - 修改 `src/ui/SettingsPanel.ts`:新增 Resolution select 與 `lockMode(locked)` 介面,供 WP-22 protocol 鎖定解析度條件。
  - 修改 `src/data/metadata.ts`: `display?: DisplayState` 驗證;新增 `measureDisplayRefresh()`(丟前 30 deltas,取後 120 median,`round(1000/median)`),`measureDisplayHz()` 保留相容 wrapper。
- **Playwright/Edge 實機量測(1280×720 viewport,dpr=1,headless Edge,dev server 5173)**:
  - `native`:canvas buffer `1280×720`,CSS box `1280×720`,style `1280px×720px`,crosshair center `640,360` = viewport center。
  - `fhd-1080`:canvas buffer `1920×1080`,CSS box `1280×720`,style `100%×100%`,crosshair center `640,360` = viewport center。
  - `qhd-1440`:canvas buffer `2560×1440`,CSS box `1280×720`,style `100%×100%`,crosshair center `640,360` = viewport center。
- **斷言證據**:
  - `npx.cmd vitest run src/display/resolutionMode.test.ts src/ui/SettingsPanel.test.ts src/data/metadata.test.ts src/view/CameraController.test.ts tests/regression/determinism.test.ts` exit 0 — 5 files / 36 tests passed(buffer/CSS/DisplayState、mode lock、meta.display、0.022°/count sensitivity、完整 sim determinism)。
  - `npm.cmd run typecheck` exit 0。
  - `npm.cmd test` exit 0 — 50 test files / 363 tests passed。
  - `npm.cmd run build` sandbox 首跑被 Vite config 上層讀取權限擋下;經使用者核准非 sandbox 重跑 exit 0 — 61 modules transformed,production build succeeded(僅既有 chunk size warning)。
- **範圍檢查**:未修改 `SIM_HZ`、sim/input 鏈、movement/recoil constants;resolution mode 僅 render/UI/data 層。
- **清理**:T1 browser 驗證用 dev server PID 57716 已停止;`Get-NetTCPConnection -LocalPort 5173` 無 listener。

### 2026-07-08 — T0 entry gate PASS(GD-10 收斂 + 顯示基線)
- **測試基準**:`npm.cmd test` exit 0 — 48 test files / 356 tests passed(Vitest v2.1.9, duration 2.54s)。
- **resize/pixelRatio 現況證據**:
  - `src/main.ts:89`:現行 renderer 啟動後 `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))`。
  - `src/main.ts:91-98`:現行 `resize()` 取 `window.innerWidth/innerHeight`,呼叫 `renderer.setSize(w, h)` 後 `sceneManager.resize(w, h)`;resize listener 掛 `window`。
  - `src/render/SceneManager.ts:68-72`: `SceneManager.resize(w, h)` 只更新 camera aspect + projection matrix;renderer buffer size 由 `main.ts` 持有。
  - `src/main.ts:462`:場景切換後新 `SceneManager` 也只用 `window.innerWidth/innerHeight` 重設 aspect。
- **OQ 決議**:OQ-S3-1 / OQ-S3-4 / OQ-20.1 / OQ-20.2 全部 resolved(見上方 ledger);stage3 README §8 已回填 S3 open questions。
- **WP-16 對帳**:`docs/operational/schema.md:78-82` 已列 `spawn/scene/display/frames/session` 為 v2 optional/reserved;`src/data/metadata.ts:48-51` 已有 `scene?/display?/frames?/session?` meta 縫。結論:`meta.display` 無需 WP-16 補開欄位,WP-20 T1/T4 只負責填值。
- **本機 frame-time 粗測(native 等效,Edge 1280x720,dpr=1,COI=true,180 rAF deltas/sample)**:
  - idle/no-input:p50 16.66ms,p95 16.83ms,p99 16.88ms,max 16.90ms。
  - drill-running + A/D key input:p50 16.67ms,p95 16.84ms,p99 16.89ms,max 16.95ms。
  - 解讀:本機/headless Edge rAF 為 60Hz cadence,因此會超過 8.33ms 120Hz 效能地板;drill 輸入壓力相對 idle 的 p95 增量約 0.01ms,未見明顯額外負載。此量測只作 T0 sanity check,正式資格閘仍採 OQ-S3-1 門檻。
- **清理**:`Get-NetTCPConnection -LocalPort 5173` 回報 no listener;T0 frame 測試用 dev server 已關閉。
- **硬約束回寫**:`CLAUDE.md` §4 已追加「解析度/場景切換僅 render/UI/data 層;不得改變 sim 狀態演進/輸入鏈/SIM_HZ」。
- **Entry gate**:PASS。`git diff --stat` 應不含 `src/`;下一步可開 T1 解析度模式。

### 2026-07-07 — FPSci R2/R3 對齊決策(使用者拍板,grill)
- **R3 採納(縮限版)**:T4 加 session 識別欄 `participantId`(必填)/`sessionLabel`(選填),
  進 meta `session` 區塊(v2 reserved,形狀歸 WP-16 T1)——原 T4 out-of-scope 的
  「受試者 ID 待 WP-22 T2 對帳」懸案在此解決;experiment 層 = 分析端概念、引擎不實作,
  三層術語入 CONTEXT §A。FPSci 的 userstatus/config `#include`/受試者管理後端不採納。
- **R2 不採納**:click-to-photon 硬體校準不做(latency probe 頁/protocol 皆不入計畫);
  接受瀏覽器 compositor 盲區為先天限制,審稿以誤差界線(規格 §15)+ 受試者內對比(GD-10)
  + frame-time log(T3)回應。
- 出處:[FPSci 評估](../../../../research/FPSci_評估與建議.md) R2/R3;授權紅線 GD-11。

### 2026-07-06 — Plan authored
- 由 stage3 計畫([../README.md](../README.md) §3/§6)展開為自足 task 檔(T0–T4 + T-exit)。
- 決議依據:GD-10(全遠端 + 三道 blocking 防線;實驗構念 =「同一面板上的 render 解析度效應」)、
  GD-8(frame log = 跨解析度顯示鏈延遲差的效度防線)。
- 設計要點:`setPixelRatio(1)` + 顯式 buffer 繞開 DPI 隱式縮放;資格閘不合格 = **拒入**
  實驗 session(非僅記錄);自陳欄僅 moderator。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— GD-10 收斂 + 效能地板起點,docs-only。
