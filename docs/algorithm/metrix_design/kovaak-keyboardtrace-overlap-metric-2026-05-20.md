# KovaaK KeyboardTrace Overlap 指標說明

> **Status**: Draft  
> **Notebook**: `research/src/modules/analysis/notebooks/kovaak_scenario_survey/inspect_keyboardtrace.py`  
> **Survey result**: `docs/algorithm/research/kovaak-movement-scenario-survey-2026-05-20.md`  
> **Primary use**: T2 / T3 資料閘門，不是最終玩家評分指標

---

## 1. 這個指標在量什麼

`KeyboardTrace Overlap` 用來回答一個很窄但關鍵的問題：

```text
這份 ScenarioRecord 裡，玩家是否在「正在 aim 的 mouse segment」期間實際按著 W/A/S/D？
```

它不是 accuracy、reaction time、movement quality，也不是最終的 T2/T3 指標。它是資料品質 gate：如果一份 KovaaK session 沒有足夠的 W/A/S/D held state 和 mouse movement 重疊，後續的 Release-to-Click Sync 或 Key-Velocity Coupling 就沒有可分析訊號。

正式判定式：

```text
WASD-held duration ∩ mouse-segment duration >= 10% × total aim duration
```

其中：

- `WASD-held duration`：W/A/S/D key press 到 release 的時間區間。
- `mouse-segment duration`：`fusedTrace.segments` 中 `kind ∈ {primary_flick, micro_adjustment}` 的時間區間。
- `total aim duration`：`rawMouseTrace.ts_us` 第一筆到最後一筆的時間跨度。
- `10%`：survey 事前定義的 non-trivial keyboard activity 門檻。

---

## 2. 為什麼不用單純按鍵事件密度

只看 `keyboardTrace` 每分鐘有幾個 event 會有兩個問題：

1. 玩家可能只在選單、休息、或非 aiming 階段按鍵。
2. 某些 capture 的 `action=0` / `action=1` 不一定嚴格成對，單純 event count 不能代表 key 是否真的 held。

Overlap 指標把 keyboard interval 和 mouse segment interval 對齊後再計算，所以更接近 T2/T3 真正需要的訊號：手部 movement input 是否發生在 aim 行為期間。

---

## 3. 圖片解讀

### Positive Control：Peek and Click

![Peek and Click WASD timeline](../../../research/src/modules/analysis/notebooks/kovaak_scenario_survey/outputs/Peek%20and%20Click%20-%20Challenge%20-%202026.05.20-16.11.07%20Stats.csv/timeline.png)

這張圖上半部是 mouse speed，下半部是 W/A/S/D held lanes。`Peek and Click - Challenge` 的 A/D held lanes 和 speed peaks 大量重疊，表示玩家在 flick / micro-adjustment 期間確實有左右移動鍵活動。

目前分析結果：

| Field | Value |
|---|---:|
| Aim duration | 89.131447 s |
| Mouse segment duration | 74.015883 s |
| WASD overlap duration | 53.174828 s |
| Overlap ratio | 59.658886% |
| Gate result | PASS |

解讀：這份資料遠高於 10% 門檻，可以作為 T2 的第一個 movement-aware fixture candidate。

### Negative Control：Spidershot

![Spidershot WASD timeline](../../../research/src/modules/analysis/notebooks/kovaak_scenario_survey/outputs/Spidershot%20-%20Challenge%20-%202026.03.09-13.42.45%20Stats.csv/timeline.png)

Spidershot 是靜態 flick baseline。圖中 mouse speed 有正常 aiming activity，但 W/A/S/D lanes 沒有 held state。

目前分析結果：

| Field | Value |
|---|---:|
| Aim duration | 59.723360 s |
| Mouse segment duration | 41.303971 s |
| WASD overlap duration | 0.000000 s |
| Overlap ratio | 0.000000% |
| Gate result | FAIL / `NO_KEYBOARD_DATA` |

解讀：這是預期結果。它證明 notebook 不會把 mouse-only flick 資料誤判成 movement-aware session。

---

## 4. 指標欄位

Notebook 會在 `report.txt` 輸出下列欄位：

| 欄位 | 意義 | 解讀方式 |
|---|---|---|
| `Status` | schema / keyboard 狀態 | `OK` 可分析；`NO_KEYBOARD_DATA` 表示沒有 keyboardTrace |
| `Aim duration seconds` | raw mouse trace 的總時間跨度 | overlap ratio 的分母 |
| `Mouse segment duration seconds` | primary flick + micro adjustment 的總時長 | aim 行為覆蓋範圍 |
| `WASD overlap seconds` | WASD held interval 和 mouse segment interval 的交集 | T2/T3 可用訊號量 |
| `WASD overlap ratio` | overlap seconds / aim duration | >= 10% 才通過 survey gate |
| `press_count` / `release_count` | 每個 VK 的 action 分布 | 檢查 capture 是否 press/release 不對稱 |
| `events_per_min` | 每分鐘 WASD event 數 | 輔助判讀，不作 pass/fail 主依據 |
| `held_seconds` | 每個 key 的 inferred held duration | 用來看 movement 主要由哪個 key 驅動 |

---

## 5. Notebook 使用方法

從 repo root 執行：

```powershell
python -m research.src.modules.analysis.notebooks.kovaak_scenario_survey.inspect_keyboardtrace `
  --file "test\test_data\Peek and Click - Challenge - 2026.05.20-16.11.07 Stats.csv.json"
```

指定輸出目錄：

```powershell
python -m research.src.modules.analysis.notebooks.kovaak_scenario_survey.inspect_keyboardtrace `
  --file "backend\brain\Peek and Click - Challenge - 2026.05.20-16.11.07 Stats.csv.json" `
  --out "research\src\modules\analysis\notebooks\kovaak_scenario_survey\outputs"
```

輸出位置：

```text
research/src/modules/analysis/notebooks/kovaak_scenario_survey/outputs/<scenario_stem>/
  report.txt
  timeline.png
```

Exit code：

| Code | Meaning |
|---:|---|
| 0 | 分析成功，包含 pass、fail、或 `NO_KEYBOARD_DATA` |
| 1 | 檔案不存在或 schema 不符，例如舊 schema 缺 `rawMouseTrace` / `fusedTrace.segments` |
| 2 | argparse 參數錯誤 |

---

## 6. 實務判讀規則

通過 gate：

- `Status = OK`
- `WASD overlap ratio >= 10%`
- timeline 圖中至少一個 movement key lane 和 mouse speed / segment activity 有可見重疊

不通過 gate：

- `NO_KEYBOARD_DATA`
- `WASD overlap ratio < 10%`
- 只有 keyboard event density，但 held interval 不和 aim segment 重疊

需要人工檢查：

- `press_count` 和 `release_count` 嚴重不對稱。
- 某個 key 的 `held_seconds` 異常接近整段 session。
- timeline 顯示 key held 只發生在開頭或結尾，和主要 aim 區間無關。

目前 `Peek and Click` 的 A/D press/release 不對稱已知存在，但 repeated press 仍形成可解釋的 held intervals；這也是為什麼 report 同時保留 event count、held duration、timeline 圖，而不是只輸出 pass/fail。

