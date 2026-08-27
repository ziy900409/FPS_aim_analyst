# Release-to-Click Sync 指標說明與 Notebook 使用方法

> Status: implemented locally (2026-05-22)  
> Quadrant: Q3 / Mouse + Keyboard behavioral proxy  
> Algorithm: `research/src/modules/analysis/algorithms/metrics_release_to_click_sync.py`  
> Notebook: `research/src/modules/analysis/notebooks/q3_release_to_click_sync/q3_release_to_click_sync.py`  
> Sample data: `test/test_data/Peek and Click - Challenge - 2026.05.20-16.11.07 Stats.csv.json`  
> Spec source: [fps-quadrant-metrics-roadmap-2026-05-20.md](fps-quadrant-metrics-roadmap-2026-05-20.md), [ADR-0001](../../adr/0001-behavioral-proxy-renaming-for-q3-q4-indicators.md)

---

## 1. 指標目的

Release-to-Click Sync 用來量化一次 flick 期間，玩家「最後一次放開移動鍵」與「第一次點擊」之間的時間差。

它回答的問題是：

> 在同一次 flick 相關 movement window 裡，玩家是先 release movement key 再 click，還是 release 之前就已經 click？

這是一個 **行為代理指標**，不是命中率、分數、TTK、reaction time，也不是單純的滑鼠 smoothness。它用來觀察 Q3 類型場景中，玩家在移動停止與開火之間的節奏控制。

---

## 2. 計算定義

對每個 `kind == "primary_flick"` 的 segment，定義：

```text
delay_ms = (t_first_click_us - t_last_key_release_us) / 1000
```

其中：

| 欄位 | 來源 | 定義 |
|---|---|---|
| `t_first_click_us` | `rawMouseTrace.buttons` | movement window 內第一個 left-button rising edge，也就是 `buttons & 1` 從 0 變 1 |
| `t_last_key_release_us` | `keyboardTrace` | movement window 內最後一次 movement key release |
| `delay_ms` | derived | click timestamp 減 release timestamp，轉成 milliseconds |

Movement key 預設只看 WASD：

| Key | VK |
|---|---:|
| A | 65 |
| D | 68 |
| W | 87 |
| S | 83 |

Keyboard action 預設：

| `action` | meaning |
|---:|---|
| `0` | key down / press |
| `1` | key up / release |

---

## 3. Segment Window 規則

輸出表格仍然是 **一列一個 `primary_flick`**。

但目前 v1 fixture 的 segment boundary 有一個重要特性：click rising edge 與 WASD release 常落在 `primary_flick` 後面緊接的 `micro_adjustment` segment，而不是 `primary_flick` 本身的 start/end 內。

因此目前實作採用這個 search window：

```text
search_start = primary_flick.start_ts_us
search_end   = immediate_next_micro_adjustment.end_ts_us
```

如果 primary flick 後面沒有緊接 `micro_adjustment`：

```text
search_end = primary_flick.end_ts_us
```

這個決策的目的：

- 保持結果 row count 等於 `primary_flick` 數量。
- 不把 `micro_adjustment` 當作獨立 metric row。
- 避免 v1 fixture 中 57 個 primary flick 全部找不到 click/release。
- 讓指標語意仍然是「一次 flick 的 release-to-click timing」。

---

## 4. 輸出欄位

`compute_release_to_click_sync(...)` 回傳 DataFrame，主要欄位如下：

| 欄位 | 型別 | 意義 |
|---|---|---|
| `pair_id` | int | primary flick row index |
| `start_ts_us` | int64 | primary flick start timestamp |
| `end_ts_us` | int64 | primary flick end timestamp；注意不是 extended search window end |
| `t_first_click_us` | nullable int | search window 內第一次 click timestamp |
| `t_last_release_us` | nullable int | search window 內最後一次 WASD release timestamp |
| `delay_ms` | float | `(t_first_click_us - t_last_release_us) / 1000` |
| `has_click` | bool | search window 內是否找到 click |
| `has_release` | bool | search window 內是否找到 WASD release |

若沒有 click 或沒有 release：

```text
delay_ms = NaN
```

---

## 5. 如何解讀

### 5.1 正負號

| `delay_ms` | 解讀 | 行為含義 |
|---:|---|---|
| `< 0` | click 發生在 release 之前 | 玩家在放開移動鍵之前就開火；可能是 aggressive counter-strafe timing |
| `≈ 0` | click 與 release 幾乎同步 | 停止移動與開火節奏高度貼合 |
| `> 0` | release 發生在 click 之前 | 玩家先放開移動鍵，再等待一段時間才開火；較像 stop-then-shoot |
| `NaN` | 不可計算 | 該 flick window 缺 click 或缺 movement-key release |

### 5.2 分佈重點

不要只看單一 segment，也不要只看 mean。建議一起看：

1. `median`：典型 delay。
2. `p5` / `p95`：穩定度與長尾。
3. `negative_count` / `positive_count`：counter-strafe-like 與 stop-then-shoot-like 的比例。
4. `n_has_both / n_total`：這個 scenario 是否真的提供足夠 keyboard + click 訊號。
5. `NaN` rows：缺 click 或缺 release 的比例。

### 5.3 常見型態

| 型態 | 解讀 |
|---|---|
| 多數為正值，且 median 明顯大於 0 | 先停再打，click 通常落在 key release 之後 |
| 多數為負值 | click 常早於 release，可能代表較激進或較早開火的 counter-strafe timing |
| median 接近 0，p5/p95 很窄 | release 與 click timing 穩定且接近同步 |
| mean 與 median 差很多 | 分佈有長尾或少數極端值；優先看 percentile 和 scatter |
| `NaN` 很多 | 該 scenario 或 fixture 不一定適合用此指標下結論 |

---

## 6. Peek and Click Fixture 實測範例

目前以 v1 fixture 實測：

```text
file = test/test_data/Peek and Click - Challenge - 2026.05.20-16.11.07 Stats.csv.json

n_flick = 57
n_has_click = 56
n_has_release = 53
n_has_both = 53
delay_ms mean = 314.271
delay_ms median = 322.705
negative_count = 0
positive_count = 53
```

這代表該 fixture 大多是 release 後才 click，較接近 stop-then-shoot timing。它沒有出現負值，因此若要校準 counter-strafe behavior，仍需要更多 movement-heavy 或 counter-strafe-oriented scenario。

---

## 7. Notebook 輸出

Notebook 會輸出三個檔案：

| 檔案 | 內容 |
|---|---|
| `report.txt` | 指標摘要、分佈統計、前 20 rows、Precision Aimer 解讀、Issue #6 acceptance checklist |
| `distribution.png` | delay histogram + per-segment scatter |
| `release_to_click_sync.csv` | 每個 primary flick 的完整 per-segment table |

預設輸出位置：

```text
research/src/modules/analysis/notebooks/q3_release_to_click_sync/outputs/<session_stem>/
```

Peek and Click 範例輸出位置：

```text
research/src/modules/analysis/notebooks/q3_release_to_click_sync/outputs/Peek and Click - Challenge - 2026.05.20-16.11.07 Stats/
```

產出檔不應 commit。只 commit：

```text
research/src/modules/analysis/notebooks/q3_release_to_click_sync/outputs/.gitkeep
```

---

## 8. Notebook 使用方法

建議從 repo root 執行，並使用 `research/pyproject.toml` 的環境：

```powershell
uv run --project research python -m modules.analysis.notebooks.q3_release_to_click_sync.q3_release_to_click_sync `
  --file "test\test_data\Peek and Click - Challenge - 2026.05.20-16.11.07 Stats.csv.json"
```

指定輸出 root：

```powershell
uv run --project research python -m modules.analysis.notebooks.q3_release_to_click_sync.q3_release_to_click_sync `
  --file "test\test_data\Peek and Click - Challenge - 2026.05.20-16.11.07 Stats.csv.json" `
  --out "tmp\q3_release_to_click_sync"
```

成功時 CLI 會輸出類似：

```text
Release-to-Click Sync: n=57 valid=53 median_ms=322.705
Outputs written to: ...\research\src\modules\analysis\notebooks\q3_release_to_click_sync\outputs\Peek and Click - Challenge - 2026.05.20-16.11.07 Stats
```

---

## 9. Notebook 內部流程

流程如下：

1. 讀入 ScenarioRecord JSON。
2. 檢查 schema v1 必要欄位：
   - `rawMouseTrace`
   - `keyboardTrace`
   - `fusedTrace.segments`
3. `load_rawtrace(record)` 載入 mouse trace。
4. `load_keyboard_trace(file_path)` 載入 keyboard events。
5. `align_keyboard_to_mouse(keyboard_df, mouse_df, scenario_record=record)` 建立 mouse-indexed joined view。
6. 用 `_compute_qpc_wallclock_offset_us(record)` 取得 timebase offset；目前 v1 schema offset 為 `0.0`。
7. `compute_release_to_click_sync(joined, segments, keyboard_qpc)` 計算 per-flick delay。
8. 寫出 CSV、PNG、report。

錯誤時：

- 缺 schema v1 欄位會輸出 `SCHEMA_V1_REQUIRED` report。
- CLI exit code 會是 `1`。

---

## 10. 圖表讀法

`distribution.png` 有兩個 panel：

### 10.1 Histogram

用途：看整體 delay 分佈。

重點：

- 分佈是否集中。
- 是否明顯偏正或偏負。
- mean / median / p5 / p95 位置是否差很多。

### 10.2 Per-segment Scatter

用途：看每個 primary flick 的 delay。

顏色語意：

| 顏色 | 意義 |
|---|---|
| 藍色 | negative delay |
| 紅色 | positive delay |
| 灰色 | missing release 或 missing valid delay |

讀圖順序：

1. 先看 gray dots 是否很多，判斷資料完整度。
2. 再看紅/藍比例，判斷 timing 偏向。
3. 最後看是否有 outlier flick，回 CSV 查該 row。

---

## 11. 測試方式

Metric targeted tests：

```powershell
uv run --project research pytest -q research/src/modules/analysis/algorithms/tests/test_metrics_release_to_click_sync.py -p no:cacheprovider
```

Research module sweep：

```powershell
uv run --project research pytest -q research/src/modules/ -p no:cacheprovider --basetemp codex_pytest_tmp_t2_m4
```

Notebook smoke test：

```powershell
uv run --project research python -m modules.analysis.notebooks.q3_release_to_click_sync.q3_release_to_click_sync `
  --file "test\test_data\Peek and Click - Challenge - 2026.05.20-16.11.07 Stats.csv.json"
```

目前驗證結果：

```text
test_metrics_release_to_click_sync.py: 8 passed
research/src/modules: 104 passed
notebook smoke test: exit 0
```

如果 pytest 在 Windows 上因 `%TEMP%` 權限失敗，使用 `--basetemp` 指向 repo 內暫存資料夾。

---

## 12. 限制與注意事項

- 只支援 schema v1 ScenarioRecord。
- 指標只輸出 primary flick rows；不輸出 micro_adjustment rows。
- click 來自 physical button rising edge，不是 KovaaK hit/kill event。
- release 只看 movement keys，預設 WASD。
- `delay_ms = NaN` 不代表錯誤；代表該 flick window 缺 click 或缺 release。
- 目前 Peek and Click fixture 以正值為主，不足以代表 counter-strafe-heavy 場景。
- 不應將此指標單獨當作技能分數；它應搭配 hit rate、TTK、movement phase、scenario 類型一起看。
- `algorithms/` 內不得 import matplotlib、print 或寫檔；I/O 與 plotting 只存在 notebook script。

---

## 13. 相關檔案

| 類型 | 路徑 |
|---|---|
| Loader | `research/src/modules/input/algorithms/keyboard_trace.py` |
| Alignment | `research/src/modules/fusion/algorithms/alignment.py` |
| Metric | `research/src/modules/analysis/algorithms/metrics_release_to_click_sync.py` |
| Facade | `research/src/modules/analysis/algorithms/spidershot_fitts.py` |
| Notebook | `research/src/modules/analysis/notebooks/q3_release_to_click_sync/q3_release_to_click_sync.py` |
| Unit tests | `research/src/modules/analysis/algorithms/tests/test_metrics_release_to_click_sync.py` |
| ExecPlan | `docs/exec-plans/active/t2-keyboard-trace-and-release-to-click-sync-execution-plan-2026-05-22.md` |
| Checklist | `docs/exec-plans/active/t2-keyboard-trace-and-release-to-click-sync-task-checklist-2026-05-22.md` |
