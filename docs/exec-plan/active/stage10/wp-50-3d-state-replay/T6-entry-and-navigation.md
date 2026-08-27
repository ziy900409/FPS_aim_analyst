# WP-50 T6 — Current Result／Historical Run Entry and Return

## Objective

把同一Replay Controller/Screen接到當次Result與WP-49 historical Run Detail，保證正確payload/runId、source return state、Practice政策與rapid navigation安全。

## Entry gates

- WP-48實際`HistoryClient.loadRun(runId)`、typed errors/abort與Assessment-only payload contract已穩定。
- WP-49 historical run route、optional replay action port與scroll restoration已通過handoff tests。
- 重新執行ResultScreen、HistoricalRunDetail、HistoryRoute/controller與`main.ts` CodeGraph impact；保留concurrent diffs。

## Steps

1. 定義`ReplaySourceContext`（current result或historical route）與controller load intent；UI只傳payload/runId，不持有scene/player。
2. Current Result依support顯示full/partial/unsupported action；in-memory payload不因save failed而消失。Practice依OQ-50.2實作，零save/history side effect。
3. Historical action以exact selected runId load；load前後route/generation一致才commit。
4. Back/UI close/browser navigation釋放presentation並還原Result或WP-49 route/filter/scroll/focus。
5. 測rapid A→B run switch、Back during load、API unavailable、run removed、scene late response、re-enter與double-click。
6. 補current/historical support parity與correct-payload download/result regression。

## Definition of Done

- [ ] current Assessment saved/failed與historical Assessment皆進同一Replay path。
- [ ] Practice行為符合OQ-50.2，且API/repository/history entry mutation=0。
- [ ] selected run identity、breadcrumb/source identity與returned route/scroll/focus正確。
- [ ] rapid navigation/abort/late response無stale scene、GPU leak或unhandled rejection。
- [ ] WP-48 auto-save、WP-49 Result/History與live gameplay E2E無回歸。

## Commit

```text
feat(replay): integrate result and history replay entries
```
