# WP-54 / T7 — Difficulty calibration gate (`difficulty-calibration-gate-v1`)

> WP spec：[README.md](README.md) §4 T7 · checklist：[task-checklist.md](task-checklist.md) T7 ·
> running log：[progress.md](progress.md) · 操作手冊：[../../../../operational/tracking-pilot-runbook.md](../../../../operational/tracking-pilot-runbook.md)
> · 上游 gate：[T6-instrumentation-gate.md](T6-instrumentation-gate.md)（Gate A = 部分通過）
>
> **狀態：🟡 判準已凍結；乾跑已完成並通過（§3.1）；刺激經一次尺寸 revise（G5），等 12–20 人資料。** 依 [README §5](README.md)「Gate B/C 的 protocol threshold 必須在
> 收資料前凍結」——本文件 §2 是那份凍結,寫於任何 T7 真人資料之前(2026-09-03)。
> 後續變更一律以**新 protocol version + decision row** 表達,不得原地改語意。

---

## 1. Gate B 要證明什麼

README §4 T7 的 DoD：「retained cell 各至少 10 eligible runs；floor/ceiling、seed、visibility、
time slope report；未達 gate 不進 T8」。

Gate A 問的是「儀器量得對不對」；**Gate B 問的是「這些條件測得到東西嗎、難度落在可用區間嗎」**。
兩者的失敗模式完全不同,Gate A 全綠不代表 Gate B 會過——第三輪正是「儀器忠實地記錄了一個問不出
答案的問題」([T6 §12.8](T6-instrumentation-gate.md))。

| 類別 | 內容 | 誰能證明 |
|---|---|---|
| **B-1 刺激可分辨性** | 每個 cell 的**凍結準心比值**在門檻之上——即該條件能分辨「會跟槍」與「完全不動」 | 離線可預測(§3),但**只有真人資料能證實** |
| **B-2 難度落點** | 沒有 ceiling(太簡單、排不出人)、沒有 floor(取得不到目標) | 只有真人施測 |
| **B-3 操弄有效性** | size × speed 的效果方向符合預期;seed 家族等效;25 s 內表現無過大漂移 | 只有真人施測 |
| **B-4 份量與品質** | 每個 retained cell ≥ 10 份 eligible run | 只有真人施測 |

---

## 2. 凍結的判準（PREREGISTERED — 2026-09-03,收資料前）

### 2.1 已由上游凍結、本 gate 沿用（不重新決定）

| 項目 | 凍結值 | 出處 |
|---|---|---|
| 受測者數 | **12–20 人**,不同 tracking 程度 | OQ-54-6（T0） |
| Scored block 長度 | **25 s** + 1 s prep | D-54.4 / OQ-54-3 |
| Primary outcome | **RMS ε(t)**（deg）,per condition | T0 preregistration |
| Sim rate / schema | 128 Hz fixed step / export schema v2 | ADR / T1 |
| Metric version | `tracking-dynamics-v1` | T3 |
| Protocol version | `tracking-pilot-v1` | T5 |
| Eligibility | `evaluateTrackingRunEligibility()` 的封閉 reason vocabulary;**blocked run 不進聚合** | FR-54-10 / T4 |
| 交付速度驗收帶 | **0.95–1.05**（不得放寬,[T6 §11.8](T6-instrumentation-gate.md)） | KI-023 |
| 每個 retained cell | **≥ 10 份 eligible run** | README §4 T7 |

### 2.2 本 gate 新凍結的判準（使用者拍板 2026-09-03）

> 每一列都是**研究決策**,由使用者於 2026-09-03 拍板;agent 不得自行調整。
> 逐 cell 判定,除非該列另有說明。
>
> **2026-09-04 的唯一修訂（B-3a 的標籤,語意不變）**：size revise（§3.2）把兩個尺寸層由
> `0.5° / 2.0°` 改為 `2.0° / 3.0°`,故 B-3a 原文引用的具體數值改寫為「小/大尺寸層」。
> **判準的內容沒有改變**——它問的一直是「同速度下較小的目標 TOT 是否較低」。門檻本身
> （B-1 的 2.0、B-2 的 5%/80%/15%、B-3b 的 10%/±15%、B-3c 的 20%、B-4 的 10）**一律未動**。

| # | 判準 | 凍結的操作型定義 | 通過條件 |
|---|---|---|---|
| **B-1** | **凍結準心比值**（discriminability） | 把準心凍結在該 run 受測者自己的 aim 中位數,以同一個 `angularEccentricityDeg()`、在與 canonical `rmsEpsilonDeg` **逐 tick 相同**的 scored 窗重算 ε,取 `RMS ε(凍結) / RMS ε(實際)`。實作 = `scripts/trackingFrozenCrosshairRatio.ts`（analysis runner **layer 5**）。**cell 層取該 cell 全部 eligible run 的 per-run 比值中位數** | **median ratio ≥ 2.0** |
| **B-2a** | **Easy ceiling** | 該 cell 全部 eligible run 的 `totPercent` 中位數;以及 RMS ε 的**受測者間** CV（SD/mean,每位受測者取其該 cell 的 RMS ε） | **median TOT < 80%** **且** **受測者間 CV ≥ 15%**。任一違反 ⇒ ceiling |
| **B-2b** | **Hard floor** | `acquisitionFailure` 為 true 的 eligible run 比例;以及 `totPercent` 中位數 | **acquisition failure < 20% 的 run** **且** **median TOT > 5%**。任一違反 ⇒ floor |
| **B-3a** | **size × speed 效果方向** | 對 4 個 core cell 的 median 值檢查方向（非顯著性檢定） | **同時成立**：①同速度下 **小尺寸層的 median TOT < 大尺寸層的**（尺寸確實影響 on-target）；②同尺寸下 **14 deg/s 的 median RMS ε > 5 deg/s 的**（速度確實影響追隨誤差）。方向反轉 ⇒ 操弄無效,revise。*尺寸層目前為 2.0°（小）/ 3.0°（大）;2026-09-04 前為 0.5° / 2.0°* |
| **B-3b** | **Seed equivalence** | 全員跑 seed family A;其中 **6–8 人加跑 family B**。以那 6–8 人的**成對 within-subject** 差（同 cell、同人、A vs B 的 RMS ε）判定 | **\|median 成對差\| ≤ 10%**（相對於該 cell family A 的 median RMS ε）**且** TOST 等效界 **±15%** 內 |
| **B-3c** | **Time-on-task slope** | 同一 scored 窗內**前 5 s** 與**後 5 s** 的 RMS ε,`Δ = (後 − 前) / 前`;跨該 cell 全部 eligible run 取平均 | **\|Δ\| ≤ 20%**。超出 ⇒ 於本文件記「25 s 需調整」並提出建議長度,**不自動改值**（D-54.4 是凍結值,改動須走新 protocol version） |
| **B-4** | **份量** | 該 cell 的 `eligibleRunCount` | **≥ 10** |

### 2.3 retained / revise / remove 決策規則（凍結）

逐 cell 套用,順序如下：

1. **B-4 未達**（< 10 份 eligible run）⇒ **資料不足,不判定**。補資料或記為 revise;**不得**以少於 10 份的資料宣告 retained。
2. **B-1 未過**（median ratio < 2.0）而其餘皆過 ⇒ **從能力指標集 `remove`,但保留為 diagnostic block**。
   - 該 cell **不得**進入教練報告、不得進入任何能力聚合（**C-D3**）;仍在 manifest 中施測並保留勻質資料。
   - 兩個 axis calibration block **預期永遠落在此類**——它們本來就是可辨識度診斷,不是能力 cell。
3. **B-2a（ceiling）或 B-2b（floor）未過** ⇒ **`revise`**：該 cell 的難度落在不可用區間,記錄實測值與建議的再參數化方向。
4. **B-3a 方向反轉** ⇒ **`revise`**（操弄未生效,不是難度問題）。
5. **B-3b / B-3c 未過** ⇒ **不影響單一 cell 的 retained/remove**,但記為 **protocol-level revise**：seed 家族不等效 ⇒ 不得跨家族合併;slope 過大 ⇒ block 長度需調整。
6. 全部通過 ⇒ **`retained`**。

**紅線（README §5/§6）**：不得以增加真人樣本數掩蓋 gate 失敗;不得偷偷淘汰條件——任何 remove 都必須
走上列規則並在 §6 留檔。

### 2.4 Gate B 的 go / revise / stop

- **Go** ⇒ **至少一個 core matrix cell 與至少一個 reversal cell 判 `retained`**,且 B-3b/B-3c 皆過
  ⇒ T7 PASS,可開 T8（repeatability,20–30 人、相隔 24–72 小時）。
- **Revise** ⇒ 有 cell 落在 revise,但問題可由再參數化解決 ⇒ 記錄決策、改參數、重跑（**新世代**）。
- **Stop** ⇒ **core matrix 與 reversal 兩個家族的所有 cell 都無法同時通過 B-1 與 B-2**
  ⇒ 本 WP 以 stop 結案,不發布 Assessment（README §6）。

### 2.5 聚合的操作型定義（2026-09-04 凍結,補 §2.2 未寫死之處）

> **§2.2 的門檻一律未動**（B-1 的 2.0、B-2 的 5%/80%/15%、B-3b 的 10%/±15%、B-3c 的 20%、B-4 的 10）。
> 本節只補齊 §2.2 沒有寫死、但**會改變 gate 數字**的三處操作型定義。使用者於 2026-09-04 拍板,
> 仍寫於**任何 T7 真人資料之前**(README §5)。實作見 §5。

| # | §2.2 未寫死之處 | 凍結的定義 | 理由 |
|---|---|---|---|
| **A-1** | B-1 / B-2a / B-2b / B-3a / B-4 的 cell 層分母要不要含 family B 的 run | **只用 family A（`Session index = 0`）的 eligible run 判主判準**;family B 的 run **只**供 B-3b 的成對比較,不進其他任何判準的分母 | §2.3 規則 5 明文「seed 家族不等效 ⇒ 不得跨家族合併」,而等效性正是 B-3b 要判的 ⇒ **先合併等於預設了結論**。副作用有二,都是好的:B-4 的 ≥ 10 由 12–20 位 family A 受測者自己撐起（可行）;加跑 family B 的那 6–8 人不會在核心 cell 佔雙倍權重 |
| **A-2** | 同一受測者在同一 cell 有多份 eligible run 時（retry 之後）,B-2a 的**受測者間 CV** 取那個人的哪一個值 | **取該受測者在該 cell 全部 eligible run 的 RMS ε 中位數**;只有一份時退化為該值 | 與 B-1 / B-2a / B-2b 的 cell 層一致都用 median ⇒ 整條判準只有**一種**集中趨勢定義（C-D4 的精神）。取「最早一份」會丟資料且在 retry 情形下留下的正是被 retry 掉的那份 |
| **A-3** | B-3b 的 TOST 用哪個檢定形式與 α（§2.2 凍了等效界 ±15%,沒凍 α） | **成對差的雙單尾 t 檢定,α = 0.05**;等價於「成對差的 **90% CI** 落在 ±15% 內」,報表以 CI 呈現 | 最常規的選擇。**已知侷限**:n = 6–8 檢力偏低 ⇒ 容易得到「**無法宣告等效**」而非「不等效」。§6 必須據實寫明是哪一種,**不得**把「未達顯著」倒推成等效 |

**這三條與 §2.2 同樣受 README §5 約束**：收資料後不得調整;若證據顯示不合適,以**新 protocol
version + 新 decision row** 表達,並標註哪批資料以哪一版判定。

---

## 3. 招募前的乾跑（凍結為 Gate B 的前置,使用者決定 2026-09-03）

> **理由**：B-1 的離線預測依賴一個由 **2 位受測者、2 個速度點**擬合的人類誤差模型
> （`RMS ε ≈ 0.183 + 0.1867 · v_eye`）,它在 reversal 家族上交叉驗證通過但仍是外插。
> **三輪 Gate A 已因刺激問題作廢三批真人資料;若先招募 12–20 人才發現比值不達標,作廢的是
> 12–20 人的量。** 乾跑成本約 5 分鐘。

1. **操作員自己**（非受測者）跑：`practice` + 一個慢速 core cell + 一個快速 core cell +
   一個 reversal cell。**G5 的對應 block 是** `3deg_5dps` + `2deg_14dps` + `reversal_medium`
   （2026-09-04 的 G4 乾跑跑的是當時的 `2deg_5dps` + `0p5deg_14dps` + `reversal_medium`）。
2. 跑分析：`npx vite-node scripts/analyze-tracking-pilot.ts -- <資料夾> --out .pilot-analysis/t7-dryrun`
3. **逐項檢查（全部須成立才招募）**：
   - `atEye` 行：`dist ≈ 4.00u`、`rmsSpeed` **95–105% of nominal**、`size` = 該 cell 的宣稱尺寸
     （G5：2.000 / 3.000°）
   - `fidelity=match`（layer 3b;**舊世代批次會被判 mismatch,那是預期**）
   - **TOT 落在凍結的 5–80% 窗內**（B-2 的難度落點;這是 2026-09-04 乾跑真正抓到的問題）
   - **`discriminability ratio ≥ 2.0`**（layer 5）—— 這是乾跑存在的理由
   - `still=` < 5%（reversal）、覆蓋率 ≥ 99.5%、`recorderOverflow` false
4. **任一項不成立 ⇒ 不招募**,回到參數化決策（研究決策,問使用者）。
5. 乾跑資料**不計入 Gate B 證據**（操作員非受測者、非預註冊樣本）,只作為儀器/參數確認。

### 3.1 乾跑結果（2026-09-04,操作員 P05,9 個 block,G4 刺激）：✅ **四項全過**

| 檢查 | 凍結門檻 | 實測 | 判定 |
|---|---|---|---|
| `atEye` 交戰距離 | ≈ 4.00 u | **3.99–4.01 u** | ✅ |
| `atEye` 交付/宣稱速度 | 0.95–1.05 | **1.00–1.03**（100–103%） | ✅ |
| `atEye` 角尺寸 | 0.500 / 2.000° | **0.500 / 1.996–2.004°** | ✅ |
| layer 3b 保真度 | `match` | **9/9 match**（maxPosErr ≤ 8.9e-16 u） | ✅ |
| **layer 5 凍結準心比值** | **≥ 2.0** | **2.05–3.48**（每個 block） | ✅ |
| 覆蓋率 / overflow / 違規 | ≥ 99.5% / 0 / 0 | 3202–3203 ticks、25008–25016 ms、0、0 | ✅ |
| JSON/HTML parity | 逐位相同 | ok | ✅ |

⇒ **G4 刺激的儀器與可分辨性都成立,可以招募。** 逐 block 比值：practice 3.42、calib_h 3.48、
calib_v 3.01、`2deg_5dps` 2.98、`2deg_14dps` 3.35、`0p5deg_5dps` 2.77、`0p5deg_14dps` 3.36、
reversal medium 2.81、high 2.05。**實測值高於 §3 的離線預測**（2.19–2.97）,唯 reversal high
（2.05）貼近門檻。

### 3.2 乾跑觸發的尺寸 revise（G4 → G5,研究者決定 2026-09-04）

乾跑同時暴露了一個**難度**問題（不是儀器問題）：**兩個 0.5° 核心 cell 的 TOT 只有 3.9% / 1.5%,
低於本文件 §2.2 凍結的 B-2b hard floor（> 5%）**。以同一批錄音、跑同一套 pipeline、只換 hitbox
重算 TOT：

| block | 0.5° | 0.75° | 1.5° | **2.0°** | 2.5° | **3.0°** |
|---|---|---|---|---|---|---|
| `0p5deg_14dps` | **1.5** | 2.6 | 10.2 | **16.4** | 23.5 | 29.4 |
| `0p5deg_5dps` | **3.9** | 8.2 | 35.6 | **53.7** | 72.7 | 85.8 |
| `2deg_14dps` | 2.0 | 3.7 | 11.5 | 19.0 | 27.1 | **35.4** |
| `2deg_5dps` | 9.6 | 16.8 | 46.8 | 62.3 | 75.4 | **86.2** |
| `calibration_h` / `_v` | 19.7 / 15.7 | 29.8 / 26.9 | 55.0 / 51.6 | **71.1 / 65.3** | — | — |
| `reversal_medium` / `_high` | 1.7 / 1.2 | 4.6 / 2.2 | 18.7 / 10.7 | 28.2 / 19.1 | 36.7 / 28.1 | **48.5 / 39.2** |

**研究者決定**：size 候選值 `[2.0, 0.5]` → **`[3.0, 2.0]`**（小尺寸層 0.5→2.0、大尺寸層 2.0→3.0）;
calibration 隨小候選值 → 2.0°、reversal 與 practice 隨大候選值 → 3.0°。**2×2 factorial 保持完整**
（兩個尺寸層 × 兩個速度）。新 drillId：`3deg_5dps` / `3deg_14dps` / `2deg_5dps` / `2deg_14dps`。

> **已入帳的風險**：`3deg_5dps` 在這一份乾跑上重算為 **86.2%,高於凍結的 80% ceiling**。研究者在
> 看過這個數字後仍選定 3.0°。B-2a 判的是**跨受測者中位數**加上受測者間 CV 下限,不是單一（且較
> 熟練的）操作員,故這是**風險而非判定**——但它是 Gate B 最可能被判 `revise` 的 cell,分析時要優先看。
> `practice` 的 95.9% 不受此限（practice 不是 scored cell、不進聚合）。

**離線預測值（G4,供乾跑對照;`scripts/trackingFrozenCrosshairRatio.ts` 的同一定義）**：

| cell | 交付 v_eye | 角尺寸 | 凍結準心 RMS ε | 預測比值 |
|---|---|---|---|---|
| `practice` / `2deg_5dps` / `0p5deg_5dps` | 5.01–5.13 | 1.999 / 1.999 / 0.500° | 2.95–3.14 | **2.64–2.75** |
| `calibration_horizontal` / `_vertical` | 5.12 | 0.500° | 3.13–3.14 | **2.75–2.76** |
| `2deg_14dps` / `0p5deg_14dps` | 13.94–14.01 | 1.999 / 0.500° | 8.24–8.30 | **2.96–2.97** |
| `reversal_medium` / `_high` | 11.73 / 9.57 | 2.00° | 4.31–5.97 | **2.19–2.51** |

---

## 4. 施測與資料回收

**操作步驟與回收格式沿用 [T6 §5 / §7](T6-instrumentation-gate.md)**（researcher 模式 → Tracking pilot
→ 填 Participant ID / Session index / Rest seconds → Start manifest → 每 block 自動下載 JSON）。
T7 的差異只有三點：

1. **份量**：12–20 人（非 T6 的 3–5 位 tester）。
2. **seed 家族**：**全員 `Session index = 0`（family A）**;其中 **6–8 人另跑一次 `Session index = 1`
   （family B）** 以取得 B-3b 的成對資料。加跑者請在紀錄中標明。
3. **跨面板覆蓋**：T6 的 21 份 payload 全來自**同一台 60 Hz / 3840×2160 / Edge 151 機器**,
   `displayRefreshHz`（D-54.41）至今沒有第二種刷新率驗證過 ⇒ **T7 招募應涵蓋不同刷新率/解析度**,
   並在紀錄中寫明。compatibility key 會把不同刷新率分成不同 cohort,故這是覆蓋面而非污染。

**仍然適用的操作警示**：
- ⚠️ **開跑前務必口頭提醒「不要按右鍵」**：三場 session 累計 5 次 `protocol_violation`,**5/5 全是
  `kind: "ads"`**。程式端刻意不阻止（OQ-54-13）,這道防線只有操作員的事前提醒。
- block 跑動中**沒有 Abort 按鈕**;要作廢就讓它跑完再按 **Retry block** 並填原因（append-only,D-54.32）。
- **`Rest seconds` 不寫進匯出**（OQ-54-10）⇒ 每人一行紀錄須**手記**：Participant ID、session index、
  rest 秒數、瀏覽器與版本、**顯示器解析度/刷新率**、retry/abort 理由。
- 真實 participant payload **永不進 git**;放 repo 外,`.pilot-analysis/` 已 gitignore。

**批次識別**：一律以 `meta.session.participantId` 判定,**不要信路徑/檔名配對**（第二輪的教訓：
Downloads 裡同時存在多批,路徑對不上但 meta 全部吻合）。

---

## 5. 分析（跑既有實作,不另寫一次性腳本）

```
npx vite-node scripts/analyze-tracking-pilot.ts -- <資料夾...> --out .pilot-analysis/<批次>
```

逐 run 印出五層 + evidence/parity：

| 層 | 內容 | 實作 |
|---|---|---|
| 1 | schema v2 驗證 | `parseExportPayload()` |
| 2 | run-level eligibility（操作員當時看到的判定） | `evaluateTrackingRunEligibility()` |
| 3 | event 對表（reversal 的 `target_motion_change` vs 排程） | runner 的 `stimulusCheck()` |
| 3b | **刺激保真度**（錄到的位置 vs 現行程式重建）⇒ 世代錯亂偵測 | `checkTrackingStimulusFidelity()` |
| **4** | **交付角度 @ 眼睛**（交戰距離、交付/宣稱速度、角尺寸）⇒ KI-024 的常設守門 | `measureTrackingDeliveredAngles()` |
| **5** | **凍結準心比值**（B-1 的判準本體） | `computeTrackingFrozenCrosshairRatio()` |
| **6** | **time-on-task slope 的逐 run 輸入**（B-3c：同一 scored 窗前 5 s vs 後 5 s 的 RMS ε 與 Δ） | `computeTrackingTimeOnTaskSlope()` |
| — | evidence JSON + self-contained HTML + parity | `buildTrackingPilotEvidence()` / `renderTrackingPilotReportHtml()` |
| **Gate B** | **逐 cell 判準與 §2.3 判定**（B-1 / B-2a / B-2b / B-3a / B-3c / B-4 + retained·revise·remove·insufficient-data） | `extractTrackingGateBRuns()` → `aggregateTrackingGateB()` |

Gate B 那一段每次都印,**即使批次遠不足 12–20 人**——這時每個 cell 會照 §2.3 規則 1 回
`insufficient-data`,正是招募途中該看到的東西,而不是一個看起來可用的數字。
不在現行 registry 內的 drillId（例如 G4 的 `0p5deg_*`）會以 `UNKNOWN DRILL IDS` 印到 stderr 並
**排除在 Gate B 之外**,這是跨世代混批的最後一道攔阻。

**stderr 警示**（不要忽略）：`STIMULUS FIDELITY MISMATCH`（世代錯亂）、`DELIVERED-AT-EYE OUT OF BAND`
（刺激未交付宣稱值）、`!!P0-MISMATCH`（layer 5 的分母、或 layer 6 的整窗 RMS 與 canonical
`rmsEpsilonDeg` 漂移）。

B-2a 的受測者間 CV、B-3a 的方向、B-3b 的成對差與 B-3c 的 slope 由 evidence JSON 逐 cell 聚合得出,
**聚合的操作型定義見 §2.5**（family A 判主判準、逐人取中位數、TOST 成對雙單尾 α=0.05）。
**新增的聚合函式必須是純函式 + 回歸測試**（比照 slice 1/3/7 的慣例）,不得用一次性腳本產生 gate 數字。
分批識別所需的 participant 與 seed family 都可由 `meta.session` 還原（`sessionLabel` 形如
`tracking-pilot-v1:<PID>:session-<n>`）⇒ **不需要改 export schema**。

---

## 6. Gate B 逐項對帳（施測後填,每項須有日期與數值）

**工程前置（已完成 ✅）**

- [x] 刺激再參數化落地並離線驗證（G4：頻帶 `[0.15,1.05]`、speed 候選值 `5/14`、振幅 ±16°）。
- [x] 交付角度以**眼睛**為原點被量測且在 0.95–1.05 帶內（KI-024 / BD-024,`field-low` 補 `eyeZ: 0`）。
- [x] B-1 的判準有受測試的單一實作（`trackingFrozenCrosshairRatio.ts` + 回歸測試,layer 5）。
- [x] B-3c 的 per-run 輸入有受測試的單一實作（`trackingTimeOnTaskSlope.ts` + 回歸測試,layer 6,
      **2026-09-04 / slice 7**）。
- [x] 全部判準已在收資料前凍結（本文件 §2）,聚合的操作型定義亦於收資料前凍結（**§2.5**,
      **2026-09-04 / slice 8**）。

- [x] **cell 層聚合函式**（B-1 / B-2a / B-2b / B-3a / B-3c / B-4 與 §2.3 的逐 cell 判定）——
      `trackingGateBAggregates.ts`（純函式，15 tests）+ `trackingGateBExtract.ts`（6 tests），
      分析 runner 每次印出（**2026-09-04 / slice 9**）。

**工程前置（招募前仍未完成 ⬜）**

- [ ] **B-3b（seed 家族成對差 + TOST）尚無實作**。依 §2.3 規則 5 它不改變單一 cell 的
      retained/remove，故與 cell 層聚合分開落地;但 §2.4 的 go 判定需要它 ⇒ **必須在 6–8 人的
      family B 資料回收之前完成**。

**乾跑（§3,招募前）**

- [x] 操作員乾跑完成,四項檢查全過（**2026-09-04**,P05 ×9 block;比值 **2.05–3.48**;
      `atEye` 3.99–4.01 u / 100–103% / 0.500–2.004°;見 §3.1）。
- [x] 乾跑觸發的尺寸 revise 已落地（**G5**：size 候選值 `[3.0, 2.0]`,§3.2）。
- [ ] **G5 刺激的乾跑**：尺寸改變 ⇒ 新世代。招募前應再跑一次 §3 的四項檢查確認比值仍 ≥ 2.0
      （尺寸不影響 ε,故比值預期不變,但 TOT 會變——這一輪要確認的是 TOT 落在 5–80% 窗內）。

**真人項（12–20 人,未完成 ⬜）**

- [ ] 12–20 位受測者完成 family A;6–8 人加跑 family B。
- [ ] 招募涵蓋 **≥ 2 種顯示器刷新率**（T6 的覆蓋缺口）。
- [ ] 每個 retained cell ≥ 10 份 eligible run（B-4）。
- [ ] 每份 run 的 eligibility 已記錄;blocked 的 run 有處置說明。
- [ ] **B-1**：逐 cell median ratio（表列實測值）。
- [ ] **B-2a / B-2b**：逐 cell median TOT、受測者間 CV、acquisition failure 比例。
- [ ] **B-3a**：size 與 speed 的效果方向。
- [ ] **B-3b**：seed 家族成對差 + TOST（§2.5 A-3：α=0.05 / 90% CI）。**若 n=6–8 只得到「無法宣告
      等效」,必須據實寫成那樣**——不得把未達顯著倒推為等效。
- [ ] **B-3c**：time-on-task slope。
- [x] **0.5° pixel floor：已於 2026-09-04 結案**（T7 DoD 項目）。真正的 0.5°（約 8.5 CSS px）
      在**單軸** calibration 下 TOT **19.7% / 15.7%** ⇒ 看得見也跟得上;在**雙軸**核心 cell 只有
      **3.9% / 1.5%** ⇒ 跟不了。結論是「0.5° 在雙軸追蹤下不可用」,不是「0.5° 看不見」。
      T6 §12.5 的「連單軸也看不見」是**實為 0.25°** 時的回報（KI-024）,已作廢。
      ⇒ 小尺寸層提高到 2.0°,**不再安排 0.5° block**。
- [ ] 逐 cell 輸出 retained / revise / remove（依 §2.3,不覆寫 v1 protocol）。
- [ ] 沒有真實 participant payload 被 commit 進 repo。

---

## 7. 版本與環境（本文件引用的證據出處）

| 項目 | 值 |
|---|---|
| 刺激世代 | **G5**（G4 + size 候選值 `3.0 / 2.0`,drillId `3deg_*` / `2deg_*`）;乾跑資料為 **G4**——辨識方式見 [analysis-tracking.md](../../../../operational/analysis-tracking.md)「刺激語意」 |
| 刺激基線 commit | **G5 = T7 slice 6**（size revise）;G4 = `320b718`（slice 4）;`field-low` 錨定於 `6899b00`（slice 3） |
| 分析器 | layer 5 於 `9741ba9`（slice 1）、layer 4 於 `6899b00`（slice 3） |
| Protocol / metric version | `tracking-pilot-v1` / `tracking-dynamics-v1` |
| Trajectory versions | `band-limited-2d-v1`、`reversal-2d-v1` |
| Export schema | v2 |
| Block 長度 | 25 s scored + 1 s prep |
| Smoothing / lag 預設 | `tracking-dynamics-smoothing-v1-tri3`、`lagSearchMs 0–250`、`minValidTicks 32`（D-54.21,**pipeline 預設而非協定凍結值**——見 §8 N2） |
| 交付實測（離線,G4） | 速度 5.01–5.13 / 13.94–14.01 deg/s;角尺寸逐位 0.500 / 1.999°;world y 最低 0.43 |
| 全專案驗證（凍結時） | `vitest` 212 files / 2035 tests passed;`tsc --noEmit` 與 `-p tsconfig.node.json` exit 0;`playwright tracking-pilot-live --project=edge` 1/1 |

---

## 8. 從 Gate A 帶進來的殘留（T7 期間要一併觀察,非新缺陷）

- **N1 — reversal 交付反轉數強烈依賴 seed**：medium **29**（seed 54100）vs **42**（seed 64100）,
  config 宣稱約 23。P05 的密集排程使 **8/42（19%）** 個 window 落入 `insufficient-window-data`。
  機制 = [KI-019 §5.3](../../../../known_issue/KI-019-reversal-2d-v1-bound-pinned-schedule-degeneration.md)
  的邊界截斷;儀器忠實,但**同一條件跨 seed 家族的刺激可比性受影響** ⇒ **B-3b 的判定要特別看 reversal**。
  是否放寬邊界到 ±25° 依 T7 的新數字判。
- **N2 — P1 lag railing**：`lagMs` 恰為搜尋上界 250.0 ms 的條件由第二輪 5/8 增為**每批 6/8**,
  `status` 仍回 `'ok'`。D-54.21 說明 `lagSearchMs 0–250` 是 pipeline 預設 ⇒ T7 可放寬,或加「railed」
  旗標讓撞邊界不再偽裝成有效峰值。**lag 不是 Gate B 判準**,但若要進 T8 的 redundancy 分析須先處理。
- **N4 — velocity gain 普遍 > 1**：16 個條件中 15 個落在 1.00–1.43。真人普遍過衝,與 synthetic
  fixture 分布不同。
- **TOT 的可解讀性**：G3 的 `2deg_5dps` 與 `0p5deg_5dps` RMS ε 幾乎相同（0.62–0.72°）,TOT 卻是
  43–49% vs 2.5–4.5% ⇒ **這些 cell 的 TOT 幾乎全由 hitbox 尺寸決定**。B-2 刻意把 TOT 與受測者間
  散度並用,正是為了不讓「TOT 看起來合理」單獨支撐一個 cell（C-D3）。
- **60 Hz suspect flag**：每份匯出帶 `suspect: true` / `validity.perfFloor: true`
  （`PERF_FLOOR_MS = 8.33` 是為解析度研究設的,非 tracking 量測失效;eligibility 刻意不看,
  OQ-54-11 已決）。

---

## 9. 判定

**🟡 未判定 —— 判準已凍結（§2）,等乾跑（§3）與 12–20 人資料（§4）。**

依 README §5：本文件 §2 的任何數值在收資料後**不得**調整;若證據顯示判準本身不合適,以
**新 protocol version + 新 decision row** 表達,並明確標註哪一批資料是以哪一版判準判定的。
