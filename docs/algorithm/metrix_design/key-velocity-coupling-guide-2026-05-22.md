# Key-Velocity Coupling 指標說明與 Notebook 使用方法

> Status: implemented locally (2026-05-22)  
> Quadrant: Q4 / Mouse + Keyboard behavioral proxy  
> Algorithm: `research/src/modules/analysis/algorithms/metrics_key_velocity_coupling_xcorr.py`  
> Notebook: `research/src/modules/analysis/notebooks/q4_key_velocity_coupling/q4_key_velocity_coupling.py`  
> Sample data: `test/test_data/Peek and Click - Challenge - 2026.05.20-16.11.07 Stats.csv.json`  
> Spec source: [fps-quadrant-metrics-roadmap-2026-05-20.md](fps-quadrant-metrics-roadmap-2026-05-20.md), [ADR-0001](../../adr/0001-behavioral-proxy-renaming-for-q3-q4-indicators.md)

---

## 1. 指標目的

Key-Velocity Coupling 用來量化玩家的 movement-key state 與 mouse velocity 之間是否存在穩定的領先 / 落後關係。

它回答的問題是：

> 在一段時間窗內，玩家的 WASD 狀態變化是否與滑鼠速度變化同步？如果不同步，是鍵盤先變，還是滑鼠速度先變？

這是一個 **行為代理指標**。它不是命中率、分數、TTK、smoothness，也不是文獻中的 HKB phase-coupled-oscillator metric。ADR-0001 已將原本容易誤解的 Q4 指標重新定義為 lagged Pearson cross-correlation。

---

## 2. 計算定義

對每個 non-overlapping sliding window，建立兩條等長序列：

```text
x[t] = key_state(t)
y[t] = mouse_velocity(t)
```

在指定 lag range 內計算 lagged Pearson correlation：

```text
r(lag) = corr(x shifted by lag, y)
```

取絕對值最大的 correlation：

```text
peak_lag_ms = lag_at_max_abs_corr * sample_period_ms
peak_strength = r(peak_lag)
```

輸出一列代表一個 window。

---

## 3. Key Encoding

`key_encoding` 會把 WASD held state 轉成單一 scalar。

### 3.1 `signed_wasd`（預設）

```text
state = (D_held - A_held) + (W_held - S_held)
```

| 狀態 | 值 |
|---|---:|
| A held | -1 |
| D held | +1 |
| S held | -1 |
| W held | +1 |
| A + D 同時 held | 0 |
| W + S 同時 held | 0 |
| 無 WASD | 0 |

這個編碼保留方向符號，但把水平與垂直軸壓成同一條 scalar，因此物理意義上是 v1 簡化版。若之後需要更嚴謹的方向分析，應新增 horizontal / vertical two-axis variant。

### 3.2 `binary_any_movement`

```text
state = 1 if any(W, A, S, D held) else 0
```

這個編碼不保留方向，只看「是否正在按任一移動鍵」。它適合檢查 sustained strafing 是否與滑鼠速度有關，但不能區分 A/D 或 W/S 方向。

---

## 4. Velocity Component

`velocity_component` 會把 mouse trace 轉成單一 velocity scalar。

| 值 | 來源欄位 | 說明 |
|---|---|---|
| `speed_px_s` | `joined_df["speed_px_s"]` | 預設；使用既有 smoothed scalar speed |
| `dx` | `joined_df["dx"]` | raw per-sample x increment；cross-correlation 不依賴絕對單位 |
| `dy` | `joined_df["dy"]` | raw per-sample y increment |
| `projected_target` | n/a | T3 v1 不支援，會 raise `NotImplementedError` |

目前 notebook 的 HITL sweep 比較：

```text
signed_wasd × speed_px_s
signed_wasd × dx
binary_any_movement × speed_px_s
binary_any_movement × dx
```

---

## 5. 輸出欄位

`compute_key_velocity_coupling(...)` 回傳 DataFrame：

| 欄位 | 型別 | 意義 |
|---|---|---|
| `window_start_us` | int64 | window 第一個 mouse sample timestamp |
| `window_end_us` | int64 | window 最後一個 mouse sample timestamp |
| `peak_lag_ms` | float | 最大絕對 correlation 對應的 lag，單位 ms |
| `peak_strength` | float | `peak_lag_ms` 對應的 Pearson r，範圍約 `[-1, 1]` |
| `n_samples` | int64 | 該 window 的 mouse sample 數 |

若 window 內 key-state 或 velocity 是常數，Pearson correlation 無法定義：

```text
peak_lag_ms = NaN
peak_strength = NaN
```

---

## 6. 如何解讀

### 6.1 `peak_lag_ms`

本實作採用：

| `peak_lag_ms` | 解讀 |
|---:|---|
| `< 0` | key-state 變化領先 mouse velocity |
| `≈ 0` | key-state 與 mouse velocity 幾乎同步 |
| `> 0` | mouse velocity 變化領先 key-state |
| `NaN` | 該 window 無法估計 lag |

直覺上，負值代表鍵盤動作先出現，滑鼠速度後跟上；正值代表滑鼠速度變化比較早出現。

### 6.2 `peak_strength`

| `peak_strength` | 解讀 |
|---:|---|
| 接近 `+1` | key-state 與 velocity 在該 lag 下同向變化 |
| 接近 `-1` | key-state 與 velocity 在該 lag 下反向變化 |
| 接近 `0` | 沒有明顯線性 coupling |
| `NaN` | key-state 或 velocity 無變異，無法計算 Pearson r |

讀 `peak_strength` 時不要直接丟掉正負號。正負號代表同向 / 反向關係，`abs(peak_strength)` 才代表 coupling 強度。

### 6.3 分佈重點

建議一起看：

1. `valid_windows / n_windows`：這個 scenario 是否有足夠可解讀 window。
2. median `peak_lag_ms`：典型鍵盤 / 滑鼠領先關係。
3. p5 / p95 `peak_lag_ms`：lag 是否穩定。
4. median `abs(peak_strength)`：典型 coupling 強度。
5. `peak_strength` 正負比例：關係是同向還是反向為主。
6. scatter 中高亮的 `|peak_strength| > 0.3` windows：哪些區段有較明顯 coupling。

---

## 7. Peek and Click Fixture 實測範例

目前以 v1 fixture 實測：

```text
file = test/test_data/Peek and Click - Challenge - 2026.05.20-16.11.07 Stats.csv.json

n_windows = 377
valid_windows = 134
median peak_strength = -0.652
median peak_lag_ms = -4.012
selected key_encoding = signed_wasd
selected velocity_component = speed_px_s
window_ms = 200
lag_range_ms = (-200, 200)
```

這代表在可估計的 windows 中，典型 lag 很接近同步但略偏「key-state 領先 velocity」。`peak_strength` median 為負，代表在預設 scalar encoding 下，典型 peak correlation 是反向關係。

這不是「好 / 壞」分數。它只描述此 fixture 中鍵盤與滑鼠速度的時間關係；要判斷技術品質，仍需搭配命中率、TTK、target context、movement phase 與場景類型。

---

## 8. Notebook 輸出

Notebook 會輸出三個檔案：

| 檔案 | 內容 |
|---|---|
| `report.txt` | 指標摘要、前 20 rows、HITL sweep rationale、Issue #7 acceptance checklist |
| `distribution.png` | peak_strength histogram + peak_lag_ms per-window scatter |
| `key_velocity_coupling.csv` | 每個 window 的完整輸出 table |

預設輸出位置：

```text
research/src/modules/analysis/notebooks/q4_key_velocity_coupling/outputs/<session_stem>/
```

Peek and Click 範例輸出位置：

```text
research/src/modules/analysis/notebooks/q4_key_velocity_coupling/outputs/Peek and Click - Challenge - 2026.05.20-16.11.07 Stats/
```

產出檔不應 commit。只 commit：

```text
research/src/modules/analysis/notebooks/q4_key_velocity_coupling/outputs/.gitkeep
```

---

## 9. Notebook 使用方法

建議從 repo root 執行，並使用 `research/pyproject.toml` 的環境：

```powershell
uv run --project research python -m modules.analysis.notebooks.q4_key_velocity_coupling.q4_key_velocity_coupling `
  --file "test\test_data\Peek and Click - Challenge - 2026.05.20-16.11.07 Stats.csv.json"
```

指定輸出 root：

```powershell
uv run --project research python -m modules.analysis.notebooks.q4_key_velocity_coupling.q4_key_velocity_coupling `
  --file "test\test_data\Peek and Click - Challenge - 2026.05.20-16.11.07 Stats.csv.json" `
  --out "tmp\q4_key_velocity_coupling"
```

調整 window 與 lag range：

```powershell
uv run --project research python -m modules.analysis.notebooks.q4_key_velocity_coupling.q4_key_velocity_coupling `
  --file "test\test_data\Peek and Click - Challenge - 2026.05.20-16.11.07 Stats.csv.json" `
  --window-ms 200 `
  --lag-min-ms -200 `
  --lag-max-ms 200
```

調整 encoding 與 velocity component：

```powershell
uv run --project research python -m modules.analysis.notebooks.q4_key_velocity_coupling.q4_key_velocity_coupling `
  --file "test\test_data\Peek and Click - Challenge - 2026.05.20-16.11.07 Stats.csv.json" `
  --key-encoding binary_any_movement `
  --velocity-component dx
```

成功時 CLI 會輸出類似：

```text
Key-Velocity Coupling: n=377 valid=134 median_strength=-0.652 median_lag_ms=-4.012
Outputs written to: ...\research\src\modules\analysis\notebooks\q4_key_velocity_coupling\outputs\Peek and Click - Challenge - 2026.05.20-16.11.07 Stats
```

---

## 10. Notebook 內部流程

流程如下：

1. 讀入 ScenarioRecord JSON。
2. 檢查 schema v1 必要欄位：
   - `rawMouseTrace`
   - `keyboardTrace`
   - `rawMouseTrace.ts_us`
   - `rawMouseTrace.dx`
   - `rawMouseTrace.dy`
   - `rawMouseTrace.buttons`
3. `load_rawtrace(record)` 載入 mouse trace。
4. `load_keyboard_trace(file_path)` 載入 keyboard events。
5. `align_keyboard_to_mouse(keyboard_df, mouse_df, scenario_record=record)` 建立 mouse-indexed joined view。
6. 用 `_compute_qpc_wallclock_offset_us(record)` 取得 timebase offset；目前 v1 schema offset 為 `0.0`。
7. `compute_key_velocity_coupling(...)` 計算 per-window xcorr。
8. 執行 HITL sweep，比較 4 組 key / velocity 設定。
9. 寫出 CSV、PNG、report。

錯誤時：

- 缺 schema v1 欄位會輸出 `SCHEMA_V1_REQUIRED` report。
- 不支援的 `projected_target` 會輸出錯誤 report。
- CLI exit code 會是 `1`。

---

## 11. 圖表讀法

`distribution.png` 有兩個 panel：

### 11.1 Peak Strength Histogram

用途：看每個 valid window 的 peak Pearson r 分佈。

重點：

- 分佈是否集中。
- 是否偏正或偏負。
- mean / median / p5 / p95 位置是否差很多。
- 是否大量接近 0，代表 coupling 不明顯。

### 11.2 Peak Lag Scatter

用途：看每個 window 的 peak lag。

顏色語意：

| 顏色 | 意義 |
|---|---|
| 紅色 | `|peak_strength| > 0.3`，較明顯的 coupling window |
| 灰色 | `|peak_strength| <= 0.3`，較弱或不明顯 |

讀圖順序：

1. 先看有多少 window 有點；空白或 NaN 很多代表資料不足或該 window 無變異。
2. 再看點是否集中在 0 附近，判斷鍵盤 / 滑鼠是否近同步。
3. 看紅點主要在負 lag 還是正 lag，判斷誰領先。
4. 對 outlier window 回 CSV 查 `window_start_us` / `window_end_us`。

---

## 12. 測試方式

Metric targeted tests：

```powershell
uv run --project research pytest -q research/src/modules/analysis/algorithms/tests/test_metrics_key_velocity_coupling_xcorr.py -p no:cacheprovider --basetemp codex_pytest_tmp_t3_metric
```

Research module sweep：

```powershell
uv run --project research pytest -q research/src/modules/ -p no:cacheprovider --basetemp codex_pytest_tmp_t3_final
```

Notebook smoke test：

```powershell
uv run --project research python -m modules.analysis.notebooks.q4_key_velocity_coupling.q4_key_velocity_coupling `
  --file "test\test_data\Peek and Click - Challenge - 2026.05.20-16.11.07 Stats.csv.json"
```

目前驗證結果：

```text
test_metrics_key_velocity_coupling_xcorr.py: 9 passed
research/src/modules: 113 passed
notebook smoke test: exit 0
```

如果 pytest 在 Windows 上因 `%TEMP%` 權限失敗，使用 `--basetemp` 指向 repo 內暫存資料夾。

---

## 13. 限制與注意事項

- 只支援 schema v1 ScenarioRecord。
- 目前 window 是 non-overlapping；尚未支援 `hop_ms` / overlapping windows。
- 預設 `min_samples_per_window = 16`；太短的 window 會輸出 NaN。
- `signed_wasd` 把水平與垂直軸合併為單一 scalar，A+D 或 W+S 會互相抵消。
- `projected_target` 尚未支援，因為需要更明確的 target metadata 語意。
- `dx` / `dy` 是 per-sample increment，不是 px/s；cross-correlation 不依賴絕對單位，但解讀時要注意。
- `peak_strength = NaN` 不代表程式錯誤；通常代表 key-state 或 velocity 在該 window 是常數。
- 不應將此指標單獨當作技能分數；它應搭配 hit rate、TTK、movement phase、scenario 類型一起看。
- `algorithms/` 內不得 import matplotlib、print 或寫檔；I/O 與 plotting 只存在 notebook script。

---

## 14. 相關檔案

| 類型 | 路徑 |
|---|---|
| Loader | `research/src/modules/input/algorithms/keyboard_trace.py` |
| Alignment | `research/src/modules/fusion/algorithms/alignment.py` |
| Metric | `research/src/modules/analysis/algorithms/metrics_key_velocity_coupling_xcorr.py` |
| Facade | `research/src/modules/analysis/algorithms/spidershot_fitts.py` |
| Notebook | `research/src/modules/analysis/notebooks/q4_key_velocity_coupling/q4_key_velocity_coupling.py` |
| Unit tests | `research/src/modules/analysis/algorithms/tests/test_metrics_key_velocity_coupling_xcorr.py` |
| ExecPlan | `docs/exec-plans/active/t3-key-velocity-coupling-execution-plan-2026-05-22.md` |
| Checklist | `docs/exec-plans/active/t3-key-velocity-coupling-task-checklist-2026-05-22.md` |
