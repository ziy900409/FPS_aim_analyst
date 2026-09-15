# WP-69 T4 — Finalization、diagnostic retention、discard 與持久化防線

## Objective

把所有完成/離開路徑收斂到 `AttemptFinalizationGate`，保證 invalid 永不被當正式紀錄，timestamp 不可信時連 payload 都不存在。

## Steps

1. 在 snapshot、metrics、result/history/download/advance 之前呼叫 gate；禁止各 caller 以 `suspect` 自行分派。
2. `eligible-candidate` 沿用既有 payload/result/history/quality 流程，不放寬任何門檻。
3. `invalid-retained` 建立自述 `pauseOccurred=true` 的 diagnostic payload；依 T0 OQ-69.1 下載，basename 強制 `.invalid-paused`，Result 顯示不可採納狀態。
4. `discarded` 不呼叫 payload builder/metrics/download/history/replay；原地清 recorder/frame log，顯示 reason 與 Restart 動作。
5. `HistoryPersistence` 加 defense-in-depth exclusion `invalid-attempt`；download/replay/navigation helpers 各自拒絕 invalid/discarded misuse。
6. restart、換 drill/scene/weapon 與 app exit 的 paused-attempt 路徑全部走同一 gate，並測 race（舊 async save 不覆蓋新 attempt）。

## Definition of Done

- [ ] 三態對 payload builder、metrics、download、history、replay 的呼叫矩陣逐格有 spy 斷言
- [ ] invalid-retained JSON 可由 TS parser 與 Python `load_export()` 讀，且明確帶 `pauseOccurred=true`
- [ ] invalid/discarded 對 `HistoryClient.saveRun` 與正式 history/trend 的呼叫數均為 0
- [ ] discarded 路徑 payload builder/serializer 呼叫數為 0，recorder count 回 0
- [ ] clean assessment/practice 路徑與 T0 baseline 相同
- [ ] navigation 不可繞過 gate，且沒有 double finalization/download

## Commit

```text
feat(data): gate finalization by attempt disposition
```

