# WP-55 T-exit — M21 Evidence Audit and Handoff

## Objective

依 README FR/NFR/traceability 與 M21 exit gate 驗收完整 WP-55；證明 no-health boundary、exact-hitbox contact derivation、artifact/replay/report 對表、BR semantic split 與 adjacent work handoff 都成立。

## Automated gates

1. Focused unit/replay/report tests exit 0，記錄 files/tests count。
2. 必要 full `npm test` 或 CI command exit 0；若 skipped，需有 owner-approved reason。
3. Determinism gate：同 export 重跑 artifact byte-equivalent 或 stable deep-equal。
4. Performance gate：30 秒 tracking reference export artifact generation < 500 ms，記錄 environment/fixture/iterations。
5. Boundary scans：contact derivation/replay helper 無 DOM/Three/live sim/wall-clock/random dependency；sim/render hot path 無 derived contact allocation contract。
6. No-health audit：schema/state/render/hit path 無 health bar、HP、damage、kill count 作為 tracking 跟隨判定來源。

## Acceptance scenarios

| ID | Scenario | Pass condition |
|---|---|---|
| A-55.1 | no-health boundary | `DrillConfig`、`TargetState`、hit path、export schema、render/report UI 均未新增 health/damage/kill tracking contract |
| A-55.2 | `tracking_v1` contact | export 可重建 per-tick `onTarget`、`epsilonDeg`、TOT/RMS/acquisition |
| A-55.3 | `tracking_longrange_v1` contact | longrange hitbox/source unit 與 contact samples 對表 |
| A-55.4 | `tracking_br_v1` split | aim-ray contact 與 ballistic hit 分欄呈現，pure summary 不讀 hit count |
| A-55.5 | artifact determinism | 同一 export 重跑 artifact byte-equivalent 或 stable deep-equal |
| A-55.6 | blocked semantics | missing/unsupported/incompatible data 輸出 closed reason，不產生 fake zero |
| A-55.7 | replay observability | replay 或離線 HTML trace 可逐 frame 對表 target/aim/contact state |
| A-55.8 | report parity | report/export artifact 與 `deriveTrackingMetrics()` summary 對表 |
| A-55.9 | lifecycle regression | existing target lifecycle、`presentationMs`、visible event、drill id 與 legacy tests 無 semantic regression |
| A-55.10 | stage handoff | WP-54/new tracking drills 如何接入 contact artifact contract 已記錄 |

## Research/data safety

- [ ] contact status 逐 exact drill/profile/version 可追到 fixture、artifact 與 required metadata。
- [ ] legacy/blocked/incompatible export 沒有推測 target/hitbox/eye origin 資料。
- [ ] pure tracking summary 不讀 hit、damage、kill；BR companion evidence 明確分欄。
- [ ] test 只用 fixtures/validated temp roots，真實 history root 與 Participant payload 無 mutation/artifact。

## Architecture regression

- [ ] contact derivation 留在 export 後分析層，不寫回 sim state 或 SharedState。
- [ ] replay contact sampling 不依 DOM/Three/live sim/wall-clock/random。
- [ ] report 不重新定義 contact；只讀 artifact/metrics contract。
- [ ] existing tracking lifecycle、target visibility、presentation boundary 與 legacy determinism gates 無回歸。
- [ ] production code 若有修改，`graphify update .` 已完成；CodeGraph pending 同步或已直接讀。

## Documentation and graph

- [ ] README OQ/assumptions/interfaces/traceability 更新為實際交付或 blocked decision。
- [ ] progress 貼 test/perf/manual/researcher artifact review evidence，checklist 全部同步。
- [ ] stage11 master README/checklist/progress 更新 WP-55 狀態或 future/candidate 結論。
- [ ] `CONTEXT.md`、`DECISIONS.md`、operational spec 與 graphify-out 按實際 code/docs change 同步。
- [ ] `git status --short`、`git diff --cached --stat` 與 staged names 只含預期 code/tests/docs，無 payload artifacts。

## Exit criteria

Automated gates、A-55.1～10、research/data safety、architecture regression 與 documentation/graph 全數有客觀證據，才可宣告 WP-55 完成。若產品 Replay overlay 未做，必須把離線 artifact decision、technical debt 與觸發後續工作的條件寫入 progress/decision log。

## Commit

```text
docs(stage11): close WP-55 tracking contact observability
```
