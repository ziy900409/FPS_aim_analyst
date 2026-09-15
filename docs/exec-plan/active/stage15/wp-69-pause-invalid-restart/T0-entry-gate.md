# WP-69 T0 — Entry gate：基線、編號、時間契約與 OQ

## Objective

在動 production code 前，重查 `WP-69/GD-46`、平行 WP-67 schema 狀態與所有完成路徑，並用 spike 凍結 pause time/integrity 契約。

## Steps

1. 讀 `CLAUDE.md` §3/§4、WP-69 README、GD-41/GD-46、WP-65 T-exit、WP-67 README/progress；重查全 repo 最大已採納 WP/GD。撞號則依 GD-15 順延並同步全部連結。
2. 對 `createSimLoop`、`createInputSampler`、`PointerLock`、`showResultAndTrackHistory`、三個 runner 跑 CodeGraph impact，將最新 callers/files 記入 `progress.md`。
3. 凍結 baseline：typecheck、build、focused unit/regression、Edge Pointer Lock focused e2e；e2e 期間 repo/機器獨佔。
4. 寫一個不進 production 的 spike，證明：(a) 不呼叫 pump 會 catch-up/re-anchor；(b) mapped active time 在 pause 每幀 pump 時 ticks=0；(c) resume 第一幀無 catch-up。
5. 以現有 clean fixtures 普查合法 tick/event ordering，凍結 `RecordingIntegrityReason` 封閉詞彙、pause fence 判準與允許誤差；不得讓 validator 拒絕既有乾淨 payload。
6. 關閉 OQ-69.1～69.3，記 owner 決定與影響；確認 WP-67 若先落地時的 rebase/fixture 做法。

## Definition of Done

- [ ] `progress.md §T0` 記錄 WP/GD 重查來源、最新 CodeGraph blast radius 與 baseline 的命令/exit code/count
- [ ] spike 以數值記錄 naive pause 與 mapped pause 的 tick/re-anchor 差異
- [ ] `RecordingIntegrityReason` 與 pause fence 判準有封閉表格，且現有 clean fixture 全數通過
- [ ] OQ-69.1～69.3 均有明確結論；沒有以「待實作再看」代替決策
- [ ] production code diff 為空

## Commit

```text
docs(wp-69): T0 entry gate for pause validity
```

