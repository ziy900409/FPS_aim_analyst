# Per-segment LDJ-V 指標說明與 Notebook 使用方法

> Status: implemented locally (2026-05-21)
> Algorithm: `research/src/modules/analysis/algorithms/metrics_ldj_v.py`
> Notebook: `research/src/modules/analysis/notebooks/q1_per_segment_ldj/q1_per_segment_ldj.py`
> Sample data: `test/test_data/Spidershot - Challenge - 2026.03.09-13.42.45 Stats.csv.json`

---

## 1. 指標目的

Per-segment LDJ-V 用來量化每一段 primary flick 的速度曲線是否平滑。

它回答的問題是：

> 這段主 flick 的速度變化是連續、平滑的，還是有明顯抖動、急停急啟或不穩定加減速？

這個指標屬於 Q1 Precision Aiming / Flick Quality 的 T1 mouse-only 指標。它只依賴 schema v1 ScenarioRecord 中既有的 `rawMouseTrace`、`fusedTrace.speed_px_s` 與 `fusedTrace.segments`，不需要 keyboard trace、不需要 target metadata，也不修改 Go backend。

LDJ-V 的全名是 Log Dimensionless Jerk over Velocity。它是 smoothness metric：jerk 是 acceleration 的變化率；jerk 越大，代表速度曲線越不平滑。LDJ-V 把 jerk energy 做時間與 peak velocity 的無因次化，最後取 `-ln(...)`。

---

## 2. 計算定義

Implementation entry points:

```text
research/src/modules/analysis/algorithms/metrics_ldj_v.py
compute_ldj_v(velocity_series, dt) -> float
build_uniform_speed_series(segment_df, max_samples=4096) -> (speed, dt, duration)
compute_segment_ldj_v(segment_df, max_samples=4096) -> float
```

計算流程：

1. 從 `fusedTrace.segments` 選出 `kind == "primary_flick"`。
2. 透過 `per_segment_apply(...)` 對每段 primary flick 建立 segment-local DataFrame。
3. 對每段 segment 呼叫 `build_uniform_speed_series(...)`：
   - 讀取 segment 內的 `ts_us` 與 `speed_px_s`。
   - 用 positive timestamp delta 的 median 決定初始 `dt`。
   - 將 `dt` clamp 到 `0.0005s - 0.02s`。
   - 用 linear interpolation 重建 uniform speed series。
   - 樣本數低於 16 時補成 16；高於 4096 時限制在 4096。
4. 對 uniform speed series 呼叫 `compute_ldj_v(speed, dt)`。
5. Notebook 會額外計算每段 primary flick 的 straight-line distance，供 scatter plot 使用。

核心公式：

```text
acc[i] = (v[i] - v[i-1]) / dt
jerk[i] = (acc[i] - acc[i-1]) / dt
J = sum(jerk[i]^2 * dt)
T = dt * (N - 1)
vPeak = max(abs(v))
dimensionlessJerk = (T^3 / vPeak^2) * J
LDJ-V = -ln(dimensionlessJerk)
```

Go parity 約束：

- 使用自然對數 `ln`，不是 `log10`。
- 使用 forward difference，沒有 Savitzky-Golay 或 central difference。
- 對退化輸入回傳 `0.0`，以符合 Go `computeLDLJV` 行為。

---

## 3. 解讀方式

最重要的原則：

> 在同一種資料處理流程下，LDJ-V 越大，通常代表 movement 越平滑；LDJ-V 越小，通常代表 jerk energy 越高、速度曲線越不平滑。

本專案的 LDJ-V 可能是負值。這不是錯誤；因為公式是 `-ln(dimensionlessJerk)`，當 `dimensionlessJerk > 1` 時，結果自然會是負值。

| 結果 | 解讀 | Precision Aimer 意義 |
|---|---|---|
| 數值較大，例如 `-4` 比 `-9` 大 | 速度曲線較平滑 | 主 flick 加減速較連續，jerk energy 較低 |
| 數值較小，例如 `-10` | 速度曲線較不平滑 | 可能有抖動、二次推動、急停急啟或 segment 內速度變化劇烈 |
| `0.0` | Go-degenerate sentinel | 樣本過少、peak velocity 接近 0、jerk integral 接近 0，或 dimensionless jerk 接近 0；不應直接當作平滑度分數解讀 |
| `NaN` | 欄位缺失或輸入含 NaN | 資料不完整；應先檢查 schema 或上游 fusion output |

Notebook 的 summary 預設會排除 `NaN` 與 `LDJ-V == 0.0` 的 Go-degenerate segments，再計算 mean、median、std、min、max。這是為了避免把「無法計算」和「真正平滑/不平滑」混在一起。

---

## 4. 與其他 Q1 指標的關係

LDJ-V 是 movement smoothness 指標，與 Primary Sub-movement Ratio、Velocity Scaling Consistency 互補。

| 指標 | 問題 | 更接近哪種資訊 |
|---|---|---|
| Primary Sub-movement Ratio | 玩家是否主要靠第一段主 flick 完成？ | sub-movement 結構 |
| Velocity Scaling Consistency | peak velocity 是否依 distance 穩定縮放？ | 出手速度控制一致性 |
| Per-segment LDJ-V | 每段 primary flick 的速度曲線是否平滑？ | movement smoothness / jerk energy |

可能出現的組合：

- Ratio 高、LDJ-V 高：主 flick 自足且平滑。
- Ratio 高、LDJ-V 低：主 flick 可能完成了大部分移動，但速度曲線不穩。
- Ratio 低、LDJ-V 高：主 flick 本身平滑，但 landing 後仍需要 micro-adjustment。
- Velocity R² 低、LDJ-V 高：速度大小不一定按距離縮放，但每段 flick 內部仍可能平滑。

因此 LDJ-V 不應單獨作為「好壞」判斷。建議搭配 segment distance、peak speed、trajectory shape、Primary Sub-movement Ratio 一起看。

---

## 5. 範例結果

以 Spidershot sample 實測：

```text
n_total = 93
n_valid = 93
n_degenerate_zero = 0
n_nan = 0
mean = -7.794528
median = -7.736157
std = 1.482272
min = -11.178855
max = -3.330513
```

這代表 sample 中 93 段 primary flick 都可計算 LDJ-V，沒有缺欄位、NaN 或 Go-degenerate segment。median 約為 `-7.736`，可作為同一玩家、同一 scenario、同一處理流程下的 baseline。後續比較不同 session 時，可以看 median 是否變大、分布是否變窄，以及低 LDJ-V outlier 是否集中在特定距離或特定方向。

注意：LDJ-V 的絕對值不建議跨不同資料處理流程直接比較。只要 resampling、filtering、segmentation 或 speed source 改變，jerk energy 都可能改變。

---

## 6. 圖表讀法

Notebook 輸出 `distribution.png`，包含兩個 panel：

1. Per-segment LDJ-V histogram
   - X 軸：LDJ-V。
   - Y 軸：segment count。
   - 紅線：mean。
   - 綠線：median。
2. LDJ-V vs straight-line distance scatter
   - X 軸：該 primary flick 的直線距離。
   - Y 軸：LDJ-V。

讀圖方式：

1. 先看 histogram 是否集中。分布越窄，代表各段 flick 的 smoothness 較一致。
2. 再看是否有很低的 LDJ-V outlier。這些段落通常值得回頭看 trajectory 或 raw speed profile。
3. 最後看 scatter 是否隨距離改變。若長距離 flick 明顯 LDJ-V 較低，可能代表大幅移動時速度控制較不穩；若短距離 flick LDJ-V 較低，可能是 micro movement 或 capture jitter 影響。

---

## 7. Notebook 使用方法

建議從 repo root 執行，並指定 research project，讓 `uv` 使用 `research/pyproject.toml` 的依賴：

```powershell
uv run --project research python -m research.src.modules.analysis.notebooks.q1_per_segment_ldj.q1_per_segment_ldj `
  --file "test\test_data\Spidershot - Challenge - 2026.03.09-13.42.45 Stats.csv.json"
```

可指定輸出 root：

```powershell
uv run --project research python -m research.src.modules.analysis.notebooks.q1_per_segment_ldj.q1_per_segment_ldj `
  --file "test\test_data\Spidershot - Challenge - 2026.03.09-13.42.45 Stats.csv.json" `
  --out "tmp\q1_per_segment_ldj"
```

預設輸出位置：

```text
research/src/modules/analysis/notebooks/q1_per_segment_ldj/outputs/<session_stem>/
```

輸出檔案：

| 檔案 | 內容 |
|---|---|
| `report.txt` | n_total、n_valid、n_degenerate_zero、n_nan、mean/median/std/min/max、per-segment table |
| `ldj_v_segments.csv` | 每個 primary_flick segment 的 duration、peak speed、straight-line distance、LDJ-V |
| `distribution.png` | LDJ-V histogram 與 LDJ-V vs distance scatter |

目前 sample output 路徑：

```text
research/src/modules/analysis/notebooks/q1_per_segment_ldj/outputs/Spidershot - Challenge - 2026.03.09-13.42.45 Stats.csv/
```

---

## 8. 測試方式

LDJ-V targeted tests：

```powershell
uv run --project research pytest -q research/src/modules/analysis/algorithms/tests/test_metrics_ldj_v.py
```

Analysis algorithms targeted suite：

```powershell
uv run --project research pytest -q research/src/modules/analysis/algorithms/tests/
```

Notebook smoke test：

```powershell
uv run --project research python -m research.src.modules.analysis.notebooks.q1_per_segment_ldj.q1_per_segment_ldj `
  --file "test\test_data\Spidershot - Challenge - 2026.03.09-13.42.45 Stats.csv.json"
```

目前驗證結果：

```text
test_metrics_ldj_v.py: 9 passed
analysis algorithms targeted suite: 56 passed
notebook smoke test: exit 0
```

測試可能顯示 pytest cache permission warning；若 test 本身通過，這個 warning 不影響指標正確性。

---

## 9. 限制與注意事項

- 只支援 schema v1 ScenarioRecord。缺 `fusedTrace.segments` 或 `rawMouseTrace.ts_us` 時，notebook 會輸出錯誤 report 並回傳 exit code 1。
- Notebook 只分析 `kind == "primary_flick"` segments；tracking segments 屬後續 issue。
- `LDJ-V == 0.0` 是 Go-degenerate sentinel，不是「完美平滑」。
- 缺 `speed_px_s` 或 `ts_us` 時，`compute_segment_ldj_v` 回傳 `NaN`。
- `build_uniform_speed_series` 會對每段 segment 重新 resample，這是為了 mirror Go `buildUniformSpeedSeries`，不是直接 slice 已有 fused speed array 後丟進公式。
- Golden parity 使用 checked-in JSON，不在 Python test 中 subprocess 呼叫 Go binary。
- `algorithms/` 內不得 import matplotlib、print 或做檔案 I/O；plotting 和 report output 只存在 notebook script。
