# WP-37 — counterstrafe-protocols:急停三協定包裝(cued/reversal/free)+ 制動/對稱指標

> stage6 執行計畫的 WP 子資料夾。上層 spec:[../README.md](../README.md) · 需求 source of truth:[../aim-assessment-framework-v1.md](../aim-assessment-framework-v1.md) · 決議依據:**GD-22**(stage6 採納)+ T0 讀碼/落點決策已於 2026-08-24 完成。
> Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **目標** | 交付 FR-F10(`counterstrafe-cued-v1`)+ FR-F11(`counterstrafe-reversal-v1`)+ FR-F12(`counterstrafe-free-v1`,Practice only)+ FR-F13(急停共同指標:輸入反應/制動/射擊同步/首發/L-R 對稱) |
| **里程碑** | 無獨立里程碑;是 WP-38(診斷推薦)entry 條件之一(需四個測試家族 WP 皆 T-exit) |
| **相依** | **WP-33 T-exit ✅**(共同契約:`AssessmentMode`、`Meta.assessment`、`CompatibilityKey`/`checkQualityGate`);與 WP-34/35/36 並行,無檔案熱區重疊([../README.md §5](../README.md)) |
| **對應 FR** | FR-F10 + FR-F11 + FR-F12 + FR-F13 |
| **估時** | 2–3 dev-days([../README.md §6](../README.md));讀碼發現既有 counter-strafe 引擎(WP-5/6/14/23/29/32)已經覆蓋本 WP 一半以上的構念——`PeekWindowTs`(`tCounter`/`counterKey`/`tRelease`/`releaseKey`/`tFirstShot`)與已晉升的 `sync-v1`(`releaseToFireMs`/`counterHoldMs`/`counterToFireMs`)、`compute.ts` 的 `fireTimingAlignmentMs`/`leftRightSymmetry` 皆可直接複用;真正的淨新增只有(a)「系統提示方向」的 cue 事件與 UI、(b)`reversal` 的固定持續按住→反向提示狀態機、(c)制動量化(time-to-accuracy-gate/zero-crossing/停止距離/過度反向量)。估時落在下緣,由 T0/T1 讀碼結果收斂 |
| **狀態** | ✅ T0~T3+T-exit 全數完成(2026-08-24);`analysis-counterstrafe.md` 契約定稿,開放 WP-38 entry 最後一個條件(WP-34/35/36/37 全數 T-exit) |

---

## 0. 讀碼對帳(規劃階段,2026-08-19;決定本 WP 淨新增工作量)

> 動筆前對 `src/sim/MovementController.ts`、`src/sim/TargetManager.ts`、`src/drill/DrillRunner.ts`、`src/drill/DrillConfig.ts`、`src/drill/schema.ts`、`src/data/DataRecorder.ts`、`src/metrics/peekWindows.ts`、`src/metrics/compute.ts`、`src/metrics/researchMetrics.ts`、`src/ui/ResultScreen.ts`、`drills/counterstrafe_ad_v1.json` 的讀碼結果。目的與 WP-33/34/35/36 §0 同:找出框架 v1 假設為新能力的項目裡,有多少是既有構念的延伸,避免虛報工作量或漏看真正的缺口。

| # | 框架 v1 / stage6 README 假設 | 讀碼發現 | 對本 WP 的影響 |
|---|---|---|---|
| **0-1** | 「急停三協定包裝」隱含急停玩法本身(peek/counter-strafe/首發)已存在 | `drills/counterstrafe_ad_v1.json` + [`MovementController`](../../../../../src/sim/MovementController.ts)(CS2-like friction/accelerate 積分 + `accuracyThreshold=88` 速度 gate)+ [`SimLoop`](../../../../../src/loop/SimLoop.ts)(`residualSpeed < MOVEMENT_PROFILE.accuracyThreshold` 命中精準閘)自 WP-5/14/22 起即production 路徑,`counterstrafe_ad_v1` 是 63+ drill 決定性回歸的基準之一 | **零新增玩法工程量**。三個 Assessment/Practice 協定都是這套既有玩法的**包裝**,不重寫移動/開火/命中判定;T0 DoD 只需一條讀碼確認,不是新設計 |
| **0-2** | 「輸入反應(cue-to-key、release latency、counter-input latency)」是待新增的推導 | [`buildPeekWindows`](../../../../../src/metrics/peekWindows.ts) 已產出 `tCounter`/`counterKey`(玩家反向鍵按下時刻)、`tRelease`/`releaseKey`(鍵位轉換的 tick-derived 錨點,`releaseAnchor`)——這正是框架 v1 「counter-input latency」與「release latency」的既有骨架;唯獨「cue-to-key latency」需要一個**系統主動發出的方向提示時刻**作分母,而目前**沒有任何 cue 機制**(grep `cue\|prompt` 於 `src/ui/`、`src/main.ts` 零命中;目標只是視覺出現,玩家看到目標所在側就是唯一線索) | **淨新增僅「cue 事件本身」**:一個新的 `DrillEvent{type:'cue'}`(方向 + 時刻)+ 對應 UI 顯示,一旦有了 `t_cue`,`cue-to-key = tCounter − t_cue` 可直接用既有 `tCounter` 相減得到,不需要另建反應推導函式 |
| **0-3** | 「制動(time-to-accuracy-gate、zero crossing、停止距離、過度反向量)」是待新增的推導 | `TickRecord`(`ticks[].vx`/`px`)逐 tick 記錄速度與位置,`MovementController.CS2_PROFILE.accuracyThreshold`(=88 u/s)是**唯一**速度 gate 定義來源([`SimLoop.ts`](../../../../../src/loop/SimLoop.ts) 開火精準判定與 [`ResultScreen.ts`](../../../../../src/ui/ResultScreen.ts) 的 `residualSpeed` 分佈呈現皆讀同一常數);但目前**沒有**任何函式從 `tCounter` 起沿 `windowTicks` 逐 tick 找「首次 `\|vx\| < accuracyThreshold`」(accuracy gate)、「首次 `vx` 變號」(zero crossing)或「`vx` 變號後的峰值反向量」(over-reversal) | 這是本 WP**唯一的新指標推導模組**:新增 `src/metrics/brakingDerivation.ts`,消費 `PeekWindowTs.tickRange`/`tCounter` 與既有 `TickRecord.vx/px`,**沿用** `CS2_PROFILE.accuracyThreshold`(不新增第二套門檻常數,C-D4 精神延伸) |
| **0-4** | 「射擊同步(fire alignment、residual speed、門檻前開火率)」是待新增的推導 | `fireTimingAlignmentMs`(`compute.ts` 既有 `firstFire.t − counter.t`)、`DrillEvent{type:'fire'}.residualSpeed`(逐發已記錄)、以及 WP-32 已晉升的 `sync-v1`(`releaseToFireMs`/`counterHoldMs`/`counterToFireMs`,消費同一組 `tCounter`/`tRelease`/`tFirstShot`)三者合計已覆蓋此構念的絕大部分計算面 | **零到低新增工程量**:「門檻前開火率」= 對既有 `firstFire.residualSpeed` 與 `CS2_PROFILE.accuracyThreshold` 做比例聚合(單行邏輯),其餘複用既有欄位,不重推 |
| **0-5** | 「首發(first-shot hit、開火角度偏差、合法射速)」是待新增的推導 | `PeekWindowTs.outcome`(`hit`/`timeout`/`no_shot`)+ `DrillEvent{type:'fire'}.offsetDeg`(開火角度偏差,已記錄)+ `WeaponConfig` 的射速合法性由既有 `SimLoop` 開火節奏鏈把關(彈匣/`nextFireT`) | **零新增**,全部複用既有欄位與既有合法性判定,T3 只需組裝呈現 |
| **0-6** | 「對稱(左右側各自的 n、分布與差值)」是待新增的推導 | [`computeMetrics`](../../../../../src/metrics/compute.ts) 已有 `leftRightSymmetry: { left, right, diff }`(對 `reactionMs` 依 `visible.side` 分層,`stat()` 聚合)——是一個**已驗證的既有型式**,但目前只套用在 `counterReactionMs` 一項,尚未套用到制動/`counterToFireMs` 等新構念 | **複用型式,不複用實例**:T3 對 braking 與 sync 的新增指標各自套用同一個「依 `side` 分兩組跑 `stat()`,回傳 `{left, right, diff}`」的既有型式(不得另創第二套統計聚合寫法) |
| **0-7** | `counterstrafe-free-v1` 是待新增的協定變體 | `drills/counterstrafe_ad_v1.json` 本身已是「玩家自訂節奏(無 cue、無強制窗口)」的既有形狀;`DrillConfig.mode?: AssessmentMode`(WP-33 已交付)可直接標記 `'practice'`;`checkCompatibility()`/相容鍵層已內建 Assessment/Practice 不進同一歷史的語意(WP-33 契約) | **近乎零新增**:`counterstrafe-free-v1` = 既有 `counterstrafe_ad_v1.json` 複製一份、`drillId` 改名、`mode: 'practice'`;唯一要新增的是確保 Practice 匯出**不**呼叫 `buildCompatibilityKey()`/不進正式歷史(UI 呼叫端邏輯,非資料層新構念) |
| **0-8** | `cued` 與 `reversal` 的方向提示可以共用同一個 cue 機制,只是排程不同 | `TargetManager.tick()` 的既有「kill → `pendingSpawnAtMs`(spawnDelay/foreperiod)→ spawn 下一目標可見」管線([`TargetManager.ts`](../../../../../src/sim/TargetManager.ts))已經是框架 v1 事件時間線 `cue → foreperiod → first_visible` 的**後半段**;`cued-v1` 只需在這段 foreperiod **開始時**插入一次 cue 事件(方向 = 即將 spawn 側,由既有 `sequence.alternation`/`nextSide` 已決定,不需另猜);`reversal-v1` 則需要**與目標可見脫鉤**的獨立排程(先發第一個 cue → 玩家按住固定 `holdDurationMs` → 發第二個反向 cue → 判定反向輸入),因為框架 v1 明文要求 reversal 協定「隔離制動能力與反向輸入 timing」,不能綁在既有 spawn/foreperiod 時序上 | `cued-v1` 的 cue 是**既有 spawn 排程的附加標記**(低風險,類似 WP-34/35 的「新語意用新欄位,不改既有分支」);`reversal-v1` 的 cue 排程是**獨立於 spawn 的第二個時間軸**(仍要 target 存在以承接首發,但方向提示的時刻由固定 `holdDurationMs` 決定,不是由 `pendingSpawnAtMs` 決定)——這是本 WP 唯一需要新狀態機的部分,對齊 WP-35 fire-gating(§2③b)「新語意獨立判定層,不疊加進舊欄位」的先例 |

**結論**:FR-F10/F12/F13 的絕大部分是既有引擎(移動/開火/命中/`sync-v1`/`leftRightSymmetry`)的複用與組裝;真正的淨新增只有三項——① `cue` 事件與 UI(F10/F11 共用)、② `reversal` 的固定持續→反向提示狀態機(F11 專屬)、③ 制動推導模組(F13 專屬,三協定共用)。這個收斂決定了 T1/T2/T3 的切法(見 §4),記入 Decision Log D-37.1(T0 執行時定案)。

---

## 1. 需求對應

| FR | 內容 | 落點 |
|---|---|---|
| FR-F10 | `counterstrafe-cued-v1`:系統提示 A/D,玩家依提示完成 peek + 反向制動 + 首發;起始方向與提示時間可精確記錄 | T1 |
| FR-F11 | `counterstrafe-reversal-v1`:提示方向按住達固定持續時間 → 收到反向提示 → 執行反向輸入,隔離制動能力與反向輸入 timing | T2 |
| FR-F12 | `counterstrafe-free-v1`:玩家自訂 peek 節奏與開火時機,僅供 Practice,不進正式進步判定 | T3 |
| FR-F13 | 急停共同指標:輸入反應(cue-to-key/release/counter-input latency)、制動(time-to-accuracy-gate/zero crossing/停止距離/過度反向量)、射擊同步(fire alignment/residual speed/門檻前開火率)、首發、L/R 對稱 | T1(cue-to-key)+ T3(制動推導 + 對稱包裝 + 其餘複用組裝) |

### 1.1 範圍

**In scope**:

```
src/data/DataRecorder.ts                  ← MODIFY 新增 DrillEvent additive `{type:'cue'; t; direction:'A'|'D'}` [T1]
src/drill/DrillConfig.ts                  ← MODIFY 新增 top-level additive `cue?: CueScheduleConfig`            [T1/T2]
src/drill/schema.ts                       ← MODIFY validateCueSchedule(additive,不動既有 sequence/timing 驗證)  [T1/T2]
src/sim/TargetManager.ts                  ← MODIFY cued 分支:foreperiod 起點插 cue 事件(不改既有 spawn 邏輯)    [T1]
src/drill/DrillRunner.ts                  ← MODIFY reversal 分支:獨立 hold→reversal 排程狀態機                 [T2]
src/metrics/peekWindows.ts                ← MODIFY additive `cues: readonly CueEvent[]`(零語意變更既有欄位)    [T1/T2]
src/metrics/brakingDerivation.ts          ← ADD time-to-accuracy-gate/zero-crossing/停止距離/過度反向量        [T3]
src/metrics/counterstrafeMetrics.ts       ← ADD 組裝共同指標(複用 sync-v1/leftRightSymmetry 型式,C-D4)        [T3]
src/drill/counterstrafe_cued_v1.ts        ← ADD drill config(比照既有 *_v1.ts 形狀)                           [T1]
src/drill/counterstrafe_reversal_v1.ts    ← ADD drill config                                                   [T2]
src/drill/counterstrafe_free_v1.ts        ← ADD drill config(既有 counterstrafe_ad_v1 複製 + mode:'practice')  [T3]
src/ui/CueOverlay.ts                      ← ADD 方向提示 DOM overlay(純 TS + DOM,D1)                          [T1]
docs/operational/analysis-counterstrafe.md ← ADD 契約文件(cue 語意/reversal 狀態機/制動公式/對稱包裝)          [T1/T2/T3/T-exit]
```

**Out of scope**(附觸發條件):

- **移動/開火/命中判定的任何變更**——`MovementController`/`SimLoop` 的既有急停玩法逐位不變;本 WP 只加 cue 層與離線指標,觸發條件 = 未來若要改變 counter-strafe 物理本身(不在框架 v1 範圍內)。
- **`hold-click-v1`/`hold-track-v1`/`spider-shot-v1` 的任何機制**——WP-34/35/36,無檔案熱區重疊。
- **診斷規則對急停指標的解讀**——WP-38,本 WP 只交付指標數值本身。
- **`counterstrafe-free-v1` 的自適應難度**——框架 v1 明文列為未來 Practice 延伸;v1 只需標記 `mode:'practice'`,不做自適應。
- **`holdDurationMs`/cue lead time 的凍結數值**——WP-39 pilot 待決,本 WP 只交付「可配置 + 可記錄」的機制。
- **急停三子協定的合成總分**——框架 v1 明文不做,對稱指標各自報告,不合併。

---

## 2. 關鍵契約(T0 已凍結)

### ① `cue` 事件:additive `DrillEvent` 變體 + `PeekWindowTs.cues` 擴充(承 §0-2/§0-8)

```ts
// src/data/DataRecorder.ts                                                     [T1,additive]
export type DrillEvent =
  | { /* …既有變體不變… */ }
  | { type: 'cue'; t: number; direction: 'A' | 'D' };

// src/metrics/peekWindows.ts                                                   [T1/T2,additive;零語意變更既有欄位]
export type CueEvent = Extract<DrillEvent, { type: 'cue' }>;
export interface PeekWindowTs {
  // …既有欄位不變…
  /** 本窗內的 cue 事件,依時間排序。`cued-v1` 恰 1 筆;`reversal-v1` 恰 2 筆(hold 提示 + 反向提示);
   *  `free-v1`/既有 drill 恆為空陣列(零回溯相容成本)。 */
  readonly cues: readonly CueEvent[];
}
```

`cued-v1` 的 cue-to-key latency = `peek.counter!.t - peek.cues[0].t`(不新增推導函式,對既有 `PeekWindowTs` 欄位做一次減法即可,呼叫端在 T3 組裝)。

### ② `cued-v1` 的 cue 插入點:既有 foreperiod 起點,方向取自既有排程(承 §0-8)

```ts
// src/drill/DrillConfig.ts                                                     [T1/T2,additive]
export type CueScheduleConfig =
  | { readonly kind: 'single'; readonly holdDurationMs?: never }
  | { readonly kind: 'hold-reversal'; readonly holdDurationMs: number };
export interface DrillConfig {
  // …既有欄位不變…
  /** 急停 cue 排程(WP-37,FR-F10/F11)。省略 = 既有 drill 零回溯相容成本(無 cue 事件產生)。 */
  cue?: CueScheduleConfig;
}
```

`kind: 'single'` 時,`TargetManager` 在既有「kill → `pendingSpawnAtMs` 排定」的**同一 tick**額外 push 一個 `cue` 事件,方向取自即將 spawn 的側(`nextSide`,既有排程已決定,不需另猜/另取樣)。**不改**既有 spawn/foreperiod/`spawnDelayMs` 語意,只是在既有轉角外加一次事件蓋章。

### ③ `reversal-v1` 的獨立 hold→reversal 狀態機(承 §0-8;本 WP 唯一新狀態機)

`kind: 'hold-reversal'` 時,`DrillRunner` 在目標可見後獨立追蹤「玩家是否已按住 `cues[0].direction` 對應鍵達 `holdDurationMs`」;達標的**當下 tick** push 第二個 `cue` 事件(`direction` = 相反鍵)。判定只讀 `state.held.left/right`(既有欄位,`MovementController` 同一來源),**不**新增第二套鍵位追蹤。`schema.ts` 須將此辨別聯集做執行期驗證:`single` 不可帶 `holdDurationMs`;`hold-reversal` 必須帶正有限的 `holdDurationMs`。「執行反向輸入」的成功/失敗留給 T3 離線判定(`counter.key === cues[1].direction` 且 `tCounter` 落在反向提示之後),不在 sim 內即時判定合格/不合格(比照既有「sim 只記錄事件,合法性由離線 metrics 判定」慣例,例如 `outcome`/`flags` 皆離線算)。

### ④ 制動推導:單一速度門檻來源,新模組不重推既有玩法幾何(承 §0-3)

```ts
// src/metrics/brakingDerivation.ts                                             [T3,新增]
import { CS2_PROFILE } from '../sim/MovementController.ts';
// 所有 gate 判定必須讀 CS2_PROFILE.accuracyThreshold,不得另訂第二套速度門檻常數(C-D4 精神延伸)。
```

四個量全部從 `peek.tCounter` 起沿 `windowTicks`(`peek.tickRange` 對應的 `ticks[]` 子集)逐 tick 掃描 `vx`/`px`:

- `timeToAccuracyGateMs`:首次 `|vx| < CS2_PROFILE.accuracyThreshold` 的 tick 時刻 − `tCounter`。
- `zeroCrossingMs`:首次 `sign(vx)` 相對 `tCounter` 時刻的 `vx` 變號的 tick 時刻 − `tCounter`。
- `stopDistanceU`:`tCounter` 時刻 `px` 與 accuracy-gate 命中 tick 的 `px` 差值絕對值。
- `overReversalUPerS`:zero-crossing 之後、窗口結束前的 `|vx|` 峰值(若未變號則為 `undefined`,記 `no_zero_crossing` flag)。

### ⑤ 共同指標組裝:複用既有型式,不重造統計聚合(承 §0-4/§0-5/§0-6)

```ts
// src/metrics/counterstrafeMetrics.ts                                          [T3,新增,複用既有函式與型式]
export interface SidedStat { left: Stat; right: Stat; diff: number; }  // 型式 = compute.ts 既有 leftRightSymmetry
export interface CounterstrafeMetrics {
  cueToKeyMs?: SidedStat;                 // 僅 cued/reversal 有 cues[0];free 為 undefined
  releaseToFireMs: SidedStat;             // 複用 sync-v1 SyncRow
  counterHoldMs: SidedStat;               // 複用 sync-v1 SyncRow
  counterToFireMs: SidedStat;             // 複用 sync-v1 SyncRow
  timeToAccuracyGateMs: SidedStat;        // 複用 brakingDerivation(④)
  zeroCrossingMs: SidedStat;
  stopDistanceU: SidedStat;
  overReversalUPerS: SidedStat;
  fireBeforeGateRate: number;             // firstFire.residualSpeed >= accuracyThreshold 的比例
  firstShotHitRate: number;               // 複用既有 outcome
}
```

`SidedStat` 一律以「依 `peek.visible.side` 分兩組 `stat()`」的既有型式產生(compute.ts `leftRightSymmetry` 先例),**不得**另創第二套統計聚合寫法。

---

## 3. Failure modes

| 觸發 | 影響 | 處理 |
|---|---|---|
| `cue` 事件插入點與既有 `pendingSpawnAtMs`/`spawnDelayMs`/`nextSide` 排程耦合,誤判方向或時刻 | 既有 63+ drill(含 `counterstrafe_ad_v1` 決定性回歸基準)可能被污染;`cued-v1` 的方向提示與實際 spawn 側不一致 | T1 DoD 首項 = `config.cue` 省略時逐位等同現行行為;既有 `TargetManager.test.ts`/`DrillRunner.test.ts`/`schema.test.ts` **零修改**全綠;新增決定性測試斷言「cue 方向 === 該次 spawn 的 `visible.side`」 |
| `reversal-v1` 的 hold→reversal 狀態機與既有 `peekTimeoutMs`/`presentationMs` 推進政策(`DrillRunner.tick` 同一 running 分支)互相干擾 | 兩個獨立到期閘同時作用可能導致目標在玩家完成反向輸入前被撤除,污染反向輸入判定的樣本 | T2 DoD:合成 fixture 覆蓋「`holdDurationMs` 與 `peekTimeoutMs` 同時配置」情境,斷言兩個閘互不搶跑(reversal cue 排程不依賴 `peekTimeoutMs` 的到期迴圈,獨立追蹤變數);`reversal-v1` drill config 預設不設 `peekTimeoutMs`,避免組合爆炸 |
| 制動推導(§2④)在「玩家按住反向鍵但目標已被上一 tick 的 fire 擊殺」邊界情境下,`windowTicks` 提前截斷,`zeroCrossingMs`/`overReversalUPerS` 誤判為 `undefined` | 制動指標樣本量被低估,分佈右尾(慢速反向)缺失,`n` 與真實不符 | T3 合成 fixture 覆蓋「fire 發生在 zero-crossing 之前」與「fire 發生後窗口立即結束」兩案例,斷言 flag(`no_zero_crossing`/`window_truncated_by_fire`)正確標記而非靜默回傳 0 |
| `counterstrafe-free-v1` 的 Practice 匯出被上層(main.ts/研究管線)誤呼叫 `buildCompatibilityKey()`/併入 Assessment 歷史 | 直接違反 WP-33 契約(Practice 不進正式 baseline) | T3 DoD:斷言 `mode:'practice'` 的匯出在既有 UI/匯出呼叫路徑中不觸發 `buildCompatibilityKey()`(讀碼確認呼叫端已有 `mode` 判斷,若無則本 WP 補一個守門斷言,不新增機制) |
| `brakingDerivation.ts` 誤植第二套 `accuracyThreshold` 常數(而非 import `CS2_PROFILE`) | 若未來 `MovementController` 調整移動 profile(例如引入 VALORANT profile),制動指標與命中精準閘脫鉤,產生「制動已達標但命中判定仍認為未停穩」的矛盾 | T3 DoD:`brakingDerivation.ts` 的門檻常數以 `import { CS2_PROFILE } from '../sim/MovementController.ts'` 讀取,測試以 `CS2_PROFILE.accuracyThreshold` 動態值(非硬編字面數字)斷言,避免測試也複製第二份常數 |
| 三個急停子協定的指標各自呈現時,不小心合成一個「急停總分」 | 直接違反框架 v1「不以三個任務合成跨構念總分」的明確不做條款 | T3/T-exit 驗收:`CounterstrafeMetrics` 型別**不含**任何單一分數欄位;結果頁呈現測試斷言不存在合成分數 |

---

## 4. Task 索引

| Task | 檔案 | Objective | 相依 | Risk | 估時 |
|---|---|---|---|---|---|
| **T0** | [T0-entry-gate.md](T0-entry-gate.md) | 驗 WP-33 T-exit;覆核 §0 讀碼對帳八條發現;拍板 `cue`/`CueScheduleConfig` 落點與 `reversal` 狀態機歸屬(`DrillRunner` vs `TargetManager`);零程式碼 | WP-33 T-exit | Low | 0.25–0.5d |
| **T1** | [T1-cued-protocol.md](T1-cued-protocol.md) | `counterstrafe-cued-v1`:`DrillEvent.cue` + `CueScheduleConfig(kind:'single')` + `TargetManager` 插入分支 + `CueOverlay` UI + `PeekWindowTs.cues` | T0 | **Med**(觸碰 `TargetManager`/`DataRecorder` 熱路徑,但方向取自既有排程,無新幾何) | 0.75–1d |
| **T2** | [T2-reversal-protocol.md](T2-reversal-protocol.md) | `counterstrafe-reversal-v1`:`CueScheduleConfig(kind:'hold-reversal', holdDurationMs)` + 獨立 hold→reversal 狀態機 + 反向輸入離線判定 | T1 | **Med–High**(本 WP 唯一新狀態機,需與既有 `peekTimeoutMs`/`presentationMs` 到期閘零干擾) | 0.75–1d |
| **T3** | [T3-free-and-metrics.md](T3-free-and-metrics.md) | `counterstrafe-free-v1`(Practice)+ `brakingDerivation.ts`(制動四量)+ `counterstrafeMetrics.ts`(共同指標組裝,複用 sync-v1/leftRightSymmetry)+ `門檻前開火率` | T2 | Med | 0.5–0.75d |
| **T-exit** | [T-exit-gate.md](T-exit-gate.md) | 驗收:三個急停子協定不共用未分層總分(框架 v1 驗收條件);`analysis-counterstrafe.md` 定稿;文件對帳 | T3 | — | 0.25d |

**T2 是本 WP 的關鍵路徑與風險集中點**(唯一新狀態機,且必須與既有生命週期到期閘零干擾);T1 打底 cue 基礎設施供 T2 延伸;T3 高度依賴既有函式複用(`sync-v1`/`leftRightSymmetry`/`outcome`),一旦 T1/T2 交付穩定的 `cues[]` 標記,後續多為協定組裝。一 task = 一垂直切片 = 一原子 commit 紀律不變。

---

## 5. Interface contracts(T0 已定 `CueScheduleConfig` 與 reversal 落點;其餘由後續 task 定稿)

```ts
// src/data/DataRecorder.ts                                                     [T1,additive]
export type DrillEvent =
  | /* …既有變體… */
  | { type: 'cue'; t: number; direction: 'A' | 'D' };

// src/drill/DrillConfig.ts                                                     [T1/T2,additive]
export type CueScheduleConfig =
  | { readonly kind: 'single'; readonly holdDurationMs?: never }
  | { readonly kind: 'hold-reversal'; readonly holdDurationMs: number };
export interface DrillConfig {
  cue?: CueScheduleConfig;
}

// src/metrics/peekWindows.ts                                                   [T1/T2,additive]
export type CueEvent = Extract<DrillEvent, { type: 'cue' }>;
export interface PeekWindowTs {
  readonly cues: readonly CueEvent[];   // 0(既有/free)/1(cued)/2(reversal)筆,依時間排序
}

// src/metrics/brakingDerivation.ts                                             [T3,新增]
export interface BrakingSample {
  readonly peekIndex: number;
  readonly side: 'L' | 'R';
  readonly timeToAccuracyGateMs?: number;
  readonly zeroCrossingMs?: number;
  readonly stopDistanceU?: number;
  readonly overReversalUPerS?: number;
  readonly flags: readonly string[];    // 'no_counter' | 'no_zero_crossing' | 'window_truncated_by_fire' | …
}
export function deriveBrakingSamples(payload: ExportPayload): readonly BrakingSample[];

// src/metrics/counterstrafeMetrics.ts                                          [T3,新增,複用既有函式與型式]
export interface SidedStat { readonly left: Stat; readonly right: Stat; readonly diff: number; }
export interface CounterstrafeMetrics {
  readonly cueToKeyMs?: SidedStat;
  readonly releaseToFireMs: SidedStat;
  readonly counterHoldMs: SidedStat;
  readonly counterToFireMs: SidedStat;
  readonly timeToAccuracyGateMs: SidedStat;
  readonly zeroCrossingMs: SidedStat;
  readonly stopDistanceU: SidedStat;
  readonly overReversalUPerS: SidedStat;
  readonly fireBeforeGateRate: number;
  readonly firstShotHitRate: number;
}
export function deriveCounterstrafeMetrics(payload: ExportPayload): CounterstrafeMetrics;
```

---

## 6. 執行規則

沿用 [exec-plan/README.md §5](../../../README.md):一 task = 一垂直切片 = 一原子 commit;完成即更新 [progress.md](progress.md) 與 [task-checklist.md](task-checklist.md);單一閘 `npm run test:ci`。跨 WP 決策入 [DECISIONS.md](../../../DECISIONS.md),per-WP 決策入本資料夾 `progress.md`(編號 `D-37.n`)。

**本 WP 特有的四條紀律**:

1. **既有急停玩法零回溯相容成本**:`config.cue` 省略時 `TargetManager`/`DrillRunner`/`schema.ts` 逐位等同現行行為;既有 `TargetManager.test.ts`/`DrillRunner.test.ts`/`schema.test.ts`/`counterstrafe_ad_v1.test.ts`/`wp22-determinism.test.ts` **零修改**全綠是機械判準。
2. **速度門檻單一來源**:任何制動/命中精準相關判定一律讀 `MovementController.CS2_PROFILE.accuracyThreshold`,不得新增第二套門檻常數(承 §2④、Failure modes 表)。
3. **既有時間線構念禁第二定義**:`counterHoldMs`/`releaseToFireMs`/`counterToFireMs` 一律複用 WP-32 已晉升的 `sync-v1`;`reactionMs`/`outcome`/`side` 分層一律複用 `peekWindows.ts`/`compute.ts` 既有欄位與型式,不得在 `counterstrafeMetrics.ts` 內重推。
4. **三協定禁合成總分**:`CounterstrafeMetrics` 與結果頁呈現皆不得出現跨指標的單一分數欄位(承 Failure modes 表最後一列)。

---

## 7. Open Questions(本 WP 新增;既有見 [../README.md §8](../README.md))

| # | 問題 | 建議 / 待決 | Owner | Deadline | 未決影響 |
|---|---|---|---|---|---|
| **OQ-S6-19**(新) | `reversal-v1` 的 hold→reversal 狀態機該落在 `DrillRunner`(生命週期判定層,比照 WP-35 fire-gating 先例)還是 `TargetManager`(spawn/事件蓋章層,比照 WP-36 zone 先例) | ✅ **T0 已定 `DrillRunner`**:判定對象是玩家按鍵持續時間,且其 `tick` 已持有 `state.held`、生命週期與 reset 邊界；`TargetManager` 保持 spawn/可見性職責。 | 研究者 | 2026-08-24 | T2 依此落點實作 |
| **OQ-S6-20**(新) | `reversal-v1` 玩家未在合理時間內完成第一段 hold(例如全程沒按鍵)時,是否需要獨立逾時機制,或沿用既有 `peekTimeoutMs` | 🟡 **T2 拍板**;初判傾向沿用 `peekTimeoutMs`(不新增第二套逾時語意),但需驗證與 hold→reversal 狀態機不衝突(承 Failure modes 表第二列) | 研究者 | WP-37 T2 | reversal 協定的資料完整性;若沖突需新增獨立逾時欄位 |
| **OQ-S6-21**(新) | `counterstrafe-free-v1` 的 Practice 匯出是否已有現成的「不併入正式歷史」守門(呼叫端 `mode` 判斷),或需要本 WP 新增 | 🟡 **T3 讀碼確認**;若現有呼叫端(`main.ts`/結果頁)尚未依 `mode` 分流,記錄為本 WP 的守門斷言範圍(不是新機制,只是補斷言) | 研究者 | WP-37 T3 | Practice/Assessment 資料汙染風險;若需新增機制則影響估時 |
| **OQ-S6-22**(新) | `cueToKeyMs` 是否應該同時報告「以 cue 為錨點」與「以既有 `visible` 為錨點」的雙重反應值,還是只報告前者(`hold-click-v1` 的 `t_detect − t_measurement_onset` 是後者) | 🟢 **建議**:只報告以 cue 為錨點的值,並在 `analysis-counterstrafe.md` 明文記載「`cued-v1`/`reversal-v1` 的反應構念錨點 = cue,與 `hold-click-v1`/`hold-track-v1` 的錨點(可見度 onset)不同,不可跨家族直接比較」(承 C-D4「同名事件不得有不同語意」的反面提醒——這裡是**故意不同名**,避免混淆) | 使用者 | WP-37 T3 | 結果呈現與跨家族比較邊界;不阻塞實作 |

---

## 8. 文件對帳清單

- [x] [../README.md](../README.md) §3:WP-37 狀態列由「🟡 執行計畫已展開」更新為 ✅(T-exit 完成,`analysis-counterstrafe.md` 定稿)。
- [x] `docs/operational/analysis-counterstrafe.md`(新,T-exit 定稿):`cue` 事件語意、`CueScheduleConfig` 兩種 `kind`、reversal 狀態機、制動四量公式(含 `CS2_PROFILE.accuracyThreshold` 單一來源聲明)、共同指標組裝與型式來源。
- [x] [CONTEXT.md](../../../../../CONTEXT.md):新術語(`cue` 事件、`CueScheduleConfig`、`holdDurationMs`、`timeToAccuracyGateMs`/`zeroCrossingMs`/`stopDistanceU`/`overReversalUPerS`、`counterstrafe-cued-v1`/`-reversal-v1`/`-free-v1`)於 T-exit 回寫。
