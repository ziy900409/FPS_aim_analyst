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

- [ ] 所有matrix gates達標並有可比較environment/timing report（見progress.md 2026-08-31條目：
      History首100 rows／100-run analysis cold-warm／normalize-seek沿用Node-level既有evidence皆已
      達標且有environment/timing report；**唯「42k-tick cached-reopen P95」一列在本機重複量測介於
      884-1927ms、對1500ms budget時而通過時而略超標**，判斷較像是本機當下背景負載造成的jitter但未經
      乾淨環境對照驗證，如實記錄不強行判定通過，留給T5或WP-50在較安靜環境重跑確認）。
- [x] scale UI只讀summary/analysis projection，未批次下載full payload（
      `tests/e2e/stage10-projection-shape.spec.ts`：真實network response-shape inspection，含
      run-detail端點必須含ticks/events的sanity check）。
- [x] 50-cycle與abort gates通過，沒有listener/rAF/presentation/resource growth（
      `tests/e2e/stage10-lifecycle-scale.spec.ts`：真實瀏覽器50次enter/leave canvas/window-document
      listener/rAF/DOM node count零成長，abort commit在同步call stack內、performance.now()量測
      遠低於100ms budget）。
- [x] History→Replay全流程keyboard可完成，focus/ARIA/warning assertions通過（
      `tests/e2e/stage10-accessibility.spec.ts`：僅用.focus()+page.keyboard.press()走完
      launch→History→Participant→drill→run→Replay controls/events→Back，含兩段真實Tab-order證明與
      role/aria-label/aria-pressed/aria-valuetext斷言；過程中發現並記錄兩個真實upstream缺陷
      [KI-017](../../../known_issue/KI-017-history-replay-tdz-referenceerror-on-early-replay-click.md)／
      [KI-018](../../../known_issue/KI-018-history-search-keystroke-focus-steal.md)，測試側繞開但未
      掩蓋，修復留給WP-50／WP-49）。
- [x] acceptance command wall time有記錄；任何豁免有owner/deadline而非靜默跳過（
      `tests/stage10/cli.ts`：`npm run test:stage10`本機實測38.5s／41.6s，遠低於600s budget，
      M18EvidenceRecord記錄且明確排除兩個opt-in benchmark）。

## Suggested commit

```text
test(stage10): verify scale lifecycle and accessibility gates
```

