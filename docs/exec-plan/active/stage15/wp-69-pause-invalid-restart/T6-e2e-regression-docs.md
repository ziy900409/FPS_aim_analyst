# WP-69 T6 — Live E2E、全量回歸與操作文件

## Objective

在真實 Edge Pointer Lock 與完整 orchestration 流程驗證使用者體驗、資料去向與 determinism，並把新術語/操作規則寫回權威文件。

## Steps

1. 增 focused Edge e2e：running Esc→pause invalid、Resume 取鎖+倒數、Restart fresh、invalid-retained、forced integrity discard。
2. 增 Session/Protocol/Pilot live flow：pause 後不前進、restart 同項、clean retry 才前進；spy/下載攔截核對檔名與數量。
3. 跑 typecheck、build、focused/full Vitest、regression、Edge Playwright `--workers=1`；全量 e2e 期間 repo/機器獨佔。
4. 跑 determinism matrix 30/60/144/240 FPS、零 pause identity、resume no-catch-up、same-seed restart parity。
5. 更新 `CONTEXT.md`（attempt/disposition/paused-invalid）、`docs/operational/` 操作流程、schema 說明與 WP progress；如有 code 變更跑 `npm run graph:update`。

## Definition of Done

- [x] A-69.1～A-69.12 每條都有 test 名稱/命令/輸出或真瀏覽器證據，記於 `progress.md`
- [x] Edge 實測 Resume 成功/失敗、fire 誤觸 0、pause input 0、Restart fresh 四項皆有數值
- [x] invalid diagnostic 恰一份 `.invalid-paused`；discard 下載 0 份；clean retry 恰一份正式 record
- [x] typecheck/build/full Vitest/regression/full Edge 全綠，既有 fixture 非預期 diff 為 0
- [x] `CONTEXT.md` 與 operational docs 清楚區分 pause invalid、suspect 與 discarded
- [x] `npm run graph:update` 完成且 graph files 為預期更新

## Commit

```text
test(wp-69): verify pause discard and restart lifecycle
```
