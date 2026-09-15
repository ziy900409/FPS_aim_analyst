# WP-69 — Task Checklist

| 狀態 | Task | 交付 | 相依 | 風險 |
|---|---|---|---|---|
| ✅ | **T0** Entry gate | [T0-entry-gate.md](T0-entry-gate.md) | — | High |
| ✅ | **T1** Attempt/disposition contract | [T1-attempt-disposition-contract.md](T1-attempt-disposition-contract.md) | T0 | High |
| ⬜ | **T2** Pausable active time | [T2-pausable-time-mapper.md](T2-pausable-time-mapper.md) | T1 | High |
| ⬜ | **T3** Input/Pointer Lock/UI | [T3-input-pointer-lock-overlay.md](T3-input-pointer-lock-overlay.md) | T2 | High |
| ⬜ | **T4** Finalization/persistence | [T4-finalization-persistence-gate.md](T4-finalization-persistence-gate.md) | T1–T3 | High |
| ⬜ | **T5** Orchestrator retry | [T5-orchestrator-retry.md](T5-orchestrator-retry.md) | T4 | High |
| ⬜ | **T6** E2E/regression/docs | [T6-e2e-regression-docs.md](T6-e2e-regression-docs.md) | T1–T5 | Med |
| ⬜ | **T-exit** Acceptance | [T-exit-gate.md](T-exit-gate.md) | T1–T6 | Low |

規則：一列 = 一個 vertical slice = 一個 atomic conventional commit。若 task 超過 3 dev-days，先回 README 拆分，不在實作中偷長。

