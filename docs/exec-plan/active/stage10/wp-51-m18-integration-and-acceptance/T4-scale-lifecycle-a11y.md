# WP-51 T4 — Scale, Lifecycle, and Integrated Accessibility

## Objective

在完整History→Result→Replay整合下重驗上游performance/resource budgets，並證明主要流程可用keyboard與assistive semantics完成。

## Dependencies

- T1 measurement/evidence runner可用。
- T2/T3 journeys與instrumentation穩定。

## Performance and lifecycle matrix

| Workload | Gate |
|---|---|
| 5,000 summary-sized Assessment files | repository cold scan沿用WP-48 gate；History首100 rows P95 <500 ms |
| selected exact drill 100 runs | analysis cold <2 s、warm <300 ms；UI不下載所有full payload |
| 42,000 replay ticks／≤4 MiB | normalize P95 <250 ms、seek P95 <2 ms、cached first frame <1.5 s |
| active playback | sample/adapter/UI沿用WP-50 frame budget，無連續>50 ms long task |
| 50 enter/leave cycles | rAF/listener/presentation/GPU counters回baseline；abort commit ≤100 ms |
| complete acceptance command | reference machine <10 min，不含manual與opt-in 5k benchmark |

## Work

1. 重用上游canonical fixture與benchmark方法；記warmup、sample count、P50/P95/max、hardware/browser/backend與payload sizes。
2. 由History list進入100-run analysis與42k Replay，量測跨層user-visible timings，不只單元函式。
3. 驗證list/detail projection不傳ticks/events，full payload只在選定Result/Replay載入；memory/network evidence不含payload內容。
4. 執行50次enter/leave、rapid seek與visibility cycles，檢查abort、listeners、rAF、renderer/presentation owner與可觀測GPU resources。
5. keyboard完成：launch→History→Participant→drill→run→Result→Replay controls/events→Back；驗證focus restoration。
6. automated accessibility檢查landmarks/headings/names/states/slider values/live warnings；人工補screen reader可理解性與不只靠顏色。
7. gate失敗先profile與歸屬，不在WP-51新增不可重建cache或複製domain state。

## Failure modes and response

| Failure | Response |
|---|---|
| benchmark噪音／冷暖混淆 | 固定dataset、warmup與sample count；報告P95/environment，不調寬threshold掩蓋 |
| UI快但偷載full payload | network/API shape inspection直接fail，回WP-49 projection contract |
| 50-cycle counter無法觀察 | 回WP-50補test-only instrumentation，不以task manager肉眼代替 |
| focus trap/shortcut衝突 | 回owning UI component修regression，重跑整條keyboard journey |

## Definition of Done

- [ ] 所有matrix gates達標並有可比較environment/timing report。
- [ ] scale UI只讀summary/analysis projection，未批次下載full payload。
- [ ] 50-cycle與abort gates通過，沒有listener/rAF/presentation/resource growth。
- [ ] History→Replay全流程keyboard可完成，focus/ARIA/warning assertions通過。
- [ ] acceptance command wall time有記錄；任何豁免有owner/deadline而非靜默跳過。

## Suggested commit

```text
test(stage10): verify scale lifecycle and accessibility gates
```

