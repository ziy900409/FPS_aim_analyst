# WP-71 T-exit — 開場定位提示驗收閘

## Acceptance matrix

| Gate | Claim | FR/NFR | Required evidence |
|---|---|---|---|
| **A-71.1** | cue 只對 wide-v1 opt-in，其他 drill 零變更 | FR-71.1/71.7 · NFR-71.6 | roster/config 正反測試 + 五條 activation 路徑 |
| **A-71.2** | 只在 initial countdown + active attempt 可見 | FR-71.2 | 六相位 truth table + pause/resume live e2e |
| **A-71.3** | cue 與正式首中心 target 幾何同源且逐位相等 | FR-71.3/71.5 | resolver unit + running transition integration equality |
| **A-71.4** | cue 完全不進 sim/data event/hit/RNG | FR-71.4/71.10 · NFR-71.1/71.2/71.7 | state/event/RNG negative tests + production diff scan |
| **A-71.5** | cue 視覺上明確是非互動提示 | FR-71.6 · NFR-71.5 | 6 組 screenshot + 使用者 visual gate + 無動畫證據 |
| **A-71.6** | lifecycle 無 stale cue/GPU leak | FR-71.7 | scene/drill/restart/weapon/session/pause 計數與 dispose spy |
| **A-71.7** | payload 自述且不污染舊資料 | FR-71.8/71.9 · NFR-71.6 | live payload 正反例 + canonical byte/digest 差異 |
| **A-71.8** | 效能成本受限 | NFR-71.3/71.4 | draw call/mesh/p95 baseline→after 實測表 |
| **A-71.9** | 全量回歸與圖譜同步 | 全部 | typecheck×2/build/Vitest/regression/Playwright/graph:update 精確輸出 |

## Exit procedure

1. 對 FR-71.1～71.10、NFR-71.1～71.7 每列填具名測試／截圖／數值；不得寫「已完成」。
2. 複核 `git diff main...HEAD -- src/sim src/input src/state/SharedState.ts src/sim/HitDetector.ts src/loop/SimLoop.ts` 為空。
3. 複核新增 production code 無 `Date.now()`／`Math.random()`、無 `preAimCue` 命名。
4. 把實際決策、fallback、surprises、OQ 結果回填 `progress.md`。
5. `GD-48` 由 🟡 翻 ✅，補 commit、實際 evidence 與任何偏離；stage16/top index、checklist、progress 同步。
6. `git status --short`、`git diff --cached --stat`、staged file names 三重稽核，只含本 task。

## Definition of Done

- [ ] Acceptance matrix 無「完成但無證據」列；部分通過者有 owner／deadline／後續處置。
- [ ] sim/input/state/hit production diff 為空。
- [ ] 四 FPS bit-exact、state/event 負向、visual、performance、metadata 五類證據齊全。
- [ ] 全量驗證 exit 0，精確 passed/skipped 計數入 `progress.md`。
- [ ] `GD-48`、stage16/top index、WP checklist/progress 狀態一致。

## Commit

```text
docs(wp-71): close opening target cue exit gate
```
