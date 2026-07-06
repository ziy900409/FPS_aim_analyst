# T0 — Entry gate(baseline 重錄授權 + 決定性測試盤點)

> Part of [WP-14 movement-physics](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Docs-only。NO production code。**

| | |
|---|---|
| **相依** | —(GD-5 已於 WP-10 T0 落地;本 task 驗證其涵蓋面) |
| **Risk / Cplx** | Low / Low |
| **Touches** | 本資料夾 docs(+ 必要時 `../../../DECISIONS.md` 補記) |
| **狀態** | ✅ complete(2026-07-06) |

## Objective

動 integrator 之前先鎖三件事:baseline 重錄有全域授權(GD-5)、受影響的決定性測試
清單完整盤點、`MovementController` 介面承諾明確——讓 T1 的「全紅」是預期而非事故。

## In scope
- 確認 [DECISIONS.md](../../../DECISIONS.md) GD-5 已含「WP-14 決定性 baseline 預期重錄」;缺則補記(docs commit)。
- 盤點**引用既有軌跡期望值**的決定性測試清單,逐檔記入 [progress.md](progress.md):
  已知 `src/loop/__tests__/determinism.test.ts`、`tests/regression/determinism.test.ts`;
  以 grep(tests 內 position/vx 期望值)確認無遺漏。
- 確認 [MovementController.ts](../../../../../src/sim/MovementController.ts) 公開介面承諾:
  `step(state, dtSec)` 簽名不變、呼叫端清單(`codegraph_callers` 一次)記 progress,作為 T1「呼叫端零 diff」的 DoD 依據。

## Out of scope
- 任何 `src/` 變更;OQ-S2-2 校準容差(WP-15 T0 的事)。

## Steps

- [ ] GD-5 檢查:重錄授權文字存在且指名 WP-14;缺 → 補記後再過。
- [ ] 決定性測試盤點:列出每個引用軌跡期望值的測試檔 + 其斷言形式(逐 tick 陣列 / snapshot),記 progress。
- [ ] `MovementController` 介面快照(簽名 + 呼叫端清單)記 progress。
- [ ] `npm run test` 當前全綠(exit 0)——改動前的乾淨基準。
- [ ] progress.md 記 entry-gate PASS 宣告。

## Definition of Done

- progress 含:GD-5 證據、測試盤點清單、介面快照、乾淨基準(test exit 0);
  `git diff --stat` 不含 `src/`。

## Commit

`docs(wp-14): T0 entry gate — baseline 重錄授權確認 + 決定性測試盤點`
