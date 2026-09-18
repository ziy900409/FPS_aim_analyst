# WP-70 T0 — Entry gate

## Objective

在動任何 production code 之前，把三件會讓後續全部白做的事釘死：**編號**、**baseline**、
**OQ-70.1 的可行性**。本 task 的 production diff 必須為空。

## Steps

1. **重查編號**（GD-15「先採納先得」）：
   - `docs/exec-plan/README.md` §2 目前最大採納 WP 號；`DECISIONS.md` 目前最大 `GD-n`。
   - 規劃期取 **WP-70 / GD-47**（當時最大為 WP-69 / GD-46）。若已被取用則順延，並同步更新
     stage14 §3 未採納候選的順延註記。
   - 確認 stage16 資料夾命名與 `docs/exec-plan/README.md` 的 stage 區塊一致。
2. **驗上游 exit-gate**：WP-69 T-exit 綠燈（`progress.md §T-exit`），確認其交付未被後續 commit 破壞
   （`npx vitest run src/attempt src/loop/__tests__/wp69-pause-time.test.ts` exit 0）。
3. **凍結 baseline 四閘**，逐項記 exit code 與**精確計數**到 `progress.md`：
   `npm run typecheck` · `npm run build` · `npx vitest run` · `npx vitest run tests/regression`。
4. **複核 KI-040 的四個缺陷在當前 HEAD 仍成立**（不得沿用 KI 文件的行號，重讀）：
   - A：`experimentSession.ts` 對 `suspect` 仍只有兩個賦值、無 reset；
   - B：`requestFullscreen` 仍為 production 單一呼叫點且綁在資格閘；
   - C：`hideSuspectWarning` 仍為 production 單一呼叫點；
   - D：`updatePauseRuntime()` 仍不觸碰 `drillRunner`。
5. **預測 canonical digest 移動筆數**（NFR-70.2）：數 `CANONICAL_DIGEST_BEFORE_T5` 中帶 `meta.validity`
   父物件的 fixture 筆數，寫成明確預測值。⚠️ 承 D-69-T0-4 的先例：**第 N+1 筆變動即 bug，回頭修程式
   不准改表**。
6. ⭐ **驗證 OQ-70.1（Playwright fullscreen 可行性）** —— 本 gate 的最高價值產出：
   - 寫一支**丟棄式** spike（不進 repo，或進 repo 後於本 task 內刪除），在 `--project=edge` 下嘗試
     以合成點擊觸發 `document.documentElement.requestFullscreen()`，斷言
     `document.fullscreenElement != null` 且 `fullscreenchange` 有觸發。
   - 記錄**實測結果**（可行／不可行／需要哪個 launch flag）到 `progress.md`。
   - 結論直接決定 T5 的形狀：可行 ⇒ T5 是 e2e 任務；不可行 ⇒ T5 改為「具名手動驗證清單 +
     單元層 `fullscreenchange` 注入」，並在 `progress.md` 明帳為替代證據（含 owner 與理由）。
7. **blast radius 以 grep 重跑**（CodeGraph 僅作下界，見 README §5）：`experimentSession`、
   `handleFullscreenChange`、`markProtocolFullscreenExit`、`hideSuspectWarning`、`requestFullscreen`、
   `sharedState.validity` 的 production 與 test 引用數，逐一記錄。
8. **關閉或降級 OQ-70.2／70.3**（OQ-70.4 屬使用者，可留到 T6）。

## Definition of Done

- [ ] 編號重查有**具名證據**（目前最大 WP / GD 各為何、`GD-47` 標題零命中），結論寫入 `progress.md`
- [ ] WP-69 上游 gate 綠燈證據連結齊全，且 focused 重跑 exit 0
- [ ] 四閘 baseline 全數 exit 0，**精確計數**（files/tests passed/skipped）記入 `progress.md`
- [ ] KI-040 四缺陷逐條複核，每條附當前行號（不沿用 KI 文件行號）
- [ ] canonical digest 預測筆數寫成明確數字 + 具名 fixture 清單
- [ ] **OQ-70.1 有實測結論**（非推測）：附 spike 指令、輸出、以及 T5 形狀的決定
- [ ] blast radius 六個符號的 grep 計數記入 `progress.md`
- [ ] `git diff -- src tests` 為空（本 task 零 production code）

## Commit

```text
docs(wp-70): T0 entry gate for run-scoped validity
```
