# WP-48 T3 — Node History API and Vite Adapter

## Objective

把 T2 repository 暴露為 loopback/same-origin typed HTTP API，並依 T0 決策接入 Vite dev/preview；HTTP 層只做 transport、limits、routing 與 error mapping，不複製 repository logic。

## Planned files

```text
server/history/historyApi.ts            NEW
server/history/historyPlugin.ts         NEW（若 OQ-48.1 選 Vite middleware）
tests/history/historyApi.test.ts        NEW
vite.config.ts                          MODIFY
playwright.config.ts                    MODIFY（dev/preview 各自 temp root）
package.json / package-lock.json        MODIFY scripts if required by T0 decision
```

若 T0 選 standalone process，將 adapter/launch files 替換為 T0 progress 記錄的明確方案，但 `historyApi.ts` route handler contract不變。

## Routes and errors

逐位實作 [README.md](README.md) §2.4 六個 routes、status codes、`HistoryApiSuccess<T>` 與 `HistoryApiErrorBody`。特別要求：

- body streaming 計數，超過 16 MiB 立即中止並回 413；不可先無界限 buffer。
- 僅 `application/json`；malformed JSON=400，schema/Practice not archivable/missing Participant=422，identity conflict=409。
- URL params 僅是 logical IDs；不可被當 path join input。
- error response 不含 stack、absolute path、username 或 raw filesystem error。
- API middleware 必須與既有 COOP/COEP plugin 共存，不能使 dev/preview headers 回歸。

## Steps

1. 先寫 route contract tests，repository 用 fake/mock；涵蓋 success + 所有 error codes，尤其 `PRACTICE_NOT_ARCHIVABLE` 與 `MISSING_PARTICIPANT` 必須可區分。
2. 實作 framework-neutral request handler／router；Node adapter 負責 stream/body/response。
3. mount 到 `/api/history`；其他 route 必須 `next()`，不得攔截 Vite assets/HMR。
4. dev/preview server 各自 initialize repository；listen/close lifecycle 對稱，close await repository queue/lease release。
5. Playwright dev/preview 使用不同 explicit temporary roots，避免兩個 webServer 爭同 lease；CI 完成後由測試 harness cleanup。
6. 驗證 loopback policy與 same-origin fetch；不得開 `*` CORS。
7. 把 Node typecheck 納入 build/test command；確認 `vite.config.ts` 的 COOP/COEP tests 全綠。

## Failure modes

- 超大 body 先被完整讀入 memory → memory spike/DoS。
- handler error double-write response → connection hang。
- Vite close 未釋放 lease → 下一次 test/dev 503 locked。
- dev/preview 共用 root → E2E flaky、資料互相污染。
- middleware route matching 太寬 → HMR/static assets 404。

## Definition of Done

- [ ] 六 routes 的 success contract、status code 與 body type 皆有 integration test。
- [ ] 400/404/409/413/422/423/500/503 至少各一測試；Practice POST 回 `422 PRACTICE_NOT_ARCHIVABLE`、repository 無 mutation；response 無 absolute path/stack。
- [ ] 16 MiB + 1 byte request 回 413，repository save 未被呼叫且 temp/final file 均不存在。
- [ ] non-loopback/CORS policy 有可重現測試；正常 same-origin browser fetch 成功。
- [ ] dev 與 preview 都有 health endpoint、COOP/COEP 既有 E2E 仍綠、close 後 lease 可重取。
- [ ] Playwright server roots 位於測試 temp root且彼此不同；真實 history root 無 artifacts。
- [ ] browser/Node typecheck、Vitest、`npm run build` exit 0。

## Commit

```text
feat(history): expose local Node history API
```
