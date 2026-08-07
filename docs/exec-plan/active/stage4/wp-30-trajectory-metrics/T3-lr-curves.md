# T3 — L/R 條件化 101 點正規化曲線(ω(t) / ε(t) 動作簽名)

> Part of [WP-30 trajectory-metrics](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(`curve-v1` pre-registration)。**不依賴 T1/T2** —— 只吃 `build_peek_windows` + ω/ε,可與 T2 並行或提前交付 |
| **Risk / Cplx** | Low / Low |
| **Touches** | ADD `research/src/modules/metrics/algorithms/curves.py` + tests;ADD `notebooks/t3/outputs/`(L/R 疊圖 + 曲線資料);MODIFY `docs/operational/analysis-phase-curves.md`(補 `curve-v1` 段) |
| **狀態** | ⬜ |

## Objective

FR-D12:把既有的 L/R symmetry 標量升級成**動作簽名曲線** —— 每個 peek 的 `[t_visible, t_first_shot]` 區間重採樣成 101 點,逐 side 產生 ω(t) 與 ε(t) 的平均曲線 + 分佈帶 + L/R 疊圖,圖上明示 n(L) / n(R)。

## In scope

- **`normalize_101(values, t, t0, t1, points=101)`**(簽名見 [README.md §5](README.md)):
  - 窗界 = `[t_visible, t_first_shot]`(**OQ-S4-5 已決**,counter-strafe 錨定首發;t_kill 版屬「清目標節奏」,留分析端副版,不在本 task)。
  - 正規化時間 `[0, 1]` 上等距 101 點;插值法於 T0 凍結(建議線性),**只能升版不得原地改**。
  - 退化輸入(樣本 < 2、`t1 <= t0`、全非有限值)一律拋 `ValueError`,由呼叫端轉 flag —— 演算法不吞、不補值。
- **`curve_table` / `curve_summary`**:
  - 每 peek 一列 × `p000..p100`,帶 `peek_index` / `side` / `ads` / `signal`(`omega` | `epsilon`)/ `flags`。
  - ω 來源 = `omega_deg_s(strict=True)`;ε 來源 = `epsilon_deg(..., eye_origin=strict)`。`omega[0] = nan` 契約不變(TD-3),窗內首樣本的處理沿用 D-29.4 的「切尾 + index 映回」模式,**不得**為此改 `omega_deg_s` 契約。
  - 逐 side × signal 的平均曲線 + 分佈帶(`band` 由 T0 凍結:IQR 或 mean±SD)+ `n`;`n` 與圖上標示**同源**(不得圖說一套、表算一套)。
  - 納入規則沿用 D-29.5:值有限且整列 flags 為空才進聚合;被排除列仍完整輸出並計數。
- **flags**(封閉,併入 `analysis-phase-curves.md` 詞彙表):`no_first_shot`(缺窗界終點)、`window_too_short`(窗內 tick < `min_ticks`)、`missing_epsilon`(eye origin 或目標幾何缺席)、`non_uniform_dt`、`degenerate_window`(`t1 <= t0`)。
- **疊圖與產物**(notebooks/t3/outputs/):
  - 三份真實匯出逐 session 的 L/R 疊圖(ω 與 ε 各一組),圖上標 n(L)/n(R) 與排除數。
  - 曲線資料以 deterministic 檔案落盤(供 T-exit 報告與 WP-32 晉升評估引用)。
  - **逐 session 呈現,不跨 session 併池**(三份為同一受試者,但仍為三次獨立 session)。

## Out of scope

- phase 分解(T2)、報告整合(T-exit)、TS 晉升(WP-32)。
- `[t_visible, t_kill]` 副版窗(OQ-S4-5 明列為分析端副版,非本 task)。
- 跨 session / 跨選手聚合(stage4 §2.1 out of scope)。
- 以 08:03 / 09:39 產任何曲線(§0.2 禁用;僅作 strict 閘負向案例)。

## Steps

- [ ] `curves.py`:`CurveParams` / `normalize_101` / `curve_table` / `curve_summary`。
- [ ] 插值單元測試:< 2 樣本、全零、缺值、端點重合(`t1 == t0`)、`t1 < t0`、單調性與端點值(`p000` = t0 樣本、`p100` = t1 樣本)、已知線性斜坡的解析解比對。
- [ ] 納入規則測試:`no_first_shot` / 短窗 / 缺 ε 的 peek 不進聚合分母,且被計數。
- [ ] 三份真實匯出產出逐 side 曲線 + 分佈帶 + 疊圖(ω 與 ε);合成 fixture 跑通(短窗退化路徑)。
- [ ] `curve-v1` 參數與 flags 併入 `analysis-phase-curves.md`(registry + 已知限制)。
- [ ] `uv run pytest` 輸出貼 progress。

## Definition of Done

1. **插值邊界測試綠**:Steps 第 2 點七個情境各有測試,退化輸入拋 `ValueError` 而非回傳補值。
2. **真實曲線產出**:三份真實匯出各產出 L/R 疊圖(ω + ε 共兩組/份),圖上顯示 n(L)、n(R) 與排除數;`n` 與 `curve_summary` 逐位同源(測試斷言)。
3. **`curve-v1` 凍結**:`analysis-phase-curves.md` 含窗界、插值法、`points`、`band`、`min_ticks`、納入規則、flags 詞彙表與 `version`;明文「升版才可改」。
4. **納入規則可稽核**:報告/產物中每條曲線附「納入 n / 排除 n / 排除原因計數」。
5. **合成短窗跑通**:48 ticks / 2 peeks 的合成 fixture 不 crash,退化 peek 標 flag 並被排除。
6. `uv run pytest` exit 0;`algorithms/` 純度測試綠(繪圖只在 notebooks,C-D2);零 `src/` 變更。

## Commit

`feat(wp-30): T3 L/R 101 點正規化曲線(curve-v1)+ 逐 side 平均與分佈帶`
