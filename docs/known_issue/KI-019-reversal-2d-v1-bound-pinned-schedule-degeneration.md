# KI-019 — `reversal-2d-v1` 在角度邊界飽和時排程退化：目標凍結在角落、產生數千筆 1ms leg

> 類型：correctness bug（**已實際觸發並污染真人 pilot 資料**）。
> 狀態：🟢 已修（F-A1 = WP-54 T6 slice 6；F-A2 = slice 9，研究者選定「放寬角度視窗」，2026-09-03）。
> 殘差與 T7 選項見 §5.3。
> 決策帳本：[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) BD-019。
> 發現脈絡：WP-54 T6 instrumentation pilot 的第一份真人資料（P01，9 個 block，2026-09-03）
> 經 `scripts/analyze-tracking-pilot.ts` 重建刺激時發現。

## 1. 症狀（真實資料實測）

`tracking_reversal_pilot_v1_medium` 的匯出檔（3.39 MB，其餘 block 約 1.55 MB）帶
**6644 筆 `target_motion_change` 事件**；同一份 manifest 裡密度**更高**的
`tracking_reversal_pilot_v1_high` 只有 **60 筆**。事件本身沒有記錄錯誤——用匯出檔自己的
`meta.spawn.trackingTrajectory` 重建 `createTrackingTrajectory()` 的排程，得到一樣的 6644 筆
（`rec/sched=6644/6644 mismatched=0`），**是刺激本身就長成這樣**。

以 128 Hz 取樣重建 medium 的軌跡：

| 指標 | medium（壞） | high（正常） |
|---|---|---|
| leg（change）數 | **6644** | 60 |
| 其中 after-velocity 兩軸皆 0 的 leg | **5731** | 0 |
| 速度 < 0.5 deg/s 的 tick 比例 | **32.6%** | 2.0% |
| 最長連續靜止 | **343.8 ms** | 15.6 ms |
| leg 長度分布 | `<10ms: 352`、`10-100ms: 109`、`100-300ms: 45`、`300-800ms: 14`、`>=800ms: 8` | `300-800ms: 57` |
| 排程尾段 | `t=24994.4 … 24999.4`，每 1 ms 一筆、速度全 0 | — |

也就是：**受測者有三分之一的 block 在跟一個凍結在 ±8° 角落的靜止目標**，而 config 宣稱的是
「800–1400 ms 一次反轉」（25 秒約 23 次）。`reversalIntervalMs` 這個被操弄的自變數根本沒有生效。

## 2. 根因

`src/sim/trackingTrajectory.ts` `createReversal2dV1()` 的三個設計互相作用：

1. **leg 長度由兩軸共用**：`durationSecThisLeg = min(candidateDuration, yawProfile.durationSec,
   pitchProfile.durationSec, remaining)`。註解說明這是刻意的（單一 `rampSec` 同時驅動兩軸的
   `evaluateAxis`）。
2. **`solveAxisProfile(room→0)` 回傳 `durationSec→0`**：triangle 分支
   `peakVelocity=sqrt(room*accel)`、`durationSec=2*peakVelocity/accel`；room 趨近 0 時整個 leg
   長度趨近 0。
3. **sign 每個 leg 無條件翻面**：`yawSign = -yawSign; pitchSign = -pitchSign;`。

於是當某一軸正**貼在它要前進的那一側邊界**上（room≈0），它會把**整個 leg**（含另一軸）壓成
長度≈0。原本的安全閥「`tMs += duration > 0 ? duration*1000 : 1`」再把時間推進 1 ms、翻面重試。

致命的組合是「yaw 貼 +8、pitch 也貼 +8」：

```text
迭代 n  : (yaw +, pitch −) → yaw room = 0 → leg 長度 0 → 推進 1ms、翻面
迭代 n+1: (yaw −, pitch +) → pitch room = 0 → leg 長度 0 → 推進 1ms、翻面
迭代 n+2: (yaw +, pitch −) → yaw room = 0 → …（吸收態，永遠交替）
```

每次迭代恰好有一軸貼牆，位置因此永不改變，排程就以 1 ms 為步長一路寫到 `durationMs` ——
`MAX_REVERSAL_LEGS = 100_000` 的安全閥在 25 秒（25000 筆）內也擋不下來，所以不會 fail fast。

**為什麼只有 medium 中獎**：進入吸收態的前提是 leg 常態性走到邊界。每個 leg 的需求位移是
`speedMax × (intervalMax − ramp)`：

| cell | window | 每 leg 最大需求位移 | 幾何一致？ |
|---|---|---|---|
| medium（`[800,1400]ms`、`[5,20]deg/s`、ramp 150ms） | 16° | **25.0°** | ❌ 遠大於 window |
| high（`[300,600]ms`、`[5,20]deg/s`、ramp 150ms） | 16° | 9.0° | ✅ |

medium 的 config 要求的行程放不進角度視窗，於是幾乎每個 leg 都被截斷在邊界上；high 的放得進去，
所以完全正常（60 legs、57 個落在 300–800 ms）。**同一組 seed 家族下，約 10% 的 seed 會在 25 秒內
走進吸收態**（seed 掃描：1–40 之中 13/15/16/33 命中；seed 13 產生 3140 legs、22.9% 靜止、最長凍結
758 ms）——不是 seed 54100 的特例。

## 3. 影響面

- **資料**：P01（2026-09-03）的 `tracking_reversal_pilot_v1_medium` block **作廢**，必須重跑。
  其 P0（`rmsEpsilonDeg=1.668`）與所有 reversal window 指標都是在錯誤刺激上算出來的。
  修法落地後該檔的 `target_motion_change` 也再也無法對表（`rec/sched=6644/46 mismatched=33`），
  這本身就是「不可重建 ⇒ 不可用」的證據。
- **同一份 manifest 的 high block 不受影響**：修法後重算排程與該檔記錄的 60 筆事件
  **逐位相同**（`rec/sched=60/60 mismatched=0`）——幾何一致的 config 輸出不變。
- **既有測試為何全綠**：T1/T2 的斷言是連續性、bounds、有限加速度、seed 可重現、事件 round-trip
  ——**靜止的目標全部滿足**。沒有任何測試斷言「目標會動」或「leg 數與 `reversalIntervalMs`
  相稱」。這是測試設計的盲點，不是測試被繞過。
- **legacy drill 不受影響**：`reversal-2d-v1` 只被 WP-54 的兩個 pilot cell 使用。

## 4. 修法（F-A1，已落地）

方向選擇改為 **room-aware**：預定方向若連一個「最小可用 leg」的位移都放不下，就改朝空間較大的
另一側。門檻由 config 導出——`speedRangeDegPerSec[0] × accelerationRampMs`（最慢速度跑完一次
ramp-up/ramp-down 的位移），不是魔術常數：比這更短的「leg」在 rest-to-rest 設計下只是貼牆抖動，
不是一次 reversal。

```ts
function roomAwareSign(sign, posDeg, lowDeg, highDeg, minUsableRoomDeg) {
  const intendedRoom = sign >= 0 ? highDeg - posDeg : posDeg - lowDeg;
  if (intendedRoom >= minUsableRoomDeg) return sign;
  const oppositeRoom = sign >= 0 ? posDeg - lowDeg : highDeg - posDeg;
  return oppositeRoom > intendedRoom ? -sign : sign;
}
```

配套兩點：

- while 條件改為 `durationMs - tMs > LEG_TIME_EPSILON_MS`（浮點殘差不再開新 leg）。
- 移除「推進 1 ms」的安全閥，改為 `durationSecThisLeg <= 0` 時 **throw**：room-aware 之後至少有
  一側有完整 window 可走，故零長度 leg 只可能來自退化的 `angularBoundsDeg`，該 fail fast 而不是
  用零速度 leg 洗掉整段刺激。

**效果**（同一組 seed/config，逐位重算）：

| | 修前 | 修後 |
|---|---|---|
| medium: legs / 靜止 / 最長凍結 | 6644 / 32.6% / 343.8 ms | **46 / 1.6% / 15.6 ms** |
| high: legs / 靜止 / 最長凍結 | 60 / 2.0% / 15.6 ms | **60 / 2.0% / 15.6 ms（不變）** |
| 合成 fixture（seed 13，±8° 視窗當時的量測） | 3140 / 22.9% / 758 ms | 42 / 1.3% / 16 ms |

（slice 9 把該 fixture 改為 ±13° 的合法 config 後重新量測：修前 **3382 / 15.0% / 2781 ms**、
修後 **32 / 1.0% / 16 ms**——見 §5.2。）

**回歸測試**（3 個，皆已驗證修前為紅、修後為綠）：

- `src/sim/trackingTrajectory.test.ts`：`REVERSAL_SATURATING`（seed 13 的合成 fixture）
  ①無零速度 leg、②靜止比例 < 5% 且最長連續靜止 ≤ 50 ms、③飽和情況下仍不越界。
- `src/drill/tracking_reversal_pilot_v1.test.ts`：**兩個實際出貨的 cell** 都必須「目標持續移動」
  （靜止 < 5%、最長凍結 ≤ 50 ms、無零速度 leg、leg 數 < 200）。

## 5. F-A2 — config 幾何不一致（已依研究者決定落地）

F-A1 只修掉「無限退化」。medium 的 config 當時**仍然幾何不一致**（每 leg 需求 25° > window 16°），
leg 仍被邊界截斷：46 legs / 25 秒 ≈ 平均 543 ms 一次反轉，而 config 宣稱 800–1400 ms（約 23 次）。

### 5.1 決策（2026-09-03，研究者選定）

**放寬角度視窗**：`angularBoundsDeg: [-8, 8] → [-13, 13]`（window 26° ≥ 需求 25°）。兩個被操弄
變數（`reversalIntervalMs`、`speedRangeDegPerSec`）維持 T0 預註冊值。另外兩個選項（降速度上限 /
縮短間隔上限）未採用——它們都會改掉另一個自變數或壓掉密度對比。

### 5.2 建構期一致性守衛（同批落地）

`createReversal2dV1()` 現在在建構期驗證
`speedMax × (intervalMax − ramp) ≤ angularBoundsDeg` 視窗寬度，違反即 throw 並在訊息裡給出實際
數值與三個可調參數。這讓「config 宣稱的密度不可能被交付」不可能再靜默發生（與 KI-020 §4.3 的
速度守衛同一原則）。

守衛一併揭露了**四個既有測試 fixture 用的正是同一個不一致形狀**（`REVERSAL_BASE`、
`SimLoop.test.ts`、`TargetManager.test.ts` 的 reversal fixture）——全部改為 ±13°。這也是為什麼
既有測試從未抓到這個問題：fixture 與出貨 config 共用同一個錯誤前提。

### 5.3 落地後的殘差（誠實記錄，非「已完全解決」）

| cell | config 宣稱（平均間隔） | **實際交付 leg 數 / 25s** | 靜止比例 | 最大位移 |
|---|---|---|---|---|
| medium `[800,1400]ms` | ~23 次 | **36 次（+57%）** | 1.1% | 13.00° |
| high `[300,600]ms` | ~56 次 | **59 次（+5%）** | 1.9% | 13.00° |

殘差來源是**設計本身的邊界截斷**（而非 bug）：守衛保證「從一側邊界出發的最壞情況 leg 放得進
window」，但一個從視窗中央出發、朝邊界前進的 leg 只有半個 window（13°）可用，仍會被截斷。要讓
交付密度逐值等於 `reversalIntervalMs`，需要 `speedMax × (intervalMax − ramp) ≤ 半個 window`
⇒ 視窗約 ±25°。

**留給 T7 的選項**（不在 T6 決定）：若難度校準需要「交付密度＝設定密度」，把視窗再放寬到約 ±25°；
目前 medium(36) vs high(59) 的密度對比方向正確且單調，足以支撐 T7 的相對比較。

> ✅ **2026-09-03 更新（[KI-023](KI-023-target-speed-set-point-is-per-axis-not-2d.md) 的副效益）**：
> `speedRangeDegPerSec` 改為 2D 語意後，每軸抽樣速度降 `1/√2` ⇒ leg 行程縮短、邊界截斷減輕，
> 交付密度**自動往宣稱值靠**：medium **36 → 29 次**（宣稱約 23，誤差由 +57% 降到 +26%）、
> high **59 → 58 次**（宣稱約 56）。上表數字為 KI-023 修復前的量測，保留為歷史。T7 要不要再放寬
> 到 ±25°，應依這組新數字重判。

## 6. DoD

- [x] F-A1 修法落地，3 個回歸測試修前紅／修後綠。
- [x] `high` cell 輸出逐位不變（以真人匯出檔的 60 筆記錄事件對表驗證）。
- [x] 全專案 `tsc --noEmit` exit 0、`vitest run` 全綠。
- [x] F-A2：研究者選定「放寬角度視窗」→ `angularBoundsDeg: [-13, 13]` + 建構期一致性守衛落地
      （slice 9）；4 個既有 fixture 一併對齊。殘差（medium 交付 36 次 vs 宣稱 23 次）記於 §5.3，
      並把「是否再放寬到 ±25°」留給 T7。
- [ ] P01 的 medium **與 high** block 重跑（採 (a) 後 high 的軌跡也變了）。
