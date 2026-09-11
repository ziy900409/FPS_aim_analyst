# T6 — L2 免閾值微調描述子 + 擊殺後方向預測曲線

> WP：[WP-63](README.md) · 估時 2.5 d · Risk Med · 相依：T3
> 對應 FR-63.10／63.11

## 目的

在**不引入任何速度門檻、不引入任何平滑窗參數**的前提下，量到微調段的品質與「玩家打算去哪」。

## 為什麼不用 `seg-v2`

[`SEG_V2_PARAMS`](../../../../../src/metrics/submovement.ts) 是為 10–25° 的寬幅 flick 校準的：

| 參數 | 值 | 在 v8 的後果 |
|---|---|---|
| `sgWindow: 11` | 11 個樣本 | @128 Hz 約 **78 ms 跨度**，比 v8 的微調事件（30–80 ms）還長 ⇒ 濾波必然向兩側借值，峰值被壓平 |
| `peakFloorDegPerSec: 60` | 60 deg/s | 1°／50 ms 的修正（minimum-jerk 峰值約 38 deg/s）整段判 `below_floor` ⇒ 分段數 0 |

⇒ `correction-free-rate` 會**系統性高估**（玩家看起來比實際乾淨）。這是偏誤不是雜訊，不會平均掉，而且偏誤方向對玩家有利 ⇒ 教練報告會說錯話（C-D3）。

另有一個陷阱：`sgWindow` 的單位是**樣本數**，同一組參數餵不同取樣率就是不同的演算法。把 raw mouse（約 1000 Hz）的 ω 直接丟進 `SEG_V2_PARAMS`，11 樣本從 78 ms 窗變成 11 ms 窗 —— 沒有錯誤訊息，但在 C-D5 下等同靜默改語意。

⇒ 本 task 走**免閾值**路線，`seg-v2` 一行不動。

## L2 免閾值描述子（FR-63.10）

```text
reEntryCount       進入目標角半徑後又離開、再進入的次數
dwellPathRatio     在 2× 角半徑內的累積角路徑長 / 角半徑
signReversalCount  進入角半徑後 dε/dt 的符號反轉次數
approachToFireMs   首次進入角半徑 → 該目標的首發開火
```

四者都是**單調計數或比值**，沒有峰值偵測、沒有平滑窗、沒有速度門檻。

⚠️ **角半徑必須讀 `meta.targets.hitbox`**（v8 為 `shape: 'sphere'`），與 `HitDetector` 同一來源（GD-7）。**不得**使用 `targetHitboxRadius()` —— 它對 sphere 高估 √3×（[KI-029](../../../../known_issue/KI-029-prop-clearance-inflates-sphere-hitbox-to-box-corner-radius.md)），那是 clearance 專用路徑。

## 方向預測曲線（FR-63.11）

```text
對每次擊殺 i、對每個窗長 W ∈ {30, 60, 90, 120} ms:
  (Σ dYaw, Σ dPitch) 取自 [t_kill(i), t_kill(i) + W] 的 ticks
  predictedBearing  = atan2(Σ dPitch, Σ dYaw)
  candidateBearings = 從 t_kill(i) 的視角到 aliveAt(t_kill(i)+一 tick) 各顆的方位角
  predicted = argmin |predictedBearing − candidateBearing|
  正確 ⟺ predicted === 實際下一顆被擊殺的目標

輸出: 逐 W 的 predictionAccuracy 與 n
```

- **`W` 是掃描出來的自變項，不是凍結的門檻。** 輸出是一條曲線，不是一個判定。
- **ground truth 是實際的下一次擊殺** —— 不需要合成已知意圖，也不需要驗證任何歸因規則。
- 用 `ticks[].dYaw`／`dPitch`（依事件自身 `timeStamp` 分桶，**真 128 Hz，與顯示率無關**），不用 `aim` 差分（更新率 = 顯示率）。
- 需要 T2 的 KI-035 修復才能保證 gain 正確。

## Steps

1. 實作 L2 四個描述子。角半徑讀 `meta.targets.hitbox`，路徑長以 `dYaw`/`dPitch` 累加。
2. 實作方向預測曲線；`directionWindowsMs` 由 options 傳入，預設 `[30, 60, 90, 120]`。
3. **掃描測試**：讀 `microFlickMetrics.ts` 的 L2 區段，斷言不含任何速度門檻常數（掃 `DegPerSec`／`peakFloor`／`sgWindow`／`stopRatio`／`lowRatio`）。
4. **GD-7 同源測試**：斷言 L2 讀到的角半徑等於 `HitDetector` 判定所用的半徑；並斷言 `targetHitboxRadius` 未被 import。
5. 合成 fixture：
   - **E1** 直線 flick 進靶即開火 ⇒ `reEntryCount === 0`、`signReversalCount === 0`
   - **E2** 過衝後回頭 ⇒ `reEntryCount >= 1` 且 `signReversalCount >= 1`
   - **E3** 一路碎步修正 ⇒ `signReversalCount` 顯著偏高、`dwellPathRatio` 大
   - **E4** 已知意圖的兩段軌跡（先朝 A 後轉 B 殺 B）⇒ 小 `W` 預測 A、大 `W` 預測 B
   - **E5** 60 Hz aim 更新模擬（`aim` 逐 tick 重複、`dYaw` 正常）⇒ 全部 L2 與方向量**不受影響**（釘死本 WP 不依賴 `aim` 連續性）
6. 測試逐 `W` 的預測準確率在單一意圖軌跡（E1）上隨 `W` 增大而不下降。

## Definition of Done

- [ ] `npx.cmd vitest run src/metrics/microFlickMetrics.test.ts` exit 0
- [ ] 門檻常數掃描測試綠（五個字串，count === 0）
- [ ] GD-7 同源測試綠，且 `targetHitboxRadius` 未被 import（以 import 掃描佐證）
- [ ] E1–E5 五份 fixture 各有具名測試且綠
- [ ] E5 的測試名明示「不依賴 aim 連續性」（KI-031 懸崖的回歸防線）
- [ ] E4 的逐 `W` 預測結果記入 `progress.md`（曲線形狀是本指標的主要產出）
- [ ] `npm.cmd run typecheck` ×2 exit 0；全量 Vitest exit 0

## Commit

```
feat(wp-63): T6 add threshold-free micro adjust and direction metrics
```
