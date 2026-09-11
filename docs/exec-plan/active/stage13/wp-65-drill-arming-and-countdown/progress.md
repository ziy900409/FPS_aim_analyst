# WP-65 — Progress

> Tech spec：[README.md](README.md) · Checklist：[task-checklist.md](task-checklist.md) · 決策 GD-41（草稿，T-exit 落帳）
>
> 每個 task 完成時追加一段（Progress / Decision Log / Surprises / Open Questions），與該切片一起 stage（協議 §3.4）。

---

## §0 規劃（2026-09-11）

**狀態**：📋 規劃完成，未開工。

計畫由 `engineering-planning` skill 產出，落點依使用者 2026-09-11 指示為 `active/stage13/`（主題不符的說明見 [README 落點說明](README.md)）。需求由使用者口述、經 `brainstorming` skill 對齊後定案。

### 規劃期發現（已寫入 README §0，此處只記推翻了什麼）

1. **需求被描述成「加上 3 秒倒數」，稽核後發現倒數早就存在，錯的是起算時機。**
   [`DrillPhase`](../../../../../src/drill/DrillRunner.ts#L27) 已有 `'countdown'`，roster 內每個 drill 的 `timing.countdownMs` 都是 `3000`。真正的缺口是兩個：
   (a) `drillRunner.start()` 在模組求值階段就被呼叫（[main.ts:1036](../../../../../src/main.ts#L1036)），而 `countdown` 自第一個 sim tick 起算 ⇒ 受試者還在看「點擊以鎖定」提示時 3 秒已走完；
   (b) 倒數**完全沒有畫面呈現**（HUD 只有四張卡）。
   ⇒ 本 WP 因此**不新增任何時間常數**，只改「何時起算」與「怎麼呈現」。原本可能寫成「新增倒數功能」的方案被推翻。

2. **「所有 drill 都倒數計時」的原始需求，在 roster 上不成立。**
   `endCondition` 兩型並存：`timeLimit`（`spider_shot_v2`／`v3` = 60 s、tracking pilot 家族）有總時長；`targetCount`（counterstrafe／detection／tracking_v1／peek-click-transfer／micro-flick，**佔 roster 大多數**）沒有。後者唯一的時間上限是 `timing.timeLimitMs = 120 000` 的後援閘，實際多在 20–40 秒結束 ⇒ 顯示「還剩 118 秒」會誤導。
   使用者 2026-09-11 據此拍板：**只有 `timeLimit` 型倒數，`targetCount` 型維持正計時**。「全部統一倒數」與「targetCount 改顯示剩餘目標數」兩個候選均被放棄。

3. **「ESC 退出全螢幕 → 標記資料有問題」的機制已存在，但在使用者描述的情境下不會觸發。**
   [main.ts:576-584](../../../../../src/main.ts#L576-L584) → [`experimentSession.handleFullscreenChange()`](../../../../../src/display/experimentSession.ts#L61) 已在 `countdown`/`running` 期間翻 `suspect`（KI-007 / WP-20 T2）。兩個缺口：
   - **G1**：`handleFullscreenChange` 首行 `if (!active …) return`，而 `active` 只由 eligibility gate 通過後的 `enter()` 設 true ⇒ 選手測試／研究員模式的一般 drill **完全不會被標記**。
   - **G2**：Chromium 在「同時 pointer-locked + fullscreen」時，單次 ESC 只解除 Pointer Lock、全螢幕保留（需長按才退）⇒ 使用者說的「按到 ESC」實機上多半只掉 lock，`fullscreenchange` 根本不派發。
   ⇒ 判準必須改掛 **Pointer Lock 遺失**，且不得以 `experimentSession.active` 為前提。原本可能寫成「沿用既有 fullscreen 機制即可」的方案被推翻。

4. **`recorder` 不看相位。** `simStep` 末端的 `recorder?.recordTickFromState()`（[SimLoop.ts:766](../../../../../src/loop/SimLoop.ts#L766)）每 tick 無條件記錄 ⇒ 待命期會持續吃 arena。容量 `300 × (128+10) + 128 = 41 528` ⇒ 約 324 秒後 `recorderOverflow` 翻 true 並污染 `meta.suspect`。這是 FM-2 與 D-65-5 存在的理由；若沒稽核到，功能會在「受試者去倒個水」時靜默壞掉。

5. **e2e 不需要新的 dev-only 旁路。** [raw-mouse-sampling.spec.ts:60-73](../../../../../tests/e2e/raw-mouse-sampling.spec.ts#L60-L73) 已證明可用「改寫 `pointerLockElement` getter + 派發真實 `pointerlockchange`」走**生產** `PointerLock` 模組驅動取鎖。原本預留的 `?autoArm=1` dev 縫因此降為 FM-4 的**後備方案**，只在 T6 spike 失敗時才啟用。

6. **`InputSampler` 不需要新增開火閘。** 取鎖那一下的 `mousedown` 發生在 `locked === false` 時，既有的 `createInputSampler(sharedState, () => pointerLock.locked)`（[main.ts:989](../../../../../src/main.ts#L989)）本來就會丟棄它 ⇒ FR-65.5 由 D-65-1 的設計選擇**天然滿足**。這是選擇「取鎖 = arm」而非「持鎖時另認一次 mousedown」的主要理由。

### 使用者拍板事項（2026-09-11）

| # | 問題 | 決定 |
|---|---|---|
| 1 | `targetCount` drill 的 Time 卡顯示什麼 | 只有 `timeLimit` drill 倒數，其餘維持正計時 |
| 2 | 錄製中掉 Pointer Lock 怎麼處理 | 退出（全螢幕／鎖定）、**本場資料註記有問題**、建議重新測試；**drill 繼續跑到自然結束**，不中斷、不作廢 |
| 3 | Session Plan 等自動連續流程 | **每個 block 都要點左鍵**（規則只有一條，不分手動／自動路徑） |

### 凍結決策（草稿，GD-41 於 T-exit 落帳）

- **D-65-1** 解除待命的訊號 = 取得 Pointer Lock；`start()` 時若仍持鎖則先 `exitPointerLock()`。統一「未持鎖」與「連續 session 仍持鎖」兩情境為單一規則，並順帶滿足 FR-65.5。
- **D-65-2** 待命閘是 `createDrillRunner()` 的 opt-in option，不是 `SharedState` 預設值翻轉。35 個 caller 中只有 `main.ts` 需要新行為；opt-in 讓其餘 34 個零修改。被推翻的替代：`armRequested` 預設 true —— `resetAll()` 會在 `start()` 內重設它，語意自相矛盾。
- **D-65-3** `meta.validity.pointerLockLost` 採 optional-in / required-out。既有四旗標皆 required，第五欄若也 required 會讓所有既存 golden／fixture payload 整份被拒（WP-61 踩過同型的坑）。
- **D-65-4** Pointer Lock 掉鎖與 fullscreen 退出是**兩個並存構念**，不合併、不取代（C-D4：既有構念不得有第二定義）。前者管「輸入是否進得來」，後者管「顯示條件是否成立」。
- **D-65-5** 解除待命當下呼叫 `recorder.reset()`，而非在 `simStep` 對相位加閘——後者會改變 `countdown` 期間的既有錄製行為，讓所有既有匯出逐位改變。

### 編號

候選 **WP-65 / GD-41**。寫入當下：`exec-plan/README.md §2` 最大 WP = WP-63；`active/stage13/` 實際最大 = WP-64（已落 code、尚未入 §2 索引）；`DECISIONS.md` 最大 GD = GD-39；GD-40 已由 WP-64 於其 T0 佔用（尚未落帳）。依 [GD-35](../../../DECISIONS.md) ② 紀律，二號**必須於 T0 重查**；被平行 session 取用則依 [GD-15](../../../DECISIONS.md)「先採納先得」順延，不爭號。

### 規劃期 Open Questions

見 [README §1.4](README.md)。OQ-65.1～65.3 各有 README 預設值且於 T0 確認；OQ-65.4（掉鎖是否需即時 HUD 提示）為非阻塞，T-exit 依實機回饋結案。

### 已知的協議偏離（明帳）

1. **落點**：本 WP 主題屬 drill 生命週期／受試者體驗層，不屬 stage13 的原始輸入取樣主題；依使用者指示落於 `active/stage13/`，承 WP-62／63／64 先例。不改寫 stage13 §1 主敘事與 §4 相依圖。
2. **ADR-2 的既有偏離延續**：`liveFrame` 直讀 `drillRunner.phase`（[main.ts:1773](../../../../../src/main.ts#L1773)）而非走 `SharedState`，本 WP 的 `countdownRemainingMs` 沿用同一路徑。**這是延續既有偏離，不是新開的洞**；重構條件見 [README §3.2](README.md)。

---

## §T0 Entry gate（2026-09-11）

**狀態**：✅ 完成。基線全部為本 commit 的實際執行輸出，未引用其他 WP 的 progress.md 記載。

執行基準 commit：`1f0d8bc`（T0 開工）→ 期間平行 session 追加 `9e9f2ac test(wp-64): verify ad hoc tracking pilot session plans`；下列數字全部跑在 **`9e9f2ac`** 上（工作區除 T0 的暫時性 spec 外為乾淨）。

### 1. 編號重查（[GD-35](../../../DECISIONS.md) ② 紀律）

| 來源 | 當下最大值 | 證據 |
|---|---|---|
| `docs/exec-plan/README.md §2` 索引 | **WP-63** | `grep -oE 'WP-[0-9]+' docs/exec-plan/README.md \| sort -u -V \| tail` → WP-57 / 58 / 60 / 61 / 62 / **63**（WP-64 已落 code 但仍未入 §2 索引，與規劃期記載一致） |
| `docs/exec-plan/active/**/` 實際資料夾 | **WP-65**（= 本 WP 自身） | 資料夾最大為 `wp-65-drill-arming-and-countdown`；次大為 `wp-64-tracking-pilot-session-plan-drills` |
| `docs/exec-plan/DECISIONS.md` | **GD-39** | 全檔 `GD-` 提及排序後末筆 = GD-39；**GD-40 / GD-41 在 DECISIONS.md 皆零命中** |
| GD-40 佔用狀態 | **WP-64 佔用中、尚未落帳** | `wp-64/progress.md:19,86` + `wp-64/README.md:15` + `wp-64/task-checklist.md:7` |

**結論：`WP-65` / `GD-41` 維持不變，不需順延。** 全 repo 除本 WP 自身與 `active/stage13/README.md:58-59`（規劃期預告）、`wp-64/progress.md`（旁述）外，`WP-65` / `GD-41` 無其他佔用者。

### 2. 基線凍結（四項）

| 項目 | 結果 | 備註 |
|---|---|---|
| `npm run typecheck`（第 1 次） | **exit 0** | `tsc --noEmit && tsc --noEmit -p tsconfig.node.json` 兩段皆過 |
| `npm run typecheck`（第 2 次） | **exit 0** | — |
| `npx vitest run` | **exit 0** — Test Files **256 passed \| 1 skipped (257)**；Tests **3014 passed \| 2 skipped (3016)**；Duration **20.18 s** | — |
| `npm run build` | **exit 0** — 197 modules，`dist/assets/index-BkoWHlB-.js` 1 237.00 kB（gzip 352.19 kB），built in 2.23 s | 既有 >500 kB chunk 警告為既有狀態，非本 WP 引入 |
| `npx playwright test --workers=1` | **exit 0** — **108 passed / 0 failed**；Duration **19.2 min**（最慢檔 `session-orchestrator.spec.ts` 12.4 min） | 需先清空 5173，過程見 §T0.2b |

#### 2b. Playwright 基線與 5173 埠衝突（實測）

- 執行前 `.playwright-tmp/history-dev/` participant 目錄數 = **198**（`find … -name '*.json' \| wc -l` = 243）。未達「上千個」門檻，**未清理**。
- **5173 已被前一個 session 遺留的 vite dev server 佔用**（PID 26480，08:54 啟動，`node …/vite/bin/vite.js`，cwd = 本 repo）。該 server **未帶 `FPS_HISTORY_ROOT`**：`GET /api/history/health` 回 `validRunCount: 54`，與 `find data/session-history -name '*.json' \| wc -l` = **54 完全相符** ⇒ 已確認它指向**真實** `data/session-history/`，而非 `.playwright-tmp/history-dev`。
- `playwright.config.ts` 的 dev webServer 為 `reuseExistingServer: !CI` ⇒ 全量 e2e 會沿用它，history 相關 spec 會把測試 run **寫進真實研究資料夾**。這正是 [e2e-port-5173-collision] 記載的失效模式，且本次為「寫入污染」而非僅「測錯目標」。
- 處置：**先不跑全量、改以兩個 HTTP 探針確認歸屬並回報使用者**（agent 無權 kill 該 process）。使用者清空 5173 後重跑，Playwright 自行啟動 dev（`FPS_HISTORY_ROOT=.playwright-tmp/history-dev`）與 preview（`…/history-preview`）兩個 server ⇒ **基線乾淨，真實 `data/session-history/` 未被寫入**。
- 全量結果：**108 passed / 0 failed / 19.2 min**，即 **NFR-65.6 的對照基線 = 108 passed、0 failed**。
- 執行後 `.playwright-tmp/history-dev/` participant 目錄數 = **225**（執行前 198）。距 [e2e-history-root-accumulates] 記載的「上千個後轉紅」仍有餘裕，**T6 開工前再數一次**即可。

### 3. 既有匯出鍵面 digest（T5 additive 的唯一對照基準）

**權威來源（程式碼層，本 commit）**：`requireValidity()`（[metadata.ts:723-730](../../../../../src/data/metadata.ts#L723-L730)）與 `parseValidity()`（[exportPayloadSchema.ts:557-568](../../../../../src/data/exportPayloadSchema.ts#L557-L568)）**各自恰好產生四個鍵**，故 `meta.validity` 的鍵面在本 commit 為定義上的定值：

```
meta.validity keys = ["bufferOverflow", "corridorExceeded", "perfFloor", "recorderOverflow"]
```

**runtime 佐證 ①（live 路徑，真實匯出）** — `data/session-history/P001--df1e40051e/spider-shot-v3--e4ff5aaaf9/2026-09-10T08-22-17.545Z_assessment_28ae6f75e501.json`（assessment，ticks 8065 / events 213）：

```
payload keys = ["events","meta","ticks"]
meta keys (sorted, 43) = ["assessment","backend","browser","bufferOverflow","crossOriginIsolated",
  "display","displayHz","dpi","drillId","fovDeg","frames","lateEventCount","maxDrillSeconds",
  "mouseIntegration","movementModel","protocolGuard","recorderOverflow","replay","rngSeed","scene",
  "schemaVersion","sensitivity","sensitivityModel","session","sessionPlanDrillRestSeconds",
  "sessionPlanFamilyOrder","sessionPlanItemIndex","sessionPlanItems","sessionPlanMode",
  "sessionPlanRepIndex","sessionPlanRestSeconds","simHz","simToWorld","spawn","startedAt","suspect",
  "targets","unit","vStrafe","validity","weapon","weaponId","weaponSeed"]
meta.validity = {corridorExceeded:false, perfFloor:false, recorderOverflow:false, bufferOverflow:false}
meta.suspect = false · meta.recorderOverflow = false · meta.schemaVersion = 2
```

**runtime 佐證 ②（harness 路徑，本 commit 實跑）** — 真瀏覽器（Edge，`crossOriginIsolated === true`）內以 `window.__fpsTest.startDrill('counterstrafe_ad_v1')` → `runCounterStrafeRound()` → `forceExportJSON()`：

```
payload keys = ["events","meta","ticks"]
meta keys (sorted, 27) = ["backend","browser","bufferOverflow","crossOriginIsolated","displayHz",
  "drillId","fovDeg","lateEventCount","maxDrillSeconds","mouseIntegration","movementModel",
  "recorderOverflow","replay","rngSeed","schemaVersion","sensitivity","sensitivityModel","simHz",
  "simToWorld","spawn","startedAt","suspect","targets","unit","vStrafe","weapon","weaponId","weaponSeed"]
meta.validity = **不存在**（null）· meta.suspect = false · meta.schemaVersion = 2
```

> **T0 意外（T5 必讀）**：`Meta.validity` 是 **optional**，`collectMeta()` 只在呼叫端傳入 `args.validity` 時才輸出（[metadata.ts:380,429](../../../../../src/data/metadata.ts#L380)）。**只有 live 路徑（[main.ts:807](../../../../../src/main.ts#L807)）傳它；`fpsTestHarness` 不傳**（[fpsTestHarness.ts:384-456](../../../../../src/testharness/fpsTestHarness.ts#L384)）。
> ⇒ T5 若只用 `__fps` harness 匯出取證，`meta.validity.pointerLockLost` **永遠不會出現**，會誤判為「沒接上」。T5 的鍵面證據必須走 **live 匯出**（或同時斷言 harness 端仍無 `validity`，證明 additive 未外溢）。
> ⇒ 同時修正 README §2.3 的隱含假設：新旗標的「輸出必填」只在 `validity` 物件**存在時**成立；`validity` 整個物件本身仍是 optional，D-65-3 的 optional-in / required-out 描述不變。

**C-D1 佐證**：`grep -rn "validity" research/src/` 對 `corridorExceeded` / `perfFloor` / `recorderOverflow` / `bufferOverflow` **零命中**（命中者皆為無關的 `validity_level`、`real_validity` 區域變數）⇒ Python 端目前完全不讀 `meta.validity`，additive 第五欄對 `load_export()` 為零風險，與 README §2b 記載一致。

### 4. 待命期 arena 消耗實測（FM-2 對照組）

**解析前提（本 commit 讀碼確認）**：`simStep()` 末端 `recorder?.recordTickFromState(tickEndMs, state)`（[SimLoop.ts:766](../../../../../src/loop/SimLoop.ts#L766)）**不看相位**，`countdown` / `running` / `ended` 一律記錄。arena 容量 `capacityForDrill(128, 300, 128) = ceil(300 × (128+10)) + 128 = 41 528`（[DataRecorder.test.ts:12](../../../../../src/data/DataRecorder.test.ts#L12) 已釘死）⇒ 128 Hz 下 **41 528 / 128 = 324.4 s** 即填滿。

**實測**（真瀏覽器載入 app 後**不點任何東西**，每個取樣點讀正式單例 `window.__aimDebug.recorder.snapshot()` 與 `drillPhase()`）：

**Run A**（固定取樣點；drill = app 預設的 `counterstrafe_ad_v1`）：

| t (s) | `drillPhase()` | `ticks.length` | `recorderOverflow` |
|---:|---|---:|---|
| 30 | `running` | 3 872 | `false` |
| 60 | `running` | 7 710 | `false` |
| 125 | `running` | 16 031 | `false` |
| 200 | `running` | 24 529 | `false` |
| 300 | `running` | **37 331** | `false` |
| 330 | — | — | **頁面遭 vite HMR full reload，`__aimDebug` 消失，本輪中止** |

**Run B**（加 `__wp65Sentinel` 偵測 reload 後重跑）：

| t (s) | reload 過？ | `drillPhase()` | `ticks.length` | `recorderOverflow` |
|---:|---|---|---:|---|
| 30 | 是 | `running` | 3 856 | `false` |
| 300 | **是** | `running` | 12 077 | `false` |
| 320 | 否 | `running` | 14 640 | `false` |
| 330 | 否 | `running` | 15 919 | `false` |
| 345 | 否 | `running` | 17 840 | `false` |
| 360 | 否 | `running` | 19 759 | `false` |

**消耗率**（Run B 的 320→360 s 乾淨窗）：`(19 759 − 14 640) / 40 s = **127.98 ticks/s**`，與 `SIM_HZ = 128` 相符；Run A 的 200→300 s 窗為 `128.02 ticks/s`。**完全沒有任何輸入、`phase` 全程停在 `running`**（原因見下方 Surprise 3：預設 drill 無後援閘）。


**Run C**（`__wp65Sentinel` 偵測 reload、每 15 s 取樣、直到 `recorderOverflow === true` 才停；全程 `reloaded: false`，即取得一段**未被 HMR 打斷**的連續窗）：

| 取樣（每 15 s） | `drillPhase()` | `ticks.length` | `recorderOverflow` |
|---|---|---:|---|
| … | `running` | 5 800 → 38 495（每 15 s +1 923） | `false` |
| 倒數第 2 筆 | `running` | 40 420 | `false` |
| **末筆** | `running` | **41 528** | ✅ **`true`** |

**結論（FM-2 對照組成立）**：

- `ticks.length` 在 `recorderOverflow` 翻 true 的同一刻恰為 **41 528**，與 `capacityForDrill(128, 300, 128)` 的解析值**逐位相符** ⇒ arena 的確是被**閒置 tick** 填滿的，不是被輸入或事件填滿（全程 `events.length === 1`，即只有開場那一筆）。
- 觀測到的消耗率 **127.98–128.02 ticks/s**（三輪一致）⇒ 填滿時間 = `41 528 / 128 = **324.4 s ≈ 5 分 24 秒**`，與 README §0 / FM-2 的規劃期估算相符。
- ⇒ **若不做 D-65-5 的 `recorder.reset()`**：受試者在待命畫面停留超過約 **5 分半**，該場匯出的 `meta.recorderOverflow` 即為 `true`，並經 `meta.suspect` 的 OR 集合把整場標紅——資料實際有效卻被判可疑。D-65-5 成立。
- **10 分鐘的原始要求已被超額滿足**：三輪合計 > 21 分鐘實機閒置，且取得了比「10 分鐘後仍為 false／true」更有資訊量的**翻轉點本身**。

> **執行期干擾（必記）**：Run A／Run B 期間平行 session 正在編輯本 repo，vite dev 的 HMR 觸發 **full reload**，`__aimDebug` 與 recorder 一併重置 ⇒ 前兩輪都拿不到翻轉點。Run C 以 sentinel 偵測 reload 並持續輪詢才取得連續窗。**T2 的 NFR-65.4 實測（≥ 10 分鐘待命）若在 dev server 上做，必須先確認沒有平行 session 在改檔**，否則量到的是 reload 後的重新計數。

### 5. OQ 收斂（[README §1.4](README.md)）

| OQ | 狀態 |
|---|---|
| **OQ-65.1**（新旗標是否併入 `meta.suspect`） | **照 README 預設關閉：併入**。使用者未推翻；deadline 仍在 T5 開工前，屆時若改判須先改 README §2.3/§2.5 再動 T5。 |
| **OQ-65.2**（待命提示與倒數的視覺形式） | **照 README 預設關閉：畫面中央大字**，`z-index` 低於 Result dialog、高於 HUD，`pointer-events:none`。deadline 在 T3 開工前。 |
| **OQ-65.3**（restart 是否也要求重新取鎖） | **照 README 預設關閉：要求**（規劃內定，非使用者項）。[main.ts:1810](../../../../../src/main.ts#L1810) 顯示 Result 時已 `exitPointerLock()` ⇒ 與 FR-65.4 天然一致。 |
| **OQ-65.4**（掉鎖是否需即時 HUD 提示） | **照 README 預設關閉：不做**。非阻塞，T-exit 依實機回饋結案。 |

四條 OQ 皆照預設關閉，**README 無需修改**，T1 可開工。

### 6. GD-41 草稿（本體於 T-exit 入帳）

草稿五條 **D-65-1 ～ D-65-5** 已於本檔 §0「凍結決策」段落定稿，T0 重查後**內容不變**、逐條與本 commit 的程式碼實況相符：

| 草稿 | T0 佐證（本 commit 實測／讀碼） |
|---|---|
| **D-65-1**（取鎖 = arm，`start()` 前先釋鎖） | `createInputSampler(sharedState, () => pointerLock.locked)`（[main.ts:989](../../../../../src/main.ts#L989)）確認存在 ⇒ FR-65.5 天然滿足，不需新增開火閘 |
| **D-65-2**（`requireArm` 為 opt-in option） | `start()` 現行為 `resetAll(); phase = 'countdown';`（[DrillRunner.ts:172-176](../../../../../src/drill/DrillRunner.ts#L172)）；省略 option 時此三行不動 ⇒ 34 個 caller 零修改 |
| **D-65-3**（`pointerLockLost` optional-in / required-out） | `requireValidity` 四欄皆 `requireBoolean`（required），`parseValidity` 同形 ⇒ 第五欄若 required，既存 payload 整份被拒。**追加**：`validity` 物件本身為 optional（見 §T0.3 意外） |
| **D-65-4**（fullscreen suspect 不合併） | `experimentSession.handleFullscreenChange()` 首行 `if (!active …) return` 確認存在（README §0.3 G1 成立） |
| **D-65-5**（解除待命當下 `recorder.reset()`） | §T0.4 的 324.4 s 填滿門檻與實測曲線即為其量化依據 |

**入帳時機**：GD-41 本體於 T-exit 寫入 [DECISIONS.md](../../../DECISIONS.md)，承 WP-63 D-63-P6 先例；T0 只確認編號可用與草稿無需改寫。

### Surprises & Discoveries（T0）

1. **`meta.validity` 是 optional，且 harness 路徑根本不輸出它。** 見 §T0.3 的 T0 意外。影響 T5 的取證路徑選擇（必須走 live 匯出），若到 T5 才發現會白跑一輪。
2. **5173 埠上的遺留 dev server 指向真實 history root。** 見 §T0.2b。本次不只是「測到別人的 server」，而是會**寫進真實研究資料**，比 [e2e-port-5173-collision] 既有記載的失效模式更嚴重。T6 執行前必須先確認 5173 乾淨。
3. **app 的預設 drill `counterstrafe_ad_v1` 根本沒有後援閘。** [`drills/counterstrafe_ad_v1.json`](../../../../../drills/counterstrafe_ad_v1.json) 的 `timing` 只有 `{countdownMs:3000, spawnDelayMs:0}`，**無 `timeLimitMs`** ⇒ `backstopMs === undefined`，`reachedBackstop` 恆 false（[DrillRunner.ts:237-243](../../../../../src/drill/DrillRunner.ts#L237-L243)）。實測 300 s 時 `phase` 仍為 `running` 即為此故。
   ⇒ **修正 README §0.2 的敘述**：「`targetCount` 型唯一的時間上限是 `timing.timeLimitMs = 120 000` 的後援閘」對 roster 多數成立，但**對 app 開機載入的那一支不成立**。`grep -rL timeLimitMs src/drill/*_v*.ts` 另列出 `counterstrafe_free_v1`、`spider_shot_v2/v3`、`spider_shot_wide_v1`、`tracking_scene_v1`、`tracking_*_pilot_v1`（後五者為 `timeLimit` 型，由 `endCondition` 自行結束，無虞）。
   ⇒ **對本 WP 的意義**：FM-2 描述的「arena 被吃滿 → `recorderOverflow` → `meta.suspect` 恆 true」**在現行 main 上已經會發生**，不是待命閘引入的新風險——待命閘只是把觸發情境從「開著不玩」擴大到「停在待命畫面」。D-65-5 的 `recorder.reset()` 解掉待命那一段；預設 drill 無後援閘屬**既有條件**，不在 WP-65 範圍，留待另立 KI 或 WP 處理（T-exit 決定是否入 DECISIONS.md 帳）。

4. **T0 期間有平行 session 提交 `9e9f2ac`。** 基線因此跑在 `9e9f2ac` 而非開工時的 `1f0d8bc`；`docs/exec-plan/README.md`、`task-checklist.md` 等共編索引檔在 T1–T6 須留意同行衝突（[parallel-sessions-coedit-index-docs]）。

### Open Questions（T0 留給後續 task）

- **T5**：live 匯出取證需要一條能在自動化中走到「真實 Result 匯出」的路徑；現有 `__fpsTest.showResult()` 走的是 harness payload（無 `validity`）。T5 開工時需先決定取證方式（live drill 手動實測 vs. 新增 live 匯出 e2e 縫），並在 T5 的 progress 段落記錄選擇與理由。
- **T6**：全量 Playwright 基線若在 T0 未取得，T6 的 NFR-65.6（「通過數 ≥ 本 WP 前基線」）必須在改動任何 e2e 之前先補一次乾淨基線，否則該 NFR 無對照。
