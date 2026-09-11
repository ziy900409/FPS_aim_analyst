# T3 — `buildTargetWindows()`：population-aware 窗界原語

> WP：[WP-63](README.md) · 估時 2.5 d · Risk **High** · 相依：T0
> 對應 FR-63.1／63.2／63.3、NFR-63.3／63.4

## 目的

補上 v8 缺的那一層。既有 [`buildPeekWindows()`](../../../../../src/metrics/peekWindows.ts) 的窗界是 `[visible_i.t, visible_{i+1}.t)` —— 嚴格序列單目標模型。v8 的下一個 `visible` 通常屬於**另一顆**，所以每顆的分析窗會被別人的 spawn 截斷。

本 task 交付的原語只做兩件事：**每顆目標的存活窗**、**某時刻誰活著**。

## 硬紀律（這是 High Risk 的原因）

新原語**不得**計算 `ε(t)`、on-target、eye origin 或 `ω(t)`。這四個量在 repo 內各有唯一實作（`trackingDerivation.ts`／`eyeOrigin.ts`／`angularKinematics.ts`），重寫任何一個就是 **C-D4** 違反。

NFR-63.4 的符號掃描測試是這條紀律的機械化判準，比照 [GD-36](../../../DECISIONS.md) ③ 為 `mouseSampleGaps.ts` 做的同型掃描。

## Steps

1. 建立 `src/metrics/targetWindows.ts`，介面照 [README §2.5](README.md)。
2. 實作窗界重建：
   - `visible` 事件 → 每顆一個窗，`tVisibleMs = event.t`，`pos` 取 `targetX/Y/Z`
   - 缺座標 ⇒ 標 `no_position`（**不**回退到 `ticks[].tx`）
   - `tKillMs` = 該目標 id 被 raycast 歸屬的 `fire.hit === true` 事件時刻。v8 為 hitscan ⇒ **不讀 `hit` 事件**（[README §0.3](README.md)）
   - drill 結束仍存活 ⇒ `tKillMs` 缺席 + 標 `never_killed`
3. 實作 `tickRange`：以半開區間 `[tVisibleMs, tKillMs)` 對排序後的 ticks 做二分搜尋；容差比照 `peekWindows.ts` 的 `WINDOW_EPSILON_MS = 1e-9`（**引用該常數，不另定義**）。零 tick ⇒ 標 `empty_tick_range`。
4. 實作 `aliveAt(windows, tMs)`：回傳所有滿足 `tVisibleMs <= tMs && (tKillMs === undefined || tMs < tKillMs)` 的窗。v8 正常情況恆為 2 或 3 顆。
5. 實作 `ammo_exhausted_in_window`（FR-63.13）：窗內存在 `fire.ammo === 0` 的 fire 事件即標記。
6. `multiple_kill_candidates` 旗標的**槽位**在此建立（實際判定在 T5 —— 它需要角誤差），本 task 只把它放進封閉詞彙表並確保型別可用。
7. 建立三份 fixture：
   - **A** 正常 v8（3 顆並發、60 kills）
   - **B** `never_killed`（drill 結束仍有 3 顆）
   - **C** `no_position`（pre-WP-56 形狀的 `visible` 事件）
8. 撰寫測試：
   - **不變式**：`windows.length === visible 事件數`（三份 fixture 皆成立）
   - 窗界不因別顆的 spawn 而截斷（fixture A 的每個窗長度 = 該顆真實存活時間）
   - `aliveAt` 在 v8 的每個擊殺時刻回傳 2 顆、下一 tick 回傳 3 顆
   - 旗標詞彙表封閉性（任何輸出旗標都在 `TARGET_WINDOW_FLAG_VOCABULARY` 內）
   - 不拋錯：所有異常 fixture 皆回傳結果 + 旗標
9. **NFR-63.4 掃描測試**：讀 `targetWindows.ts` 原始碼，斷言 `epsilon`／`onTarget`／`eyeHeight`／`SIM_TO_WORLD`／`acos` 五個字串的出現次數為 0。
10. **NFR-63.3 效能測試**：fixture A（約 180 個 `visible`、約 7,700 ticks）的 `buildTargetWindows()` 耗時 < 50 ms。

## Definition of Done

- [ ] `npx.cmd vitest run src/metrics/targetWindows.test.ts` exit 0
- [ ] 窗數不變式測試在三份 fixture 皆綠，測試名逐一指名 fixture
- [ ] NFR-63.4 符號掃描測試綠（五個符號，count === 0）
- [ ] NFR-63.3 效能斷言綠，實測耗時記入 `progress.md`
- [ ] `git diff --name-only` 對 `peekWindows.ts`／`trackingDerivation.ts`／`detectionDerivation.ts`／`eyeOrigin.ts`／`angularKinematics.ts` **為空**
- [ ] `WINDOW_EPSILON_MS` 為引用而非重新定義（以 import 語句佐證）
- [ ] `npm.cmd run typecheck` ×2 exit 0；全量 Vitest exit 0

## Commit

```
feat(wp-63): T3 add population-aware target window primitive
```
