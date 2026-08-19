# T2 — counterstrafe-reversal-v1(hold→reversal 狀態機)

> Part of [WP-37 counterstrafe-protocols](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1(`CueScheduleConfig`/`DrillEvent.cue`/`cues[]` 基礎設施) |
| **Risk / Cplx** | **Med–High** / Med–High(本 WP 唯一新狀態機;必須與既有 `peekTimeoutMs`/`presentationMs` 到期迴圈零干擾——耦合入既有 `DrillRunner.tick()` running 分支是主要風險所在) |
| **Touches** | MODIFY `src/drill/DrillConfig.ts`(`CueScheduleConfig.holdDurationMs`)、`src/drill/schema.ts`(`kind==='hold-reversal'` 時必填驗證)、依 T0 D-37.1 拍板落點 MODIFY `src/drill/DrillRunner.ts` **或** `src/sim/TargetManager.ts`(hold→reversal 追蹤);ADD `src/drill/counterstrafe_reversal_v1.ts` |
| **狀態** | ⬜ |

## Objective

交付 FR-F11:`DrillConfig.cue = { kind: 'hold-reversal', holdDurationMs }` 驅動一個獨立於既有 spawn/foreperiod 排程的狀態機——目標可見後追蹤玩家是否已按住第一個提示方向(取自既有 `nextSide`,比照 T1)對應鍵達 `holdDurationMs`;達標的當下 tick push 第二個 `cue` 事件(方向為相反鍵)。「反向輸入是否成功」不在 sim 內即時判定,留給 T3/離線 metrics 依 `counter.key === cues[1].direction` 且 `tCounter` 落在第二個 cue 之後判定。

## In scope

1. `DrillConfig.ts` 的 `CueScheduleConfig` 新增 `holdDurationMs?: number`(`kind==='hold-reversal'` 時必填)。
2. `schema.ts` 新增互斥/必填驗證:`kind==='single'` 禁 `holdDurationMs`;`kind==='hold-reversal'` 必須提供正數 `holdDurationMs`。
3. 依 T0 D-37.1 拍板落點,於 `DrillRunner.tick()`(讀 `state.held.left/right`)或 `TargetManager.tick()` 新增 hold→reversal 追蹤:目標可見後(即第一個 `cue` 事件已 push,比照 T1)啟動計時器;玩家對應鍵持續按住達 `holdDurationMs` 的當下 tick,`recordEvent({ type: 'cue', t: nowMs, direction: 相反鍵 })`。計時器在放開鍵時**歸零重算**(不累加斷續按住時間——框架 v1「持續時間」語意明確要求連續按住)。
4. 與既有 `peekTimeoutMs`/`presentationMs` 到期迴圈的共存規則(依 T0 OQ-S6-20 初判定案):若共存有風險,`counterstrafe_reversal_v1.ts` 預設不設 `peekTimeoutMs`,並在 `analysis-counterstrafe.md` 明文記載「reversal 協定不建議與逾時撤除並用」。
5. `counterstrafe_reversal_v1.ts`:`mode: 'assessment'`,`cue: { kind: 'hold-reversal', holdDurationMs: <佔位值,WP-39 pilot 前的暫定值> }`。
6. **零破壞閘(DoD 首項)**:`config.cue` 省略或 `kind==='single'` 路徑程式碼不變;先跑既有決定性回歸 + T1 決定性回歸全綠再進新功能測試。

## Out of scope

- `free-v1`、制動推導、共同指標組裝、反向輸入成功/失敗的離線判定邏輯本身(留給 T3;本 task 只保證兩個 `cue` 事件與時序正確落地)。
- `holdDurationMs` 的凍結數值(WP-39 pilot)。

## Steps

- [ ] `DrillConfig.ts`/`schema.ts` 擴欄 + 驗證測試(合法/非法/必填規則)。
- [ ] **既有 + T1 決定性回歸全綠**(改動前基準 → 改動後重跑,證據記 progress)。
- [ ] hold→reversal 追蹤實作(依 T0 拍板落點)+ 決定性測試:同 seed → 反向 cue 時刻逐位一致;放開鍵重算計時器的合成 fixture(按 0.5×holdDurationMs → 放開 → 重新按住 → 應從頭計時,不是累加)。
- [ ] `peekTimeoutMs`/`presentationMs` 共存合成 fixture(依 T0 OQ-S6-20 初判,驗證或明文排除併用)。
- [ ] `counterstrafe_reversal_v1.ts` + 端到端合成 drill 測試(cue① → hold 達標 → cue② → 反向 counter → fire 全鏈可跑)。
- [ ] `npx vitest run` 全綠。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | `cue` 省略或 `kind==='single'`:既有 + T1 測試零修改全綠 | diff 為空 |
| ② | 同 seed → 反向 cue 時刻逐位一致 | 新增決定性測試綠 |
| ③ | 放開鍵重算計時器(非累加) | 合成 fixture 斷言 |
| ④ | 與 `peekTimeoutMs`/`presentationMs` 共存規則驗證或明文排除 | progress.md 記錄 + 對應測試 |
| ⑤ | `npm run test:ci` 全綠 | CI 輸出貼 progress.md |

## Commit

`feat(wp-37): T2 — counterstrafe-reversal-v1(hold→reversal 狀態機)`
