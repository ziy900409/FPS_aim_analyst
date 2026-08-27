# WP-48 T4 — Typed HistoryClient and Persistence State Machine

## Objective

建立 browser-only typed client 與 save/retry state machine，隔離 fetch／timeout／error mapping，讓 T5 `main.ts` 只依賴 `HistoryPersistence`，不直接知道 URL 或 HTTP status。

## Planned files

```text
src/history/HistoryClient.ts             NEW
src/history/HistoryClient.test.ts        NEW
src/history/HistoryPersistence.ts        NEW
src/history/HistoryPersistence.test.ts   NEW
src/history/contracts.ts                 MODIFY only if T3 evidence requires additive DTO
```

## Interface to implement

逐位實作 [README.md](README.md) §2.4 的 `HistoryClient`、`HistorySaveState`、`HistoryPersistence`。

## Steps

1. 以 injectable `fetch`／base URL／timeout 寫 failing tests，不依賴真 Node server。
2. 實作 typed response parser；即使 HTTP 2xx，body 不符 contract 仍回 protocol error。
3. error mapping：network/timeout/5xx retryable；invalid export/practice not archivable/missing participant/conflict non-retryable；保留 stable code 供 UI，不顯示 raw stack。
4. `HistoryPersistence.save(payload)` 遇 Assessment 的狀態為 `idle → saving → saved|failed`；遇 Practice 直接為 `excluded`，不得呼叫 `HistoryClient.saveRun()`。subscribe 立即／順序行為釘死。
5. `retry()` 只重用最近一次 failed Assessment payload；excluded/saved/idle 呼叫 retry 不得送 request。
6. 新 run `save()` 必須 supersede 舊 retry context；晚到的舊 promise 不得覆蓋新 run state（以 generation token 解決）。
7. Abort/timeout 只取消 client wait；API 可能已 commit，因此 retry 必須接受 `existing`。
8. bundle boundary test／static scan 確認 `src/history` 無 `node:` imports。

## Failure modes

- timeout 後 server 已寫成功，retry 取得 existing → 必須呈現 saved，不是 error。
- run A save 晚於 run B 回應 → run A 不得覆蓋 run B save state。
- malformed 2xx body → 不得 cast 成 typed success。
- rejected promise 未 catch → render-loop console unhandled rejection。
- Practice 被送出 HTTP request → 違反 Assessment-only policy；測試以 fetch/client spy 斷言 call count=0。

## Definition of Done

- [ ] 六 client methods 的 URL encoding、method、abort 與 typed success tests 全綠。
- [ ] network、timeout、400/404/409/413/422/5xx、malformed 2xx body 的 mapping 全有測試。
- [ ] persistence state transition、subscribe/unsubscribe、retry existing、generation race tests 全綠；Practice `excluded` 且 client/fetch call count=0。
- [ ] rejected save promise 不產生 unhandled rejection；test 明確監聽並斷言為 0。
- [ ] `rg "node:" src/history` 無結果；`npm run build` 的 browser bundle 不含 history root 或 filesystem module 字串。
- [ ] `npx tsc --noEmit`、targeted/full Vitest exit 0。

## Commit

```text
feat(history): add typed client and save state machine
```
