# WP-49 T5 — Drill Overview Trend UI and Entry Integration

## Objective

把T2 run library、T4 trend domain整合成同drill overview，交付SVG+table、metric/cohort/filter controls、漸進載入與launch／saved Assessment Result入口；完成History替代人工picker的產品flow。

## Entry gate

- T1～T4 exit綠；WP-48 T5 save state可提供saved Assessment run/context。
- OQ-49.2／OQ-49.3最終結論已寫入progress。
- impact：`ResultScreen`、WP-48 save status、`main.ts` completion/visibility、`ResearcherMenu`或launch controls、舊`HistoryView`。

## Planned files

```text
src/ui/history/DrillOverview.ts                   MODIFY/COMPLETE
src/ui/history/DrillOverview.test.ts              NEW
src/ui/history/TrendChart.ts                      NEW
src/ui/history/TrendChart.test.ts                 NEW
src/ui/history/HistoryScreen.ts                   MODIFY
src/history/HistoryLibraryController.ts           MODIFY observation paging/filter
src/ui/ResultScreen.ts                            MODIFY onOpenHistory visibility
src/ui/HistoryView.ts                             RETIRE/REDIRECT per OQ-49.3
src/main.ts                                       MODIFY entry/context composition
tests/e2e/history-library.spec.ts                 EXTEND
```

## Steps

1. 先建TrendChart component tests：0/1/2+/large points、lower/higher/neutral direction、negative/positive delta、same-data table、long labels。
2. DrillOverview在summary成功時立即顯示run list；observations獨立loading，每頁完成更新loaded/total與trend model。
3. 實作metric selector、cohort selector、run filter；所有選擇寫入route，Back/Forward/reload可重建。
4. UI明列selected cohort條件摘要、eligible n與quality/incompatible/unregistered/invalid排除count；不以顏色單獨表意。
5. 驗收T1 global「歷史紀錄」入口已接真實controller資料；saved Assessment Result新增「查看此 Drill 歷史」並導向正確Participant/exact drill；Practice Result不顯示。
6. close/history back恢復origin context：launch回launch；Result origin回仍可見的current Result與scroll/focus。
7. 依OQ-49.3移除或redirect人工HistoryView；JSON/CSV Download保持。
8. 完整E2E涵蓋multi-participant、多exact drill、multi-cohort、unknown metric、Practice exclusion、API failure與pointer-lock isolation。

## High-risk failure modes

| Trigger | Required assertion |
|---|---|
| latest page未含舊eligible points | chart標loaded/total並漸進補齊；不得標「全部」 |
| selector切換時舊page晚回 | current route/generation才commit；選擇不跳回 |
| lower-is-better metric | direction/delta文字正確，不把下降標惡化 |
| saved Result尚未取得run context | history button disabled/hidden至saved，不猜runId |
| Practice Result | history entry absent；direct route也無Practice data |
| close to Result | current Result payload/actions仍在，未重算／未替換成historical payload |

## Definition of Done

- [ ] SVG與table使用同一points model；keyboard/ARIA、direction/delta、0/1/2+/long-label tests全綠。
- [ ] drill overview同屏有trend、exclusion summary與全部Assessment run list；漸進loaded/total正確。
- [ ] metric/cohort/filter URL state、Back/Forward/reload/scroll restoration E2E全綠。
- [ ] launch與saved Assessment Result入口正確；Practice Result無入口且歷史零entry。
- [ ] unknown metric／insufficient/multi-cohort/API error均有可行動UI，不影響run detail。
- [ ] current Result/save/restart/download、Pointer Lock、live gameplay回歸全綠。
- [ ] targeted/full Vitest、Playwright、browser/Node typecheck、build全綠。

## Commit

```text
feat(history): add drill assessment trends
```
