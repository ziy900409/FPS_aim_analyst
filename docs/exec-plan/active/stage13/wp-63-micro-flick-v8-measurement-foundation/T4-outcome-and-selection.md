# T4 — L0 結果層 + L3 選擇策略層

> WP：[WP-63](README.md) · 估時 2 d · Risk Med · 相依：T3
> 對應 FR-63.4／63.5／63.6／63.15

## 目的

交付兩層**完全不需要意圖歸屬**的指標。L0 是結果、L3 是 v8 獨有的構念 —— 三顆自由選擇讓「選哪一顆」本身成為被測能力，而不是要消掉的雜訊。

## L0 結果層（FR-63.6）

```text
killRateHz        = 60 / T_valid              # T_valid 從倒數（countdownMs 3000）結束起算
shotsPerKill      = N_fire / N_kill
shotAccuracy      = N_kill / N_fire
killIntervalP50Ms = median(t_kill[i] − t_kill[i−1])
killIntervalP90Ms = P90(同上)
```

⚠️ **擊殺時刻一律取 `fire.t where fire.hit === true`**。v8 為 hitscan ⇒ 匯出內 **0 個 `hit` 事件**（[README §0.3](README.md)）。任何照抄 `t_hit` 的實作會拿到空陣列而**靜默回傳 0 樣本**。

首顆的間隔（從倒數結束到第一次擊殺）**單獨回報**，不併入 `killInterval` 分布。

## L3 選擇策略層（FR-63.4／63.5）

```text
nearest2Deg[i]         = min 角距(被殺目標中心 → 擊殺瞬間的 2 顆倖存者)
nearest3Deg[i]         = min 角距(被殺目標中心 → 2 顆倖存者 + 下一 tick spawn 的 replacement)
nearestFirstRate       = #(下一顆被殺者 = 候選集中角距最小者) / #擊殺
selectionCostRatio     = Σ 實際擊殺順序角距 / Σ 貪婪最近鄰角距
selectionRankEntropy   = 選中 rank(1/2/3) 分布的 Shannon 熵
replacementEngagedRate = #(下一顆被殺者 = 上一次擊殺的 replacement) / #擊殺
```

- **`nearest2` vs `nearest3` 都算**（使用者 2026-09-10 決定）。差值本身有意義：`nearest3 − nearest2` 量的是 **replacement 有多常搶走注意力**。
- replacement 在擊殺當下**還看不見**（next-tick + 一個 render frame 延遲）⇒ 兩個候選集不是同一個心理現實，這正是分開報的理由。
- 角距一律以 `resolveEyeOrigin()` 的 eye 為頂點計算球面角，**呼叫既有實作**（C-D4）。

## Steps

1. 建立 `src/metrics/microFlickMetrics.ts`，介面照 [README §2.5](README.md)。
2. 實作 L0 五量；`T_valid` 從 `meta` 的 countdown 結束推導，暫停／失焦區間排除（若匯出無此資訊則整場計入並標旗標）。
3. 實作 L3 六量。`selectionCostRatio` 的貪婪基準線依 **OQ-63.2 預設 = 被殺目標中心**（不是擊殺瞬間的瞄準點）—— 基準線是幾何量，不該被執行誤差污染。實作時把選定值寫進版本字串旁的註解。
4. **可比性前置檢查**（[README §3.1](README.md)）：以 [WP-59](../../stage12/wp-59-micro-flick-v8-replacement-spacing/README.md) 既有 stress harness 產生大量 v8 spawn 序列，比較「replacement 群」與「倖存者群」的角距分布。分布不可比 ⇒ `replacementEngagedRate` 只出分層值、不出總量。結果（含兩群的 p10/p50/p90）記入 `progress.md`。
5. Fixture：
   - 一份**零 `hit` 事件**的 hitscan v8 匯出（釘死 §0.3）
   - 一份手算的 3-target 小案例（3 顆固定座標、已知擊殺順序），可用紙筆驗證 `selectionCostRatio`
6. 測試：
   - L0 五量對小案例的期望值
   - 零 `hit` 事件 fixture 仍能算出正確的 `killIntervalP50Ms`（若實作誤讀 `hit` 事件則此測試轉紅）
   - `nearest2Deg` 與 `nearest3Deg` 在 replacement 更近的案例上給出不同值
   - `selectionCostRatio` 對「完全按最近鄰順序擊殺」的合成序列 === 1.0（數值容差內）
   - FR-63.15：缺失一律 `undefined` + 旗標，不補零

## Definition of Done

- [ ] `npx.cmd vitest run src/metrics/microFlickMetrics.test.ts` exit 0
- [ ] 零 `hit` 事件 fixture 的測試綠，測試名明示「hitscan 無 hit 事件」
- [ ] 手算 3-target 案例的 `selectionCostRatio` 與 `nearestFirstRate` 期望值綠
- [ ] `selectionCostRatio === 1.0` 的貪婪序列斷言綠
- [ ] 兩群角距分布可比性檢查的 p10/p50/p90 記入 `progress.md`，並明示是否影響 `replacementEngagedRate` 的呈現方式
- [ ] 所有輸出攜帶 `n`、`flags`、`version: 'micro-flick-v1'`
- [ ] `npm.cmd run typecheck` ×2 exit 0；全量 Vitest exit 0

## Commit

```
feat(wp-63): T4 add micro flick outcome and selection metrics
```
