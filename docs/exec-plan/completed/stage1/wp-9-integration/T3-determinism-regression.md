# T3 — 決定性回歸測試（自動化）

> Part of [WP-9 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T0 |
| **Risk / Complexity** | Med / Med |
| **Touches** | NEW `tests/regression/determinism.test.ts`（計畫寫 `.spec.ts`，改 `.test.ts` — 見下）；MODIFY `package.json`（`test:ci`）；CI workflow 未加（repo 無 `.github/`） |
| **Status** | ✅ DONE（2026-07-03） |

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
- [x] 完整 sim 決定性回歸自動化、綠燈；`test:ci` exit code 為閘（本機，repo 無 CI）。

## Outcome（2026-07-03）
- **檔名偏離**：計畫寫 `tests/regression/determinism.spec.ts`，實作為 `tests/regression/determinism.test.ts`。原因：Vitest `include=['src/**/*.test.ts','tests/**/*.test.ts']`、Playwright `testDir=tests/e2e`——`.spec.ts` 放 `tests/regression/` 會被**兩個 runner 都不收**（靜默不跑，正是 T2 決策警告的反模式）。FR-9.3 指定 Vitest，故沿 T2 副檔名分工（單元/驗證 `.test.ts` / e2e `.spec.ts`）改 `.test.ts` 才會被收。
- **交付**：`tests/regression/determinism.test.ts`（15 tests）＋ `package.json` `test:ci`（`tsc --noEmit && vitest run && playwright test`）。
- **升級點（vs WP-2 T4 純 movement）**：驅動與生產同源的**完整管線** `createSimLoop + MovementController + consume + TargetManager + DrillRunner + DataRecorder`（不注入 camera），在 60/144/240Hz + 抖動 ±50% 幀序列下斷言：(1) 逐 tick 狀態 `{x,z,vx,vz,stopped}` exact 對齊 canonical；(2) **整份記錄資料集**（`DataRecorder` snapshot：ticks + events〔visible/counter/fire〕）跨 FPS bit-exact；(3) countdown→running 相位轉換以 sim clock 判定故 FPS 無關；(4) 反向鍵急停兩方向（counter 'A'/'D'）於固定 t、急停 tick vx=0/stopped=true；(5) 重播 + 大 gap/多小幀切分 bit-exact（無 Date.now/Math.random 洩漏）。
- **驗證**：`vitest run tests/regression/determinism.test.ts` → 15 passed；全套 `vitest run` → **26 files / 185 tests**（前 25/170，+1/+15）；`tsc --noEmit` 乾淨；`npm run test:ci` → tsc + vitest(185) + playwright(7 e2e) 全綠、**exit 0**（閘生效）。

## Commit
`test(wp-9): 決定性回歸自動化（完整 sim）+ test:ci 閘（FR-9.3）`
