# WP-71 Task Checklist

| Done | Task | Objective | Dependencies | Risk |
|---|---|---|---|---|
| ⬜ | **T0** | [Entry gate：編號、上游、baseline、視覺 OQ](T0-entry-gate.md) | — | Low |
| ⬜ | **T1** | [Config/schema + pure descriptor resolver](T1-contract-and-resolver.md) | T0 | Med |
| ⬜ | **T2** | [`OpeningTargetCueView`](T2-opening-target-cue-view.md) | T1 | Med |
| ⬜ | **T3** | [App lifecycle + phase gate](T3-app-lifecycle-wiring.md) | T2 | **High** |
| ⬜ | **T4** | [Metadata + terminology + WP-67 contract](T4-metadata-and-terminology.md) | T1 | Med |
| ⬜ | **T5** | [Live e2e + visual/performance acceptance](T5-e2e-and-visual-acceptance.md) | T3 + T4 | **High** |
| ⬜ | **T-exit** | [Acceptance matrix + ledger/index closeout](T-exit-gate.md) | T1–T5 | Low |

## Package Definition of Done

- [ ] Cue 只在 initial countdown + active attempt 顯示，armed/pause/resume/running/ended 隱藏。
- [ ] Countdown 期間 `targets/tVisible/visible events = 0/0/0`，cue 不可命中。
- [ ] Running 首 target 與 cue pose/shape/display size 逐位相等。
- [ ] Cue on/off × 30/60/144/240 FPS 的正式 sim/event/target sequence 逐位一致。
- [ ] `meta.targets.openingCue` live 正例／control 缺鍵／舊 fixture 零位移。
- [ ] 六組 viewport/FOV screenshot + draw call/mesh/p95 evidence 齊全。
- [ ] sim/input/state/hit production diff 為空。
- [ ] 全量測試、build、graph update 全綠，精確計數入帳。
- [ ] 每個 task 各自一個 atomic commit，progress/checklist 與切片同 commit。
