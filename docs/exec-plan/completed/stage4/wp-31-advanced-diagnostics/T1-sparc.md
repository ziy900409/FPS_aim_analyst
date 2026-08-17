# T1 — SPARC:逐位移植 + 跨 repo golden 對表 + N=32/64 階梯診斷

> Part of [WP-31 advanced-diagnostics](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(`sparc-v1` 凍結 + 段來源契約) |
| **Risk / Cplx** | Med / Med |
| **對應 FR** | FR-D13 |
| **Touches** | `research/src/modules/metrics/algorithms/sparc.py`(ADD)· `.../algorithms/tests/test_sparc*.py`(ADD)· `research/fixtures/golden/sparc-pa-parity.json`(ADD)· `research/fixtures/golden/sparc-128hz-domain.json`(ADD)· `research/src/modules/metrics/notebooks/t1/`(ADD)· `docs/operational/analysis-advanced-diagnostics.md`(ADD 首版) |
| **狀態** | ✅ **完成(2026-08-10)** — 兩份 golden 對表 ≤1e-9(PA parity 8 個量 + 128Hz 域 8 case)、逐 MR 段表 59/60 與 `phase-v1` 一致、階梯診斷 verdict **`stratified_only`**(step_ratio 0.7643 ≥ 0.5,**關閉 OQ-S4-18**)、`analysis-advanced-diagnostics.md` 首版。`uv run pytest` 365 passed;`src/`/`tests/` 零 diff |

## Objective

把 performance_analysis 的 `compute_sparc` **逐位**搬進本 repo,用跨 repo golden 釘死「同輸入同輸出」,然後回答一個本專案獨有的問題:**在 128Hz、段長 24–58 tick 的條件下,SPARC 值能不能跨段長比較?**

第二個問題比第一個重要。移植是機械工作;階梯診斷才是決定 SPARC 能不能進報告的證據。

## In scope

### ① 逐位移植(零在地改良)

對照 performance_analysis 的 `research/src/modules/analysis/algorithms/metrics_sparc.py`(**外部 repo**,本 repo 內無此路徑;T1 須在 progress 記下當次參照的 commit hash)實作 `compute_sparc(velocity_series, fs)`,逐項保留:

| 語意 | 值 / 行為 | 不可改的理由 |
|---|---|---|
| `MIN_SAMPLES` | 16;不足 → 回傳 **`0.0`**(不是 NaN) | golden 對表面 |
| 正規化分母 | `max(v)`,**不是** `max(abs(v))` | PA 沿 Go `computeSPARC`;ω ≥ 0 故等價,但仍逐位保留 |
| 零填充 | `n = 1 << (len−1).bit_length()` | 階梯的來源;**不得**改成固定 N(§0.3) |
| 頻帶 | `FC_HZ = 20.0` | — |
| 振幅門檻 | `AMP_THRESH = 0.03`(k>0 才套用) | — |
| 回退 | 通過門檻的 bin < 2 → 取前 `FALLBACK_MIN_BINS = 8` 個 ≤20Hz 的 bin(不套振幅門檻) | 128Hz 下**會**經常走到這條路徑,必須逐位一致 |
| 退化 | `fs <= 0` / `max_v <= 1e-9` / `max_mag <= 1e-12` / 最終 bin < 2 → `0.0`;`max_v` 或 `max_mag` 為 NaN → `nan` | 退化語意與 PA 一致(FR-D13 DoD) |
| `f_span` | `<= 1e-9` 時代入 `1.0` | — |
| 回傳 | `-arc` | — |

同時提供 `compute_sparc_traced()` 回傳 `SparcTrace`(`max_v`/`n_fft`/`max_mag`/`freqs_pass1_count`/`freqs_final_count`/`f_span`/`arc`/`sparc`),供 golden 對中間值。

**不移植** `compute_segment_sparc` / `build_uniform_speed_series` —— 那是 PA 為非等間隔 1kHz 資料重採樣用的;本專案 128Hz 均勻 tick 不需要([../README.md §2.4e](../README.md))。

### ② 跨 repo golden(兩組,各有不同任務)

| golden | 內容 | 證明什麼 |
|---|---|---|
| `fixtures/golden/sparc-pa-parity.json` | **直接移入** PA 的 `research/src/modules/analysis/algorithms/tests/golden/sparc_parity.json`(外部 repo;1 case:`velocity_series` len=64、`fs=1000`、7 個 `expected_*` 中間值 + `expected_sparc`) | **演算法身分**:本 repo 的實作與 PA/Go 同源 |
| `fixtures/golden/sparc-128hz-domain.json` | 本專案 fs 域案例:自三份真實 fixture 取若干 MR 段 ω 序列(含 N=32 與 N=64 兩 bucket 各至少 2 例)+ 合成邊界案例(len=15 退化、len=16 剛好、常數序列、含 NaN),期望值由 **PA 的實作跑一次**產生 | **本域固定**:未來本 repo 重構不得改變 128Hz 上的輸出 |

**產生紀律(C-D1)**:`sparc-128hz-domain.json` 的期望值由一支**一次性腳本**產生,腳本置於 `notebooks/t1/`,執行時才需要 performance_analysis 在本機;產生後 golden 進 repo,**執行期與 CI 不得 import 或路徑依賴 performance_analysis**。腳本 header 記錄 PA repo 路徑 + commit hash + 產生日期,並抄一份進 `analysis-advanced-diagnostics.md`。

### ③ 逐 MR 段 SPARC 表

- 段來源 = **T0 凍結的契約**:逐 peek 窗內 `seg-v2` 的第一個 `primary_flick`(= `phase-v1` 的 MR 區間)。實作上重用 [generate_phase_report.py](../../../../../research/src/modules/metrics/notebooks/t2/generate_phase_report.py) 的分段慣例(逐 peek 切窗 → `omega_deg_s(window, strict=True)` → `segment_submovements(omega[1:], SEG_V2_PARAMS)` → index +1 映回),**不得**自行改 scoping。
- 輸出 `SparcSample` 逐列:`peek_index / side / start_idx / end_idx / n_ticks / padded_n / bins_le_fc / sparc / flags`。
- flags 封閉詞彙表(自我斷言,比照 `KNOWN_PEEK_FLAGS`):`no_primary_flick`、`too_few_samples`、`degenerate_spectrum`、`window_too_short`。
- 聚合納入沿用 D-29.5(數值有限**且**整列 flags 為空才進 `n`)。

### ④ 階梯診斷(`sparc_length_sensitivity`)

- 逐 `padded_n` bucket(32 / 64)輸出 `n` / 中位 / IQR;計跨 bucket 的中位差 ÷ max(bucket 內 IQR)= **step ratio**。
- 對照 `sparc-v1` 的 `step_ratio_threshold`(T0 凍結)給 verdict:`comparable` | `stratified_only`。
- notebook 產出散點圖:x = `n_ticks`、y = `sparc`、顏色 = `padded_n`,並標出 L=32/33 邊界。
- **不因診斷結果回頭改參數**(§2 契約);診斷只決定**使用限制**。

### ⑤ 文件

`docs/operational/analysis-advanced-diagnostics.md` 首版:`sparc-v1` 定義、常數表、段來源契約、封閉 flags、golden 出處與產生方式、階梯診斷的判準與當次 verdict、已知限制(含單樣本效度限制)。

## Out of scope

- 動 `_FC_HZ` / `_AMP_THRESH` / padding 規則 / `MIN_SAMPLES`(§2 契約)。
- 固定 N 的第二版本(使用者已於 2026-08-10 拍板不做;要做須另立新構念並入 [DECISIONS.md](../../../DECISIONS.md))。
- LDJ-V 或任何第二平滑度指標([../README.md §2.1](../README.md) 觸發條件未達)。
- 逐 `micro_adjustment` 段的 SPARC(FR-D13 明寫逐 `primary_flick`;要擴充屬新 scope)。
- 任何 `src/` 變更;任何 TS 對表 fixture。

## Steps

- [ ] 建 `sparc.py`:常數以 `Final` 宣告 + `compute_sparc` + `compute_sparc_traced` + dataclasses。
- [ ] 移入 `sparc-pa-parity.json`,寫對表測試(**8 個量全比**:7 個中間值 + 最終值,相對誤差 ≤1e-9)。
- [ ] 寫退化語意測試:len=15 → `0.0`;len=16 → 有限值;常數序列 → `0.0`;含 NaN → `nan`;`fs<=0` → `0.0`。
- [ ] 寫 `sparc_table`,以 `phase-v1` 段來源產出三份真實 fixture 的逐段表;斷言列數與 `phase-v1` 非退化 MR 數一致。
- [ ] 一次性腳本產 `sparc-128hz-domain.json`(記 PA commit hash),寫對表測試。
- [ ] 寫 `sparc_length_sensitivity` + 單元測試(人工構造兩 bucket 的已知分佈 → 已知 step ratio)。
- [ ] notebook 產分佈報告 + 段長散點圖(`notebooks/t1/outputs/`)。
- [ ] `algorithms/` 純度測試(無 file I/O、無 matplotlib、無跨 repo import)。
- [ ] 寫 `analysis-advanced-diagnostics.md` 首版;更新 [progress.md](progress.md) 與 [task-checklist.md](task-checklist.md)。

## Definition of Done

1. **golden 對表綠**:`sparc-pa-parity.json` 的 7 個中間值 + `expected_sparc` 全部相對誤差 ≤ 1e-9(單一 case,8 個斷言);測試失敗訊息會指出是哪一個中間值先分岔。
2. **退化語意測試綠**,且逐項與 PA 一致:`n<16 → 0.0`(非 NaN)、常數序列 → `0.0`、NaN 輸入 → `nan`、`fs<=0` → `0.0`。
3. **`sparc-128hz-domain.json` 對表綠**,且該 golden 含 N=32 與 N=64 兩 bucket 各 ≥ 2 個真實 MR 段案例 + 4 個合成邊界案例;檔內記錄 PA repo commit hash 與產生日期。
4. **段來源一致性斷言綠**:`sparc_table` 的有效列數 = `phase-v1` 在同一份 fixture 上的非退化 MR 數(規劃期實測 59/60,1 個 `no_primary_flick`);不一致即 fail。
5. **階梯診斷已產出且有明確 verdict**:三份真實 fixture pooled 的逐 bucket `n`/中位/IQR + step ratio 數值 + 對照 `sparc-v1` 門檻的 `comparable` | `stratified_only` 判定,寫入 progress 與 `analysis-advanced-diagnostics.md`;若為 `stratified_only`,同時寫明「SPARC 僅限同 padded_n bucket 內比較」的使用限制。
6. **跨 repo 隔離證據**:`sparc.py` 與所有測試的 import 清單零外部 repo 路徑;純度測試綠;在 performance_analysis **不存在**的環境下 `uv run pytest` 仍全綠(以刪除/改名該路徑或以 import 掃描斷言擇一證明,方法記 progress)。
7. `uv run pytest` 全綠(貼輸出計數)+ `npm run test:ci` exit 0 且 **`src/` 與 `tests/` 零 diff**(貼 `git diff --stat`)。
8. `analysis-advanced-diagnostics.md` 含 `sparc-v1` 完整 registry(定義 / 常數 / 段來源 / flags / golden 出處 / 限制)。

## Commit

`feat(wp-31): T1 SPARC 逐位移植 + performance_analysis golden 對表(≤1e-9,含中間值)+ 128Hz N=32/64 階梯診斷`
