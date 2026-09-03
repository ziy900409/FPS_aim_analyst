# WP-55 — Task Checklist

> Tech spec：[README.md](README.md) · Running log：[progress.md](progress.md)
>
> 狀態符號：`[ ]` pending · `[-]` in progress · `[x]` complete。WP-55 已於 2026-09-03 由 T0 正式納入 stage11；T1 之後才開始 production contact derivation。

| Done | Task | Objective | Dependencies | Risk |
|---|---|---|---|---|
| [x] | **T0** Scope freeze/no-health audit | [T0-scope-freeze-no-health-audit.md](T0-scope-freeze-no-health-audit.md) | 使用者確認 WP-55 是否納入 stage11 | High |
| [x] | **T1** Contact geometry contract | [T1-contact-geometry-contract.md](T1-contact-geometry-contract.md) | T0 | High |
| [x] | **T2** Export-derived artifact | [T2-export-derived-artifact.md](T2-export-derived-artifact.md) | T1 | Med/High |
| [x] | **T3** All tracking drill coverage | [T3-all-tracking-drill-coverage.md](T3-all-tracking-drill-coverage.md) | T2 | High |
| [x] | **T3 後續**（2026-09-03，KI-021 slice B）：contact hitbox 閘門接受三軸相等的 `shape:'sphere'`，WP-54 candidate drills 改用 sphere 後 `includedRunCount` 維持 2（D-55.7） | [KI-021](../../../../known_issue/KI-021-tracking-derivation-ignores-sphere-hitbox-shape.md) | T3 | Med |
| [ ] | **T4** Replay observability | [T4-replay-observability.md](T4-replay-observability.md) | T2/T3 | Med/High |
| [ ] | **T5** Report and quality integration | [T5-report-and-quality-integration.md](T5-report-and-quality-integration.md) | T3/T4 | Med |
| [ ] | **T6** Exit gate and documentation | [T6-exit-gate-and-documentation.md](T6-exit-gate-and-documentation.md) | T1-T5 | Med |
| [ ] | **T-exit** M21 evidence audit/handoff | [T-exit-m21-evidence-audit-handoff.md](T-exit-m21-evidence-audit-handoff.md) | T1-T6 | Med |

## Package Definition of Done

- [x] WP-55 stage scope 已接受，或明確保持 future/candidate，不和 WP-52/WP-53/WP-54 stage11 scope 矛盾。
- [x] Legacy tracking drills 無 regression。
- [x] `onTarget` 與 `epsilonDeg` 可由 export 以 exact hitbox deterministic 重建。
- [-] Contact artifact、Replay/離線 trace、report 三者可對表同一 run/tick/frame。
- [x] BR/projectile evidence 與 pure tracking summary 分層，不用 hit/damage/kill 取代 contact。
- [x] Missing/unsupported/invalid data 全部輸出 closed reason code，不產生假 0。
- [ ] 不新增 health bar、HP、damage、kill count 作為 tracking 跟隨判定來源。

## Commit discipline

每個 task 單獨 commit；完成 task 後同步本清單、[progress.md](progress.md) 與 stage11 master 文件。發現上游 domain defect 時回 owning WP 修復並補 regression，不在 WP-55 checklist 裡混入未授權的產品語意。
