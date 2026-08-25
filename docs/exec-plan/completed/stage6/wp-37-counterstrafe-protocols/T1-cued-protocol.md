# T1 — counterstrafe-cued-v1(cue 事件 + UI + PeekWindowTs 擴充)

> Part of [WP-37 counterstrafe-protocols](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(cue schedule 落點拍板) |
| **Risk / Cplx** | **Med** / Med(觸碰 `TargetManager`/`DataRecorder` 熱路徑,但方向取自既有 `nextSide` 排程,不涉新幾何——零破壞不變式是主要風險所在) |
| **Touches** | MODIFY `src/data/DataRecorder.ts`(`DrillEvent` additive `{type:'cue'}`)、`src/drill/DrillConfig.ts`(新增 `cue?: CueScheduleConfig`)、`src/drill/schema.ts`(`validateCueSchedule`)、`src/sim/TargetManager.ts`(cue 插入分支)、`src/metrics/peekWindows.ts`(additive `cues[]`);ADD `src/ui/CueOverlay.ts`、`src/drill/counterstrafe_cued_v1.ts` |
| **狀態** | ✅ (2026-08-24) |

## Objective

交付 FR-F10 的核心:`DrillConfig.cue = { kind: 'single' }` 驅動 `TargetManager` 在既有「kill → foreperiod → 下一目標可見」排程的**foreperiod 起點**額外 push 一個 `cue` 事件(方向 = 該次 spawn 的既有排程側,不新增取樣);`CueOverlay` 在畫面顯示「A」或「D」提示直到目標可見;`buildPeekWindows` additive 產出 `cues[]` 供 T3 組裝 cue-to-key latency。無 `cue` config 的既有 drill 逐位不變。

## In scope

1. `DataRecorder.ts` 新增 additive `DrillEvent` 變體 `{ type: 'cue'; t: number; direction: 'A' | 'D' }`。
2. `DrillConfig.ts` 新增 top-level additive `cue?: CueScheduleConfig`(`kind: 'single' | 'hold-reversal'`;本 task 只用 `'single'`,`'hold-reversal'`/`holdDurationMs` 留給 T2 啟用)。
3. `schema.ts` 新增 `validateCueSchedule()`:驗證 `kind` 合法值;`kind==='single'` 時 `holdDurationMs` 必須省略(互斥檢查,依 T0 D-37.2 拍板結果)。
4. `TargetManager.ts` 新增分支:`config?.cue?.kind === 'single'` 時,在既有排定 `pendingSpawnAtMs`(foreperiod 起點)的**同一 tick**,額外 `recordEvent({ type: 'cue', t: nowMs, direction: nextSide === 'L' ? 'A' : 'D' })`(方向對應既有 `nextSide`,與即將 spawn 的 `visible.side` 保證一致)。既有無 `cue` config 的排程路徑**零改動**。
5. `peekWindows.ts` 的 `buildPeekWindows` 新增 additive `cues: readonly CueEvent[]`(過濾窗內 `type==='cue'` 事件,依時間排序;既有欄位/既有測試零修改)。
6. `CueOverlay.ts`(純 TS + DOM,D1):顯示大型方向指示(如「← A」/「D →」),`show(direction)`/`hide()` 介面;由 `main.ts` 依 `cue` 事件與下一個 `visible` 事件之間的區間控制顯隱(接線細節留給呼叫端,本 task 只交付元件本身 + 單元測試)。
7. `counterstrafe_cued_v1.ts`:比照 `drills/counterstrafe_ad_v1.json` 形狀,`mode: 'assessment'`,`cue: { kind: 'single' }`。
8. **零破壞閘(DoD 首項)**:`config.cue` 省略路徑程式碼不變(既有排程邏輯原樣);先跑既有決定性回歸全綠再進新功能測試。
9. 新決定性測試:同 seed 兩次 reset+run → cue 方向序列與既有 `visible.side` 序列逐位一致;`cues[0].t < visible.t`(cue 必須早於目標可見)。

## Out of scope

- `reversal-v1`(`kind:'hold-reversal'`,T2)。
- `free-v1`、制動推導、共同指標組裝(T3)。
- `CueOverlay` 在 `main.ts` 的實際接線(留給後續整合;本 task 交付元件 + 型別即可,避免 T1 範圍蔓延進主程式接線)。

## Steps

- [x] `DataRecorder.ts` 新增 `cue` 變體 + 既有 `DrillEvent` 消費端(`export.ts`/`compute.ts`/golden 測試)零修改確認。
- [x] `DrillConfig.ts`/`schema.ts` 擴欄 + 驗證測試(合法/非法/互斥規則)。
- [x] **既有決定性回歸全綠**(改動前基準 → 改動後重跑,證據記 progress)。
- [x] `TargetManager.ts` cue 插入分支 + 同 seed 重現測試 + 「cue 方向 === 對應 spawn 側」斷言。
- [x] `peekWindows.ts` additive `cues[]` + 既有 `PeekWindowTs` 消費端(`compute.ts`/`researchMetrics.ts`)零修改確認。
- [x] `CueOverlay.ts` 單元測試(`show`/`hide`/DOM 內容斷言)。
- [x] `counterstrafe_cued_v1.ts` + 端到端合成 drill 測試(cue → foreperiod → visible → counter → fire 全鏈可跑)。
- [x] `npx vitest run` 全綠。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | `cue` 省略:既有測試零修改全綠 | `TargetManager.test.ts`/`schema.test.ts`/`DrillRunner.test.ts`/`counterstrafe_ad_v1.test.ts` diff 為空 |
| ② | cue 方向與對應 spawn 側逐位一致 | 新增決定性測試綠 |
| ③ | `cues[0].t < visible.t`(cue 早於可見) | 合成 fixture 斷言 |
| ④ | `CueOverlay` 顯示/隱藏正確 | 單元測試 |
| ⑤ | `npm run test:ci` 全綠 | CI 輸出貼 progress.md |

## Commit

`feat(wp-37): T1 — counterstrafe-cued-v1(cue 事件 + CueOverlay + PeekWindowTs.cues)`
