# 進階診斷層:SPARC(`sparc-v1`)

本檔是 WP-31 進階診斷層的 operational registry。首版(T1)只涵蓋 **`sparc-v1`**(逐段平滑度,
FR-D13);`xcorr-v1` / `gate-v1`(T2)與 `fitts-v1`(T3)由後續 task 追加,T-exit 定稿。

三個構念的交付物都是**判定**,不是數字(C-D3 / GD-20):「算得出來」不等於「可以對選手講」。
每個構念的章節末尾都必須有一段明確的使用限制。

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
- **尚未進教練報告**:C-D3 下,SPARC 是否晉升為報告指標由 T-exit 收斂判定;本檔只交付效度證據與
  使用限制。跨段長比較的限制若無法在報告介面上明示,SPARC 就不應進主表。
