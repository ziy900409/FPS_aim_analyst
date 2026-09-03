# WP-55 T6 — Exit Gate and Documentation

## Objective

收斂 WP-55 local exit gate、operational/stage 文件、focused tests、no-health regression audit 與 source graph 狀態；確認交付沒有新增 HP/damage/health bar schema/state/render contract。

## Dependencies

- T1～T5 completed。

## Steps

1. 逐項對帳 [README.md](README.md) §6 M21 Exit Gate，標 automated/measurement/inspection/manual evidence 或 blocked owner。
2. 更新 `docs/operational/analysis-tracking.md` 或新增 tracking observability doc，記錄公式、artifact schema、blocked semantics 與 no-health boundary。
3. 同步 stage11 master README/checklist/progress：WP-55 完成、blocked、revise，或保留為 candidate/future。
4. 執行 focused unit/replay/report tests，並執行必要 full `npm test` 或 CI command。
5. 重跑 no-health/no-damage audit，確認 schema/state/render/hit path 無新增 health bar、HP、damage-as-tracking contract。
6. production code 若有修改，執行 `graphify update .`；若只有 docs/test-plan 變更，記錄不需更新 source graph。
7. T-exit 前檢查 `git status --short`、staged stat/names、artifact scan，確保無真實 participant payload 進 git。

## Required documentation

- operational tracking spec：exact-hitbox contact formula、artifact schema、blocked result semantics。
- stage11 master docs：WP-55 狀態與 M21 relationship。
- WP-55 progress/checklist：tests、perf、a11y/manual/researcher artifact review evidence。
- technical debt note：若 product Replay overlay 未做，記錄觸發後續工作的條件。

## Definition of Done

- [x] README §6 M21 exit gate 逐項對帳，且每項有 evidence 或 blocked owner。
- [x] operational tracking docs 已更新公式、artifact schema、blocked semantics 與 no-health boundary。
- [x] stage11 master README/checklist/progress 已同步 WP-55 狀態，或明確保留為 candidate/future。
- [x] focused unit/replay/report tests 全綠，必要 full `npm test` 或 CI command exit 0。
- [x] no-health/no-damage audit 證明 schema/state/render/hit path 無新增 health bar、HP、damage-as-tracking contract。
- [x] production code 若有修改，`graphify update .` 已完成；純 docs/test-plan 則記錄 skipped reason。
- [x] `git status --short`、staged stat/names、artifact scan 完成，無真實 participant payload 進 git。

## T6 Evidence Ledger

| Area | Evidence type | Result |
|---|---|---|
| README §6 M21 gate | inspection | README §6.1 now maps each gate row to automated / measurement / inspection / manual evidence or owner. T-exit is still open. |
| Operational docs | inspection | `docs/operational/analysis-tracking.md` states exact-hitbox aim-ray `onTarget`, TOT, RMS/median/P95 epsilon, contact artifact consumer boundaries, closed blocked vocabulary, no fake zero, no health/HP/damage/kill, and BR companion-only split. |
| WP/stage docs | inspection | WP-55 progress/checklist and stage11 README/progress/task-checklist mark T6 complete while leaving WP-55 T-exit unchecked. |
| Focused contact/report/replay tests | automated | `npx.cmd vitest run src/metrics/trackingContactReport.test.ts src/metrics/trackingContactArtifact.test.ts src/metrics/trackingContactCoverage.test.ts src/metrics/trackingContact.test.ts src/replay/replayContact.test.ts` -> 5 files / 40 tests passed. |
| Contact + legacy tracking/BR baseline | automated | `npx.cmd vitest run src/metrics/trackingContactReport.test.ts src/metrics/trackingContactCoverage.test.ts src/metrics/trackingContactArtifact.test.ts src/metrics/trackingContact.test.ts src/metrics/trackingDerivation.test.ts src/metrics/trackingTransitions.test.ts src/drill/tracking_v1.test.ts src/drill/tracking_longrange_v1.test.ts src/drill/tracking_br_v1.test.ts tests/regression/longrange-tracking-determinism.test.ts tests/regression/br-tracking-invariants.test.ts tests/regression/br-camera-anchor-invariants.test.ts tests/regression/projectile-determinism.test.ts tests/regression/moving-target-determinism.test.ts` -> 14 files / 81 tests passed. |
| Typecheck | automated | `npm.cmd run typecheck` -> exit 0. |
| Full unit suite | automated | `npm.cmd test` -> 210 files / 2021 tests passed; 1 file / 2 tests skipped. Recorded as broad regression smoke, not as WP-54 pilot gate evidence. |
| No-health/no-damage audit | inspection + grep | `rg` audit over source, tests, operational docs, and WP-55 docs found no target health/HP/damage/health-bar contract. Matches are WP-55 boundary docs, History API `/health`, `HitDetector.test.ts` hit-point variable `hp`, and existing fire/hit/kill lifecycle. |
| Graphify | inspection | Skipped: T6 changed docs only and did not modify production code. `graphify-out` is not staged. |
| WP-54 isolation | inspection | T6 did not modify or stage WP-54 active files: `wp-54-tracking-pilot/T6-instrumentation-gate.md`, `scripts/analyze-tracking-pilot.ts`, `scripts/trackingStimulusFidelity.ts`, or `tests/regression/tracking-stimulus-fidelity.test.ts`. |

## Commit

```text
docs(stage11): document WP-55 tracking contact evidence
```
