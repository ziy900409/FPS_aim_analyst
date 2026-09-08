# KI-031 — aim 更新率低於 sim 率時，`sustainedTicks: 4` 讓 detection 全數 timeout；`tDetectMs`／`reactionMs`／`movementTimeMs` 靜默歸零

> 類型：**指標正確性 / 靜默資料遺失**（production runtime 與匯出資料**無缺陷**；壞掉的是離線推導層）。
> 狀態：🔴 **未修（已診斷，含 113/113 的實機證據與精確機制）**。發現於 2026-09-08，WP-57 T5 的真人資料校準。
> 決策帳本：[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) §1 已列索引；尚無 `BD-031`。
> 相關：[KI-005](KI-005-omega-render-sim-aliasing.md)（同屬「render／sim 節拍不匹配污染離線推導」一族，但那條講 ω 的來源，這條講**連續性判準**）· `research/src/modules/metrics/algorithms/detect.py`（**C-D5 雙實作**，見 §5）

## 1. 症狀

四份真人 `spider-shot-wide-v1` 匯出（2026-09-08，同一台機器，60 Hz 顯示），`deriveDetectionMetrics()` 以**canonical 預設參數**執行：

| | 周邊 presentation | `status: 'detected'` |
|---|---|---|
| baseline / no-lift / all-lift / pause 四份合計 | 113 | **0** |

`tDetectMs` 因此全數 `undefined`。下游在同一份 run（baseline，34 個周邊到達）的實際產出：

| `deriveSpiderShotMetrics()` 欄位 | 有值 |
|---|---|
| `switchReaction.tDetectMs` / `.reactionMs` | **0 / 34** |
| `movementExecution.movementTimeMs` | **0 / 34** |
| `movementExecution.peakOmegaDegPerSec` | 34 / 34 |
| `stopControl.overshootDeg` | 8 / 34 |
| `firstShot.hit` / `.fireAngleErrorDeg` | 34 / 34 |
| `rhythm` | ✅ |

即：**五類構念裡有兩類在真人資料上完全拿不到數字**，而測試與 CI 全綠。

## 2. 根因

`firstSustainedDecrease()`（[detectionDerivation.ts:169-187](../../src/metrics/detectionDerivation.ts)）要求 **`sustainedTicks` 個連續**的離心率速度樣本低於 `−threshold`，遇到任何一個不合格樣本就把 `run` 歸零：

```ts
for (const sample of velocities) {
  if (sample.degPerSec < -thresholdDegPerSec) { if (run === 0) candidateStart = sample.t; run++; if (run >= sustainedTicks) return candidateStart; }
  else { run = 0; candidateStart = undefined; }   // ← 一個 0 就重來
}
```

預設 `sustainedTicks: 4`（line 65）隱含一個從未被寫下的前提：**每個 sim tick 的 `aim` 都會更新**。在這批資料上不成立 —— 逐 tick 追一次周邊到達：

```
t=11264.2  yaw= 0.07°  ecc=52.54   dEcc/dt = -28
t=11272.0  yaw= 0.07°  ecc=52.54   dEcc/dt =   0   ← aim 未變
t=11279.9  yaw= 1.01°  ecc=51.59   dEcc/dt =-122
t=11287.7  yaw= 1.01°  ecc=51.59   dEcc/dt =   0   ← aim 未變
t=11295.5  yaw= 2.86°  ecc=49.73   dEcc/dt =-238
t=11303.3  yaw= 2.86°  ecc=49.73   dEcc/dt =   0   ← aim 未變
```

`aim` 約每兩個 7.8125 ms 的 sim tick 才更新一次（有效 ≈ 64 Hz，對應 60 Hz 顯示）。負值與 0 **嚴格交替** ⇒ 連 2 個連續合格樣本都湊不出來。掃描證實它是精確交替而不是抖動：

| `sustainedTicks` | 1 | 2 | 3 | 4（預設） |
|---|---|---|---|---|
| detected / peripheral（四份合計） | **111 / 113** | **0 / 113** | **0 / 113** | **0 / 113** |

**不是門檻造成的**：把 `preStimulusMs` 降到 100、`thresholdSdMultiplier` 降到 0.5（門檻 p50 從 214 → 2.2 deg/s）並用 `sustainedTicks: 2`，仍是 **0/34**。唯一有效的變數是連續性要求。

### 失效邊界（估計，未逐檔驗證）

`aim` 更新率 `f` 對 sim 率 128 Hz：零樣本比例 ≈ `1 − f/128`。
- `f ≥ 128 Hz`（144 Hz 顯示）：幾乎無零樣本 ⇒ **從未在既有 fixture 上現形**（`research/fixtures/exports/` 的五份 counterstrafe 皆屬此類）。
- `f ≈ 120 Hz`：約 6% 零樣本，多數 presentation 仍湊得出 4 連 ⇒ 偶發漏檢。
- `f ≈ 64 Hz`（本例）：約 50% 且**規則交替** ⇒ 100% 失敗。

即這是一個在 120 Hz 以上不可見、在 60 Hz 硬性失敗的**懸崖**，不是漸進退化。

### 次要觀察（不是本次 0% 的成因，但同一份資料量到）

`preStimulusMs: 500` 的 baseline 窗會**吃進上一次拉槍**（本 drill 的 `rhythm` median 僅 828 ms）⇒ `baselineSdDegPerSec` p50 = 71 deg/s、`thresholdDegPerSec` p50 = **214 deg/s**（最大 804）。`baselineInsufficient` 全為 `false`，既有品質旗標抓不到。修好連續性之後，這一項會決定 `tDetectMs` 的偏誤大小，應一併評估。

## 3. 影響面

`deriveDetectionMetrics()` 的 production 消費者（非測試）：

- [`spiderShotMetrics.ts`](../../src/metrics/spiderShotMetrics.ts) —— `switchReaction`、`movementExecution.movementTimeMs`
- [`holdClickMetrics.ts`](../../src/metrics/holdClickMetrics.ts)
- [`researchMetrics.ts`](../../src/metrics/researchMetrics.ts) —— `computePhaseMetrics`
- [`spiderShotRepositioning.ts`](../../src/metrics/spiderShotRepositioning.ts)（WP-57 T5）—— 偵測窗左界
- Python 側 [`research/src/modules/metrics/algorithms/detect.py`](../../research/src/modules/metrics/algorithms/detect.py) —— 同一判準（`_first_sustained_decrease`、`sustain_ticks`）

⇒ **不限 WP-57、不限 spider shot**。任何在 aim 更新率低於 sim 率的機器上錄的 run，這些指標都會靜默消失。

## 4. 為什麼它是靜默的（這才是最該修的部分）

`status: 'timeout'` 是一個**合法值**，語意是「受測者在這次呈現中從未偵測到目標」。它與「推導層根本跑不動」在資料上**完全不可分**。於是：

- 匯出照樣 parse、測試照樣綠、CI 照樣 exit 0；
- 一份 100% timeout 的 run 看起來像「這位受測者完全沒反應」，而不是「這台機器的取樣率讓判準失效」；
- WP-57 T-exit 逐條對帳了 FR／NFR，**但從未把指標棧跑在真人資料上**，所以 README §2.7「五類構念零修改重用」的宣稱在交付時未被真人資料檢驗過（已回填記入 WP-57 progress §T5-real）。

## 5. 修改計畫（未執行）

**⚠️ C-D5：這是雙實作指標。** TS `detectionDerivation.ts` 與 Python `detect.py` 的判準必須同步，且 `research/fixtures/parity/detect-*.json` 與 [`tests/golden/research/detect-parity.test.ts`](../../tests/golden/research/detect-parity.test.ts) 是凍結對表。**任何語意變更都必須兩端同步 + 重跑 golden 產生腳本 + 版本字串升版，不得原地改語意。**

建議順序：

1. **先讓失效可見（不改語意，零風險）**：在 `DetectionPresentationDerivation` 加一個 additive 的資料充足性旗標（例如 `aimUpdateRateHz` 或 `zeroVelocitySampleShare`），並在整份 run 的 detected 率為 0 時讓呼叫端能分辨「沒反應」與「判準跑不動」。這一步不動判準、不影響 parity。
2. **再修判準**。候選：
   - **(a) 把「連續 N 個 tick」改成「持續 N 毫秒」**，並允許窗內夾雜非合格樣本（例如「在 T ms 的滑窗內有 ≥ K% 樣本低於門檻」）。語意最接近原意（「持續下降」），且對取樣率不敏感。
   - **(b) 先把速度序列重取樣到固定時基**再套原判準。改動小，但引入內插假設。
   - **(c) 只在偵測窗內忽略「aim 未變」的樣本**（`dYaw === 0 && dPitch === 0` 的 tick 不計入連續性中斷）。最小改動，但把「沒有新資料」與「速度為零」混為一談 —— 對真的靜止不動會過度寬容。
   建議 **(a)**；(c) 只適合作為臨時緩解。
3. 重跑 Python 端與 golden，`detect-parity.test.ts` 全綠，版本字串升版。
4. 補一份 **60 Hz 取樣的回歸 fixture**（本次四份 run 之一即可），否則這個懸崖會再度只在 144 Hz 上被測試而看不見。

**在修好之前的可用繞道**：以 `sustainedTicks: 1` 呼叫（既有參數，非第二套定義），並明確標註。WP-57 T5 的真人門檻校準即以此方式取得。代價是失去「持續」這一層雜訊抑制。

## 6. 範圍

不屬 WP-57。WP-57 T5 只以 `sustainedTicks: 1` 繞過並如實記錄；本條目所述的判準修復、雙實作同步與 60 Hz 回歸 fixture 屬 `detectionDerivation` 的擁有者。

## 7. 證據檔

四份真人匯出（2026-09-08，`spider-shot-wide-v1`，FOV 75、aspect 2.0031、60 Hz 顯示、`meta.dpi` 缺席、`suspect: true` 係 60 Hz 撞 `PERF_FLOOR_MS = 8.33`）：

| 用途 | 檔名尾碼 | sha256（前 16） | 周邊 presentation |
|---|---|---|---|
| baseline | `…T09_24_19.275Z` | `a14280ab48bbf835` | 34 |
| 全程不抬滑鼠 | `…T09_30_06.783Z` | `d40aea96a2304130` | 32 |
| 每次都抬滑鼠 | `…T09_31_25.160Z` | `2adaae7655820e23` | 23 |
| 刻意短停頓 | `…T09_32_47.152Z` | `96be9683eae81230` | 24 |

⚠️ **這四份檔案不會進 repo**（使用者決定，2026-09-08，[D-57.T5-8](../exec-plan/active/stage12/wp-57-spider-shot-wide-flick/progress.md)）。

⇒ **本條目的證據（113/113、0/113、上表的 `sustainedTicks` 掃描、逐 tick 交替樣本）在本 repo 內「不可重現」。** 上表的 sha256 只能證明「若日後有人拿到同一批檔案，那是同一批」，不能讓任何人重跑出這些數字。

**對修復計畫的直接影響**：§5 步驟 4 要求補一份 60 Hz 取樣的回歸 fixture —— 那份 fixture **不能**從這四份檔案裡挑一份了。修這條 KI 的人必須：

1. 依 [`spider-wide-recording-spec.md`](../operational/spider-wide-recording-spec.md) **重錄**一批含 60 Hz（或其他 aim 更新率低於 sim 率）的 run；**或**
2. 合成一份逐 tick 交替（aim 每兩個 sim tick 才更新）的 payload —— 機制已在 §2 記載得夠精確，合成得出來；代價是它證明的是「判準對交替取樣的行為」，不是「真人資料上真的會這樣」。

兩條路都可行，但**都不能引用本條目的數字當基準**——那些數字沒有可稽核的來源檔。
