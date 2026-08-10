# T3 — Fitts:ID / MT / TP + ID–MT 回歸 + `blocked-by-data` 判準

> Part of [WP-31 advanced-diagnostics](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(`fitts-v1` 凍結)。**不依賴 T1/T2** |
| **Risk / Cplx** | Low / Low(方法學成熟;風險全在**解讀**而非實作) |
| **對應 FR** | FR-D15 |
| **Touches** | `research/src/modules/metrics/algorithms/fitts.py`(ADD)· `.../algorithms/tests/test_fitts*.py`(ADD)· `research/src/modules/metrics/notebooks/t3/`(ADD)· `docs/operational/analysis-advanced-diagnostics.md`(MODIFY) |
| **狀態** | ⬜ |

## Objective

逐 peek 算 `ID = log₂(1 + D/W)` 與 `MT`,回歸出 slope / intercept / r² / TP,並且**在報告裡把這份回歸的限制講清楚到不會被誤讀**。

規劃期實測 D 跨度 8.70°–30.72°(≈3.5×,n=60)已滿足 [../README.md §2.1](../README.md) 的變異門檻 → **預期不落 `blocked-by-data`**;該分支仍實作並由 `fitts-v1` 判準把關(未來換 drill / 換 fixture 時它才是真的閘)。

## In scope

### ① 幾何量(單一來源,零新常數)

| 量 | 取法 | 來源紀律 |
|---|---|---|
| **D**(spawn 偏心角) | `visible` 事件的 `targetX/Y/Z` 與 **aim@`t_visible`** 的夾角 | 與 WP-30 T1 `eccentricity_at_spawn_deg` **同義**;優先直接重用 [detect.py](../../../../../research/src/modules/metrics/algorithms/detect.py) 的既有推導,**不得**另寫一份(C-D4) |
| **W**(目標角尺寸) | `meta.targets.hitbox.widthU` 與 eye→target 距離推導的**水平角寬**;hitbox 缺席 → H1 `{1,2,1}` fallback | **GD-7 hitbox 單一來源**;不得新增尺寸常數或閾值 |
| eye origin | `resolve_eye_origin(meta, strict=True)` | §0.1 機械閘;legacy 匯出拋錯 |
| **MT** | `t_first_shot − t_visible`(`timeline-v1` 的錨點) | 窗界與錨點不重新定義 |

- `ID = log₂(1 + D/W)`(Shannon 形式)。
- `TP = 1 / slope`(slope 單位 ms/bit → TP 轉為 bits/s)。
- 退化語意:`no_first_shot`(無首發 → 無 MT)、`degenerate_geometry`(D 或 W 非有限 / W ≤ 0)一律標 flag 並排除聚合。

### ② 回歸與 `blocked-by-data` 判準(`fitts-v1`,T0 凍結)

依序檢查,任一不過即 `status = 'blocked-by-data'` 並填 `reason`:

1. 有效樣本數 ≥ `min_samples`;
2. `d_ratio = max(D)/min(D)` ≥ `min_d_ratio`;
3. `id_range_bits = max(ID) − min(ID)` ≥ `min_id_range_bits`。

通過 → 最小平方回歸 `MT = a + b·ID`,輸出 `slope` / `intercept` / `r²` / `TP` / `n`。

**`blocked-by-data` 時不得硬給結論**:`slope`/`r²`/`TP` 一律 `None`,`reason` 說明是哪一條未過與實際數值。

### ③ 兩項限制必須進文件與報告(不是備註,是欄位)

1. **D 是內生的**。目標只在兩個固定位置((±2, 1.5, −4))出現;D 的變異幾乎全部來自「上一個 peek 結束時準星被留在哪」。這是**觀察性相關**,不是 Fitts 典範的受控操弄;D 與前一 peek 的過衝/修正行為共變。
2. **MT 含反應時間與 counter-strafe 停止時間**。回歸截距 `a` 會吸收 RT + 急停;`t_detect` 在 counter-strafe drill 上只有 5–9/20 的 peek 有值(WP-30 T1 實測),**不足以**做逐 peek 的 RT 扣除,故本版**不做** RT 校正。

兩句話在報告與 `analysis-advanced-diagnostics.md` 逐字出現,並在報告的效度層級欄標「觀察性、非受控設計」。

### ④ 已知幾何 fixture

構造已知答案的合成案例(可用 `synthetic_counterstrafe.json` 或就地組 payload):給定 eye、target、hitbox 與 aim,**手算** D 與 W,斷言實作值相對誤差 ≤ 1e-9;另含 W 缺席 → H1 fallback、`no_first_shot`、W ≤ 0 三個退化案例。

### ⑤ 逐 side / 逐 session 呈現

三份真實 fixture **逐 session** 輸出回歸與散點圖(`notebooks/t3/outputs/`),另附逐 side(L/R)分層;**不跨 session 併池**(沿用 WP-30 紀律)。若逐 session 的 n 不足 `min_samples`,pooled 版本可另外呈現但須明標「跨 session 併池,僅供探索」。

## Out of scope

- **RT 校正的 MT**(`MT = t_first_shot − t_detect`):樣本不足(§③-2);要做須先解 OQ-S4-17 並有足夠 `detected` 樣本。
- **頭/身分解的 W**(CONTEXT 既有延後項)。
- **velocity scaling 回歸**(peak ω vs D)——[../README.md §2.1](../README.md) 的獨立 out-of-scope 項,觸發條件另計。
- 在 drill 端隨機化 spawn 偏心以取得受控 D(屬新 WP / 新錄製,見 OQ-S4-19)。
- 任何 `src/` 變更。

## Steps

- [ ] 盤點 `detect.py` 的 `eccentricity_at_spawn_deg` 推導是否可直接重用;可 → 重用並在 progress 記證據,否 → 記錄差異與理由(不得靜默各算一套)。
- [ ] 實作 W 的角寬推導(hitbox 單一來源 + H1 fallback)+ 已知幾何測試(≤1e-9)。
- [ ] 實作 `fitts_samples`(ID/MT/flags)+ 退化案例測試。
- [ ] 實作 `blocked-by-data` 三條判準 + 測試(人工構造 D 變異不足 / n 不足 / ID 跨度不足 三種輸入,各自回傳正確 `reason`)。
- [ ] 實作回歸(slope/intercept/r²/TP)+ 已知線性資料的回歸測試。
- [ ] 三份真實 fixture 逐 session 跑,產散點圖 + 回歸表;記 `d_ratio` / `id_range_bits` / `r²` 實際值。
- [ ] `algorithms/` 純度測試;更新 `analysis-advanced-diagnostics.md`、[progress.md](progress.md)、[task-checklist.md](task-checklist.md)。

## Definition of Done

1. **已知幾何 fixture 綠**:D 與 W 相對誤差 ≤ 1e-9;W 缺席 → H1 `{1,2,1}` fallback 與既有推導同源(測試斷言,不是文件宣稱)。
2. **`blocked-by-data` 三條判準各有一個觸發測試**,且 `reason` 指出是哪一條與實際數值;觸發時 `slope`/`r²`/`TP` 均為 `None`。
3. **三份真實 fixture 逐 session 的 Fitts 結果已產出**,每份含 `n` / `d_ratio` / `id_range_bits` / `slope` / `intercept` / `r²` / `TP` / `status`;規劃期預期 `status = 'ok'`(D 跨度 3.5×),**若實測落 `blocked-by-data` 則照實輸出並開 OQ,不得放寬判準**。
4. **兩項限制逐字出現**在 `analysis-advanced-diagnostics.md` 與報告輸出的效度層級欄(D 內生性、MT 含 RT/急停)。
5. flags 封閉詞彙表由演算法自我斷言;帶 flag 的 peek 不進回歸樣本(測試斷言)。
6. `uv run pytest` 全綠(貼輸出計數)+ `npm run test:ci` exit 0 且 **`src/` 與 `tests/` 零 diff**。
7. `analysis-advanced-diagnostics.md` 含 `fitts-v1` registry(定義 / 參數 / W 來源 / flags / 判準 / 限制)。

## Commit

`feat(wp-31): T3 Fitts ID/MT/TP(fitts-v1)+ blocked-by-data 判準 + D 內生性與 MT 含 RT 的限制聲明`
