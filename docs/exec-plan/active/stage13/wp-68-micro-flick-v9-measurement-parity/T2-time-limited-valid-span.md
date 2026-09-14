# T2 — 計時制 drill 的計分窗右界 + v9 FPS parity

> WP：[WP-68](README.md) · 估時 1 d · 相依：T1 · Risk：**High**
> 本 task 是全 WP 唯一動到**已釋出數字**（v0.1.1 的 v8 指標）的地方。風險不在寫，在**不小心改到 v8**。

## 問題陳述

[`microFlickMetrics.ts`](../../../../../src/metrics/microFlickMetrics.ts) 的 `deriveOutcome()`：

```ts
const validSpanMs = hasSpan ? lastKillMs - firstVisibleMs : undefined;
```

- **v8**（`endCondition: targetCount 60`）：最後一顆被打掉 drill 就結束 ⇒ `lastKillMs` ≈ run 尾端，定義自然。
- **v9**（`endCondition: timeLimit 60000`）：受試者在最後一次擊殺**之後**仍有真實剩餘時間在打、在失手、在找靶。那段時間被整段排除出分母 ⇒ **`killRateHz` 系統性高估**。

偏誤方向與 [KI-037](../../../../known_issue/KI-037-valid-duration-includes-countdown.md)（恆向低估）相反，性質相同：看起來合理、實際會說錯話的數字（C-D3）。

> **KI-037 不是本 task 的標的**：它的標的是 [`DrillMetricRegistry.validDurationMs()`](../../../../../src/history/DrillMetricRegistry.ts)（history／assessment 投影路徑，v9 為 practice 不進該路徑），且它談的是**左界**（倒數）。本 task 只解 `deriveOutcome()` 的**右界**。**不得**順手改 `DrillMetricRegistry` —— 那是另一條路徑上的另一個 bug，有自己的 `BD` 號與修法。

## Steps

1. **先確認 C-D5 邊界**：以 T0 的 CodeGraph 結果複核 `deriveOutcome` 未被任何晉升指標（`seg-v2`／`phase-v1`／`curve-v1`／`sync-v1`／`sg-seg-v2`）或 `DrillMetricRegistry` 消費。**若被消費，停止並先入帳** —— 那會讓本 task 變成晉升指標語意變更，須走 C-D5 的雙實作對表。
2. **選定右界來源**（README §2.2 的路徑 A vs B，T0 已給出 `endCondition` 是否在匯出 schema 內的答案）：
   - 走 **B**（預期）：以 `drillId → drill config` 查表取 `endCondition`，比照 T5 既有的 `resolveCycletimeMs()` 先例（同一個檔已有這個模式，不是新發明）。
   - **決策與理由寫進 `progress.md`**，含被否決的那條與否決理由。
3. **實作右界分流**：
   - `endCondition.type === 'timeLimit'` ⇒ 右界取**最後一個 tick 的 `t`**（OQ-68.3 的預設：匯出自身的事實，不需要相信 config 與實際錄製對得上）。
   - 其餘（含 `targetCount`）⇒ **維持 `lastKillMs`**，並標 `scoring_window_truncated_at_last_kill` 讓該語意在輸出上可見（它一直都在，只是以前沒說）。
   - 查不到 `drillId` 的 config ⇒ 標 `unknown_end_condition` 並**退回既有語意**；不猜、不預設成 timeLimit（FM-2）。
4. **釘死 v8 逐位不變（FR-68.4 / FM-1）**：一條測試以 T1 後的 v8 payload 斷言 `validSpanMs`／`killRateHz`／`shotsPerKill`／`shotAccuracy` 四量對「本 task 之前」的值 `Object.is` 相同。⚠️ 期望值**寫死成常數**，不要用「再跑一次實作」產生 —— 後者會讓測試把任何回歸一起抄進去。
5. **量出差值並入帳**：對同一份 v9 payload 分別以兩種右界計算，把 **(a) 右界秒數差** 與 **(b) `killRateHz` 的相對差** 記入 `progress.md`。那個差值就是這條 FR 存在的理由；只寫「已修正」不合格。
6. **v9 的四 FPS parity（NFR-68.3）**：複用 [`wp63-v8-metrics-determinism.test.ts`](../../../../../src/loop/__tests__/wp63-v8-metrics-determinism.test.ts) 的 harness 形狀跑 v9。
   ⚠️ **不要只加一個 `it()` 就宣稱覆蓋** —— 那份 harness 的第一條測試是「非空對空」前置（斷言 trace 真的有 kill、有 hit 也有 miss、四層指標都出數）。v9 的靶更小（角半徑約 1.118° vs v8 的 1.242°），既有的瞄準 offset 參數**可能讓 v9 全部失手**。v9 版本必須有自己的非空對空前置，必要時調整 offset 常數並在註解寫明為何與 v8 不同。
7. **旗標詞彙表封閉性**：兩個新旗標進 `MICRO_FLICK_OUTCOME_FLAG_VOCABULARY`，既有的封閉性測試自動涵蓋；確認它確實會咬（暫時加一個表外字串應轉紅）。

## Definition of Done

- [ ] `npx.cmd vitest run src/metrics/microFlickMetrics.test.ts` exit 0
- [ ] FR-68.3／68.4／68.5 逐條有具名測試
- [ ] **v8 四量對 T1 後的值逐位 `Object.is` 相同**，期望值為寫死常數而非實作產生
- [ ] `unknown_end_condition` 有具名測試（FM-2），且退回的是既有語意而非猜測
- [ ] v9 兩種右界的**實測差值**（秒數 + `killRateHz` 相對差）記入 `progress.md`
- [ ] v9 的四 FPS 逐位一致斷言綠，且有自己的非空對空前置（含實測 trace 形狀數字）
- [ ] 六個 canonical derivation 檔（`peekWindows`／`trackingDerivation`／`detectionDerivation`／`eyeOrigin`／`angularKinematics`／`submovement`）`git diff` 為空
- [ ] `src/history/DrillMetricRegistry.ts` `git diff` 為空（不得順手改 KI-037）
- [ ] `npm.cmd run typecheck` ×2、`npm.cmd test`、`npm.cmd run build` 皆 exit 0
- [ ] 右界來源的選定理由與被否決方案入 `progress.md`

## Commit

```
feat(wp-68): T2 score time-limited drills to the end of the clock
```
