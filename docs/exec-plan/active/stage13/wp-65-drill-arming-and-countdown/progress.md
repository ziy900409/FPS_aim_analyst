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

---

## §T1 `'armed'` 相位、`armRequested` 與 `countdownRemainingMs`（2026-09-11）

**狀態**：✅ 完成。sim 層待命閘落地，`requireArm` 省略時行為逐位不變（由 `tests/regression/` 零修改全綠佐證）。

執行基準 commit：`63d3187`（T0 落帳）。工作區另有平行 session 的未提交索引檔改動（`docs/exec-plan/README.md`、`DECISIONS.md`、stage13 `README.md`、wp-64 三檔、`graphify-out/`），**本切片未觸碰、未 stage**（[parallel-sessions-coedit-index-docs]）。

### 1. 落地內容

| 檔案 | 改動 |
|---|---|
| `src/state/SharedState.ts` | 新增 `armRequested: boolean`（input 寫 / sim 唯讀，ADR-2）；`createSharedState()` 初始 `false`；`resetState()` **原地**歸零（不 realloc，GC 紀律 §4）。`validity` 本切片**未動**（`pointerLockLostDuringRun` 屬 T5，避免一個切片混入兩個構念） |
| `src/drill/DrillRunner.ts` | `DrillPhase` 擴為五成員；新增 `DrillRunnerOptions { requireArm? }`；`createDrillRunner` 第三參數 optional；`start()` 依 `requireArm` 二選一；`tick()` 新增 `'armed'` 分支；新增 `countdownRemainingMs` getter 與 `lastTickMs` 內部游標（`resetAll()` 歸零） |
| `src/main.ts` | **僅** 5 行純轉發 getter（見下方「協議偏離」） |
| `src/drill/DrillRunner.test.ts` | +7 測試（FM-1 反證 ×2、待命滯留、污染反證、解除→running、restart、`countdownRemainingMs` 四相位 + 單調） |
| `src/loop/__tests__/wp65-arm-determinism.test.ts` | **新檔**，+3 測試（跨 4 種 render 幀序列逐位一致、倒數起算點、不解除的反向釘死） |
| `src/testharness/fpsTestHarness.test.ts` | +1 測試（FM-1 第二道防線） |

### 2. `DrillPhase` 消費點清單與 `'armed'` 的落點（FM-6 窮舉檢查）

全 repo `DrillPhase` / `drillRunner.phase` 的消費點共 **7 處**，**無任何 `switch`**（故不存在「漏掉一個 case 靜默走 default」的形態；窮舉性由 `tsc` 對 union 的賦值檢查保證）：

| # | 位置 | 形態 | `'armed'` 如何落 | 本切片是否需改 |
|---|---|---|---|---|
| 1 | `DrillRunner.ts` `tick()` 首行 guard | `phase === 'idle' \|\| 'ended' \|\| config === null` | 落在外 → 續往下 | 是（新增 `'armed'` 分支於其後） |
| 2 | `DrillRunner.ts` `if (phase === 'countdown')` | if-chain | 解除後同 tick 落入 | 是 |
| 3 | `DrillRunner.ts` `if (phase === 'running')` | if-chain | 待命期永不到達 | 否 |
| 4 | `HUD.ts` `HUDStats.phase` / `createHUDStats()` | **僅型別搬運，零分支** | 原樣存入，不影響呈現 | 否 |
| 5 | `main.ts:581` `recording = 'countdown' \|\| 'running'` | 錄製判準（KI-007 / WP-60 `pointer_lock`） | **落在外** ⇒ 待命期的掉鎖不被視為錄製中 —— 這正是 **FR-65.12 要的語意**，T5 可直接沿用此判準 | 否 |
| 6 | `main.ts:1519` `phase === 'ended'`（研究者控制項） | 相等比較 | 落在外 | 否 |
| 7 | `main.ts:1777` `phase === 'countdown' \|\| 'idle'`（`hudElapsedMs` 歸零） | if-chain 的 else-if | **落在外** ⇒ `'armed'` 期間 `hudElapsedMs` 保留前值而非歸零 | 否（`requireArm` 未啟用 ⇒ 現行不可達；**T4 必須補此分支**，見下方 OQ） |

`main.ts:1808` 的 `phase === 'ended'`（Result 顯示）同樣落在外，無需處理。

### 3. 驗證證據（全部為本切片實際執行輸出）

| 項目 | 結果 | 對照 T0 基線 |
|---|---|---|
| `npm run typecheck`（×2） | **exit 0 / exit 0** | 同 |
| `npx vitest run tests/regression` | **exit 0** — 31 files / **292 passed**，**fixture 零修改**（`git status -- tests/` 為空） | NFR-65.2 ✅ |
| `npx vitest run`（全量） | **exit 0** — Test Files **257 passed / 1 skipped (258)**；Tests **3025 passed / 2 skipped (3027)**；40.03 s | T0 = 256 files / 3014 tests ⇒ **+1 file、+11 tests**，逐條對得上：DrillRunner +7、wp65-arm-determinism +3（新檔）、fpsTestHarness +1。**零測試由綠轉紅** |
| `git diff --stat -- src/ tests/` | 5 檔改動 + 1 新檔；`tests/` 目錄**零改動** | — |

`src/drill/DrillRunner.test.ts` 單檔 33 → **40 tests**。

### 4. Decision Log

| # | 決策 | 理由 / 被推翻的替代方案 |
|---|---|---|
| **T1-a** | `lastTickMs = nowMs` 置於 `tick()` **最前面**（早於 idle/ended guard），而非只在 countdown 分支內更新 | 單一賦值點，不必在三個分支各維護一次；因 getter 在 `phase !== 'countdown'` 時一律回 0，提前賦值對外**不可觀測**。被推翻：只在 countdown 分支更新——會讓「解除待命同 tick」的首次讀取取到 stale 值 |
| **T1-b** | 解除待命後**同 tick** 落入 countdown 區塊並起算倒數 | 比照既有 `countdown → running` 的同 tick 落入寫法（`DrillRunner.ts` 既有註解明寫「不浪費一個 tick」），不另立慣例。被推翻：`return` 後等下一 tick——多一個 tick 的相位延遲，且與既有寫法不一致 |
| **T1-c** | 決定性測試把「解除」釘在 **tick index**（經 `afterTick` 寫入）而非 sim 時間或幀數 | 待命閘的決定性風險正是「解除時點綁在 render 幀上」；以 tick index 為條件才真正證明跨 FPS 一致。並加一條**反向釘死**（不解除 → 4 種幀序列全停 `armed`、零 visible 事件），避免「一致地什麼都沒發生」的假綠燈 |
| **T1-d** | `countdownRemainingMs` 在 `armed` 相位回 **0** 而非 `countdownMs` | 待命期倒數**尚未起算**，回 `countdownMs` 會讓 T3 的 overlay 無從區分「待命」與「倒數第 3 秒」，且等同洩漏一個不存在的量測值。T3 以 `phase` 決定顯示提示或數字 |

### 5. Surprises & Discoveries（T1）

1. **`main.ts` 對 `DrillRunner` 包了一層以介面型別宣告的轉發 façade，規劃期未記錄。**
   `src/main.ts:1019` 是 `const drillRunner: DrillRunner = { start, tick, restart, get phase }`（為了支援換 drill 時抽換 `activeDrillRunner`）。⇒ 只要在 `DrillRunner` 介面新增**必填**成員，`tsc` 就會報 `TS2741: Property 'countdownRemainingMs' is missing`，**`main.ts` 零修改在型別上不可能成立**。
   **證據**：`npm run typecheck` → `src/main.ts(1021,7): error TS2741`。
   **處置**：見下方「協議偏離」。**對後續 task 的意義**：T2 接 `requireArm` 時要改的是 `createDrillRunner(...)` 的**三個**建構點（`main.ts:1008` 初始 + `main.ts:352` 附近的換 drill 重建 + harness 不改），而不是這個 façade。

2. **`fpsTestHarness.startDrill()` 返回時相位已是 `running`，不是 `countdown`。**
   `startDrillWithScene()` 內部 `while (drillRunner.phase !== 'running' || activeTarget() === undefined)` 會先泵完倒數（`fpsTestHarness.ts:370`）。原本按 T1 doc 寫的 `expect(phase()).toBe('countdown')` 因此紅了一次。
   ⇒ 修正後的斷言其實**更強**：「不設任何 `armRequested` 就泵到 `running`」直接證明待命閘未洩漏；若洩漏，該 while 迴圈會撞到 4000 次 guard 上限而非默默通過。

3. **`main.ts:1777` 的 `hudElapsedMs` 歸零分支把 `'armed'` 漏在外面**（見 §T1.2 第 7 列）。本切片不可達（`requireArm` 未啟用），但 T4 若只改 Time 卡的倒數顯示而不補這個分支，`'armed'` 期間 `hudElapsedMs` 會保留**上一場**的值 ⇒ 待命畫面的 Time 卡顯示前一場的殘留時間，正好違反 **FR-65.8**「不得閃動或提早歸零」。已列入 T4 的 OQ。

### 6. 已知的協議偏離（明帳）

**T1 doc 的 Invariant「`src/main.ts` 本切片零修改」與 README §2.3 的介面契約（`countdownRemainingMs` 為 `readonly` 必填）在型別上互斥**（Surprise 1）。

- **選擇**：保留 §2.3 的必填契約，在 `main.ts` 補 **5 行純轉發 getter**（含註解 2 行，實體 3 行）。
- **被推翻的替代**：把 `countdownRemainingMs` 改為 optional。會讓 T3／T4 的每個讀取點都得寫 `?? 0`，並把「render 一定讀得到剩餘倒數」這個契約從型別退化成慣例——為了一條文件字面而永久弱化介面，代價不對等。
- **FM-1 的保護未被削弱**：該 getter **不傳 `requireArm`**，`main.ts` 的 `createDrillRunner` 呼叫維持兩參數，app 行為逐位不變。
- **證據**：`git diff -- src/main.ts` 全部內容即該 getter 五行，無其他 hunk。
- ⇒ T1 DoD 最後一條「`git diff --stat` 顯示 `src/main.ts` 零改動」**未達成**，改以「`src/main.ts` 的 diff 僅含一個純轉發 getter、且不含 `requireArm`」替代，理由如上。

### Open Questions（T1 留給後續 task）

- **T4（新增，來自 Surprise 3）**：`main.ts:1777` 的 `hudElapsedMs` 歸零 if-chain 必須把 `'armed'` 納入（與 `'countdown'`／`'idle'` 同組），否則待命畫面的 Time 卡會顯示上一場殘留值，違反 FR-65.8。T4 開工時一併處理並具名斷言。
- **T2**：`createDrillRunner` 在 `main.ts` 有**兩個**建構點（初始建構 + 換 drill 時重建），`requireArm: true` 必須兩處都傳，否則「換 drill 後不需取鎖」會成為靜默漏洞。T2 須具名斷言五條路徑（restart／換武器／換場景／換 drill／Session Plan block）皆進 `armed`。

## §T2 App 接線：取鎖解除待命、`start()` 前釋鎖、arena 歸零（2026-09-11）

**狀態**：✅ 完成。待命閘已接上真實 app，五條 start 路徑（restart／換武器／換場景／換 drill／Session Plan block）全部實測回到待命並要求一次新的取鎖。

執行基準 commit：`7b98d3e`（T1 落地）。工作區另有平行 session 的 `graphify-out/` 未提交改動，**本切片未觸碰、未 stage**（[parallel-sessions-coedit-index-docs]）。

### 1. 落地內容

| 檔案 | 改動 |
|---|---|
| `src/main.ts` | ① `requireArm: true` 傳入 **三個** `activeDrillRunner` 建構點；② `drillRunner` façade 的 `start()` 內於 `activeDrillRunner.start()` **之前** 清 `armRequested` + 釋鎖；③ 新增 `armOnPointerLock()` 訂閱者（取鎖 → `recorder.reset()` + `hudRunStartMs = null` + `armRequested = true`），並在掛上當下補呼叫一次 |
| `src/input/InputSampler.test.ts` | +1 測試：FR-65.5 的具名斷言（整個取鎖手勢序列零 fire 事件）。**`InputSampler.ts` 本體零修改** |

### 2. Invariants 實測（`git diff --stat` 為空 = 成立）

`src/input/PointerLock.ts`、`src/input/InputSampler.ts`、`src/loop/SimLoop.ts`、`src/drill/DrillRunner.ts`、`src/target/TargetManager.ts`、`src/display/experimentSession.ts`、`research/` **七者 diff 皆為空**。`drillRunner.start()` 的四條呼叫端**呼叫點未改**，只改被呼叫的 façade 實作。

### 3. 三個建構點（**T2 doc 與 T1 OQ 都少算了一個**）

T2 doc 步驟 1 與 T1 的 Open Question 都寫「兩個建構點」。實際為 **三個**：

| # | 位置 | 路徑 |
|---|---|---|
| 1 | `main.ts:1017` | 初始建構 |
| 2 | `main.ts:1454` | `activateDrill()` —— 換 drill／**Session Plan 的每個 block** |
| 3 | `main.ts:1496` | `loadSceneById()` —— 換場景 |

漏掉第 2 個會讓「換 drill 與 Session Plan 的每個 block 都不需點擊」成為靜默漏洞——正是使用者 2026-09-11 拍板第三條要擋的情境。⇒ T2 DoD 第一條「`git grep -n "requireArm" src/main.ts` 回兩處」**改為回三處**（外加一行說明註解）。

### 4. Decision Log

| # | 決策 | 理由 / 被推翻的替代方案 |
|---|---|---|
| **T2-a** | `armOnPointerLock` 訂閱者掛在 `resetRunPresentation()` **之後**（`main.ts:1346`），而非 T2 doc 指定的 `main.ts:991` 附近 | `hudRunStartMs` 是宣告於 `main.ts:1301` 的 `let`，而本檔 `main.ts:1112-1113` 有 **dev-only top-level await**（`measureDisplayHz`，約 10 幀）。掛在 991 時，受試者若在該 await 視窗內點擊取鎖，callback 會對尚在 TDZ 的 `hudRunStartMs` 賦值 → `ReferenceError`。此為 KI-013／WP-54 boot barrier 同型的既有危害，不是新風險，但新訂閱者必須避開。被推翻的替代：維持 991 但改用 `resetRunPresentation()` 代替兩行——T2 doc 步驟 6 已明確禁止（時機不同，見 T2-c） |
| **T2-b** | 掛上訂閱者後**立即以當下 `pointerLock.locked` 補呼叫一次** | T2-a 把註冊點往後移，就打開了「鎖在註冊前就取得」的視窗（同一個 dev await）。沒有這行，那一場會永遠停在待命——把一個 TDZ crash 換成一個更難察覺的靜默卡死。補呼叫走**同一個函式**、同一條規則，不是特例分支 |
| **T2-c** | `recorder.reset()` 放在 arm 當下，**不**併入 `resetRunPresentation()` | 兩者時機不同：`resetRunPresentation()` 在 `start()` **之前**跑，那時待命期的 tick 尚未產生；併過去等於在錯的時點清一次，待命期照樣從零重新堆積 324 s 後溢位。實測見 §T2.6（NFR-65.4） |
| **T2-d** | 顯式 `sharedState.armRequested = false`，不只依賴 `resetState()` | `resetState()` 確實會清（T1 已驗），但「每場都要一次新手勢」這條語意寫在 `main.ts` 本地才讀得到，不必回頭追 `DrillRunner` 內部。成本 = 一行；收益 = 該不變式在它被依賴的地方可見 |

### 5. 步驟 5／6 的檢視結論（T2 doc 要求記錄）

- **步驟 2 的順序為何不觸發 T5 旗標**（FM-3）：釋鎖發生在 `activeDrillRunner.start(config)` **之前**，此刻 phase 必為 `'idle'`——四條路徑都先呼叫 `drillRunner.restart()`（`activateDrill`／`loadSceneById` 另外重建 runner，新 runner 亦為 `'idle'`），初次則是建構後尚未 `start()`。T5 的偵測條件是 `phase === 'countdown' || 'running'` ⇒ 本處主動釋鎖恆不滿足，不會誤標。**T1 §2 第 5 列已確認 `main.ts:581` 的 `recording` 判準（`countdown`/`running`）把 `'armed'` 排除在外，T5 可直接沿用同一判準。**
- **步驟 5 `syncControlsVisibility()`**：判準 `!pointerLock.locked || phase === 'ended'` **無需修改**。待命相位恆為未取鎖 ⇒ 研究員 Controls 會顯示，這是想要的（受試者待命時可換 drill），實測五條路徑皆 `locked=false` 且 Controls 可操作。
- **步驟 6 `resetRunPresentation()`**：確認**不**把 arm 時的兩行併入，理由見 T2-c。

### 6. 驗證證據（全部為本切片實際執行輸出）

#### 6a. 靜態與單元

| 項目 | 結果 | 對照 |
|---|---|---|
| `npm run typecheck`（×2） | **exit 0 / exit 0** | 同 T1 |
| `npx vitest run`（全量） | **exit 0** — Test Files **257 passed / 1 skipped (258)**；Tests **3026 passed / 2 skipped (3028)**；19.62 s | T1 = 257 files / 3025 tests ⇒ **+1 test**（InputSampler 的 FR-65.5 斷言），**零測試由綠轉紅** |
| `git diff --stat -- src/ tests/ research/` | `src/main.ts` +42/−5、`src/input/InputSampler.test.ts` +19 | 兩檔，其餘為空 |

#### 6b. 實機（dev server，真瀏覽器 Chromium，生產 `PointerLock` 模組）

> 全程以 `.playwright-tmp/wp65-t2-history` 為 `FPS_HISTORY_ROOT`；執行前探針確認 5173 淨空、`validRunCount: 0` ⇒ 真實 `data/session-history/` **未被寫入**（[e2e-port-5173-collision]）。每輪帶 `__wp65Sentinel`，全部回報 `sentinel: true` ⇒ 無 HMR full reload 污染（[hmr-reload-resets-long-idle-measurements]）。

**待命不自走**（DoD 第 2 條）：開機 `phase = 'armed'`；不點任何東西 3 s 後仍 `armed`、`armRequested=false`、`visible` 事件 **0**、HUD Time 停在 `00:00.0`。recorder ticks 仍 0 → 319 累加（`recordTickFromState` 不看相位，正是 D-65-5 的理由）。

**倒數 3 秒**（DoD 第 3 條）：以 `ticks[0].t`（arm 當下 `recorder.reset()` 後的第一個 tick）→ 首個 `visible` 事件 `t`，**同一時鐘域（sim clock）**量測，n=6：

```
rep 1..6 sim span = 3000.000 ms（六輪逐位相同）
mean=3000.000  min=3000.000  max=3000.000  |span − 3000| max = 0.000 ms
```

> **量測方法的坑（必記）**：第一版用 `performance.now()`（wall clock）蓋取鎖時刻、再減 `visible` 事件的 `t`（**sim clock**），得到 2789–2914 ms，看似「倒數短少約 100–200 ms」。那是**跨時鐘域相減**的假象——sim clock 以固定 tick 推進並在 headless 下累積 catch-up 落後，兩者原點不同且差值隨時間漂移（實測 2789→2914 ms 單調漂移即為證據）。改為同域量測後為逐位精確的 3000.000 ms。**T6 的 e2e 斷言必須同域量測**，否則會寫出一條會隨機器負載飄紅的假斷言。

**五條 start 路徑**（DoD 第 4/5 條 + 使用者拍板第三條）：

| 路徑 | 結果 |
|---|---|
| 換武器（`Weapon` → m4a4） | `phase=armed, locked=false, armRequested=false` |
| 換場景（`Scene` → field-low） | `phase=armed, locked=false, armRequested=false` |
| 換 drill（`Load` → tracking_v1） | `phase=armed, locked=false, armRequested=false` |
| Restart（Controls） | `phase=armed, locked=false, armRequested=false` |
| Result → **再測目前 Drill** | `phase=armed, locked=false, armRequested=false`，recorder ticks 8081 → 180（`resetRunPresentation` 生效）；**+3 s 不點擊仍 armed**；補一次點擊 → `countdown` |
| Session Plan（custom，2 item ×1 rep） | 兩個 block **各自**停在 `armed`、等 2.5 s 仍 `armed`（`armRequested=false`），各需一次新點擊才 `countdown`；`item=0 tracking_scene_v1`、`item=1 spider-shot-wide-v1`，plan 最終 `done` |

Session Plan 走既有的 WP-58 T6 縫 `__fpsTest.startSessionPlanWithoutGate()`（資格閘在自動化下不可能通過，該縫仍跑真閘、只跳過拒入，不偽造通過——[eligibility-gate-blocks-automation]）。

**FR-65.5**（DoD 第 6 條）：spider-shot-v2 完整 60 s live run、受試者全程未開火 ⇒ 匯出 recorder 的 `type === 'fire'` 事件 **0 筆**（`ticks=8081, visibleEvents=1`）。單元側另有具名斷言（見 §T2.7）。

**NFR-65.4 / FM-2**（DoD 第 7 條）：見下方 §6c。

#### 6c. NFR-65.4：≥ 10 分鐘待命後的 arena

**實測**（dev server，真瀏覽器；以 route-block `/@vite/client` 關閉 HMR，理由見 Surprise 7）：

| t (s) | `drillPhase()` | `ticks.length` | `recorderOverflow` |
|---:|---|---:|---|
| 0 | `armed` | 334 | `false` |
| 301 | `armed` | 38 776 | `false` |
| **331** | `armed` | **41 528** | ✅ **`true`** |
| 662（= 11 分 2 秒） | `armed` | 41 528 | `true` |

- 全程 `sentinel: true` ⇒ **無 HMR full reload 污染**，662 s 為單一連續待命窗。
- `ticks` 在 +331 s 停在 **41 528** 並翻 `overflow`，與 `capacityForDrill(128, 300, 128)` 及 T0 §4 的翻轉點**逐位相符**（消耗率 ≈ 128 ticks/s）。
- **取鎖 arm 當下** → `recorder.reset()` ⇒ ticks `41 528 → 66`、`recorderOverflow` **`true → false`**。
- 該場 spider-shot-v2 跑到自然結束（60 s timeLimit）：ticks **8 079**、**`meta.recorderOverflow === false`** ✅。

> **D-65-5 是承重的，不是防禦性的**：本輪在 arm 之前 `recorderOverflow` 已**確實**為 `true`。若不做 arm 當下的 `recorder.reset()`，這場資料完全有效的 run 會被 `recorderOverflow` → `meta.suspect` 的 OR 集合整場標紅。FM-2 不是假想風險，實測 5 分 31 秒即觸發。

### 7. FR-65.5 的具名單元斷言

`src/input/InputSampler.test.ts` 新增一條，釘死的是**整個取鎖手勢序列**而非單一事件：未鎖定時 `mousedown`（取鎖那一下）→ `locked = true`（`pointerlockchange` 成立）→ 已鎖定時 `mouseup`。結果 `state.input.size() === 0`、`bufferOverflow === 0`，其後一次真開火仍照常採計。

為什麼要釘整個序列：擋住 down 的是 `isLocked` 閘門，但擋住 up 的**不是**閘門——`onMouseUp` 刻意不受閘門限制（stuck-fire 防護），真正擋住它的是 `fireButtonHeld` latch（down 未被採計 ⇒ latch 為 false ⇒ up 直接 return）。只斷言「未鎖定時 down 不採計」會漏掉 up 這半條，而 arm 手勢的 up **必然**落在鎖定成立之後。

### 8. Surprises & Discoveries（T2）

1. **`createDrillRunner` 在 `main.ts` 有三個建構點，不是兩個。** T2 doc 步驟 1 與 T1 的 OQ 都寫兩個，漏掉 `activateDrill()`（`main.ts:1454`）——而那正是換 drill 與 **Session Plan 每個 block** 的路徑。若照文件只改兩處，使用者拍板第三條會靜默失效，且單元測試抓不到（`main.ts` 不在單元測試覆蓋內）。實測五條路徑才是抓到它的原因。
2. **新訂閱者不能掛在 T2 doc 指定的 `main.ts:991`。** `hudRunStartMs`（`let`，宣告於 1301）與 dev-only top-level await（1112-1113）之間存在 TDZ 視窗。見 T2-a／T2-b。
3. **真實 Pointer Lock 在 headless Chromium 可以取得。** 以 Playwright 的 trusted `canvas.click()` 實測 `pointerLock.locked === true`，全部實機證據皆走**真鎖**，未用 `pointerLockElement` getter 覆寫。⇒ **README FM-4 的前提「Chromium headless 無法真正取得 Pointer Lock」在本環境不成立**，T6 的第一步 spike 可能比規劃期預期簡單；但 T6 仍須自行複驗（不同 Playwright 啟動參數／CI 環境可能不同），本結論只覆蓋「headless Chromium + trusted click + 同源 canvas」。
4. **跨時鐘域相減會製造「倒數短少 100–200 ms」的假象。** 見 §6b 的量測方法坑。這是 T6 寫斷言時最容易踩的形態——數字看起來夠接近 3000，會被當成「量到了」而寫進一條隨負載飄紅的斷言。
5. **Result 畫面的動作按鈕在研究員模式下被 `#drill-controls` 蓋住。** `phase === 'ended'` 時 `syncControlsVisibility()` 讓 Controls 顯示，與 Result dialog 同時在畫面上；hit-test 顯示「再測目前 Drill」按鈕中心點的 topmost element 是 `#drill-controls`。**此為既有條件**（該判準本 WP 未改，`'ended'` 一直會顯示 Controls），非 T2 引入，也不在 T2 範圍；但 T3 要放畫面中央大字 overlay 時會面對同一個 z-index 家族，**建議 T3 一併處理**（OQ-65.2 已指定 overlay `z-index` 低於 Result dialog、高於 HUD，需確認 Controls 的落點）。
6. **`再測目前 Drill` 走 `window.confirm()`。** 自動化預設會 auto-dismiss ⇒ 不處理 dialog 時該按鈕看起來「沒反應」（phase 仍 `ended`、`armRequested` 仍為前一場的 true），極易被誤判為待命閘壞掉。T6 若要覆蓋這條路徑，必須註冊 dialog handler。

7. **平行 session 正在編輯本 repo，vite HMR 會靜默作廢長時量測。** 第一輪 11 分鐘 soak 在 +602 s 遭 full reload（`sentinel: false`、ticks 由 41 528 歸零重數），且 reload 後 drill 退回預設的 `counterstrafe_ad_v1`——該 drill **無後援閘**（T0 Surprise 3），於是後續「等 drill 自然結束」永遠等不到，錯誤表現為 timeout 而非「量到錯的數字」。處置：以 Playwright `page.route('**/@vite/client', abort)` 關掉 HMR client（只停 HMR，app 模組圖照常載入），並加一條「arm 當下 drill 必須仍是 spider-shot-v2」的守門斷言，讓漂移**大聲失敗**而不是掛住。第二輪即取得乾淨的 662 s 連續窗。
   ⇒ **對 T6 的意義**：任何跨越數分鐘的 live e2e 都該封掉 HMR client，否則在有人平行開發時會間歇性紅、且紅的樣子（timeout）與真 bug 難以區分。[hmr-reload-resets-long-idle-measurements] 記載的失效模式在此再度成立，本次並多出「reload 後 drill 身分漂移」這一層。

### Open Questions（T2 留給後續 task）

- **T3（來自 Surprise 5）**：待命提示／倒數 overlay 的 `z-index` 需與 `#drill-controls`（研究員 Controls）一併確認，而不只是與 Result dialog 和 HUD 比較。`'ended'` + 研究員模式下三者會同時在畫面上。
- **T6（來自 Surprise 3/4）**：① 真鎖在本環境可用 ⇒ FM-4 的後備 `?autoArm=1` 縫大機率不需要，但仍須在 T6 自行複驗；② 任何「3 秒倒數」的 e2e 斷言必須在 sim clock 單域內量測（`ticks[0].t` → 首個 `visible.t`），不得混用 `performance.now()`。
- **T5**：本切片已確認 `armOnPointerLock` 與 T5 的掉鎖偵測會共用同一個 `pointerLock.onChange` 管道；T5 新增偵測時應**再新增一個訂閱者**（比照本切片），不要改寫 `armOnPointerLock`——兩者條件互斥（`armed` vs `countdown`/`running`），合併只會讓兩個構念糾纏。

---

## §T3 待命提示與倒數數字 overlay（2026-09-11）

**狀態**：✅ 完成。倒數自此**看得見**：待命顯示「點擊左鍵開始」，倒數顯示 3 → 2 → 1，`running` 起隱藏。

執行基準 commit：`7b98d3e`（T1）起工；期間平行 session 提交 `45cec7f`（T2），詳見下方「協議偏離」。

### 1. 落地內容

| 檔案 | 改動 |
|---|---|
| `src/ui/DrillStartOverlay.ts` | **新檔**。`createDrillStartOverlay()` → 單一 `<section id="drill-start-overlay">` + 兩個建構期預建文字節點（提示行／數字行）。`update(phase, countdownRemainingMs)` 三分支；`dispose()` 移除根節點 |
| `src/ui/DrillStartOverlay.test.ts` | **新檔**，16 條（三分支 + 四邊界 + 3→2→1 單調 + 版面防撞 + `pointer-events:none` + 分層 + 無配置 + dispose） |
| `src/main.ts` | 三段接線：import、`createHUD()` 旁建構、`liveFrame` 內緊鄰 `hud.update()` 的一行 `update()`。**此三段已被平行 session 併入 `45cec7f`**（見協議偏離），故本切片的 `main.ts` diff 為空 |
| `assets/t3-*.png` | 實機截圖四張（待命／倒數 3／倒數 1／running 隱藏） |

`src/ui/HUD.ts` 本切片**零修改**（Time 卡屬 T4），既有 overlay 的 `z-index` 亦一個未動（Invariant 達成）。

### 2. 採用的 `z-index` = **22**，與理由

T3 doc 建議 30，**未採用**：`#result-screen` 正是 30，同值時由 DOM 順序決勝，等於把分層交給建構次序的偶然。實際落 **22**，取「HUD 與 rest backdrop 之上、Result dialog 與 Controls 之下」的空隙：

| overlay | z-index | 與本 overlay 的關係 |
|---|---:|---|
| `#lock-hint` | 10 | 之下 |
| `#metrics-hud` | 18 | **之下** —— 提示不得被 HUD 壓住 |
| `#rest-overlay` | 20 | **之下** —— 休息 backdrop 是半透明灰幕，壓在提示上會讓提示變灰 |
| **`#drill-start-overlay`** | **22** | — |
| `#result-screen` | 30 | **之上** —— 結果頁必須蓋過本 overlay |
| `#drill-controls` | 32 | **之上** |

實機 `getComputedStyle` 實測回值：overlay 22 / hud 18 / rest 20 / result 30 / controls 32，五者關係全部成立。**這同時關掉 T2 Surprise 5 留給 T3 的 OQ**（「需與 `#drill-controls` 一併確認，而不只是 Result dialog 與 HUD」）：22 < 32，`'ended'` + 研究員模式下 Controls 仍蓋過本 overlay。

### 3. `Math.ceil` 對 0 的處理：採 `Math.max(1, Math.ceil(ms / 1000))`

T3 doc 允許兩種寫法，此處採 clamp 版，理由是 **clamp 對真實倒數是 no-op，只擋一個會說錯話的退化窗**：

- `DrillRunner` 在 `nowMs - countdownStartMs >= countdownMs` 當下即轉 `running` ⇒ `countdown` 期間剩餘值**恆 > 0**，3000 → `3`、1 → `1`，clamp 不改變任何真實顯示值。
- 唯一會回 0 的是 `countdownStartMs === null`（相位已是 `countdown`、首個 sim tick 尚未跑）。此時顯示「0」會被讀成「倒數已結束」——恰好在它**還沒開始**的那一刻。
- `requireArm` 路徑下相位轉換與倒數起算同在一個 tick，該窗**不可達**；仍 clamp 是因為 overlay 不該依賴呼叫端的相位來源（它只是個呈現元件）。

### 4. 實機證據（Edge，dev server 5173，1280×800）

截圖四張於 [`assets/`](assets/)：

| 檔 | 內容 |
|---|---|
| [`t3-armed.png`](assets/t3-armed.png) | 待命：中線下方「點擊左鍵開始」，上方為既有 `#lock-hint` |
| [`t3-countdown-3.png`](assets/t3-countdown-3.png) | 倒數：置中「準備」+ 大字 `3` |
| [`t3-countdown-1.png`](assets/t3-countdown-1.png) | 倒數：大字 `1` |
| [`t3-running.png`](assets/t3-running.png) | `running`：overlay `display:none`，畫面淨空 |

| DoD 項 | 實測 |
|---|---|
| 待命點擊可正常取鎖（`pointer-events:none` 生效，非只靠單元測試） | 畫面中心 `document.elementFromPoint()` = **`canvas#app`**（非 overlay）；於 topmost 派發 `mousedown` → canvas 的 listener **確實收到**（`reachedCanvas: true`） |
| 不遮蔽 HUD `Time` 卡 | `#metrics-hud` 佔 y ∈ [12, 95.4]；overlay 文字：待命 y ≈ 579、倒數 y ∈ [313, 486] ⇒ **無交集** |
| 不被 Controls 遮住 | z 22 < 32（見 §2） |
| `running` 後隱藏 | `display: none`、`aria-hidden: true` |
| 無 page error | `pageErrors: null` 全程 |

### 5. frameLog 對照（NFR-65.7 / DoD）

`frameLog` 未掛在 `__aimDebug` 上，且取 `meta.frames` 需跑完整場 drill。改以**同一頁面內直接取 rAF delta 序列**（12 s／約 677 幀）對照，A/B 只差 `main.ts` 的三段接線（同一 commit、同一 dev server、同一 drill、同機連續執行）：

| 條件 | 相位 | p50 | **p95** | p99 | max | >20 ms | >33 ms |
|---|---|---:|---:|---:|---:|---:|---:|
| **無 overlay** | armed | 17.760 | **18.475** | 19.720 | 248.02 | 5 | 1 |
| **有 overlay** | armed | 17.745 | **18.365** | 19.205 | 19.985 | **0** | **0** |
| **有 overlay** | running | 17.760 | 18.385 | 18.745 | 18.915 | 0 | 0 |

- **p95 差值 = −0.110 ms**（有 overlay 反而略低）⇒ 落在執行間噪音內，overlay 無可測成本。
- **未新增任何 over-budget window**：有 overlay 的兩段皆 `>20 ms` = 0、`>33 ms` = 0；無 overlay 那輪的 1 個 248 ms 離群幀屬背景干擾（該輪腳本同時在對不存在的節點輪詢 `getComputedStyle` 而持續拋錯），**不利的那一側反而是基線**，結論方向不受影響。
- 機制上也符合預期：`update()` 以快取值比對，文字／版面**只在改變時**才寫 DOM（每場至多數次），穩態每幀零 DOM 寫入、零 `String()` 配置。

### 6. 驗證證據

| 項目 | 結果 |
|---|---|
| `npx vitest run src/ui/DrillStartOverlay.test.ts` | **exit 0** — 16 passed |
| `npm run typecheck` ×2 | **exit 0 / exit 0** |
| `npx vitest run`（全量，T3 接線在位時） | **exit 0** — Test Files **258 passed / 1 skipped**；Tests **3041 passed / 2 skipped** |

對照 T1 的 257 files / 3025 tests：**+1 file、+16 tests**，逐條對得上（本切片 15 條 + 版面防撞 1 條 = 16；另 T2 的 InputSampler +1 已隨 `45cec7f` 入帳）。**零測試由綠轉紅。**

### 7. Decision Log

| # | 決策 | 理由 / 被推翻的替代方案 |
|---|---|---|
| **T3-a** | `z-index` 取 **22**，非 doc 建議的 30 | 30 = `#result-screen` 同值 ⇒ 分層由 DOM 順序決定，是偶然而非契約。被推翻：30（同值）、以及「沿用 rest-overlay 的 20」（同值於 rest backdrop，休息畫面上提示會變灰） |
| **T3-b** | 顯示秒數用 `Math.max(1, Math.ceil(…))` | clamp 對真實倒數為 no-op，只擋 `countdownStartMs === null` 的退化窗（見 §3）。被推翻：裸 `Math.ceil`——會在倒數**尚未起算**時顯示「0」，語意正好相反 |
| **T3-c** | 待命提示落**中線下方**（`flex-end` + `padding-bottom:22vh`），倒數維持置中 | 既有 `#lock-hint` 也是 `inset:0` 置中且只在未鎖定時顯示（＝待命相位），兩者置中會逐字疊字（見 §8 Surprise 1）。倒數時已持鎖、lock-hint 自行隱藏 ⇒ 數字可安心置中。被推翻：改 `#lock-hint`（既有元件，其顯示條件涵蓋非 drill 情境，超出 T3 範圍） |
| **T3-d** | `update()` 以快取值比對後才寫 DOM | NFR-65.7 只要求「不新增每幀堆配置」，但每幀重寫 `textContent` 也會每幀做一次 `String(n)` 配置。快取讓穩態每幀**零** DOM 寫入，代價是三個模組級變數 |
| **T3-e** | 單元測試沿用 repo 既有的 `FakeElement`／`FakeDocument` stub，**不**引入 jsdom | T3 doc 寫「jsdom，比照 `HUD.test.ts`／`ResultScreen.test.ts`」，但實況是 `vite.config.ts` 的 vitest 區塊**未設 `environment`**（node），`CueOverlay.test.ts`／`RestOverlay.test.ts` 皆以 stub 測 DOM 元件。為單一新檔引入 jsdom 會改動全 repo 的測試環境 |

### 8. Surprises & Discoveries（T3）

1. **待命提示與既有 `#lock-hint` 逐字疊在一起，兩句都讀不出來。**
   `#lock-hint`（`main.ts:400`，文字「點擊以鎖定滑鼠視角（Esc 解除）」）是 `inset:0` + `align-items:center` + `justify-content:center`，而它的顯示條件是**未鎖定**——正好完全涵蓋待命相位。本 overlay 初版也置中 ⇒ 首輪實機截圖是兩句話疊成一團亂碼。
   **單元測試抓不到**（stub 沒有版面），**型別也抓不到**；只有實機截圖會抓到。這是 T3 DoD 硬性要求截圖的價值所在。
   **處置**：T3-c 的版面分流 + 一條迴歸斷言（`armed` → `flex-end`/`22vh`，`countdown` → `center`/`0px`）。
   ⇒ **殘留 UX 問題（非阻塞，留給 T-exit／使用者）**：兩句話語意高度重疊（「點擊以鎖定滑鼠視角」vs「點擊左鍵開始」），實機上會同時出現、一上一下。要不要在待命相位隱藏 `#lock-hint`（或反過來只留它）是**產品決定**，且會影響非 drill 情境（Result／History 畫面下 lock-hint 也會顯示），故本切片不動它。

2. **第一版實機腳本只等 `drillPhase() === 'armed'` 就取樣，量到的是「overlay 還沒畫出來」的空窗。**
   相位在**模組求值期**（`drillRunner.start()`）就已是 `'armed'`，但 overlay 要等 `renderLoop` 的第一個 `liveFrame` 才會被 `update()`。兩者之間有一段真實存在的窗，該窗內 `#drill-start-overlay` 的 `display` 仍是初始的 `none`、文字仍為空字串。
   第二輪即因此拿到 `phase: 'armed'` + `display: 'none'` + `prompt: ''` 的自相矛盾快照，看起來像功能壞了。
   ⇒ **對 T6 的意義**：live e2e **不可**以 `drillPhase()` 當 overlay 就緒訊號，必須等 overlay 自身的 computed `display === 'flex'`（或等首幀）。只等相位會是間歇性紅的來源。

3. **`countdownRemainingMs` 的 sim→render 唯讀出口維持單一。** 全 repo 對該 getter 的讀取點仍只有 `liveFrame` 一處（`main.ts:1886`），符合 README §2.4 的明帳承諾。

### 9. 已知的協議偏離（明帳）

**T3 的 `src/main.ts` 三段接線被平行 session 的 T2 commit `45cec7f` 一併提交。**

- **事實**：本切片先寫好 `DrillStartOverlay.ts` 與 `main.ts` 的三段接線（import／建構／`liveFrame` 一行），尚未 stage；期間平行 session 完成 T2 並以整檔 stage 的方式提交 `45cec7f feat(app): require a fresh pointer lock before each drill starts`，把 T3 的 8 行一併帶入。
- **後果**：`45cec7f` 當下的 tree **無法建置**——`main.ts` import 了尚未入 repo 的 `./ui/DrillStartOverlay.ts`。該狀態自本 T3 commit 起解除（新檔補上）。
- **選擇**：**不改寫 `45cec7f`**。它是另一個 session 的已發布 commit，rebase／amend 屬破壞性且會與對方的工作區打架；代價是 history 中留下一個瞬時不可建置的 commit，效益是不動他人歷史。
- **對本切片的影響**：T3 的 commit **不含** `src/main.ts`（其內容已與 HEAD 逐位相同）。`git diff -- src/main.ts` 為空即為證據。
- ⇒ **紀律修正（寫給後續 task 與平行 session）**：共編 `src/main.ts` 時**不得整檔 stage**，須逐 hunk stage（[parallel-sessions-coedit-index-docs] 記載的紀律原本只涵蓋索引文件，此次證明**程式碼檔同樣適用**，且後果更嚴重——索引檔衝突會被看見，程式碼檔的誤帶會產生一個看似正常、實則不可建置的 commit）。

### Open Questions（T3 留給後續 task）

- **T4**：`main.ts` 的 `hudElapsedMs` 歸零 if-chain 仍未納入 `'armed'`（T1 Surprise 3 已列），本切片未處理——Time 卡屬 T4，且 T3 Invariant 明訂 `HUD.ts` 零修改。
- **T-exit／使用者**：待命相位同時出現「點擊以鎖定滑鼠視角（Esc 解除）」與「點擊左鍵開始」兩句語意重疊的提示（見 Surprise 1）。是否合併為一句、以及合併後 `#lock-hint` 在非 drill 情境的行為，屬產品決定。
- **T6**：live e2e 判斷 overlay 就緒必須等 computed `display`，不可只等 `drillPhase()`（見 Surprise 2）。

---

## §T4 HUD `Time` 卡的時限型倒數（2026-09-11）

**狀態**：✅ 完成。FR-65.7 / FR-65.8 落地並以實機錄樣佐證。

執行基準 commit：`a64eb61`。

### 1. 落地內容

| 檔案 | 改動 |
|---|---|
| `src/drill/DrillConfig.ts` | **新** `resolveDrillTimeLimitMs(config)` — 純函式，`endCondition.type === 'timeLimit'` 回 `value`，否則 `undefined` |
| `src/ui/HUD.ts` | `HUDStats` 增 additive optional `timeLimitMs`；`createHUDStats()` 增**第八個**（尾端）參數；`fillHUDSummary()` 的 `timeText` 一處三元分支 |
| `src/main.ts` | ① `liveFrame` 的 `hud.update(createHUDStats(...))` 尾端補 `resolveDrillTimeLimitMs(activeDrillConfig)`；② `hudElapsedMs` 歸零的 if-chain 納入 `'armed'` |
| `src/ui/HUD.test.ts` | +6 條（零回歸三案例／FR-65.8 起始值／遞減／歸零／超時 clamp／非有限 limit／重用物件換回正計時） |
| `src/session/drillFamily.test.ts` | +41 條（38 個 roster drill 的逐一分類 + 3 條集合／完整性／後援閘斷言）；`SCHEDULABLE_DRILL_SOURCES` 的 `Pick` 擴至 `endCondition` |
| `assets/t4-*.png` | 實機截圖四張 |

`formatElapsed()`、`HUDSummary`／`HUDHandle`／`createHUD()` 簽名、`createHUDSummary()` 的預設物件、`DrillRunner.ts` 皆**零修改**（Invariants 全數達成）。

### 2. 為何讀 `endCondition` 而非 `timing.timeLimitMs`（DoD 指名記錄）

兩者是**不同的量**，只是單位都叫毫秒：

| | `endCondition.value`（`type === 'timeLimit'`） | `timing.timeLimitMs` |
|---|---|---|
| 語意 | 這場 drill **設計上的總時長** | `targetCount` 型的**後援閘**（跑太久就收） |
| roster 典型值 | 60 000（spider-shot 家族／tracking pilot） | 120 000 |
| 實際結束時機 | 就是它 | 多在 20–40 秒由 `reachedCount` 先達成 |

拿後援閘倒數，`counterstrafe` 一開場就會顯示「還剩 1:58」然後在 1:38 左右突然結束——**一個會說錯話的指標**（C-D3 的精神）。分類因此只讀 `endCondition`，且寫成單一 exported 純函式：HUD 呈現與遍歷分類測試讀的是同一個定義，而不是各算一套（C-D4）。

### 3. FR-65.8 不需要額外的相位分支

`fillHUDSummary()` 只看 `elapsedMs`：`elapsedMs === 0` 時倒數型自然顯示 `timeLimitMs`（`01:00.0`）、正計時型顯示 `00:00.0`。前提是 **`'armed'` 也要把 `hudElapsedMs` 歸零**——這正是 T1 Surprise 3 / T3 留給 T4 的那條 if-chain（`main.ts:1824`）。若漏掉，新相位會落到 `else` 之外而保留上一場殘值，倒數型甚至會在待命期顯示一個已經扣掉的剩餘值。

### 4. 實機證據（Edge，dev server 5173，1280×800）

以一次性 Playwright 腳本驅動（走**生產** `PointerLock` 模組的取鎖模擬，同 `raw-mouse-sampling.spec.ts`；腳本與其暫用 config 已於驗證後刪除，未進 repo）：

| DoD 項 | 實測 |
|---|---|
| `spider-shot-v3` 自 `01:00.0` 單調遞減至 `00:00.0`，歸零瞬間結束 | 117 個取樣（每 500 ms）：`00:59.0 → 00:58.5 → … → 00:00.5 → 00:00.0/running → 00:00.0/ended`，**無任何一筆回升**；Result 畫面於 `00:00.0` 當下出現（[`t4-ended.png`](assets/t4-ended.png)） |
| 待命期顯示起始值、不閃動、不提早歸零（FR-65.8） | `armed` 15 個取樣（每 100 ms）**全為 `01:00.0`**（[`t4-armed.png`](assets/t4-armed.png)） |
| 倒數期同上 | `countdown` 12 個取樣（每 150 ms）**全為 `01:00.0`**（[`t4-countdown.png`](assets/t4-countdown.png)） |
| `targetCount` 型零回歸 | 預設 `counterstrafe_ad_v1`：`armed`／`countdown` 皆 `00:00.0`；`running` 後 `00:00.5 → 00:05.1` 單調遞增（[`t4-countup.png`](assets/t4-countup.png)） |

> T4 doc 的實機項寫 `counterstrafe_cued_v1`，但該 drill **不在 `availableDrills`**（`drillFamily.test.ts` 另有一條斷言釘死它的 off-roster 身分），UI 選不到。改用 app 預設載入的 `counterstrafe_ad_v1`——同為 `targetCount` 型 counterstrafe，零回歸的構念相同。

### 5. 遍歷測試寫死的倒數型 drill id 集合（DoD 指名記錄）

本 WP 當下，38 個可排程 drill 中**恰 5 個**為 `timeLimit` 型（id 為 roster 註冊 id）：

```
spider-shot-v2
spider-shot-v3
spider-shot-wide-v1
tracking_core_pr_pilot_v1_2deg_5dps
tracking_reversal_pilot_v1_high
```

其餘 33 個維持正計時。這條測試同時斷言 `SCHEDULABLE_DRILL_SOURCES` 的 id 集合等於 `SCHEDULABLE_DRILL_IDS`——新 drill 若沒被列入，紅的是「名單不完整」而不是靜默預設成正計時。

### 6. 驗證證據

| 項目 | 結果 |
|---|---|
| `npx vitest run src/ui/HUD.test.ts` | **exit 0** — 9 passed（3 → 9） |
| `npx vitest run src/session/drillFamily.test.ts` | **exit 0** — 146 passed（105 → 146） |
| `npm run typecheck` ×2 | **exit 0 / exit 0** |
| `npx vitest run`（全量） | **exit 0** — Test Files **258 passed / 1 skipped**；Tests **3088 passed / 2 skipped** |

對照 T3 的 258 files / 3041 tests：**+0 file、+47 tests**（HUD 6 + drillFamily 41），逐條對得上。**零測試由綠轉紅。**

### 7. Decision Log

| # | 決策 | 理由 / 被推翻的替代方案 |
|---|---|---|
| **T4-a** | 分類寫成 `src/drill/DrillConfig.ts` 的 exported 純函式 `resolveDrillTimeLimitMs()`，`main.ts` 直接在呼叫點用它，**不**另設 `activeTimeLimitMs()` 包裝 | T4 doc 寫「在 `main.ts` 新增 `activeTimeLimitMs()`」，但步驟 5 的遍歷測試**無法 import `main.ts`**（top-level await + WebGPU + DOM），只能另寫一份同樣的三元式——那正是 C-D4 禁止的第二定義。落在 `DrillConfig.ts` 讓呈現與測試共用同一個定義；比照既有 `resolveTargetHitbox()` 的先例。單行包裝函式則是多餘的一層 |
| **T4-b** | 遍歷測試加在既有的 `src/session/drillFamily.test.ts`，而非新開檔 | 該檔已持有**唯一**一份「38 個可排程 drill 的真實 config 來源」清單（`SCHEDULABLE_DRILL_SOURCES`，WP-58 家族 + WP-62 武器兩個投影都用它）。新開檔就得複製整份清單，兩份清單遲早分岔。被推翻：`src/drill/drillTimeLimit.test.ts`（要複製 40 行 import 與 roster） |
| **T4-c** | `HUDStats.timeLimitMs` **不加 `readonly`**（README §2.3 契約寫 readonly） | `HUDStats` 是每幀重用的物件，`createHUDStats()` 對每個欄位就地賦值；`readonly` 會讓 `target.timeLimitMs = …` 編譯不過。其餘七個欄位也都不是 readonly ⇒ 維持同一慣例 |
| **T4-d** | `createHUDStats()` 的新參數為**必填**的 `number \| undefined`，非 optional | 只有一個 production 呼叫點；必填讓每個呼叫端明確表態「這個 drill 有沒有總時長」，而不是漏傳就靜默退回正計時。代價是既有測試的一處呼叫補一個 `undefined` |
| **T4-e** | `createHUDStats()` 恆賦值（含 `undefined`）而非條件式寫入 | 重用物件的 shape 保持穩定（隱藏類別不變動）；同時釘死「上一場的 limit 不會殘留到下一場」——已由一條測試覆蓋（換 drill 後 `timeLimitMs` 必須回 `undefined`） |

### 8. Surprises & Discoveries（T4）

1. **JSON drill 的 `endCondition.type` 是 `string`，擴 `Pick` 的那一刻才爆出來。**
   `SCHEDULABLE_DRILL_SOURCES` 的第一筆是 `drills/counterstrafe_ad_v1.json`（`resolveJsonModule` 直接推成 `{ type: string }`），把 `Pick` 從 `'drillId' | 'weaponId'` 擴到含 `endCondition` 後 `tsc` 立刻拒收。
   **處置**：加 `narrowJsonDrill()`——以**檢查值**收窄（非 `as` 斷言），JSON 若長出未知的 end condition 會在此**大聲失敗**而不是被硬轉成期望的形狀。
   ⇒ 這也說明 roster 中唯一未經 `loadDrill()` 驗證就被測試直接讀的來源是哪一個。

2. **`counterstrafe_cued_v1` 不在 roster，T4 doc 的實機項指到了一個 UI 選不到的 drill。** 見 §4 註。

3. **live 腳本第一個取樣可能拿到空字串。** 相位在模組求值期就是 `'armed'`，但 HUD 的 `timeValue` 要等第一個 `liveFrame` 才被寫入 ⇒ 只等 `drillPhase()` 會取到 `textContent === ''`。與 T3 Surprise 2 是**同一個**失效模式（相位先於首幀），此處再次命中。
   ⇒ **對 T6 的意義**：等待條件必須是「HUD/overlay 自身已被寫過」，`drillPhase()` 只是必要條件。

4. **倒數的第一個 running 取樣通常已是 `00:59.x` 而非 `01:00.0`。** `expect.poll` 的間隔（100→250→500 ms）讓腳本晚於相位轉換一拍取到。這是**觀測解析度**而非顯示錯誤：`countdown` 期間的 12 個取樣全為 `01:00.0`，起點正確。T6 若要斷言「起點恰為總時長」，須用 rAF 取樣或放寬到一個 poll 間隔。

### Open Questions（T4 留給後續 task）

- **T6**：本切片的實機驗證用的是一次性腳本（已刪）。正式的 live spec（含 arm helper）屬 T6；上面 §8.3／§8.4 的兩個等待條件與取樣解析度細節應直接套用。
- **T-exit**：倒數型 drill 目前 5 個。若日後 roster 新增 `timeLimit` 型 drill，`drillFamily.test.ts` 的 `COUNTDOWN_DRILL_IDS` 必須同步——這是刻意的「改了要來報到」閘，不是待辦。

---

## §T5 Pointer Lock 掉鎖的效度旗標 → `meta.validity` → Result 警示（2026-09-11）

**狀態**：✅ 完成。錄製中掉鎖會標記本場資料、併入 `meta.suspect`、在 Result 顯示重測建議；**sim 不中斷**，drill 一路跑到自然結束。

執行基準 commit：`762b166`（T4 落地 + graphify 索引）。

### 1. 落地內容

| 檔案 | 改動 |
|---|---|
| `src/state/SharedState.ts` | `validity` 增 `pointerLockLostDuringRun`（`createSharedState` 初始 false、`resetState()` 原地歸零） |
| `src/main.ts` | ① 第三個 `pointerLock.onChange` 訂閱者：`!locked && phase ∈ {countdown, running}` → 翻旗標；② `buildCurrentExportPayload()` 的 `validity` 投影補 `pointerLockLost`；③ `showResultAndTrackHistory()` 每場明確呼叫一次 `setValidityWarning()` |
| `src/data/metadata.ts` | `Meta['validity']` / `CollectMetaArgs` 增第五欄（optional-in / required-out）；`requireValidity()` 缺欄補 false；`collectMeta()` 的 `suspect` OR 併入 |
| `src/data/exportPayloadSchema.ts` | `parseValidity()` 同步 optional-in（帶欄但型別錯誤仍報錯） |
| `src/ui/ResultScreen.ts` | `setValidityWarning(text \| null)` + 建構期預建的 `role="alert"` 警示條（插在結果數值**之上**）；`show()` 一併清除（比照既有 `setHistoryTarget(undefined)`） |
| 測試 | `SharedState.test.ts`（歸零）、`metadata.test.ts` +3、`exportPayloadSchema.test.ts` +3、`ResultScreen.test.ts` +3、`export.test.ts` / `ResultPresentation.test.ts` 各補 required-out 欄位 |

### 2. Invariants 實測（`git diff --stat` 為空 = 成立）

`src/display/experimentSession.ts`、`src/drill/DrillRunner.ts`、`src/loop/SimLoop.ts`、`src/target/TargetManager.ts`、**`src/data/export.ts`**、`research/` 六者 diff 皆為空。sim 完全不知道有這個旗標。

- **步驟 5 的 `export.ts` 展開確認（T5 doc 要求記錄）**：[export.ts:33-34](../../../../../src/data/export.ts#L33-L34) 的 `{ ...meta.validity, recorderOverflow }` **已讀過並確認**展開涵蓋新欄——不是「沒改所以沒事」。`export.test.ts` 那條既有斷言補上 `pointerLockLost: false` 後仍綠，即為展開確實帶過新欄的證據。
- **`meta` 鍵集合零增減**：新欄只落在 `validity` 物件內（見 §5c 的鍵面對照）。

### 3. Decision Log

| # | 決策 | 理由 / 被推翻的替代方案 |
|---|---|---|
| **T5-a** | 偵測掛成**第三個** `pointerLock.onChange` 訂閱者，不改寫 `armOnPointerLock` | 依 T2 留下的 Open Question 執行。兩者條件互斥（`armed` vs `countdown`/`running`）、方向相反（取鎖 vs 掉鎖）、構念不同（開始手勢 vs 效度）。合併只會把兩件事糾纏在一個分支 |
| **T5-b** | 判準與 `fullscreenchange` 的 `recording` 判準**逐字相同**，不另立第二套 | C-D4：既有構念不得有第二定義。KI-007 已論證過這個窗界（`idle`/`ended` 的退出屬正常操作）。同時**不**以 `experimentSession.active` 為前提（缺口 G1） |
| **T5-c** | `resultScreen.show()` 一併把警示清成 `null`，而非只靠呼叫端每次設定 | T5 doc 只要求呼叫端每次呼叫（含 `null`）。但 `show()` 早已用 `setHistoryTarget(undefined)` 表達「這個狀態屬於**某一場**結果、不屬於這個畫面」——警示是同一類狀態。加上這行讓 `__fpsTest.showResult()` 等旁路也不會殘留上一場的警示；呼叫端的明確設定照舊保留。被推翻的替代：只靠呼叫端——那條規則正確但**不可見**，漏一個旁路就是乾淨的一場被誤標紅 |
| **T5-d** | 警示文字取自 **payload**（`payload.meta.validity?.pointerLockLost`）而非 `sharedState` | `sharedState.validity` 會被下一場的 `resetState()` 清掉；payload 是那一場的匯出事實。歷史／重播路徑因此拿到同一個答案 |
| **T5-e** | 接受既有 3 筆 golden fixture 的 **canonical 位元組位移**，更新 `CANONICAL_DIGEST_BEFORE_T5` 而非讓 parser 保留「缺席」 | 見 §6 Surprise 1。required-out 讓每個讀者拿到 `boolean` 而非 `boolean \| undefined`；位移範圍可證明地限於帶 `meta.validity` 的 3 筆、且只多一個鍵。被推翻的替代：`parseValidity()` 缺席即省略——會讓型別退回 optional，與 D-65-3 相衝，且把 `?? false` 散進每個讀者 |

### 4. `corridorExceeded` 不併入 `suspect` 的不對稱為何刻意保留（T5 doc 要求記錄）

新旗標**併入** `suspect`（OQ-65.1），`validity.corridorExceeded` **不併入**（既有語意，本 WP 不動）。兩者性質不同：

- **掉鎖 = 條件失效**。掉鎖期間 `onMouseMove` 在 `!locked` 時直接 return（[PointerLock.ts:43](../../../../../src/input/PointerLock.ts#L43)）⇒ 受試者的位移**完全沒進輸入鏈**，而 sim 照跑、目標照 spawn。性質同 `frameFloorSuspect`（量測條件不成立）。
- **走出走廊 = 行為觀測**。越界的真實後果是視覺遮擋，而場景幾何永不進 sim（GD-6）⇒ 不可能影響命中判定。屬「該記錄的觀測」而非「該作廢的 run」（K-3 / KI-004 S1 T3）。

⇒ 這個不對稱是設計，不是遺漏。**別順手統一**——已在 `collectMeta()` 的註解就地寫下同一句話，免得後人只讀到程式碼。

### 5. 驗證證據（全部為本切片實際執行輸出）

#### 5a. 靜態與單元

| 項目 | 結果 | 對照 |
|---|---|---|
| `npm run typecheck`（×2） | **exit 0 / exit 0** | 同 T4 |
| `npx vitest run`（全量） | **exit 0** — Test Files **258 passed / 1 skipped (259)**；Tests **3097 passed / 2 skipped (3099)**；35.97 s | T4 = 258 files / 3088 tests ⇒ **+0 file、+9 tests**（metadata 3 + exportPayloadSchema 3 + ResultScreen 3），**零測試由綠轉紅** |
| 既有 golden／fixture payload | **8/8 通過 `parseExportPayload()`，fixture 檔零修改** | 詳見 §6 Surprise 1（canonical digest 常數有更新，fixture **檔案**沒有） |

#### 5b. 實機（dev server + 真瀏覽器 Chromium，生產 `PointerLock` 模組與 live 匯出路徑）

> 走 **live** 匯出而非 `__fps` harness——T0 §3 已釘死 harness 路徑根本不輸出 `meta.validity`（T0 Surprise 1），只用 harness 取證會誤判為「沒接上」。這即是 T0 留給 T5 的 Open Question 的答案：**取證方式 = live drill 自動化（既有生產路徑 + Blob 攔截），不新增任何 live 匯出 e2e 縫**。
> 專屬埠 5199 + 專屬 `FPS_HISTORY_ROOT=.playwright-tmp/wp65-t5/history`，並 route-block `/@vite/client`（[e2e-port-5173-collision]／[hmr-reload-resets-long-idle-measurements]）。真實 `data/session-history/` 未被寫入。
> drill 用 `spider-shot-v2`／`v3`（`timeLimit` 60 s，無人瞄準也會自然結束）——**預設的 `counterstrafe_ad_v1` 不能用**：`targetCount` 且無後援閘，實測 180 s 後仍 `running`（T0 Surprise 3 再度命中）。

**FM-3 反證（必要）— 三場乾淨 run 的 `meta.validity.pointerLockLost` 逐一列出：**

| # | 路徑 | drill | ticks | `pointerLockLost` | Result 警示 |
|---|---|---|---:|---|---|
| 1 | 初次載入 | `spider-shot-v2` | 8 078 | **`false`** | 隱藏 |
| 2 | **restart**（Result →「再測目前 Drill」） | `spider-shot-v2` | 8 068 | **`false`** | 隱藏 |
| 3 | **換 drill**（`#drill-select` → Load） | `spider-shot-v3` | 8 075 | **`false`** | 隱藏 |

三場皆 `false` ⇒ 旗標具鑑別力。**旗標若每場都亮就等於沒有。**

**正向 — 一場 drill 跑到一半掉鎖：**

| 項目 | 值 |
|---|---|
| 掉鎖前 | `phase = running`、`pointerLockLostDuringRun = false` |
| 掉鎖手段 | `page.keyboard.press('Escape')` 在 headless 未解鎖 ⇒ 退回 `document.exitPointerLock()`（**同一個**生產 `pointerlockchange`，只有發起者不同） |
| 掉鎖當下 | `phase = running`、`locked = false`、旗標 **`true`** |
| ① drill **繼續跑** | 掉鎖後 +3 s 仍 `phase = running`；最終自然結束，ticks **8 050**（乾淨 run 為 8 068–8 078）⇒ 掉鎖後**整整 60 s 照跑完**，未被截短 |
| ② `meta.validity.pointerLockLost` | **`true`** |
| ③ `meta.suspect` | **`true`** |
| ④ Result 警示 | `hidden = false`、`role = "alert"`、文字＝「本場測試中途失去滑鼠鎖定（ESC／切換視窗），期間的滑鼠移動未被記錄，本場資料可能失效——建議重新測試。」 |

> **③ 的誠實註記**：headless 的 `frames.summary.p95` 必然超過 `PERF_FLOOR_MS`（120 Hz 地板，[eligibility-gate-blocks-automation]），所以**四場**的 `meta.suspect` 都是 `true`、`validity.perfFloor` 都是 `true`。本項實機證據因此只證明「掉鎖沒有讓 suspect 變回 false」；**`pointerLockLost` 單獨把 `suspect` 拉成 true 的語意由單元測試釘死**（`metadata.test.ts` 的兩條：`true` ⇒ suspect true；`false` 且其餘皆 false ⇒ suspect false）。

**FR-65.12 — 待命期與 `ended` 各掉鎖一次：**

| 相位 | 取鎖→掉鎖後的旗標 |
|---|---|
| `armed`（`phaseAtLock`／`phaseAtUnlock` 皆實測為 `armed`） | **`false`** ✅ |
| `ended`（`phaseAtLock = ended`） | **`false`** ✅ |
| `ended`（app **自己**在 `liveFrame` 釋鎖） | 三場乾淨 run 在 `ended` 當下讀 `pointerLockLostDuringRun` 皆 **`false`**、`locked = false` ✅ |

> 取鎖必須用「覆寫 `document.pointerLockElement` + 派發真實 `pointerlockchange`」驅動（README §0.4 已驗證的模式，走**生產** `PointerLock` 模組）：app 自己到不了「`armed` 且已持鎖」，因為**取鎖本身就是 arm**（D-65-1）。也因此該檢查會順帶把 drill 解除待命，之後必須 Restart 才能回到 `armed`——見 §6 Surprise 2。

#### 5c. `meta` 鍵面對照（T0 §3 基線）

| 項目 | 結果 |
|---|---|
| `meta` 鍵集合 vs T0 §3 的 43 鍵基線 | **新增 0 個**（四場 live 匯出的鍵皆為基線子集；33／34 的差異只是 `protocolGuard`——`spider-shot-v3` 有、`v2` 沒有，與本 WP 無關） |
| `meta.validity` 鍵集合 | `["bufferOverflow","corridorExceeded","perfFloor","pointerLockLost","recorderOverflow"]` ⇒ **恰多一個 `pointerLockLost`** ✅ |

#### 5d. Python 相容（NFR-65.5 / C-D1）— **`research/` 零修改**

以真實 live 匯出（帶 `pointerLockLost: true`）實跑：

```
$ cd research && python -c "import sys; sys.path.insert(0,'src'); from pathlib import Path;
  from modules.ingest.algorithms.loader import load_export;
  e = load_export(Path('.../live-export-pointer-lock-lost.json')); ..."
load_export OK: Export
meta.validity = {'corridorExceeded': False, 'perfFloor': True, 'recorderOverflow': False,
                 'bufferOverflow': False, 'pointerLockLost': True}
meta.suspect = True
ticks = 8071 events = 1
```

不拋 `SchemaError`，新欄原樣穿透。`_validate_meta()` 只檢查 `_META_REQUIRED_TYPES` 的必填欄，additive 欄位不觸發拒收——與 T0 的 C-D1 佐證（Python 端對四個既有旗標全域零命中）一致。

### 6. Surprises & Discoveries（T5）

1. **optional-in 的「補預設值」會移動既有 golden fixture 的 canonical 位元組——而那正是 `CANONICAL_DIGEST_BEFORE_T5` 這張表存在的意義。**
   `parseValidity()` 缺欄補 `false` ⇒ 重新序列化時多一個鍵。8 筆 fixture 中**恰好 3 筆**（`09_18_05` / `09_24_18` / `09_37_24`）帶 `meta.validity`，digest 全部移動；另 5 筆沒有 `validity` 物件，digest **逐位不變**——後者正是「位移確實限於這一個鍵、沒有波及別處」的證據。
   **處置**：更新那三個常數並在表頭就地寫明新舊值與理由，**fixture 檔本身零修改**。
   **為什麼不是災難**：`HistoryRepository` 的 `contentHash` 在 index-load（`:405`）與 save（`:412`）兩條路徑都**當場**由 `canonicalExportJSON` 重算，且兩邊都先過 `parseExportPayload` ⇒ 同一版本內自洽，沒有跨版本存下來的 hash 會對不上。Python 讀的是磁碟原始 JSON、從不讀 canonical 形式（C-D1）。
   ⇒ **對後續 additive 欄位的意義**：「optional-in」只保證**舊 payload 不被拒收**，不保證**重新序列化的位元組不變**。兩者是不同的相容性，這張表分得出來——下一個 additive 欄位的作者應該預期它會紅一次。

2. **`armed` 相位的掉鎖偵測無法用「模擬取鎖」單獨驗證而不改變相位——因為取鎖本身就是 arm。**
   模擬 `pointerlockchange`（locked=true）在 `armed` 相位會同時觸發 `armOnPointerLock` ⇒ drill 被解除待命。實測 `phaseAtLock` 與 `phaseAtUnlock` **都還是 `armed`**（相位轉移發生在下一個 sim tick，不是同步），所以檢查本身有效；但之後必須 Restart 才能回到待命。第一版腳本沒有這一步，下一步 `waitPhase('armed')` 直接 timeout。
   ⇒ **對 T6 的意義**：任何「在 `armed` 相位模擬鎖狀態」的 spec 都要把「這個動作會 arm 掉這一場」算進去。

3. **T2 Surprise 5 在自動化中是硬阻斷，不只是外觀問題。** 研究員模式下 `#drill-controls` 蓋住 Result dialog 的動作列 ⇒ Playwright 對 `[data-result-action="export-json"]` 的 hit-test 點擊**永遠 timeout**（錯誤訊息明指 `<select id="weapon-select">` 攔截了 pointer events）。本切片以 `dispatchEvent('click')` 繞過（仍走真實 handler）。**此為既有 UI 條件，非 T5 引入**，但 T6 的 live spec 會撞上同一堵牆。

4. **live 匯出在 headless 拿不到檔案——`downloadTextFile()` 在 `anchor.click()` 的下一行就 `URL.revokeObjectURL()`。** `waitForEvent('download')` 因此恆 timeout。改為在 init script 攔截 `URL.createObjectURL` 取得同一個 Blob 的位元組：`buildCurrentExportPayload → collectMeta → serializeJSON` 整條生產路徑照跑，只有最後落地那一跳被接走。
   ⇒ **對 T6 的意義**：任何需要 live 匯出內容的 spec 都得用這個手法（或另開 seam），`download` 事件在本 app 不可用。

5. **KI-028 再度命中：`taskkill` 掉 shell 之後 Vite 仍在聽。** 第一輪跑完 5199 仍 LISTENING（node PID 50660，`vite.js --port 5199`），需另外依埠號 kill。腳本已補「依埠號 kill + 確認埠安靜」的收尾。

### Open Questions（T5 留給後續 task）

- **T6**：① Result 動作列被 `#drill-controls` 蓋住（Surprise 3）與 ② live 匯出必須攔 Blob（Surprise 4），兩者都會直接決定 live spec 寫得出來寫不出來；③ `armed` 相位模擬取鎖會順帶 arm（Surprise 2）。
- **T-exit**：`CANONICAL_DIGEST_BEFORE_T5` 這張表的名稱仍指 WP-58 的 T5，現在同時承載 WP-65 T5 的位移。是否改名／拆表由 T-exit 決定（純命名，不影響行為）。
- **T-exit（既有條件，非本 WP 引入）**：研究員模式下 Result dialog 與 `#drill-controls` 同時可見且互相遮擋（T2 Surprise 5 + 本切片 Surprise 3）。是否另立 KI 由 T-exit 判斷。
