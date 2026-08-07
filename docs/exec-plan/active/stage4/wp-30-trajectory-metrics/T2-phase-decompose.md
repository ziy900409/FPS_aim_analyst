# T2 — REC/MR/V phase 分解 + `phase-v1` 掃參凍結 + REC-end vs t_detect 一致性檢查

> Part of [WP-30 trajectory-metrics](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1(t_detect 對表綠或明確 `blocked-by-data`)+ T0(pre-registration) |
| **Risk / Cplx** | **Med** / Med — D-30.1 拍板複用 `seg-v2` 後,C-D4 風險已由設計消除;剩下的主要風險是 **② 參數若只在合成資料上凍結,就是重演 `seg-v1`**,以及實作時「順手加一個閾值」把第二定義偷渡回來 |
| **Touches** | ADD `research/src/modules/metrics/algorithms/phase.py` + tests;ADD `notebooks/t2/outputs/`(掃參證據 + 分佈報告 + 疊圖);ADD `docs/operational/analysis-phase-curves.md`(建立) |
| **狀態** | ⬜ |

## Objective

FR-D11:回答教練「**慢在哪一段**」—— 把每個 peek 從 `t_visible` 到首發之間切成 **REC(反應期)/ MR(主運動期)/ V(驗證期)** 三段,輸出三段時長 + peak ω + flags,並用 T1 的 `t_detect` 對 REC 邊界做**一致性檢查**(檢查,不是改寫:t_detect 不參與邊界決定)。

## In scope

- **`phase.py`**(簽名見 [README.md §5](README.md)),邊界定義**已於 D-30.1 拍板,本 task 不得改動**:
  - `MR = seg-v2 primary_flick` 起訖;`REC = [t_visible, MR.start)`;`V = [MR.end, t_first_shot]`。
  - **Butterworth 僅作報告用平滑,不產生第二套運動起點**(C-D4)。因此本 task **不含**任何運動起點偵測邏輯 —— 若實作過程中出現「這裡需要自己判斷動作何時開始」的需求,那是設計走偏的訊號,應停手回頭確認,而不是就地加一個閾值。
  - 多 segment 的 peek 依 **D-30.1b**(T0 以真實資料拍板)取 MR;該規則寫入 `analysis-phase-curves.md` 並凍結。
  - 測試須斷言 MR 起訖**逐位等於**所選 `Segment` 的 `start_idx`/`end_idx`(映回 tick frame 後),不得有任何偏移或再平滑。
  - `peak_omega_deg_s` 取 MR 段內 ω 峰值(來源 = `omega_deg_s(strict=True)`,`tick-integral`)。
  - `t_detect` 與 `rec_minus_detect_ms` 逐 peek 帶出;`t_detect` 為 `None` / `timeout` 時該欄為 `None` + flag,**不影響三段邊界**。
- **`phase-v1` 掃參與凍結**(沿用 `seg-v2` 的雙維度模式,[analysis-segments.md](../../../operational/analysis-segments.md) 先例):
  - 維度一 = 合成 fixture 的已知相位邊界誤差 ≤ 2 tick(通過條件,T0 已 pre-register)。
  - 維度二 = 三份真實匯出的第二評分指標(如三段皆非退化的 peek 佔比 / flag 率),**合成單獨通過不得凍結**。
  - 凍結後寫入 `analysis-phase-curves.md` 的 frozen parameter registry,帶 `version = phase-v1`;改任何數值一律升版 + 全鏈重跑。
- **退化處理(不得 crash)**:
  - `cutoff_hz ≥ Nyquist`、樣本數 ≤ `filtfilt` padlen → [`butter_filter`](../../../../../research/src/shared/filters/butter.py) 拋 `ValueError` → 接住轉 `filter_degenerate` flag + fallback(未濾波值),該列排除聚合。
  - 窗內 tick 數 < `min_window_ticks` → `window_too_short`;無 primary_flick → `no_primary_flick`;缺 `t_first_shot` → `no_first_shot`(沿用 peek flag),V 段為 `None`。
  - `t_first_shot` 早於 MR 起點等順序退化 → `anchor_before_onset`,三段值為 `None`,不硬給負值。
  - 窗內含 dt gap → `non_uniform_dt`(沿用 [run_pipeline.py](../../../../../research/src/report/run_pipeline.py) 的逐窗歸屬,不用全域報告一竿子打翻)。
  - **合成 fixture(48 ticks / 2 peeks)是天然短窗案例,必須是必跑回歸,不是「已知不支援」。**
- **flags 封閉詞彙表**:比照 [`KNOWN_PEEK_FLAGS`](../../../../../research/src/modules/metrics/algorithms/peek.py) 的自我斷言紀律(未知 flag 直接 `AssertionError`)。
- **一致性檢查與分佈報告**(notebooks/t2/outputs/):
  - 三份真實匯出的三段時長分佈(逐 session 呈現 n 與分佈,**不跨 session 併池**)。
  - `rec_minus_detect_ms` 分佈;系統性分歧(如中位數偏移遠大於 1 tick)→ 記 OQ 並在文件標明,**不得**私下調 REC 定義去對齊 t_detect。
  - T1 若判 `blocked-by-data`,本檢查明確輸出 `blocked-by-data` 並引用 OQ-S4-15。
  - 疊圖:ω(t) + 三段著色 + t_detect 標記,逐 peek 可視覆核(A2-T2 的教訓:聚合數字不能取代疊圖)。
- **聚合納入規則**:沿用 D-29.5 —— 值有限**且**整列 flags 為空才進 `n` 與分佈;被排除列仍完整輸出。

## Out of scope

- 101 點曲線(T3)、報告整合(T-exit)。
- 調整 `seg-v2` 任何參數,或以 phase 的掃參結果回頭改分段(D-28.7:凍結值只能升版)。
- 調整 t_detect 參數(T1 out of scope 同樣適用)。
- 跨 session 併池統計或訓練效果推論。

## Steps

- [ ] `phase.py`:`PhaseParams` / `PhaseSample` / `phase_decompose` / `phase_table`(邊界依 T0 拍板)。
- [ ] 單元測試:已知合成相位邊界(誤差 ≤ 2 tick)、無 primary_flick、缺 first shot、短窗、`cutoff ≥ Nyquist`、`anchor_before_onset`、含 dt gap、未知 flag 斷言。
- [ ] 掃參:合成通過條件 + 三份真實第二維度;候選比較表 + 疊圖存 `notebooks/t2/outputs/`。
- [ ] 凍結 `phase-v1` 並寫入 `analysis-phase-curves.md`(registry + flags 詞彙表 + 已知限制)。
- [ ] 三份真實匯出的三段分佈報告 + `rec_minus_detect_ms` 分佈報告(逐 session)。
- [ ] 疊圖人工覆核(ω + 三段 + t_detect);覆核結論與異常樣本記 progress。
- [ ] `uv run pytest` 輸出貼 progress;確認 `npm run test:ci` 未受影響(本 task 不動 TS)。

## Definition of Done

1. **合成邊界綠**:已知相位邊界的合成 fixture,三段邊界誤差 ≤ 2 tick(逐案例數字入 progress)。
2. **`phase-v1` 凍結且雙維度**:progress 含掃參候選比較表,明示合成通過條件**與**三份真實匯出的第二維度數字;`analysis-phase-curves.md` 的 registry 列含全部參數值 + version;明文「改任何值須升版 + 全鏈重跑」。
3. **退化不 crash**:Steps 第 2 點八個情境各有測試;`cutoff ≥ Nyquist` 與短窗案例回傳 flag + fallback 而非例外向上傳播;合成 fixture(48 ticks)整份跑通。
4. **一致性檢查有明確判定**:`rec_minus_detect_ms` 分佈報告產出,並給出三選一結論 ——「一致(分佈落在 pre-registered 範圍)」/「系統性分歧(記 OQ + 文件標註)」/「`blocked-by-data`(引用 OQ-S4-15)」。**不得**以「大致相符」收尾。
5. **C-D4 無第二定義**:測試斷言 MR 邊界**逐位等於**所選 `Segment` 的起訖(映回 tick frame 後);`phase.py` 內零運動起點偵測邏輯(以程式碼檢視 + 測試佐證,Butterworth 只出現在平滑/報告路徑)。
6. **疊圖覆核證據**:三份真實匯出各產出逐 peek 疊圖,覆核結論(含異常樣本清單)記 progress。
7. `uv run pytest` exit 0;`algorithms/` 純度測試綠(繪圖只在 notebooks);零 `src/` 變更;零凍結參數變更。

## Commit

`feat(wp-30): T2 REC/MR/V phase 分解 + phase-v1 雙維度掃參凍結 + REC-end vs t_detect 一致性檢查`
