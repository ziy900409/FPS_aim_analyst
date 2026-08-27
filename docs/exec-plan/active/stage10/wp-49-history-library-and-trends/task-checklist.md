# WP-49 — Master Task Checklist

> Spec：[README.md](README.md) · Running log：[progress.md](progress.md)
>
> 每個task 0.5～3 dev-days；一task一commit。task開工只讀本檔、該task file及其明列來源；若CodeGraph顯示新blast radius，先回寫task/progress再改碼。

| Done | Task | Objective | Dependencies | Risk | Estimate |
|---|---|---|---|---|---|
| ✅ | **T0** Entry gate／handoff audit／PoC／決策凍結 | [T0-entry-gate.md](T0-entry-gate.md) | WP-48 contract | High | 0.5–1d |
| ✅ | **T1** Navigation/controller shell | [T1-navigation-controller.md](T1-navigation-controller.md) | T0 | High | 1.5–2.5d |
| ✅ | **T2** Participant／exact-drill browser | [T2-participant-drill-browser.md](T2-participant-drill-browser.md) | T1 + WP-48 T4 | Med | 1.5–2.5d |
| ✅ | **T3** Run list／historical Result | [T3-run-list-result-detail.md](T3-run-list-result-detail.md) | T2 + WP-48 loadRun | High | 2–3d |
| ⬜ | **T4** Metric registry／analysis API／trend domain | [T4-metric-registry-trend-domain.md](T4-metric-registry-trend-domain.md) | T0 + WP-48 T2/T3 | High | 2–3d |
| ⬜ | **T5** Drill overview trend UI／entry integration | [T5-drill-overview-integration.md](T5-drill-overview-integration.md) | T1～T4 + WP-48 T5 | High | 2–3d |
| ⬜ | **T-exit** Acceptance／WP-50 handoff | [T-exit-gate.md](T-exit-gate.md) | T1～T5 | Med | 0.5–1d |

## WP-49 completion gate

- [ ] FR-49.1～13與NFR-49.1～8每項均在README §4.1有實際test／measurement evidence。
- [ ] `Participant → exact drillId → startedAt desc → historical Result`不需file picker即可完成。
- [ ] Drill overview同時提供全部Assessment run list與正式trend；Practice在API projection與UI均為零entry。
- [ ] unknown metric drill仍可瀏覽list/detail，且顯示明確trend empty state。
- [ ] 多compatibility cohorts不混算；quality／metric／cohort排除有domain及UI證據。
- [ ] Browser Back／Forward／reload／breadcrumb／scroll/filter restoration E2E全綠，stale response不覆蓋新route。
- [ ] 5,000-run與100-observation projection benchmarks達NFR；browser/server concurrency有界。
- [ ] `npm run build`、browser/Node typecheck、Vitest、Playwright全綠；live gameplay／current Result／WP-48 persistence零回歸。

## Task discipline

1. T0只做handoff audit、PoC與決策，不混入production feature。
2. T1 controller擁有async state；views不得自行fetch或直接監聽多套navigation來源。
3. T3先建立current/historical shared result seam，再加入history wrapper；不得複製整份ResultScreen rendering。
4. T4 registry必須exact-id、pure、versioned；未知drill不得throw或fallback到family。
5. T5只整合已測domain與view，不在UI callback內新增trend規則。

