# T4 — per_segment_apply + quality flags

> Part of [WP-28 research-foundation](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T3(分段可用且參數已凍結) |
| **Risk / Cplx** | Low / Low |
| **Touches** | ADD `research/src/modules/segments/algorithms/apply.py` + tests |
| **狀態** | ✅ 2026-08-04 |

## Objective

FR-D6:交付泛用逐段計算入口與 quality flags 契約——**失敗是資料不是缺失值**。下游(WP-30/31)每個逐段指標都走這一個入口,故 flags 的可枚舉性在此一次釘死。

## In scope

- **`per_segment_apply(segments, fn) -> pd.DataFrame`**:對每段呼叫 `fn(segment) -> dict`,回傳每段一列;**每列必含 `flags` 欄**(tuple[str, ...]);`fn` 拋錯 → 該列 `flags += ('compute_failed:<reason>',)` 且指標欄為 `NaN`,**不得整批失敗、不得把 flag 吞成純 NaN**。
- **flags 詞彙表**(可枚舉常數,寫入模組 doc + `analysis-segments.md`):
  `insufficient_samples` · `no_segment` · `truncated_at_window_edge` · `below_floor` · `non_uniform_dt` · `missing_target` · `compute_failed:<reason>`。新增 flag 必須加入此表(測試斷言「輸出中的 flag 都在詞彙表內」)。
- **peek 級 ↔ 段級對齊**:每段帶所屬 peek index(來源 = WP-29 的 peek 窗;T4 只定義欄位契約與 `peek_index` 傳遞,不實作 peek 重建)。
- 聚合輔助:`summarize_with_flags(df, value_col)` → `n`(有效)、`n_flagged`、mean/p50/sd;**flagged 列不進聚合但必須被計數**(報告顯示 n 與被排除數)。

## Out of scope

- peek 窗重建(WP-29 T1)、任何具體指標(WP-30/31)、報告排版(WP-29 T-exit 起)。

## Steps

- [x] `apply.py`:`per_segment_apply` + `summarize_with_flags` + flags 詞彙表常數。
- [x] tests:空段清單、單樣本段、NaN 注入、`fn` 拋錯(→ `compute_failed`)、flag 詞彙表封閉性、`summarize_with_flags` 的 n/n_flagged 正確性。
- [x] `uv run pytest` 全綠(輸出貼 progress)。

## Definition of Done

- 單元測試綠:空段清單回空 DataFrame(欄位齊全,非拋錯);單樣本段 → `insufficient_samples` flag;NaN 注入不傳染到其他段;`fn` 拋錯 → 該列 `compute_failed:<reason>` 且其他段正常。
- **詞彙表封閉性測試綠**:任一測試輸出中出現的 flag 皆屬詞彙表。
- `summarize_with_flags` 的 `n` 不含 flagged 列,且 `n_flagged` 等於被排除數(斷言)。
- 契約斷言:`per_segment_apply` 回傳的 DataFrame **必有** `flags` 與 `peek_index` 欄(型別測試)。
- `uv run pytest` exit 0。

## Commit

`feat(wp-28): T4 per_segment_apply + quality flags 契約(詞彙表封閉;失敗不吞成 NaN)`
