# WP-57 — progress.md

> 主規格：[README.md](README.md) · 清單：[task-checklist.md](task-checklist.md)

## Progress

| Task | Status | Started | Completed | Evidence |
|---|---|---|---|---|
| T0 Entry Gate | ✅ Done | 2026-09-07 | 2026-09-07 | 見 §T0 audit（2026-09-07）；production diff = 0 |
| T1 Geometry Contract and Resolver | ✅ Done | 2026-09-07 | 2026-09-07 | 見 §T1 evidence；targeted 226 tests、full Vitest 2266 tests、typecheck／build exit 0 |
| T2 TargetManager Branch | Ready | — | — | T1 ✅；contract／resolver／投影已凍結，只剩 spawn 分支接線 |
| T3 Wide Arena Scene | Ready | — | — | T1 ✅；arena 規格已由 T0 更正為 `[18, 20, 4]` + `eyeZ: 0`（§2.5.1），sceneId `wide-flick-arena` 已由 T1 綁定 |
| T4 Export and Conditions | Blocked by T2 **+ OQ-57.7** | — | — | OQ-57.7（匯出角度 frame 語意）需 owner 拍板才可開工 |
| T5 Repositioning Flag | Blocked by T4 | — | — | — |
| T6 Wiring and E2E | Blocked by T2–T4 | — | — | — |
| T-exit | Blocked by T1–T6 | — | — | — |

## T0 audit（2026-09-07）

**Baseline**：HEAD `1b8c046`。`npm run typecheck` exit 0；`npx vitest run` 223 files / 2179 tests 全綠（1 file / 2 tests skipped，既存）；`npx vite build` exit 0（既存的 >500 kB chunk 警告，非本 WP）。**無 baseline failure**。Playwright 未於 T0 執行（T0 無 production diff；全量 Playwright 屬 T-exit 的 NFR-57.8）。

Worktree 另有與本 WP **無關**的既存改動（`docs/exec-plan/README.md`、wp-56 的 progress／checklist、`graphify-out/*`、`tests/e2e/micro-flick-live.spec.ts`、未追蹤的 `src/sim/micro-flick-performance.test.ts`）—— 全程未觸碰、未 stage。

### 1. Discovery 覆驗（§0 十四項）

| # | 判定 | 證據 |
|---|---|---|
| 1 | ⚠️ 已補正 | `SpiderShotCenterPeripheralConfig` `DrillConfig.ts:81`、`SpiderShotStratifiedConfig` `:113`、union `:123`、`spiderShot?` `:184`、`DrillConfig` `:144`。原文只給 stratified 的 113–123 |
| 2 | ✅ | `peripheralPos()` `TargetManager.ts:150`；`TARGET_Y = 1.5` `:67`；眼高 `PLAYER_EYE_HEIGHT_U = 1.6` `clearance.ts:16`、`eyeOrigin.ts:69`（`options.eyeHeight ?? 1.6`） |
| 3 | ✅ | `deriveSpiderShotTransitions()` `spiderShotConditions.ts:49` 用 `normalize(previousPoint)`／`normalize(currentPoint)`；`normalize()` `:134` 以世界原點 |
| 4 | ✅ | `angularSpawnPose()` `TargetManager.ts:102`；`y = TARGET_Y + Math.tan(pitchRad) * distanceU` `:109` |
| 5 | ✅ | `FOV_DEFAULT 75`／`FOV_MIN 60`／`FOV_MAX 120`／`FOV_STEP 1` = `SettingsPanel.ts:26-29`；`meta.fovDeg` ← `settingsPanel.fov` `main.ts:698`；`camera.aspect = w / h` `SceneManager.ts:57` |
| 6 | ✅ | `DataRecorder.ts:124`（逐字「Lock 鎖定中整組隱藏（KI-003）⇒ drill 內 sensitivity/FOV 不可能變動」） |
| 7 | ✅ | `spiderShot?: unknown` `metadata.ts:25`；opaque pass-through `exportPayloadSchema.ts:482-488`；整塊複製 `main.ts:741` |
| 8 | ✅ | `dpi?: number` `metadata.ts:138`（介面）／`:220`（args）／`:275` 驗證／`:325` 輸出 |
| 9 | ⚠️ 已補正 | population 互斥 `schema.ts:98-100`、spiderShot 互斥 `:101-105`（原文寫 98-104）；`validateSpiderShotSchedule()` `:233`（原文寫 234+），分支 `:235`／`:248`，未知 kind throw `:268`。**新增：`:268` 的錯誤訊息硬編兩個合法 kind,T1 必須同步更新** |
| 10 | ✅ | `DEFAULT_PROCEDURAL_ROOM` `eyePose.ts:7-20`（`[10,10,3]`／`eyeHeight 1.6`）、`CAMERA_STANDOFF = 1` `:23`、`eyeZ ?? depth/2 − standoff` `:45`。無天花板：`SceneManager.#buildRoom` 只建地板 + 四牆 |
| 11 | ✅ | `CLEARANCE_MARGIN_U = 0.5` `clearance.ts:12`；`validateClearance()` `:51`，`propInflationU` `:57`，只掃 `scene.propBounds` `:64`／`:74`。全檔 **零** `wall`／`floor`／`roomSize` 引用 ⇒ 牆與地板確實不在檢查範圍 |
| 12 | ✅ | `playerControl: { translation: 'locked' }` `micro_flick_three_target_test_v1.ts:23` |
| 13 | ⚠️ 已補正 | roster 兩列 `main.ts:179`／`:181` ✓；但項型別 `AvailableDrill` 還有 `loadOptions?: DrillLoadOptions`（`main.ts:124`）。`activeDrillConfig` 有**三**個寫入點：`:259`（模組載入期初始化，原文漏列）、`:1236`、`:1279`；`createTargetManager` 消費點 `:916`／`:1280` |
| 14 | ⚠️ 已補正 | 檔案位置是 **`src/history/DrillMetricRegistry.ts`**（非 `src/metrics/`）；`registrationForExactDrill()` `:293-294`，near-miss 拒收註解 `:23`。`spider-shot-v2` 有 **5** 個指標（descriptors `:82`／`:90`／`:98`／`:106`／`:114`），**不是三個**；另註冊 `peek-click-transfer-v1`（4 個）。`buildSensitivityFovKey()` `compatibilityKey.ts:86-90` 確認只含 `sensitivity` + `fovDeg` |

### 2. Blast radius（CodeGraph，2026-09-07）

> ⚠️ **Caveat**：查詢時 CodeGraph 回報 `auto-sync is DISABLED — index frozen`（原因：file lock held by another process）。本節 5 個符號皆為長期存在且非本 session 修改的目標，故計數採信；所有用於 `file:line` 證據的檔案已另行直接 Read 覆核。T1 開工前建議先跑 `codegraph sync .`。

| 符號 | 實測 | §0.1 原估 | 判定 |
|---|---|---|---|
| `DrillConfig`（`DrillConfig.ts:144`） | 123 callers／28 模組／16 測試檔 | 「約 115 consumers」 | cross-module ✓（估計略低） |
| `SpiderShotScheduleConfig`（`:123`） | **3** callers（`schema.ts`、`DrillConfig.ts`），無直接覆蓋測試 | 併在上一列 | cross-module（型別面）但改動點極窄；保護來自 drill-level 的 `spider_shot_v1/v2.test.ts` |
| `createTargetManager`（`TargetManager.ts:223`） | **44** callers（production 僅 `main.ts` + `fpsTestHarness.ts`）／19 測試檔 | 「約 39 呼叫／28 consumers」 | cross-module High risk ✓ |
| `deriveSpiderShotTransitions`（`spiderShotConditions.ts:29`） | **1** caller = 自身測試檔;**production caller 為零** | 「local」 | local ✓（比原估更安全）。真正的格式耦合在 `DrillMetricRegistry.ts:281` 的 `SPIDER_SHOT_V2_CONDITION_CELL` |
| Scene registry | **無獨立 registry 檔**：`availableScenes` = `main.ts:133-141`，各場景一個 `src/scene/scenes/*.ts`；第二消費面 `findSceneConfig()` `fpsTestHarness.ts:189`。`SceneConfig`（`SceneConfig.ts:45`）84 callers／22 模組 | 「local-to-registry」 | local-to-registry ✓，**前提是不動 `SceneConfig` 核心型別** |

### 3. PoC A — resolver 數值

`hitboxDiameterU = 2·8·tan(1°) = 0.279281`、`r = 0.139641`、角半徑恰為 `1.000000°`（自洽檢查通過）。

| aspect | FOV 60 | FOV 75 | FOV 90 | FOV 120 |
|---|---|---|---|---|
| **16:9** halfHFOV / yawMax | 45.7464 / 43.5771 | 53.7562 / 51.6343 | 60.6422 / 58.6324 | 72.0083 / 70.3098 |
| **21:9** halfHFOV / yawMax | 53.4132 / 51.2875 | 60.8155 / 58.8093 | 66.8014 / 64.9427 | 76.1021 / 74.5468 |
| **4:3** halfHFOV / yawMax | 37.5891 / 35.4647 | 45.6543 / 43.4849 | 53.1301 / 51.0013 | 66.5868 / 64.7220 |

`yawMax` 對 aspect **單調遞增**（4:3 < 16:9 < 21:9），四個 FOV 檔位皆成立，**無 NaN**。→ README §2.4 表的 FOV 75／90／120 三列原有 0.01–0.02° 進位誤差，已更正；`abs(ndc_y)` 一欄原本數值有誤且非單調，已改為實測外緣值。

### 4. PoC B — on-screen（12 組 × 10,000 seeded 樣本 = 120,000）

**失敗數 = 0**。最壞 `abs(ndc_x)` = `0.96000`（限值 `1 − screenMargin = 0.96`）；最壞 `abs(ndc_y)` = `0.37121`（21:9 × FOV 60）。

**關鍵發現**：`abs(ndc_x)` 的上界是 **tight-by-construction** —— `yawMax` 的定義式使 `tan(yawMax + r)/tan(halfHFOV)` 代數上恰等於 `1 − screenMargin`。⇒ **FR-57.4 必須用 `≤` 且帶浮點容差**（建議 `1e-9`）；寫成嚴格 `<` 或零容差會讓 T1／T2 的測試因 IEEE-754 尾差隨機紅燈。已寫入 README §2.4。

### 5. PoC C — 地板／幾何極限

| `floorClearanceU` | 原規劃 | **實測 `pitchMax`** |
|---|---|---|
| 0 | 11.31° | **10.5180°** |
| 0.25 | 7.97° | **8.7020°** |
| **0.5（凍結值）** | 6.89° | **6.8947°** ✅ 相符 |

原規劃的 `floorClearanceU = 0` 一列把「球心貼地的純幾何極限」誤填進「已扣球半徑」欄；且該極限在本 WP 的**球面**參數化（FR-57.2，`y = eye + d·sin(pitch)`）下應為 `asin(1.6/8) = 11.5370°`，`atan(1.6/8) = 11.3099°` 屬 `angularSpawnPose()` 的**圓柱**參數化（§0 item 4 明確不沿用）。0.25 一列亦不可重現。兩處已更正；**結論（完整 ±15° 因地板而非 FOV 不存在）不變**。

垂直邊緣：pitch `+6.5°` 上緣 `y = 2.6453`、pitch `−6.5°` 下緣 `y = 0.5547`。

### 6. PoC D — arena 幾何 + 負向證據

**負向證據（16:9，整段 `yawMagDegRange` 而非只有上界）**：

| FOV | 側向落點區間 | vs 預設房間側牆 `x = ±5` |
|---|---|---|
| 60 | `[5.1520, 5.5146]` | 全區間穿牆 |
| 75 | `[5.8986, 6.2725]` | 全區間穿牆 |
| 90 | `[6.4674, 6.8308]` | 全區間穿牆 |
| 120 | `[7.2318, 7.5322]` | 全區間穿牆 |

原規劃寫「最小側向落點是 FOV 60 的 5.52 u」——那是該檔的**上界**；全域最小是同檔**下界** `5.1520 u`，仍 > 5 ⇒ 結論更強。**另更正一處錯誤斷言**：「pitch 亦在原 3 u 牆高下受限」**不成立**（pitch `+6.5°` 上緣 `2.6453 < 3`，放得進去）。負向證據只能建立在**側牆**上。

**arena 選型（本 task 最重要的產出，見 §2.5.1）**：原規劃 `[18, 10, 4]` 未指定 `eyeZ`，會繼承 fallback `4`。實測兩個選項：

| arena `eyeZ` | 中心視線離地仰角 | 最壞 `abs(D_origin − D_eye)` | 匯出 `W_deg` 範圍 | `W_deg` 誤差 | 所需 depth |
|---|---|---|---|---|---|
| `4`（fallback） | 21.801° | 27.937° | `[1.9995, 2.8727]` | 43.6% | ≥ 9.28 |
| **`0`（採用）** | 11.310° | **2.408°** | `[1.9198, 2.0053]` | **4.0%** | **≥ 17.28** |

`eyeZ: 0` 是既有契約要求（`SceneConfig.ts:18`，且 `br-field`／`field-low`／`peek-corridor`／`peek-ad-corridor`／`micro-flick-room` 全部如此，唯一例外 `placeholder-room:19` 有明文歷史理由），並使 pitch 0 時 `abs(pos) = hypot(8, 1.6) = 8.158 u` **與 yaw 無關** ⇒ 匯出 `W_deg` 不再隨條件變因漂移。代價是 depth 必須 ≥ 17.28 以避開 **KI-012 後牆遮擋**（`placeholder-room.ts:11-14` 記載：牆比目標更靠近相機時視覺全遮，但 `HitDetector` 不查牆遮擋、命中仍過）。⇒ **arena 定為 `roomSize: [18, 20, 4]` + `eyeZ: 0` + `floorY` 省略（= 0，KI-014）**。

### 7. `spiderShotMetrics.ts` 零修改可行性（逐函式）

| 函式 | 對 azimuth／radius／origin-frame 的依賴 |
|---|---|
| `deriveSpiderShotMetrics` `:37-101` | **無**。唯一 spawn 相關耦合 = `event.zone === 'peripheral'`（`:42`）；角度走 `resolveEyeOrigin()` + `angularEccentricityDeg()`（`:48`／`:93`）⇒ **已是 eye-frame** |
| `sortedVisible` `:102` | 無（依 `t` 排序） |
| `peakOmega` `:109` | 無（`omegaDegPerSec` 切片取 max） |
| `postAcquireOvershoot` `:114` | 無（讀 `onTarget`／`epsilonDeg`） |
| `firstTickAtOrAfter` `:123` | 無（時間查找） |
| `targetForFirstShot` `:127` | 無（取 `tick.tx/ty/tz` 或 `visible.targetX/Y/Z`，不做角度） |
| `rhythmFor` `:140` | 無（`visible` 間隔） |
| `percentile` `:149` / `isFiniteNumber` `:159` | 無（純數值） |

⇒ **零修改成立，且理由比原規劃更強**：不只是「對 spawn 方式不敏感」，而是它本來就站在眼睛原點上，與本 drill 的新幾何同源。**偏差只存在於 `spiderShotConditions.ts` 這一條 conditions 路徑**（見 §8）。

### 8. 新發現：conditions 路徑的 frame 不同源（→ OQ-57.7 / GD-32）

§0 item 3 記載 v1/v2 的 spawn 與 derivation「兩端一致地偏移」。**本 drill 打破這個對稱**：spawn 是 eye-frame，而 `deriveSpiderShotTransitions()` 仍是 origin-frame ⇒ 匯出的 `angularDistanceDeg` 低估、`angularSizeDeg` 偏移（數字見 §6）。`eyeZ: 0` 已把偏差壓到 `D_deg` ≤ 2.408°／`W_deg` ≤ 4.0%，且真值可由 `meta.scene.eye` + 目標座標經既有 `resolveEyeOrigin()` 完全還原（資訊無損）。但「匯出欄位到底代表哪個 frame」是研究效度決策，不是工程細節 ⇒ 開 **OQ-57.7**，**T4 前需 owner 拍板**，並入帳 **GD-32**。

### 9. OQ-57.1／57.2 凍結值覆驗

- **OQ-57.2**：`floorClearanceU = 0.5` → `pitchMax = 6.8947°`，凍結值 `±6.5°` **有 0.3947° 餘裕**，非硬貼邊界 ✅
- **OQ-57.1**：`spider-shot-wide-v1` 與 `src/drill/*.ts` 全部 17 個既有 `drillId` 無衝突（既有 spider 家族只有 `spider-shot-v1`／`spider-shot-v2`）✅。Near-miss 負向面：`DrillMetricRegistry` 以 exact-`drillId` 比對（`:293-294`）且註解明文拒收 `spider-shot-v2-alt` 之類變體 ⇒ 新 id 不會意外命中 v2 的註冊 ✅
- **OQ-57.3～57.5**：維持 blocked，owner／deadline 未變（見 README §1.6），**未寫成任何常數** ✅

### 10. 附帶驗證：`quadrant` 退化預測

原規劃 §2.7 預測 `quadrantForPeripheral()` 對本 drill 恆回 `'horizontal'`。實測（4 FOV × yaw 窗上下界 × 5 pitch × 左右 = 80 樣本，鏡像 `spiderShotConditions.ts:100-132`）：**80/80 `'horizontal'`**，azimuth ∈ `[69.371°, 290.629°]`，距最近的 `45°` 分箱邊界 **24.37° 餘裕** ⇒ 預測成立，且不會因 pitch 抖動跳到 `'oblique'`。

**PoC artifacts**：四支 throwaway script 位於已驗證 temp root（session scratchpad），T0 結束時刪除；數字全數落在本節，可由上述公式重算。

## T1 evidence（2026-09-07）

**交付面**：`DrillConfig.ts` 新增 `SpiderShotYawPitchConfig` 並併入 union（既有兩支型別逐字不動）；`schema.ts` 新增 `validateSpiderShotYawPitch()` 第三分支、`requireSymmetricDegreeWindow()` 與**更新後的 kind 錯誤訊息**（T0 §0 item 9 指出的硬編兩值問題已解）；新增 `src/sim/spiderEyeFrame.ts`（球面投影／反函式／NDC）、`src/sim/playerEye.ts`（眼高常數新家，見 D-57.T1-1）、`src/drill/spiderShotWide.ts`（resolver + 凍結常數 + `SpiderWideResolveError`）、`src/drill/spider_shot_wide_v1.ts`（template + `resolveSpiderShotWideV1()` + `wide-flick-arena` 綁定）。**`TargetManager` 的 spawn 幾何未動**，只加一個對 v1/v2 不可達的 typed guard（D-57.T1-2）。

**resolver 實測輸出**（16:9、`distanceU = 8`、角徑 2.0°、`screenMargin = 0.04`、`kLo = 0.92`；與 README §2.4／T0 PoC A 逐位相符）：

| `fovDeg` | `yawMax` | `yawMagDegRange` | 側向 abs(x) @ pitch 0 |
|---|---|---|---|
| 60 | 43.577058 | [40.090893, 43.577058] | 5.514636 |
| 75 | 51.634335 | [47.503588, 51.634335] | 6.272524 |
| 90 | 58.632363 | [53.941774, 58.632363] | 6.830760 |
| 120 | 70.309776 | [64.684994, 70.309776] | 7.532224 |

跨 aspect（FOV 75）：4:3 = `43.484877`、16:9 = `51.634335`、21:9 = `58.809282`，單調遞增，4:3↔21:9 相差 `15.324°`（OQ-57.6 依據）。pitch 端：`pitchLimitDeg = 6.894696`，凍結窗 `±6.5°` 餘裕 `0.394696°`；`floorClearanceU` 0／0.25 取到 `10.518030`／`8.701977`，與 T0 PoC C 一致（規劃期的 11.31／7.97 兩列確認為錯）。

**OQ-57.1／57.2 落地值**：`drillId = 'spider-shot-wide-v1'`、`sceneId = 'wide-flick-arena'`、`seed = 57001`（與 v1 `36036`／v2 `260826` 互不相同）、`grid.pitchBands = 2`、`peekTimeoutMs = 2500`、`endCondition = timeLimit 90000`、hitbox sphere `0.279281 u`、`pitchDegRange = [−6.5, 6.5]`。

**測試**（新增 87 個 case）：`src/sim/spiderEyeFrame.test.ts` 11、`src/drill/spiderShotWide.test.ts` 33（含 22 條 typed-error 正負向矩陣）、`src/drill/spider_shot_wide_v1.test.ts` 13、`tests/regression/spider-wide-geometry.test.ts` 8（NFR-57.3／57.4／57.6 + FR-57.9 負向證據）、`src/drill/schema.test.ts` 新增 22 個 yawpitch case（該檔 92 tests 全綠）。NFR-57.3：10,000 個 seeded 樣本最壞相對誤差 ≤ 1e-12。NFR-57.4：4 FOV × 3 aspect × 10,000 = **120,000 樣本，failures = 0**；最壞 `abs(ndc_x)` 貼齊 `0.96`（tight-by-construction，容差 1e-9），最壞 `abs(ndc_y) = 0.3728`（21:9 × FOV 60）。NFR-57.6：`spiderEyeFrame.ts`／`spiderShotWide.ts` 對 DOM／three／`node:*`／`fs`／`Date.now`／`performance.now`／`Math.random`／`SceneConfig`／`SceneManager`／`SettingsPanel` 全數零命中。

**零回歸**：`npx vitest run` 全量 **227 files passed + 1 skipped／2266 tests passed + 2 skipped**（T0 baseline 為 223／2179，差額為本 task 新增測試與 worktree 內既存的 WP-56 T5 未提交測試）；`npx tsc --noEmit` 與 `npx tsc --noEmit -p tsconfig.node.json` exit 0；`npx vite build` exit 0（168 modules、1,196.34 kB／gzip 340.77 kB，僅既存 >500 kB 警告）。`spider-shot-v1`／`v2` 的 fixture 與 `TargetManager` spawn 測試全綠且未改期望值。Playwright 未於 T1 執行（無 UI 接線；全量屬 T-exit 的 NFR-57.8）。

**型別面 blast radius（實測，補正 §0.1）**：union 新增分支後有 **6 個未收斂的 union 屬性存取點**需要顯式 narrowing —— production `TargetManager.ts`（`sampleSpiderShotPose()` 內 `centerDistanceU`／`peripheral`）與 `pilot/pilotConfigs.ts`，測試 `spider_shot_v1.test.ts`（2 處）、`spider_shot_v2.test.ts`（2 處）、`pilot/protocolFreeze.test.ts`、`sim/TargetManager.test.ts`。全部改為指名 v1/v2 的具體分支型別，行為與期望值不變。

**未觸碰**：worktree 既有的 `docs/exec-plan/README.md`、wp-56 progress／checklist、`graphify-out/*`、`tests/e2e/micro-flick-live.spec.ts`、未追蹤的 `src/sim/micro-flick-performance.test.ts` 全程未 stage。`graphify update .` 因 `graphify-out/*` 已帶平行工作的未提交變更而延後，避免混入本 commit。

## Decision Log

| ID | Date | Decision | Owner | Evidence |
|---|---|---|---|---|
| D-57.P1 | 2026-09-07 | 建立新 drill 檢測**大幅度拉槍**：周邊目標貼近選手使用 FOV 的水平極限角度，高度不超過中心目標 ±15° | 使用者 | 原始需求 |
| D-57.P2 | 2026-09-07 | 周邊 yaw 幅度**依 runtime FOV 比例縮放**（非固定絕對角、非離散 preset 查表），以取得「每位選手同樣貼邊」的主觀等價 | 使用者（AskUserQuestion） | README §2.4 |
| D-57.P3 | 2026-09-07 | 上述比例縮放以 **arm-time 解析一次並凍結進 config** 落地，而非 sim runtime 讀 FOV／aspect。依據：`DataRecorder.ts:124` 記載 drill 內 FOV/sensitivity 不可能變動（KI-003 Lock），故無需 per-spawn 讀取；此結構同時守住 GD-6／GD-10 與逐 tick 決定性 | Engineering | README §2.2／§2.9；NFR-57.5 為其硬閘 |
| D-57.P4 | 2026-09-07 | 目標**完整可見、貼邊但不被切**（非部分裁切、非畫面外靠 cue 引導）。因此不需要任何 cue 子系統，且刺激定義乾淨 | 使用者（AskUserQuestion） | README §1.3 Out of scope、FR-57.4 |
| D-57.P5 | 2026-09-07 | `pitch` 為**干擾項**（均勻隨機防背位置），不是條件變因。分層網格只用它做平衡，`targetConditionCell` 不含 pitch | 使用者（AskUserQuestion） | FR-57.5、README §2.6 |
| D-57.P6 | 2026-09-07 | 低感度選手的**抛滑鼠**混淆因子處置 = 記錄 `cm/360` ＋標註可疑 trial（不封頂 yaw 幅度、不設感度參加門檻） | 使用者（AskUserQuestion） | README §2.8、T5 |
| D-57.P7 | 2026-09-07 | 場景策略 = **新增寬場 arena、距離固定 8u**（不採「距離隨 FOV 一起解析並留在現行房間」）。現行 `[10,10,3]` 房間在任一 FOV 下都穿側牆 | 使用者（AskUserQuestion） | README §2.5、FR-57.9 |
| D-57.P8 | 2026-09-07 | v3 在程式碼裡 = **`SpiderShotScheduleConfig` union 加第三支 kind**（不建在 `targets.spawnArea` 上、不另開獨立 config 欄位） | 使用者（AskUserQuestion） | FR-57.1、README §2.3 |
| D-57.P9 | 2026-09-07 | spawn 幾何改用 **eye-frame 球面**，不沿用 v1/v2 的 origin-frame 圓錐，也不沿用 `angularSpawnPose()` 的圓柱。理由見 Surprises 第 1／2 條 | Engineering | README §2.2；GD-32（T0 入帳） |
| D-57.P10 | 2026-09-07 | 規劃文件採 stage10/WP-50 的 README／checklist／progress／T0～T6／T-exit 結構 | 使用者 | 本文件組 |
| D-57.P11 | 2026-09-07 | v1 交付為 **practice／researcher-only**：不晉升 Assessment、不進 history／compatibility／`DrillMetricRegistry`。理由：時序參數與貼邊係數皆未經實機校準，且每 cell 樣本數不足支撐信度（C-D3） | Planning default，待 T-exit 覆核 | FR-57.13、README §5 |
| D-57.P12 | 2026-09-07 | 「±15°」讀為**上限**而非要求值；實際 pitch 窗由地板淨空反推。完整 ±15° 在 8 u／眼高 1.6 u 下幾何上不存在 | Engineering | README §2.4 |
| D-57.P13 | 2026-09-07 | **OQ-57.1 收斂**：`drillId = 'spider-shot-wide-v1'`。理由：它是 v1/v2 的同輩不同構念（純水平大幅），非後繼版本；`spider-shot-v3` 會誤示替代關係，而 v1/v2 仍有效且已凍結 | 使用者 | README §1.5／§1.6 |
| D-57.P14 | 2026-09-07 | **OQ-57.2 收斂**：`pitchDegRange = [−6.5, 6.5]`，`floorClearanceU = 0.5`（沿用 `CLEARANCE_MARGIN_U` 慣例）。不做懸空平台／虛空 arena，故完整 ±15° 明確不追求 | 使用者 | README §1.5／§2.4；T3 arena 幾何表 |
| D-57.P15 | 2026-09-07 | `docs/exec-plan/README.md` §2 補上 **Stage 12（階段 L）** 區塊與 §4 相依圖，涵蓋 WP-56／WP-57／WP-58 三列，並指向 stage 層 [`active/stage12/README.md`](../README.md)（關閉該檔標註的「上層索引待補」Open Item）。stage11 的 WP-54/WP-55 表列與 M20/M21 門控列缺口**不在本次範圍**，只把 intro 列舉的 WP 區間改為 `WP-52 ~ WP-55` 並加一行警示，讓缺口可見而非隱形 | 使用者 | 見該檔 §2「階段 L」與 §4 |
| D-57.T0-1 | 2026-09-07 | **arena 定為 `roomSize: [18, 20, 4]` + `eyeZ: 0` + `floorY` 省略**（取代規劃期的 `[18, 10, 4]` 未指定 `eyeZ`）。`eyeZ: 0` 是 `SceneConfig.ts:18` 對前向目標 drill 的**既有契約**、也是除 `placeholder-room` 外全部五個場景的慣例（GD-31 先例）；它同時把匯出 `W_deg` 的誤差從 43.6% 壓到 4.0%、並使 `W_deg` 在 pitch 0 時與 yaw 無關。<br>**Alternatives considered**：(a) 沿用 fallback `eyeZ: 4` + `depth: 10` —— 房間較小，但違反既有契約，且 `W_deg` 隨 yaw（= 條件變因本身）漂移，會把 yaw 資訊偷渡進 `targetConditionCell` 的 `w=` 欄位，屬研究效度問題，**駁回**；(b) `eyeZ: 0` + `depth: 18`（剛好 ≥ 17.28）—— 可行但餘裕僅 0.72 u，且 `placeholder-room` 已用 `depth: 20` 解同一個 KI-012 問題，**取 20 以沿用既有數值與理由**；(c) 縮短 `distanceU` 讓房間變小 —— 會改變角徑與 v1/v2 血緣，**駁回** | Engineering（T0 PoC D） | progress §T0 audit ⑥；README §2.5.1 |
| D-57.T0-2 | 2026-09-07 | **FR-57.4 的 NDC 判定採 `≤` 並帶 `1e-9` 浮點容差**。理由：`yawMax` 的定義式使外緣 `ndc_x` 代數上恰等於 `1 − screenMargin`（實測最壞值 `0.96000`），是 tight-by-construction 而非有餘裕的邊界。<br>**Alternatives considered**：(a) 嚴格 `<` —— 在數學上恆假、測試必紅，**駁回**；(b) 零容差 `≤` —— 依 IEEE-754 尾差隨機紅燈，**駁回**；(c) 把 `kLo` 上界改成 `0.99·yawMax` 以人工製造餘裕 —— 改變刺激定義來遷就測試，**駁回** | Engineering（T0 PoC B） | progress §T0 audit ④；README §2.4 |
| D-57.T0-3 | 2026-09-07 | **v1/v2 的 origin-frame 與 `angularSpawnPose()` 的圓柱語意皆不修**，三套幾何並存並以 **GD-32** 記名適用範圍。<br>**Alternatives considered**：(a) 統一改成 eye-frame 球面 —— 會作廢 v1/v2 已凍結的 baseline 與 `micro_flick` 的 golden，收益只是幾何整齊，**駁回**；(b) 只修 `spiderShotConditions.ts` 使 derivation 走 eye-frame —— 這是正確的長期解，但會改動 v1/v2 已凍結的匯出值、需重錄 baseline，屬獨立 KI 而非本 WP 夾帶項，**移交 OQ-57.7 選項 (b)** | Engineering | GD-32；README §3.2 |
| D-57.P16 | 2026-09-07 | **編號衝突已解**：WP-57（spider shot）與 session program 排程器同日在兩個平行 session 規劃，一度都暫用 WP-57／GD-32；依 GD-15「先採納先得」（資料夾先建立）由本 WP 保留 **WP-57／GD-32**，排程器順延重編為 **WP-58／GD-33** | 平行 session 對帳 | [`../README.md`](../README.md) §3 編號分配表 |
| D-57.T1-1 | 2026-09-07 | **`PLAYER_EYE_HEIGHT_U` 的定義搬到 `src/sim/playerEye.ts`，`src/scene/clearance.ts` 原地 re-export 同一 binding**。README §2.10 稱它是「sim 側常數」，但它實際住在 `src/scene/clearance.ts`，而 `src/scene/architecture.test.ts` 硬禁「`src/sim`／`src/state` import `src/scene`」（GD-6 的自動閘）—— 照規劃寫會直接紅燈。搬家後眼高**仍只有一個定義**，所有既有 import 路徑與數值逐位不變。<br>**Alternatives considered**：(a) 把 `spiderEyeFrame.ts` 移到 `src/drill/` 繞過閘 —— 偏離 README §2.1 的路徑，且 T2 的 sim 分支遲早需要同一常數，只是把問題往後推，**駁回**；(b) 在 `src/sim` 另立眼高常數 —— 直接違反 T1 invariant「不得新增第二個眼高常數」，**駁回**；(c) 讓 `spiderWideEyePos()` 收 `eyeHeightU` 參數、常數由呼叫端提供 —— 呼叫端 `TargetManager` 一樣在 `src/sim`，閘照樣擋，**駁回** | Engineering | `architecture.test.ts` 紅燈輸出；搬家後全量 Vitest 綠 |
| D-57.T1-2 | 2026-09-07 | **`TargetManager.sampleSpiderShotPose()` 加一個 `center-peripheral-yawpitch` 的 fail-fast guard**（3 行，對 v1/v2 不可達），偏離 T1 DoD 的「`TargetManager` 尚未被修改（`git diff` 可證）」。理由：union 新增分支後，`spiderShot.centerDistanceU`／`spiderShot.peripheral` 這兩個**未收斂的 union 屬性存取**在 strict TS 下必然編譯失敗，不改就無法 typecheck。guard 明確拒收新 kind 而非讓它掉進 azimuth/radius 幾何，spawn 行為零變動（v1/v2 測試期望值未改）。<br>**Alternatives considered**：(a) 新分支改用 `centerDistanceU` 欄位名讓 union 保持共同屬性 —— 可救 `centerDistanceU`，但 `peripheral` 形狀不相容仍會炸，且會偏離 README §2.3 凍結的 `distanceU`，**駁回**；(b) 新分支宣告 `centerDistanceU?: undefined` —— strict 下對 `number | undefined` 取負仍是型別錯誤，**駁回**；(c) 把 union 分支延到 T2 才加 —— 那 T1 就沒有契約可凍結，違反 task 目的，**駁回** | Engineering | `npx tsc --noEmit` exit 0；`TargetManager.test.ts` 57 tests 全綠 |
| D-57.T1-3 | 2026-09-07 | **resolver 回傳 `{ yawMagDegRange, pitchDegRange, pitchLimitDeg }`**：`pitchDegRange` 取模組凍結的 `±SPIDER_WIDE_PITCH_MAG_DEG`，`pitchLimitDeg` 是地板淨空推導的硬上界並作為餘裕證據；凍結值超過上界時擲 `SpiderWideResolveError('pitchDegRange', …)`。理由：D-57.P14 凍結的是 `±6.5°`（餘裕 0.395°，刻意不貼邊），而 FR-57.14 又要求「pitch 窗使目標埋入地板」必須是 typed error —— 兩者只有在「窗是凍結常數、上界是驗證條件」的結構下才同時成立。<br>**Alternatives considered**：(a) 直接回 `±pitchLimitDeg` —— 會得到 `±6.8947°`，推翻 D-57.P14 的凍結值與「非硬貼邊界」的理由，**駁回**；(b) 把 `pitchMagDeg` 加進 resolver input —— 偏離 README §2.4 簽章，且會讓凍結值可被任一呼叫端改寫，失去凍結意義，**駁回** | Engineering | `spiderShotWide.test.ts` pitch 段；`pitchLimitDeg = 6.894696` |
| D-57.T1-4 | 2026-09-07 | **6 個既有 union 消費點改為指名 v1/v2 的具體分支型別**（production `pilotConfigs.ts` 的 guard 收斂到 `kind === 'center-peripheral'`；`spider_shot_v1/v2.test.ts`、`protocolFreeze.test.ts`、`TargetManager.test.ts` 以型別標註／斷言收斂）。行為與期望值零變動，只讓「這段程式碼只對 v1/v2 有意義」變成型別可稽核的事實。<br>**Alternatives considered**：把新分支設計成與 v1/v2 結構相容以避免改動 —— 需要塞入 `azimuthDegRange`／`distanceURange` 等對本 drill 無意義的欄位，會讓契約說謊，**駁回** | Engineering | 全量 Vitest 2266 tests 綠 |

## Surprises

> 規劃階段（2026-09-07）從 repo 讀出、與原先假設不同的事實。

1. **既有 spider shot 的錐軸原點不是眼睛。** `peripheralPos()`（`src/sim/TargetManager.ts:150-157`）以 `(0, TARGET_Y, -centerDistanceU)` 建立中心視線正交框，起點是**世界原點**；但眼睛在 `y ≈ 1.6`（`src/metrics/eyeOrigin.ts:69`、`PLAYER_EYE_HEIGHT_U`）。錐軸因此相對真實視線仰起 `atan(1.5/8) ≈ 10.6°`。手算一個「radius 45°、azimuth 90°（正右）」的點：世界座標 `(5.66, 1.04, −5.56)`，從眼睛看是 yaw 45.5°／**pitch −4.0°**，而非設計意圖的 0°。
   `deriveSpiderShotTransitions()` 同樣以世界原點正規化，故 v1/v2 的 spawn 與離線推導**兩端一致地偏移** —— 指標內部自洽、既有結論不失效，但幾何語意與玩家所見不同源。v1/v2 參數已凍結，本 WP 不回頭改，入帳 GD-32。

2. **另一套 yaw/pitch 取樣器是圓柱不是球面。** `angularSpawnPose()`（`TargetManager.ts:102-113`）的 `y = TARGET_Y + tan(pitch)·d` 使水平半徑恆為 `d`，3D 距離 `= d/cos(pitch)`。pitch 15° → 距離 +3.5%、角徑 −3.4%。對 `micro_flick` 的 ±12° 影響小，但本 WP 要把 `W_deg` 當條件變因，不能沿用（且改它會動到 `micro_flick` 逐位行為）。

3. **`ndc_x` 只含 yaw。** 直線透視下 `ndc_x = tan(yaw)/tan(halfHFOV)`，與 pitch 完全無關。所以「貼邊但不被切」是一個**純 yaw 條件**，yaw 與 pitch 可獨立取樣。反查垂直方向：FOV 75、yaw 52°、pitch 15° → `abs(ndc_y) = 0.57`，離上下邊還有四成餘裕 ⇒ 題目給的 ±15° 從來不會造成垂直裁切。

4. **±15° 的真正阻擋是地板，不是 FOV。** 眼高 1.6 u、距離 8 u 時，向下超過 `atan(1.6/8) = 11.31°` 目標球心就貼地；扣掉球半徑與淨空後只剩約 6.9°（0.5 u 淨空）或 8.0°（0.25 u 淨空）。

5. **現行房間在任何 FOV 下都裝不下。** `roomSize: [10,10,3]`、眼睛 `(0,1.6,4)` ⇒ 側牆在 `x = ±5`。8 u 球面上、`k=0.9` 的側向落點：FOV 60 → 5.26 u、FOV 75 → 5.98 u、FOV 120 → 7.24 u —— **每一格都穿牆**；pitch 方向在原 3 u 牆高下亦受限。

6. **FOV／aspect 在 run 內本來就是常數。** `src/data/DataRecorder.ts:124` 已明文記載 KI-003 的 Lock 行為使 drill 內 sensitivity/FOV 不可能變動。這把「arm 時解析一次」從權宜之計變成有依據的正解。

7. **aspect 目前完全不在匯出裡。** `meta.fovDeg` 是**垂直** FOV；水平 FOV 需要 aspect，而 aspect 只活在 `SceneManager.camera.aspect`（`src/render/SceneManager.ts:57`）。這是 `resolvedFrom` 必須存在的直接原因，也是 OQ-57.6（晉升時 `compatibilityKey` 必須補 aspect）的來源。

8. **resolved 參數不需要新 schema 欄位。** `meta.spawn.spiderShot` 是 opaque `unknown`（`src/data/metadata.ts:25`），且 `src/main.ts:741` 已把整塊 config 複製進去 ⇒ 只要參數在 resolved config 裡就自動落匯出。

9. **指標棧完全不用改。** `deriveSpiderShotMetrics()` 的五類構念（switchReaction／movementExecution／stopControl／firstShot／rhythm）只吃 visible 事件 anchors 與既有 canonical derivations，對 spawn 排程方式不敏感，而且正好覆蓋大幅度拉槍的主要失效模式（`overshootDeg`／`microAdjustCount`）。`D_deg` 自然從 ~10–25° 升到 ~45–55°，那是操弄變因而非新指標。

10. **`quadrant` 標籤會退化。** `quadrantForPeripheral()` 對本 drill 會恆定回 `'horizontal'` —— 該標籤是**正確的、只是無辨別力**。故左右分區改由 additive `side` 承載；而 v1/v2 的 `side` 恆為 `'R'`（僅型別佔位，`CONTEXT.md` 第 52 列），兩者語意不同，必須記名。

11. **牆與地板沒有自動淨空閘。** `validateClearance()` 只檢查 target envelope 對 **props**；牆／地板不在檢查範圍內（`src/scene/clearance.ts`）。所以「穿牆／埋地板」目前完全靠人眼，本 WP 必須自帶幾何斷言（T3）。

12. **`playerControl.translation: 'locked'` 已經存在。** WP-56 交付的 additive seam 可直接沿用；而對本 drill 它不是偏好而是**契約前提** —— yaw/pitch 是相對 `eye = sim 原點` 定義的，玩家一橫移，角度語意即失效。

> 以下為 **T0 執行期（2026-09-07）** 新增的意外，全部有可重現數字，見上方 §T0 audit。

13. **新 drill 會打破「spawn 與 derivation 兩端一致」這個保護。** 上面第 1 條的結論是 v1/v2 的偏移**兩端一致**、故內部自洽。本 drill 的 spawn 改 eye-frame 而 `deriveSpiderShotTransitions()` 仍是 origin-frame ⇒ **兩端不同源**，匯出的 `angularDistanceDeg`／`angularSizeDeg` 與刺激真值有系統性落差。這是規劃期漏掉的一環：規劃只推導了「spawn 該長什麼樣」，沒回頭檢查「conditions 路徑會匯出什麼」。**Evidence**：arena `eyeZ` 取 fallback `4` 時最壞 `abs(D_origin − D_eye) = 27.937°`、`W_deg ∈ [1.9995, 2.8727]`（設計恆 2.0000，誤差 43.6%）；改 `eyeZ: 0` 後收斂到 `2.408°` / `[1.9198, 2.0053]`（4.0%）。→ OQ-57.7、GD-32、D-57.T0-1。

14. **arena 的 `eyeZ` 是一個規劃期沒被看見的必選項，而且兩個選項都有硬代價。** 不指定就吃 fallback `depth/2 − CAMERA_STANDOFF`，而那正好是全 repo 唯一保留 `eyeZ: 4` 的 `placeholder-room` 的歷史值。選 `eyeZ: 0`（契約與五個場景的慣例）則中心目標退到 `z = −8`，`depth: 10` 的後牆在 `z = −5` **會直接踩 KI-012**（牆比目標近、視覺全遮，但 `HitDetector` 不查牆遮擋 ⇒ 命中仍過，是「看不到卻打得中」的靜默失效）。**Evidence**：`placeholder-room.ts:11-14` 逐字記載同一 bug 與其 `depth: 20` 解法；PoC D 算出 `depth ≥ 17.28`。

15. **`abs(ndc_x)` 的上界是代數恆等，不是有餘裕的不等式。** `yawMax = atan((1−screenMargin)·tan(halfHFOV)) − r` 代回外緣 `yaw + r` 後，`ndc_x` 恰為 `1 − screenMargin`。**Evidence**：120,000 個樣本的最壞值量到 `0.96000`（限值 0.96），失敗數 0。⇒ 判定式必須帶容差，否則測試會隨機紅燈（D-57.T0-2）。

16. **`spider-shot-v2` 註冊的是 5 個指標，不是規劃寫的 3 個**，而且 `DrillMetricRegistry` 在 `src/history/` 不在 `src/metrics/`。**Evidence**：descriptors `DrillMetricRegistry.ts:82/90/98/106/114`。同時發現 **`deriveSpiderShotTransitions()` 的 production caller 是零**（唯一呼叫者是自身測試檔）—— `targetConditionCell` 的格式耦合實際落在 `DrillMetricRegistry.ts:281` 的 `SPIDER_SHOT_V2_CONDITION_CELL`，那才是 FR-57.11「格式不得變動」真正要保護的東西。

17. **`spiderShotMetrics.ts` 零修改的理由比規劃寫的更強。** 規劃說它「對 spawn 方式不敏感」；逐函式覆核發現它一律走 `resolveEyeOrigin()`／`angularEccentricityDeg()`，**本來就是 eye-frame** ⇒ 與本 drill 的新幾何同源。**Evidence**：`spiderShotMetrics.ts:48`／`:93` 及全檔 9 個函式對 azimuth／radius／origin-frame 零引用（§T0 audit ⑦）。這也把偏差範圍精確地收斂到 conditions 一條路徑。

18. **PoC C 的三個 `pitchMax` 只有凍結那一個對得上。** `floorClearanceU = 0.5` → `6.8947°` 與規劃的 `6.89°` 相符；但 `0` 一列規劃寫 `11.31°`（實為 `10.5180°`，規劃把「球心貼地的純幾何極限」填進了「已扣球半徑」欄），`0.25` 一列寫 `7.97°`（實為 `8.7020°`，無法重現）。**且那個純幾何極限本身也用錯函式**：本 WP 的球面參數化下應為 `asin(1.6/8) = 11.5370°`，`atan(1.6/8) = 11.3099°` 屬 `angularSpawnPose()` 的圓柱參數化 —— 即上面第 2 條明確不沿用的那一套。已凍結的 `±6.5°` 不受影響（餘裕 0.3947°）。

> 以下為 **T1 執行期（2026-09-07）** 新增。

19. **README §2.10 把 `PLAYER_EYE_HEIGHT_U` 稱為「sim 側常數」，但它住在 `src/scene/clearance.ts`，而 repo 有一道硬閘直接禁止 `src/sim` import `src/scene`。** 照規劃逐字實作會讓 `src/scene/architecture.test.ts` 紅燈——那道閘正是 GD-6「場景幾何永不進 sim runtime」的自動化形式。規劃看見了「眼高必須來自 sim 側」這個**意圖**，卻沒查證常數的實際歸屬。**Evidence**：`architecture.test.ts:15` 失敗、violations = `['../sim/spiderEyeFrame.ts', '../sim/spiderEyeFrame.test.ts']`。→ D-57.T1-1（搬家 + re-export，眼高仍單一定義）。

20. **union 新增分支的實際型別 blast radius 是 §0.1 CodeGraph 計數的兩倍。** §0.1 記 `SpiderShotScheduleConfig` 只有 3 callers；實測要動的是 **6 個未收斂的 union 屬性存取點**（`TargetManager.ts`、`pilotConfigs.ts`、4 個測試檔）。原因：這些位置不是 import 該型別名稱，而是透過 `config.spiderShot!.centerDistanceU` 這種**間接成員存取**碰到 union —— 符號層級的 caller 計數看不到它們。⇒ 對 discriminated union 做加法時，caller 計數是下界而非上界；`tsc --noEmit` 才是權威清單。**Evidence**：D-57.T1-2／T1-4 列出的 6 個位置。

21. **跨 aspect 最壞 `abs(ndc_y)` 實算為 `0.3728`，README §2.4 記的是 `0.371`。** 同一組合（21:9 × FOV 60）、同一式子（外緣取 `yaw + r`、`pitch + r`），差 0.0018。結論完全不變（限值 0.96，餘裕仍極大），但測試以實算值釘死並在註解記下這個落差，避免後人以為公式改過。**Evidence**：`tests/regression/spider-wide-geometry.test.ts` 垂直最壞值段。

## Open Questions（追蹤用，權威定義見 README §1.6）

| ID | 狀態 | 待誰 |
|---|---|---|
| OQ-57.1 `drillId` 命名 | ✅ 已收斂 2026-09-07：`spider-shot-wide-v1`（D-57.P13）；**T0 已覆驗與 17 個既有 `drillId` 無衝突、含 near-miss 負向面** | — |
| OQ-57.2 pitch 窗 | ✅ 已收斂 2026-09-07：`±6.5°`，`floorClearanceU = 0.5`（D-57.P14）；**T0 已覆驗 `pitchMax = 6.8947°`、餘裕 0.3947°** | — |
| OQ-57.3 `kLo` / `screenMargin` 貼邊感 | 待實機（T0 未寫成常數） | 使用者，T6 |
| OQ-57.4 `peekTimeoutMs` / `timeLimitMs` | 待實機（T0 未寫成常數） | 使用者，T6 |
| OQ-57.5 repositioning 門檻 | 待資料（T0 未寫成常數） | 使用者 + 工程，T5 |
| OQ-57.6 晉升時 `compatibilityKey` 補 aspect | 已有結論（必須補），不阻塞本 WP。**T0 補上量化依據：同 FOV 75 下 4:3 與 21:9 的 `yawMax` 相差 15.3°** | 晉升 WP 的 T0 |
| **OQ-57.7**（T0 新增）匯出 `angularDistanceDeg`／`angularSizeDeg` 的 frame 語意 | 🟡 **待拍板 —— 阻塞 T4**（不阻塞 T1／T2／T3）。三個選項與建議預設 (a) 見 README §1.6；偏差數字見 §T0 audit ⑥／⑧ | **使用者，T4 前** |
