# WP-20 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: ✅ WP-20 交付(四件套齊備;T-exit 收斂 2026-07-08)

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ |
| T1 解析度模式 | ✅ |
| T2 fullscreen + 資格閘 | ✅ |
| T3 frame-time log | ✅ |
| T4 session setup 表單 | ✅ |
| T-exit | ✅ |

---

## Open Questions ledger(T0 解決)

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S3-1 效能地板門檻(warmup p95 ≤ ?ms;drill 中 suspect 門檻)起點值 | ✅ resolved | `PERF_FLOOR_MS = 8.33ms`。資格閘 warmup p95 `<= 8.33ms` 才可進實驗 session;drill 中 frame p95 `> 8.33ms` 標 `suspect`。此為 120Hz 等效起點, pilot 後另以獨立 task/commit 校準。 |
| OQ-S3-4 frames 匯出形式(JSON 完整序列 + 摘要;CSV 只摘要)確認 | ✅ resolved | JSON 匯出 `frames.series` 完整 delta 序列 + `summary`(`p50/p95/p99/overBudgetWindows/overflow`);CSV 只輸出 summary 欄位,不展開逐幀序列。 |
| OQ-20.1 `MAX_DISPLAY_HZ` 容量常數(計畫預設 240)與更新率估計演算法(rAF deltas 中位數) | ✅ resolved | `MAX_DISPLAY_HZ = 240`;frame log 容量 = `maxDrillSeconds * MAX_DISPLAY_HZ`(現行 300s → 72,000 samples)。更新率估計:丟棄前 30 個 rAF deltas,採接續 120 個 deltas 的 median,`refreshEstimateHz = round(1000 / medianDeltaMs)`,同時保留 median delta 供 meta/debug。 |
| OQ-20.2 meta.display 落點:WP-16 已留 optional 區塊縫?(未留 → 與 WP-16 對帳,比照 OQ-19.2) | ✅ resolved | WP-16 已留 v2 optional reserved 縫: `meta.display`, `meta.frames`, `meta.session` 見 `src/data/metadata.ts` 與 `docs/operational/schema.md`。形狀歸 WP-16/schema,填值歸 WP-20;本 WP 不 bump schema。 |
| OQ-20.3 物理硬體 DPI 端到端驗證(Windows 100%/125%/150% 真實面板 + 真 fullscreen gesture) | ⬜ open(moderator 實機) | T2 已以單元矩陣釘死 `screen × dpr` 還原機制(三檔 + FHD 反例);headless 環境無法忠實重現多 DPI 實機 + fullscreen user gesture。最終端到端確認留 moderator 於實驗機執行,結果矩陣回填本 ledger(比照 T1 real-browser 分工)。不阻塞 T3(資格閘邏輯已可機械判定)。 |

---

## Log

### 2026-07-08 — T-exit 顯示管線四件套交付 PASS(WP-22 T2 可消費)

- **驗證**:`npm run test:ci` exit 0 —— `tsc --noEmit` 綠;vitest **55 test files / 412 tests passed**;playwright **10/10 passed**(Edge,含 COOP/COEP isolation、input-sampler、full-drill、spray-drill 全鏈)。build 僅既有 chunk-size warning。
- **四件套交付證據(可追)**:
  - **① 解析度模式**:`src/display/resolutionMode.test.ts` 3 tests(native `Math.min(dpr,2)` 保留、`fhd-1080` 顯式 1920×1080 buffer + CSS upscale、`qhd-1440` 2560×1440 buffer 與 viewport 無關);T1 Playwright(1280×720 viewport)三模式 buffer/CSS/準心量測記 [T1 log](#2026-07-08--t1-解析度模式-pass顯式-buffer--css-upscale--display-meta)。
  - **② 資格閘**:`src/display/eligibilityGate.test.ts` 14 tests(三檢查各自可獨立紅/綠、`<=` 地板邊界、DPI 矩陣 100%/125%/150% → native 還原 2560×1440 PASS、真 FHD FAIL);`src/ui/EligibilityGate.test.ts` 4 + `src/display/experimentSession.test.ts` 7(拒入/放行/suspect)。
  - **③ frames 匯出**:`src/display/frameLog.test.ts`(容量/溢位/凍結/摘要/refresh estimate)+ `export.test.ts`(JSON series + CSV summary-only);T3 Edge live export 三模式 `frames.summary` 分佈記 [T3 log](#2026-07-08--t3-frame-time-log--frames-匯出-passgd-10-防線)。
  - **④ session setup**:`src/ui/SessionSetup.test.ts` + `metadata.test.ts`(self-report trim/range/uncertain、`nativeMismatch`、`participantId` 必填、`meta.session`)。
- **斷言複查(GD-10/CONTEXT §A 不變式)**:
  - **準心置中**:準心為 DOM overlay(`src/ui/Crosshair.ts`,CSS `left/top:50%`),不受 render buffer 影響 → 無單元測試;T1 Playwright 三模式(native/fhd-1080/qhd-1440)實測 crosshair center = viewport center `640,360`(見 T1 log)。
  - **感度無像素項**:`src/view/CameraController.test.ts` → 「uses the CS2 0.022 degrees/count sensitivity model for yaw」+「scales the CS2 sensitivity model linearly」;感度 = 角度制 `0.022°/count`(`meta.sensitivityModel = 'cs2-0.022deg'`),無解析度/像素項 → 跨模式不變。
  - **sim 跨模式不變性**:`applyResolutionMode` 只回 `DisplayState`(buffer/CSS),不碰 sim(resolutionMode.test.ts 佐證);sim 狀態序列不變性由 `tests/regression/determinism.test.ts` 16 tests(render-FPS 無關,逐 tick bit-exact)+ WP-19 T4 跨場景 bit-exact 守護。**完整跨解析度逐位 determinism = WP-22 T3 收斂**(README §2.3),本 WP 交付單元級斷言(解析度為 render-only)。
- **T2↔T3 對帳收斂(本 task 唯一程式碼異動)**:`src/display/eligibilityGate.ts` 的 `probeWarmupP95Ms` 原自帶 nearest-rank `percentile()`(與 `frameLog.ts` 的 `nearestRank()` 重複);T-exit 改為把丟棄冷啟動幀後的 timestamps 餵入一個 throwaway `frameLog`,p95 由 `frameLog.summary()` 計算並刪除重複 percentile —— **frame-time 百分位自此單一來源(frameLog,T3 consolidated)**。行為保持不變:`eligibilityGate.test.ts` 兩個 probe 測試(p95=8 / p95=30)續綠。**T3 側對帳**:frameLog 現同時是 drill-time 記錄(RenderLoop sink)與 gate-time warmup 百分位的權威來源;兩者共用 `PERF_FLOOR_MS` 與 nearest-rank 語意。
- **範圍檢查**:未修改 `SIM_HZ`、sim/input/HitDetector/physics;唯一 src 異動 `eligibilityGate.ts` 屬 display 層,只換百分位來源、不改三檢查邏輯與門檻。architecture guard 綠。
- **OQ ledger**:OQ-S3-1 / OQ-S3-4 / OQ-20.1 / OQ-20.2 於 T0 已 resolved 並回填 stage3 README §8;**OQ-20.3**(物理硬體 DPI 端到端 + 真 fullscreen gesture)維持 open,owner = moderator 實驗機(headless 無法忠實重現),非阻塞 WP-22。
- **Outcomes / 帶著走的決定**:
  - **交付了什麼**:WP-22 T2 受試者內解析度 protocol 的完整顯示面 —— gate(拒入)→ 三解析度條件切換 → 匯出含 `meta.display`(自動 buffer/CSS/dpr/fullscreen/refresh + gate 全量明細 + 自陳欄)/`meta.frames`(series+summary)/`meta.session`(join key)全鏈就緒。
  - **Surprises**:T-exit 原規劃 docs-only,但 step 4「warmup 改用 frameLog 來源」實為一筆小程式碼收斂(消重複 percentile);判斷屬 T2↔T3 收斂本體(非另立 feature),故隨 exit-gate 一併落地並在此明記。
  - **帶著走**:效能地板真實硬體 PASS/FAIL(120/240Hz 面板 + 真 fullscreen)仍待 moderator 實機(OQ-20.3);headless 為 60Hz cadence,三模式必標 suspect,只證匯出鏈路與 buffer/frames 形狀,不作效能證據。

### 2026-07-08 — T4 session setup 表單 + self-report/session meta PASS(GD-10 防線③ 手動半邊)
- **實作檔案**:
  - 新增 `src/ui/SessionSetup.ts`:`createSessionSetupForm()` 純 TS DOM overlay;`participantId` 必填,`sessionLabel` 選填;顯示硬體自陳欄(`monitorModel/nativeW/nativeH/panelInches/viewingDistanceCm`)全選填;`selfReportUncertain` 勾選可只記「不確定」。數字欄做最小 sanity range;表單顯示自動 `screen × dpr` 原生解析度供核對。
  - 修改 `src/display/resolutionMode.ts`:新增 `DisplaySelfReport` optional 欄位,併入 `DisplayState`。
  - 修改 `src/main.ts`:實驗 session 入口改為 setup → eligibility gate;setup submit 後才開 T2 gate,gate 通過後才讓 setup 值正式進 export metadata。匯出時把 self-report 欄位寫入 `meta.display`,自陳 nativeW/H 與自動 screenW/H 不一致時寫 `nativeMismatch`;`participantId/sessionLabel` 寫 `meta.session`。
  - 修改 `src/data/metadata.ts`:驗證/trim `meta.display` 手動欄;`meta.session.participantId` 必填且 trim,`sessionLabel` 選填。
  - 修改 `docs/operational/schema.md`:補 `meta.display` self-reported moderator-only 語意與 `meta.session` join key schema。
- **斷言證據**:
  - `npx.cmd vitest run src/ui/SessionSetup.test.ts src/data/metadata.test.ts src/data/export.test.ts` exit 0 — 3 files / 31 tests passed(form submit/必填/範圍/uncertain、nativeMismatch、metadata/session/export JSON)。
  - `npm.cmd run typecheck` exit 0。
  - `npm.cmd test` exit 0 — **55 test files / 412 tests passed**(T3 為 54/403;+1 檔 +9 tests)。
  - `npm.cmd run build` sandbox 首跑被 Vite config 上層讀取權限擋下;經使用者核准非 sandbox 重跑 exit 0 — 67 modules transformed,production build succeeded(僅既有 chunk size warning)。
  - **Live flow smoke(Edge/Chromium headless,1280×720 viewport,dev server 5175)**:點 `實驗 session` button(index 4)→ `#session-setup` visible → 填 `participantId=P001/sessionLabel=pre/monitorModel/nativeW/nativeH/panelInches/viewingDistanceCm` → submit → `#session-setup` display `none`, `#eligibility-gate` display `flex`。5175 dev server PID 56960 已停止;`netstat` 僅餘 TIME_WAIT,無 LISTENING。
  - `graphify update .` exit 0 — AST extraction 125/125 files;graph rebuilt to 924 nodes / 2026 edges / 60 communities。
- **範圍檢查**:未修改 `SIM_HZ`、sim/input/HitDetector/physics constants;T4 只碰 UI/data/main/display metadata 與 docs。一般練習/export 不強制 session setup;只有點「實驗 session」才出現 setup→gate 流程。
- **決策**:setup 放在 gate 前,因 fullscreen 仍需 T2 gate 按鈕保留 user gesture;表單 submit 只收 pending metadata、不請求 fullscreen,gate pass 後才正式進匯出。`nativeMismatch` 只在 nativeW/H 兩者皆填時寫 boolean,不作阻擋;自動 `screen × dpr` 仍是資格閘唯一依據。文字欄 trim 後進 meta,空字串不落欄。
- **Surprises / 有意識妥協**:Headless smoke 的中文 role selector 在 PowerShell→Node stdin 內被轉碼成 `??`,因此改以 button index + DOM id 驗證流程;這只影響測試 selector,不影響 app 文案。T4 未做 localStorage 記憶,符合 task out-of-scope;若 pilot 多 session 重填成本高,另開便利性 task。

### 2026-07-08 — T3 frame-time log + frames 匯出 PASS(GD-10 防線③)
- **實作檔案**:
  - 新增 `src/display/frameLog.ts`:`createFrameLog(capacity)` 使用 `Float64Array` 記 rAF delta 序列;容量 `maxDrillSeconds × MAX_DISPLAY_HZ(240)`(現行 72,000 samples);滿即停記 + `overflow`,不繞圈。`summary()` 輸出 `count/p50/p95/p99/overBudgetWindows/overflow`;`refreshEstimate()` 由 median delta 算 `round(1000 / median)`。
  - 修改 `src/display/constants.ts`:新增 `MAX_DISPLAY_HZ = 240`。
  - 修改 `src/loop/RenderLoop.ts`:新增 optional `frameLog` sink,每幀以 primitive rAF timestamp 呼叫 `push(nowMs)`;排程職責仍不知 sim。
  - 修改 `src/main.ts`:建立 `frameLogCapacity(DEFAULT_MAX_DRILL_SECONDS)`;drill start/restart/reset 時重置,phase 首次 `ended` 時 freeze;匯出時寫 `meta.frames`;`meta.display.refreshEstimateHz/refreshMedianDeltaMs` 優先取 frameLog median(無 samples 的 pre-run export 才 fallback rAF probe);`suspect` OR `frames.summary.p95 > PERF_FLOOR_MS`。
  - 修改 `src/data/metadata.ts`: `frames?: FrameLogExport` validator;`summary.count` 必須等於 `series.length`;`p95 > PERF_FLOOR_MS` 自動標 `suspect`。
  - 修改 `src/data/export.ts`:JSON 保留 `meta.frames.series + summary`;CSV 只新增 `<basename>-frames.csv` summary 欄位,不展開逐幀序列。
  - 修改 `docs/operational/schema.md`:補 `meta.frames` 與 optional frames CSV schema。
- **斷言證據**:
  - `npx.cmd vitest run src/display/frameLog.test.ts src/loop/RenderLoop.test.ts src/data/metadata.test.ts src/data/export.test.ts` exit 0 — 4 files / 35 tests passed(容量/溢位/凍結/摘要/refresh estimate、RenderLoop sink、metadata suspect 邊界、JSON series + CSV summary)。
  - `npm.cmd run typecheck` exit 0。
  - `npm.cmd test` exit 0 — **54 test files / 403 tests passed**(T2 為 53/390;+1 檔 +13 tests)。
  - `npm.cmd run build` sandbox 首跑被 Vite config 上層讀取權限擋下;經使用者核准非 sandbox 重跑 exit 0 — 66 modules transformed,production build succeeded(僅既有 chunk size warning)。
- **Edge headless live export smoke(1280×720 viewport,dpr=1,dev server 5174)**:
  - 流程:每模式切換 resolution select → `Restart` → 等 4.3s(跨 countdown 進 running sample)→ 點 `JSON` 下載 → 讀 `meta.frames.summary`。此為 live app 匯出鏈路樣本,非完整人工 20-target completion run。
  - `native`:buffer `1280×720`,CSS `1280×720`,refresh `60Hz`,median `16.67ms`,frames `count=260,p50=16.67,p95=16.80,p99=16.90,overBudgetWindows=260,overflow=false`,suspect `true`。
  - `fhd-1080`:buffer `1920×1080`,CSS `1280×720`,refresh `60Hz`,median `16.67ms`,frames `count=260,p50=16.67,p95=16.81,p99=16.93,overBudgetWindows=260,overflow=false`,suspect `true`。
  - `qhd-1440`:buffer `2560×1440`,CSS `1280×720`,refresh `60Hz`,median `16.67ms`,frames `count=260,p50=16.67,p95=16.81,p99=16.88,overBudgetWindows=260,overflow=false`,suspect `true`。
  - 解讀:本機/headless Edge 為 60Hz cadence,故 p95 必然超過 8.33ms 120Hz 效能地板並標 suspect;三模式 buffer/display meta 與 `frames` JSON 匯出均可讀。Bundled Chromium headless 曾被節流到 3–10Hz,不採作效能證據。
  - 清理:dev server PIDs 22664/14664 已停止;`netstat` 僅餘 TIME_WAIT,無 5173/5174 LISTENING。
- **範圍檢查**:未修改 `SIM_HZ`、sim/input/HitDetector/physics constants;frame log 只掛 render/data/main 層。`RenderLoop` 新增 optional sink 不改既有 onFrame 呼叫契約;`meta.frames` 為 v2 optional reserved 區塊,不 bump schema。
- **決策**:`meta.frames` 沿用 WP-16 v2 reserved 區塊;CSV 以第三個 summary-only 檔輸出,避免 per-frame series 膨脹 CSV。Frame log 記 delta 而非 raw timestamp,符合 OQ-S3-4「JSON 完整 delta 序列」。
- **Surprises / 有意識妥協**:真實 120Hz/240Hz 面板與完整人工 20-target run 未於本 headless 環境執行;T3 用 Edge headless 驗證 live export 鏈路與三解析度 buffer/frames 形狀,效能地板的真實硬體 PASS/FAIL 留 moderator 實驗機延續 T2 OQ-20.3 實機矩陣。

### 2026-07-08 — T2 fullscreen 流程 + 資格閘 PASS(GD-10 防線①,不合格拒入)
- **實作檔案**:
  - 新增 `src/display/constants.ts`:`PERF_FLOOR_MS = 8.33`(OQ-S3-1 收斂值)+ `EXPERIMENT_MAX_CONDITION = {minW:2560, minH:1440}`(= qhd-1440,實驗最高條件)。設定常數、不寫死。
  - 新增 `src/display/eligibilityGate.ts`:`runEligibilityGate(required, warmupP95Ms, perfFloorMs?)` 純三檢查(原生解析度 `screen×dpr ≥ 需求`、`document.fullscreenElement != null`、`p95 ≤ 地板`);`details` 為全量人類可讀明細(逐項 pass/fail + 實測值 vs 門檻),進 `meta.display.gate`。另 `probeWarmupP95Ms()` = warmup 局部量測(丟前 30 rAF delta,取後 120 nearest-rank p95;T3 frameLog 落地後改 consolidated 來源)。
  - 新增 `src/display/experimentSession.ts`:`createExperimentSession()` 最小狀態機;`enter(report)` 保存 gate、`handleFullscreenChange(present)` session 進行中退出 fullscreen → 標 `suspect` + 觸發 `onSuspect`(一次)。protocol 排程本體歸 WP-22 T2。
  - 新增 `src/ui/EligibilityGate.ts`:`createEligibilityGateScreen()` 純 TS DOM overlay;啟動按鈕(user gesture)→ 請求 fullscreen → warmup 探測 → 資格閘;通過 `onEnter(report)` 並關閉,不合格逐項 ✓✗ + 全量 details + 「重試」;另 `showSuspectWarning()` 中途退出 fullscreen 警示條。
  - 修改 `src/display/resolutionMode.ts`:`DisplayState` 加 optional `gate?: GateReport`。
  - 修改 `src/data/metadata.ts`:`requireDisplayState` 驗證 optional `display.gate`(`requireGateReport`:pass/native/fullscreen/perf 布林 + details 非空)。
  - 修改 `src/main.ts`:`enterExperimentSession` 最小落地——實驗 session 按鈕(解鎖顯示)開資格閘;`fullscreenchange` 掛 `experimentSession.handleFullscreenChange`;匯出 `suspect = playerCorridorExceeded || experimentSession.suspect`、`meta.display.gate = experimentSession.gate`。
- **斷言證據**:
  - `npx.cmd vitest run src/display/eligibilityGate.test.ts` — 14 tests:三檢查各自可獨立紅/綠(native/fullscreen/perf 單項失敗)、`<=` 邊界(p95 = 地板 → PASS)、自訂地板 override、參數驗證、warmup p95 nearest-rank(spike 位於/低於 top 5%)。
  - **DPI 矩陣(單元級,失效防範機制驗證)**:Windows 縮放 100%(screen 2560×1440 × dpr 1)/125%(2048×1152 × 1.25)/150%(1706.67×960 × 1.5)三檔 → 還原原生 2560×1440 皆 PASS;真 FHD 面板 100%(1920×1080 × 1)→ FAIL。機制 = `screen × devicePixelRatio` 還原實體像素。
  - `src/display/experimentSession.test.ts` — 7 tests:enter 保存 gate、fullscreen 退出 → suspect + onSuspect 一次(重複退出不重觸)、進入前忽略、entering(present=true)不升 suspect、exit 後保留供最後匯出。
  - `src/ui/EligibilityGate.test.ts` — 4 tests:通過 → onEnter + 關閉;不合格 → 逐項原因 + details + 「重試」;警示條 show/hide;取消關閉不進 session。
  - `src/data/metadata.test.ts` — +2 tests:`meta.display.gate` 全量帶過;malformed gate 拒絕。
  - `npm.cmd run typecheck` exit 0。
  - `npm.cmd test` exit 0 — **53 test files / 390 tests passed**(T1 為 50/363;+3 檔 +27 test)。
  - `npm.cmd run build` exit 0 — 65 modules transformed(T1 為 61;+4 新模組),production build succeeded(僅既有 chunk size warning)。
- **範圍檢查**:未修改 `SIM_HZ`、sim/input 鏈、命中判定;資格閘/fullscreen/session 僅落 display/ui/data/main(render/UI/data 層,GD-10/GD-6c)。`sharedState.validity` 未被本 task 寫入(只讀 `playerCorridorExceeded`);suspect 為 data 層 OR,不改 sim 演進。architecture guard(sim/state 不 import scene)仍綠。
- **決策**:資格閘為純函式讀環境訊號 + caller 傳入 warmup p95(比照 resolutionMode 讀 global 慣例;p95 量測抽離為 `probeWarmupP95Ms` 便於測試與 T3 consolidate)。`gate` 掛在 `DisplayState` optional 欄而非另開 meta 頂層區塊——維持 `meta.display = DisplayState` 契約、additive 不 bump schema(§2.5)。
- **Surprises / 有意識妥協**:**物理硬體 DPI 驗證未於本環境執行**——headless/無多 DPI 實機 + fullscreen 需 user gesture,無法忠實重現。DPI 判斷「機制」(`screen × dpr` 換算)已以單元矩陣釘死(上);真實面板 100%/125%/150% 的最終端到端確認留 moderator 實機(比照 T1 的 real-browser 量測分工),見 Open Questions。

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
