# WP-48 T5 — Assessment-Only Automatic Persistence Wiring

## Objective

在既有 completed-run seam 接入 `HistoryPersistence`，只讓 Assessment 自動保存並可 retry；Practice 顯示不納入歷史且保留當次 Result／手動匯出。保存與結果計算共用同一 payload，且任何失敗不影響 gameplay/session progression。

## Entry gate

- T4 exit 已綠。
- 重新執行 CodeGraph impact：`buildCurrentExportPayload`、`createResultScreen`、completion IIFE。
- `git status --short` 中 `src/main.ts` 的既有 WP-47 dirty change已有明確 owner並已提交／安全協調；否則 T5 不得編輯該檔。

## Planned files

```text
src/ui/HistorySaveStatus.ts              NEW
src/ui/HistorySaveStatus.test.ts         NEW
src/ui/ResultScreen.ts                    MODIFY add save-status presentation seam
src/ui/ResultScreen.test.ts               MODIFY
src/main.ts                               MODIFY one-payload completion wiring
tests/e2e/history-persistence.spec.ts     NEW
```

## Design rules

1. `main.ts` 可建立／呼叫 `HistoryPersistence`，但不得直接 `fetch`、組 API URL 或處理 filesystem error。
2. `ResultScreen` 只嵌入 `HistorySaveStatus.element`；不擁有 payload 或 client。
3. completed flow 只呼叫一次 `buildCurrentExportPayload()`：同一 payload 傳給 metrics/diagnosis/result/save。
4. Assessment Result Screen 先顯示 metrics + `saving`；不等待 disk I/O。save promise settle 後更新 status。Practice 顯示中性說明「Practice 不納入歷史；可手動匯出」，不得顯示保存失敗。
5. retry 使用 T4 保存的 completed payload；restart/new drill 前 reset UI state，但若上一 save 尚在 commit，service generation rule避免舊狀態污染新 run。
6. malformed Assessment 到 completion 才發現 missing Participant 時，顯示 non-retryable missing-participant + Download JSON；不得新增 Practice Participant context。
7. Explicit Download JSON/CSV 保留。既有 Session Plan automatic download 是否移除，依 T0 決策記錄；不可同時靜默 auto-save又強制下載重複檔而不說明。

## Steps

1. 先建 `HistorySaveStatus` component tests：idle/saving/saved created/saved existing/failed retryable/non-retryable、retry button callback。
2. 在 `main.ts` composition root 建 client/persistence/status；注入 Result Screen。
3. completion IIFE 使用同一 payload：result render 與 `void persistence.save(payload)`；所有 rejection 轉狀態。
4. 對 Session Plan／protocol／researcher single drill 三種 completion branches 做回歸；Assessment save 不得阻擋 `sessionPlanRunner.advance()`／`completeActiveProtocolCondition()`。
5. E2E 使用 temp-root API：Assessment 跑／注入完成流程，等待 `saved`，直接讀 API/file fixture 比對 identity、tick/event counts。
6. E2E Practice：完成後 Result 與 JSON/CSV 手動匯出仍可用，狀態為 `excluded`，HistoryClient/API call count=0，temp root 無新增 JSON。
7. E2E API unavailable：Assessment Result metrics 仍顯示、failed/retry/download 可用、console 無 unhandled rejection。

## High-risk failure modes

| Trigger | Required assertion |
|---|---|
| build payload twice | spy count = 1；saved payload counts/meta 等於 Result 使用 payload |
| API slow/offline | Result metrics immediately visible；session transition still occurs |
| missing Participant | no POST/final file；actionable status；download remains |
| Practice complete | excluded；no HistoryClient/API call；no temp/final/index entry；Result/download remain |
| retry after server committed but client timed out | response existing → saved |
| restart while old save resolves | old generation does not overwrite current save status |

## Definition of Done

- [ ] Participant Session Assessment 自動保存到 temp root，identity 正確。
- [ ] researcher/session Practice 均不發 HistoryClient/API request、不建檔、不進 index；Result 與手動 JSON/CSV 匯出仍可用。
- [ ] completion 每 run `buildCurrentExportPayload()` 恰一次；metrics、diagnosis、saved JSON 使用同 payload evidence。
- [ ] Result Screen saving/saved/failed/excluded/retry UI component tests 全綠且 keyboard/ARIA label 可操作。
- [ ] API offline/timeout/permission failure不影響 metrics 顯示與 session/protocol advance；console unhandled rejection=0。
- [ ] missing Participant 不發 POST、不建檔、不捏造 ID，Download JSON 仍可用。
- [ ] Session Plan／protocol／restart/close 既有 E2E 零回歸；`src/sim`、`DrillRunner`、`SharedState` 零 diff。
- [ ] CodeGraph impact 與實際 changed files 對帳寫入 progress；targeted/full Vitest + Playwright + build 全綠。

## Commit

```text
feat(history): auto-save completed assessments
```
