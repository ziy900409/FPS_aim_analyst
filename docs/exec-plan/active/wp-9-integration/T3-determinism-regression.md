# T3 — 決定性回歸測試（自動化）

> Part of [WP-9 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T0 |
| **Risk / Complexity** | Med / Med |
| **Touches** | NEW `tests/regression/determinism.spec.ts`；MODIFY `package.json`（`test:ci`）；可選 CI workflow |
| **Status** | ⬜ TODO |

## Objective
把 WP-2 T4 的決定性驗證升級為**完整 sim**（含 movement/急停/輸入消費）的自動化回歸，守護 M1 不退化（FR-9.3）。

## In scope
- `determinism.spec.ts`：完整 sim 在多 FPS 序列下逐 tick 一致（沿用 WP-2 T4 + 納入 WP-3/5 邏輯）。
- `package.json` `test:ci`：`tsc --noEmit && vitest run && playwright test`，exit code 為閘。
- 若 repo 有 CI → 加 workflow 跑 `test:ci`（OQ-9.3）。

## Out of scope
- 新功能；E2E 全鏈路（T1）。

## Design notes
- 完整 sim 決定性是計時效度的根；任何後續改動偷渡 frame 依賴都應被此測試擋下。
- 與 WP-2 T4 共用 runner，擴充輸入/movement/急停。

## Steps
- [ ] 擴充決定性測試納入完整 sim（movement/急停/輸入消費）。
- [ ] 加 `test:ci` 腳本；本機跑 exit 0。
- [ ] （若有 CI）加 workflow 跑 `test:ci`。
- [ ] `vitest run` + `tsc` 綠燈。

## Definition of Done
- [ ] 完整 sim 決定性回歸自動化、綠燈；`test:ci` exit code 為閘（CI 或本機）。

## Commit
`test(wp-9): 決定性回歸自動化（完整 sim）+ test:ci 閘（FR-9.3）`
