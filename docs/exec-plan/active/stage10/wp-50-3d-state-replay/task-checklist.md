# WP-50 — Task Checklist

> Tech spec：[README.md](README.md) · Running log：[progress.md](progress.md)

| Done | Task | Objective | Dependencies | Risk |
|---|---|---|---|---|
| ⬜ | **T0** Entry gate／sufficiency audit／PoC | [T0-entry-gate.md](T0-entry-gate.md) | WP-48 approved load contract | High |
| ⬜ | **T1** Replay schema／capture／support classifier | [T1-replay-contract-and-capture.md](T1-replay-contract-and-capture.md) | T0 | High |
| ⬜ | **T2** Playback domain core | [T2-playback-domain-core.md](T2-playback-domain-core.md) | T1 | Med/High |
| ⬜ | **T3** Presentation ownership／base scene | [T3-presentation-and-scene.md](T3-presentation-and-scene.md) | T1～T2 | High |
| ⬜ | **T4** Targets／weapon／effects | [T4-replay-visual-state.md](T4-replay-visual-state.md) | T1～T3 | High |
| ⬜ | **T5** Replay Screen／transport／HUD | [T5-replay-ui.md](T5-replay-ui.md) | T2～T4 | Med |
| ⬜ | **T6** Result／History integration | [T6-entry-and-navigation.md](T6-entry-and-navigation.md) | T5 + WP-48 + WP-49 T3 | High |
| ⬜ | **T-exit** Replay acceptance／WP-51 handoff | [T-exit-gate.md](T-exit-gate.md) | T1～T6 | Med |

## Package Definition of Done

- [ ] 至少一個代表性official Assessment fixture為`full`，可由磁碟JSON完成第一人稱3D播放、任意seek、四種速度與事件跳轉。
- [ ] 所有已知official exact `drillId`皆有profile/support matrix與客觀reason；legacy/partial/unsupported不假裝完整。
- [ ] Replay active時live `SimLoop`、Pointer Lock、InputSampler皆無執行，且只有一個rAF/renderer owner。
- [ ] direct seek與sequential playback到同`t`的scene/HUD/effect state等價。
- [ ] Current Result與historical Run Detail共用同一Replay path並正確返回來源；Practice維持零history mutation。
- [ ] performance、a11y、resource lifecycle、build/Vitest/Playwright與live determinism gates全綠。

## Commit discipline

每個task單獨commit；建議subject見各task file。完成task後同步本清單、[progress.md](progress.md)與上層Stage 10 checklist。
