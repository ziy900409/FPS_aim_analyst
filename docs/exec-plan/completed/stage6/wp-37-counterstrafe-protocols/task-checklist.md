# WP-37 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(驗 WP-33 T-exit;覆核 §0 讀碼對帳八條發現;拍板 `cue` 落點 + reversal 狀態機歸屬(`DrillRunner` vs `TargetManager`)) | [T0-entry-gate.md](T0-entry-gate.md) | WP-33 T-exit ✅ | Low |
| ✅ | **T1** `counterstrafe-cued-v1`:`DrillEvent.cue` + `CueScheduleConfig(kind:'single')` + `TargetManager` 插入分支 + `CueOverlay` UI + `PeekWindowTs.cues` | [T1-cued-protocol.md](T1-cued-protocol.md) | T0 | Med |
| ✅ | **T2** `counterstrafe-reversal-v1`:`CueScheduleConfig(kind:'hold-reversal')` + 獨立 hold→reversal 狀態機 + 反向輸入離線判定 | [T2-reversal-protocol.md](T2-reversal-protocol.md) | T1 | **Med–High** |
| ✅ | **T3** `counterstrafe-free-v1`(Practice)+ `brakingDerivation.ts` + `counterstrafeMetrics.ts`(共同指標組裝) | [T3-free-and-metrics.md](T3-free-and-metrics.md) | T2 | Med |
| ✅ | **T-exit** 驗收:三個急停子協定不共用未分層總分;`analysis-counterstrafe.md` 定稿;文件對帳 | [T-exit-gate.md](T-exit-gate.md) | T3 | — |

**T2 是關鍵路徑與風險集中點**(本 WP 唯一新狀態機,須與既有 `peekTimeoutMs`/`presentationMs` 到期閘零干擾);一 task = 一垂直切片 = 一原子 commit 紀律不變。

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-37 狀態列更新,並確認四個測試家族 WP(34/35/36/37)T-exit 進度供 WP-38 entry 判斷。
- 單一閘:`npm run test:ci` 全綠。

## 本 WP 特有的四條紀律

1. **既有急停玩法零回溯相容成本**:`config.cue` 省略時 `TargetManager`/`DrillRunner`/`schema.ts` 逐位等同現行行為;既有 `TargetManager.test.ts`/`DrillRunner.test.ts`/`schema.test.ts`/`counterstrafe_ad_v1.test.ts`/`wp22-determinism.test.ts` **零修改**全綠是機械判準。
2. **速度門檻單一來源**:任何制動/命中精準相關判定一律讀 `MovementController.CS2_PROFILE.accuracyThreshold`,不得新增第二套門檻常數。
3. **既有時間線構念禁第二定義**:`counterHoldMs`/`releaseToFireMs`/`counterToFireMs` 一律複用 WP-32 已晉升的 `sync-v1`;`reactionMs`/`outcome`/`side` 分層一律複用 `peekWindows.ts`/`compute.ts` 既有欄位與型式。
4. **三協定禁合成總分**:`CounterstrafeMetrics` 與結果頁呈現皆不得出現跨指標的單一分數欄位。
