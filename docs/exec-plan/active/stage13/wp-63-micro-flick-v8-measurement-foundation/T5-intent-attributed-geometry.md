# T5 — L1 幾何層：意圖歸屬、角誤差、首發重定義、修正時間拆解

> WP：[WP-63](README.md) · 估時 2.5 d · Risk **High** · 相依：T3
> 對應 FR-63.7／63.8／63.9

## 目的

修掉 [README §0.1 #4](README.md) 那個最嚴重的靜默錯誤：`fire.offsetDeg` **永遠**對 `currentPeekId`（陣列首顆）算，`fire.firstShot` 也以它為鍵 ⇒ v8 的首發語意完全崩壞。

## 意圖歸屬（FR-63.7）

```text
對每個 fire 事件:
  候選集 = aliveAt(windows, fire.t)                    # T3 提供
  對每顆 c: err(c) = 球面角(視線(fire.viewYaw, fire.viewPitch), c.pos, eye)
  intendedTarget = argmin err(c)
  intendedFirstShotErrorDeg = min err(c)
```

**不得**採用 `fire.targetId`（失手時是陣列首顆）或 `fire.offsetDeg`（永遠是陣列首顆）。

命中時 `fire.targetId` 被 raycast 覆寫因而正確 —— 可用它做**交叉檢核**（命中的那一發，argmin 應該就是 `fire.targetId`），但不作為資料源。這條交叉檢核本身是一條有價值的測試。

> **T1 的紅利**：`usp_s_laser` 零散布 ⇒ 命中 ⟺ 角誤差 ≤ 角半徑，無隨機成分。「這一發本來想打誰、差了多少」是**完全確定**的，不需要任何機率推論。

**FM-2**：兩顆的 `err` 在數值容差內相等 ⇒ 標 `multiple_kill_candidates`，該發不進 L1 聚合。**不得**以陣列順序或 id 序決勝 —— 那正是本 task 要修的錯誤形態。

## 首發重定義（FR-63.8）

```text
該目標的首發 = 意圖歸屬為它的**第一發**射擊
firstShotHitRate = #(首發命中) / #(有首發的目標)
```

分母是「有首發的目標」，不是全部 `visible` —— v8 有些目標可能從未被瞄準（drill 結束時仍存活）。分母定義寫進版本字串旁的註解。

## 修正時間拆解（FR-63.9）

```text
correctionMs   = t_kill(X) − t_firstMissedShot(X)     # 首發失手 → 該目標被擊殺
cadenceWaitMs  = 該區間內被 cycletimeSec 排程擋住的累計等待
settlingMs     = correctionMs − cadenceWaitMs
```

`usp_s_laser` 的 `cycletimeSec: 0.17` ⇒ 補槍有 **170 ms 硬地板**。不拆解就會把武器節奏誤讀成玩家猶豫。

`cadenceWaitMs` 的算法：對區間內每一對相鄰 fire，若間隔恰等於 `cycleMs`（容差內）則該段全部計入 cadence wait；若間隔大於 `cycleMs`，只有 `cycleMs` 那段計入。

⚠️ `fire.t` 是**排程時刻**不是點擊時刻：單次點擊的首發 `nextFireT = ev.t`（真實 mouse-down 時間戳），按住時後續發為 `nextFireT += cycleMs`。用 `ticks[].fire`（逐 tick `heldFire`）可分辨點擊 vs 按住，該資訊須進旗標。

## Steps

1. 在 `microFlickMetrics.ts` 實作 `geometry` 層。角度計算一律呼叫 `resolveEyeOrigin()` 與既有球面角實作（C-D4）。
2. 研究側入口一律 `strictEyeOrigin: true` ⇒ `meta.scene.eye` 缺席時**拋錯**（FM-3），不靜默用 `legacy-default`。
3. 實作 `multiple_kill_candidates` 的判定（T3 已備妥旗標槽位）。容差取 `1e-9` deg，與既有慣例一致。
4. 實作首發重定義與 `firstShotHitRate`。
5. 實作 `correctionMs` / `cadenceWaitMs` / `settlingMs` 三段拆解，`cycletimeSec` 從 `meta.weapon` 讀，**不寫死**。
6. **對抗性 fixture**：
   - **D1** 一發同時對兩顆等距 ⇒ 期望 `multiple_kill_candidates` 且不入聚合
   - **D2** 一發的 `fire.targetId` 與 argmin 不同 ⇒ 期望採用 argmin（若實作誤用 `targetId` 則此測試轉紅）
   - **D3** 命中的一發 ⇒ 期望 argmin === `fire.targetId`（交叉檢核）
   - **D4** 缺 `meta.scene.eye` ⇒ 期望拋錯
   - **D5** 首發失手 → 隔 170 ms 補一發命中 ⇒ 期望 `cadenceWaitMs ≈ 170`、`settlingMs ≈ 0`
   - **D6** 首發失手 → 隔 500 ms 補一發命中 ⇒ 期望 `cadenceWaitMs ≈ 170`、`settlingMs ≈ 330`
7. 測試全部 FR-63.7／63.8／63.9 條目 + 六份對抗性 fixture。

## Definition of Done

- [ ] `npx.cmd vitest run src/metrics/microFlickMetrics.test.ts` exit 0
- [ ] D1–D6 六份對抗性 fixture 各有具名測試且綠
- [ ] D2 的測試名明示「採用 argmin 而非 fire.targetId」
- [ ] D3 交叉檢核在正常 v8 fixture 的**全部**命中發上成立（不只抽樣）
- [ ] `cycletimeSec` 為讀 `meta.weapon` 而非常數（以測試傳入不同 cycletime 佐證）
- [ ] `intended*` 命名紀律：輸出欄位不得出現不帶 `intended` 前綴的「該發的目標」語意欄位
- [ ] `npm.cmd run typecheck` ×2 exit 0；全量 Vitest exit 0

## Commit

```
feat(wp-63): T5 add intent-attributed shot geometry metrics
```
