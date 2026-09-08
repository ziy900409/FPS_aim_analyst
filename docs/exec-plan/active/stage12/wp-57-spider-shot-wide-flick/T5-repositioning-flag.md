# WP-57 T5 — 抬滑鼠疑慮標註與門檻敏感度表

## Objective

把「低感度選手被迫抬滑鼠重新定位」這個混淆因子從隱形變成可見：交付離線純函式標註疑似 repositioning 的 transition，並以敏感度表交代門檻選擇，而不是硬塞一個數字。**這是資料品質標註，不是構念，不得進教練報告（C-D3）。**

## Steps

1. 新增 `src/metrics/spiderShotRepositioning.ts`，實作 README §2.8 的 `deriveRepositioningSuspicion()`：
   - 偵測窗 = movement onset 之後、首次 on-target 之前（兩個邊界皆取自既有 canonical derivations，不自建第二套 onset 判定）；
   - 判準 = 窗內存在連續 ≥ `stallMinMs` 的區段，其角速度 `abs(omega) < stallOmegaDegPerSec`；
   - 輸出 `suspected`／`stallStartMs`／`stallDurationMs`；
   - 純函式：不讀時鐘、不讀隨機、不 import DOM／three。
2. 角速度來源沿用既有 `omegaDegPerSec()`／`ticks[].dYaw` 的正規路徑（KI-005 A1 後的事件時間戳積分），**不新建第二套 ω 計算**（C-D4）。
3. 合成訊號測試：
   - 真停滯（窗內長時間 ω ≈ 0 後再度加速）→ `suspected = true`；
   - 刻意停頓（短於門檻）→ `suspected = false`；
   - 無停滯的一次到位拉槍 → `suspected = false`；
   - 窗界外的停滯（movement onset 之前 / on-target 之後）→ 不觸發。
4. 門檻敏感度表：對 T6 之後取得的真實 run（或 T6 前以既有 spider-shot fixture 代替並註明），在 `stallMinMs × stallOmegaDegPerSec` 網格上輸出標註率，寫進 [progress.md](progress.md)。**不凍結單一門檻**，交由 OQ-57.5 收斂。
5. 把 `cm/360`（T4 交付的離線推導）與標註率並列，檢查是否呈現「cm/360 越大、標註率越高」的預期方向；若方向相反或無關，那是偵測器有問題的訊號，必須在 progress 記下並重新評估判準。
6. C-D3 過閘證據：boundary 測試證明本模組**未被** `diagnosisRules.ts`／教練報告產生路徑／`DrillMetricRegistry` 引用。
7. 跑全量 metrics regression。

## Invariants

- 命名與型別皆保留 `Suspicion` 語意；不得出現 `repositioningCount` 之類看起來像指標的名稱。
- 不做線上偵測、不阻擋輸入、不改 sim。
- 不修改 `spiderShotMetrics.ts` 的輸出 shape。
- 誠實記錄限制：本旗標與刻意停頓在觀測上不可完全分離。

## Definition of Done

- [x] 四類合成訊號分類全部正確（真停滯／刻意停頓／一次到位／窗界外 onset 前後兩版）。
- [x] 角速度來源沿用既有正規路徑，無第二套 ω 實作（boundary scan：必須 import `omegaDegPerSec`，且程式碼不得出現 `dYaw`／`dPitch`／`Math.hypot`／`Math.atan2`）。
- [x] 門檻敏感度表已寫入 [progress.md](progress.md)。**明確註明為合成 cohort**——repo 內不存在真人的 wide-flick 匯出（D-57.T5-4／Surprises 15、16）。
- [x] `cm/360` 與標註率的方向性檢查已記錄：單調非遞減 `[0,0,0,4,8,9]/12`，方向與預期一致，逐格釘死在測試裡。
- [x] C-D3 boundary 測試綠：遞迴掃 `src/` 全部 `.ts`，importers = `[]`（比黑名單三檔更強，見 D-57.T5-5）。
- [x] OQ-57.5 **維持開放**，owner／deadline 已明確：使用者（實機）+ 工程，晉升 WP 前；交付參考門檻 `stallMinMs=100`／`stallOmegaDegPerSec=15`（未凍結、未進 production 常數）。
- [x] 全量 metrics regression exit 0：`npx vitest run src/metrics tests/golden` → 41 files／287 tests passed。

## Commit

```text
feat(metrics): flag suspected mouse repositioning in wide flicks
```
