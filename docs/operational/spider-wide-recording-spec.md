# spider-shot-wide-v1 真人 run 錄製規格

> 目的:錄一批能**回答 OQ-57.5 ③「抬滑鼠標註率是否隨 `cm/360` 上升」**的真人資料。
> 權威背景:[WP-57 progress §T5-real](../exec-plan/active/stage12/wp-57-spider-shot-wide-flick/progress.md) ·
> [WP-57 README §1.6](../exec-plan/active/stage12/wp-57-spider-shot-wide-flick/README.md) ·
> [KI-031](../known_issue/KI-031-detection-sustained-ticks-dies-when-aim-updates-slower-than-sim.md)
> 分析工具:`npm run analyze:spider-wide`(見 §5)

---

## 1. 為什麼要重錄(不要跳過這節)

2026-09-08 已錄過四份真人 run,它們**成功**校準了門檻(`stallMinMs = 150`／`stallOmegaDegPerSec = 2`,TP 78%／FP 3%),但**回答不了方向性**,原因是設計上的:

| run | 指示 | sens | cm/360 | 標註率 |
|---|---|---|---|---|
| 2 | 全程不抬滑鼠 | 1.5 | 34.6 | 3% |
| 4 | 刻意短停頓 | 1.5 | 34.6 | 17% |
| 1 | 照平常打 | 1.0 | **52.0** | **0%** |
| 3 | 每次都抬滑鼠 | 0.5 | 103.9 | 78% |

**指示與感度完全共線**——每個指示只有一個感度。104 cm/360 那份標註率高達 78%,但它同時也是「每次都抬滑鼠」那份,所以無從分辨那 78% 是行程造成的還是指示造成的;順序甚至不單調(52.0 的標註率是 0%,比 34.6 的兩份都低)。

⇒ **要打破共線,唯一的方法是固定指示、只變感度。**

另外三件在那批資料上踩到的坑,本規格逐一擋掉:`meta.dpi` 沒填(§2.3)、60 Hz 顯示撞 KI-031(§2.1)、以及那四份檔案**不進 repo**(§4)。

---

## 2. 錄製前的硬性設定

### 2.1 顯示更新率 ≥ 120 Hz(**最重要**)

2026-09-08 那台機器是 60 Hz 顯示,aim 約每兩個 sim tick 才更新一次,於是 `deriveDetectionMetrics()` 的 `sustainedTicks: 4` 連續性要求**全滅**(detected = 0/113,[KI-031](../known_issue/KI-031-detection-sustained-ticks-dies-when-aim-updates-slower-than-sim.md))。所有 §T5-real 的數字都是靠 `sustainedTicks: 1` 的繞道取得的。

- **≥ 120 Hz**:canonical 預設可用,`meta.suspect` 也不會被 `PERF_FLOOR_MS = 8.33` 判紅。
- **只有 60 Hz 可用**:仍可錄,但要知道 ① 每份 run 都會 `suspect: true`(過不了實驗資格閘),② 全部數字帶 KI-031 繞道。分析腳本會逐份點名這兩件事,不會靜默。

### 2.2 固定不動的變數

| 項目 | 值 | 為什麼 |
|---|---|---|
| drill | `spider-shot-wide-v1` | 其他 drill 沒有 `zone: 'peripheral'`,母體為空 |
| FOV | **75**(全程不改) | FOV 改變會改 yaw 窗(`yawMax` 在 FOV 60→120 之間差 27°),刺激就不是同一個 |
| 視窗尺寸／aspect | 全程不改,不要中途 resize 或切全螢幕 | aspect 同樣進 yaw 窗;arm-time 解析一次後凍結 |
| 滑鼠、滑鼠墊、握法、桌面空間 | 全程同一組 | 行程上限是本次的自變數的一半,換墊子等於換自變數 |
| DPI | 全程同一個值 | 換 DPI 會與 in-game 感度交互,`cm/360` 的來源就不唯一了 |

### 2.3 `Mouse DPI` **必填**

SessionSetup 的 `Mouse DPI` 欄位省略時,`meta.dpi` 缺席,`deriveMouseThrow()` 只回得出 `counts/360`、回不出 `cm/360`——而 `cm/360` 就是本次的自變數。

2026-09-08 那批的 cm/360 是拿使用者**口頭**給的 800 算的,payload 內查無此值,**事後無法稽核**。分析腳本會把缺 DPI 列為 blocker。

### 2.4 原始滑鼠取樣的錄製前提(WP-60,**選配**)

原始逐筆滑鼠取樣(`mouseSamples`)是**預設關閉**的。**不開也能錄** —— §3 的方向性 cohort 完全不需要它,缺這個區塊不會讓任何一份 run 變成 blocked。要它的唯一理由是:那是 [WP-61](../exec-plan/active/stage13/wp-61-lift-off-validation/README.md) 判斷「空洞前後運動學能不能分離抬滑鼠與停頓」的唯一原料。

要開就必須同時滿足下面四件事,否則**錄到的是不可用的取樣**(分析腳本會逐份點名,但錄完才知道就來不及了):

| 前提 | 怎麼做 | 不滿足的後果 |
|---|---|---|
| **開啟取樣** | 以 `?rawMouse=1` 載入(`http://localhost:5173/?rawMouse=1`)。這是 D-60.T2-1 的 opt-in,不加就沒有 `mouseSamples` 區塊 | 沒有這一維資料(合法,非 blocker)|
| **事件率 ≥ 500 Hz** | 用 1000 Hz 輪詢率的滑鼠;T0 R1 在本專案硬體上實測 1005 Hz | `dt` 解析度不足以支撐任何時間間隙判定 ⇒ blocker(F1)|
| **cross-origin isolation 生效** | 走 `npm run dev` / `npm run preview`(COOP/COEP 已設);別用 `file://` 或自架的簡易 static server | `event.timeStamp` 鈍化到 100 µs 級,`dt` 被捨入雜訊污染 ⇒ blocker(F4)|
| **全程不要中斷 Pointer Lock** | 不要按 Esc、不要 alt-tab、不要點出視窗 | 中斷期間的移動依 FR-A-8 **整筆丟棄**,留下一個與抬滑鼠**同形**的空洞。腳本會用 `pointer_lock` 事件把它排除,但那段軌跡不可復原 ⇒ blocker(FR-60.6)|

⚠️ **容量**:arena 為 1000 Hz × `maxDrillSeconds` × 1.2 headroom。輪詢率高於 1000 Hz(4000／8000 Hz 滑鼠)會溢位 —— 末端樣本被丟棄,`sampleOverflow` 為 true。這**不會**污染 `meta.suspect`,tick 資料仍然有效(D-60.P5),但那份原始取樣的結尾不是 drill 的結尾。

⚠️ **匯出體積**:原始取樣約 9.5 bytes/sample。60 s / 1000 Hz 約 +0.57 MB(現行匯出 3.4–3.8 MB)。

---

## 3. 錄製矩陣

### 3.1 主要 cohort(回答方向性)

**同一個指示 ×(2–3)個感度**。指示固定為「**照平常打**」——不是「不要抬滑鼠」也不是「每次都抬」,因為要量的是「行程變長之後,他**自然**會不會被迫抬滑鼠」。

| # | 指示 | in-game 感度 | 對應 cm/360 @ 800 DPI | 目標周邊呈現數 |
|---|---|---|---|---|
| A | 照平常打 | 1.5 | ≈ 34.6 | ≥ 30 |
| B | 照平常打 | 1.0 | ≈ 52.0 | ≥ 30 |
| C | 照平常打 | 0.5 | ≈ 103.9 | ≥ 30 |

- **三檔優於兩檔**:兩點只能看斜率的正負,三點才看得出單調。分析腳本兩點就會作答,但會把點數印在結論裡。
- **≥ 30 個周邊呈現**:`timeLimitMs = 60000` 在 800–1,000 ms 的節奏下約可得 30–37 個。不足時同一感度多錄一輪,**分開存檔**(腳本逐檔處理,不會替你合併)。
- **順序做平衡**:不要固定 A→B→C。疲勞與熟練都會隨時間單向漂移,和感度順序混在一起就又是一組共線。建議 B→C→A 或隨機序,並把實際順序寫進 §3.3 的 manifest 備註。
- **每檔之間讓受測者適應**:換感度後先隨便打 20–30 秒再開始正式錄,否則量到的是「還沒適應新感度」。

### 3.2 選配:重跑門檻驗證(跨硬體複驗 OQ-57.5 ①)

若這次是**不同的機器**(尤其 aim 更新率不同),值得順手把 2026-09-08 的三個指示重錄一次,以複驗 `150 / 2` 這組門檻在新取樣特性下是否還成立:

| # | 指示 | 感度 |
|---|---|---|
| D | 全程不抬滑鼠 | 與 B 同(1.0) |
| E | 每次都抬滑鼠 | 與 B 同(1.0) |

⚠️ 與 §3.1 不同,這兩份**感度必須與 B 相同**——它們是門檻的 TP/FP 對照,不是方向性的點。

### 3.3 manifest(指示 = ground truth)

錄完後寫一份 JSON,把檔名對到指示。分析腳本靠它分組;沒有 manifest 就一律拒答方向性。

```json
{
  "spider-shot-wide-v1-2026-09-15T01_00_00.000Z.json": "照平常打",
  "spider-shot-wide-v1-2026-09-15T01_10_00.000Z.json": "照平常打",
  "spider-shot-wide-v1-2026-09-15T01_20_00.000Z.json": "照平常打",
  "spider-shot-wide-v1-2026-09-15T01_30_00.000Z.json": "全程不抬滑鼠",
  "spider-shot-wide-v1-2026-09-15T01_40_00.000Z.json": "每次都抬滑鼠"
}
```

指示字串**逐字相同**才會分到同一組(腳本不做模糊比對——「照平常打」與「照平常打 」是兩組)。

### 3.4 一併記下(payload 內沒有的)

- 顯示器更新率、滑鼠型號、滑鼠墊可用行程(cm)
- 每份的錄製順序與時間
- 受測者主觀回報:哪一檔感度讓他覺得「墊子不夠用」

---

## 4. 檔案怎麼存(D-57.T5-8)

**匯出檔不進 repo。** 使用者於 2026-09-08 決定不把 wide-flick 的真人匯出收進 `research/fixtures/exports/`(各 3.4–3.8 MB)。連帶後果已入帳:

- §T5-real 與 KI-031 的所有數字在本 repo 內**不可重現**,只留 sha256;
- 分析輸出 `.spider-wide-analysis/` 同樣 gitignored(由參與者匯出推導者一律不進 git,同 `.pilot-analysis/`／`.contact-analysis/`)。

⇒ **要引用數字,就要連同產生它的那批檔案一起保存在 repo 外**,並在文件裡記下 sha256 與存放位置。若日後改變主意要收進 repo,那是一個獨立決策(C-D1 的 committed fixture 例外),需重新入帳。

---

## 5. 錄完之後:跑分析

```bash
npm run analyze:spider-wide -- <匯出資料夾> --manifest <labels.json>
```

輸出寫到 `.spider-wide-analysis/`(markdown + JSON),並印在終端機。報告分三段:

1. **資料品質** —— 逐份點名 blocker(缺 DPI、`suspect: true`、drill 不對、母體為空、撞上 KI-031 懸崖,以及 §2.4 開了原始取樣時的四種取樣失效:事件率不足、溢位、`crossOriginIsolated: false`、Pointer Lock 中斷)。**先看這段**;有 blocker 的數字不能直接用。
2. **逐 run** —— cm/360、周邊呈現數、canonical 預設與繞道下各自的 detected 數、timeout 率(順帶回答 [OQ-57.4](../exec-plan/active/stage12/wp-57-spider-shot-wide-flick/README.md) 剩下的那半題:harness 的 timeout 率恆為 0,只有真人 run 量得到)、標註數與標註率。<br>後面接一張**原始取樣健康度**子表(WP-60):`sampleCount`、`observedRateHz`、`sampleOverflow`、`lockBreakCount`、`gapCountAtThreshold`、`longestGapMs`。**六欄同進同出** —— 沒開 §2.4 的取樣時全部印 `—`(缺席),不是 `0`(有錄到但為零)。全批都沒有時整張表換成一行說明。
3. **方向性** —— cohort 共線時**明確拒答**並說出缺什麼,而不是照樣印一張有斜率的表。可答時給出按 cm/360 遞增排序的點與單調性判斷。

腳本用的門檻是 `150 / 2`(D-57.T5-7),detection 走 `sustainedTicks: 1` 的 KI-031 繞道,兩者都印在報告開頭。**KI-031 修好後,這兩件事都要改回來並重跑。**

原始取樣的間隙門檻是 **30 ms**(`REPORTED_GAP_THRESHOLD_MS`),取自 `performance_analysis` 的 `TIME_GAP_THRESHOLD_MS` 當 prior,同樣印在報告開頭。⚠️ **它不是校準值**:T0 R2 已實測「空洞長度不足以可靠分離抬滑鼠與停頓」(兩者都到秒級),故 `gapCountAtThreshold` 與 `longestGapMs` 是**描述性**的量 —— 它們說「這裡有幾個空洞、最長多久」,**不說**任何一個空洞是抬滑鼠。把它們讀成抬滑鼠次數就是誤用。

---

## 6. 這批資料**不會**回答的問題

寫在這裡,免得日後被過度引用:

- **n=1 受測者**的方向性不是族群結論。它能證偽(若標註率隨行程下降,原假設就錯了),但證實只是「與假設一致」。
- **緊 ω 門檻(2 deg/s)條件於取樣特性**。換一台 aim 更新率不同的機器,§3.2 的 D/E 兩份才是複驗它的依據。
- **抬滑鼠與刻意停頓不可完全分離**。2026-09-08 那批的實測:刻意停頓的 `ω<2` p90 是 474 ms,比抬滑鼠的 180–225 ms **還長**。長尾重疊是真實行為,不是偵測器缺陷,不要試圖用調門檻消掉它。
- **標註率不是指標(C-D3)**。它是資料品質標註,不得進教練報告或 `DrillMetricRegistry`。
