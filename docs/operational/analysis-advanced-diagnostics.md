# 進階診斷層:SPARC(`sparc-v1`)· Key-Velocity xcorr(`xcorr-v1` / `gate-v1`)· Fitts(`fitts-v1`)

本檔是 WP-31 進階診斷層的 operational registry,**已於 T-exit 定稿**(2026-08-12)。涵蓋
**`sparc-v1`**(逐段平滑度,FR-D13,T1)、**`xcorr-v1` / `gate-v1`**(key-velocity 耦合與其效度判定,
FR-D14,T2)、**`fitts-v1`**(Fitts ID/MT/TP,FR-D15,T3),以及 T-exit 收斂的三份判定表 + 報告載體
契約(`coach-report-v2` 研究向區塊)+ WP-32 交接結論(見文末 [T-exit 章節](#t-exit--三份判定收斂--報告載體契約--wp-32-交接))。

三個構念的交付物都是**判定**,不是數字(C-D3 / GD-20):「算得出來」不等於「可以對選手講」。
每個構念的章節末尾都必須有一段明確的使用限制。

> 三個構念在來源專案(`performance_analysis`)的原始設計脈絡(目的/公式推導/notebook 用法),已靜態複製於
> [`docs/algorithm/metrix_design/`](../algorithm/metrix_design/README.md):
> [per-segment-sparc-tracking-guide](../algorithm/metrix_design/per-segment-sparc-tracking-guide-2026-05-21.md)(`sparc-v1`)、
> [key-velocity-coupling-guide](../algorithm/metrix_design/key-velocity-coupling-guide-2026-05-22.md)(`xcorr-v1`/`gate-v1`)、
> [velocity-scaling-consistency-guide](../algorithm/metrix_design/velocity-scaling-consistency-guide-2026-05-21.md)(`fitts-v1` 相關背景)。
> 本檔仍是本專案的權威定義(C-D4);複製文件僅供回溯設計脈絡,不可覆寫本檔的凍結 registry。

---

## `sparc-v1`

### 回答什麼

一次**主要動作**(MR 區間)的角速度軌跡有多平滑。SPARC(spectral arc length)= 正規化速度頻譜在
0–20 Hz 內的弧長取負值:頻譜越「毛」(能量散佈在越多頻率上)弧長越長、SPARC 越負,對應動作越不平滑。

### 逐段單位 = `phase-v1` 的 MR 區間(段來源契約,不可改 scoping)

SPARC 的逐段單位是 **`phase-v1` 的 MR 區間** —— 逐 peek 窗內 `seg-v2` 分段後的**第一個
`primary_flick`**(D-30.1 / D-30.1b),與 `phase-v1` 使用**同一組邊界**。本模組
[`sparc.py`](../../research/src/modules/metrics/algorithms/sparc.py) **沒有任何自己的分段或偵測**。

這是 T0 凍結的契約(D-31.3 / D-31.5),理由有二:

1. **樣本量**:`seg-v2` 對**整條軌跡**一次分段,三份真實 fixture 各只切出 **1** 個
   `primary_flick`(pooled n=3)—— 峰值門檻 `mean + kσ` 被整條 trace 的統計吃掉。改為逐 peek 窗內
   分段則得 **20 / 19 / 20(pooled 59/60)**。n=3 會讓 FR-D13 的「分佈報告」形同虛設。
2. **C-D4**:若 SPARC 自行決定另一種 scoping,`primary_flick` 就有了**第三個定義**。

機械保證:[`test_sparc_fixture.py`](../../research/src/modules/metrics/algorithms/tests/test_sparc_fixture.py)
斷言 `sparc_table` 的有效列數**逐 fixture 等於 `phase-v1` 在同一份 fixture 上的非退化 MR 數**
(20/19/20,pooled 59)。整條軌跡分段會讓這條斷言從 59 掉到 3,當場 fail。

### 演算法:逐位移植,零在地改良

`compute_sparc` 逐位對應 performance_analysis 的
`research/src/modules/analysis/algorithms/metrics_sparc.py`(外部 repo;該檔本身移植 Go
`computeSPARC`)。**不得**因為「128Hz 上 bin 太少」而動任何常數或 padding 規則(D-31.2)——那會讓
跨 repo golden 對表退化成自我對表,FR-D13 的外部驗證力歸零。解析度問題以**診斷 + 使用限制**處理
(見下節)。

| 常數 | 值 | 語意 |
|---|---:|---|
| `MIN_SAMPLES` | 16 | 樣本數不足 → 回傳 **`0.0`**(**不是** NaN) |
| `MAXV_FLOOR` | 1e-9 | `max(v)` 低於此 → `0.0` |
| `MAXMAG_FLOOR` | 1e-12 | 頻譜最大幅度低於此 → `0.0` |
| `FSPAN_FLOOR` | 1e-9 | `f_span` 低於此 → 代入 `1.0` |
| `FC_HZ` | 20.0 | 只取 ≤20 Hz 的 bin |
| `AMP_THRESH` | 0.03 | k>0 的 bin 幅度低於此則跳過(第一輪) |
| `FALLBACK_MIN_BINS` | 8 | 第一輪 <2 bin 時,改取前 8 個 ≤20Hz 的 bin(不套振幅門檻) |

其他逐位保留的細節:

- **正規化分母是 `max(v)`,不是 `max(|v|)`**(Go 慣例)。本專案 ω ≥ 0 故兩者等價,仍逐位保留。
- **零填充 `n = 1 << (len−1).bit_length()`**(補到 2 的冪)。這是階梯的來源;**不得**改成固定 N。
- **退化一律回傳 `0.0` 不拋例外**;輸入含 NaN → 回傳 `nan`。
- 回傳 `-arc`。

`compute_sparc_traced()` 額外回傳 7 個中間值(`max_v` / `n_fft` / `max_mag` /
`freqs_pass1_count` / `freqs_final_count` / `f_span` / `arc`),欄位名逐一對應 PA golden 的
`expected_*` 鍵 —— 對表失敗時直接指出**第一個分岔的中間值**,不是只說最終值不同。

**未移植**:`compute_segment_sparc` / `build_uniform_speed_series`。那是 PA 為非等間隔 ~1kHz 資料
重採樣用的;本專案 128Hz 均勻 tick 不需要。

### 跨 repo golden(兩份,任務不同)

兩份 golden 都是 **committed JSON**。`research/` 執行期與 `uv run pytest` **不得** import
performance_analysis 的任何模組或路徑(C-D1);在沒有該 repo 的機器上測試必須全綠。

| golden | 內容 | 證明什麼 |
|---|---|---|
| [`fixtures/golden/sparc-pa-parity.json`](../../research/fixtures/golden/sparc-pa-parity.json) | 自 PA 的 `research/src/modules/analysis/algorithms/tests/golden/sparc_parity.json` **逐位元組移入**(1 case:`velocity_series` len=64、`fs=1000`、7 個 `expected_*` 中間值 + `expected_sparc`) | **演算法身分**:本 repo 的實作與 PA / Go 同源。8 個量全比,相對誤差 ≤1e-9 |
| [`fixtures/golden/sparc-128hz-domain.json`](../../research/fixtures/golden/sparc-128hz-domain.json) | 本專案 fs 域:4 個真實 MR 段(N=32 與 N=64 各 2 例)+ 4 個合成邊界(len=15 / len=16 / 全零 / 含 NaN);期望值由 **PA 的實作**跑出 | **本域固定**:未來本 repo 重構不得改變 128Hz 上的輸出 |

**`sparc-128hz-domain.json` 產生方式與出處**(C-D1 的單一穿越點):

- 產生腳本:[`research/src/modules/metrics/notebooks/t1/generate_sparc_domain_golden.py`](../../research/src/modules/metrics/notebooks/t1/generate_sparc_domain_golden.py)(一次性,**不被 pytest 執行**)
- 來源 repo:`performance_analysis`,路徑 `research/src/modules/analysis/algorithms/metrics_sparc.py`
- 來源 commit:**`c1aa3f78a1a7c65ec280dffb6a849821c4ab0c10`**
- 產生日期:**2026-08-10**
- 隔離方式:PA 在**子行程**中以 `PYTHONPATH` 指向 PA 自己的 `research/src` 執行;本 repo 的
  `modules` 是 regular package,與 PA 同名套件無法並存,子行程讓這條界線是機制而非自律。

同樣的 provenance 區塊也寫在 golden JSON 內,並由測試斷言(commit hash 長度、產生日期、腳本路徑)。

隔離的機械證據(T1 DoD ⑥,以 import 掃描證明而非刪除該 repo):
[`test_sparc_purity.py`](../../research/src/modules/metrics/algorithms/tests/test_sparc_purity.py)
—— ① import `sparc` 後,`sys.modules` 內**沒有任何模組的 `__file__` 落在 PA repo 路徑下**
(檔案路徑檢查比名稱檢查更強);② `sparc.py` 與三份測試的 import 行逐行掃描,零 `performance_analysis`
/ `modules.analysis`;③ `notebooks/` 全域掃描,**只有** `generate_sparc_domain_golden.py` 一個檔案
提及該 repo(allow-list,新增第二個穿越點會當場 fail);④ `sparc.py` 無 file I/O / 無 print /
無 matplotlib(C-D2)。

### 封閉 flags 詞彙表

`KNOWN_SPARC_FLAGS`;未知 flag 拋 `AssertionError`,比照 `peek.py` / `detect.py` / `phase.py` /
`curves.py`。**缺錨點是常態語意,不是缺失值**:一律標 flag 並排除聚合,不吞成 NaN、不補 0。

| 條件 | flag | `sparc` 欄位 |
|---|---|---|
| 該 peek 的 ω 窗樣本數 < `MIN_SAMPLES + 1`(結構上不可能容納一個達標的 MR 段) | `window_too_short` | `None` |
| 該 peek 沒有 `primary_flick` 段 | `no_primary_flick` | `None` |
| MR 段長 < `MIN_SAMPLES`(16) | `too_few_samples` | `None`(**不**填入 port 的退化值 `0.0`) |
| 演算法走到退化分支(`max_v`/`max_mag` 觸底、最終 bin < 2、輸入含 NaN) | `degenerate_spectrum` | 保留 port 的原始回傳(`0.0` 或 `nan`) |

`window_too_short` 的門檻是**從已移植常數推導**的(`MIN_SAMPLES + 1`,+1 來自 `omega_deg_s` 契約上
index 0 的 `nan`,TD-3 / D-29.4),**不是**第二個可獨立調整的參數。

判別 `degenerate_spectrum` 用的是「`sparc == 0.0` 或非有限」:`arc` 是嚴格正的線段長度之和
(`dx = (f[i]−f[i−1])/f_span > 0`),所以真實結果**恆 < 0**,`0.0` 只可能來自退化分支。

### 聚合納入規則

沿用 D-29.5:一列的值只有在**數值有限且整列 flags 為空**時才進 `n` 與分佈。被排除的列仍完整輸出
供檢視(`sparc_table` 不丟列,只有聚合步驟排除)。

### 凍結 `sparc-v1` 參數 registry

| `fs_hz` | `step_ratio_threshold` | Version |
|---:|---:|---|
| 128.0 | 0.5 | `sparc-v1` |

2026-08-10 由 WP-31 T0 凍結(progress.md **D-31.5**),**在看到任何真實 SPARC 值之前**。

- **`fs_hz = 128.0`** 是 sim 標稱頻率,也是所有上游構念既有的假設。它是**假設不是觀測**,因此由
  測試對資料覆核:三份真實 fixture 的 tick 中位間隔必須等於 `1000/128 = 7.8125 ms`(SPARC 值直接
  隨假設取樣率縮放,這條不能只靠文件自律)。
- **`step_ratio_threshold = 0.5`** 是「N=32/64 階梯大到讓跨段長比較會說錯故事」的 pre-registered
  判準(OQ-S4-18)。語意 = 階梯跳幅達到 bucket 內自然離散度的一半。取 1.0 已被否決:等於只在階梯
  大到肉眼可見時才示警,而 SPARC 的教練解讀正是在「小差異」層級發生的。

改任一值一律升 `sparc-v2` + 全鏈重跑,不得原地改(D-30.4 / D-28.7 先例)。

### N=32/64 零填充階梯診斷(OQ-S4-18 → **已判定**)

**問題**:128Hz 下段長 24–32 tick 補到 N=32(df=4.00 Hz,≤20Hz 只有 **6** 個 bin);33–58 tick 補到
N=64(df=2.00 Hz,**11** 個 bin)。實測段長中位數 **32**,**恰好落在邊界上** —— 相差一個 tick 的兩
段動作,頻譜解析度差一倍。PA 的原始資料 ~1kHz,同一條 padding 規則在那裡不構成問題;在 128Hz 它是
一等風險。

`sparc_length_sensitivity()` 量化這個階梯:

```
step_ratio = (bucket 中位數之間的最大差) / (bucket 內 IQR 的最大者)
```

**當次判定(2026-08-10,三份真實 fixture pooled,n=59)**:

| `padded_n` | ≤20Hz bins | n | 中位 SPARC | IQR |
|---:|---:|---:|---:|---:|
| 32 | 6 | 32 | −1.3926 | 0.0823 |
| 64 | 11 | 27 | −1.4758 | 0.1089 |

```
median_gap = 0.0832   max_iqr = 0.1089   step_ratio = 0.7643
0.7643 >= step_ratio_threshold 0.5  →  verdict = stratified_only
```

> **⚠️ 使用限制(逐字進報告)**:**SPARC 僅限在同一個 `padded_n` bucket 內比較。**
> 兩個 bucket 的中位 SPARC 相差 **0.0832**,達到 bucket 內自然離散度(IQR 0.1089)的 **76%** ——
> 遠高於 pre-registered 的 50% 判準。也就是說,「這一下比較不順」與「這一下多了一個 tick,FFT 從
> 32 點補到 64 點」在跨 bucket 時**無法區分**,對選手講前者有相當機率是錯的。

**這個階梯**不能**被歸因為純粹的 padding 假象**:`step_ratio` 量的是「bucket 間中位數差」對
「bucket 內離散度」的比值,它**不區分**兩種解釋 —— ① 零填充解析度差異(方法學假象);② 較長的
主要動作本來就比較不平滑(真實效應,例如含較多修正)。兩者在本設計下**共變**(段長同時決定
`padded_n` 與動作本身的性質),無法以現有資料分離。這正是判定 `stratified_only` 而不是「扣掉一個
padding 修正項」的理由:能確定的是**跨 bucket 的 SPARC 差異不可單一解讀**,不能確定的是它有多少
來自哪一邊。要分離兩者需要在同一 `padded_n` bucket 內操弄段長,屬新設計、不在本 WP。

**處理方式不是改參數**(D-31.2):`FC_HZ` / `AMP_THRESH` / padding 規則 / `MIN_SAMPLES` 一律不動,
也不新增固定 N 的第二版本(那會逼近 C-D4 意義下的第二定義)。階梯只決定**使用限制**。

證據檔:
[`notebooks/t1/outputs/sparc-length-sensitivity.json`](../../research/src/modules/metrics/notebooks/t1/outputs/sparc-length-sensitivity.json)(committed;
由測試斷言與重算逐鍵相同)·
[`sparc-vs-length.svg`](../../research/src/modules/metrics/notebooks/t1/outputs/sparc-vs-length.svg)
(散點:x=`n_ticks`、y=`sparc`、顏色=`padded_n`,紅虛線標 L=32/33 邊界)。

### 真實資料證據(2026-08,P001,n=3 sessions)

來源:[`generate_sparc_report.py`](../../research/src/modules/metrics/notebooks/t1/generate_sparc_report.py)。
逐 session 並列,**不併池推論**(KI-004-S1 / R-7 紀律):

| Session | n | 排除 | SPARC 中位 | IQR | MR 段長中位(tick) | n(pad 32) | n(pad 64) |
|---|---:|---:|---:|---:|---:|---:|---:|
| 09:18 | 20 | 0 | −1.4214 | 0.097 | 31.5 | 13 | 7 |
| 09:24 | 19 | 1 | −1.4383 | 0.130 | 32.0 | 10 | 9 |
| 09:37 | 20 | 0 | −1.4511 | 0.092 | 35.0 | 9 | 11 |
| **pooled**(僅供階梯診斷) | **59** | **1** | −1.4391 | 0.112 | 32.0 | 32 | 27 |

唯一被排除的 peek 是 09:24 peek 0 —— `seg-v2` 已知的 below-floor / 零段 peek(D-30.1b),已計入
`seg-v2` 自己的 98.3% 成功率,**不是** SPARC 特有的新排除。

逐 peek 列表:`notebooks/t1/outputs/sparc-table-<fixture>.csv`;逐 session 摘要:
`sparc-distributions.csv`。

### `synthetic_counterstrafe.json` 是必跑回歸,不是「不支援」

合成 fixture 的兩個 peek 各 24 tick,MR 段各 **9** tick —— 低於移植常數 `MIN_SAMPLES = 16`,因此
**確定性**觸發 `too_few_samples`,`sparc` 為 `None`(**不是** 0.0)。這由
`generate_sparc_report.py` 硬斷言。

注意這與 `phase-v1` 在**同一份 fixture** 上走的是**不同的**退化分支(`phase-v1` 因
`min_window_ticks=30` 判 `window_too_short`):兩個構念量的不是同一件事,觸底原因自然不同;要求是
兩者都必須**明確失敗而非崩潰**,且都不得捏造數值。

### 已知限制(`sparc-v1`)

- **跨段長不可比**:見上方階梯判定。當次 verdict = `stratified_only`,這是 SPARC 目前**最重要**的
  使用限制。
- **樣本效度**:三份真實 fixture 為**同一匿名受試者 P001、同一台 240 Hz 機器、同一 drill config、
  同一天三個 session**。任何 SPARC 結論一律附此限制;不是母體層級證據(KI-004 R-7)。
- **不跨 session 併池推論**:三 session 並列呈現。pooled 列只用於階梯診斷(需要兩個 bucket 都有
  足夠 n),**不是**訓練效果主張。
- **只涵蓋 `primary_flick`**:FR-D13 明寫逐 `primary_flick`;逐 `micro_adjustment` 段的 SPARC 屬
  新 scope,未做。
- **參數註冊於標稱 128 Hz**(同 `seg-v1`/`seg-v2`/`phase-v1`/`curve-v1` 慣例);不同取樣率需新版本。
- **`window_too_short` 在本樣本上從未觸發**(真實最短窗 53 tick,合成 24 tick 亦達 17):該分支
  僅由單元測試驗證,尚無真實資料實例(比照 `phase-v1` 的 `anchor_before_onset`)。
- **T-exit 收斂結果(2026-08-12)**:SPARC 已進 `coach-report-v2` 的**研究向區塊**(`#advanced`),
  逐段 SPARC 分佈 + `padded_n` bucket 摘要 + `stratified_only` 使用限制逐字隨每份報告輸出;
  **不進主表**(C-D3)。SPARC 無 `blocked-by-data` 分支,故不會出現在「缺口說明」區塊。

---

## `xcorr-v1`

### 回答什麼

一次 peek 之內,**signed A/D 鍵狀態**與**視角角速度 ω(t)** 之間有沒有帶時延的耦合(strafe-aim 干擾),
以及誰領先。輸出是完整 correlogram(每個 lag 的 signed Pearson r)+ 峰值 lag/強度。

### 通道與對齊:本專案免對時(這是相對 performance_analysis 的結構性優勢)

- **key-state 一律取自 `ticks[].keys`**:`D` → **+1**、`A` → **−1**、**同按或都沒按** → **0**。
  「A+D 同按 = 0」是編碼語意不是丟樣本 —— 兩鍵同按不產生淨 strafe 輸入(09:18 session 2,038 tick
  中有 40 個),不得算成其中一邊贏。W/S 不存在於階段 A drill,故 `signed_ad` 比 PA 的 `signed_wasd`
  窄是設計而非遺漏。
- **免對時**:key-state 與 ω 由**同一個 128 Hz sim 迴圈**取樣,天然同格 → **沒有時鐘對齊步驟,也沒有
  對齊誤差要編列**。PA 的 key 流與 mouse 流來自不同時鐘,那一層成本在本專案是零。
- **兩個通道一起丟 index 0**:`omega_deg_s` 契約上 index 0 為 `nan`(TD-3 / D-29.4),故 key-state 與
  ω 同時切掉第一個樣本 → 配對樣本數 = 窗長 − 1,`min_ticks` 套用在**配對樣本數**上(沿用 `sparc.py`
  以 `MIN_SAMPLES + 1` 推導窗門檻的作法,不新增第二個可調參數)。
- **`key` 事件僅作交叉檢核**(見下節),不作主資料源。

### lag 符號慣例(逐字保留,否則會被讀反)

> **負 lag = key 狀態領先 ω;正 lag = ω 領先 key 狀態。**

逐位沿用 performance_analysis `metrics_key_velocity_coupling_xcorr.py` 的
`_xcorr_peak`:`lag > 0` 比對 `key[t+lag]` 與 `omega[t]`。

### 演算法

| 元件 | 作法 | 來源 |
|---|---|---|
| 逐 lag r | signed Pearson,對**該 lag 的重疊區段**計算 | PA `_pearson` |
| `MIN_PEARSON_SAMPLES` | **4** —— 重疊少於 4 個樣本回 `nan`(不是相關,是雜訊) | PA `_pearson` |
| 零標準差 | 回 `nan`(**不是 0.0**):常數序列與任何東西都沒有線性關係,填 0 會被讀成「量過了,沒耦合」 | PA `_pearson` |
| 峰值 | `|r|` 最大者;`PEAK_TIE_EPSILON = 1e-12` 內同分 → 取 `|lag|` 較小者 | PA `_xcorr_peak` |
| 退化 lag | r 為 `nan` 的 lag **不參與峰值**,但**保留在 correlogram**,曲線上的洞看得見 | 本專案 |

**實作偏離(僅效能,不改語意)**:`_pearson` 直接以 `dx·dy / (‖dx‖‖dy‖)` 計算,而非 `np.corrcoef`
(permutation null 要呼叫它約 130 萬次,直接算快 5×)。`test_coupling.py` 以 200 組隨機輸入斷言兩者
差 ≤1e-12,讓「比較快」不會變成「比較不一樣」。

### correlogram 每個 lag 都帶有效樣本數(不是裝飾)

`correlogram` 的每一項是 **`(lag_ms, r, n_overlap)`**。理由(S-31.1):`max_lag_ms = 250`(±32 tick)
相對真實窗中位 62–65 tick **並不小** —— `|lag|` 接近上限時兩序列只剩約 30 個配對樣本,correlogram
兩端天生比中央不穩。**只印 r 不印 n 會邀請讀者把樣本稀少讀成耦合**;D-31.5 因此要求 n 隨每個點一起
輸出(CSV `n_overlap` 欄 + SVG 的灰色 overlap 曲線)。這是**呈現完整性要求**,不得反過來用作事後放寬
`max_lag_ms` / `min_ticks` 的理由。

### 封閉 flags 詞彙表

`KNOWN_XCORR_FLAGS`;未知 flag 拋 `AssertionError`,比照 `peek.py` / `phase.py` / `sparc.py`。

| 條件 | flag | `peak_*` |
|---|---|---|
| 配對樣本數 < `min_ticks`(32) | `window_too_short` | `None`;correlogram 為空 tuple |
| key-state 標準差為 0(整窗只按一邊或都沒按) | `key_state_constant` | `None` |
| ω 標準差為 0 | `omega_constant` | `None` |
| ω 含非有限值 | `non_finite_omega` | `None` |
| 上述皆不成立,但每個 lag 的重疊都低於 `MIN_PEARSON_SAMPLES` | `no_finite_lag` | `None` |

`no_finite_lag` 刻意與 `window_too_short` 分開:兩者的成因不同,合併會讓表看不出是哪一種。

### 聚合納入規則

沿用 D-29.5:一列只有在**數值有限且整列 flags 為空**時才進 `n` 與分佈。被排除的列仍完整輸出供檢視。

### 凍結 `xcorr-v1` 參數 registry

| `max_lag_ms` | `min_ticks` | `key_encoding` | Version |
|---:|---:|---|---|
| 250.0 | 32 | `signed_ad` | `xcorr-v1` |

2026-08-10 由 WP-31 T0 凍結(progress.md **D-31.5**),**在看到任何真實 xcorr 值之前**。

- **`max_lag_ms = 250`** = 32 tick @ 7.8125 ms,涵蓋實測 MR 中位段長 ≈250 ms。
- **`min_ticks = 32`** 是**結構性下限**(= lag 預算的 tick 數),刻意**不**取真實最短窗 53 —— 那是對現
  有樣本量身訂做的門檻,新錄製稍短就整批排除。
- 改任一值一律升 `xcorr-v2` + 全鏈重跑。

### `key` 事件交叉檢核(獨立報告,**不**進 flags)

`key_event_crosscheck()` 把 `ticks[].keys` 推出的每個 A/D 狀態轉換,與 WP-29 / T3 的 additive `key`
事件貪婪就近配對,容差 `(tolerance_ticks + 1)` tick(1 tick 給量化本身 —— 輸入時戳的事件會落在下一個
tick —— 加上要求的容差)。

**當次結果(2026-08-10)**:

| fixture | tick 轉換 | `key` 事件 | 配對 | 最大殘差 | status |
|---|---:|---:|---:|---:|---|
| 09:18 | 86 | 86 | **86** | 7.7675 ms | `agree` |
| 09:24 | 84 | 84 | **84** | 7.7725 ms | `agree` |
| 09:37 | 78 | 78 | **78** | 7.7150 ms | `agree` |
| `synthetic_counterstrafe` | 7 | 0 | 0 | — | `no_key_events` |

三份真實 fixture **零不符**,且最大殘差 **< 1 tick**(7.8125 ms)—— 正是「輸入時戳事件被取樣到下一個
tick」應有的樣子。合成 fixture 沒有 `key` 事件(additive 欄位未輸出),status 為 `no_key_events`:
**證人缺席不是證詞不符**。

**為何不做成 `xcorr_table` 的 flag**(D-31.8):交叉檢核驗的是**輸入通道**,不是某個窗的可計算性;把它
折進 `flags` 會讓一個**可觀測性檢查**沉默地改變已凍結 gate 的 `n`,而 D-29.5 的納入規則正是為了讓這種
耦合看得見。不符時報告 status 與逐項計數,由人判讀。

---

## `gate-v1`

### 為什麼不是「換個門檻」,而是「換一個算得出來的量」

OQ-S4-3 原提案 `split-half r ≥ 0.7`。split-half reliability 問的是「同一群**個體**的個體差異,用一半
題目估與用另一半估是否一致」,需要一個**跨受試者的變異維度**。現行樣本 = **1 受試者(P001)× 3
session × 20 peeks**,跨受試者維度 **n = 1** → 分母(受試者間變異)為零,**r 在數學上不可計算**。把 3
個 session 當 3 個單位硬算得到的是 n=3 的相關係數,它估的是 session 間穩定性,不是個體差異可靠度。

所以這不是把門檻調鬆,是把**不可計算的量換成可計算的量**;代價寫在下面的上限條款裡。

### 三件組操作化(T2 只執行,不得修改)

session 級統計量 = 該 session 通過納入規則的 peek 的 **中位 `|peak_strength|`**。

| # | 條件 | 操作化 |
|---|---|---|
| ① | **shuffle / permutation null** | 逐 peek 對 `key_state` 作**循環位移**(circular shift),位移量自 `rng` 取樣於 `[1, n_ticks−1]`(**避開 0 與全長**);重算該 peek 的 peak strength → session 級統計量;重複 1000 次構成 null;`p` = null 中 **≥ 觀測值**的比例(單尾) |
| ② | **bootstrap CI** | 逐 session 對 peek **有放回**重抽 2000 次,取 session 級統計量的 **95% percentile CI**;比對 `ci_width_max` |
| ③ | **奇偶半分** | 同 session 內奇數 / 偶數 `peek_index` 各算一次 session 級統計量;`|Δ|` 須落在 ② 的 CI 寬度內 |

**位移必須是循環的**:完全隨機重排會破壞 key-state 自身的自相關結構,null 會過度樂觀 → 假顯著。

### 凍結 `gate-v1` registry(七欄位 + seed)

| `min_samples` | `shuffle_iters` | `shuffle_alpha` | `bootstrap_iters` | `ci_width_max` | `half_agreement_within_ci` | `seed` | Version |
|---:|---:|---:|---:|---:|---|---:|---|
| 10 | 1000 | 0.01 | 2000 | 0.20 | `True` | **20260810** | `gate-v1` |

2026-08-10 由 WP-31 T0 凍結(progress.md **D-31.4**),**在看到任何真實 xcorr 值之前**。**不得依 T2 的
實際結果調整**;要改只能整組升 `gate-v2` + 重跑全鏈 + 入 [DECISIONS.md](../exec-plan/DECISIONS.md)。

**決定性**:每個 session 以 `default_rng([seed, blake2b(session)])` 取亂數 —— 因此一個 session 的判定
**不依賴表裡還有哪些 session、也不依賴它們的順序**,單獨重跑一個 session 會逐位重現批次跑的結果。
`gate-v1` 全程**單執行緒**:平行化會重排 seeded RNG 的取樣順序,直接摧毀這條性質(WP-31 README §6;
由 `test_coupling_purity.py` 斷言原始碼不含 thread/process pool)。

### 判定規則(三分支,pre-registered;不得新增第四種)

| 條件 | verdict |
|---|---|
| 該 session 有效 n < `min_samples` | **`blocked-by-data`**,`reason = insufficient_n` |
| n 足夠但 ①②③ 任一未過 | **`research_only`**,`reason = failed:<逐條>` |
| n 足夠且 ①②③ 全過 | **`research_only`**,`reason = all_criteria_passed`(= 「訊號非偶然且估計穩定」註記) |

`reason` 為封閉詞彙表 `KNOWN_GATE_REASONS`(9 個字串);所有數值都已是 `GateVerdict` 的具名欄位,
故 reason 本身保持可枚舉而非格式化字串。

### ⚠️ 上限條款(逐字進報告,且由程式碼保證)

> **`gate-v1` 比 split-half r 弱。** 它證明「**訊號非偶然 + 估計量穩定**」,**不證明個體差異可靠度**。
> 因此在 C-D3 下,xcorr 於本樣本結構(1 受試者 × 3 session × 20 peeks)**最高只能到 `research_only`**,
> **`coach_report` 不可達**。

這條由**程式碼**保證,不是文件自律:`GateVerdict` 全模組只有一個建構點(`_gate_verdict`),而所有
`verdict=` 引數都是 `{'research_only', 'blocked-by-data'}` 的字面值 —— 由
[`test_coupling.py`](../../research/src/modules/metrics/algorithms/tests/test_coupling.py) 以 AST 掃描
斷言(而非抽樣輸入)。`'coach_report'` 只存活在型別註記裡,留給日後有足夠受試者的 `gate-v2`。

### 當次判定(2026-08-10,`gate-v1`,逐 session,不併池)

| Session | n | 觀測(中位 \|r\|) | ① `shuffle_p` | ② CI(寬) | ③ \|Δ\| | verdict | reason |
|---|---:|---:|---:|---|---:|---|---|
| 09:18 | 20 | 0.9041 | **0.056** ✗ | [0.8870, 0.9188](0.0319)✓ | 0.0119 ✓ | `research_only` | `failed:shuffle_p` |
| 09:24 | 20 | 0.9179 | **0.000** ✓ | [0.8749, 0.9265](0.0516)✓ | 0.0364 ✓ | `research_only` | `all_criteria_passed` |
| 09:37 | 20 | 0.8953 | **0.173** ✗ | [0.8707, 0.9206](0.0499)✓ | 0.0300 ✓ | `research_only` | `failed:shuffle_p` |

> `shuffle_p = 0.000` 表示「低於 1000 次 null 的解析度(< 1/1000)」,不是「恰為零」。

**這張表最重要的一行不是 0.90,是 0.056 與 0.173。** 中位 `|peak r| ≈ 0.90` 看起來像很強的耦合,但
**循環位移後的 null 在 5.6% / 17.3% 的抽樣中也達到同一水準** —— 因為 session 統計量是「逐 peek 對 65
個 lag 取最大 `|r|`」,本身是**最大化統計量**:在 ±250 ms 的帶寬內,一段緩慢的方波 key-state 就算被
整體位移,通常仍能在某個 lag 上與 ω 對得很好。**若沒有 ① 這條反向對照,0.90 會被當成強耦合寫進報告。**
這正是 pre-registration 的 null 存在的理由(見 OQ-S4-20)。

演算法本身的正確性與效度判定分離,由合成訊號驗證(`test_coupling.py`):已知 lag → 回推誤差 ≤1 tick
且符號方向正確;**純雜訊 → `shuffle_p` 不顯著**(一個會對雜訊判「非偶然」的 gate 沒有價值);同一組
合成強耦合 → `shuffle_p` 顯著(證明上一條是資料的性質,不是一個永遠不會觸發的 gate)。

### 已知限制(`xcorr-v1` / `gate-v1`)

- **上限條款**:見上。本樣本結構下最高 `research_only`,`coach_report` 不可達。
- **三件組全部只看 `|r|` 的大小,不看方向**:實測 median signed strength 為 **−0.13 / +0.82 / +0.84**,
  median peak lag 為 **−183.6 / −136.7 / +179.7 ms** —— 方向跨 session **不穩定**。因此即使某 session
  ①②③ 全過(09:24),也**不得**據以宣稱「key 領先 ω 多少 ms」。T2 交付 lag 分佈,不交付單一方向結論。
- **`max_lag_ms` 與窗長的比例**:±32 tick vs 中位 62–65 tick;correlogram 兩端的 r 建立在約 30 個配對
  樣本上(S-31.1)。讀圖必須同時讀 `n_overlap`。
- **樣本效度**:三份真實 fixture 為**同一匿名受試者 P001、同一台 240 Hz 機器、同一 drill config、同一
  天三個 session**。非母體層級證據(KI-004 R-7)。
- **不跨 session 併池**:gate 逐 session 執行;跨 session 推論 out of scope。
- **只做 ω 通道**:階段 A 的二元 strafe 速度使 `vx` 通道退化;`projected_target` 通道需目標 metadata,
  兩者皆未做(stage4 README §7 技術債②)。
- **合成 fixture 走 `window_too_short`**:24 tick 窗 → 23 個配對樣本 < `min_ticks = 32`,**確定性**觸發。
  注意這與同一份 fixture 在 `phase-v1`(`window_too_short`,門檻不同)與 `sparc-v1`(`too_few_samples`)
  上的退化分支**各自不同**:三個構念量的不是同一件事,觸底原因本來就可以不一樣(S-31.4)。
- **T-exit 收斂結果(2026-08-12)**:xcorr + `gate-v1` 已進 `coach-report-v2` 的**研究向區塊**
  (`#advanced`),逐 session 附完整 `GateVerdict`(shuffle p / CI / 奇偶 Δ)+ 上限條款 + 方向不穩
  限制逐字輸出。三份真實 fixture 的 verdict 皆為 `research_only`,故三者皆不出現在「缺口說明」
  區塊;若日後某 session 的有效 n < `gate-v1.min_samples`,該 session 的報告會改列缺口說明,
  **不會**出現在研究向區塊(由 `reliability_gate` 的 `verdict` 欄位機械判定,非文件自律)。

---

## `fitts-v1`

### 回答什麼

每個 peek 的 spawn 偏心角 `D` 是否能解釋首發時間 `MT`,並以 Shannon 形式
`ID = log2(1 + D/W)` 回歸 `MT = a + b * ID`,輸出 slope / intercept / r2 / throughput。

這不是受控 Fitts 典範。`fitts-v1` 的交付物是「觀察性、非受控設計」下的明確判定:
`ok` 或 `blocked-by-data`,以及能不能作為後續報告的研究向材料。`ok` 只表示本 session 滿足
pre-registered 的資料變異門檻並可計算回歸,不表示可做因果主張。

### 幾何來源

| 量 | 來源 | 機械保證 |
|---|---|---|
| `D` | spawn tick 上的 `epsilon_deg(..., fallback_target=visible target)` | 與 `detect-v1` 的 `eccentricity_at_spawn_deg` 同一路徑;不另寫角度公式 |
| `W` | `meta.targets.hitbox.widthU` 的水平角寬;hitbox 缺席時走 H1 `{1,2,1}` fallback | 直接重用 angular 模組的 `_hitbox`,與 `on_target` / tracking derivation 同源(GD-7) |
| eye origin | `resolve_eye_origin(meta, strict=True)` | legacy fixture 缺 `meta.scene.eye` 時拋錯,不得靜默 fallback |
| `MT` | `t_first_shot - t_visible` | 沿用 `timeline-v1` / `build_peek_windows` 錨點 |

`W` 的角寬公式是 `2 * atan((width / 2) / eye_to_target_distance)`。若 `D` 或 `W` 非有限、或
`W <= 0`,該列標 `degenerate_geometry` 並排除回歸。

### 凍結 `fitts-v1` registry

| `min_samples` | `min_d_ratio` | `min_id_range_bits` | Version |
|---:|---:|---:|---|
| 20 | 2.0 | 1.0 | `fitts-v1` |

> **KI-008/BD-008 更正(2026-08-17)**:實作曾偏離為 `min_samples=10`、`min_id_range_bits=0.5`
> (T0 凍結值的一半),使 09:24 被誤判 `ok` 並把回歸數字端上研究向區塊。已改回本表凍結值,
> 詳見 [BUGFIX-DECISIONS.md BD-008](../known_issue/BUGFIX-DECISIONS.md)。

依序檢查:

1. 有效樣本數 `n >= min_samples`;
2. `d_ratio = max(D) / min(D) >= min_d_ratio`——**若 `min(D) <= 0`(有完全置中的 spawn),
   `d_ratio` 定義為 `+inf` 且視為通過此步**:比值本身無定義,但這是最大可能的展幅而非最小
   (KI-008/BD-008 更正——舊實作把除以零得到的 `inf` 誤判為「未過關」,錯誤丟棄本來有效的
   session;真正該擋「D 完全無變異」的是下一步);
3. `id_range_bits = max(ID) - min(ID) >= min_id_range_bits`;
4. 通過後才做最小平方回歸。若 slope 非正,`throughput` 不成立,判 `blocked-by-data`。

`blocked-by-data` 時 `slope_ms_per_bit` / `intercept_ms` / `r2` / `throughput_bits_s` 全部為 `None`,
不得硬給結論。

### 封閉 flags / reasons

`KNOWN_FITTS_FLAGS`:

| flag | 條件 |
|---|---|
| `no_first_shot` | 該 peek 沒有 first-shot fire,或 MT 非有限/負值 |
| `missing_target_position` | visible event 與 spawn tick 都沒有目標中心 |
| `missing_spawn_tick` | `t_visible` 之後找不到 tick |
| `degenerate_geometry` | D/W 非有限或 W <= 0 |

`KNOWN_FITTS_REASONS`:`ok` / `insufficient_n` / `insufficient_d_ratio` /
`insufficient_id_range` / `non_positive_slope`。未知 flag/reason 由測試與模組斷言擋下。

### 當次判定(2026-08-17 更正,逐 session,不併池推論)

| Session | n | `d_ratio` | `id_range_bits` | slope(ms/bit) | intercept(ms) | r2 | TP(bits/s) | status | reason |
|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| 09:18 | 20 | 1.8343 | 0.6997 | — | — | — | — | `blocked-by-data` | `insufficient_d_ratio` |
| 09:24 | 20 | 2.5531 | 0.9602 | — | — | — | — | `blocked-by-data` | `insufficient_id_range` |
| 09:37 | 20 | 3.3833 | 1.2536 | 39.6014 | 389.0146 | 0.0339 | 25.2516 | `ok` | `ok` |

> **KI-008/BD-008 更正**:09:24 原判為 `ok`(見 git history 2026-08-12 版本),是凍結門檻遭偏離
> (`min_id_range_bits` 誤植為 0.5)所致——`id_range_bits = 0.9602` 在正確的 `min_id_range_bits =
> 1.0` 下不足,應為 `blocked-by-data`。現以 T0 凍結值重算,三份真實 fixture 中僅 09:37 通過
> 全部資料門檻。

T0 的「D pooled 8.70–30.72 = 3.5x」只證明三 session 合在一起有變異;T3 實作採逐 session 判定,
因此 09:18 以 `d_ratio = 1.8343 < 2.0` 走 `blocked-by-data`。這不是事後調整門檻的理由:
若為了讓 09:18 過關而跨 session 併池,會違反 WP-30 / WP-31 的「三 session 並列呈現、不作跨
session 推論」紀律。

09:37 雖然 `status = ok`,r2 只有 0.0339。這代表 `ID` 只解釋很少的 MT 變異;
TP 數字可以作研究向探索,不應在 T-exit 前被當成教練主表指標。

證據檔:
[`fitts-verdicts.json`](../../research/src/modules/metrics/notebooks/t3/outputs/fitts-verdicts.json) ·
[`fitts-regression-summary.csv`](../../research/src/modules/metrics/notebooks/t3/outputs/fitts-regression-summary.csv) ·
`fitts-table-<fixture>.csv` · `fitts-scatter-<fixture>.svg`。

### 已知限制(`fitts-v1`)

- **D 是內生的,不是實驗操弄的**。目標只在兩個固定位置((±2, 1.5, −4))出現;D 的變異幾乎全部來自
  「上一個 peek 結束時玩家把準星留在哪」。這是**相關性觀察**,不是 Fitts 典範的受控設計;D 與前一
  peek 的行為(過衝/修正)共變。
- **MT 含反應時間與 counter-strafe 停止時間**。`MT = t_firstShot − t_visible`,回歸截距 `a` 會吸收
  RT + 急停;`t_detect` 只在 5–9/20 的 peek 上有值,不足以做逐 peek 的 RT 扣除,故本版不做 RT 校正。
- **樣本效度**:三份真實 fixture 為同一匿名受試者 P001、同一台 240 Hz 機器、同一 drill config、
  同一天三個 session。非母體層級證據(KI-004 R-7)。
- **不跨 session 併池推論**:pooled D ratio 可說明資料母體有變異,但 `fitts-v1` verdict 逐 session
  給出。09:18 因逐 session D ratio 不足而 blocked。
- **T-exit 收斂結果(2026-08-17 更正)**:`fitts-v1` 已進 `coach-report-v2` 的**研究向區塊**
  (`#advanced`)——但只限 `status='ok'` 的 session:**僅 09:37** 附回歸(slope/intercept/r²/TP)
  + D 內生性與 MT 含 RT 兩項限制逐字輸出。09:18(`blocked-by-data`,`insufficient_d_ratio`)與
  **09:24**(`blocked-by-data`,`insufficient_id_range`,KI-008/BD-008 更正後)**皆不**出現在
  研究向區塊,改於「缺口說明」區塊各列一行:09:18 原因為 spawn 偏心角變異低於 `min_d_ratio=2.0`
  (需要更大範圍的 spawn 位置變異,受目前 drill 設計限制,OQ-S4-19);09:24 原因為 ID 跨度低於
  `min_id_range_bits=1.0`,理由相同。

---

## T-exit — 三份判定收斂 + 報告載體契約 + WP-32 交接

> 2026-08-12,Fitts 列於 2026-08-17 依 KI-008/BD-008 更正。收斂來源:T1(`sparc-v1`)·
> T2(`xcorr-v1`/`gate-v1`)· T3(`fitts-v1`)三份既定判定(逐條 commit 見
> [progress.md](../exec-plan/completed/stage4/wp-31-advanced-diagnostics/progress.md)
> D-31.6 / D-31.9 / D-31.10)。**本節不重算任何判定**,只把三份既有結果收斂成一張表 + 落地成
> `coach-report-v2` 的報告契約。

### 三份判定收斂表

| 指標 | 判定來源(commit) | 判定值 | 進報告與否 | 理由 |
|---|---|---|---|---|
| SPARC | T1,`944abc3`→`sparc_length_sensitivity`(D-31.6) | `stratified_only`(step_ratio 0.7643 ≥ 0.5) | ✅ **研究向區塊**(`#advanced`),逐 session | 無 `blocked-by-data` 分支;跨 `padded_n` bucket 的限制可在報告介面逐字呈現,不放大成主表判定 |
| Key-Velocity xcorr | T2,`reliability_gate`(D-31.9,gate-v1 三件組) | 三 session 全 `research_only`(09:18/09:37 未過①,09:24 全過) | ✅ **研究向區塊**,逐 session;`coach_report` 由程式碼保證不可達 | C-D3 上限條款:三件組只證明「非偶然 + 穩定」,不證明個體可靠度;研究向是本樣本結構下的天花板,不是降級 |
| Fitts | T3,`fitts_samples`(D-31.10,fitts-v1) | 09:18 `blocked-by-data`(`insufficient_d_ratio`);**09:24 `blocked-by-data`(`insufficient_id_range`,KI-008/BD-008 更正)**;09:37 `ok`(r² 0.0339) | 09:18/09:24 ❌ **缺口說明**;09:37 ✅ **研究向區塊** | `ok` 只表示資料門檻可計算回歸,不表示效度足以對選手做主張(r² 低);09:18/09:24 未達資料門檻,不硬給結論 |

**收斂結論**:三個指標**沒有一個**在本樣本結構下能進主表(C-D3 上限一致);SPARC 與 xcorr 三個 session
皆有輸出,Fitts **僅 1/3 session(09:37)**有輸出、2/3(09:18/09:24)為缺口說明。這是**合格的交付**
——T-exit 的成功條件從不是「三個都要進主表」,而是每一個判定都有證據且可稽核(見
[T-exit-gate.md](../exec-plan/completed/stage4/wp-31-advanced-diagnostics/T-exit-gate.md) Objective)。

### 報告載體契約(`coach-report-v2`)

`research/src/report/coach_report.py` 的 `REPORT_VERSION` 自 `coach-report-v1` 升為 `coach-report-v2`。
新增兩個區塊,兩者互斥(同一構念同一 session 只會出現在其中一個):

| 區塊 | HTML `id` | 內容 | 納入規則 |
|---|---|---|---|
| ⑨ 研究向區塊 | `#advanced` | SPARC(恆呈現)、xcorr(`verdict != 'blocked-by-data'` 時呈現)、Fitts(`status == 'ok'` 時呈現) | 每個子區塊帶 `n` / flags 計數 / `version` / 效度層級句 / 限制句(逐項由 `test_coach_report.py::test_passing_p2_diagnostics_render_in_the_research_block_with_full_annotations` 釘死) |
| ⑩ 缺口說明 | `#advanced-gaps` | xcorr 或 Fitts 為 `blocked-by-data` 時的一行說明:指標名 + version + 「為何沒有 / 需要什麼樣本」 | 不含任何數值指標(無 n/slope/r² 等),只有人類可讀的缺口原因(由 `test_blocked_by_data_p2_diagnostic_produces_a_gap_note_not_a_metric_block` 釘死) |

**上游前提複用,不重算**:SPARC/xcorr 復用 `_trajectory_data` 已算好的 `omega_deg_s(strict=True)` /
`resolve_eye_origin(strict=True)` 逐 peek 中間值(`peekTicks` / `omegaValues` / `segmentsByPeek` /
`eyeOrigin`);trajectory 不可用(pre-WP-30 legacy 匯出)時,三個構念**連同**研究向區塊一起回報
`available=False`,不產生任何數值(與 phase/curves 同一機制)。

**gate-v1 的決定性延伸到報告層**:`reliability_gate` 的 seed(`20260810`)與逐 session 獨立 seed
(`blake2b(session)`)是報告產生的一部分,故同一 fixture 連續兩次 `generate()` 仍 byte-identical
(`test_repeated_generation_is_byte_identical` 覆蓋 09:18/09:24/09:37/synthetic 四份,即涵蓋
SPARC/xcorr/Fitts 三個構念的計算路徑)。

**9 份既有 committed 範例已重跑(2026-08-12)**:差異限於 `REPORT_VERSION` 字串、標題「v1→v2」、
新增的 ⑨⑩ 兩個區塊、以及 ⑪ 效度紅線清單裡一句話的更新;既有 ①~⑧ 區塊(compute-v1/sync-v1/
phase-v1/curve-v1/detect-v1 家族)逐位不變,由 `test_frozen_version_strings_and_sync_params_are_reported`
與 `test_grouping_never_changes_parameter_metadata` 覆蓋。

### Sample limits 總覽(三構念共用,不重複聲明)

三份真實 fixture 皆為**單一匿名受試者 P001、同一台 240 Hz 機器、同一 drill config、同一天三個
session**;任何 SPARC / xcorr / Fitts 結論皆受此限制,非母體層級證據(KI-004 R-7)。三者皆**不跨
session 併池**——報告逐 session 呈現,pooled 數字(SPARC 的階梯診斷、Fitts 的 D ratio 預期)只用於
方法學診斷,不作訓練效果或個人基線主張。

### WP-32 交接結論

依 C-D3,**研究向指標不得晉升 dashboard**——三個構念在本 WP 的最高判定皆為「研究向」或
「blocked-by-data」,沒有一個達到可晉升的門檻(`gate-v1` 甚至由程式碼保證 xcorr 不可能達到)。

**WP-32 T0 晉升清單評估的交接結果:空清單。** 三個構念**皆不建議**列入 WP-32 的晉升評估:

| 指標 | 為何不建議晉升 | 升級路徑(若要重新評估) |
|---|---|---|
| SPARC | 跨段長比較 `stratified_only`,教練介面難以在不使讀者混淆的前提下呈現「僅限同 bucket」的限制 | 若要跨 bucket 可比,需在同一 `padded_n` bucket 內操弄段長的新設計(新 WP) |
| xcorr | `gate-v1` 的上限條款由程式碼保證 `coach_report` 不可達;OQ-S4-20(最大化統計量的多重比較效應)未解 | 取得 ≥3 受試者樣本 → `gate-v2` 恢復 split-half r;或先解 OQ-S4-20 換一個不受多重比較污染的統計量(`xcorr-v2`) |
| Fitts | D 內生 + r² 低(0.03–0.07),回歸解釋力不足以對選手做處方建議;09:18 甚至資料門檻不足 | 受控設計(drill 端隨機化 spawn 偏心)+ 更多樣本,屬新 WP/新錄製,見 OQ-S4-19 |

此結論明確,**不留白讓 WP-32 自行猜測**:WP-32 T0 若要重新評估上表任一項,必須先在該項的升級路徑
完成後才能重新提案,而不是直接把「研究向」數字搬進 dashboard。
