# T2 — TS `seg-v2` submovement 分段移植 + segment golden(index 逐位相等)

> Part of [WP-32 dashboard-integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1(ω + SG) |
| **Risk / Cplx** | **High** / Med — 風險在**離散決策點**(`find_peaks` 的 plateau 規則、邊界 walk 的嚴格不等號、merge 順序),差一個 index = 差 7.8125ms,且相對容差抓不到 |
| **Touches** | ADD `src/metrics/submovement.ts` + `.test.ts`;ADD `research/fixtures/golden/segments-*.json` + 產生腳本;MODIFY `tests/golden/research/promoted-kinematics.test.ts` 或 ADD `promoted-segments.test.ts` |
| **狀態** | ⬜ |

## Objective

把 [`segment_submovements`](../../../../../research/src/modules/segments/algorithms/submovement.py) 的 `seg-v2` 實例逐位移植到 TS。這是 `phase-v1` 晉升的唯一前置(MR = 逐 peek 窗內第一個 `primary_flick`,D-30.1),也是本 WP 最容易「看起來對、其實差一格」的地方。

## In scope

### `src/metrics/submovement.ts` —— 逐位移植清單

依 Python 原始碼的執行順序移植,**每一步都要能指回原始碼行**:

| # | Python 行為 | TS 移植注意 |
|---|---|---|
| 1 | `values.size == 0` → `SegmentList(flags=('empty_signal',))` | 空輸入回 `{segments:[], traceFlags:['empty_signal']}`,不 throw |
| 2 | `_prepare_signal`:全非有限 → 全零 + `non_finite_replaced`;部分非有限 → `np.interp` 線性補 + 首尾外側補 0 + `clip(0,None)` + `non_finite_interpolated` | `np.interp` 的**端點行為**(超出範圍取端值)須逐位重現;但此處先把首尾外側顯式歸零,故實際只需內插區間 |
| 3 | `if not np.any(clean > 0)` → `zero_motion` + `below_floor` | 注意是 `> 0`(嚴格),不是 `>= 0` |
| 4 | `clean.size < sg_window` → 不平滑 + `sg_fallback_short_signal` | 短窗 fallback 必須保留(合成 fixture 會踩到) |
| 5 | `sg_filter(clean, 11, 3)` 後 `np.clip(smoothed, 0, None)` | 用 T1 的 `sgSmooth(values, SG_SEG_V2)`;**clip 在平滑之後**,順序不可換 |
| 6 | `threshold = max(mean + 0.75·std, 60.0)` | `std` = **母體標準差(ddof=0)**;`mean`/`std` 在 clip **之後**的 `smoothed` 上算 |
| 7 | `find_peaks(smoothed)`(**無任何 kwargs**)→ 再以 `smoothed[i] >= threshold` 過濾 | 見下方「plateau 規則」 |
| 8 | 無 peak → `below_floor`(當 `max(smoothed) < peak_floor`)否則 `no_peak` | 兩個 flag 的分支條件不可互換 |
| 9 | `_candidate`:自 peak 往左 `while start > 0 and smoothed[start] > low·peak: start--`;若停在 0 且仍 `> low·peak` → `truncated_at_window_edge`。往右同理用 `stop_ratio` | **嚴格 `>`**;邊界 inclusive;左右各自獨立 |
| 10 | `_merge_overlapping(candidates)` | 依 Python 實作的合併順序與 flag 聯集規則逐位移植(移植前先讀完該函式) |
| 11 | `kind = 'primary_flick' if index == 0 else 'micro_adjustment'` | **第一個 merged candidate 才是 primary**,不是峰值最大的那個 |
| 12 | `flags=tuple(sorted(candidate.flags))` | TS 側同樣**排序後**輸出,否則 golden 比對會因順序假紅 |

### plateau 規則(本 task 的頭號 hazard)

scipy `find_peaks` 無 kwargs 時走 `_local_maxima_1d`:嚴格大於左鄰、大於等於右鄰的平頂(plateau)取 **`(leftEdge + rightEdge) // 2`**(整數除法,偏左)。TS 必須逐位重現,且**合成 fixture 必須包含**:
- 單樣本尖峰;
- 偶數長度平頂(驗 `//2` 偏左);
- 奇數長度平頂;
- 訊號首/尾的平頂(scipy 不把端點算作 peak);
- 兩個相鄰峰導致 candidate 區間重疊(驗第 10 步 merge)。

### golden 與對表

- `segments-<fixture>.json`:三份真實 + 合成,**逐 peek** 存 `[{peekIndex, segments:[{kind,startIdx,endIdx,peakOmega,flags}], traceFlags}]`。
  - 逐 peek 的切法必須與 [sweep_phase_params.py `_dimension_two`](../../../../../research/src/modules/metrics/notebooks/t2/sweep_phase_params.py) 一致:窗內 ticks → `omega_deg_s(strict=True)` → `segment_submovements(omega[1:], SEG_V2_PARAMS)` → **index +1 映回 tick frame**。TS 側必須採同一 offset 慣例,並在 golden 中明記 `indexFrame: 'tick'`。
- 對表:`kind` / `startIdx` / `endIdx` / `flags` / `traceFlags` **逐位相等**(P3 第三級);`peakOmega` ≤1e-9。

## Out of scope

- phase / sync / curve(T3/T4)、結果頁(T5)。
- `seg-v1`(README §1)、參數掃描(上游已凍結,D-28.7 / KI-005-A A2-T3)。
- 改動任何既有 `src/` 檔。

## Steps

- [ ] 先完整讀 `submovement.py` 的 `_merge_overlapping` 與 `_candidate`(本 task 唯一需要開的 Python 原始檔),把行為抄成 TS 前先在 progress 記下 12 步對照表的實際行號。
- [ ] Python:寫 `segments-*.json` 產生腳本(逐 peek,index frame 明記)。
- [ ] TS:`submovement.ts` + `SEG_V2_PARAMS`(11/3/0.75/60.0/0.1/0.2/`seg-v2`,附出處註解)。
- [ ] TS:`findPeaks` 局部極大值(plateau `//2`)獨立測試 —— 上述五類 fixture 各一。
- [ ] TS:`submovement.test.ts` —— 12 步對照表中每個 flag 分支各一測試(`empty_signal` / `non_finite_replaced` / `non_finite_interpolated` / `zero_motion`+`below_floor` / `sg_fallback_short_signal` / `no_peak` / `below_floor` / `truncated_at_window_edge`)。
- [ ] TS:`promoted-segments.test.ts` 對四份 fixture 逐 peek 對表。
- [ ] 兩閘輸出貼 progress。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | **逐 peek segment 逐位相等** | 三份真實 fixture 的全部 60 個 peek:`segments` 陣列長度、每段 `kind`/`startIdx`/`endIdx`、`flags`(已排序)、`traceFlags` **完全相等**;`peakOmega` ≤1e-9。任一 index 差 1 即 fail(**不設容差**) |
| ② | **反 vacuous** | 斷言三份真實 fixture pooled 的 `primary_flick` 段數 = **59**(與 WP-30 T2 / WP-31 T1 記錄的非退化 MR 數一致);若不等於 59 → 表示上游或本移植有一方漂移,停手查明,**不得改期望值** |
| ③ | **plateau 規則有獨立證據** | `findPeaks` 五類 fixture 測試綠,其中偶數長度平頂案例明確斷言取偏左 index |
| ④ | **封閉 flags 詞彙表** | TS 側 flag 集合 ⊆ Python `seg-v2` 詞彙表;測試斷言出現未知 flag 即 throw(比照 Python 的 `AssertionError` 紀律) |
| ⑤ | **合成邊界案例綠** | 已知 primary/micro 邊界的合成訊號:TS 與 Python 輸出逐位相同,且與 WP-28 T3 / KI-005-A A2-T3 記錄的邊界誤差 ≤2 tick 一致 |
| ⑥ | **既有測試零修改全綠** | `npm run test:ci` exit 0;`src/` 只新增 `submovement.ts` + 測試 |
| ⑦ | **research 閘綠** | `uv run pytest` exit 0;`algorithms/` 純度測試仍綠 |

## Commit

`feat(wp-32): T2 TS seg-v2 分段逐位移植(find_peaks plateau/邊界 walk/merge)+ 逐 peek segment golden(index 逐位相等,pooled primary=59)`
