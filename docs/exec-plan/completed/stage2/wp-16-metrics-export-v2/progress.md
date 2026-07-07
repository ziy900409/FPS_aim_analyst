# WP-16 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: ✅ WP-16 收斂(schema v2 + 壓槍指標交付)— T-exit PASS 2026-07-07

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ 2026-07-07 |
| T1 schema v2 | ✅ 2026-07-07 |
| T2 理想路徑指標 | ✅ 2026-07-07 |
| T3 結果頁對照 | ✅ 2026-07-07 |
| T-exit | ✅ 2026-07-07 |

---

## Open Questions ledger(T0 解決)

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S2-3 感度語意/schema 斷代(`sensitivityModel` 已由 WP-12 落地;`schemaVersion` bump 政策本 WP 收尾) | ✅ closed(T0) | v2 斷代政策固定:`sensitivityModel: 'cs2-0.022deg'` 已由 WP-12 落地;T1 一次 bump `schemaVersion` 至 v2 並把 `sensitivityModel` 納入 v2 meta 對帳。舊匯出缺 `sensitivityModel` 視為 stage A 佔位模型 `0.0022 rad/count`;舊資料不回溯轉換,分析端以 schema/model 斷代分流。 |
| 稽核不確定清單 #4:`targetCenterOffsetDeg` 語意(相對誰的中心/正負號)定稿 | ✅ closed(T0) | `targetCenterOffsetDeg` = fire 當下 `camera.getWorldDirection()` 正向射線與 active target **中心點**(`target.pos`)的角距離,單位 degrees。值域為無號非負角度(0 = camera 正對 target center),不帶左右/上下正負號;若需方向性誤差,須另立欄位,不得重解釋 `offsetDeg`。 |

---

## Log

### 2026-07-07 — T-exit PASS(schema v2 + 壓槍指標交付;不變式/溢位/對帳全綠)

**閘門結論:** WP-16 收斂。v2 匯出對帳一致、統計=匯出與 schema.md=payload 兩不變式綠、arena 溢位保護測試綠、
與 WP-14 T3 殘速連續欄對帳收斂。**WP-17 全鏈路 E2E 自此有穩定資料面可消費**(fire 欄位齊、meta v2 斷代齊、不變式綠)。
本切片為 docs-only(status/checklist/OQ ledger/上層索引 + 五軸 code review 附註),`git diff --stat` 不含 `src/`。

**1. `test:ci` 三段全綠(提升權限;沙盒讀 Vite config access denied):**
- `npm.cmd run typecheck` → exit 0。
- `npm.cmd test`(vitest) → **42 files / 320 tests passed**,2.37s。
- `npm.cmd run test:e2e`(playwright) → **9 passed**,18.3s(含 `full-drill` 全鏈路 schema / 事件 / metadata / 統計＝匯出)。

**2. 不變式抽查(assert 測試名 + 結果):**
- **統計=匯出**:
  - unit [export.test.ts](../../../../../src/data/export.test.ts) › *builds the appendix C payload from metadata and recorder snapshot*
    → `buildExportPayload(meta, snapshot)` `toEqual({ meta, ticks, events })`;ticks/events 為 snapshot 直通,無轉換漂移(見 [export.ts:20-31](../../../../../src/data/export.ts))。
  - E2E [full-drill.spec.ts](../../../../../tests/e2e/full-drill.spec.ts) › *crossOriginIsolated + 全鏈路:schema / 事件 / metadata / 統計＝匯出*
    → `metricsMatchExport === true`(結果頁 `getMetrics()` vs JSON round-trip 反算逐欄一致)。
- **schema.md=payload**:
  - unit [export.test.ts](../../../../../src/data/export.test.ts) › *serializes ticks and sparse event tables as CSV files*
    → 逐 byte 釘住 CSV 表頭 `t,vx,vz,px,pz,tx,ty,tz,yaw,pitch,keys` 與 fire 全欄
    `type,t,targetId,side,key,hit,firstShot,residualSpeed,viewYaw,viewPitch,aimPunchPitch,aimPunchYaw,spreadX,spreadY,recoilIndex,ammo,offsetDeg,part`,
    與 [schema.md](../../../../operational/schema.md) §CSV(line 172/252)完全一致;JSON 範例(schema.md:234)與測試 payload 同形。

**3. 溢位保護確認(容量公式 + 測得餘裕):**
- 容量公式 [RingBuffer.capacityForDrill](../../../../../src/data/RingBuffer.ts):`ceil(maxDrillSeconds × (simHz + maxFireHz)) + ceil(extraTicks)`,`maxFireHz=10`(AK 1/cycletime)。
- [DataRecorder.test.ts](../../../../../src/data/DataRecorder.test.ts):
  - *estimates capacity from drill duration and sim rate with spare ticks* → `capacityForDrill(128, 300, 128) === 41_528`。
  - *does not wrap on overflow and preserves the oldest rows* → 非環狀 arena,滿載置 `recorderOverflow=true` 並保留最舊列。
  - *records directly from shared state without per-tick record objects* → 100_000 列寫入不溢位(物件重用,零 per-tick 配置)。
- **測得餘裕**:300s / 128Hz drill 實需 38 400 tick 列,容量 41 528 → 餘裕 **3 128 列(≈8.1%)**,另公式已內含 `+10Hz` fire-rate 保守預留。

**4. WP-14 T3 對帳點收斂(殘速連續欄落位):**
- [WP-14 T3](../wp-14-movement-physics/T3-metrics-continuous.md) 帶著走的決定為「真殘速連續欄/停火時序對齊統一排 WP-16 schema v2 對帳,不在 WP-14 提前擴欄」。
- **收斂確認**:fire 事件 `residualSpeed: number`(連續 u/s)為 v2 必填欄([DataRecorder.ts:17](../../../../../src/data/DataRecorder.ts)、[schema.md:130](../../../../operational/schema.md)),
  匯出/CSV/JSON 全鏈路齊;WP-14 T3 的連續殘速統計(mean/p50/SD)即讀此欄。**殘速連續欄落位確認。**
- **仍延後(非 WP-16 交付)**:獨立 `t_velocity_zero` 事件欄未於 v2 加入——v2 fire 欄鎖定 8 個具名欄(§2 契約),`residualSpeed` 已足以承載 counter-strafe 品質的逐發連續量;
  `t_velocity_zero` 若研究需要,屬 additive 擴欄(v2 reserved optional,不再 bump)。互記:見 WP-14 progress 對帳附註。

**5. OQ ledger 收斂:**
- **OQ-S2-3**(感度語意/schema 斷代)已於 [../README.md §8](../../../active/stage2/README.md) ✅ closed 並註「T0 收尾(2026-07-07 WP-16)」;T1 已 bump `schemaVersion:2` + `sensitivityModel` 納 v2 對帳,無重開項。
- **`targetCenterOffsetDeg`**(稽核不確定 #4)已於本檔 T0 OQ ledger ✅ closed(無號非負角距離,不重解釋 `offsetDeg`);T-exit 確認無回歸。
- 本 WP 無新增未決 OQ。

**五軸 code review(T1–T3 全 diff):Approve。** 發現皆不擋線:
- **Correctness**:T2 補償路徑為累積偏移對累積偏移比較(`aimPunch` 本身為 burst 內累積狀態),單位/baseline/shortest-angle 處理正確;
  `mirrorPunch` 正規化 `-0`→`0`;空/短序列安全回 `{0,0}`。fire 欄位語意(pre-kick punch / 本發 shot index / 開火前剩彈)承 T0 決議。
- **Architecture**:統計單一計算點在 metrics 層,UI 讀結算物件不重算(避免統計/呈現漂移);匯出為 snapshot 直通,meta 僅 OR 合併 `suspect/recorderOverflow`。
- **Security**:無外部輸入面;CSV cell 逸出引號/逗號/換行;`assertFinitePayload` 擋非有限數。
- **Performance**:metrics 為離線 O(n) 統計(`computeSwitchTimes` 對 fire 事件 O(n²) 但集合極小,非熱路徑);匯出零 sim 熱路徑影響。
- **Readability**:命名對齊 CONTEXT.md 正規術語;無 dead code。

**Outcomes(交付了什麼):**
- 匯出 **schema v2**:fire 事件 8 擴欄(view/punch/spread/recoilIndex/ammo)+ meta 6 欄(weaponId/weaponSeed/rngSeed/sensitivityModel/movementModel/`schemaVersion:2`)+ tick arena `px/pz/tx/ty/tz`;`schema.md` v2 欄位/容量公式/FPSci 對映附錄齊。
- **壓槍指標**:`buildIdealPath`(−aimPunch×2 鏡像)+ `compensationError`(mean/RMS 角度)+ 結果頁實際 vs 理想軌跡 overlay(legend + mean/RMS 數值列)。
- 不變式:統計=匯出、schema.md=payload、arena 非環狀溢位保護——全綠。

**Surprises:** 無新增(沙盒 Vite config access denied 為既知,提升後全綠)。

**帶著走的決定:**
- v2 fire 欄鎖 8 具名欄;`t_velocity_zero` 與 `scene/display/frames/session` 同列 v2 reserved optional,後續 additive 不 bump。
- WP-17 T2 可直接消費 v2 匯出(欄位齊、不變式綠、決定性回歸由 WP-17 T1 擴充)。

**Next:** WP-16 完成;WP-17([../wp-17-integration/README.md](../wp-17-integration/README.md))全鏈路 E2E(M8)可開跑(上游 WP-15 M7 caveated + WP-16 均 ✅)。

### 2026-07-07 — T3 result overlay PASS(實際 vs 理想壓槍軌跡對照)

**結論:** 結果頁已呈現 FR-B15 的軌跡對照。`Metrics` 現在帶同源
`recoilCompensationPath.actual/ideal`;ResultScreen 直接讀結算物件,畫出 actual aim 與 ideal `-aimPunch x2`
兩條線、圖例與 mean/RMS 數值列。零 fire path 隱藏區塊;單發 path 以點 marker 呈現,不畫 polyline。

**實作摘要:**
- [compute.ts](../../../../../src/metrics/compute.ts):新增 `RecoilCompensationPath`,由 fire-time
  `viewYaw/viewPitch/aimPunchPitch/aimPunchYaw` 同時計算 actual/ideal path;mean/RMS 與 UI path 共用同一序列。
- [ResultScreen.ts](../../../../../src/ui/ResultScreen.ts):新增 `createRecoilOverlayModel(...)` 純 view model 與
  DOM/SVG overlay 渲染;結果頁新增 `Recoil Compensation Path` 區塊,保留既有 cards 與 reaction histogram。
- [compute.test.ts](../../../../../src/metrics/compute.test.ts)+[ResultScreen.test.ts](../../../../../src/ui/ResultScreen.test.ts):
  鎖住 path 契約、合成 10 發座標 snapshot、空資料與單發邊界。

**Decision Log:**
- **Metrics 擴出 `recoilCompensationPath`,UI 不重算:**T3 需要畫兩條序列;若 ResultScreen 從 raw event 重建會違反
  「數值列與 T2 統計物件同源」要求。*Alternatives considered:*把 raw fire events 傳進 `show(...)` 或在 UI 重新跑
  T2 計算;否決,會擴大 UI 職責並製造統計/呈現漂移風險。
- **ResultScreen 測試走純 overlay model snapshot:**現有 Vitest 沒 DOM shim;新增 jsdom/happy-dom 只是為一個 SVG 測試引入依賴。
  *Alternatives considered:*新增 DOM test environment;否決,改以 `createRecoilOverlayModel` 鎖座標歸一與邊界,再用
  Playwright 目視補足 DOM 呈現。

**驗證證據:**
- `npm.cmd run typecheck` → exit 0。
- `npx.cmd vitest run src\metrics\compute.test.ts src\ui\ResultScreen.test.ts`
  → **2 files / 14 tests passed**。
- `npm.cmd test` → **42 files / 320 tests passed**。
- `npm.cmd run dev -- --host 127.0.0.1`(提升權限;沙盒內 Vite/esbuild 讀 config 會 access denied) →
  `http://127.0.0.1:5173/` 回 `status=200`。
- Playwright 注入合成 10 發 metrics 目視:結果頁 cards、reaction histogram、`Recoil Compensation Path`
  legend/mean/RMS 與兩條軌跡同時可見;overlay 未遮住既有互動控制。

**Surprises & Discoveries:**
- 本機原先缺 Playwright browser,已用 `npx.cmd playwright install chromium` 安裝 Chromium 後完成目視截圖檢查。
- Vitest 專案未配置 DOM shim;T3 測試採純 view model snapshot,避免為單一 UI 測試新增 runtime 依賴。

**Open Questions:** none。

**Next:** T-exit([T-exit-gate.md](T-exit-gate.md))—不變式全綠 + schema 對帳宣告。

### 2026-07-07 — T2 ideal path metric PASS(理想壓槍路徑 + 補償誤差)

**結論:** FR-B15 的純計算路徑已落地。`buildIdealPath(punchSeq)` 產生 `-aimPunch*2` 的 pitch/yaw 理想補償序列;
`compensationError(aimSeq, idealSeq)` 回傳 `{ meanDeg, rmsDeg }`;`computeMetrics(...)` 現在輸出
`recoilCompensationError` 供 T3 結果頁直接消費。

**實作摘要:**
- [compute.ts](../../../../../src/metrics/compute.ts):新增 `AimOffset` / `PunchSample` / `CompensationError` 型別與
  `buildIdealPath`、`compensationError` 純函式。
- [compute.ts](../../../../../src/metrics/compute.ts):fire event 同時具備
  `viewYaw/viewPitch/aimPunchPitch/aimPunchYaw` 時,以第一筆有效 fire view 作 baseline,將實際 view 序列轉成度數偏移,
  再與理想路徑比較;缺 v2 欄位的舊資料安全回傳 `{ meanDeg:0, rmsDeg:0 }`。
- [compute.test.ts](../../../../../src/metrics/compute.test.ts):新增完美補償、零補償解析對照與
  `computeMetrics` 整合測試。

**Decision Log:**
- **實際 aim path 使用第一筆有效 fire view 作 baseline:**理想路徑是 offset 序列而非世界絕對角度,所以實際
  `viewYaw/viewPitch` 先轉成相對第一發的角度偏移。`yaw` 使用 shortest-angle delta 避免跨 `±pi` wrap。
  *Alternatives considered:*直接比較絕對 view rad 與 ideal deg 會混用單位且受初始朝向污染;改讀逐 tick aim 會違反
  T2 out-of-scope 的「記錄而非重建」邊界。
- **T2 指標只掛統計物件、不擴匯出 schema:**目前匯出仍是原始 ticks/events;補償指標可由 v2 fire 欄位離線重算。
  *Alternatives considered:*把 mean/RMS 另寫入 export payload;否決,避免在 T2 擴張 schema 契約,T3 可直接讀結算物件。

**驗證證據:**
- `npm.cmd run typecheck` → exit 0。
- `npx.cmd vitest run src/metrics/compute.test.ts src/ui/ResultScreen.test.ts`
  → **2 files / 11 tests passed**。
- `npx.cmd vitest run` → **42 files / 317 tests passed**。
- `graphify update .` → rebuilt **768 nodes / 1651 edges / 50 communities**。

**Surprises & Discoveries:**
- 沙盒內直接跑 targeted Vitest 仍在載入 Vite config 時遇到父層 access denied;提升後同一指令通過。

**Open Questions:** none。

**Next:** T3([T3-result-overlay.md](T3-result-overlay.md))—結果頁軌跡對照(實際 vs 理想)。

### 2026-07-07 — T1 schema v2 PASS(fire/meta 擴欄 + arena 容量重估)

**結論:** schema v2 已落地。匯出 meta 固定 `schemaVersion:2`，新增 `weaponId/weaponSeed/rngSeed/movementModel`；
fire 事件由唯一產彈點 `fireOneShot` 寫入 view/punch/spread/recoilIndex/ammo；tick arena 新增
`px/pz/tx/ty/tz`；`docs/operational/schema.md` 已更新 v2 欄位、容量公式與 FPSci 對映附錄。

**實作摘要:**
- [RingBuffer.ts](../../../../../src/data/RingBuffer.ts):`TickRecord` 新增玩家位置與 active target center；無 active target 時
  `tx/ty/tz = null`。`capacityForDrill` 改為
  `ceil(maxDrillSeconds * (simHz + maxFireHz)) + ceil(extraTicks)`，預設 `maxFireHz=10`(AK 1/cycletime)。
- [SimLoop.ts](../../../../../src/loop/SimLoop.ts):`fireOneShot` 在 `recoilOnFire` 前記錄本發 pre-kick
  `viewYaw/viewPitch/aimPunchPitch/aimPunchYaw/spreadX/spreadY/recoilIndex/ammo`，沿用 T0 語意決議。
- [metadata.ts](../../../../../src/data/metadata.ts):`collectMeta` 固定輸出 v2 meta，並保留
  `spawn/scene/display/frames/session` optional block 縫。
- [DrillConfig.ts](../../../../../src/drill/DrillConfig.ts)+[schema.ts](../../../../../src/drill/schema.ts):新增 additive
  `weaponId?`；省略時由呼叫端使用預設 AK-47。
- [main.ts](../../../../../src/main.ts)+[fpsTestHarness.ts](../../../../../src/testharness/fpsTestHarness.ts):
  export meta 寫入 active weapon 與 `sequence.seed ?? DEFAULT_RNG_SEED`，sim loop 也依 `weaponId?` 取 weapon。

**Decision Log:**
- **active target 欄位 nullable:** `tx/ty/tz` 在無 active visible/alive target 時輸出 `null`(CSV 空欄)，而非填 0。
  *Alternatives considered:*填 0 會與世界原點混淆；省略欄位會使逐 tick schema 不固定。
- **容量公式納入 fire 率上限:** 以 `simHz + maxFireHz` 估算預留空間，預設 `maxFireHz=10` 對齊 AK-47
  `1/cycletimeSec`。*Alternatives considered:*只維持 tick-only 容量會無法反映 T1 per-fire 欄位增加後的保守容量政策。
- **`DrillConfig.weaponId?` 僅驗非空字串:** 實際 weapon 解析仍由 `getWeapon` 負責。*Alternatives considered:*在
  drill schema 重複 weapon enum；否決，避免 weapon registry 雙寫漂移。

**驗證證據:**
- `npm.cmd run typecheck` → exit 0。
- `npx.cmd vitest run src/data/DataRecorder.test.ts src/data/export.test.ts src/data/metadata.test.ts src/drill/schema.test.ts src/loop/SimLoop.test.ts`
  → **5 files / 53 tests passed**。
- `npm.cmd test` → **42 files / 314 tests passed**。
- `graphify update .` → rebuilt **761 nodes / 1636 edges / 49 communities**。

**Surprises & Discoveries:**
- 沙盒內直接跑 Vitest 仍會在載入 Vite config 時遇到父層 access denied；依權限規則提升後測試乾淨通過。

**Next:** T2([T2-ideal-path-metric.md](T2-ideal-path-metric.md))—理想壓槍路徑 + 補償誤差 mean/RMS。

### 2026-07-07 — T0 entry gate PASS(WP-13 exit 驗證 + schema v2 斷代/欄位語意決議)

**閘門結論:** WP-13 exit 已完成且本地基準測試乾淨;T1 可開始實作 schema v2 擴欄。本切片為 docs-only,
`git diff --stat` 不含 `src/`。

**1. 上游 WP-13 exit 證據:**
- [WP-13 task-checklist](../wp-13-sim-camera-integration/task-checklist.md) T0/T1/T2/T3/T-exit 全 ✅。
- [WP-13 progress](../wp-13-sim-camera-integration/progress.md) 宣告 M6 於 2026-07-06 完成:
  `test:ci` 三段全綠(typecheck、38 files / 288 tests、Playwright 9 passed)且手動壓槍四項已由使用者確認通過。
- T4 follow-up 後 WP-13 追加驗證:`npm run test` 38 files / 289 tests passed、`npx playwright test` 9 passed。

**2. T0 乾淨基準:**
- `npm run test` 直接跑時被 Windows PowerShell execution policy 擋在 `npm.ps1`。
- 改用 `npm.cmd run test` 後,沙盒內 Vitest/esbuild 讀 Vite config 時遇到父層目錄 access denied。
- 依權限規則提升後重跑 `npm.cmd run test` → **42 files / 310 tests passed(exit 0)**,2.72s。

**3. fire 時點資料形狀抽查(CodeGraph + source read):**
- **punch:** [SharedState.recoilState](../../../../../src/state/SharedState.ts) 持有
  `aimPunchPitchDeg/aimPunchYawDeg` 與 `viewPunchPitchDeg/viewPunchYawDeg`;[SimLoop.ts](../../../../../src/loop/SimLoop.ts)
  `ballisticRaycast` 以 `aimPunch*2` 經 `punchToThreeRad` 組 rawPunch 彈道。現行 `recordEvent({type:'fire'})`
  在 `recoilOnFire` 前執行,所以 T1 若直接讀 `state.recoilState` 寫 fire 欄,語意是**本發 kick 前**的 punch。
- **spread:** `fireOneShot` 於彈道 raycast 前呼叫 `sampleSpread(...)`,並寫入
  `state.recoil.lastSpread.x/y`;同一發 `ballisticRaycast` 讀此暫存作 `forward + x*right + y*up` 偏移。
- **recoilIndex:** `RecoilState.recoilIndex` 存於 `state.recoilState`;`recoilOnFire` 依當前 index 取表後才 `+1`。
  因現行 fire event 在 `recoilOnFire` 前記錄,T1 讀到的是**用於本發的 shot index**而非下一發 index。
- **ammo:** `state.weapon.ammo` 存於 [SharedState.weapon](../../../../../src/state/SharedState.ts);
  [scheduleFire](../../../../../src/loop/SimLoop.ts) 在 `fireOneShot(...)` 返回後才 `state.weapon.ammo--`。
  因此 T1 若於 `fireOneShot` 記錄 `ammo`,語意是**本發開火前剩餘彈數**。

**4. 語意決議:**
- **OQ-S2-3 / schema v2 斷代:** `sensitivityModel: 'cs2-0.022deg'` 已存在且是 stage2 感度語意標記;
  T1 一次 bump `schemaVersion` 至 v2,舊資料不回溯轉換。無 `sensitivityModel` 的舊 export = stage A
  佔位感度模型 `0.0022 rad/count`;研究端以 `schemaVersion` + model 欄分流。
- **`targetCenterOffsetDeg`:** [HitDetector.ts](../../../../../src/sim/HitDetector.ts) 實作為 camera 世界位置到
  active target center(`target.pos`)向量與 camera forward 的 `angleTo`,回傳 degrees。此為無號角距離:
  0 表示準心/camera forward 正對目標中心;不表達左右/上下方向,不帶正負號。

**Next:** T1 schema v2 擴欄 + `schemaVersion` + arena 容量重估。

### 2026-07-07 — FPSci R1 對齊決策(使用者拍板,grill)
- **對映表入 T1**:schema v2 設計時同步產出 FPSci 欄位對映表(schema.md 附錄);
  **命名 CONTEXT.md 正規術語優先、既有欄位不改名**,僅 v2 全新欄位且語意完全相同時採 FPSci 命名——
  可比性由對映表承擔,不由改名承擔(R1 原文「沿用其命名慣例」與 CLAUDE.md §2 命名協議衝突,以後者為準)。
- 授權邊界:GD-11(禁碰 FPSci 程式碼;欄位語意/文件/論文可參考)。
- 出處:[FPSci 評估 R1](../../../../research/FPSci_評估與建議.md)。

### 2026-07-03 — Valorant 接口決策(使用者拍板)
- meta 擴欄追加 **`movementModel`**(移動模型語意斷代,比照 `sensitivityModel`):Valorant 移動
  本階段不實作,資料面先留可比性接口;值對齊 WP-14 `MovementProfile` id。

### 2026-07-03 — Plan authored
- 由 stage2 計畫([../README.md](../../../active/stage2/README.md) §6 WP-16 表 + session 補充決定)展開為自足 task 檔(T0–T3 + T-exit)。
- 補充決定:`schemaVersion` bump 落 T1(WP-12 只加 `sensitivityModel`);`DrillConfig.weaponId?`
  選填欄與 meta `rngSeed`(WP-13 OQ-13.1 的 seed 記錄)一併落 T1;arena 容量以 fire 事件率上限
  (= magSize/cycletime)重估。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— WP-13 exit 驗證 + 兩條語意決議,docs-only。
