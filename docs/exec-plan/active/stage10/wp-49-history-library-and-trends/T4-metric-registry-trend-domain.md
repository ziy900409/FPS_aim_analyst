# WP-49 T4 — Exact Metric Registry, Analysis API, and Trend Domain

## Objective

建立versioned exact-`drillId` metric registry、Node paged projection service/API、client DTO與pure trend cohort/eligibility domain；讓大量run不需把完整JSON傳到browser。

## Entry gate

- T0的OQ-49.1、OQ-49.2、OQ-49.4已收斂；未收斂部分不得以臆測metric或無界load開工。
- WP-48 repository/API/client實際interface綠；T3 ResultPresentation pure projector可重用相關derivations。
- impact：WP-48 repository/loadRun/listRuns、historyApi、HistoryClient/contracts、CompatibilityKey與所有首批metric derivations。

## Planned files

```text
src/history/DrillMetricRegistry.ts                  NEW
src/history/DrillMetricRegistry.test.ts             NEW
src/history/HistoryTrend.ts                         NEW
src/history/HistoryTrend.test.ts                    NEW
src/history/contracts.ts                            MODIFY page/projection DTO
server/history/HistoryAnalysisService.ts            NEW
tests/history/historyAnalysisService.test.ts        NEW
server/history/historyApi.ts                        MODIFY observations route
tests/history/historyApi.test.ts                    MODIFY
src/history/HistoryClient.ts                        MODIFY observations method
src/history/HistoryClient.test.ts                   MODIFY
```

## Interface to implement

逐位實作[README.md](README.md) §2.5～2.7的`MetricDescriptor`、registration/registry、projection/page、`CompatibilityCohort`與`buildHistoryTrend()`。

## Steps

1. 先寫exact registry tests：known ids、near-prefix unknown、descriptor uniqueness/unit/format/primary、registry version。
2. 依T0 roster實作projectors；移轉既有hold-click/hold-track mapping時用golden payload證明value parity。
3. 實作projection guard：Assessment required、compatibility key、quality status、finite/id/unit；unknown與invalid回typed result不throw整頁。
4. 實作HistoryAnalysisService：opaque cursor、limit≤100、stable desc order、concurrency=4、in-flight coalescing、success cache key `(runId,registryVersion)`。
5. API/client加入observations method；logical ids URL encode、invalid cursor/limit typed 400、item failure仍2xx page。
6. 實作trend domain：先以`toTrendCompatibilityKey()`移除quality欄位，再做cohort grouping/default、quality eligibility、metric selection、excluded counts、oldest→newest points、delta、0/1/2+ cases。
7. performance fixture量cold/warm 100 observations與5,000 compact projections；監測max active jobs/memory，證明無unbounded Promise.all。

## High-risk failure modes

| Trigger | Required assertion |
|---|---|
| prefix/family fallback | `hold-click-v2`未註冊即unknown，不用`hold-click` projector |
| Practice payload | policy violation/excluded，zero observation/cache entry |
| projector NaN/throw/unit mismatch | item invalid safe code；page其他items仍ready |
| mixed compatibility | 分cohort；selected trend只含一key；excluded count正確 |
| suspect與ok只有quality不同 | 同一condition cohort；suspect由quality gate排除，不建立第二cohort |
| two clients同時要同run | single projection execution，兩者收到同immutable result |
| >100／invalid cursor | 400，repository不做load |
| cache/version change | registryVersion不同必重算，不讀舊projection |

## Definition of Done

- [ ] registration contract、exact lookup、known golden parity、unknown empty與descriptor validation tests全綠。
- [ ] Assessment/quality/cohort/metric id+unit/finite gates逐項有positive/negative tests。
- [ ] observations API/client的URL、cursor、limit、safe item errors與typed response tests全綠。
- [ ] max active projectors=4；same-key coalesce；no unbounded`Promise.all` evidence。
- [ ] cold page P95 <2s、warm <300ms（100 runs≤4MiB）；量測與環境寫入progress。
- [ ] Practice零entry、unknown drill不throw、多cohort不混算。
- [ ] browser/Node typecheck、targeted/full Vitest、build全綠。

## Commit

```text
feat(history): project assessment trend observations
```
