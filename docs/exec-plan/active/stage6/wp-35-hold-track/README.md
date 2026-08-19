# WP-35 — hold-track:移動期間鎖 fire + 停止後解鎖首發 + 追蹤窗/停止轉換指標

> stage6 執行計畫的 WP 子資料夾。上層 spec:[../README.md](../README.md) · 需求 source of truth:[../aim-assessment-framework-v1.md](../aim-assessment-framework-v1.md) · 決議依據:**GD-22**(stage6 採納)+ 本 WP T0 讀碼拍板(D-35.1~D-35.3)。
> Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **目標** | 交付 FR-F7(`hold-track-v1`:目標移動期間鎖開火,`target_stop` 或停止提示後才解鎖首發;固定移動窗口追蹤指標 + 停止轉換指標) |
| **里程碑** | 無獨立里程碑;與 WP-34(`hold-click-v1`)共同構成架槍挑戰家族,兩者皆為 WP-38(診斷推薦)entry 條件之一 |
| **相依** | **WP-34 T-exit**(共用 emergence/exposure 機制;[../README.md §5](../README.md) 相依圖) |
| **對應 FR** | FR-F7(`hold-track-v1`) |
| **估時** | 2–3 dev-days([../README.md §6](../README.md));讀碼發現追蹤窗核心指標多數已有實作,T0 若確認掉靶/重新取得時間可用既有 `TrackingSample[]` 離線推導(不碰既有幾何函式),估時傾向落在下緣;若發現需要更深的 `trackingDerivation.ts` 改動則上修,由 T0 記錄判斷 |
| **狀態** | ✅ 完成(2026-08-19,T0–T2+T-exit 全數完成) |

---

## 0. 讀碼對帳(規劃階段,2026-08-19;決定本 WP 淨新增工作量)

> 動筆前對 `src/drill/DrillConfig.ts`、`src/drill/DrillRunner.ts`、`src/sim/TargetManager.ts`、`src/loop/SimLoop.ts`、`src/metrics/trackingDerivation.ts` 的讀碼結果。目的與 WP-32 §0.1、WP-33 §0 同:找出「框架 v1 假設為新能力」裡有多少其實是既有構念的延伸,避免虛報工作量或漏看真正的缺口。

| # | 框架 v1 / stage6 README 假設 | 讀碼發現 | 對本 WP 的影響 |
|---|---|---|---|
| **0-1** | 追蹤窗指標(TOT%/RMS/median/P95 angular error)是待新增能力 | [`trackingDerivation.ts`](../../../../../src/metrics/trackingDerivation.ts) 的 `deriveTrackingMetrics`/`TrackingPresentationDerivation`(WP-18 T4)**已經**逐 presentation 輸出 `tAcquireMs`/`acquisitionFailure`/`totPercent`/`rmsEpsilonDeg`/`medianEpsilonDeg`/`p95EpsilonDeg`,且視窗右界固定為「下一次 `visible` 事件」(不受提早擊殺影響,見 0-2)。既有測試覆蓋:`trackingDerivation.test.ts`、`tests/golden/research/epsilon-parity.test.ts`、`promoted-curve.test.ts` | **T2 主要是「協定組裝 + 複用」,不是重新推導幾何**。C-D4 適用:on-target/ε(t) 一律呼叫既有 `deriveTrackingMetrics`/`deriveTrackingSamples`,禁止另立第二套幾何 |
| **0-2** | 「固定移動窗口,避免反應快者因提早擊殺而天然獲得較短追蹤窗」是待解決風險 | `TargetState.persistent`(WP-18 T3)已解決:`config.timing.presentationMs` 提供時,`TargetManager.spawn()` 把目標標為 `persistent: true`;[`SimLoop.ts:432-439`](../../../../../src/loop/SimLoop.ts) 命中判定明文:persistent 目標命中**只記 fire 事件,不 `markKilled`**——窗內存活移動,推進由 [`DrillRunner.ts:103-116`](../../../../../src/drill/DrillRunner.ts) 的 presentation 到期閘驅動。`tracking_br_v1`([`tracking_br_v1.ts`](../../../../../src/drill/tracking_br_v1.ts))已是這個機制的實機驗證(pingpong motion + `presentationMs=2000`) | **窗口長度不被提早擊殺影響」這條驗收條件在既有機制下已經成立**,只要 hold-track-v1 沿用 `persistent` + `presentationMs` 骨架。真正缺的不是「防止窗口變短」,是下一條(0-3) |
| **0-3** | fire-gating(移動期間鎖開火)是既有機制的延伸 | **零命中**:`grep -rn "fireLocked\|holdFire\|lockFire" src/` 無結果。既有 `persistent` 只防止「命中提早撤除目標」,**不防止玩家在移動期間開火**——`tracking_br_v1` 允許移動中連續開火(這是它的設計目的:量測追蹤 ε,不量測首發時機)。開火合法性閘在 [`SimLoop.ts:505-511`](../../../../../src/loop/SimLoop.ts)(`scheduleFire`):`state.heldFire && state.weapon.ammo > 0 && state.weapon.nextFireT <= untilMs`,是 sim 熱路徑內的既有邏輯,無 drill 層級意圖介入點 | **這是本 WP 唯一的淨新增引擎能力**:必須在 `scheduleFire` 的判定式追加一個「本目標是否允許開火」的條件,來源建議為 `TargetState` 的 additive 欄位(比照 `persistent` 的先例——由 `TargetManager` 依 config 寫入、sim 唯讀),而非新增獨立狀態機(承 [../README.md §2.3(b)](../README.md) 設計方向)。細節留給 T0/T1 拍板(OQ-S6-9) |
| **0-4** | 「目標停止」(`target_stop`)是既有 `presentationMs` 到期行為的延伸 | `DrillRunner.ts` 現行 presentation 到期行為是 **`markKilled`**(撤除、翻面、補新目標)——這是「advance」不是「stop」。`hold-track-v1` 需要的是「到期後目標**原地凍結**(motion 停止驅動、pos 不變)、維持可見與存活,直到玩家開火才撤除」,兩者行為不同。若把 hold-track-v1 直接套用現行 `presentationMs` 到期路徑,目標會在窗口結束的瞬間消失,`t_fire − t_stop` 這類「停止轉換」指標根本無從量測 | **需要新的到期行為分支**(freeze-in-place),不能重用現行 `presentationMs` 到期即 `markKilled` 的既有語意(C-D4:不得讓 `presentationMs` 同時承載「advance」與「stop」兩種到期行為,需為新行為找一個可辨識的欄位)。命名與落點留給 T0/T1(候選:`timing` 底下新增 additive 修飾欄位,而非改寫 `presentationMs` 本身語意) |
| **0-5** | 「掉靶次數、重新取得時間」是待新增的推導邏輯 | `deriveTrackingSamples()` 已輸出逐 tick `TrackingSample[]`(`{t, onTarget, epsilonDeg}`),`derivePresentation()` 目前只用它算 TOT%/RMS 等聚合值,**未**掃描 on-target 的 true→false→true 轉換次數與間隔 | 可在**不修改**既有幾何/聚合函式的前提下,新增一個消費 `TrackingSample[]` 的獨立函式(如 `deriveTrackingTransitions`)離線算出掉靶次數與重新取得時間,屬**加法擴充**,不觸碰已測試綠燈的 `derivePresentation` 路徑 |

**結論**:FR-F7 的四類指標(取得/追蹤/停止轉換/分層)裡,「取得」「追蹤」已由既有 `trackingDerivation.ts` 覆蓋;「分層」是既有 metadata 欄位的呈現層工作;真正的淨新增只有「停止轉換」三指標的計算 + 支撐它的兩個引擎能力(fire-gating、target 原地凍結)。這個收斂決定了 T1/T2 的切法(見 §4),記入 Decision Log D-35.1(T0 執行時定案)。

---

## 1. 需求對應

| FR | 內容 | 落點 |
|---|---|---|
| FR-F7 | `hold-track-v1`:目標移動期間鎖開火,`target_stop` 或停止提示後才解鎖首發;固定移動窗口追蹤指標(TOT%/RMS/median/P95、掉靶次數、重新取得時間)+ 停止轉換指標(`t_fire − t_stop`、停止後首發命中、停止後開火偏差) | T1(引擎能力)+ T2(協定 + 指標) |

### 1.1 範圍

**In scope**:

```
src/state/types.ts                        ← MODIFY TargetState additive:fireLocked?(D-35.1)              [T1]
src/state/SharedState.ts                  ← MODIFY 新增 tStop 記錄結構(比照既有 tVisible 慣例)         [T1]
src/loop/SimLoop.ts                       ← MODIFY scheduleFire 開火合法性閘追加 fireLocked 條件(additive) [T1]
src/sim/TargetManager.ts                  ← MODIFY 新增「原地凍結」到期行為分支(additive,不改既有 markKilled 路徑) [T1]
src/drill/DrillConfig.ts                  ← MODIFY timing.trackingStopMs additive 修飾欄位(D-35.2)       [T1]
src/drill/hold_track_v1.ts                ← ADD hold-track-v1 drill config(比照 tracking_br_v1.ts 形狀)  [T2]
src/metrics/trackingDerivation.ts         ← 讀,不改核心幾何(deriveTrackingSamples/derivePresentation,C-D4) [T2]
src/metrics/trackingTransitions.ts        ← ADD 掉靶次數/重新取得時間(消費既有 TrackingSample[])          [T2]
src/metrics/stopTransitionDerivation.ts   ← ADD t_fire−t_stop / 停止後首發命中 / 停止後開火偏差(複用既有首發判定,C-D4) [T2]
docs/operational/analysis-hold-track.md   ← ADD 契約文件(fire-gating 語意/target_stop 定義/指標公式)      [T1/T2/T-exit]
```

**Out of scope**(附觸發條件):

- **`hold-click-v1` 的可見度時間線**——WP-34,本 WP 只消費其 emergence/exposure 機制,不重做。
- **既有 `tracking_br_v1`/`presentationMs` 到期即 `markKilled` 行為的變更**——本 WP 新增的凍結行為是**額外分支**,既有 drill 零回溯相容成本;觸發條件 = 若 T0 讀碼發現無法在不動既有分支的前提下新增凍結行為,則升報 DECISIONS.md。
- **Spider Shot / 急停測試**——WP-36/WP-37,無檔案熱區重疊。
- **診斷規則對「停止轉換」指標的解讀**——WP-38,本 WP 只交付指標數值本身。
- **fire-gating 的 UI 提示(視覺/音效倒數)**——訓練體驗優化,非量測必要;觸發 = 明確教練工作流需求。

---

## 2. 關鍵契約(T0 已凍結;詳見 progress.md D-35.1~D-35.3)

### ① fire-gating 落點:additive `TargetState` 欄位,sim 唯讀(承 §0-3)

比照既有 `persistent`(WP-18 T3)的先例——由 `TargetManager` 依 `DrillConfig` 寫入 `TargetState.fireLocked`,`SimLoop.scheduleFire` 只**讀**該欄位、不持有獨立狀態機。既有 `state.heldFire && state.weapon.ammo > 0 && state.weapon.nextFireT <= untilMs` 判定式追加 **AND** 條件(`activeTarget?.fireLocked !== true`);省略該欄位(既有 63+ drill)行為逐位不變。**這不是新的 sim 狀態機**——與 `persistent` 同一層級的附加旗標,職責仍是「這個 tick 要不要接受開火」的**判定**,不改變 sim 的物理狀態演進(承 [../README.md §2.3(b)](../README.md))。

### ② target_stop = 原地凍結,不是撤除(承 §0-4)

到期(`timing.trackingStopMs`)後,目標**不** `markKilled`:

1. 停止驅動 `motion`(`age` 不再累加,`pos` 定格在到期瞬間)。
2. `fireLocked` 翻為 `false`(解鎖開火)。
3. 記錄 `tStop`(比照 `state.tVisible` 的 `Map<targetId, number>` 慣例,sim clock 時間源,ADR-4)。
4. 玩家下一次開火(命中或未命中皆計首發,沿用既有 `firstShot` 語意)後,該目標恢復**非 persistent** 行為——命中即 `markKilled`(既有路徑,零改動),推進下一目標。

此行為只在 hold-track-v1 專屬的 `timing.trackingStopMs` 存在時啟用;既有 `tracking_br_v1`(只給 `presentationMs`,不給新欄位)維持現行「到期即 `markKilled`」路徑,零回溯相容成本。T1 schema 必須拒絕 `presentationMs` 與 `trackingStopMs` 同時出現,避免同一 config 同時宣告 advance 與 stop。

### ③ 停止轉換指標必須複用既有首發判定(C-D4)

`t_fire`、「首發命中」的判定不得在本 WP 另立第二套——沿用 `compute.ts`/`peekWindows.ts` 既有的首發判定路徑(WP-32 T3 已抽出的 `buildPeekWindows` 同一慣例)。新指標 `t_fire − t_stop`、「停止後開火角度偏差」只是把既有首發時間戳與座標,對齊本 WP 新記錄的 `tStop`,不重新定義「什麼算首發」。

### ④ 掉靶次數/重新取得時間為加法擴充,不碰既有幾何(承 §0-5)

新函式(建議 `src/metrics/trackingTransitions.ts`)消費 `deriveTrackingSamples()` 既有輸出的 `TrackingSample[]`,掃描追蹤窗內 on-target 的 true→false(掉靶事件)與其後 false→true(重新取得,若窗口結束前未再次 on-target 則計為未重新取得)。**不修改** `trackingDerivation.ts` 既有的 `derivePresentation`/`isOnTarget`/`rms`/`percentile`,既有測試(`trackingDerivation.test.ts`/`epsilon-parity.test.ts`/`promoted-curve.test.ts`)零修改為機械判準。

### ⑤ 追蹤窗右界不變式延續(承 §0-2,無需新契約,列出以防遺漏)

`persistent` + `presentationMs` 已保證追蹤窗右界 = 「下一次 `visible` 事件」,不受命中提早影響。hold-track-v1 的凍結行為(②)進一步保證:即使目標原地凍結等待首發,窗口右界的定義依然是「下一次 `visible`」(新目標 spawn 才觸發),不因玩家何時開火而變動。T2 的 DoD 需要一條合成 fixture 直接驗證這個不變式(提早/準時/逾時開火三案例窗口長度相同)。

---

## 3. Failure modes

| 觸發 | 影響 | 處理 |
|---|---|---|
| fire-gating 判定式與既有 `heldFire`/`ammo`/`nextFireT` 邏輯耦合不當,導致非 hold-track drill 的開火行為被意外影響 | 既有 63+ drill 的決定性回歸可能被污染,連帶影響 WP-13/WP-25 的彈道/recoil 既有測試 | T1 DoD 首項 = 新增條件在 `fireLocked` 欄位省略時逐位等同現行行為;既有 `SimLoop.test.ts`/`fire-determinism.test.ts`/`recoil-wiring.test.ts`/`ballistic-compose.test.ts` **零修改**全綠 |
| 「原地凍結」到期分支與既有 `presentationMs` 到期(`markKilled`)分支共用同一段 `DrillRunner`/`TargetManager` 邏輯,誤把兩者合併導致 `tracking_br_v1` 行為改變 | `tracking_br_v1` 的既有回歸(pingpong 追蹤 ε 量測)被污染 | T1 DoD:新增分支必須是**額外**判斷路徑(新增修飾欄位存在才進入),既有 `tracking_br_v1` 相關測試零修改全綠;`git diff` 可審為新增而非改寫既有分支 |
| `fireLocked` 解鎖時機與 `tStop` 記錄時機出現一 tick 偏差(先解鎖後記錄,或反之) | `t_fire − t_stop` 可能出現負值或系統性偏移,污染停止轉換指標的效度 | T1 單元測試逐 tick 斷言:`tStop` 寫入與 `fireLocked→false` 翻轉在**同一 tick** 內完成,兩者共用同一次 `TargetManager.tick` 呼叫 |
| 掉靶次數/重新取得時間的新函式與既有 `TrackingSample[]` 的取樣密度(每 sim tick)不匹配預期(例如把「取樣間隔」誤當「掉靶事件」) | 掉靶次數虛高,教練依錯誤數字下處方(重蹈 C-D3 要防的錯誤) | T2 合成 fixture 覆蓋「持續 on-target 無掉靶」「單次掉靶後重新取得」「掉靶至窗口結束未重新取得」三案例,逐案例斷言掉靶次數與重新取得時間數值 |
| `hold-track-v1` 與既有 `tracking_br_v1` 共用同一 `weaponId`/`motion` 假設,實際上速度/角尺寸需求不同 | 條件格定義混淆,分層指標(方向/距離/速度/露出距離)失去可比較性 | T2 明文:hold-track-v1 是獨立 drill config(比照 `tracking_br_v1.ts` 的 variant 產生器形狀,不繼承其 weapon/motion 常數),凍結值待 WP-39 pilot |

---

## 4. Task 索引

| Task | 檔案 | Objective | 相依 | Risk | 估時 |
|---|---|---|---|---|---|
| **T0** | [T0-entry-gate.md](T0-entry-gate.md) | 驗 WP-34 T-exit;讀碼確認 §0 對帳結論;拍板 fire-gating 落點(OQ-S6-9)+ target_stop 修飾欄位命名 + 掉靶/重新取得時間函式邊界;零程式碼 | WP-34 T-exit | Low | 0.25–0.5d |
| **T1** | [T1-fire-gating-stop.md](T1-fire-gating-stop.md) | `TargetState.fireLocked` + `tStop` 記錄 + `scheduleFire` additive 閘 + `TargetManager` 原地凍結到期分支 | T0 | Med | 1–1.25d |
| **T2** | [T2-tracking-stop-metrics.md](T2-tracking-stop-metrics.md) | `hold-track-v1` drill config + 掉靶/重新取得時間函式 + 停止轉換三指標(複用既有首發判定) | T1 | Med | 0.75–1d |
| **T-exit** | [T-exit-gate.md](T-exit-gate.md) | 驗收:追蹤窗不因提早擊殺而縮短(框架 v1 驗收條件);`analysis-hold-track.md` 定稿;文件對帳 | T2 | — | 0.25d |

**T1 是本 WP 的關鍵路徑瓶頸**(fire-gating 觸碰 `SimLoop.ts` 熱路徑,零回溯相容成本要求最高);T2 依賴 T1 交付的 `fireLocked`/`tStop` 才能組裝協定。一 task = 一垂直切片 = 一原子 commit 紀律不變。

---

## 5. Interface contracts(T0 凍結的 T1/T2 起點;T1 可依實作細節微調註解,不得改語意)

```ts
// src/state/types.ts                                                            [T1,additive]
export interface TargetState {
  // …既有欄位(id/side/pos/visible/alive/hitbox/age/posPrev/motion?/persistent?)不變
  /**
   * hold-track-v1 專屬:為 true 時 `scheduleFire` 拒絕對本目標的開火消費(輸入仍留在緩衝,
   * 解鎖後正常消費,不遺失事件)。省略 = 現行行為(既有 drill 零回溯相容成本)。
   */
  fireLocked?: boolean;
}

// src/state/SharedState.ts                                                      [T1,additive]
export interface SharedState {
  // …既有欄位(tVisible 等)不變
  /** target_stop 時間戳(sim clock ms);比照 tVisible 慣例,`markKilled`/reset 時同步清除。 */
  tStop: Map<string, number>;
}

// src/loop/SimLoop.ts — scheduleFire(既有函式,additive 條件)                     [T1]
// while (state.heldFire && state.weapon.ammo > 0 && state.weapon.nextFireT <= untilMs
//        && !isFireLockedForActiveTarget(state)) { … }
// isFireLockedForActiveTarget 讀 state.targets 中 alive && visible 的目標之 fireLocked;
// 多目標情境(理論上單 active 目標,peek 節奏)取第一個存活可見目標,與既有 activeTarget 慣例一致。

// src/sim/TargetManager.ts                                                      [T1,additive 分支]
// tick() 內新增:若 target 帶 hold-track 修飾旗標且 age 達門檻 → 凍結(不再呼叫 motionOffset)+
// target.fireLocked = false + state.tStop.set(target.id, nowMs)。既有 presentationMs→markKilled
// 分支不變,新分支只在新修飾欄位存在時進入。

// src/drill/DrillConfig.ts                                                      [T1,additive]
export interface DrillConfig {
  timing: {
    // …既有欄位不變
    /**
     * hold-track-v1 專屬:達此時長 → 目標原地凍結(非撤除)+ 解鎖開火,取代 presentationMs 到期即
     * markKilled 的既有行為。省略 = 現行 presentationMs 語意不變(既有 tracking_br_v1 零回溯相容)。
     * 不得與 presentationMs 同時提供;presentationMs 維持既有「到期撤除/advance」語意。
     */
    trackingStopMs?: number;
  };
}

// src/metrics/trackingTransitions.ts                                            [T2,新增,消費既有 TrackingSample[]]
export interface TrackingTransitions {
  targetId: string;
  /** on-target → off-target 的次數(追蹤窗內,不含窗口邊界前的 acquisition 階段)。 */
  dropCount: number;
  /** 每次掉靶到下一次重新 on-target 的時間(ms);未在窗口結束前重新取得者不計入本陣列。 */
  reacquireMs: number[];
}
export function deriveTrackingTransitions(samples: readonly TrackingSample[]): TrackingTransitions;

// src/metrics/stopTransitionDerivation.ts                                       [T2,新增,複用既有首發判定]
export interface StopTransition {
  targetId: string;
  tStopMs: number;
  tFireMs?: number;             // 沿用既有首發判定(compute.ts/peekWindows.ts),undefined = 未開火
  fireToStopMs?: number;        // t_fire − t_stop
  firstShotHitAfterStop?: boolean;
  fireAngleErrorDeg?: number;   // 停止後開火角度偏差,複用既有角度誤差計算(eyeOrigin.ts)
}
export function deriveStopTransitions(payload: ExportPayload): StopTransition[];
```

---

## 6. 執行規則

沿用 [exec-plan/README.md §5](../../../README.md):一 task = 一垂直切片 = 一原子 commit;完成即更新 [progress.md](progress.md) 與 [task-checklist.md](task-checklist.md);單一閘 `npm run test:ci`。跨 WP 決策入 [DECISIONS.md](../../../DECISIONS.md),per-WP 決策入本資料夾 `progress.md`(編號 `D-35.n`)。

**本 WP 特有的三條紀律**:

1. **既有開火/目標生命週期行為零回溯相容成本**:T1 新增的 `fireLocked`/凍結分支必須是完全可省略的 additive 路徑;既有 `SimLoop.test.ts`/`fire-determinism.test.ts`/`recoil-wiring.test.ts`/`ballistic-compose.test.ts`/`tracking_br_v1` 相關測試**零修改**全綠是機械判準。
2. **既有追蹤幾何禁第二定義(C-D4)**:on-target/ε(t)/首發判定一律呼叫既有 `trackingDerivation.ts`/`compute.ts`/`peekWindows.ts`,新指標函式只做「消費既有輸出、產生新聚合」的加法擴充。
3. **`fireLocked` 解鎖與 `tStop` 記錄同 tick 完成**:兩者是同一個「target_stop」事件的兩面,T1 單元測試須直接斷言同 tick 落地,避免製造系統性的 `t_fire − t_stop` 偏移。

---

## 7. Open Questions(本 WP 新增;既有見 [../README.md §8](../README.md))

| # | 問題 | 建議 / 待決 | Owner | Deadline | 未決影響 |
|---|---|---|---|---|---|
| ~~**OQ-S6-9**~~(承 [../README.md](../README.md),本 WP 收斂) | ~~fire-gating 是否會與既有 `WeaponConfig` 開火合法性判定(彈匣/cycletime)產生互動,需要合併判定還是獨立疊加~~ | ✅ **關閉(2026-08-19,T0,D-35.1)**:`scheduleFire` 追加 `TargetState.fireLocked` active-target additive AND 條件,不併入 `nextFireT`/彈匣語意;解鎖瞬間沿用既有 cadence 消費 | 研究者 | WP-35 T0 ✅ | unblocked |
| ~~**OQ-S6-14**~~(新) | ~~`presentationMs` 到期行為的「kill」vs「freeze」是否該用同一欄位加判別子,還是兩個獨立欄位(`presentationMs` + `trackingStopMs`)~~ | ✅ **關閉(2026-08-19,T0,D-35.2)**:新增獨立 `timing.trackingStopMs`;`presentationMs` 維持到期撤除語意;T1 schema 拒絕兩者併用 | 研究者 | WP-35 T0 ✅ | unblocked |
| **OQ-S6-15**(新) | 「重新取得時間」在玩家掉靶後直到窗口結束都未重新 on-target 時,如何呈現(不計入平均 vs 記為窗口剩餘時間的上界) | 🟡 **T2 拍板**;建議不計入平均(避免用武斷上界污染統計),但需在 `analysis-hold-track.md` 明文記載排除規則與其對樣本數 `n` 的影響 | 研究者 | WP-35 T2 | 掉靶/重新取得時間的統計呈現方式;不阻塞引擎實作 |

---

## 8. 文件對帳清單

- [ ] [../README.md](../README.md) §3:WP-35 狀態列由「⬜ 待建立」更新為本資料夾連結(本次規劃已建立,執行時隨 T0 更新狀態)。
- [ ] `docs/operational/analysis-hold-track.md`(新,T1 起稿/T-exit 定稿):fire-gating 語意、`target_stop` 定義、掉靶/重新取得時間排除規則、停止轉換指標公式。
- [ ] [CONTEXT.md](../../../../../CONTEXT.md):新術語(`fireLocked`、`target_stop`、`trackingStopMs`、掉靶次數/重新取得時間)於 T-exit 回寫。
