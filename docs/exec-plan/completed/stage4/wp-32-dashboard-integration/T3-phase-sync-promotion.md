# T3 — 共享 peek 窗抽出 + `phase-v1` / `sync-v1` 晉升 + golden

> Part of [WP-32 dashboard-integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T2(分段);間接 T1(ω) |
| **Risk / Cplx** | Med / Med — 演算法本身淺,風險在**抽出 `buildPeekWindows` 時偷改語意**(會讓 WP-29 的 `timeline-parity` 一起紅) |
| **Touches** | ADD `src/metrics/peekWindows.ts` + `src/metrics/researchMetrics.ts`(+ 測試);**MODIFY** `src/metrics/compute.ts`(改用共享窗界,逐位不變);ADD `research/fixtures/golden/{phase,sync}-*.json` + 產生腳本;ADD `tests/golden/research/promoted-phase-sync.test.ts`;MODIFY `docs/operational/analysis-phase-curves.md`(TS 晉升面段) |
| **狀態** | ⬜ |

## Objective

FR-D17 的主體第一半:把 `phase-v1`(REC/MR/V)與 `sync-v1`(Release-to-Click Sync)晉升進 `src/metrics/`。順帶結清一筆結構債 —— peek 窗界目前是 `compute.ts` 的私有函式,`researchMetrics.ts` 不可能重寫一份(C-D4),所以**抽出是本 task 的義務,不是可選清理**(比照 WP-29 T1 對 research 側三份窗界實作的消重)。

## In scope

### ① `src/metrics/peekWindows.ts` —— 純結構抽出(零語意變更)

- 把 [compute.ts](../../../../../src/metrics/compute.ts) 的私有 `buildPeekWindows` 搬到新檔並 export,**邏輯逐行搬移**:窗界 `[visible.t, nextVisible.t ?? Infinity)`、`counter` 取窗內第一個、`firstFire` 需 `firstShot && (targetId 缺席 || === visible.targetId)`。
- `compute.ts` 改為 import 使用;`Metrics` 的輸出**逐位不變**。
- 額外提供 `tickRange`(對已排序 ticks 的 `[start, end)`),供 T3/T4 切窗 —— 這是**新增的附加資訊**,不改變既有窗界判定。切片容差沿用 research 側的 `WINDOW_EPSILON_MS = 1e-9` 慣例(與 [peek.py](../../../../../research/src/modules/metrics/algorithms/peek.py) 對齊)。
- `side`(L/R)取自 `visible.side`。

> ⚠️ 判準:**既有測試零修改全綠**。`compute.test.ts`、`timeline-parity.test.ts`、`MetricsDashboard.test.ts` 任何一支需要改一個字,就代表語意被動到 → 停手。

### ② `phase-v1` 晉升

逐位對齊 [phase.py `phase_decompose`](../../../../../research/src/modules/metrics/algorithms/phase.py):

- 逐 peek:窗內 ticks → `omegaDegPerSec`(T1)→ `segmentSubmovements(omega.slice(1), SEG_V2_PARAMS)`(T2)→ index **+1** 映回 tick frame(與 T2 golden 的 `indexFrame:'tick'` 慣例一致)。
- `tickTimes.length < min_window_ticks(30)` → `window_too_short`,其餘欄位全 `undefined`。
- 無 `primary_flick` → `no_primary_flick`。
- `t_onset = tickTimes[primary.startIdx]`、`t_mr_end = tickTimes[primary.endIdx]`、`peak_omega = max(finite(omega[start..end]))`。
- `t_anchor = peek.tFirstShot`;缺 → `no_first_shot`;`t_anchor < t_mr_end` → `anchor_before_onset` **且 rec/mr/v 全部設為 undefined**(退化不硬給負值)。
- `rec = t_onset − t_visible`、`mr = t_mr_end − t_onset`、`v = t_anchor − t_mr_end`。
- **`t_detect` 呼叫既有 [`deriveDetectionMetrics`](../../../../../src/metrics/detectionDerivation.ts)**(C-D4;WP-30 T1 已雙向對表),據以算 `rec_minus_detect_ms`。**不得重推**。
- `non_uniform_dt`:窗內自身 dt 與窗內中位數比對(Python `_is_locally_uniform`,`atol=1e-6`)。
- **`filter_degenerate` 不產生**(T0 `D-32.4`;S-32.1)。
- drill 級聚合:`rec/mr/v/peak_omega` 各自 `mean/p50/sd/n`,**`p50` 為線性插值分位數、`sd` 為母體標準差**(沿用 `compute.ts` `stat()` 定義,不另立第二套);帶 flag 的 peek 不進聚合分母。

### ③ `sync-v1` 晉升

逐位對齊 [sync.py](../../../../../research/src/modules/metrics/algorithms/sync.py):

- `t_release` 推導沿用 [analysis-peek-timeline.md](../../../../operational/analysis-peek-timeline.md) 的兩條路徑(原方向鍵 = counter 鍵的反向鍵;無 counter → 窗內最後一次 A/D held→released,標 `release_inferred_no_counter`;窗內無鍵狀態轉換 → `no_key_transition`)。
- 三個量:`release_to_fire_ms` / `counter_hold_ms` / `counter_to_fire_ms`;缺錨點標 flag(`missing_release`/`missing_counter`/`missing_first_shot`),**不吞成 0、不吞成 NaN**。
- `counter_hold_ms`:自 `t_counter` 起窗內 ticks,追蹤 counter 鍵 held→released;走到窗尾仍 held → `counter_hold_truncated`。
- `evaluate_release_precision`:`quantization_sd = (1000/128)/√12 ≈ 2.2551 ms`;三分支(`blocked-by-data` / `insufficient` / `sufficient`)與 `SyncParams`(`min_samples=10`、`sd_ratio_threshold=1/3`、`sync-v1`)**逐位沿用,不重新拍板**。
- 聚合只吃 `flags` 為空的列(Python `_valid_metric_values` 的紀律:**有任何 flag 即排除**,不是只排除相關 flag)。

### ④ golden 與對表

- `phase-<fixture>.json`:逐 peek 全欄 + drill 級聚合;fixture = 09:18 / 09:24 / 09:37 + 合成。
- `sync-<fixture>.json`:逐 peek 三量 + flags + 兩支 `PrecisionVerdict` 全欄;fixture = 上述四份 **+ 09:39(主要效度樣本)+ 08:03(零輸入邊界)**(T0 §⑤ 的 sync 例外)。
- 對表:浮點 ≤1e-9;`n` / flag 集合 / `verdict` 字串逐位相等;flags 比較時排除 `filter_degenerate`。

### ⑤ 文件

`analysis-phase-curves.md` 增「TS 晉升面(WP-32)」段:對表面清單、容差三級、**`filter_degenerate` 刻意分歧的理由與影響範圍**、golden 檔名與產生腳本。

## Out of scope

- curve(T4)、結果頁(T5)。
- 改動 `phase-v1` / `sync-v1` / `seg-v2` 的任何參數或語意。
- 移植 Butterworth / `smooth_report_omega`。
- 在 `researchMetrics.ts` 內重推 peek 窗界、ε 或 `t_detect`(C-D4)。

## Steps

- [ ] 抽出 `buildPeekWindows` → `peekWindows.ts`;`compute.ts` 改 import;**先跑一次既有測試確認零修改全綠**再往下做。
- [ ] `researchMetrics.ts`:`computePhaseSamples` + drill 級聚合(共用 `stat()`)。
- [ ] `researchMetrics.ts`:`computeSyncRows` + `evaluateReleasePrecision`。
- [ ] TS 單元測試:phase 五個 flag 分支各一;sync 的缺 counter / 缺 release / truncated / 零輸入(08:03 形狀)各一。
- [ ] Python:`phase-*.json` / `sync-*.json` 產生腳本(notebooks)。
- [ ] `promoted-phase-sync.test.ts` 對表。
- [ ] `analysis-phase-curves.md` 補「TS 晉升面」段。
- [ ] 兩閘輸出貼 progress。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | **抽出零漂移** | `compute.test.ts` / `timeline-parity.test.ts` / `MetricsDashboard.test.ts` **零修改**全綠;`git diff src/metrics/compute.ts` 只顯示「刪除私有函式 + 新增 import」 |
| ② | **phase 對表 ≤1e-9** | 四份 fixture 逐 peek `rec/mr/v/peak_omega/rec_minus_detect` + drill 級 `mean/p50/sd/n`;flag 集合(排除 `filter_degenerate` 後)**逐 peek 相等** |
| ③ | **sync 對表 ≤1e-9** | 六份 fixture 逐 peek 三量 + flags 逐位相等;兩支 `PrecisionVerdict` 的 `n`/`verdict`/`reason` 逐字相等,`sample_sd_ms`/`quantization_sd_ms` ≤1e-9 |
| ④ | **反 vacuous** | 三份 tick-integral fixture 的 phase 非退化列數 pooled = **59**(與 WP-30 T2 一致);09:39 的 sync unflagged 列數 = **13**(與 WP-29 T2 一致)。不符即停手查明,**不得改期望值** |
| ⑤ | **邊界不 crash** | 08:03(零輸入)在 sync 路徑上輸出 `n=0` + `blocked-by-data`,不 throw、不補 0 |
| ⑥ | **C-D4 機械證據** | 測試斷言 `researchMetrics.ts` 的 `t_detect` 來自 `deriveDetectionMetrics`(以 spy/相同輸出比對);程式碼審查確認未出現第二份窗界或 ε 幾何 |
| ⑦ | **既有測試零修改全綠** | `npm run test:ci` exit 0 |
| ⑧ | **research 閘綠** | `uv run pytest` exit 0;`algorithms/` 純度測試仍綠 |
| ⑨ | **文件** | `analysis-phase-curves.md` 含「TS 晉升面」段,明載 `filter_degenerate` 分歧與其影響範圍 |

## Commit

`feat(wp-32): T3 peek 窗界抽出(零語意變更)+ phase-v1/sync-v1 晉升 TS + golden 對表(≤1e-9,flags 逐 peek 相等)`
