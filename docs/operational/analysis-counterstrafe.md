# Analysis Counterstrafe Contract

急停三協定(`counterstrafe-cued-v1`/`counterstrafe-reversal-v1`/`counterstrafe-free-v1`,FR-F10/F11/F12,WP-37)全部包裝既有 counter-strafe 玩法核心(WP-5/6/14/22/23/29/32 的 `MovementController`/`SimLoop`/`TargetManager`);本 WP 唯一淨新增是 `cue` 事件層(系統主動發出的方向提示)、`reversal` 的 hold→reversal 狀態機,以及制動(braking)推導模組。三協定的指標**不合成單一分數**——`CounterstrafeMetrics` 只輸出分層統計量(承 README §3 Failure modes 最後一列)。

## `cue` 事件語意

`DrillEvent` 新增 additive 變體(`src/data/DataRecorder.ts:23`):

```ts
{ type: 'cue'; t: number; direction: 'A' | 'D' }
```

`cue` 是量測時間戳,不是輸入或命中判定的一部分;它只記錄「系統在時刻 `t` 提示玩家應按方向 `direction`」這一事實。`SharedState.cues`(`src/state/SharedState.ts:284`)是一個暫態佇列——sim 分支 push、`SimLoop.recordCueEvents()`(`src/loop/SimLoop.ts:546-552`)在**同一 tick 的 visible 事件之前**匯出並清空,故同 tick 的 cue 恆先於 visible 落入匯出序列(D-37.3)。`TargetManager` 不直接依賴 `DataRecorder`——與既有「target 管理層不依賴資料層」慣例一致。

`PeekWindowTs.cues: readonly CueEvent[]`(`src/metrics/peekWindows.ts:9,28-29`)是零語意變更既有欄位的擴充:既有 drill(省略 `cue`)恆為空陣列。歸屬規則(`buildPeekWindows()`,`src/metrics/peekWindows.ts:79-105`):

- 若某 visible tick 本身帶 cue(hold-reversal 的第一個提示),該 window 的 `cues` = 從 visible 起至下一次 visible 前的所有 cue(涵蓋同 tick 的第一個提示與稍後的反向提示)。
- 否則(cued-v1 的 foreperiod 提示)沿用既有語意:`cues` = 上一次 visible 至本次 visible 之間的 cue。

這個同-tick 分流是 T2 交付時的 surprise(見 `progress.md` Surprises):T1 的初始語意只涵蓋 foreperiod cue,reversal 的第一個提示與 visible 同 tick,需要额外判斷才能正確歸屬而不擴張 frozen 的 `DrillEvent.cue` 契約(不加 target ID)。

## `CueScheduleConfig` 兩種 `kind`

`DrillConfig.cue?: CueScheduleConfig`(`src/drill/DrillConfig.ts:45-48,71-72`)是頂層 additive 欄位,省略時 `TargetManager`/`DrillRunner`/`schema.ts` 逐位等同現行行為:

```ts
export type CueScheduleConfig =
  | { readonly kind: 'single'; readonly holdDurationMs?: never }
  | { readonly kind: 'hold-reversal'; readonly holdDurationMs: number };
```

`schema.ts` 的 `validateCueSchedule()`(`src/drill/schema.ts:126-137`)在執行期強制這個辨別聯集的互斥/必填規則:`single` 不可帶 `holdDurationMs`;`hold-reversal` 必須帶正有限的 `holdDurationMs`。

**`single`**(`counterstrafe-cued-v1`,`src/drill/counterstrafe_cued_v1.ts`):`TargetManager.tick()` 在既有「kill → `pendingSpawnAtMs` 首次設定」的同一 tick 額外 push 一次 cue(`src/sim/TargetManager.ts:207-208`),方向取當下已決定的 `nextSide`——不新增取樣,不改 spawn delay/spawn 時刻/target side。`usesSeededSpawn || cue?.kind === 'single'` 的判斷(`TargetManager.ts:228`)確保 single-cue 分支仍走既有 `spawnWhenDue` 路徑。

**`hold-reversal`**(`counterstrafe-reversal-v1`,`src/drill/counterstrafe_reversal_v1.ts`):狀態機落在 `DrillRunner`,見下節。

## Reversal 狀態機(`DrillRunner.tickHoldReversal`)

落點決策見 D-37.1(`progress.md`):`DrillRunner` 已持有 `state.held`、running/ended 生命週期與 `resetAll()` 邊界,`TargetManager` 保持 spawn/可見性/`nextSide` 排程職責——輸入持續時間的判定不混入 target 管理。

狀態機(`src/drill/DrillRunner.ts:51-94`)只追蹤**目前可見**的目標,三個追蹤變數(`reversalTargetId`/`reversalHoldStartedAtMs`/`reversalCueSent`)全域於 runner 閉包,由 `resetReversalTracking()` 統一歸零:

1. 目標可見的第一個 tick(`target.id !== reversalTargetId`):以目標 `side` 決定 `direction`(`L→'A'`,`R→'D'`),同 tick push 第一個 cue,`reversalHoldStartedAtMs` 重設為 `null`,`reversalCueSent` 重設為 `false`。這個提示以「目標可見」為量測起點,不耦合 foreperiod/spawn 排程(hold-reversal 隔離制動能力與反向輸入 timing 的框架 v1 要求)。
2. 每個後續 tick 檢查 `state.held.left`/`state.held.right`(既有欄位,`MovementController` 同一來源,不新增第二套鍵位追蹤)是否仍持有 cue 方向對應鍵:
   - **放開即重算**:一旦鬆開,`reversalHoldStartedAtMs` 立刻設回 `null`。下次重新按住會從 `nowMs` 重新起算——沒有「累積按住時間」的語意,只有「連續按住時間」。
   - 持續按住且 `reversalHoldStartedAtMs === null` 時,以當前 `nowMs` 起算。
   - 達 `holdDurationMs` 的**同一 tick**,push 第二個 cue(方向相反),`reversalCueSent = true`,之後不再重複發送(每個目標最多兩個 cue)。
3. 目標撤除(不再 `alive && visible`)時整組狀態重設——下一個目標從頭開始追蹤,不會把不同目標或不連續按住時間累加在一起。

`DrillRunner.tick()` 的 running 分支順序是**先讓既有 `peekTimeoutMs`/`presentationMs` 到期閘撤除目標,再呼叫 `tickHoldReversal()`**(`DrillRunner.ts:163-165`)——不建立第二套逾時語意(OQ-S6-20 已 closed,見 `progress.md`)。目標在同一 tick 被撤除時,`tickHoldReversal()` 讀到「無存活可見目標」而立即重設,不會產生過期的 reversal cue。「執行反向輸入」的成功/失敗**不在 sim 內判定**,留給離線 metrics(`counter.key === cues[1].direction` 且 `tCounter` 落在反向提示之後),比照既有「sim 只記錄事件,合法性由離線 metrics 判定」慣例。

## 制動四量(`brakingDerivation.ts`)

**單一速度門檻來源聲明**:所有 gate 判定一律 `import { CS2_PROFILE } from '../sim/MovementController.ts'` 讀取 `CS2_PROFILE.accuracyThreshold`,不新增第二套門檻常數(C-D4 精神延伸)。測試以該動態值斷言,不複製字面數字(`src/metrics/brakingDerivation.test.ts:40-`「reads the current MovementController threshold instead of carrying a duplicate constant」)。

`deriveBrakingSamples(payload)`(`src/metrics/brakingDerivation.ts`)對每個 `PeekWindowTs` 掃描窗口:`windowTicks` = 自 `peek.tCounter` 起、至首發(`peek.tFirstShot`,若有)或窗口結束(`peek.tEnd`)為止的 tick 子集——**首發後的移動不屬於同一次瞄準/制動決策**,不繼續掃描(D-37.5)。四量全部相對 `tCounter` 計算:

| 量 | 定義 | 缺失時 |
|---|---|---|
| `timeToAccuracyGateMs` | 首次 `\|vx\| < accuracyThreshold` 的 tick 時刻 − `tCounter` | 無 gate tick → `undefined` + flag `no_accuracy_gate` |
| `zeroCrossingMs` | 首次 `sign(vx)` 相對 `tCounter` 時刻 `vx` 變號的 tick 時刻 − `tCounter` | 未變號 → `undefined` + flag `no_zero_crossing` |
| `stopDistanceU` | `tCounter` 時刻 `px` 與 accuracy-gate 命中 tick 的 `px` 差值絕對值 | 同上,依附 gate tick 是否存在 |
| `overReversalUPerS` | zero-crossing 之後(含該 tick)所有樣本 `\|vx\|` 的峰值 | 未變號 → `undefined`(同 `no_zero_crossing`) |

**不以零值補缺**是刻意設計:若首發發生於 zero-crossing 之前,額外標記 `window_truncated_by_fire`(與 `no_zero_crossing` 同時出現,`src/metrics/brakingDerivation.test.ts:51-`),讓離線分析知道這是「窗口被首發截斷」而非「玩家從未反向」。`peek.tCounter === undefined` 或該時刻無對應 tick 分別記 `no_counter`/`no_counter_tick`,同樣不補零值。`flags` 是唯一的資料品質信號來源,消費端不得把 `undefined` 誤讀為 0。

## 共同指標組裝(`counterstrafeMetrics.ts`)

`deriveCounterstrafeMetrics(payload)` 组裝 `CounterstrafeMetrics`,**不含任何單一分數欄位**(`src/metrics/counterstrafeMetrics.test.ts:49-`「exports only stratified measures, never a composite counter-strafe score」逐一斷言 keys 清單且明確排除 `score`)。所有 `SidedStat = { left: Stat; right: Stat; diff: number }` 一律以「依 `side` 分兩組跑 `stat()`」的既有型式產生(`compute.ts` 的 `leftRightSymmetry` 先例),不另創第二套統計聚合寫法:

| 欄位 | 來源 | 備註 |
|---|---|---|
| `cueToKeyMs?` | `peek.tCounter − peek.cues[0].t` | 僅當任一 peek 有 `cues`(即非 free-v1)才輸出;free-v1 恆為 `undefined`(見下節錨點提醒) |
| `releaseToFireMs`/`counterHoldMs`/`counterToFireMs` | `computeSyncMetrics(payload).rows`(WP-32 已晉升 `sync-v1`) | 不重推,直接讀 sync row |
| `timeToAccuracyGateMs`/`zeroCrossingMs`/`stopDistanceU`/`overReversalUPerS` | `deriveBrakingSamples(payload)` | 逐 peek 對應,`undefined` 樣本在 `stat()` 前先過濾(不計入 `n`) |
| `fireBeforeGateRate` | 有 compatible first fire 的 peeks 中,`residualSpeed >= accuracyThreshold` 的比例 | 分母 = 有首發的 peeks;無首發回傳 `0` |
| `firstShotHitRate` | 全部 peeks 中 `outcome === 'hit'` 的比例 | 分母 = 全部 peeks(含 no-shot),保留無首發的懲罰 |

三個 assessment/practice drill 對照(`src/drill/counterstrafe_{cued,reversal,free}_v1.ts`):

| drill | `mode` | `cue` | 用途 |
|---|---|---|---|
| `counterstrafe-cued-v1` | `assessment` | `{ kind: 'single' }` | FR-F10 主協定 |
| `counterstrafe-reversal-v1` | `assessment` | `{ kind: 'hold-reversal', holdDurationMs: 500 }` | FR-F11,隔離制動與反向輸入 timing |
| `counterstrafe-free-v1` | `practice` | 省略(等同既有 `counterstrafe_ad_v1` 自訂節奏) | FR-F12,僅 Practice,不進 Assessment 正式歷史 |

## `cueToKeyMs` 錨點提醒(OQ-S6-22)

`cueToKeyMs` 的反應構念錨點是**系統發出的 cue 時刻**(`peek.cues[0].t`),與 `hold-click-v1`/`hold-track-v1` 的反應構念錨點——**目標可見度 onset**(`t_detect − t_measurement_onset`)——不是同一個時間基準。這是**故意的不同名**(承 C-D4「既有構念不得有第二定義」的反面提醒:這裡刻意用不同名稱標記不同錨點,避免誤讀為同一構念的兩種算法):

- `cued-v1`:cue 在 foreperiod 起點,通常早於目標可見,故 `cueToKeyMs` > 對應的 `hold-click-v1` reaction latency。
- `reversal-v1`:第一個 cue 與目標可見同 tick,`cueToKeyMs` 在數值上會接近(但不等於)可見度錨點的反應時間——仍不可直接跨家族比較,因為兩者的統計口徑(分母/樣本篩選)不同。
- `free-v1` 無 cue,`cueToKeyMs` 恆為 `undefined`,不得以 0 或其他佔位值代入跨協定比較。

## Verified test evidence

- Cue schedule schema 互斥規則:`src/drill/schema.test.ts`(`validateCueSchedule` 分支,`single` 拒絕 `holdDurationMs`;`hold-reversal` 要求正有限值)。
- `cued-v1` 端到端 cue→visible→counter→fire 序列:`src/drill/counterstrafe_cued_v1.test.ts:16-`「supports the full cue → visible → counter → fire analysis sequence」。
- `reversal-v1` 端到端 cue→hold→reversal cue→counter→fire 序列(含放開重算計時器):`src/drill/counterstrafe_reversal_v1.test.ts:17-`「supports the full cue → hold → reversal cue → counter → fire analysis sequence」。
- 既有急停玩法零回溯相容成本(省略 `cue` 逐位等同現行行為):既有 `TargetManager.test.ts`/`DrillRunner.test.ts`/`schema.test.ts`/`counterstrafe_ad_v1.test.ts`/WP-22 determinism 基準,T1/T2 交付前後皆全綠(`progress.md` T1/T2 Progress)。
- 制動四量與 flags(含門檻單一來源、first-shot 截斷、未變號情境):`src/metrics/brakingDerivation.test.ts`。
- 共同指標組裝(cue-to-key 依協定家族輸出、free-v1 不輸出、無合成分數):`src/metrics/counterstrafeMetrics.test.ts`。
