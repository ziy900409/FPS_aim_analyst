# WP-57 — progress.md

> 主規格：[README.md](README.md) · 清單：[task-checklist.md](task-checklist.md)

## Progress

| Task | Status | Started | Completed | Evidence |
|---|---|---|---|---|
| T0 Entry Gate | ✅ Done | 2026-09-07 | 2026-09-07 | 見 §T0 audit（2026-09-07）；production diff = 0 |
| T1 Geometry Contract and Resolver | ✅ Done | 2026-09-07 | 2026-09-07 | 見 §T1 evidence；targeted 226 tests、full Vitest 2266 tests、typecheck／build exit 0 |
| T2 TargetManager Branch | ✅ Done | 2026-09-07 | 2026-09-07 | 見 §T2 evidence；golden 先錄後改、四 FPS parity、aspect 不變性、10,000 spawn 覆蓋／平衡、120,000 spawn NDC 失敗數 0；full Vitest 2,314 tests、typecheck／build exit 0 |
| T3 Wide Arena Scene | ✅ Done（步驟 8 實機截圖延到 T6） | 2026-09-07 | 2026-09-07 | 見 §T3 evidence；612 個落點淨空、§2.5 全表逐列、預設房間四檔全穿側牆、`loadDrill` 閘正負向；full Vitest 2,353 tests、兩個 typecheck／build exit 0 |
| T4 Export and Conditions | ✅ Done | 2026-09-07 | 2026-09-07 | 見 §T4 evidence；resolvedFrom 五欄 round-trip 逐位、eye-frame `W_deg` 恆 2.000000000000、離線 `side` 與實錄 spawn side 逐筆相同、v1/v2 七欄位不變；full Vitest 2,373 tests、兩個 typecheck／build exit 0 |
| T5 Repositioning Flag | Ready | — | — | T4 ✅（`deriveMouseThrow()` 已可用作標註率的 `cm/360` 方向性檢查 x 軸） |
| T6 Wiring and E2E | ✅ Done | 2026-09-08 | 2026-09-08 | 見 §T6 evidence；researcher 控制列 arm-time resolve、4 個 Edge E2E 全綠（on-screen 61 spawn 失敗 0、resize 41 spawn 逐位一致、translation locked + mouse aim、practice-only）、FOV 60／75／120 各 3 張實機截圖 + OQ-57.3／57.4 回填（`timeLimitMs` 改 60000） |
| T-exit | Blocked by T5 | — | — | T1～T4／T6 ✅；只剩 T5 |

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

## T2 evidence（2026-09-07）

**開工前 blast radius（CodeGraph `impact`）**：`createTargetManager` **47 callers**（production `src/main.ts`、`src/testharness/fpsTestHarness.ts`，其餘為 20+ 個測試／fixture 檔，含 `movingTargetDeterminismFixture`、`longrangeTrackingDeterminismFixture`、`wp22-determinism`、`br-tracking-invariants`）；`spiderWideEyePos` 在 `TargetManager.ts` 有 7 個引用點，測試面已被 `spiderEyeFrame.test.ts`／`spiderShotWide.test.ts`／`spider-wide-geometry.test.ts` 覆蓋；`buildSpiderWideCells`／`sampleSpiderWidePeripheralPose`／`shuffleInPlace` 皆為 `TargetManager.ts` 內部（各 1～3 個呼叫端）。呼叫鏈 `createTargetManager → spawn → sampleSpiderShotPose → sampleSpiderWidePeripheralPose → buildSpiderWideCells`，無 render／scene／時鐘節點進入。

**step 2（先錄 golden 再改碼）**：`scripts/recordSpiderSpawnGolden.ts` 走生產路徑（`createTargetManager` + `tick()` + `markKilled()`）錄下 `spider-shot-v1`／`v2` 各 200 個 spawn 的 `zone`／`side`／`x`／`y`／`z`，連同 `reset()` 重跑一輪，凍結成 `tests/golden/spider-shot/*.json`。**該 commit（`3548ccc`）在新分支 commit（`56e7d99`）之前，且 `src/` diff = 0**，故 golden 記錄的是改動前的真實行為而非事後蓋章。`spider-shot-spawn-golden.test.ts` 8 tests 全綠 ⇒ **NFR-57.2 byte-identical 成立**。

**step 3–6（spawn 分支）**：`SpiderWideCell`（`side` × 等寬 pitch band）+ `buildSpiderWideCells()`（`2 × grid.pitchBands` = 4 cells，side-major 固定建表序，平衡由洗牌提供）+ `sampleSpiderWidePeripheralPose()`（耗盡才重建並以**同一個 `spawnRng`** 洗牌，沿用 WP-44 慣例，不新建 RNG）。`sampleSpiderShotPose()` 的新 kind 分支**先於** v1/v2 的 origin-frame 圓錐路徑返回；中心目標改為 `yaw = pitch = 0` 的球面解 `(0, PLAYER_EYE_HEIGHT_U, −distanceU)`，此 y 變更只發生在新 kind，`TARGET_Y` 與其既有使用者未動。`reset()` 一併清空 `spiderWideQueue`。新分支不讀寫 `nextSide`、不與 v1/v2 共用佇列狀態、不 import render／scene／時鐘／`Math.random`。

**NFR-57.1（四 FPS parity）**：`tests/regression/spiderWideDeterminismFixture.ts` 以出貨 resolved config（FOV 75 / 16:9）驅動生產同源管線 `createSimLoop({ translation: 'locked' }) + TargetManager + DrillRunner + HitDetector + DataRecorder`。canonical（每幀一 tick）為 **3,059 ticks / 17 spawns / 8 hits**；60 Hz（1,434 幀）、144 Hz（3,442 幀）、240 Hz（5,736 幀）、抖動 144 Hz ±50%（3,457 幀，模擬 rAF 節流）四條幀序列的**逐 tick `replayTargetId` + `tx/ty/tz` 與 spawn 序列逐位一致**，wall-clock 時間戳不入斷言。

**NFR-57.5（GD-10 aspect 不變性）**：同一 harness 在 run 中段（第 40% 幀）改 camera `aspect`／`fov`（16:9→21:9、16:9→4:3 且 FOV 75→120、16:9→1:2 且 FOV 75→60）後，逐 tick trace 與未 resize 對照組**逐位一致**；並以截斷 run 證明 resize 點之後對照組確實還有新 spawn（不變性不是測到空區間）。

**FR-57.6（覆蓋與平衡，10,000 個周邊 spawn）**：4 個 `side × pitchBand` cell 各 **2,500 次**（max − min = **0**，遠優於「差 ≤ 1 個佇列週期」的門檻）；2,500 個完整週期每個都恰好蓋滿 4 cell 一次且左右各 2 次；整體 L/R = **5,000 / 5,000**；每個 spawn 的 `side` 與落點 yaw 符號一致（FR-57.7）。

**FR-57.4（on-screen，走真實 spawn）**：`fovDeg ∈ {60,75,90,120}` × `aspect ∈ {16/9, 21/9, 4/3}` 共 12 組、每組 10,000 個周邊 spawn（**合計 120,000**），halfHFOV 由 resolved config 自身的 `resolvedFrom` 反推，兩條 NDC 不等式（含目標角半徑外緣、容差 1e-9）**failures = 0**。這與 T1 的 `spider-wide-geometry.test.ts` 互補：T1 掃純函式取樣空間，T2 掃 `TargetManager` 真正吐出的落點。

**NFR-57.7（零額外配置）**：於每個 `tick()` 前後計數 `Array.prototype.push`。中心 spawn 恆 **1 次**（僅 `state.targets.push(target)`）；周邊 spawn 為 **1 或 1 + 4** 次，且 `1 + 4` 恰好落在每個佇列週期的第一個周邊 spawn（實測重建發生於周邊序號 1、5、9、13、17，共 5 次 = 週期數）⇒ 沒有 per-spawn 暫存陣列／物件堆疊，佇列只在耗盡時重建。既有的 RNG 預算測試（每個周邊 spawn 恰 2 抽 + 每週期 `cells − 1` 抽洗牌）為同一結論的獨立佐證。

**FR-57.7 parity**：`spider-shot-wide-v1` 與 `spider-shot-v2` 並列跑同一組 `DrillRunner` 斷言 —— zone 由中心起算逐次交替、`centerExemptFromTimeout=true` 時中心目標逾時仍存活、周邊目標仍在 `peekTimeoutMs` 到期時撤除，三項行為完全一致。

**測試數**：`src/sim/TargetManager.test.ts` +9 case（該檔 65 tests 全綠）、`tests/regression/spider-shot-spawn-golden.test.ts` 8、`tests/regression/spider-wide-spawn-determinism.test.ts` 9、`tests/regression/spider-wide-schedule-invariants.test.ts` 23。

**零回歸**：`npm run typecheck` exit 0；全量 `npm test` **230 files passed + 1 skipped／2,314 tests passed + 2 skipped**（T1 收尾為 227／2,266，差額為本 task 新增測試與 worktree 內平行工作的 WP-56 測試）；既有決定性 regression（`determinism`、`moving-target-determinism`、`spray-determinism`、`projectile-determinism`、`longrange-tracking-determinism`）**零修改**通過；`npx vite build` exit 0（169 modules、1,196.96 kB／gzip 340.96 kB，僅既存 >500 kB 警告）。

**未觸碰**：worktree 內平行工作的 `docs/exec-plan/README.md`、`docs/exec-plan/DECISIONS.md`、`package.json`、`scripts/capture-wp56-visuals.mjs`、wp-56 captures、`docs/known_issue/KI-026-*.md` 全程未 stage。

## T3 evidence（2026-09-07）

**開工 HEAD**：`f3eb9de`（WP-56 T-exit 收尾後）。本 task 未跑 CodeGraph（T0 §2 已記錄 scene registry **無獨立檔案**：`availableScenes` 就在 `src/main.ts:136`，各場景一個 `src/scene/scenes/*.ts`，第二消費面是 `fpsTestHarness.ts:190` 的 `findSceneConfig()`）；本次以直接 Read 覆核該三處，並確認 `SceneConfig` 核心型別零修改（T3 invariant），故新增一筆 config + 一個 scene id 的 blast radius 仍為 local-to-registry。

**arena config（`src/scene/scenes/wide-flick-arena.ts`）**：`sceneId = 'wide-flick-arena'`（T1 `spiderShotWideV1Binding` 已宣告的同一 id）、`assetPackVersion = 'wide-flick-arena-v1'`、`clutterTier: 'low'`、`asset: null`、`propBounds: []`、`playerCorridor.halfWidthU = 0.000001`（沿用 `spider-shot-room`／`micro-flick-room` 的 locked-translation 慣例）。`proceduralRoom` 為 README §2.5.2 的更正值：`roomSize [18, 20, 4]`、`eyeZ: 0`**明確指定**、`floorY` 省略（KI-014 ⇒ 地板逐位維持 `y = 0`，resolver 的 pitch 上界以此為前提）、`eyeHeight: 1.6`、`fovDeg: 75`、顏色／燈光與既有 procedural 場景逐位相同。既有六個場景零修改；arena 未被任何既有 drill 引用。

**registry**：`availableScenes` 新增一列（`src/main.ts`）。**drill 的 roster 註冊未做**——`spiderShotWideV1Template` 缺 `spiderShot`，要靠 `resolveSpiderShotWideV1(fov, aspect)` 在 arm 時補齊，那條 `activeDrillConfig` 接線是 T6 的交付；T3 若先塞一個「以模組載入期 FOV 解析」的 roster 項，會把 aspect 凍在錯誤的時點。scene↔drill 綁定因此以 `spiderShotWideV1Binding.sceneId === wideFlickArena.sceneId` 的測試釘死。

**穿牆／埋地板的自動閘（T0 discovery item 11）**：新增 `src/scene/spiderWideArena.ts` —— `spiderWideArenaExtremes()`（落點包絡極值，取解析解：`x = d·sin(yaw)·cos(pitch)` 且 `cos(pitch) ≤ 1` ⇒ 側向極值必在 `pitch = 0`；`y` 只由 pitch 決定；`z` 最遠在中心目標、最近在 yaw 與 `abs(pitch)` 同時取上界）、`spiderWideArenaClearance()`（四牆 + 地板 + 觀測用的牆上緣）、`spiderWideTargetRadiusU()`、`requireSpiderWideArenaGeometry()`。後者由 `loadDrill()` 在 `validateClearance()` **之前**呼叫，與 `requireSpiderShotDeliveryGeometry()` 同一慣例與同一錯誤前綴；只認 `kind === 'center-peripheral-yawpitch'`，既有 kind 逐字不變（以 v1 幾何 × 預設房間、v1 幾何 × arena 兩個正向 case 釘死）。閘同時擋下 `eyeHeight ≠ PLAYER_EYE_HEIGHT_U`（GD-6 脫鉤）、eye anchor ≠ `(0, 1.6, 0)`（含「刪掉 `eyeZ` 吃 fallback = 9」與 `eyeZ: 4` 兩個負向面）與缺 `proceduralRoom` 的場景。

**落點淨空（DoD 第三項）**：`tests/regression/spider-wide-arena-geometry.test.ts` 對 `fovDeg ∈ {60,75,90,120}` × `aspect ∈ {16/9, 21/9, 4/3}` 的 12 組，每組列舉 yaw 窗的兩端點 + 3 個內點（0.25／0.5／0.75）× 左右兩側 × pitch 窗的兩端點 + 3 個內點，再加中心目標 = **每組 51 個落點、合計 612 個**，逐點斷言 hitbox AABB 對四牆與地板的淨空 ≥ `CLEARANCE_MARGIN_U`。全域最緊的面是**地板**（`0.5547 u`），不是側牆。

**README §2.5 逐列**：中心目標 `(0, 1.6, −8)`、後牆間距 `1.8604`；16:9 × FOV 120 上界 `(±7.5322, y, −2.6955)`、側牆餘裕 `1.4678`／外緣淨空 `1.3281`；16:9 × FOV 60 下界 `(±5.1520, y, −6.1202)`、側牆淨空 `3.7083`；pitch `+6.5°` → `y = 2.5056`、上緣 `2.6453`（< 牆上緣 4，牆上緣淨空 `1.3547`；房間無天花板幾何）；pitch `−6.5°` → `y = 0.6944`、下緣 `0.5547`（> 0.5）。§2.4 的側向 `abs(x)` 四列（`5.515`／`6.273`／`6.831`／`7.532`）亦逐列相符。半寬需求以**跨 aspect 最壞值**（21:9 × FOV 120）覆驗，不只表列的 16:9。

**FR-57.9 負向證據**：純函式側 —— 預設 `[10, 10, 3]` 的 16:9 四個 FOV 檔位，pitch 0 落點區間逐列相符（`[5.1520, 5.5146]`／`[5.8986, 6.2725]`／`[6.4674, 6.8308]`／`[7.2318, 7.5322]`），且**含 pitch 極值內縮後的全域最小側向落點**仍 > 側牆 5.0，`sideWallU < 0`。閘側 —— 補上 `eyeZ: 0` 的預設尺寸房間在四個 FOV 檔位全數被 `loadDrill()` 擋下（訊息帶各面淨空）。牆高不是障礙（`wallTopU > 0`），後牆才是第二個問題（`backWallU < 0`，即 KI-012）⇒ 負向結論只能建立在**側牆**上，此結論已成為測試而非註解。

**`validateClearance()`**：arena × 四個 FOV 的已解析 drill 全數零違規（零 props ⇒ 無可違規者），並確認 `CLEARANCE_MARGIN_U === 0.5` 未被改動。

**GD-6 方向性**：新增掃描斷言 `src/sim/**` 內沒有任何檔案 import `spiderWideArena` 或任何 `*/scene/*` 模組（scene 幾何只能被 render／scene validation 層讀取）。

**Verification**：`tests/regression/spider-wide-arena-geometry.test.ts` 19 tests + `src/scene/scenes/wide-flick-arena.test.ts` 9 tests 全綠；targeted `src/drill src/scene tests/regression` **63 files／600 tests passed**；`npx tsc --noEmit` 與 `npx tsc --noEmit -p tsconfig.node.json` 皆 exit 0；全量 `npx vitest run` **234 files passed + 1 skipped／2,353 tests passed + 2 skipped**（T2 收尾為 230／2,314）；`npx vite build` exit 0（1,205.13 kB／gzip 343.29 kB，僅既存 >500 kB 警告）。Playwright 未於 T3 執行（無 UI 行為變更；全量屬 T-exit 的 NFR-57.8）。

**明確未交付（DoD 最後一項）**：步驟 8 的 FOV 60／75／120 三張**實機截圖**與 OQ-57.3 的初步觀察**未做**，改由 T6 交付。理由：截圖要「顯示中心目標與左右最大 yaw 落點」，就必須讓 drill 能從研究者控制列載入，而那需要 arm-time resolve 接線（T6 的交付）。使用者於 2026-09-07 明確選擇「延到 T6」。T6 本來就同時擁有 OQ-57.3／57.4 的回填責任，故此延後不新增遺留風險，但**T3 的視覺空曠風險（README §3.1）在 T6 之前沒有任何實機證據**。

**未觸碰**：worktree 內的 `.claude/settings.local.json`、`docs/exec-plan/README.md`（其 stage12 區塊為平行 session 擁有的未提交規劃產物，WP-56 T-exit 已揭露同一情況）、untracked `.wp56-capture-tmp/` 全程未 stage。

## T4 evidence（2026-09-07）

**開工前提**：OQ-57.7 已於 2026-09-07 由 KI-026／BD-026／[GD-32](../../../DECISIONS.md) ④ 拍板為**選項 (b)** 並落地（commit `567eaf6`）。故本 task 的所有期望值一律以 **eye-frame** 為準；README §2.5.1／§T0 audit ⑥⑧ 記載的 origin-frame 偏差數字（`27.937°`／`43.6%`／`2.408°`／`4.0%`／`W_deg ∈ [1.9198, 2.0053]`）是**拍板前**的量測，只有歷史意義，未被寫進任何測試。

**步驟 1（證明而非新增管線）**：`main.ts:741` 的 `...(activeDrillConfig.spiderShot !== undefined ? { spiderShot: activeDrillConfig.spiderShot } : {})` 把整塊 resolved 排程複製進 `meta.spawn.spiderShot`（`metadata.ts:25` 宣告為 opaque `unknown`），`parseExportPayload()` 的 `parseSpawnMeta()`（`exportPayloadSchema.ts:485-493`）同樣原樣 pass-through、不深驗。⇒ **schema 型別零修改**：resolved 參數只要在 resolved config 裡就自動落匯出。本 task 因此沒有動 `metadata.ts`／`exportPayloadSchema.ts`／`main.ts`。

**步驟 2–3（round-trip，`tests/regression/spider-wide-export-roundtrip.test.ts`，10 tests）**：payload 取自 **真實 run**（`spiderWideDeterminismFixture` 的 `SimLoop`＋`TargetManager`＋`DrillRunner`＋`HitDetector`＋`DataRecorder`），meta 組裝逐行對齊 `main.ts` 的 `spawn`／`targets`／`scene` 三段，再走 `serializeJSON → JSON.parse → parseExportPayload`。實測：

| 量 | 值 |
|---|---|
| transitions／outbound | 16／8 |
| `yawMagDegRange`（FOV 75、16:9） | `[47.503588, 51.634335]`，round-trip 後 `Object.is` 逐位相同 |
| `pitchDegRange` | `[−6.5, 6.5]`，逐位相同 |
| `resolvedFrom` 五欄 | `fovDegVertical=75`、`aspect=1.7777777777777777`、`screenMargin=0.04`、`kLo=0.92`、`targetAngularDiameterDeg=2`，全部 `Object.is` 相同 |
| 由匯出欄位重算 yaw 窗 | 以 `resolvedFrom` 五欄套 README §2.4 閉式，與匯出的窗上下界相符至 1e-12 |
| 每個實錄 spawn 的重建 | `spiderWideEyeAngles()` 反解後 `distanceU` 恆 8、`abs(yaw)` 落在窗內、`pitch` 落在窗內 |
| `worldDistanceU` | **恆為 `8.000000000000`**（translation locked ⇒ 眼睛恆在 `(0, 1.6, 0)`） |
| `angularSizeDeg`（`W_deg`） | **恆為 `2.000000000000`** —— eye-frame 修正後即設計值本身 |
| `angularDistanceDeg`（`D_deg`） | `47.872937` ～ `51.558670`，落在 WP DoD 的 45–55° 帶內 |
| condition cell 樣本 | `spider:d=49.507811;w=2.000000`（格式未變、不含 pitch／side） |

`meta.targets.hitbox` 與 `targetHitboxToConfig(resolveTargetHitbox(config))` 逐位相同、`shape: 'sphere'`、三軸等值（GD-7 單一來源），且 `transition.hitbox.width === meta.targets.hitbox.widthU`。

**步驟 4–5（`side`）**：`SpiderShotTransition` 新增 additive optional `side?: 'L' | 'R'`，由抵達點的 **eye-frame `x`** 符號讀出（`x > 0 → 'R'`、`x < 0 → 'L'`、`x === 0` 省略欄位），只對 `center-to-peripheral` 輸出，eye 沿用既有 `resolveEyeOrigin()` + `eyeOriginForTick()`（不新增第二套 eye 來源）。實測：真實 run 的 8 個周邊到達，離線推導 `L,R,L,R,L,R,L,R` 與 `DataRecorder` 記錄的 spawn `side` **逐筆相同**（sim 端的分層佇列 cell side 與離線符號讀取不分歧）。既有 v1/v2 fixture 的七個欄位（`angularDistanceDeg`／`angularSizeDeg`／`quadrant`／`targetConditionCell`／`worldDistanceU`／`hitbox`／`seed`）輸出逐位不變，並新增「對移動中的眼睛取符號」的負向測試（玩家 +4 u 位移後，世界 `x = 3` 的目標正確判為 `'L'`）。

**步驟 6（`counts/360`／`cm/360`）**：新增 `src/metrics/mouseThrow.ts` 的 `deriveMouseThrow(payload)`。gain 一律取自 `resolveMouseGain()`（KI-005 唯一定義，C-D4：不重寫公式），本模組只做單位換算。實測 sensitivity 2 / dpi 800 → `countsPer360 = 8181.818181818182`、`cmPer360 = 25.977272727272727`，與手算閉式 `360 ÷ (2 × 0.022)` 及 `÷800 × 2.54` 相符至 1e-9；ADS 分支（`fovDeg 75`、`ads {60, 0.8}` ⇒ gain 0.64）→ `adsCountsPer360 = 12784.090909090908`。`meta.dpi` 缺席時 `cmPer360`／`adsCmPer360` 回 `undefined`（`countsPer360` 不需 DPI，仍成立）；`meta.fovDeg` 缺席時 ADS 兩欄回 `undefined`，且 hip 一欄與有 FOV 的匯出**逐位相同**（證明佔位 FOV 對結果無影響）。

**步驟 7–8（文件）**：`docs/operational/analysis-spider-shot.md` 新增 wide 變體段（eye-frame 幾何、`resolvedFrom` 五欄與「為什麼是刻意冗餘」、`side` 兩個來源的對照表與浮點殘值警告、不變契約清單、`cm/360` 推導）；同時把兩處無條件的「`side` 恆為 `'R'`」改為指名 `center-peripheral(-stratified/-eye-stratified)` 三支，避免與 wide 的真實左右矛盾。`CONTEXT.md` 新增五個術語列（`center-peripheral-yawpitch`／eye-frame 球面／`resolvedFrom`／`side` 的兩個來源／`counts-cm per 360`），並同步修正既有 `zone` 列的同一處無條件敘述。

**步驟 9（Verification）**：targeted `src/metrics src/data tests/regression tests/golden` → **71 files／636 tests passed**；`npx tsc --noEmit` 與 `npx tsc --noEmit -p tsconfig.node.json` 皆 **exit 0**；全量 `npm test` → **236 files passed + 1 skipped／2,373 tests passed + 2 skipped**（T3 收尾為 234／2,353，差額 20 = 本 task 新增）；`npm run build` **exit 0**、1,205.13 kB（gzip 343.29 kB），僅既存 >500 kB 警告。`graphify update .` → 590/590 code files、4450 nodes／10843 edges／273 communities。Playwright 未於 T4 執行（無 UI 行為變更；全量屬 T-exit 的 NFR-57.8）。

**production 修改面**：只有 `src/metrics/spiderShotConditions.ts`（additive optional 欄位 + 一個 8 行的符號讀取函式）與新檔 `src/metrics/mouseThrow.ts`。`spiderShotMetrics.ts`／`TargetManager.ts`／`schema.ts`／`DrillConfig.ts`／`metadata.ts`／`exportPayloadSchema.ts`／`main.ts` **零修改**。

## T6 evidence（2026-09-08）

**開工 HEAD**：`f17d151`（T4 收尾），worktree clean。本 task 未跑 CodeGraph：接線面是 T0 §0 item 13 已逐行記錄的三處（roster、`activeDrillConfig` 賦值點、`createTargetManager` 消費點），且該檔在 T0 之後已由平行工作重構（`activateDrill()` 收斂了原本的兩個賦值點），故以直接 Read 覆核當時的實況；`SceneConfig`／`DrillConfig` 核心型別零修改。

### 接線（步驟 1–4）

`main.ts` 的 roster 項型別新增 optional **`resolveSource?: () => unknown`**，並新增單一收斂點 `drillSourceFor(option)`。wide 是唯一使用它的項：`resolveSource: () => resolveSpiderShotWideV1(settingsPanel.fov, sceneManager.camera.aspect)`。

- **呼叫時點**：`loadDrillById()` 內、`activateDrill()` **之前**。這比 T6 步驟 2 原本寫的「在兩個 `activeDrillConfig` 賦值點各呼叫一次」更小也更安全：T0 之後 `main.ts` 已把兩個賦值點重構成共用的 `activateDrill()`，故一個呼叫點即涵蓋換 drill 與 protocol 驅動的載入；而放在 `activateDrill()` 之前使 resolver 的 typed error（FR-57.14）在**任何** activation 狀態被觸碰之前就擲出（不會留下半換的 scene generation／weapon override）。錯誤沿既有 `runControl` 失敗路徑呈現（`console.error` + `window.alert`），不 crash、不靜默回退到別的 drill。
- **`loadSceneById()` 不重解析**：它以 `activeDrillSource` 重驗場景，而 wide 的 `activeDrillSource` 就是**已解析的 config 物件**（`loadDrill` 同時吃字串與物件），故換場景不會重讀 aspect。這正是 NFR-57.5 想要的語意；且 wide 綁 `wide-flick-arena`，任何其他場景都會被 T3 的 `requireSpiderWideArenaGeometry()` 擋下。
- **resolver 不在 render callback 內**：`resolveSource` 只被 `drillSourceFor()` 呼叫，呼叫端只有 `loadDrillById()` 與 harness 的 `startDrill()`。
- 其他 roster 項的 `source`／`sceneId` 逐字未動（`source` 由 required 改為 optional，值全部不變）。
- `fpsTestHarness` 的 `HarnessDeps.availableDrills` 同步接受 `resolveSource`，且**在每次 `startDrill()` 時呼叫**（不是 bootstrap 時）。這是刻意的：harness 的 `startDrill()` 就是一次 arm，否則 resize 不變性 E2E 會比較兩個「在 bootstrap 就解析完」的 run，什麼都證不到。

### E2E（步驟 5）—— `tests/e2e/spider-shot-wide.spec.ts`，4 tests，Edge 全綠

| Test | 內容 | 實測 |
|---|---|---|
| arm-time provenance | researcher `#drill-select` → `#scene-select` 變 `wide-flick-arena`；live 中心目標逐位為 `(0, 1.6, −8)`（`y = 1.6` 同時排除走錯 spawn 分支——legacy 錐路徑用 `TARGET_Y = 1.5`）；匯出 `resolvedFrom` 五欄 = `{75, 1280/720, 0.04, 0.92, 2}`；改 FOV 滑桿至 60 後**重新 arm** → `fovDegVertical` 變 60 且 yaw 窗嚴格收窄 | `@1280×720`：FOV 75 → `[47.5036, 51.6343]`；FOV 60 → `[40.0909, 43.5771]`（與 T1 表逐列相符） |
| on-screen（FR-57.4 實機） | 60 個 500 ms tap 的真實 run；每個 `visible` 事件的座標經 `spiderWideEyeAngles()` 還原後套 `ndcForEyeAngles()`（外緣推一個角半徑、容差 1e-9） | 61 spawns（30 周邊）、**失敗數 0**；最壞 `abs(ndc_x) = 0.95554`、`abs(ndc_y) = 0.25917`（界 0.96）；`distanceU` 逐個 = 8；L/R = 15/15；zone 由中心起嚴格交替 |
| `centerExemptFromTimeout` | 不開火閒置 `3 × peekTimeoutMs` → 只有 1 個 `visible`（中心）且 phase 仍 `running`；改為先殺中心再閒置 → `center, peripheral, center` 且第三個的 `t` 與第二個相距 `[2500, 2500 + 2 tick)` | 中心不逾時、周邊在 2,500 ms 準時撤除 |
| resize 不變性（NFR-57.5 實機） | run A 在 16:9 arm、跑 20 tap → resize 到 **5:4**（1280×1024，真的換 aspect）→ 再跑 20 tap；run B 為同樣兩批但不 resize 的對照組 | 41 個 spawn 的 `targetId`／`zone`／`side`／`pos`／`t` **逐位一致**；`resolvedFrom` 兩者相同 |
| resize 真的到了 camera | resize 後**重新 arm** 一次 | `resolvedFrom.aspect` = `1280/1024`、`yawMax` 由 `51.6343` 降到 `41.6386` ⇒ 不變性不是「resize 沒生效」的假陽性 |
| translation locked（FR-57.8） | live run 依序按放 W/A/S/D | `player` 除 `vx/vz = 0`、`stopped = true` 外逐位不變 |
| mouse aim 仍活著 | 同一個 live run 取得原生 Pointer Lock 後 dispatch `movementX/Y` | `aim.yaw`／`aim.pitch` 皆改變、`player.x/z` 不變 |
| practice-only（FR-57.13） | `saveToHistory()` 走 live 的同一個 `historyPersistence` | 回 `{ kind: 'excluded', reason: 'practice' }`；匯出無 `meta.assessment`／`meta.session`；以真實 payload 呼叫 `buildCompatibilityKey()` 會擲錯 ⇒ 產不出 compatibility cell |

registry 的 exact-id／near-miss／replay-profile 負向面沿用 T1 的 `spider_shot_wide_v1.test.ts`（純函式、已綠），**未在 E2E 重複**：`DrillMetricRegistry` 無法 import 進 e2e spec（其 scene-config 鏈會拉到一個 Playwright loader 拒收的 JSON module），詳見 Surprises 24。

### 實機截圖與 OQ 回填（步驟 6–7）

`scripts/capture-wp57-visuals.mjs`（`npm run capture:wp57-visuals`）為可重跑 runner：走真實 researcher 入口 + 原生 Pointer Lock，每個 FOV 檔位輸出 3 張 1920×1080 —— 中心目標，以及左／右各一個近邊界周邊目標（**在瞄向它之前**截圖，即準星還停在中心的那一瞬間，才是玩家偵測時真正看到的構圖）。產物在 [captures/](captures/) 與 `captures/metadata.json`。

| FOV | yaw 窗（度） | 截圖中的實際落點 | 周邊目標中心 `abs(ndc_x)` 區間 |
|---|---|---|---|
| 60 | `[40.091, 43.577]` | L `yaw −41.71°`、R `yaw +40.82°`（pitch ∓3.46°） | `[0.820, 0.927]` |
| 75 | `[47.504, 51.634]` | L `−49.42°`、R `+48.37°` | `[0.800, 0.926]` |
| 120 | `[64.685, 70.310]` | L `−67.29°`、R `+65.87°` | `[0.687, 0.908]` |

**視覺 review（D-57.T3-3，arena 第一次被人眼看到）**：

- **完整可見、不被切**：三個 FOV 檔位、左右兩側共 6 張周邊截圖，目標整顆都在畫面內且離螢幕邊還有可見餘裕（FOV 75 右側落在 `x ≈ 1758 px`／1920，球右緣距邊 ≈ 135 px）。**FR-57.4 的實機驗收 Pass。**
- **視覺空曠（README §3.1 風險，確認成立）**：arena 是純色暗灰盒、無天花板幾何、零 props，只有地板／側牆／後牆的明度階與交線可作參照。這使偏心度沒有任何場景線索可估——對「周邊偵測」構念是乾淨的（無雜訊），但畫面確實比 WP-56 走廊空得多。
- **可辨識度**：紅球對牆面對比清楚可見；但在 1080p、2.0° 角徑下，中心目標只有約 29 px 直徑，讀起來是「暗牆上的一個小紅點」。
- **大 FOV 的形變（新發現，非既有風險）**：直線透視在大離軸角把球拉扁——FOV 120 的周邊目標呈約 **2.4:1 的橢圓**（見 `peripheral-L-fov120.png`）。角**徑**由 `spiderWideEyePos()` 保證恆定（`distanceU` 逐個 = 8），但**表觀形狀**不恆定。這是正確的投影行為、不是缺陷，但會影響大 FOV 下的主觀難度，已記入 Surprises 25。
- 無槍／手／muzzle、無 Kovaak 式 editor／FPS／ammo UI；HUD 與準星維持既有呈現。

**OQ-57.3（`kLo` / `screenMargin`）→ 維持候選值不動**（使用者，D-57.T6-1）。同時量到一個規劃期未記載的性質：`kLo = 0.92` 是套在**度**上，而 `ndc_x = tan(yaw)/tan(halfHFOV)` 是凸函數，所以 NDC 上的貼邊程度會隨 FOV 漂移——窗下界在 FOV 60 是邊界（0.96）的 **85.4%**、FOV 75 的 **83.3%**、FOV 120 只有 **71.5%**。即 D-57.P2 想要的「每位選手同樣貼邊」在 NDC 意義下只是近似成立。入帳為已知限制（Surprises 26），不改公式。

**OQ-57.4（時序）→ `timeLimitMs` 由 `90000` 改為 `60000`**（使用者，D-57.T6-2）；`peekTimeoutMs = 2500` 維持。每 cell 樣本數以出貨 config 實機掃描（3 個 FOV × 5 種 per-trial 節奏，各跑完整一輪到 `phase = 'ended'`）：

| per-trial 節奏 | 周邊到達 | 最小/cell | vs 規劃期的 14/cell 標準 |
|---|---|---|---|
| 600 ms | 50 | 12 | 未達 |
| 800 ms | 38 | 9 | 未達 |
| 1,000 ms | 30 | 7 | 未達 |
| 1,200 ms | 25 | 6 | 未達 |
| 1,500 ms | 20 | 5 | 未達 |

三個 FOV 檔位的掃描結果**完全相同**（節奏決定次數，FOV 不影響時序）——這本身是一致性檢查。改值前以 90 s 量過同一組：`75/57/45/38/30` 次到達、`18/14/11/9/7` per cell ⇒ **README §1.5 宣稱的「90 s ≈ 56 次 ≈ 14/cell」只在 ≤800 ms 的節奏成立**，那是規劃期的一個樂觀估計。使用者在看過兩組數字後仍選 60 s，理由是 v1 為 practice-only 且**明確不宣稱信度**（C-D3：無指標進教練報告或 `DrillMetricRegistry`）；樣本量問題明確移交晉升 WP（README §5 handoff 已列）。

**timeout 率仍未收斂，且刻意不合成**：harness 以解析式 `aimAtActiveTarget()` 瞄準，其 timeout 率恆為 0（by construction），把它當作人類 timeout 率會是造假。可客觀量到的是**截斷邊界本身**（周邊目標在 `peekTimeoutMs` 準時撤除），已寫成 E2E 斷言。OQ-57.4 因此標為部分收斂。

### Verification（步驟 8）

| Gate | 命令 | 結果 |
|---|---|---|
| typecheck | `npm run typecheck` | **exit 0**（browser + node tsconfig） |
| targeted | `npx vitest run src/drill tests/regression src/scene` | **65 files／614 tests passed** |
| 全 Vitest | `npm test -- --reporter=default` | **237 files passed + 1 skipped／2,377 tests passed + 2 skipped**（T4 收尾為 236／2,373）。**差額不屬本 task**：本 task 沒有新增 Vitest 檔（新測試是 Playwright spec），只改了 `spider_shot_wide_v1.test.ts` 一條既有斷言的期望值（90000 → 60000）。`+1 file／+4 tests` 已逐項確認來自 worktree 內平行工作的未追蹤檔 `src/drill/micro_flick_three_target_test_variants.test.ts`（單獨跑 = 1 file／4 tests）|
| build | `npm run build` | **exit 0**、1,210.90 kB（gzip 344.70 kB），僅既存 >500 kB 警告 |
| WP-57 E2E | `npx playwright test tests/e2e/spider-shot-wide.spec.ts --project=edge --workers=1` | **4 passed**（6.0／2.7／2.6／6.1 s） |
| capture runner | `npm run capture:wp57-visuals` | **exit 0**、9 張截圖 + metadata；teardown 後 5173／5174 皆 free |
| 全 Playwright | `npm run test:e2e` | **90 passed／1 failed** —— 該失敗為既存的 **[KI-027](../../../../known_issue/KI-027-overlay-layering-researcher-submenu-guard-dead.md)**（`overlay-layering.spec.ts:74` 的 `overlapsSettingsPanel(7)` 回 `null`，helper 硬編 7 顆 launch button 而 `ResearcherMenu` 自 WP-54 起有 4 項子選單＝8 顆）。WP-57 只在既有 **下拉選單**各加一個 drill／scene，未新增任何 researcher menu 按鈕，故按鈕數未變、失敗簽名與 WP-56 T-exit 記錄的完全相同（該次為 86 passed／1 failed，本次 +4 即本 task 的新 spec）。依 scope 紀律不在本切片內修 |

**Worktree 狀態揭露**：執行期間 worktree 出現**不屬本 task**的平行未追蹤工作（`src/drill/micro_flick_three_target_test_v2/v3/v4.ts`、`micro_flick_three_target_test_variants.test.ts`、`src/scene/scenes/micro-flick-room-v2/v3/v4.ts`、`public/assets/scenes/micro-flick-room-v2/v3/v4/`）以及已被該工作改動的 `graphify-out/*`。上述 Vitest 數字因此涵蓋那份工作；本 task 只 stage 自己的檔案，未觸碰、未改寫該工作。**`graphify update .` 刻意延後**（比照 T1／T3 的處理）：`graphify-out/*` 已帶平行工作的未提交變更，現在重跑會把我的索引寫進他們的 diff 裡，反而更難分離。

**Server 環境揭露**：開工時 5173 上有一個**不屬本 task**的 dev server，且它租用的是**真實** `data/session-history/`；已先停掉，讓 Playwright 自己起帶 `.playwright-tmp/history-dev`／`-preview` 的兩個 server（事後確認兩個 temp root 都建立、真實根目錄本次無任何新 run 資料）。WP-56 T-exit 記錄的 3 項 preview root-lock（HTTP 423）失敗本次**未重現**，而且這次兩個 server 確實各持自己的 lease（不是被環境繞過）。細節與真實根目錄的既存 fixture 殘留見 Surprises 28／29。

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
| D-57.T2-1 | 2026-09-07 | **v1/v2 golden 以生產路徑錄製並先行 commit**（`3548ccc` 早於分支 commit `56e7d99`，該 commit `src/` diff = 0），而非在改完後才錄。<br>**Alternatives considered**：(a) 改完再錄 —— 只會把改壞後的行為蓋章成「預期」，NFR-57.2 失去證明力，**駁回**；(b) 手寫期望座標表 —— 需要在測試裡重寫一份取樣器，任何 RNG 消費順序的偏移都測不出來，**駁回** | Engineering | `spider-shot-spawn-golden.test.ts` 8 tests；commit 順序可證 |
| D-57.T2-2 | 2026-09-07 | **中心 zone 的 `side` 沿用 v1/v2 的 `'R'` 佔位**，真實左右只由周邊 spawn 承載。理由：中心目標在正前方，左右無定義；讓它承載假的方向會汙染 FR-57.7 的離線分流。<br>**Alternatives considered**：(a) 中心沿用上一個周邊的 `side` —— 會讓「side = 刺激方向」這個語意在中心 trial 上說謊，**駁回**；(b) 把 `side` 改成 optional —— 動到 `TargetState` 的既有欄位契約與 115+ consumers，超出本 task 範圍，**駁回** | Engineering | `TargetManager.test.ts` 交替／side 測試 |
| D-57.T2-3 | 2026-09-07 | **NFR-57.1／57.5 的 harness 以「零散佈武器射中心目標」驅動 spawn 循環**（`usp_s_laser`，recoil／inaccuracy 全 0；固定 aim yaw = pitch = 0），形成「中心命中 → 周邊 spawn → 周邊逾時撤除 → 中心 spawn」。理由：本 drill 的 `centerExemptFromTimeout: true` 讓無輸入的 headless run 永遠停在第一顆中心目標，parity 斷言會退化成單一樣本。<br>**Alternatives considered**：(a) 在 harness 內關掉 `centerExemptFromTimeout` —— 測到的就不是出貨 config，**駁回**；(b) 合成滑鼠軌跡去瞄周邊目標 —— aim 更新只能發生在幀邊界，等於把 harness 自己的幀切法帶進刺激，正好汙染 FPS parity 的歸因，**駁回**；(c) 用 `ak47` —— 後座力／散佈會讓命中與否隨武器 RNG 變動，循環可能斷開，且彈道決定性另有 `spray-determinism` 專責，**駁回** | Engineering | `spiderWideDeterminismFixture.ts`；3,059 ticks／17 spawns／8 hits |
| D-57.T2-4 | 2026-09-07 | **NFR-57.7 以直接覆寫 `Array.prototype.push` 計數落地**（try/finally 還原，同步迴圈內），斷言「中心 spawn 恆 1 次、周邊 spawn 1 或 1 + cells、且 `1 + cells` 只出現在每週期第一個周邊 spawn」。<br>**Alternatives considered**：(a) `vi.spyOn(Array.prototype, 'push')` —— spy 自己會把呼叫 push 進 `mock.calls` 而無限遞迴，**技術上不可行**；(b) `process.memoryUsage()` 差分 —— GC 噪音使門檻不可重現，**駁回**；(c) 只靠既有 RNG 預算測試 —— 能證明佇列重建節奏，但證明不了「沒有 per-spawn 暫存陣列」，**故兩者並存** | Engineering | `spider-wide-schedule-invariants.test.ts` NFR-57.7 段 |
| D-57.T3-1 | 2026-09-07 | **穿牆／埋地板做成 `loadDrill()` 的 fail-fast 閘**（`requireSpiderWideArenaGeometry()`，比照 `requireSpiderShotDeliveryGeometry()`），而不只是測試裡的斷言。理由：T0 discovery item 11 的缺口是**runtime 沒有保護**，只補測試的話，任何日後改 `roomSize`／換場景綁定的人仍會靜默走進 KI-012（牆全遮但命中仍過）。<br>**Alternatives considered**：(a) 只寫幾何測試 —— 零 runtime 保護，**駁回**；(b) 把牆／地板加進 `validateClearance()` —— 那會改到 84 callers／22 模組共用的既有淨空語意，且既有場景（如 `placeholder-room` 的 v1/v2 目標）未必全數通過，屬跨 WP 變更，**駁回**；(c) 擴充 `SceneConfig` 型別帶「可用落點包絡」—— 直接違反 T3 invariant「不擴充核心型別」，**駁回** | Engineering | `spider-wide-arena-geometry.test.ts` 閘段 6 tests |
| D-57.T3-2 | 2026-09-07 | **目標外緣半徑對 `shape: 'sphere'` 取 `width/2`，不沿用 `targetHitboxRadius()` 的角點半徑**（`spiderWideTargetRadiusU()`）。半徑仍**只**從 `resolveTargetHitbox()` 推導，維持 GD-7 單一來源。<br>**Alternatives considered**：(a) 直接用 `targetHitboxRadius()` —— 對球會回 `√3·r = 0.2419`（誇大 73%），README §2.5 全表數字（`1.8604`／`1.3281`／`0.5547`…）會全部對不上，且會把「保守估計」偷偷變成「不同的幾何」，**駁回**；(b) 為 wide drill 另立半徑常數 —— C-D4 第二定義，**駁回** | Engineering | `spider-wide-arena-geometry.test.ts` 半徑同源段 |
| D-57.T3-3 | 2026-09-07 | **drill 的 roster 註冊（`availableDrills`）與步驟 8 實機截圖留給 T6**；T3 只註冊 scene 並以測試釘死 `spiderShotWideV1Binding.sceneId === wideFlickArena.sceneId`。<br>**Alternatives considered**：(a) T3 就把 drill 塞進 roster —— `spiderShotWideV1Template` 缺 `spiderShot`，唯一做法是在模組載入期解析一次，等於把 aspect 凍在錯誤時點並繞過 NFR-57.5 的整個論證，**駁回**；(b) 把 T6 的 arm-time 接線整段拉進 T3 以便截圖 —— 一個切片混兩個 task，且 T6 的 resize 不變性／on-screen E2E 仍未寫，**由使用者於 2026-09-07 明確選擇不採** | 使用者 + Engineering | 本節「明確未交付」段 |
| D-57.T4-1 | 2026-09-07 | **`side` 以嚴格符號讀取，不加任何容差**：`x > 0 → 'R'`、`x < 0 → 'L'`、`x === 0` **省略欄位**。<br>**Alternatives considered**：(a) 加一個 epsilon 門檻（如 `abs(x) < 1e-9` 視為無左右）—— 等於為 `side` 發明第二套幾何容差（C-D4），且門檻值沒有任何構念依據，**駁回**；(b) `x === 0` 時沿用上一個 side 或固定回 `'R'` —— 猜了就無法在資料上分辨「沒有左右語意」與「在右邊」，**駁回**；(c) 把 `side` 塞進 `targetConditionCell` —— 會改動 `DrillMetricRegistry.ts:281` 保護的既有相容鍵格式，直接違反 FR-57.11，**駁回**。代價已知並記名：v1/v2 的近垂直呈現可能因浮點殘值輸出無意義的 side（見 Surprises 11），以文件 + 測試揭露而非以閾值遮蔽 | Engineering | `spiderShotConditions.test.ts` side 段 4 tests |
| D-57.T4-2 | 2026-09-07 | **round-trip 測試的 payload 取自真實 run**（`spiderWideDeterminismFixture` additive 暴露 `DataRecorderSnapshot`），meta 組裝**逐行對齊 `main.ts`** 的 `spawn`／`targets`／`scene` 三段。<br>**Alternatives considered**：(a) 手寫合成 payload —— 只證明「我寫的物件能被 parse 回來」，證明不了生產路徑真的把這些欄位寫出去，**駁回**；(b) 把 `main.ts` 的 meta 組裝抽成可測純函式 —— 那是正確的長期重構，但會動到 `main.ts` 這個 T6 才該碰的接線點，且本 task 的 DoD 是「證明既有管線」而非改它，**駁回（留給 T6／後續 WP）**；(c) 走 `fpsTestHarness` —— 它是 dev-only 觀測縫，不含匯出組裝，**不適用** | Engineering | `spider-wide-export-roundtrip.test.ts` 10 tests |
| D-57.T4-3 | 2026-09-07 | **`deriveMouseThrow()` 落在 `src/metrics/mouseThrow.ts` 並 import `resolveMouseGain()`**；`cmPer360` 採**欄位級** `undefined`（DPI 缺席時只有 cm 兩欄消失，`countsPer360` 仍回值）。<br>**Alternatives considered**：(a) 在 metrics 內重算 `sensitivity × 0.022°` —— gain 公式的第二定義，正是 C-D4／KI-005 明令禁止的形狀，**駁回**；(b) DPI 缺席時整個函式回 `undefined` —— `counts/360` 不需要 DPI，整組放棄會讓 T5 在沒有 DPI 的 run 上完全拿不到感度軸，**駁回**；(c) 新增一個 `meta.cmPer360` 匯出欄位 —— 違反「不新增輸入欄位」且會與 `sensitivity`／`dpi` 形成第二個真相來源，**駁回**。**已知代價**：`src/metrics/` 首次出現對 `three` 的傳遞依賴（`mouseGain.ts` 用 `THREE.MathUtils`）。實測 bundle 大小與 T3 相同（1,205.13 kB）—— 本模組目前只走離線路徑、無 production import；若日後要讓 `research/` 側消費，應改為把 `RAD_PER_COUNT` 抽成無 three 依賴的常數模組，而不是在 metrics 重寫公式 | Engineering | `mouseThrow.test.ts` 6 tests；build 大小對照 |
| D-57.T6-1 | 2026-09-08 | **OQ-57.3 收斂：`kLo = 0.92` 與 `screenMargin = 0.04` 維持不動。** 三個 FOV 檔位的實機截圖證明「完整可見、不被切」成立，故契約層的 FR-57.4 已滿足。同時揭露一個規劃期未記載的性質並入帳為已知限制：`kLo` 套在**度**上而 `ndc_x = tan(yaw)/tan(halfHFOV)` 是凸函數，故窗下界的 NDC 位置隨 FOV 從邊界的 85.4%（FOV 60）漂到 71.5%（FOV 120）。<br>**Alternatives considered**：(a) 把 `kLo` 改成 NDC 定義（窗下界 = `atan(kLo·(1−screenMargin)·tan(halfHFOV)) − r`）—— 這才是「每位選手同樣貼邊」（D-57.P2）的精確落地，但會改 T1 已凍結的 resolver 公式、README §1.5／§2.4 全部數字與 T1／T2／T3 的相關斷言，**使用者選擇不採**；(b) 只把 `kLo` 調高到 0.97 —— 收窄窗但不修正跨 FOV 漂移本身，**未採** | 使用者 | 本節 §T6 的 NDC 區間表；`captures/` 九張截圖 |
| D-57.T6-2 | 2026-09-08 | **OQ-57.4 部分收斂：`timeLimitMs` 由 `90000` 改為 `60000`**；`peekTimeoutMs = 2500` 維持。<br>⚠️ **這推翻了規劃期的理由**：README §1.5 原本明文「60 s 僅約 37 次周邊到達 ≈ 9/cell，對信度過薄（C-D3）；90 s 約 56 次 ≈ 14/cell」。T6 實機掃描顯示 90 s 的「≈14/cell」只在 ≤800 ms 的 per-trial 節奏成立（1,000 ms → 11、1,200 ms → 9），即 90 s 本來就買不到規劃期宣稱的樣本量；60 s 在同樣節奏下落在 5–12/cell。使用者在看過兩組實測數字後仍選 60 s，依據是 v1 為 practice-only 且**明確不宣稱信度**（C-D3：無指標進教練報告或 `DrillMetricRegistry`），樣本量明確移交晉升 WP。<br>**Alternatives considered**：(a) 維持 90 s 並保持 OQ 開啟 —— 我的建議項，未採；(b) 加長到 120 s（1,000 ms 節奏可達 14/cell）；(c) 加長到 150 s（1,200 ms 可達）—— 兩者皆會把單次 run 拉長並引入疲勞／注意力衰減的新效度風險，**未採**。<br>**timeout 率不在本次收斂範圍**：harness 為解析式自動瞄準，其 timeout 率恆為 0（by construction），合成一個數字會是造假；可客觀量到的截斷邊界（周邊在 `peekTimeoutMs` 準時撤除）已寫成 E2E 斷言 | 使用者 | 本節 §T6 的節奏掃描表（改值前後各一組） |
| D-57.T6-3 | 2026-09-08 | **arm-time resolve 以 roster 項的 `resolveSource?: () => unknown` 落地，呼叫點在 `loadDrillById()` 內、`activateDrill()` 之前**（不是 T6 步驟 2 原寫的「兩個 `activeDrillConfig` 賦值點各一次」）。理由：T0 之後 `main.ts` 已把那兩個賦值點重構成共用的 `activateDrill()`，一個呼叫點即涵蓋換 drill 與 protocol 驅動的載入；放在 activation 之前則使 resolver 的 typed error 在任何狀態被觸碰前擲出（不留半換的 scene generation／weapon override），並沿既有 `runControl` 失敗路徑呈現。`loadSceneById()` 刻意**不**重解析——它以 `activeDrillSource` 重驗場景，而 wide 的 source 就是已解析的 config 物件。<br>**Alternatives considered**：(a) 照原文在 `activateDrill()` 與 `loadSceneById()` 內各呼叫一次 —— 換場景會重讀 aspect，直接與 NFR-57.5 的語意衝突，**駁回**；(b) roster 項的 `source` 直接放一個在模組載入期解析好的 config —— 正是 D-57.T3-3 駁回的做法（aspect 凍在錯誤時點），**駁回**；(c) 讓 `source` 一律改成 thunk 以避免 optional 欄位 —— 會動到 20+ 個既有 roster 項與 harness 契約，收益只是型別整齊，**駁回** | Engineering | `main.ts` diff；4 個 E2E 全綠 |
| D-57.T6-4 | 2026-09-08 | **`fpsTestHarness` 的 `availableDrills` 同步接受 `resolveSource`，並在每次 `startDrill()` 時呼叫**（不是在 bootstrap 的 `.map()` 裡就解析掉）。理由：harness 的 `startDrill()` 語意上就是一次 arm；若在 bootstrap 解析，resize 不變性 E2E 就變成比較兩個「早就解析完」的 run，什麼都證不到，而那正是 NFR-57.5 唯一的實機閘。<br>**Alternatives considered**：(a) 在 `main.ts` 的 map 裡呼叫 `resolveSource()` —— 上述理由，**駁回**；(b) 不讓 harness 支援本 drill、E2E 全走 live 單例 —— live 需要真人 Pointer Lock 開火才能推進 spawn 序列（`centerExemptFromTimeout` 讓無輸入的 run 停在第一顆中心目標，見 T2 補充 ④），無法做逐位 trace 比較，**駁回** | Engineering | `fpsTestHarness.ts` 三行 diff；resize E2E 的 41 spawn 逐位一致 |

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

> 以下為 **T6 執行期（2026-09-08）** 新增。

22. **resolver 的輸出在 browser 與 Node 之間差 1 ULP，所以逐位斷言不能跨引擎宣稱。** E2E 一開始用 `toEqual` 比對匯出的 yaw 窗與測試 process 重算的值，紅在 `47.50358800572262`（Edge V8）vs `…263`（Node V8）—— `Math.tan`／`Math.atan` 的精度是 implementation-defined。T2／T4 的所有逐位斷言都在單一 process 內，**仍然成立**；但跨 browser↔Node 邊界時可宣稱的上限是 **1e-12**（與 T4 由匯出欄位重算 yaw 窗所用的容差同級）。已在 spec 內以具名 helper + 註解釘死，避免後人以為是公式改過。

23. **`feedInput()` 的時間戳是相對「當下的合成時鐘」，不是相對 run 起點。** resize 不變性測試第一版把 run A 餵成「20 tap → resize → 20 tap」而對照組 run B 餵成一批 40 tap，結果**位置全部逐位一致、時間戳整體差 476.5625 ms**：`feedInput` 每次以 `base = clockMs` 重新起算，故分兩批餵會壓縮 tap 網格。修法是讓對照組也分同樣兩批，使兩個 run 的唯一差異就是 resize —— 這樣連 sim 時間戳都能入斷言（sim 時間由合成時鐘推導，不是 wall-clock，故不違反 CLAUDE.md §4）。教訓：拿「分批餵入」的 harness 做對照實驗時，批次切法本身是一個必須對齊的變因。

24. **`DrillMetricRegistry` 無法 import 進 Playwright spec。** 它的 scene-config 依賴鏈會拉到 `peek-ad-corridor.props.json`，而 Playwright 的 loader 要求 JSON module 帶 import attribute，直接 `Error: No tests found`。故 E2E 的「零 compatibility cell」改以 `buildCompatibilityKey()`（只有 type import，鏈很輕）對**真實 browser payload** 呼叫並斷言擲錯；exact-id／near-miss／replay-profile 的 registry 負向面留在 T1 的純函式測試。⇒ e2e spec 可以 import `src/`，但**能 import 的深度取決於依賴鏈裡有沒有 JSON module**，不是取決於模組層級。

25. **大 FOV 下球的「表觀形狀」不恆定，只有角徑恆定。** `spiderWideEyePos()` 保證 `abs(pos − eye) ≡ distanceU`（NFR-57.3，實測逐個 = 8），所以角**徑**恆為 2.0°；但直線透視在大離軸角會橫向拉伸，FOV 120 的周邊目標在截圖上是約 **2.4:1 的橢圓**（`peripheral-L-fov120.png`）。這是正確的投影行為、不是缺陷，規劃期也沒說錯什麼——只是「角徑恆定」很容易被讀成「看起來一樣大一樣圓」，而後者不成立。若晉升 WP 要把 FOV 當條件變因合併，表觀形變是一個未入帳的混淆項。

26. **`kLo` 的「貼邊 8%」是度上的 8%，不是畫面上的 8%。** `ndc_x = tan(yaw)/tan(halfHFOV)` 是凸函數，故 `0.92·yawMax` 在 NDC 上遠低於 `0.92·(1−screenMargin)`：周邊目標中心的 `abs(ndc_x)` 實際落在 FOV 60 `[0.820, 0.927]`、FOV 75 `[0.800, 0.926]`、FOV 120 `[0.687, 0.908]`（界 0.96）。⇒ D-57.P2 想要的「每位選手同樣貼邊」在 NDC 意義下只是近似成立，且近似度隨 FOV 變差（85.4% → 71.5%）。規劃期把 `kLo` 定義在度上是為了與 `yawMax` 同單位，沒有記到這個後果。已由 D-57.T6-1 入帳為已知限制。

27. **規劃期的「90 s ≈ 14/cell」本來就不成立，跟後來改 60 s 無關。** 實機掃描（走出貨 config、真實 `TargetManager`／`DrillRunner`）：90 s 下 600/800/1000/1200/1500 ms 的 per-trial 節奏分別給 18/14/11/9/7 per cell —— 只有 ≤800 ms 那一格達標。README §1.5 的「約 56 次 ≈ 14/cell」等於默認了一個「每個 trial 800 ms」的隱含假設，而那對 40–70° 的大幅拉槍偏樂觀。⇒ 用「時限 ÷ 估計 trial 時間」推樣本量時，那個估計值必須跟結論寫在一起，否則後人會把它當實測。

28. **capture runner 差點原地重製 KI-028。** 第一版沿用 WP-56 的 `spawn('taskkill', …)` fire-and-forget teardown，結果本 task 的第一次 capture 跑完後留下一個 5174 上的 Vite（`--host 127.0.0.1 --port 5174 --strictPort`），存活了十幾分鐘。KI-028 的傷害正是這個：孤兒 Vite 會被 Playwright 的 `reuseExistingServer` 直接接手、連 history root 一起換掉。修法：`await` taskkill 的 exit，再 poll 該 port 直到不再回應，仍在則印明確警告並設 `process.exitCode = 1`。**已驗證修後跑完 5173／5174 皆 free。**

29. **本次執行時 5173 上有一個別人留下的 dev server，而它租用的是真實 `data/session-history/`。** 開工檢查發現 5173 已被佔用（`cmd /c vite`，非 capture runner），其 lease 落在真實 history root ⇒ 若直接跑全量 Playwright，`reuseExistingServer` 會重用它，`history-persistence` 等測試就會把 fixture 寫進真實根目錄。已先停掉該 server，讓 Playwright 自己起帶 `.playwright-tmp/history-dev`／`-preview` 的兩個 server（事後確認兩個 temp root 都建立、真實根目錄本次**無任何新 run 資料**）。附帶發現：真實根目錄裡已有 **2026-09-02 的 e2e fixture 殘留**（`e2e-t5-*`／`stage10-*`／`t5-*` 等約 40 個目錄），屬本 session 之前的既存污染，不在 T6 範圍，但值得清理。另有一個 pid 已消失的 `.history-root.lease` 於本次執行期間出現在真實根目錄，直接以兩種啟動路徑（`npx vite` 與 `npm run dev -- …`，皆帶 `FPS_HISTORY_ROOT`）復驗**都只租 temp root**，故無法歸因給 capture runner；已刪除該 stale lease。

## Open Questions（追蹤用，權威定義見 README §1.6）

| ID | 狀態 | 待誰 |
|---|---|---|
| OQ-57.1 `drillId` 命名 | ✅ 已收斂 2026-09-07：`spider-shot-wide-v1`（D-57.P13）；**T0 已覆驗與 17 個既有 `drillId` 無衝突、含 near-miss 負向面** | — |
| OQ-57.2 pitch 窗 | ✅ 已收斂 2026-09-07：`±6.5°`，`floorClearanceU = 0.5`（D-57.P14）；**T0 已覆驗 `pitchMax = 6.8947°`、餘裕 0.3947°** | — |
| OQ-57.3 `kLo` / `screenMargin` 貼邊感 | ✅ **已收斂 2026-09-08：兩值維持不動**（D-57.T6-1）。三檔 FOV 實機截圖證明完整可見、不被切；NDC 貼邊程度隨 FOV 漂移（85.4% → 71.5%）入帳為已知限制（Surprises 26） | — |
| OQ-57.4 `peekTimeoutMs` / `timeLimitMs` | 🟡 **部分收斂 2026-09-08**（D-57.T6-2）：`timeLimitMs` 改 **60000**、`peekTimeoutMs` 維持 2500；每 cell 樣本數已有實機掃描表。**timeout 率未收斂**——harness 自動瞄準使其恆為 0（by construction），需真人 run | timeout 率：使用者實機／晉升 WP |
| OQ-57.5 repositioning 門檻 | 待資料（T0 未寫成常數） | 使用者 + 工程，T5 |
| OQ-57.6 晉升時 `compatibilityKey` 補 aspect | 已有結論（必須補），不阻塞本 WP。**T0 補上量化依據：同 FOV 75 下 4:3 與 21:9 的 `yawMax` 相差 15.3°** | 晉升 WP 的 T0 |
| **OQ-57.7**（T0 新增）匯出 `angularDistanceDeg`／`angularSizeDeg` 的 frame 語意 | ✅ **已收斂 2026-09-07：採選項 (b)**（非 T0 建議的 (a)）—— 由 KI-026／BD-026 一併落地，`deriveSpiderShotTransitions()` 改用 payload eye + per-tick player position；權威記載見 [DECISIONS.md GD-32](../../../DECISIONS.md) ④。**T4 因此不再阻塞** | — |

### T2 補充（2026-09-07）

4. **`centerExemptFromTimeout: true` 會讓無輸入的 headless run 停滯。** 中心目標不逾時、又沒有命中來源，`DrillRunner` 就永遠停在第一顆目標上 —— 決定性 harness 因此**必須**開火才有 spawn 序列可比。這不是缺陷（它正是「回中心後可從容重新架槍」的設計意圖），但它決定了 NFR-57.1／57.5 harness 的形狀（D-57.T2-3）。

5. **`DrillRunner` 一行未改即可承載第三支排程。** `centerExemptFromTimeout` 的判斷寫在 `config.spiderShot?.centerExemptFromTimeout`（kind 無關），`zone` 蓋章與交替則全在 `TargetManager` 側，故 FR-57.7 的 parity 是既有結構的自然結果，而非本 task 新增的相容層 —— 與規劃期預估的 runner 修改面相比縮小為零。

### T3 補充（2026-09-07）

6. **預設 `[10, 10, 3]` 房間其實一次倒在兩個獨立原因上。** 它沒有 `eyeZ`，於是吃 fallback `depth/2 − CAMERA_STANDOFF = 4` ⇒ `loadDrill()` **先**倒在 eye anchor（camera 不在 sim eye 原點），根本走不到側牆判定。要讓 FR-57.9 的負向證據真的是在說「房間**尺寸**裝不下」，測試必須先補上 `eyeZ: 0` 再驗；未補的原始預設房間則另立一條斷言（倒在 eye anchor）。這是「負向測試要證明的是哪一個原因」的典型陷阱 —— 只看到 throw 就打勾，會把兩個缺陷混成一個。

7. **arena 最緊的面是地板，不是側牆。** README §2.5 的表以側向落點驅動半寬需求，容易讓人以為側牆是瓶頸；612 個落點掃完的全域最小淨空是 **`0.5547 u`（地板，pitch −6.5° 下緣）**，而側牆最緊只有 FOV 120 的 `1.3281 u`。即：半寬 9 有 1.33 u 餘裕，真正貼著 `CLEARANCE_MARGIN_U` 的是**已凍結的 pitch 窗**（只高出 `0.0547 u`）。⇒ 日後若有人想放寬 pitch 窗（OQ-57.2 的 `±7.5°` 選項），受限的是地板而不是 arena 尺寸，加寬房間毫無幫助。

8. **`targetHitboxRadius()` 對球形 hitbox 回的是角點半徑。** `clearance.ts:42` 算的是 `√((w/2)² + (h/2)² + (d/2)²)`，對本 drill 的球（直徑 `0.279281`）回 `0.2419` 而非 `0.1396`。既有淨空慣例對 box 是正確的，但沿用到球上會誇大 73% 並讓 §2.5 全表對不上。⇒ D-57.T3-2 以 shape 分流，半徑仍只從 `resolveTargetHitbox()` 推導。**後續追查發現這不只是本 WP 的取捨**：同一個 helper 被 `validateClearance()` 無條件套在所有 sphere drill 上，是 [KI-021](../../../../known_issue/KI-021-tracking-derivation-ignores-sphere-hitbox-shape.md)（shape 被丟掉）同一病理的第三處、也是唯一未修的一處。已另立 [KI-029](../../../../known_issue/KI-029-prop-clearance-inflates-sphere-hitbox-to-box-corner-radius.md) —— 今日唯一可達組合是 WP-54 tracking pilot × `field-low`（16 props），閘比宣稱幾何嚴 9–13%，方向保守故無觀測失敗。

9. **OQ-57.7 早在 T3 開工前就已拍板，但 WP-57 的四份文件都還寫著「待使用者拍板、阻塞 T4」。** 交叉讀 [DECISIONS.md GD-32](../../../DECISIONS.md) ④ 才發現：`deriveSpiderShotTransitions()` 已於 **commit `567eaf6`（KI-026／BD-026）**改用 `resolveEyeOrigin()` + per-tick eye，匯出 `D_deg`／`W_deg` 已是 eye-frame，**即 OQ-57.7 的選項 (b)**（不是 T0 建議的 (a)）。原因：KI-026 的修復落在 WP-57 之外的 session，沒人回改 WP-57 的狀態列。我在 T3 收尾時**還把這個過期狀態複製進了 `stage12/README.md` 與 WP-57 README**，等於讓錯誤多長一份。已全部對帳。<br>⇒ **教訓（已寫進 GD-32 待辦）：帳本會領先 WP 文件。判斷 task 是否被阻塞，要以 DECISIONS.md／BUGFIX-DECISIONS.md 為權威，而不是 WP 自己的 Progress 表。** 這次的代價本來會是「T4 開工前先停下來等一個早就做完的決定」。<br>⚠️ **T4 的連帶要求**：round-trip 測試必須**以 eye-frame 為期望值**，不得沿用 README §2.5.1／§T0 audit ⑥⑧ 記載的 origin-frame 偏差數字（`27.937°`／`43.6%`／`2.408°`／`4.0%`）——那些是拍板前的量測，現在只有歷史意義。

10. **`validateClearance()` 綠燈不代表「裝得進房間」，而這個缺口在 WP-57 之前不痛。** 牆／地板從未被任何自動檢查覆蓋（`clearance.ts` 全檔零 `wall`／`floor`／`roomSize` 引用），因為既有 spawn 幾何都遠離房間邊界；wide drill 是第一個把目標推到側牆 `1.33 u` 內的。KI-012 的失敗模式正是三個綠燈同時成立：**淨空綠 + 畫面全遮 + 命中判定正常**。已把「`loadDrill()` 現有四道 scene-geometry 閘的分工」與「新增 kind 時何時必須自帶第五道」記入 [DECISIONS.md GD-33](../../../DECISIONS.md)，含天花板刻意不檢查、檢查順序有語意、半徑須 shape-aware 三個給後人的坑。

### T4 補充（2026-09-07）

11. **嚴格符號規則會在 v1/v2 的「正上／正下」落點上輸出一個幾何上無意義的 side。** 既有 fixture 的 `pointAtAzimuth(180)` 算出的 `x` 是 `10 × 0.5 × sin(π) = 6.12e-16` —— 不是 `0`，於是 `side` 回 `'R'`。同一個 fixture 的 `azimuth 0` 因 `sin(0)` 恰為 `0` 而正確省略。兩者的差別純粹是 `Math.sin` 的浮點殘值，與幾何無關。**處置**：不加閾值（D-57.T4-1），改以測試把這個行為釘死、並在 `analysis-spider-shot.md` 與 `CONTEXT.md` 明寫「判讀 v1/v2 時先用 `quadrant` 篩掉 `vertical` 再看 `side`」。wide drill 不受影響（yaw 幅度恆 ≥ 40°）。

12. **eye-frame 修正之後，wide drill 的匯出 `W_deg` 是**精確**的設計值，不是「誤差變小」。** 實測 16 個 transition 的 `angularSizeDeg` 全部為 `2.000000000000`、`worldDistanceU` 全部為 `8.000000000000`。原因是三件事同時成立：`spiderWideEyePos()` 讓 `abs(pos − eye)` 恆等於 `distanceU`、`translation: 'locked'` 讓眼睛恆在 `(0, 1.6, 0)`、以及 KI-026 之後 derivation 也從同一個 eye 算起。⇒ README §2.5.1 那張「`W_deg ∈ [1.9198, 2.0053]`、誤差 4.0%」的表**已完全過期**，它描述的是 origin-frame derivation 的世界。任何後續讀者若拿它當期望值就會把一個已修好的 bug 重新釘回去。

13. **`meta.spawn.spiderShot` 的 opaque 設計讓「新增排程參數」的匯出成本為零，但也讓型別保護為零。** round-trip 全程沒有動 `metadata.ts`／`exportPayloadSchema.ts`，`resolvedFrom` 五個欄位自動落地 —— 這是好事。代價是 parser 對它**完全不驗**：若哪天 resolver 少寫一個欄位，匯出仍會 parse 成功，只有離線分析在幾個月後才會發現重建不出 yaw 窗。本 task 的 round-trip 測試就是唯一擋這件事的閘，**它不能被當成「只是測試」刪掉**。
