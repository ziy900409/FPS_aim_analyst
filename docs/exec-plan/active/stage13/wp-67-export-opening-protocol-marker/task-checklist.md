# WP-67 — Task Checklist

> Tech spec：[README.md](README.md) · Running log：[progress.md](progress.md) · 決策 GD-43（草稿，本體 T-exit 入帳）

| Done | Task | Objective | Dependencies | Risk |
|---|---|---|---|---|
| ⬜ | **T0** Entry gate／編號重查／基線凍結／OQ 收斂 | [T0-entry-gate.md](T0-entry-gate.md) | — | Low |
| ⬜ | **T1** `meta.opening` 型別 ＋ `collectMeta()` ＋ `parseOpening()`（缺席不補值） | [T1-opening-meta-field.md](T1-opening-meta-field.md) | T0 | **High** |
| ⬜ | **T2** `DrillRunner.opening` 事實出口 ＋ `main.ts` 接線 | [T2-runtime-opening-source.md](T2-runtime-opening-source.md) | T1 | Med |
| ⬜ | **T3** Python 分類器 ＋ 混池 guard ＋ fixtures | [T3-python-classifier-and-pool-guard.md](T3-python-classifier-and-pool-guard.md) | T1（可與 T2 並行） | Med |
| ⬜ | **T4** live e2e／四條 start 路徑／digest 重新基線／全量回歸 | [T4-live-e2e-and-regression.md](T4-live-e2e-and-regression.md) | T2 | Med |
| ⬜ | **T5** `CONTEXT.md` 術語 ＋ `docs/operational/` 斷代規則 | [T5-docs-and-terminology.md](T5-docs-and-terminology.md) | T3 ＋ T4 | Low |
| ⬜ | **T-exit** WP-67 驗收（A-67.1～A-67.10）＋ GD-43 入帳 | [T-exit-gate.md](T-exit-gate.md) | T1～T5 | Low |

## 建議執行順序

```
T0 ──▶ T1 ──┬──▶ T2 ──▶ T4 ──┐
            └──▶ T3 ─────────┴──▶ T5 ──▶ T-exit
```

T3 只依賴 T1 定下的欄位形狀（`opening.protocol` 的兩個字串值），不需要等 T2 的接線。

## Package Definition of Done

- [ ] 新 live 匯出的 `meta.opening.protocol === 'armed-countdown-v1'`、`countdownMs === 3000`（實測數值入 `progress.md`）
- [ ] 缺 `opening` 的舊 payload 經 `parseExportPayload()` 後**仍為 `undefined`**，且 8 筆 `CANONICAL_DIGEST_BEFORE_T5` 與 T0 **逐筆相同**
- [ ] 三格 `FROZEN_META_KEY_DIGESTS` 位移，且新舊鍵集合差集**恰為 `['opening']`**
- [ ] `createDrillRunner` 省略／明傳 `requireArm: false` ⇒ `opening.protocol === 'immediate-v0'`（FM-2 兩條反證）
- [ ] `countdownMs` 以**非 3000** 的 config 值測過，證明來源是 config 而非常數
- [ ] 四條 start 路徑（restart／換武器／換場景／換 drill／Session Plan 每個 block）的匯出皆帶一致且正確的 `meta.opening`
- [ ] `classify_opening()` 三分支（pre-WP-65／中間窗／WP-67 後）各有 fixture 且分類正確；`unknown` 分支一條
- [ ] 混池 guard 拋錯訊息**含檔名**；同協定一池不拋錯
- [ ] `meta` 頂層鍵集合恰多一鍵 `opening`；`meta.validity` 五欄與 `suspect` 的 OR 集合逐位不變
- [ ] `git diff` 對 `src/state/SharedState.ts`、`src/sim/`、`src/input/`、`research/.../loader.py` 四者皆為空
- [ ] `npm run typecheck` ×2、`npx vitest run`、`npx vitest run tests/regression`（fixture 零修改）、`npx playwright test --workers=1`、`npm run build` 五項皆 exit 0
- [ ] TS 註解／Python docstring／`CONTEXT.md` 三處對「開場協定」的定義逐句一致（C-D4）

## Commit discipline

每個 task 單獨 commit；subject 見各 task file。完成 task 後同步本清單、[progress.md](progress.md) 與上層 [stage13 README](../README.md)。

> ⚠️ **平行 session 提醒**：[stage13 README](../README.md) 與 [`exec-plan/README.md`](../../../README.md) 是多個 session 共編的索引檔（本 WP 的號碼就是因為 WP-66 被平行 session 於 `959b4e3` 取走而從 WP-66 順延到 WP-67）。翻狀態時若撞到同一行衝突，只 stage 自己那幾行，不要整檔覆蓋。
