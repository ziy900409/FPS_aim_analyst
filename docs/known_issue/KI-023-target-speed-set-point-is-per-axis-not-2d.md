# KI-023 — `targetRmsSpeedDegPerSec` 是「每軸」set-point：兩軸 cell 實際交付 √2 倍,預註冊的 5/20 deg/s 從未被交付

> 狀態：🟡 **診斷完成,再參數化待研究決策**(2026-09-03)。決策帳本：[BD-023](BUGFIX-DECISIONS.md)。
> 發現於 WP-54 T6 第二輪真人資料(P03,9 block 重跑)的分析,見
> [T6-instrumentation-gate.md §11](../exec-plan/active/stage11/wp-54-tracking-pilot/T6-instrumentation-gate.md)。
> 這是 [KI-020](KI-020-core-matrix-size-speed-manipulation-not-delivered.md) 的**殘留**:KI-020 修好了
> 「速度完全沒被交付」,但沒發現交付的量與宣稱的量**不是同一個物理量**。

---

## 1. 症狀

分析 runner 對 P03 每個 band-limited cell 回報:

```
0p5deg_20dps  rmsSpeed=28.27/20deg/s (141% of nominal)
0p5deg_5dps   rmsSpeed= 7.17/ 5deg/s (143% of nominal)
2deg_20dps    rmsSpeed=28.35/20deg/s (142% of nominal)
2deg_5dps     rmsSpeed= 7.14/ 5deg/s (143% of nominal)
calibration_horizontal  rmsSpeed=5.07/5deg/s (101% of nominal)
calibration_vertical    rmsSpeed=5.09/5deg/s (102% of nominal)
```

四個 core cell 一致超交付約 **1.41 倍**;兩個 axis calibration cell 卻正好 1.0 倍。
Gate §10.5 訂的驗收帶是 **0.9–1.1**。

## 2. 根因

`boundedSpeedScale()` 對 **yaw 與 pitch 各自**求解,讓**每一軸**的 RMS 角速度等於
`targetRmsSpeedDegPerSec`（[trackingTrajectory.ts:227-228](../../src/sim/trackingTrajectory.ts)）。
螢幕上目標的角速度是兩軸的向量合成 `hypot(yawVel, pitchVel)`,兩軸獨立且等量時

```
RMS(2D) = √(RMS(yaw)² + RMS(pitch)²) = √2 × set-point ≈ 1.414 × set-point
```

實測(由匯出檔的 `meta.spawn.trackingTrajectory` 重建軌跡,128 Hz 逐 tick):

| cell | 宣稱 | yaw RMS | pitch RMS | **2D RMS** | 2D/宣稱 | 每軸/宣稱 |
|---|---|---|---|---|---|---|
| `0p5deg_20dps` | 20 | 20.033 | 19.949 | **28.271** | **1.414** | 1.002 |
| `2deg_20dps` | 20 | 20.126 | 19.960 | **28.345** | **1.417** | 1.006 |
| `0p5deg_5dps` | 5 | 5.081 | 5.064 | **7.173** | **1.435** | 1.016 |
| `2deg_5dps` | 5 | 5.053 | 5.042 | **7.138** | **1.428** | 1.011 |
| `calibration_horizontal` | 5 | 5.065 | **0.127** | 5.067 | 1.013 | 1.013 |
| `calibration_vertical` | 5 | **0.128** | 5.085 | 5.087 | 1.017 | 1.017 |

**每軸都精準命中 set-point**(1.00–1.02)——生成器沒有壞,是 set-point 的**語意**與研究構念
(「目標在螢幕上移動多快」)不是同一個量。calibration cell 之所以正確,只因為它的 off-axis 被壓到
0.1° 幾乎不動,合成後仍只有一軸出力。

### 2.1 為什麼既有測試抓不到

[trackingTrajectory.test.ts:57-75](../../src/sim/trackingTrajectory.test.ts) 的
`achieves approximately the configured target RMS speed` 只累加 **`out.yawVelocityDegPerSec ** 2`**
——單軸。分析 runner 的 `stimulusCheck()` 用的是 `Math.hypot(yaw, pitch)`——2D。

**同一個構念在 repo 內有兩個定義**,而測試站在會通過的那一邊。這正是 CLAUDE.md §4 **C-D4**
(「既有構念不得有第二定義」)要防的情形;KI-020 §6 記的「實測交付 5.05 / 20.21 deg/s(比值
1.01/1.01)」也是以每軸定義量出來的,所以當時看起來已經修好。

## 3. 影響面（三個家族,不只 core matrix）

| # | 事實 | 後果 |
|---|---|---|
| 1 | 四個 core cell 交付 **7.14 / 28.3 deg/s**,而非預註冊的 5 / 20 | 條件標籤(drillId、`meta`、compatibility key)宣稱的絕對值**從未被交付**——與 KI-020 同一種失效,只是倍率從 4–17× 縮成 1.41× |
| 2 | calibration 宣稱 5 deg/s 交付 5.07,core 的 5 deg/s cell 交付 7.14 | **兩種 block 宣稱同速度、實際差 1.41 倍**。axis calibration 本來要當「同速度、單軸」的參照條件,現在不是 |
| 3 | reversal 的 `speedRangeDegPerSec [5,20]` 也是**每軸**抽樣（[tracking_reversal_pilot_v1.ts:32](../../src/drill/tracking_reversal_pilot_v1.ts) 註解寫明是「reuses the core matrix's speed candidates for cross-block comparability」） | 實測 2D RMS：medium **14.76**、high **13.38**,而 config 宣稱的每軸上限是 20 ⇒ 2D 峰值可達約 28。**跨 block 可比性這個當初的理由本身不成立** |
| 4 | 速度比值(4×)**完好** | 4 個 core cell 的 20/5 實測比 3.94–3.97。**「速度是被操弄的自變數」這件事成立**,壞的是絕對刻度與跨家族可比性 |
| 5 | KI-020 的建構期守衛 `requireDeliverableSpeed()` 同樣是每軸判定 | 它沒有誤放行——以每軸語意衡量,config 確實可交付。改語意時守衛要跟著改基準 |

**不影響**:決定性、event 對表、覆蓋率、schema、hitbox 幾何、on-target 判定。這是**刺激參數語意**
問題,不是儀器問題——資料鏈路本身(gate §11.2)仍然成立。

## 4. 修法選項（研究決策,未拍板）

三個選項共通的必做項:**把 T1 那條測試改成量與權威定義同一個量**,否則 C-D4 的第二定義還在。

### Option A — set-point 改為 2D 語意（交付預註冊的 5 / 20）

`targetRmsSpeedDegPerSec` 定義為「交付的 2D RMS 角速度」;兩軸都活躍時每軸求解目標改為
`target / √(活躍軸數)`,單軸 cell(calibration)不變。

- ✅ 預註冊的 5 / 20 deg/s **真的被交付**;calibration 與 core 的 5 deg/s 回到同一刻度。
- ✅ 交付振幅同步縮成 1/√2(20 deg/s cell 的行程由 ±13–14° 降到約 ±9–10°),更遠離視窗邊界。
- ❌ **四個 core cell + practice 的軌跡改變 ⇒ 這五個 block 必須再重跑**(calibration 逐位不變;
  reversal 另見下)。
- ⚠️ reversal 的 `speedRangeDegPerSec` 要一併決定是否改為 2D 語意(改則兩個 reversal cell 也要重跑)。

### Option B — 保留每軸語意,改名 + 改預註冊值

欄位更名為 `targetPerAxisRmsSpeedDegPerSec`,條件標籤改記實際交付的 **7.07 / 28.28 deg/s**。

- ✅ **不必重跑**:P03 這批資料在新標籤下即為有效。
- ❌ 事後改預註冊的條件定義(preregistration drift),且 §3 的第 2、3 點仍在——calibration 宣稱 5、
  core 宣稱 7.07,兩者交付速度仍差 1.41 倍,只是這次寫在文件上而非隱藏。
- ❌ 「20 deg/s」這個對讀者有直覺意義的數字換成 28.28,跨研究比較(FPSci 等)更難對齊。

### Option C — 只更新文件,程式不動

把 √2 寫進 `analysis-tracking.md`,分析時自行換算。

- ❌ 第二定義仍在(測試量單軸、分析量 2D),下一個人一樣會踩;不符 C-D4。**不建議**。

**建議 = Option A**,理由:研究構念是「目標在螢幕上移動多快」,那就是 2D 合成速度;且 §3 的
1/2/3 三個後果只有 A 能同時解掉。代價是五個(或七個)block 再重跑一輪。

## 5. 測試（修法落地時必補）

- T1 `achieves approximately the configured target RMS speed` 改量 `hypot(yaw, pitch)`,並對
  **兩軸 cell** 與**單軸 cell** 各一案(單軸案鎖住「calibration 不因此改變」)。
- 新增回歸案:兩軸 config 的交付 2D RMS / set-point ∈ [0.95, 1.05](修前必紅——現值 1.414)。
- 若採 A 且 reversal 一併改:補「每 leg 抽樣速度即為 2D 合成速度」的斷言。
- 分析 runner 的 `stimulusCheck()` 已經量 2D,不需改——它是唯一一開始就量對的地方。

## 6. DoD（待落地）

- [ ] 研究者選定 Option A / B / C。
- [ ] 落地修法 + 上述測試(修前紅)。
- [ ] 更新 `docs/operational/analysis-tracking.md` 的「刺激語意」節,寫明**哪一個版本起**交付速度
      是 2D 合成量,並保留舊資料(P01/P02/P03)的判讀規則。
- [ ] 更新 KI-020 §6 的「實測交付 5.05 / 20.21」——那是每軸值,需標註。
- [ ] 重跑受影響 block,並在 gate §11 記錄結果。
