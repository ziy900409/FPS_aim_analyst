# Per-segment SPARC + Tracking Classifier 指標說明與 Notebook 使用方法

> Status: implemented locally (2026-05-21)
> Algorithm: `research/src/modules/analysis/algorithms/metrics_sparc.py`
> Classifier: `research/src/modules/analysis/algorithms/tracking_classifier.py`
> Notebook: `research/src/modules/analysis/notebooks/q2_per_segment_sparc/q2_per_segment_sparc.py`
> Sample data: `test/test_data/Spidershot - Challenge - 2026.03.09-13.42.45 Stats.csv.json`

---

## 1. 指標目的

Per-segment SPARC 用來量化每一段 mouse movement 的速度頻譜是否平滑。

它回答的問題是：

> 這段移動的速度曲線是平順、低頻主導的，還是包含較多高頻抖動、急停急啟或修正雜訊？

SPARC 的全名是 Spectral Arc Length。它把速度序列轉到頻域，計算正規化頻譜曲線的弧長，最後取負值。頻譜越集中在低頻、曲線越短，SPARC 越接近 `0`；頻譜越分散、曲線越長，SPARC 越小。

本指標屬於 T1 mouse-only smoothness 指標。它只依賴 schema v1 ScenarioRecord 的 `rawMouseTrace`、`fusedTrace.speed_px_s` 與 `fusedTrace.segments`，不修改 Go backend，不改 IPC schema。

---

## 2. Tracking Classifier 目的

Issue #5 同時新增 Python-only `tracking` segment kind。這不是 Go backend segment enum 的新值，也不會寫回 session JSON；它只在 research notebook 執行時，由 Python classifier 即時計算並 in-memory merge 到 record 中，再交給 `per_segment_apply(...)` 使用。

它回答的問題是：

> 在 primary flick 之外，是否存在一段持續瞄準目標、低速、且滑鼠移動方向多半朝向 target error 的 tracking / correction phase？

目前 classifier 只作為 HITL calibration baseline。Spidershot 是 flick-heavy scenario，預設 threshold 下 `n_tracking=0` 是可接受結果，不代表 classifier 失效。

---

## 3. 計算定義

Implementation entry points:

```text
research/src/modules/analysis/algorithms/metrics_sparc.py
compute_sparc(velocity_series, fs) -> float
compute_segment_sparc(segment_df) -> float

research/src/modules/analysis/algorithms/tracking_classifier.py
TrackingClassifierConfig
classify_tracking_segments(scenario_record, config=None) -> list[dict]
merge_tracking_segments_into_record(scenario_record, tracking_segments) -> dict
```

Per-segment SPARC 流程：

1. 透過 `per_segment_apply(...)` 選出指定 kind 的 segment。
2. 對每段 segment 建立 segment-local DataFrame。
3. 使用 `build_uniform_speed_series(...)` 將 `ts_us` / `speed_px_s` 重採樣成 uniform speed series。
4. 將 `dt` 轉成 `fs = 1 / dt`。
5. 呼叫 `compute_sparc(speed, fs)`。

核心 SPARC 流程：

```text
maxV = max(speed)
sig = zero_pad(speed / maxV, nextPow2(N))
FFT(sig)
magnitude = abs(FFT[k]) / n
normalise magnitude by max magnitude
keep frequency bins <= 20Hz
skip non-DC bins with amplitude < 0.03
if too few bins, retry without amplitude threshold up to 8 bins
arc = sum(sqrt(delta_freq_normalised^2 + delta_spectrum^2))
SPARC = -arc
```

Go parity 約束：

- 使用 full complex FFT path (`numpy.fft.fft`) 對齊 Go `fftInPlace`。
- 使用 `max(v)`，不是 `max(abs(v))`。
- 頻率 cutoff 固定為 `20Hz`。
- amplitude threshold 固定為 `0.03`。
- 對退化輸入回傳 `0.0`，符合 Go sentinel。
- `SPARC == 0.0` 代表 Go-degenerate sentinel，不應解讀為「最平滑」。

---

## 4. Tracking 判定條件

`classify_tracking_segments(...)` 會從 primary flick 之間的 interval 建立 candidate，若沒有 primary flick，則整段 trace 作為單一 candidate。

預設 config：

| 欄位 | 預設 | 意義 |
|---|---:|---|
| `min_duration_ms` | `100.0` | candidate 至少要持續 100ms |
| `min_has_target_ratio` | `0.8` | interval 內至少 80% samples 有 target |
| `max_mean_speed_px_s` | `3000.0` | mean speed 必須低於 flick-like 高速移動 |
| `min_correcting_sample_ratio` | `0.6` | 有效 samples 中至少 60% 朝 target error 修正 |
| `min_valid_samples_for_correction` | `8` | correction ratio 至少需要 8 個有效 movement samples |
| `mouse_step_eps` | `1e-6` | 靜止或 target error 近零時跳過該 sample |

四個條件必須同時成立：

1. **Duration**：interval duration >= `min_duration_ms`
2. **Has target**：`has_target` coverage >= `min_has_target_ratio`
3. **Low speed**：mean `speed_sg_px_s` 或 fallback `speed_px_s` <= `max_mean_speed_px_s`
4. **Sustained correction**：滑鼠位移向量與 `(target - mouse)` 夾角小於 90 度的比例 >= `min_correcting_sample_ratio`

輸出的 tracking segment dict 與 `fusedTrace.segments` schema 對齊：

```text
kind = "tracking"
start_idx / end_idx
start_ts_us / end_ts_us
duration_ms
peak_idx / peak_speed
```

---

## 5. 解讀方式

SPARC 最重要的原則：

> SPARC 越接近 `0`，通常代表速度頻譜越平滑；SPARC 越小，通常代表速度曲線包含更多高頻變化或不穩定修正。

本專案的 SPARC 通常是負值。這是正常的，因為公式回傳 `-arc`。

| 結果 | 解讀 | Precision Aimer 意義 |
|---|---|---|
| 較接近 `0`，例如 `-1.0` | 頻譜弧長較短 | movement speed profile 較平滑 |
| 較小，例如 `-1.8` | 頻譜弧長較長 | 可能有較多高頻修正、抖動或加減速不連續 |
| `0.0` | Go-degenerate sentinel | 樣本不足、有效頻率 bin 不足或其他退化情境；不應當作 smoothness 分數 |
| `NaN` | schema 缺欄位或輸入不可計算 | 先檢查 `ts_us`、`speed_px_s` 與 segment slicing |

Notebook summary 預設排除 `NaN` 與 `SPARC == 0.0` 後再計算 mean、median、std、min、max。

---

## 6. Primary Flick 與 Tracking 分開看的原因

`primary_flick` 和 `tracking` 是不同 movement phase：

| Segment kind | 典型行為 | SPARC 解讀重點 |
|---|---|---|
| `primary_flick` | 快速 acquisition / 大幅位移 | 看主 flick 出手速度曲線是否平順 |
| `tracking` | 低速 target-following / correction | 看持續修正是否穩定、有無抖動 |

兩者不應混在同一個平均值中。Primary flick 的高速 ballistic phase 和 tracking 的低速 correction phase，速度尺度與控制策略不同；混合平均會掩蓋問題來源。

建議閱讀順序：

1. 先看 `primary_flick` SPARC 分布，找出主 flick smoothness baseline。
2. 再看 `tracking` 是否存在，以及 tracking SPARC 是否比 primary flick 更集中或更不穩。
3. 若 `n_tracking=0`，先看 diagnostic counters 判斷是 duration、target coverage、speed 還是 correction gate 刷掉 candidate。

---

## 7. 範例結果

以 Spidershot sample 實測：

```text
primary_flick:
n_total = 93
n_valid = 84
n_degenerate_zero = 9
n_nan = 0
mean = -1.397640
median = -1.408578
std = 0.153347
min = -1.896845
max = -1.036063

tracking:
n_total = 0
n_valid = 0
n_tracking = 0
```

Classifier diagnostic counters：

```text
candidates = 94
passed = 0
failed_duration = 1
failed_target_ratio = 93
failed_speed = 0
failed_valid_samples = 0
failed_correction = 0
```

這代表目前 sample 中 primary flick 可分析，但 tracking classifier 幾乎全部因 target coverage 不足而被排除。這符合 Spidershot flick-heavy fixture 的預期；下一輪 HITL calibration 應使用真正 tracking scenario fixture，例如 Close Long Strafes 類型資料。

---

## 8. 圖表讀法

Notebook 輸出 `distribution.png`，包含兩個 panel：

1. Per-segment SPARC histogram
   - 藍色：`primary_flick`
   - 紅色：`tracking`
   - 虛線：各 kind 的 mean
   - tracking 為 0 段時，只會看到 primary flick 分布
2. SPARC vs duration scatter
   - X 軸：segment duration in ms
   - Y 軸：SPARC
   - 可觀察較長 segment 是否更不平滑，或是否存在低 SPARC outlier

讀圖方式：

1. 先看 histogram 是否集中。分布越窄，代表該 kind 的 smoothness 較一致。
2. 找出最小 SPARC outlier，這些段落可能值得回看 raw speed profile 或 trajectory。
3. 看 scatter 是否有 duration trend。若較長 primary flick 明顯 SPARC 較小，可能代表長距離 flick 速度控制較不穩。
4. 若 tracking 為 0 段，不要把圖表解讀為「沒有 tracking 能力」；先看 diagnostic counters 與 scenario 類型。

---

## 9. Notebook 使用方法

建議從 repo root 執行，並指定 research project，讓 `uv` 使用 `research/pyproject.toml` 的依賴：

```powershell
uv run --project research python -m research.src.modules.analysis.notebooks.q2_per_segment_sparc.q2_per_segment_sparc `
  --file "test\test_data\Spidershot - Challenge - 2026.03.09-13.42.45 Stats.csv.json"
```

可指定輸出 root：

```powershell
uv run --project research python -m research.src.modules.analysis.notebooks.q2_per_segment_sparc.q2_per_segment_sparc `
  --file "test\test_data\Spidershot - Challenge - 2026.03.09-13.42.45 Stats.csv.json" `
  --out "tmp\q2_per_segment_sparc"
```

可指定 threshold config JSON：

```powershell
uv run --project research python -m research.src.modules.analysis.notebooks.q2_per_segment_sparc.q2_per_segment_sparc `
  --file "test\test_data\Spidershot - Challenge - 2026.03.09-13.42.45 Stats.csv.json" `
  --threshold-config "tmp\tracking_thresholds_override.json"
```

Threshold config JSON 範例：

```json
{
  "min_duration_ms": 100.0,
  "min_has_target_ratio": 0.8,
  "max_mean_speed_px_s": 3000.0,
  "min_correcting_sample_ratio": 0.6,
  "min_valid_samples_for_correction": 8,
  "mouse_step_eps": 0.000001
}
```

預設輸出位置：

```text
research/src/modules/analysis/notebooks/q2_per_segment_sparc/outputs/<session_stem>/
```

輸出檔案：

| 檔案 | 內容 |
|---|---|
| `report.txt` | primary_flick/tracking 統計、per-segment table、threshold rationale、diagnostic counters、Precision Aimer 解讀文字 |
| `distribution.png` | SPARC histogram 與 SPARC vs duration scatter |
| `tracking_thresholds.json` | classifier config、`n_flick`、`n_tracking`、sub-counter、threshold sensitivity |

---

## 10. 測試方式

SPARC targeted tests：

```powershell
uv run --project research pytest -q research/src/modules/analysis/algorithms/tests/test_metrics_sparc.py
```

Tracking classifier targeted tests：

```powershell
uv run --project research pytest -q research/src/modules/analysis/algorithms/tests/test_tracking_classifier.py
```

Analysis algorithms targeted suite：

```powershell
uv run --project research pytest -q research/src/modules/analysis/algorithms/tests/
```

Notebook smoke test：

```powershell
uv run --project research python -m research.src.modules.analysis.notebooks.q2_per_segment_sparc.q2_per_segment_sparc `
  --file "test\test_data\Spidershot - Challenge - 2026.03.09-13.42.45 Stats.csv.json"
```

目前驗證結果：

```text
test_metrics_sparc.py: 7 passed
test_tracking_classifier.py: 10 passed
analysis algorithms targeted suite: 73 passed
notebook smoke test: exit 0
```

測試可能顯示 pytest cache permission warning；若 test 本身通過，這個 warning 不影響指標正確性。

---

## 11. 限制與注意事項

- 只支援 schema v1 ScenarioRecord。缺 `fusedTrace`、`rawMouseTrace`、`target_x` 或 `has_target` 時，notebook 會輸出錯誤 report 並回傳 exit code 1。
- `tracking` 是 Python-only in-memory segment kind，不寫回磁碟，不修改 Go enum，不進 IPC。
- Spidershot 預設 threshold 下 `n_tracking=0` 是 HITL baseline，不是錯誤。
- `SPARC == 0.0` 是 Go-degenerate sentinel，不是「完美平滑」。
- `compute_segment_sparc` 缺 `speed_px_s` 或 `ts_us` 時回傳 `NaN`。
- `compute_sparc` 使用 `max(v)` 而非 `max(abs(v))`，這是 Go parity requirement。
- Constant velocity 且樣本足夠時不一定回傳 `0.0`；Go fallback bins path 可能產生負值，這是 parity 行為。
- Golden parity 使用 checked-in JSON，不在 Python test 中 subprocess 呼叫 Go binary。
- `algorithms/` 內不得 import matplotlib、print 或做檔案 I/O；plotting 和 report output 只存在 notebook script。
