# Velocity Scaling Consistency 指標說明與 Notebook 使用方法

> Status: implemented locally (2026-05-21)
> Algorithm: `research/src/modules/analysis/algorithms/metrics_velocity_scaling.py`
> Notebook: `research/src/modules/analysis/notebooks/q1_velocity_scaling/q1_velocity_scaling.py`
> Sample data: `test/test_data/Spidershot - Challenge - 2026.03.09-13.42.45 Stats.csv.json`

---

## 1. 指標目的

Velocity Scaling Consistency 用來量化玩家的主 flick 是否符合一個基本 Fitts-style 預期：

> 目標距離越長，主 flick 的 peak velocity 應該越系統性地變大。

它回答的問題是：

> 玩家是否會依照移動距離穩定調整出手速度，還是每一段 primary flick 的 peak speed 很不一致？

這個指標屬於 Q1 Precision Aiming / Flick Quality 的 T1 mouse-only 指標。它只依賴 schema v1 ScenarioRecord 中既有的 `fusedTrace.segments` 與 `rawMouseTrace`，不需要鍵盤資料、不需要 target metadata，也不修改 Go backend。

---

## 2. 計算定義

Implementation entry point:

```text
research/src/modules/analysis/algorithms/metrics_velocity_scaling.py
compute_velocity_scaling(scenario_record) -> VelocityScalingResult
```

計算流程：

1. 從 `fusedTrace.segments` 選出 `kind == "primary_flick"`。
2. 透過 `per_segment_apply(...)` 對每段 primary flick 建立 segment-local DataFrame。
3. 對每段 segment 計算：
   - `peak_velocity_px_s`: 該 segment 內 `speed_px_s` 的最大值。
   - `straight_line_distance_px`: segment 起點到終點的 Euclidean distance。
4. 過濾掉 peak velocity 或 distance 為 NaN 的 segment。
5. 若有效 segment 數 `n < 5`，回傳 `preferred_model="insufficient"`，所有 fit 數值為 NaN。
6. 若 `n >= 5`，同時跑兩個 OLS regression：
   - Linear model: `V_peak = intercept + slope * D`
   - Power-law model: `log10(V_peak) = intercept + slope * log10(D)`
7. 以 R² 較高者作為 `preferred_model`。

回傳結構：

| 欄位 | 意義 |
|---|---|
| `linear.slope` | linear model 的距離對 peak velocity 斜率 |
| `linear.intercept` | linear model 截距 |
| `linear.r_squared` | linear model 的解釋力 |
| `power.slope` | power-law model 的 log-log slope |
| `power.intercept` | power-law model 的 log-log intercept |
| `power.r_squared` | power-law model 的解釋力 |
| `n` | 參與 regression 的有效 primary_flick segment 數 |
| `preferred_model` | `"linear"`、`"power"` 或 `"insufficient"` |
| `insufficient_segments` | `n < 5` 時為 `True` |

---

## 3. 解讀方式

最重要的欄位是 `r_squared` 與 `n`。

| 結果 | 解讀 | Precision Aimer 意義 |
|---|---|---|
| `R²` 高，`n` 足夠 | peak velocity 與 distance 有穩定關係 | 玩家會依距離調整出手速度，velocity scaling 一致 |
| `R²` 低，`n` 足夠 | distance 無法很好解釋 peak velocity | 出手速度控制不穩，或 segment 定義/場景行為包含其他因素 |
| `preferred_model="linear"` | 線性模型比 power-law 更貼近資料 | peak velocity 約以固定 px/s per px 的方式跟距離變化 |
| `preferred_model="power"` | power-law 模型比 linear 更貼近資料 | peak velocity 與距離關係較像比例縮放，不是簡單線性 |
| `preferred_model="insufficient"` | 有效 segment 少於 5 | 不應解讀 slope/R²，需更多資料 |

建議粗略門檻：

| R² 區間 | 解讀 |
|---|---|
| `>= 0.70` | 很強的一致性 |
| `0.40 - 0.70` | 中等一致性，值得比較 quadrant 或 session |
| `< 0.40` | 一致性弱，需搭配 trajectory、path efficiency、sub-movement ratio 解讀 |

這些門檻不是 pass/fail 標準，只是幫助閱讀 notebook 的起點。R² 低不一定代表玩家能力差，也可能代表該 scenario 中每段 primary flick 的距離分布太窄、segment 太短、或 movement strategy 不是單純距離驅動。

---

## 4. 與 Fitts IE 的差異

Velocity Scaling Consistency 與既有 Fitts throughput / IE 是互補指標，不是替代關係。

| 指標 | 問題 | 更接近哪種資訊 |
|---|---|---|
| Fitts throughput / IE | 這次任務完成得有效率嗎？ | 結果型效率：距離、target size、movement time |
| Velocity Scaling Consistency | 玩家是否依距離穩定調整 peak velocity？ | 運動控制型一致性：peak speed 與 distance 的關係 |

可能出現的組合：

- IE 高、velocity R² 高：完成快，而且速度縮放穩定。
- IE 高、velocity R² 低：完成仍快，但出手速度控制可能不穩，靠修正或其他策略補回結果。
- IE 低、velocity R² 高：速度縮放穩定，但整體 movement time 或 accuracy 仍有瓶頸。
- IE 低、velocity R² 低：結果效率與速度控制一致性都需要進一步診斷。

---

## 5. 範例結果

以 Spidershot sample 實測：

```text
n = 93
preferred_model = power
linear_slope = -8.612319
linear_r_squared = 0.219726
power_slope = -0.167674
power_r_squared = 0.338775
```

Per-quadrant summary：

| Quadrant | n | R² linear | R² power | preferred |
|---|---:|---:|---:|---|
| Q1 | 25 | 0.311653 | 0.402787 | power |
| Q2 | 22 | 0.207998 | 0.369296 | power |
| Q3 | 26 | 0.178221 | 0.277325 | power |
| Q4 | 20 | 0.212787 | 0.312384 | power |

這代表 sample 中 peak velocity 與 segment distance 的關係偏弱，power-law 比 linear 稍微貼近，但整體 R² 仍低於 0.40。對 Precision Aimer 來說，這不是單獨的結論，而是診斷入口：接下來應該搭配 primary sub-movement ratio、trajectory shape、path efficiency 與 initial angle error 看玩家是否靠後段修正彌補不一致的出手速度。

---

## 6. Scatter 圖讀法

Notebook 輸出 `scatter.png`，包含：

- Overall linear panel：X 軸是 `straight_line_distance_px`，Y 軸是 `peak_velocity_px_s`。
- Overall log-log panel：X 軸是 `log10(distance)`，Y 軸是 `log10(peak_velocity)`。
- Q1~Q4 quadrant panels：各方向的 distance/peak velocity scatter。

讀圖方式：

1. 先看 overall scatter 是否大致沿著某條斜線分布。
2. 再看 log-log panel 是否比 linear panel 更接近直線。
3. 最後看 quadrant panels，確認低 R² 是否由特定方向造成。

若某個 quadrant 的點雲非常分散，表示該方向的出手速度不太由距離決定。若某個 quadrant 的 `n < 5`，report 會保留該 row 並標記 `insufficient_segments`，不要解讀該方向的 slope/R²。

---

## 7. Notebook 使用方法

建議從 `research/` 目錄執行，讓 `uv` 使用 `research/pyproject.toml` 的依賴，包括 `matplotlib`：

```powershell
cd research
uv run python -m modules.analysis.notebooks.q1_velocity_scaling.q1_velocity_scaling `
  --file "..\test\test_data\Spidershot - Challenge - 2026.03.09-13.42.45 Stats.csv.json"
```

可指定輸出 root：

```powershell
cd research
uv run python -m modules.analysis.notebooks.q1_velocity_scaling.q1_velocity_scaling `
  --file "..\test\test_data\Spidershot - Challenge - 2026.03.09-13.42.45 Stats.csv.json" `
  --out "..\tmp\q1_velocity_scaling"
```

可指定 Fitts IE 比較用的固定 target geometry：

```powershell
cd research
uv run python -m modules.analysis.notebooks.q1_velocity_scaling.q1_velocity_scaling `
  --file "..\test\test_data\Spidershot - Challenge - 2026.03.09-13.42.45 Stats.csv.json" `
  --target-dist 400 `
  --target-size 100
```

預設輸出位置：

```text
research/src/modules/analysis/notebooks/q1_velocity_scaling/outputs/<session_stem>/
```

輸出檔案：

| 檔案 | 內容 |
|---|---|
| `report.txt` | 整體 slope/R²/n、per-quadrant 表格、Fitts IE 比較、解讀文字 |
| `scatter.png` | overall linear/log-log scatter 與 Q1~Q4 quadrant scatter |
| `velocity_scaling_segments.csv` | 每個 primary_flick segment 的 peak velocity、distance、quadrant |
| `velocity_scaling_quadrants.csv` | Q1~Q4 的 n、linear/power R²、preferred model |

注意：`outputs/` 目錄被 `.gitignore` 忽略。Notebook 產物是本地分析 artifact，不會自動進入 PR。若需要在 PR 或 issue 中分享圖表，請手動附上或另行決定 artifact 保存位置。

---

## 8. 測試方式

單元測試：

```powershell
uv run pytest -q research/src/modules/analysis/algorithms/tests/test_metrics_velocity_scaling.py
```

Analysis algorithms targeted suite：

```powershell
uv run pytest -q research/src/modules/analysis/algorithms/tests/
```

Notebook smoke test：

```powershell
cd research
uv run python -m modules.analysis.notebooks.q1_velocity_scaling.q1_velocity_scaling `
  --file "..\test\test_data\Spidershot - Challenge - 2026.03.09-13.42.45 Stats.csv.json"
```

目前驗證結果：

```text
uv run pytest -q research/src/modules/analysis/algorithms/tests/
47 passed
```

測試可能顯示 pytest cache permission warning；若 test 本身通過，這個 warning 不影響指標正確性。

---

## 9. 限制與注意事項

- 只支援 schema v1 ScenarioRecord。缺 `fusedTrace.segments` 時會 raise `ValueError("ScenarioRecord schema < v1; re-capture required")`。
- `n_min = 5`。少於 5 個有效 primary_flick segment 時不回傳可解讀 regression。
- peak velocity 使用 `speed_px_s` 的 raw max，不先做 Savitzky-Golay smoothing。這是為了讓指標語義穩定，避免為了提高 R² 改變量測定義。
- power-law branch 只使用 `distance >= 1.0 px` 且 `peak_velocity > 0` 的 row，避免 `log10(0)` 或負值。
- `algorithms/` 內不得 import matplotlib、print 或做檔案 I/O；plotting 和 report output 只存在 notebook script。
- 目前 notebook 的 Fitts IE 比較使用固定 `--target-dist` / `--target-size`，預設為 `400` / `100` px。若要做跨 scenario 比較，應在資料集層明確管理 target geometry。
