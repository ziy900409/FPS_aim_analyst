# KI-024 — `field-low` 的 camera 未錨定 sim origin：交戰距離 8 u ≠ config 的 4 u,WP-54 tracking pilot 的角尺寸與角速度**全部只交付一半**

> 類型:tech spec(診斷 + 修改計畫)。語言:繁中,術語保留英文(D4)。
> 狀態:✅ **已修**(2026-09-03,研究者選定 **Option A**:`field-low` 補 `eyeZ: 0`)。
> 決策帳本:[BD-024](BUGFIX-DECISIONS.md);跨 WP 影響面見 [DECISIONS.md GD-31](../exec-plan/DECISIONS.md)。
> 發現於 WP-54 **T7 slice 1** 之後——把凍結準心比值升成工具後,以「刺激本身」離線算出的
> frozen RMS ε(1.51°)是真人資料實測值(0.757°)的**恰好兩倍**,追下去發現的。
> 這是 [KI-002](KI-002-br-field-camera-anchor-protocol-load.md) **D1 在另一個場景的復發**:
> 同一個失效模式(「camera 未錨定 sim origin ⇒ 交戰距離被放大 ⇒ 角尺寸/角速度自變量失效」),
> 當年只修了 `br-field`,`field-low` 沒有一起修。
> 亦是 [KI-020](KI-020-core-matrix-size-speed-manipulation-not-delivered.md) /
> [KI-023](KI-023-target-speed-set-point-is-per-axis-not-2d.md) 的**第三次殘留**:
> 三次的共同根因都是「宣稱的量不是交付的量,而測試站在會通過的那一邊」(C-D4)。

---

## 1. 症狀

`tracking_core_pr_pilot_v1_*` 與 `tracking_reversal_pilot_v1_*` 的 9 個 block 全部 pin 在
`field-low`([main.ts:1239](../../src/main.ts))。逐份 P04 匯出檔,以**眼睛為原點**重算目標角速度
(即 `computeSignedOmegaSeries()` 用的同一個量、同一個有限差分):

```
drill                              nominal   eyeRel   ratio   eye→target dist   maxYaw(eye)
core_pr_pilot_v1_0p5deg_20dps           20     9.98   0.499   7.97..8.00              5.15
core_pr_pilot_v1_0p5deg_5dps             5     2.53   0.507   8.00..8.00              1.12
core_pr_pilot_v1_2deg_20dps             20    10.02   0.501   7.96..8.00              4.62
core_pr_pilot_v1_2deg_5dps               5     2.52   0.505   8.00..8.00              1.15
core_pr_pilot_v1_calibration_horizontal  5     2.53   0.507   8.00..8.00              1.87
core_pr_pilot_v1_calibration_vertical    5     2.54   0.508   7.99..8.00              0.04
core_pr_pilot_v1_practice                5     2.50   0.501   8.00..8.00              1.09
reversal_pilot_v1_high              [5,20]     4.79      —    7.95..8.00              6.49
reversal_pilot_v1_medium            [5,20]     5.86      —    7.89..8.00              6.50
```

**每一個 cell 都是 0.50×**,一致到小數第三位。`eye→target` 距離量到 **8.00 u**,而 config 寫的是
`targets.distance: 4`。

## 2. 根因

三件事各自都對,合起來錯:

1. `TargetManager` 把前向目標放在 **sim origin 前方** `z = −distance`
   ([TargetManager.ts:193/239](../../src/sim/TargetManager.ts));`trackingTrajectory` 的
   `projectTrackingAngles()` 也以此為原點(`trajectoryOrigin = { distanceU: distance, centerY: TARGET_Y }`)
   ⇒ **軌跡的角度是以 world origin 為頂點**量的。
2. 射線/彈道/視覺原點 = camera world position = `resolveEyeWorldBase()`
   = `{0, eyeHeight, eyeZ ?? depth/2 − CAMERA_STANDOFF}`([eyePose.ts](../../src/scene/eyePose.ts))。
3. `field-low` 的 `proceduralRoom` **沒有給 `eyeZ`**([field-low.ts](../../src/scene/scenes/field-low.ts)),
   `roomSize: [10, 10, 4]` ⇒ `eyeZ = 10/2 − 1 = **4**`。

⇒ 眼睛在 `z=+4`、目標在 `z=−4`,**實際交戰距離 = 8 u = config 的兩倍**。角度以距離的反比縮放,
故受測者眼中的角尺寸、角行程、角速度**全部是宣稱值的 1/2**。

`SceneConfig` 自己早就寫明了這條規則——[SceneConfig.ts:18](../../src/scene/SceneConfig.ts):

> `radial-spawn drill(前向目標 z=−distance)需 eyeZ:0,使實際交戰距離 == config distance`

`br-field`(KI-002/D1 的修復)、`peek-corridor`、`peek-ad-corridor` 三個場景都設了 `eyeZ: 0`。
**`field-low` 是唯一被前向 drill 使用、卻沒設 `eyeZ` 的場景。**

### 2.1 為什麼三輪 Gate A 都沒抓到

| 量測點 | 用的角度原點 | 結果 |
|---|---|---|
| `trackingTrajectory.test.ts` 的速度斷言 | trajectory 自己的 `yaw/pitchVelocityDegPerSec` | 通過(生成器確實照 set-point 產出) |
| 分析 runner 的 `stimulusCheck()` 驗收帶 0.95–1.05 | 同上——重建 trajectory 再量**它自己的**速度 | 通過(0.989–1.017,gate §12.3) |
| layer 3b `checkTrackingStimulusFidelity()` | 「錄到的位置 == 重建的位置」 | 通過——它問的是曲線一致性,不是角度值 |
| **P1 `computeSignedOmegaSeries()` / ε(t)** | **眼睛**(`eyeOriginForTick`) | 這裡才是受測者經驗的量,但**從未與 set-point 對表** |

**同一個構念(目標角速度)在 repo 內有兩個原點**:刺激側以 world origin 為頂點,指標側以眼睛為頂點。
KI-023 修掉了「每軸 vs 2D」這個第二定義,但沒發現還有「原點在哪」這第三個自由度。
違反 CLAUDE.md §4 **C-D4**。

## 3. 影響面

### 3.1 WP-54 tracking pilot(直接、全部)

| 宣稱 | 實際交付(眼睛所見) |
|---|---|
| 角尺寸 **0.5°** / **2.0°**(`trackingPilotAngularSizeToDiameterU(size, DISTANCE_U=4)`) | **0.25°** / **1.0°** |
| 速度 **5** / **20** deg/s | **2.5** / **10.0** deg/s |
| 行程 ±2.3° / ±5.6°(trajectory 座標) | **±1.15°** / **±2.8°** |
| reversal `speedRangeDegPerSec [5,20]`、行程 ±13° | 2D RMS **4.79 / 5.86** deg/s、±6.5° |

**這在機制上解釋了「0.5° 目標看不見」**([gate §12.5](../exec-plan/active/stage11/wp-54-tracking-pilot/T6-instrumentation-gate.md)):
它不是 0.5°,是 **0.25°**。以實測環境(`fovDeg 75` = THREE `PerspectiveCamera` 的**垂直** FOV、
`cssH 1274`)換算,0.5° 應約 **8.5 CSS px**,0.25° 只有約 **4.2 CSS px** —— slice 19 的渲染側稽核
(排除 radius/diameter 混用)是對的,但它按 4 u 距離算出「約 8–9 px」,那是**宣稱值**而非交付值。
**連兩個單軸 axis calibration block 也看不見**,與 0.25° 一致。

### 3.2 §12.8 的結論仍然成立,但診斷要修正

- **仍成立**:band-limited 慢速 cell 與兩個 calibration 的凍結準心比值 1.05–1.35 ⇒ **測不出跟槍能力**。
  這是對「實際交付的刺激」的正確描述。
- **要修正的是歸因**:§12.8 把根因全歸給「預註冊頻帶下 5 deg/s 必然行程過小」。實際上還疊了本 KI 的
  0.5×。但**修掉 0.5× 並不會提高比值**——距離因子同時縮放速度與行程,而
  `比值 ≈ 0.3776·k(頻帶)·v / (0.183 + 0.1867·v)`,距離因子在分子分母同時出現、抵消掉。
  離線量測驗證:`[0.3, 2.1]` Hz 這個頻帶下,**任何速度的比值上界都是 ≈ 1.61**。
  ⇒ **§12.8 指出的頻帶槓桿仍是唯一的槓桿**(見 §5.2 的選項表);本 KI 影響的是**條件標籤的絕對值**
  與「0.5° 是否真的到 pixel floor」這個問題本身。

### 3.3 Blast radius(其他 WP,本 KI 不擅自修)

`field-low` 另有三個 drill 使用:`tracking_longrange_v1`、`tracking_scene_v1`、
`detection_popin_v1`([main.ts:144](../../src/main.ts))。它們是否以 `targets.distance` 宣稱角度語意
須由 owning WP 判定;`TargetManager.ts:62` 的註解已記載 `spider-shot` 的
`centerDistanceU`/`distanceURange=8` **也曾重蹈此坑**(KI-012)。
依 CLAUDE.md §3 第 7 條與 WP-54 checklist 的 commit discipline,**跨 WP 的部分寫入
[DECISIONS.md](../exec-plan/DECISIONS.md) 並回 owning WP 修**,不在 WP-54 內混改。

## 4. 為什麼這是研究決策,不由 agent 拍板

任一修法都**改變交付給受測者的刺激** ⇒ 產生
[analysis-tracking.md](../../docs/operational/analysis-tracking.md)「刺激語意」節定義的 **G4 世代**,
既有 P04/P05(G3)資料作廢。且「條件標籤該宣稱哪個角度」本身就是預註冊參數的語意問題
(OQ-54-2)。故依 KI-019 F-A2 / KI-020 §4 / KI-023 的同一慣例,列出選項交研究者。

## 5. 選項

### 5.1 修「交付角度只有一半」

| 選項 | 做法 | 代價 / 副效益 |
|---|---|---|
| **A** | `field-low` 補 `eyeZ: 0`(= KI-002/D1 對 `br-field` 的同一修法,把根因修在場景層) | 交戰距離變 4 u = config,宣稱值即交付值。**根因修掉、坑關上**;但 camera 位置改變 ⇒ 同場景其他三個 drill 的視角/淨空/既有資料都受影響(§3.3),blast radius 最大 |
| **B** | 場景不動,WP-54 的換算改用真實交戰距離 8 u(hitbox 用 8 u 換算;trajectory set-point ×2 使**眼睛所見**等於宣稱值) | 只動 WP-54,其他 drill 逐位不變。但 `field-low` 的「`targets.distance` ≠ 交戰距離」這個坑**留著**,下一個 drill 還會踩;且 WP-54 內出現「距離 4、換算用 8」的雙數字 |
| **C** | 幾何與刺激完全不動,把條件標籤改成**實際交付值**(0.25° / 1.0°;2.5 / 10 deg/s;reversal 眼睛所見 4.8 / 5.9) | **不改刺激 ⇒ P04/P05 仍有效、reversal 家族的 Gate A PASS 保留**。但預註冊的條件標籤要改版,且「0.5° 是否到 pixel floor」這題等於以「0.25° 在此環境下不可辨識」結案 |

> **注意 reversal 家族的代價**:A 與 B 都會改變 reversal 的交付速度(約 ×2)⇒ 它是第三輪**唯一**
> 取得有效效度證據的家族,選 A/B 等於讓那份證據也作廢、需重跑。C 保留它。
> A/B/C 亦可**分家族施用**(例如 band-limited 走 B、reversal 走 C),代價是兩個家族的距離語意不同。

### 5.2 修「比值太低」(OQ-54-14,與 5.1 獨立)

離線量測(以現行 `createTrackingTrajectory()` 逐 tick 建構 25 s block,眼睛所見角度;
`人類 RMS ε ≈ 0.183 + 0.1867·v_eye` 由 P04/P05 的 12 個 run 擬合,在 2.5–10 deg/s 區間重現實測值):

| 頻帶 | 比值上界(v→∞) | v_eye 2.5 | 5 | 7.5 | 10 | 25 s 內週期數 | 垂直包絡 |
|---|---|---|---|---|---|---|---|
| **`[0.3, 2.1]`(現行)** | **1.61** | 1.15 | 1.34 | 1.42 | 1.46 | 7.5 | 全部 OK |
| `[0.25, 1.75]` | 1.93 | 1.38 | 1.61 | 1.70 | 1.75 | 6.3 | 全部 OK |
| `[0.2, 1.4]` | 2.41 | 1.73 | **2.01** | **2.12** | **2.19** | 5.0 | 全部 OK |
| `[0.15, 1.05]` | 3.21 | **2.32** | **2.70** | **2.85** | **2.94** | 3.8 | 10 deg/s 需 ±23° bound(y 0.37–2.76,勉強) |
| `[0.12, 0.84]` | 4.02 | **2.92** | **3.40** | **3.60** | 3.70 | 3.0 | **10 deg/s 超出包絡**(y 0.10) |
| `[0.1, 0.7]` | 4.82 | **3.42** | **3.97** | **4.19** | 4.32 | 2.5 | **7.5/10 deg/s 超出包絡** |

**讀法**:比值是「這個條件能不能分辨會跟槍與不跟槍」的上界;**reversal 家族實測 2.06–3.01**,
是唯一已證實有效的參照點。現行頻帶**任何速度都到不了 2.0**——所以「改速度」救不了它,只有降頻帶。
代價是 25 s 內的週期數變少(任務性質從 pursuit 往「緩慢漂移」偏)與垂直包絡(目標沉向地面)。

> **模型的不確定性要誠實說**:人類項只由 **2 位受測者、2 個速度點**擬合。它在 reversal 家族上
> 交叉驗證通過(預測 1.08/1.28 vs 實測 1.05/1.25),但仍是外插。**建議在招募 12–20 人之前,先由
> 操作員以新參數跑 1 人 × 幾個 block 的乾跑,用 layer 5 實測比值**——三輪 Gate A 已因刺激問題
> 作廢三批真人資料,乾跑的成本遠低於作廢第四批(且這次是 12–20 人的量)。

## 5.3 已選定的修法(2026-09-03,使用者)

**§5.1 → Option A**(`field-low` 補 `eyeZ: 0`)。理由與跨 WP 影響面記於
[DECISIONS.md GD-31](../exec-plan/DECISIONS.md);A 另有一個科學上的副效益——同樣的「眼睛所見
±X°」只需一半的 world 位移 ⇒ **垂直包絡加倍**,而垂直包絡正是 §5.2 降頻帶時的限制條件。

**§5.2 → 頻帶降為 `[0.15, 1.05]` Hz**(比值 2.32–2.94,bracket 住 reversal 實測的 2.06–3.01),
**Gate B 的 retained 門檻凍結為 `ratio ≥ 2.0`**(錨在 reversal 家族實測下界 2.06),
且**招募 12–20 人之前先由操作員乾跑實測比值**。落地見 WP-54 T7 slice 4 與
[T7-difficulty-calibration-gate.md](../exec-plan/active/stage11/wp-54-tracking-pilot/T7-difficulty-calibration-gate.md)。

## 6. 驗證計畫(修法選定後)

1. **先證實紅**(BD-001 的 TDD 慣例):新增一個以**眼睛為原點**量交付角速度/角尺寸的斷言,
   在修法前必須失敗——這是三輪來一直缺的那個測試(§2.1)。
2. 修法落地 + 建構期/載入期守衛:交戰距離與換算用的距離不一致時 fail fast(比照 KI-020
   `requireDeliverableSpeed()`、KI-019 F-A2 幾何守衛的慣例)。
3. `stimulusCheck()` 的驗收帶改量**眼睛所見**的速度(維持 0.95–1.05,不放寬——gate §11.8)。
4. `npx vitest run` 全綠、`tsc --noEmit` 與 `-p tsconfig.node.json` exit 0、
   `playwright tests/e2e/tracking-pilot-live.spec.ts --project=edge` 1/1。
5. layer 3b 會把 P04/P05 判為 **mismatch**(世代改變的預期行為,不是壞消息)。
6. 操作員乾跑量測比值 ⇒ 達到凍結的 Gate B 判準後才招募。

### 6.1 落地結果(2026-09-03,WP-54 T7 slice 3)

| 步驟 | 結果 |
|---|---|
| ① 先證實紅 | `tracking_core_pr_pilot_v1.test.ts` 新增兩個**以眼睛為原點**的斷言,修法前失敗且重現 KI 的數字:`eye→target distance` **7.9965**(期望 4)、eye-relative 交付/宣稱 **0.5009**(期望 > 0.95) |
| ② 修法 | [field-low.ts](../../src/scene/scenes/field-low.ts) 補 `eyeZ: 0`(含註解說明契約與實測數字) |
| ③ 分析層守門 | `scripts/trackingDeliveredAngles.ts` + `tests/regression/tracking-delivered-angles.test.ts`(4 tests)。runner 每份 run 印 `atEye dist=… rmsSpeed=…% of nominal size=…`,超出 0.95–1.05 走 stderr。決定性 fixture = 「trajectory config 與 hitbox 逐位相同、只有 `scene.eye.z` 不同」的一對 |
| ④ 套回歷史批次 | 對 P04 的 10 份 payload,新層一致回報 **50–51% of nominal**、`dist=7.99–8.00u`、`size=0.250°/1.000°` ⇒ 這一層若早存在,第一輪就會攔下 |
| ⑤ 受影響的既有期望值 | 三處**語意變更**(非回歸):`src/scene/eyePose.test.ts` field-low 改斷言 `z=0`;`tests/regression/br-camera-anchor-invariants.test.ts` 的「無 eyeZ」樣本改用 `urban-high`、field-low 另立一條錨定斷言;`tests/golden/research/epsilon-offsetdeg-oracle.test.ts` 的 eyeBase 由「讀活的場景 config」改為**凍結的歷史值** `{0,1.6,4}`(那兩份 golden 錄於 2026-08-05,以今天的 camera 驗當年的資料會得到 2.4°/8.2° 誤差,遠超 0.5° 容差) |
| ⑥ 全專案驗證 | `npx vitest run` **212 files / 2035 tests passed**(1 skipped file / 2 skipped tests);`npx tsc --noEmit` 與 `-p tsconfig.node.json` 皆 exit 0 |

**尚未做**:`stimulusCheck()` 本身仍量重建軌跡自己的角度(Option A 之後兩個座標系已重合到
~0.6% 以內),新的 `atEye` 層是與它並列的第二道、且量的是**錄到的位置**——刻意不合併,兩者
不一致時正是世代或場景錨定出問題的訊號。
