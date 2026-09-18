# WP-69 T5 — Session、Protocol、Tracking Pilot 同步重測語意

## Objective

讓 invalid/discarded attempt 留在同一測試項，full restart 後重跑同 config/seed；任何正式 cursor/export/condition 都不被失效 attempt 消耗。

## Steps

1. Session completion 接 `AttemptDisposition`：invalid/discarded 不呼叫 `advance()`，phase 的 cursor/step 保持；restart 記 attempt +1。
2. Protocol completion 在 gate 通過前不呼叫 `completeCurrentCondition()`；invalid/discarded 不 push `exports[]`、不觸發 protocol complete。
3. TrackingPilotRunner 新增 retry-current-running/discard transition，不能重用會前進的 `abortCurrentBlock()`；audit 記 disposition/reason/attempt。
4. 三 runner 對外顯示一致文案與 restart callback；不得各自從 `meta.suspect` 或 `pointerLockLost` 重算 disposition。
5. 補多步 program、最後一個 protocol condition、practice/scored pilot、連續兩次 pause 與 retry 的單元/整合測試。

## Definition of Done

- [ ] 三 runner 在 invalid/discarded 後的 step/condition/block index 逐位不變
- [ ] full restart 後 attempt +1，drill/config/scene/weapon/seed 與前 attempt 相同
- [ ] invalid/discarded 不進 Session download、Protocol exports、Pilot completed payload 集合
- [ ] Pilot audit 保留每次失敗 attempt 的 reason/disposition，不覆寫前筆；正式 block record 只在 candidate 通過後成立
- [ ] 正常 clean flow 的 rest/advance/done callbacks 與既有測試逐位不變
- [ ] `SessionRunnerPhase`/`TrackingPilotRunnerPhase` 的 union 改動均由 `main.ts` 顯式型別檢查覆蓋

## Commit

```text
feat(session): retry invalid attempts without advancing
```

