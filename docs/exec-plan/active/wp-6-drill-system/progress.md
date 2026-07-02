# WP-6 — Progress Log

> Running log。最新在上。同伴：[README.md](README.md) · [task-checklist.md](task-checklist.md)。

---

## Status: ✅ 完成（T5 ✅，2026-07-02）

| Phase | State |
|-------|-------|
| T0 Entry gate | ✅ 完成（2026-07-02） |
| T1 DrillConfig schema | ✅ 完成（2026-07-02） |
| T2 Drill 載入器 | ✅ 完成（2026-07-02） |
| T3 Counter-strafe drill 檔 | ✅ 完成（2026-07-02） |
| T4 Drill 生命週期 | ✅ 完成（2026-07-02） |
| T5 Exit gate | ✅ 完成（2026-07-02） |

---

## Open Questions ledger（T0 解決）

| ID | Status | Resolution |
|----|--------|-----------|
| OQ-6.1 schema 欄位 | ✅ 鎖定（T0） | `DrillConfig` = drillId/targets/sequence/timing/endCondition；TS 型別 + JSON Schema 雙重約束（T1）。`targets.motion?` 省略=static（F5 接縫）、`timing.spawnDelayMs?` 預設 0、`peekTimeoutMs?` 防卡、`endCondition` 雙閘 targetCount/timeLimit。 |
| OQ-6.2 位置定義 | ✅ 鎖定（T0） | 階段 A 用 L/R peek 槽位 + 距離抽象（貼合 counter-strafe，對齊現有 `TargetManager.sideX`）；絕對座標延後。 |
| OQ-6.3 結束條件預設 | ✅ 鎖定（T0） | 預設 `targetCount`（目標數達標）；`timeLimit` 為可選後援閘（防生命週期卡 phase）。 |
| OQ-6.4 載入失敗處理 | ✅ 鎖定（T0） | `loadDrill` 載入時驗證（型別 + 必填）；不合 → throw 明確錯誤、**不啟動 drill**（避免污染量測資料）。 |

---

## Log

### 2026-07-02 — T5 Exit gate（F4 驗收 map + 交棒 WP-7/WP-8）✅
- **驗證**：`npx vitest run` 綠燈（17 files / 135 tests passed；因 PowerShell execution policy 擋 `npx.ps1`，實跑命令為 `npx.cmd vitest run`）；`npx tsc --noEmit` 綠燈（實跑命令為 `npx.cmd tsc --noEmit`）。
- **Acceptance map**：`DrillConfig` 型別 + runtime schema（T1）；`loadDrill` + config-driven `TargetManager`（T2）；`drills/counterstrafe_ad_v1.json` 可跑滿 20 個 L/R 交替目標（T3）；`DrillRunner` idle/countdown/running/ended/restart 相位完整（T4）。
- **F4 解耦證明**：T2 測試以同一個 `createTargetManager` 跑兩個 config（`count=2, LR` 與 `count=4, RL`），只換 JSON/config 即換 drill 行為，零引擎程式碼改動。
- **Outcomes & Retrospective**：WP-6 已把 WP-4 佔位目標序列收斂到資料驅動路徑；`TargetManager` 保持目標生成職責，`DrillRunner` 負責生命週期，職責分界清楚。手動 UI 操作（開始/重來/換 drill 控制）尚未接線，已明確交棒 WP-8；資料記錄完整 drill lifecycle/event payload 交棒 WP-7。
- **文件更新**：`T5-exit-gate.md` 驗收全勾；`task-checklist.md` T5 ✅；WP-6 README 驗收 ✅；頂層 `docs/exec-plan/README.md` WP-6 ✅。
- **Next**：WP-7 DataRecorder（記錄完整 drill 的 ticks/events/export metadata）；WP-8 Metrics/HUD（載入 drill、開始/重來 UI、換 drill 控制、結果頁）。

### 2026-07-02 — T4 Drill 生命週期（開始/倒數/結束/重來）（FR-6.4）✅
- **產出**：`src/drill/DrillRunner.ts`（`createDrillRunner` 相位機 `idle→countdown→running→ended` + `restart` 全 reset）；`src/drill/DrillRunner.test.ts`（9 tests）；MODIFY `src/loop/SimLoop.ts`（`simStep`/`createSimLoop` 新增選填 `drillRunner`，running 相位才驅動目標）。
- **驗證**：`vitest run` 135 passed（+9 新）；`tsc --noEmit` 綠燈。斷言涵蓋：初始 idle；start→countdown 且倒數期間零 spawn；倒數自「第一個 sim tick」起算（非 start() 時刻）達 countdownMs 轉 running 並在同 tick spawn 首側（=alternation[0]）；擊殺達 endCondition.targetCount → ended 且無超額 spawn；endCondition.timeLimit 達時限 → ended；timing.timeLimitMs 後援閘（targetCount 永不達仍結束，防卡 phase）；restart 後 targets/tVisible/firstShotPeekId/player 全空且可重玩再達 ended；SimLoop 整合（未 start 時 pump 不 spawn、start 後 pump 一 tick 即驅動 runner spawn）。
- **Decision — DrillRunner 驅動 TargetManager，`simStep` 二選一 tick 目標**：有 `drillRunner` 則由其在 running 相位呼叫 `targetManager.tick`（countdown/idle/ended 不 spawn），**取代** `simStep` 原本的直呼；避免雙重 tick。`targetManager` 與 `drillRunner` **併傳**——fire→markKilled 仍走 `targetManager`（同一實例）。*Alternatives*：SimLoop 依 `runner.phase` 自行 gate targetManager.tick（相位邏輯外溢至 SimLoop，違單一職責）；DrillRunner 內建獨立 target 生成（與 TargetManager 重複，違 Rule 0）。
- **Decision — `createDrillRunner(state, targetManager)` 建構期注入依賴**：README §2 interface 的 `restart(): void` 不帶參數,但 restart 必須 reset state + targetManager,故於 factory 注入二者;`tick(state,…)` 仍依 interface 收 state（＝同一實例）。*Alternatives*：`restart(state)` 帶參（背離 README 契約）。
- **Decision — `drillRunner` 為 `simStep`/`createSimLoop` 的**末位選填參數****：既有 WP-2/4/5 positional 呼叫（至 `handle`）零改動即續綠；WP-4 無 runner 路徑走原 `targetManager?.tick`（向後相容）。
- **Decision — endCondition.targetCount 由「擊殺數 = seen id − 目前存活」推導**：不侵入 TargetManager（T4 Touches 僅 NEW DrillRunner + MODIFY SimLoop，未列 TargetManager）；spawn 上限 `targets.count` 仍由 TargetManager 自身 config 執行（tm 與 runner 共用 config），runner 只判 endCondition。命中一 tick 後才反映（markKilled 在 tick 之後的 fire 路徑），最多晚一 tick 偵測 ended（可接受）。
- **Decision — 倒數自「第一個 sim tick」起算**：`start()` 不帶時間源（README 契約），倒數 `countdownStartMs` 於第一個 countdown tick 以 sim clock 起算，不依賴 wall-clock；達門檻同 tick 落入 running 區塊即 spawn 首目標（不浪費一 tick）。
- **Surprise — TargetManager spawn 上限來自「自身」config,非 runner**：測試初版誤用 `createTargetManager()`（無 config → spawnLimit=Infinity）,結束 tick 仍補生 stray 目標。修正：tm 與 runner **共用同一 config**（app / T2 真實用法）。
- **Scope — main.ts 未接線（維持現況佔位 targetManager）**：T4 Touches 僅列 SimLoop.ts;完整 drill 載入 + 開始/重來 UI 屬 WP-8。整合已由 `createSimLoop(…, drillRunner)` 單元測試驗證（sim tick 有呼叫 runner.tick）。手動驗（開始倒數→遊玩→達標→重來）待 WP-8 UI 接線。
- **Next**：**T5 / T-exit** Exit gate（[T5-exit-gate.md](T5-exit-gate.md)）— 換 config 即換 drill、1 drill 可玩、生命週期完整驗收；交棒 WP-7/WP-8。

### 2026-07-02 — T3 Counter-strafe drill 設定檔（FR-6.3）✅
- **產出**：`drills/counterstrafe_ad_v1.json`（範例 drill）；`src/drill/counterstrafe_ad_v1.test.ts`（3 tests，端到端可玩性驗證）；MODIFY `tsconfig.json`（`resolveJsonModule: true`）。
- **驗證**：`vitest run` 126 passed（+3 新）；`tsc --noEmit` 綠燈。端到端斷言:import JSON → `loadDrill` 驗證通過（`drillId='counterstrafe_ad_v1'` 對齊附錄 C）→ 驅動 `createTargetManager` 跑滿一輪 = 恰 20 個目標、首側 L、嚴格 L↔R 交替。
- **Decision — `distance: 4` 而非 T3 範本的 `8`**：T3 範本 JSON 寫 `distance: 8`,但 `TargetManager.ts:35-39` 註明 WP-5 T1 手動驗證發現 **distance 8 → z=-8 落在佔位房間北牆（z=-5）後方被遮擋**,故預設改為 4（z=-4,房間內、camera 前方）。DoD 要求「可端到端遊玩」,遮擋的目標不可玩,故採實測可玩的 4。範本數值本即標註「佔位,pilot 校準」。*Alternatives*：忠於範本 8（目標被牆遮,不可玩,違 DoD）；擴大 `roomSize` 房間深度（越界改 render 佔位,違 T3 範圍「NEW 僅 drills JSON」）。
- **Decision — 用 schema 欄位 `spawnDelayMs` 取代 T3 範本的 `interTargetMs`**：T3 範本 JSON 寫 `interTargetMs: 0`,但該欄位不存在於 `DrillConfig`/`validateDrill`——正規欄位為 `spawnDelayMs`（README §2 interface + schema 一致）。counter-strafe 即時補生 → `spawnDelayMs: 0`。若沿用 `interTargetMs` 會被驗證器忽略（未知欄位）、語意落空。
- **Decision — `resolveJsonModule: true` + Vite JSON import 驗證**：本專案無 `@types/node`（DOM-only lib）,故測試不能 `node:fs` 讀檔。改用 Vite 原生 JSON import（即 `main.ts` 未來載 drill 的路徑）,需 tsconfig `resolveJsonModule`。*Alternatives*：加 `@types/node` + `node:fs`（引入 devDep,scope creep）；把 JSON 內容 inline 進測試（不驗證磁碟上的交付檔,違 DoD）。
- **Surprise — T3 範本 JSON 與現行 schema/實測有兩處不一致**（`distance:8`、`interTargetMs`）：範本寫於 T1 前的 README 規劃期,T1/T2 定案後欄位名與 WP-5 房間佔位已演進。已於本 task 對齊實況,不回改範本（範本本標註佔位）。
- **Next**：**T4** Drill 生命週期（[T4-lifecycle.md](T4-lifecycle.md)）— idle→countdown→running→ended + restart 全 reset。

### 2026-07-02 — T2 Drill 載入器（config 驅動 TargetManager）✅
- **產出**：`src/drill/DrillLoader.ts`（`loadDrill` 包 `validateDrill`）、`src/drill/DrillLoader.test.ts`（5 tests）；MODIFY `src/sim/TargetManager.ts`（`createTargetManager(config?)` 由 config 驅動）、`TargetManager.test.ts`（+7 config 驅動 tests，含兩 config 解耦驗收）。
- **驗證**：`vitest run` 123 passed（+12 新）；`tsc --noEmit` 綠燈。**F4 解耦驗收綠**：`runDrill(count=2,LR)` → `['L','R']`、`runDrill(count=4,RL)` → `['R','L','R','L']`,純由 config 差異驅動、同一 `createTargetManager`、零 `.ts` 改動。WP-4 t_visible/交替/決定性回歸全綠（TargetManager 18 tests 含原 11）。
- **Decision — `createTargetManager(config?)` config 為選填,退回 WP-4 佔位行為**：既有 WP-4 測試與 `main.ts` `createTargetManager()` 呼叫零改動即續綠(向後相容)。有 config → `targets.distance`(位置)、`sequence.alternation[0]`(首側)、`targets.count`(spawn 上限)驅動;無 config → 預設距離 4、首側 'R'、無限補生。*Alternatives*：強制必填 config(須改 WP-4 測試 + main,破壞回歸);獨立 config-driven 子類(過度抽象,違 Rule 0)。
- **Decision — spawn 上限用 `targets.count`;`endCondition` phase 語意留給 T4**：TargetManager 職責保持純粹「生成至多 count 個、首側交替、固定距離」;drill running→ended 判定屬 DrillRunner(T4)。README T2「結束（endCondition）取代 WP-4 內建佔位」解讀為「由無限補生改為有限 count 上限」,已滿足。*Alternatives*：TargetManager 內判 endCondition 雙閘(耦合 phase 邏輯,侵入 T4 範圍)。
- **Decision — `loadDrill` 接受 JSON 字串或已解析物件**：`import x.json`(Vite 給物件)與 `fetch().text()`(給字串)兩路走同一驗證;字串解析失敗 throw `載入失敗: JSON 解析錯誤`(OQ-6.4 不啟動 drill)。
- **Surprise — `reset` 預設參數語意調整**：原 `reset(state, seq='RL')` 硬編預設;改為 `reset(state, seq?)`,省略時退回 config 首側(無 config 則 'R')。既有顯式 `reset(state,'LR')` 呼叫不受影響('LR'[0]='L');`reset` 亦歸零 `spawnedCount`,使 restart 後可重跑滿額(T4 restart 相容)。
- **F5 接縫**：config.targets.motion 提供時 spawn 複製寫入目標(非共用參考),階段 A 不驅動移動(WP-6.5 接管)。
- **Next**：**T3** Counter-strafe drill 檔（[T3-counterstrafe-drill.md](T3-counterstrafe-drill.md)）— 產出 `drills/counterstrafe_ad_v1.json`,經 `loadDrill` + `createTargetManager` 驗證可玩;**T4** 生命週期(可並行)。

### 2026-07-02 — T1 DrillConfig schema ✅
- **產出**：`src/drill/DrillConfig.ts`（型別）、`src/drill/schema.ts`（`validateDrill` 手寫 guard）、`src/drill/schema.test.ts`（12 tests）。
- **驗證**：`vitest run` 111 passed（+12 新）；`tsc --noEmit` 綠燈。
- **Decision — 手寫 guard 而非 JSON Schema 函式庫**：專案零 runtime 依賴（僅 three）+「純 TS」紀律（D1）。手寫 guard 逐欄回傳收斂型別、失敗即 throw `DrillConfig 驗證失敗: <path> <原因>`,定位精準。*Alternatives*：ajv/zod（引入依賴,違背階段 A 極簡）；純 TS 型別無執行期驗證（不合法 JSON 會污染量測,違 OQ-6.4）。
- **Decision — reuse `state/types.ts` 既有 `TargetMotion`/`Vec3`**：WP-4 已立這兩型別（F5 接縫）;DrillConfig 直接 import,避免雙定義漂移。
- **Surprise — spec 附錄 G 已有 `TargetMotion` 且 `state/types.ts` 也已定義**：非本 task 新建。T1 僅在 `targets.motion?` 引用並於 `validateMotion` 淺驗（type 列舉 + 數值範圍;`waypoints` 深驗延後 WP-6.5）。
- **範圍語意**：`count` 正整數、`distance`/`peekTimeoutMs`/`timeLimitMs`/`endCondition.value` 正數、`countdownMs`/`spawnDelayMs` 非負（0 合法,對齊 counter-strafe 即時補生 spawnDelayMs=0）。
- **Next**：**T2** Drill 載入器（[T2-drill-loader.md](T2-drill-loader.md)）— `loadDrill` 包 `validateDrill` + 由 config 驅動 `TargetManager`。

### 2026-07-02 — T0 Entry gate ✅
- **PASS**：M2 ✅（頂層索引 §3 M2 ✅ 2026-07-02）；WP-4 ✅ / WP-5 ✅（§2）。上游 exit-gate 全綠 → WP-6 可展開。
- **TargetManager 可承接 config 驅動**：`src/sim/TargetManager.ts` 具 `tick`/`markKilled`/`reset`，已 `opts.distance` 參數化、L/R 槽位 (`sideX`) + `nextSide` 交替純內部驅動（無隨機源，決定性）。原始碼已註明「佔位，WP-6 drill config 接管」。
- OQ-6.1~6.4 全部 🟡→✅ 鎖定（見上表）。位置抽象採 L/R 槽位（對齊現有 `sideX`），結束條件預設 `targetCount`。
- 分支：`wp-6-drill-system`（base `main`）。
- **Next**：**T1** DrillConfig schema（[T1-drill-config.md](T1-drill-config.md)）— 型別 + JSON Schema + 範例。

### （規劃）— WP-6 計畫產出
- 依 PLAN WP-6（6.1–6.4）+ F4 + 附錄 C 展開為 T0–T5。
- 核心：把 WP-4 內建佔位序列換成 **config 驅動**，新增 drill = 新增 JSON（零引擎改動）。生命週期 idle→countdown→running→ended + restart 全 reset。
