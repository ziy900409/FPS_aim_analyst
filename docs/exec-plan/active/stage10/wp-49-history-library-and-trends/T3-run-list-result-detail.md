# WP-49 T3 — Run List and Historical Result Detail

## Objective

完成exact drill的Assessment run list與單run歷史結果；抽出current/historical共用Result presentation/body，確保歷史下載使用被選run payload且不暴露restart/save actions。

## Entry gate

- T2 exit綠；WP-48 `listRuns/loadRun`與not-found contract綠。
- 重新impact：`createResultScreen`、`ResultScreenHandle/Options`、`metricsDashboard`、`diagnosisForPayload`、`qualityFlagsForPayload`、`buildCurrentExportPayload`、`main.ts` completion。
- 確認WP-48對ResultScreen/main的實際save-status diff已合併或協調。

## Planned files

```text
src/results/ResultPresentation.ts                 NEW
src/results/ResultPresentation.test.ts            NEW
src/ui/ResultDetailBody.ts                        NEW shared read-only body
src/ui/ResultDetailBody.test.ts                   NEW
src/ui/ResultScreen.ts                            MODIFY use body; current actions unchanged
src/ui/ResultScreen.test.ts                       MODIFY regression
src/ui/history/DrillOverview.ts                   NEW run list portion
src/ui/history/HistoricalRunDetail.ts             NEW
src/ui/history/*.test.ts                          NEW
src/history/HistoryLibraryController.ts           MODIFY list/load detail
src/main.ts                                       MODIFY use shared projector only
tests/e2e/history-library.spec.ts                 EXTEND
```

## Steps

1. 先建parity fixtures，釘死current payload在extract前後的summary/promoted/diagnosis/quality flags。
2. 把payload→presentation pure domain從`main.ts`抽到`ResultPresentation.ts`；不可移入DOM、fs、client或wall-clock。
3. 從ResultScreen抽read-only body；current wrapper保留restart、WP-48 save status與current export actions。
4. controller載入runs並assert order/tie-breaker；提供`all|trend-eligible|excluded` filter state，T4前eligible可標`pending-analysis`。
5. HistoricalRunDetail只綁`loadRun`取得的payload；Back、Download JSON/CSV與optional replay port。無`onReplay`時按鈕不存在。
6. invalid/not-found/load failure不清掉run list；retry只重載該run。
7. E2E從run list開兩個不同run，下載內容逐一比對runId/meta/tick/event count； current Result actions仍操作current run。

## High-risk failure modes

| Trigger | Required assertion |
|---|---|
| historical action closure指向current payload | downloaded metadata必等於route run，不等於current run |
| Result extraction語意漂移 | parity fixtures所有cards/diagnosis/flags等價 |
| run route direct reload | breadcrumb可重建，detail正確或typed not-found |
| run在list後被移除/損壞 | scoped error + Back可用；其他runs不消失 |
| historical detail顯示restart/save | DOM中不存在這些actions |

## Definition of Done

- [ ] run list預設`startedAt desc`，UTC/local顯示、filter URL round-trip與tie-break tests全綠。
- [ ] current/historical presentation parity fixtures全綠；不複製metric/diagnosis規則。
- [ ] historical JSON/CSV下載使用selected payload；兩run E2E內容可區分。
- [ ] historical detail無restart/save/manual-current actions；optional replay port無handler時無button。
- [ ] not-found/corrupt/API failure retry與Back E2E全綠。
- [ ] current Result/component/regression、full Vitest/Playwright/build全綠。

## Commit

```text
feat(history): open historical assessment results
```

