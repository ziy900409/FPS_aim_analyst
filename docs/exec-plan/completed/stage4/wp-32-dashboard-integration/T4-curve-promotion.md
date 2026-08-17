# T4 — 逐 tick ε 抽出 + `curve-v1` 101 點 L/R 曲線晉升 + golden

> Part of [WP-32 dashboard-integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1(ω);**不依賴 T2/T3**,可與 T2 並行 |
| **Risk / Cplx** | Med / Low–Med — 演算法是線性插值,風險在**逐 tick ε 的來源**:再算一次就違反 C-D4 |
| **Touches** | **MODIFY** `src/metrics/trackingDerivation.ts`(逐 tick ε 抽為可複用,零語意變更);MODIFY `src/metrics/researchMetrics.ts`(curve 區塊);ADD `research/fixtures/golden/curve-*.json` + 產生腳本;ADD `tests/golden/research/promoted-curve.test.ts` |
| **狀態** | ✅ |

## Objective

FR-D17 的主體第二半:把 `curve-v1`(L/R 條件化 101 點正規化曲線)晉升。這是三個晉升項裡唯一有「圖形」性質的,也是結果頁最能一眼看出動作簽名差異的區塊。

## In scope

### ① 逐 tick ε 抽出(零語意變更)

[trackingDerivation.ts](../../../../../src/metrics/trackingDerivation.ts) 的私有 `trackingSamples()` 已逐 tick 產出 `{t, onTarget, epsilonDeg}`,且 `eyeOrigin`/hitbox/fallback target 的解析全在其中(KI-004 S1 後的權威實作)。

- 把該路徑抽為可複用的 export(例如 `deriveTrackingSamples(payload, options)` 回傳逐 presentation 的樣本序列),**邏輯逐行搬移**;
- `deriveTrackingMetrics` 改為呼叫它,輸出**逐位不變**;
- **禁止**在 `researchMetrics.ts` 以 `eyeOrigin.ts` 另組一套 ε 幾何(C-D4)。

> ⚠️ 判準同 T3:`trackingDerivation.test.ts`、`epsilon-parity.test.ts`、`epsilon-closed-form-geometry.test.ts`、`epsilon-offsetdeg-oracle.test.ts` **零修改**全綠。

### ② `curve-v1` 晉升

逐位對齊 [curves.py](../../../../../research/src/modules/metrics/algorithms/curves.py):

- 窗 = **`[t_visible, t_firstShot]`**(OQ-S4-5 決議),不是整個 peek 窗;無 first shot → 該 peek 排除並記 flag。
- `CurveParams` 逐欄沿用:`points=101`、`min_ticks=3`、`band='iqr'`、`curve-v1`。窗內有限樣本數 < `min_ticks` → 排除並記 flag。
- `normalize101(values, t, t0, t1)`:
  - 先以 `isFinite(values) && isFinite(t)` 建 mask 丟掉非有限樣本(ω 的 index 0 `NaN` 由此自然消失 —— **不要**另外切頭,否則與 Python 的 mask 語意分岔);
  - 依 `t` **stable sort**;
  - `fractions = linspace(0,1,101)`、`targets = t0 + frac·(t1−t0)`;
  - 線性插值(等同 `np.interp`,含超出範圍取端值的行為);
  - 退化輸入(有限樣本 < 2、`t1 <= t0`)→ **throw**,由呼叫端轉成 flag(與 Python 一致,不回傳猜測曲線)。
- 兩個訊號:ω(t)(T1)與 ε(t)(①);兩個 side:L / R。
- 聚合:逐點 `mean` + IQR 帶(`lower` = Q1、`upper` = Q3);分位數定義**必須與 Python 的 `np.percentile` 預設(linear 插值)一致**,並與 `compute.ts` `stat()` 的 `p50` 線性插值慣例相容。
- 輸出帶 `n(L)` / `n(R)`(進聚合的 peek 數)。

### ③ golden 與對表

- `curve-<fixture>.json`:三份真實(09:18/09:24/09:37)+ 合成;存 ω/ε × L/R 各 `mean`/`lower`/`upper`(各 101 點)+ `n`。
- **不存逐 tick 原始序列**(README §3 的體積控制)。
- 對表:101 點**逐點** ≤1e-9;`n(L)`/`n(R)` 逐位相等;排除規則(哪些 peek 進聚合)以 `n` 與 flag 計數間接釘死。

## Out of scope

- phase / sync(T3)、結果頁呈現形式(T5;OQ-S4-23)。
- 改動 `curve-v1` 參數或窗錨(OQ-S4-5 已決)。
- 逐 tick 曲線資料進 golden 或進結果頁狀態(只傳聚合後的 101 點)。
- 改動 `deriveTrackingMetrics` 的任何公開輸出。

## Steps

- [x] 抽出 `trackingSamples` → 可複用 export;**先跑既有四支 ε 相關測試確認零修改全綠**再往下做。
- [x] `researchMetrics.ts`:`normalize101` + L/R 聚合 + IQR 帶。
- [x] TS 單元測試:`normalize101` 的已知答案案例(線性斜坡 → 線性輸出)、端點行為、退化輸入拋錯、非有限樣本被 mask 掉。
- [x] TS 單元測試:短窗排除(合成 fixture 的 13-tick peek 必須**仍產生曲線**,`min_ticks=3` 的用意;1–2 tick 才排除)。
- [x] Python:`curve-*.json` 產生腳本(notebooks)。
- [x] `promoted-curve.test.ts` 對表。
- [x] 兩閘輸出貼 progress。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | **抽出零漂移** | `trackingDerivation.test.ts` / `epsilon-parity.test.ts` / `epsilon-closed-form-geometry.test.ts` / `epsilon-offsetdeg-oracle.test.ts` **零修改**全綠 |
| ② | **101 點逐點對表 ≤1e-9** | 四份 fixture × 2 訊號(ω/ε)× 2 side × 3 條線(mean/lower/upper)= 每份 12 條 × 101 點全比對 |
| ③ | **反 vacuous** | 三份真實 fixture 各斷言 `n(L) = n(R) = 10`、零排除(與 WP-30 T3 記錄一致);若不符即停手查明,**不得改期望值** |
| ④ | **C-D4 機械證據** | 測試斷言 curve 用的逐 tick ε 與 `deriveTrackingMetrics` 同源(同一 payload 下,抽出的樣本序列可重建既有的 `rmsEpsilonDeg`/`medianEpsilonDeg`/`p95EpsilonDeg` ≤1e-9);`researchMetrics.ts` 未 import `eyeOrigin.ts` |
| ⑤ | **短窗規則一致** | 合成 fixture 的 13-tick peek 產生曲線;人造 2-tick 窗被排除且記 flag(兩側行為與 Python 相同) |
| ⑥ | **既有測試零修改全綠** | `npm run test:ci` exit 0 |
| ⑦ | **research 閘綠** | `uv run pytest` exit 0;`algorithms/` 純度測試仍綠 |

## Commit

`feat(wp-32): T4 逐 tick ε 抽為可複用(零語意變更)+ curve-v1 101 點 L/R 晉升 TS + golden 逐點對表(≤1e-9)`
