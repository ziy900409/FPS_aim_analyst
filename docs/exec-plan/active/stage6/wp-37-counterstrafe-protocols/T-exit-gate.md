# T-exit — 驗收 + 文件定稿

> Part of [WP-37 counterstrafe-protocols](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T3 |
| **Risk / Cplx** | — |
| **Touches** | `docs/operational/analysis-counterstrafe.md`、[CONTEXT.md](../../../../../CONTEXT.md)、本 WP README/task-checklist、[../README.md](../README.md) |
| **狀態** | ⬜ |

## Objective

收斂 WP-37:驗證框架 v1 對急停三協定的驗收條件——「三個急停子協定不共用未分層總分」——在最終落地的程式碼上仍成立;定稿 `analysis-counterstrafe.md`;完成文件對帳;把 stage6 README 的 WP-37 狀態翻 ✅,開放 WP-38 entry 的其中一個條件(尚需 WP-34/35/36 一併 T-exit)。

## In scope

1. 執行 [../README.md](../README.md) 驗收條件覆核(對照框架 v1 §"v1 驗收條件"清單中與急停測試相關的一條)。
2. 定稿 `docs/operational/analysis-counterstrafe.md`:`cue` 事件語意、`CueScheduleConfig` 兩種 `kind`(`single`/`hold-reversal`)、reversal 狀態機(含放開鍵重算計時器的規則)、制動四量公式(含 `CS2_PROFILE.accuracyThreshold` 單一來源聲明)、共同指標組裝與型式來源(`sync-v1`/`leftRightSymmetry`)、`cueToKeyMs` 錨點與 `hold-click-v1`/`hold-track-v1` 錨點不同的明文提醒(OQ-S6-22)。
3. [CONTEXT.md](../../../../../CONTEXT.md) 補新術語:`cue` 事件、`CueScheduleConfig`、`holdDurationMs`、`timeToAccuracyGateMs`/`zeroCrossingMs`/`stopDistanceU`/`overReversalUPerS`、`counterstrafe-cued-v1`/`-reversal-v1`/`-free-v1`。
4. [../README.md](../README.md) §3 WP 索引:WP-37 狀態翻 ✅。
5. 覆核 §7 Open Questions 是否全部關閉或明確移交(OQ-S6-19/20/21/22)。

## Out of scope

- WP-34/35/36/38 的任何工作。

## Steps

- [ ] 逐一覆核框架 v1 急停測試相關驗收條件,附證據連結(測試檔案/合成 fixture 名稱)。
- [ ] 定稿 `analysis-counterstrafe.md`。
- [ ] 回寫 CONTEXT.md 新術語。
- [ ] 翻 stage6 README §3 WP-37 狀態。
- [ ] 覆核 §7 OQ 逐條關閉或移交狀態。
- [ ] 最終 `npm run test:ci` 全綠證據貼 progress.md。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 「三個急停子協定不共用未分層總分」驗收條件通過 | T3 端到端合成 drill 測試 + 本 task 覆核連結 |
| ② | `analysis-counterstrafe.md` 定稿 | 文件存在且涵蓋 §Objective 列出的五項內容 |
| ③ | CONTEXT.md 新術語回寫 | diff 可見 |
| ④ | stage6 README WP-37 狀態翻 ✅ | diff 可見 |
| ⑤ | `npm run test:ci` 全綠 | 貼原始輸出到 progress.md |

## Commit

`docs(wp-37): T-exit — counterstrafe-protocols 驗收 + analysis-counterstrafe.md 定稿 + 文件對帳`
