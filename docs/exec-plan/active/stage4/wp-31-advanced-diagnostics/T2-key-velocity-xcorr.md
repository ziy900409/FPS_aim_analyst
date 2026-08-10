# T2 — Key-Velocity Coupling xcorr + `gate-v1` 明確判定

> Part of [WP-31 advanced-diagnostics](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(`xcorr-v1` + `gate-v1` 凍結;含 seed)。**不依賴 T1/T3** |
| **Risk / Cplx** | **Med** / Med(演算法不難;難在判定的誠實度) |
| **對應 FR** | FR-D14 |
| **Touches** | `research/src/modules/metrics/algorithms/coupling.py`(ADD)· `.../algorithms/tests/test_coupling*.py`(ADD)· `research/src/modules/metrics/notebooks/t2/`(ADD)· `docs/operational/analysis-advanced-diagnostics.md`(MODIFY) |
| **狀態** | ⬜ |

## Objective

量測「A/D 鍵狀態」與「視角角速度 ω(t)」之間的 lagged 耦合(strafe-aim 干擾),並讓它通過 **T0 凍結的 `gate-v1`** 得到一個**明確且事前定義**的判定。

這是 stage4 最有原創價值、也是**構念最未驗證**的指標([../README.md §0.0](../README.md) P2-2)。本 task 成功的定義不是「r 很高」,而是「判定過程無法被結果污染」。

## In scope

### ① key-state 與 ω 的對齊(免對時)

- `key_state_signed(ticks)`:`ticks[].keys` → `D` = +1、`A` = −1、**同時按或都沒按** = 0。與 ω 天然同格(128Hz tick 網格),**不需要**任何時鐘對齊(這正是本專案相對 performance_analysis 免費的一層,[../README.md §2.4e](../README.md))。
- ω 取自 `omega_deg_s(window, strict=True)`;沿用 `omega[0] = nan` 契約與 `_OMEGA_INDEX_OFFSET` 的「切尾 + index 映回」模式(D-29.4)。
- **`key` 事件僅作交叉檢核**:斷言 tick-derived state 的轉換點與 WP-29 T3 的 `key` 事件序列不矛盾(容差 ±1 tick);矛盾 → 標 flag 並記 progress,**不**改用事件作主資料源(§0.6)。
- **只做 ω 通道**:階段 A 二元速度使 `vx` 通道退化([../README.md §7](../README.md) 技術債②)。

### ② 逐 peek xcorr

- 窗 = `build_peek_windows` 的 peek 窗(`timeline-v1`),**不重新定義窗界**。
- lag 範圍 `[−max_lag_ms, +max_lag_ms]`(`xcorr-v1` 凍結);慣例沿用 performance_analysis:**負 lag = key 領先 ω,正 lag = ω 領先 key**(此句必須進文件,否則符號會被讀反)。
- 逐 lag 算 signed Pearson r;peak 取 **|r| 最大**者,同分時取 **|lag| 較小**者(逐位沿用 PA 的 tie-break)。
- 保留完整 correlogram 供報告繪圖。
- 退化語意:`key_state` 標準差為 0 → `key_state_constant` flag;ω 標準差為 0 → `omega_constant`;窗內 tick < `min_ticks` → `window_too_short`。三者一律**排除聚合、不補 0、不吞成 NaN**。

### ③ `gate-v1` 三件組(逐 session 執行,不跨 session 併池)

| # | 實作要點 |
|---|---|
| ① shuffle null | 逐 peek 對 `key_state` 作**循環位移**(circular shift),位移量自 `rng` 取樣且**避開 0 與 ±全長**;重算 peak strength → session 級統計量;重複 `shuffle_iters` 次構成 null 分佈;`p` = null 中 ≥ 觀測值的比例(單尾,對 \|peak strength\|) |
| ② bootstrap CI | 逐 session 對 peek **有放回**重抽 `bootstrap_iters` 次,取 session 級統計量的 95% percentile CI;比對 `ci_width_max` |
| ③ 奇偶半分 | 同 session 內奇數 / 偶數 `peek_index` 各算一次 session 級統計量;\|Δ\| 須落在 ② 的 CI 寬度內 |

- **RNG**:`np.random.default_rng(thresholds.seed)`,seed 來自 T0 凍結;同一輸入 → 同一 `GateVerdict`(以測試斷言兩次呼叫逐位相同)。
- **三分支判定**沿用 T0 凍結:`blocked-by-data`(任一 session 有效 n < `min_samples`)/ `research_only`(①②③ 任一未過)/ `research_only` + 「訊號非偶然且估計穩定」註記(全過)。
- **上限條款**:`coach_report` 在本樣本結構下**不可達**(T0 已凍結)。`reliability_gate` 必須以**程式碼**保證這一點(而非文件自律):實作上不得有任何輸入路徑回傳 `'coach_report'`,並以測試斷言之。

### ④ 合成訊號驗證(演算法正確性,與效度判定分離)

| 合成案例 | 期望 |
|---|---|
| key-state 與 ω 以已知 lag(例如 +8 tick)構造 | `peak_lag_ms` ≈ 8 × 7.8125 ms(±1 tick),符號方向正確 |
| 完全無耦合(獨立雜訊) | shuffle `p` **不顯著**(斷言 gate 不會對雜訊發出「非偶然」) |
| key-state 恆定 | `key_state_constant` flag + 排除聚合 |
| 窗長 < `min_ticks` | `window_too_short` flag |

第二列是本 task 的**反向對照**:一個會對純雜訊判「通過」的 gate 沒有價值。

### ⑤ 文件

`analysis-advanced-diagnostics.md` 增 `xcorr-v1` 與 `gate-v1` 段落:定義、lag 符號慣例、封閉 flags、三件組操作化、凍結值與 seed、**上限條款逐字**、當次判定與證據連結。

## Out of scope

- 依結果調整 `gate-v1` 任一門檻或 seed(要調一律升 `gate-v2` + 全鏈重跑 + 入 [DECISIONS.md](../../../DECISIONS.md))。
- `vx` 通道 / `projected_target` 通道(階段 A 退化 / 需目標 metadata)。
- 跨 session 併池的 gate 判定(逐 session 執行;跨 session 推論 out of scope)。
- 把 xcorr 放進教練報告主表(C-D3 + 上限條款)。
- 任何 `src/` 變更。

## Steps

- [ ] 實作 `key_state_signed` + 單元測試(`A`/`D`/`A+D`/空 四種 tick 狀態)。
- [ ] 實作 `key_velocity_xcorr`(逐 lag Pearson + tie-break)+ 已知 lag 合成測試。
- [ ] 實作 `xcorr_table`(逐 peek;flags 封閉詞彙表自我斷言)。
- [ ] 實作 `reliability_gate` 三件組(seeded RNG)+ 決定性測試(兩次呼叫逐位相同)。
- [ ] 寫「純雜訊 → p 不顯著」反向對照測試 + 「`coach_report` 不可達」斷言測試。
- [ ] 對三份真實 fixture 逐 session 跑 gate,產出 `GateVerdict` 表 + correlogram 圖(`notebooks/t2/outputs/`)。
- [ ] `key` 事件交叉檢核(±1 tick),結果記 progress。
- [ ] `algorithms/` 純度測試;更新 `analysis-advanced-diagnostics.md`、[progress.md](progress.md)、[task-checklist.md](task-checklist.md)。

## Definition of Done

1. **合成正確性四案例綠**,其中「已知 lag → 回推 lag 誤差 ≤ 1 tick」與「純雜訊 → shuffle p 不顯著」兩項為必要條件。
2. **決定性**:同一輸入 + 同一 `GateThresholds` 連續兩次呼叫 `reliability_gate`,`GateVerdict` 全欄位逐位相同(測試斷言)。
3. **`coach_report` 不可達**由測試斷言(窮舉 verdict 取值路徑或以 property 測試證明無輸入可產生該值)。
4. **逐 session `GateVerdict` 已產出且為明確三分支之一**,每份含 `n` / `observed` / `shuffle_p` / CI 上下界與寬度 / `half_delta` / `half_within_ci` / `reason`;**三份 session 的判定與證據全部寫入 progress**。
5. **判定未被結果污染的證據**:progress 明記 `gate-v1` 凍結時點(T0 commit hash)早於本 task 的第一次真實資料執行;若過程中發現門檻不合適,**記錄但不修改**,以 OQ 帶到下一版。
6. flags 封閉詞彙表由演算法自我斷言;帶 flag 的 peek 不進聚合分母(測試斷言)。
7. `key` 事件交叉檢核結果已記(相符 / 不符的 peek 數與原因);不符不阻塞,但須解釋。
8. `uv run pytest` 全綠(貼輸出計數)+ `npm run test:ci` exit 0 且 **`src/` 與 `tests/` 零 diff**。
9. `analysis-advanced-diagnostics.md` 含 `xcorr-v1` + `gate-v1` registry,**上限條款逐字**(「不證明個體差異可靠度;本樣本結構下最高 `research_only`」)。

## Commit

`feat(wp-31): T2 Key-Velocity xcorr(xcorr-v1)+ gate-v1 三件組 reliability 判定(逐 session,seeded)`
