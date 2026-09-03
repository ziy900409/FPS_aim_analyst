# WP-55 — Task Checklist

> Tech spec：[README.md](README.md) · Running log：[progress.md](progress.md)
>
> 狀態符號：`[ ]` pending · `[-]` in progress · `[x]` complete。WP-55 目前是候選 WP；正式開工前 T0 必須先讓 stage11 master README/checklist/progress 接受此範圍。

| Done | Task | Objective | Dependencies | Risk |
|---|---|---|---|---|
| [ ] | **T0** Scope freeze/no-health audit | [T0-scope-freeze-no-health-audit.md](T0-scope-freeze-no-health-audit.md) | 使用者確認 WP-55 是否納入 stage11 | High |
| [ ] | **T1** Contact geometry contract | [T1-contact-geometry-contract.md](T1-contact-geometry-contract.md) | T0 | High |
| [ ] | **T2** Export-derived artifact | [T2-export-derived-artifact.md](T2-export-derived-artifact.md) | T1 | Med/High |
| [ ] | **T3** All tracking drill coverage | [T3-all-tracking-drill-coverage.md](T3-all-tracking-drill-coverage.md) | T2 | High |
| [ ] | **T4** Replay observability | [T4-replay-observability.md](T4-replay-observability.md) | T2/T3 | Med/High |
| [ ] | **T5** Report and quality integration | [T5-report-and-quality-integration.md](T5-report-and-quality-integration.md) | T3/T4 | Med |
| [ ] | **T6** Exit gate and documentation | [T6-exit-gate-and-documentation.md](T6-exit-gate-and-documentation.md) | T1-T5 | Med |
| [ ] | **T-exit** M21 evidence audit/handoff | [T-exit-m21-evidence-audit-handoff.md](T-exit-m21-evidence-audit-handoff.md) | T1-T6 | Med |

## Package Definition of Done

- [ ] WP-55 stage scope 已接受，或明確保持 future/candidate，不和 WP-52/WP-53/WP-54 stage11 scope 矛盾。
- [ ] Legacy tracking drills 無 regression。
- [ ] `onTarget` 與 `epsilonDeg` 可由 export 以 exact hitbox deterministic 重建。
- [ ] Contact artifact、Replay/離線 trace、report 三者可對表同一 run/tick/frame。
- [ ] BR/projectile evidence 與 pure tracking summary 分層，不用 hit/damage/kill 取代 contact。
- [ ] Missing/unsupported/invalid data 全部輸出 closed reason code，不產生假 0。
- [ ] 不新增 health bar、HP、damage、kill count 作為 tracking 跟隨判定來源。

## Commit discipline

每個 task 單獨 commit；完成 task 後同步本清單、[progress.md](progress.md) 與 stage11 master 文件。發現上游 domain defect 時回 owning WP 修復並補 regression，不在 WP-55 checklist 裡混入未授權的產品語意。
