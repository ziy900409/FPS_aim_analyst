# WP-51 — Task Checklist

> Tech spec：[README.md](README.md) · Running log：[progress.md](progress.md)

| Done | Task | Objective | Dependencies | Risk |
|---|---|---|---|---|
| ✅ | **T0** Entry／handoff gate | [T0-entry-gate.md](T0-entry-gate.md) | WP-48～50 exit evidence | High |
| ✅ | **T1** Acceptance harness／roots／evidence | [T1-acceptance-harness.md](T1-acceptance-harness.md) | T0 seams confirmed | High |
| ✅ | **T2** Cross-WP canonical journeys | [T2-cross-wp-happy-paths.md](T2-cross-wp-happy-paths.md) | T1 + WP-48～50 exits | High |
| ✅ | **T3** Failure／recovery／safety | [T3-failure-recovery-safety.md](T3-failure-recovery-safety.md) | T1～T2 | High |
| ✅ | **T4** Scale／lifecycle／a11y — T-exit 重跑解除 42k cached-reopen P95 noisy blocker（480ms < 1500ms）；projection-shape／50-cycle+abort／keyboard journey／wall time皆有自動化證據。KI-017 已於 2026-09-01 修復；KI-018 仍列為 T-exit known limitation，不阻塞 T4 自動化 DoD | [T4-scale-lifecycle-a11y.md](T4-scale-lifecycle-a11y.md) | T1～T3 | Med/High |
| ⬜ | **T5** Operations／manual release — runbook＋dossier traceability完成（2026-08-31）；Chrome/WebGL2 coverage gap 已由 product/tech owner 豁免為 post-M18 debt；manual Edge/GPU/a11y walkthrough／獨立operator重跑待人工執行 | [T5-operations-manual-release.md](T5-operations-manual-release.md) | T2～T4 | Med |
| ⬜ | **T-exit** M18 gate — automated gates 已重跑並通過（typecheck/build/Vitest/Playwright/test:ci/test:stage10/scale/critical repeat）；KI-017 已由 WP-50 owner 修復；Chrome/WebGL2 coverage gap 已正式豁免；仍待 manual Edge/GPU/a11y walkthrough、獨立 operator 重跑與 KI-018 owner 收斂後才可宣告 M18 | [T-exit-gate.md](T-exit-gate.md) | T0～T5 + upstream exits | High |

## Package Definition of Done

- [ ] WP-48～50實際exit evidence全綠，且所有Stage 10 acceptance findings有owner與closed regression。
- [x] canonical Assessment、Practice exclusion、restart、exact grouping、trend/result parity與Replay皆在正確dev/preview邊界驗收。
- [x] failure/recovery、path/data safety、race、scale、resource lifecycle與a11y gates通過。
- [x] 自動化只寫run-scoped workspace roots；真實root/outside sentinel前後不變，無Participant資料進artifacts/git。
- [ ] operational runbook與人工browser/GPU evidence完成；README §10逐項可追溯。
- [x] 單一acceptance command、build/typecheck/Vitest/Playwright/repeat gates全exit 0。（M18仍需人工/owner gate。）

## Commit discipline

每個task單獨commit；完成task後同步本清單、[progress.md](progress.md)與上層Stage 10 checklist。上游domain defect的修復commit留在owning WP。
