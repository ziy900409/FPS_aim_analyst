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

- [ ] README §6 M21 exit gate 逐項對帳，且每項有 evidence 或 blocked owner。
- [ ] operational tracking docs 已更新公式、artifact schema、blocked semantics 與 no-health boundary。
- [ ] stage11 master README/checklist/progress 已同步 WP-55 狀態，或明確保留為 candidate/future。
- [ ] focused unit/replay/report tests 全綠，必要 full `npm test` 或 CI command exit 0。
- [ ] no-health/no-damage audit 證明 schema/state/render/hit path 無新增 health bar、HP、damage-as-tracking contract。
- [ ] production code 若有修改，`graphify update .` 已完成；純 docs/test-plan 則記錄 skipped reason。
- [ ] `git status --short`、staged stat/names、artifact scan 完成，無真實 participant payload 進 git。

## Commit

```text
docs(stage11): document WP-55 tracking contact evidence
```
