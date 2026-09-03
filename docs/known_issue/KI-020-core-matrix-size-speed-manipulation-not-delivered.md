# KI-020 — core 2×2「size × speed」matrix 實際上沒有操弄 size，也沒有操弄 speed

> 類型：research-validity bug（刺激不符預註冊操弄；匯出 metadata 宣稱的值從未被交付）。
> 狀態：🔴 **未修，待研究者決定**（改動 T0 預註冊 candidate 參數，屬研究決策）。診斷完成
> （WP-54 T6 slice 8，2026-09-03）。
> 決策帳本：[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) BD-020（待決狀態）。
> 發現脈絡：與 [KI-019](KI-019-reversal-2d-v1-bound-pinned-schedule-degeneration.md) 同一批——
> WP-54 T6 第一份真人資料（P01，9 個 block，2026-09-03）經
> `scripts/analyze-tracking-pilot.ts` 重建刺激時發現。

## 1. 症狀（真實資料 + 由 config 逐位重算）

用每份匯出檔自己的 `meta.spawn.trackingTrajectory` 重建軌跡、以 128 Hz 取樣 25 秒 scored 窗：

| block | config 宣稱 `targetRmsSpeedDegPerSec` | **實際交付 RMS 速度** | 實際最大位移振幅 | TOT |
|---|---|---|---|---|
| `2deg_5dps` | 5 | **1.21 deg/s（24%）** | 1.60 / 1.53° | 100.0% |
| `2deg_20dps` | 20 | **1.18 deg/s（6%）** | 1.65 / 1.80° | 100.0% |
| `0p5deg_5dps` | 5 | **0.32 deg/s（6%）** | 0.39 / 0.42° | 100.0% |
| `0p5deg_20dps` | 20 | **0.30 deg/s（1%）** | 0.43 / 0.46° | 100.0% |
| `calibration_horizontal` | 5 | 0.87 deg/s（17%） | 1.88 / 0.08° | 100.0% |
| `calibration_vertical` | 5 | 0.89 deg/s（18%） | 0.08 / 1.76° | 100.0% |

兩個結論直接讀得出來：

1. **speed 這個自變數完全失效**：同一 size 下 5 deg/s 與 20 deg/s 交付的速度差 2%
   （1.21 vs 1.18；0.32 vs 0.30）。四個 cell 實際上只有兩種條件（振幅 2° 與 0.5°）。
2. **匯出 metadata 說謊**：`meta.spawn.trackingTrajectory.targetRmsSpeedDegPerSec = 20` 的 block，
   刺激實際是 1.18 deg/s。這違反 NFR-54-5「每個結果必須能重建刺激」的精神——欄位可 round-trip，
   但欄位值不是被交付的東西。

## 2. 根因（兩個獨立問題）

### 2.1 F-B：`boundedSpeedScale` 靜默取 min，且 config 在該頻帶下不可實現

`src/sim/trackingTrajectory.ts`：

```ts
function boundedSpeedScale(components, targetRmsSpeedDegPerSec, boundDeg): number {
  const speedScale = targetRmsSpeedDegPerSec / rawVelocityRms(components);
  const boundScale = boundDeg / rawPositionAmplitudeBound(components);
  return Math.min(speedScale, boundScale); // ← 邊界安全優先，且不通報
}
```

設計註解明寫「兩者衝突時邊界安全永遠優先於精確命中目標 RMS 速度」——這個取捨本身合理（位置越界比
速度不準嚴重），**但它是靜默的**：config 要求的速度在該振幅/頻帶下不可能達成時，系統照樣載入、
照樣把宣稱值寫進 metadata。

在 `frequencyBandHz = [0.1, 0.7]`、5 個對數等距分量下，`boundScale` 在**四個 cell 全部**都是較小
的那個，因此交付速度**只由振幅決定、與 `targetRmsSpeedDegPerSec` 無關**。實測轉換係數：

```text
交付 RMS 速度 ≈ 0.605 × 振幅(deg)     （band [0.1, 0.7] Hz）
  振幅 2.0° → 1.21 deg/s   （實測 1.18–1.21）
  振幅 0.5° → 0.30 deg/s   （實測 0.30–0.32）
```

反推：在此頻帶下要交付 5 deg/s 需要振幅 ≈ **8.3°**；要 20 deg/s 需要 ≈ **33°**。或維持振幅 2°
而放寬頻帶：5 deg/s 需要頻帶 ×4.1（`[0.41, 2.87]` Hz）、20 deg/s 需要 ×16.5
（`[1.65, 11.6]` Hz——那已經是抖動而不是 pursuit）。

### 2.2 F-C：「size」被實作成 travel amplitude，目標角尺寸從未被操弄

`src/drill/tracking_core_pr_pilot_v1.ts` 把 size candidate 接到 `yawBoundDeg`/`pitchBoundDeg`
（＝行程振幅），檔案註解也如此自述：

```ts
yawBoundDeg: sizeDeg,      // CORE_PR_PILOT_V1_SIZE_CANDIDATES_DEG = [2.0, 0.5]
pitchBoundDeg: sizeDeg,
```

而**沒有任何 cell 設定 `targets.hitbox`**（`grep hitbox src/drill/tracking_*_pilot_v1.ts` 無結果），
所以四個 cell 共用預設 H1 hitbox `{1,2,1}`。在 4 單位距離下該 hitbox 約橫跨 ±7°、縱跨 ±14°
（幾何估算），與 0.5°/2.0° 差了一個量級。

實測佐證：**六個 block 的 TOT 全部 100.0%**，`p95 ε` 高達 3.63°（reversal high）仍算 on-target。
也就是 on-target 判定的容許角誤差是好幾度，TOT 這個 P0 companion 指標在目前 config 下不帶任何
資訊量。

這與 README 的語意不一致：

- README §3 風險表：「**0.5 deg 目標**接近 pixel floor｜量到視覺可辨識度而非 tracking｜T7
  visibility check」——講的是**目標角尺寸**，不是行程振幅。
- FR-54-4 驗收：「export 可辨識 motion version、seed、**angular size**、speed cell」。
- OQ-54-2 凍結的是「`2.0 deg / 0.5 deg × 5 deg/s / 20 deg/s`」作為 **calibration candidates**。

T2 在自己的檔案註解裡宣告了「size = travel amplitude」的解讀，但這個解讀從未寫進 progress.md 的
decision log，也沒有回頭對齊 README 的風險表與 FR-54-4 用語。**兩個 axis calibration block 的用途
（判斷 0.5° 目標是否可辨識）在目前 config 下根本不可能達成**——它們的目標和其他 cell 一樣大。

## 3. 影響面

- **P01（2026-09-03）四個 core cell + 兩個 calibration block 的資料無法支撐任何條件比較結論**：
  speed 對比不存在，size 對比是行程振幅而非目標尺寸。P0 primary（RMS ε：0.73–1.17°）本身是有效
  量測，但它量到的條件不是預註冊的條件。
- **T7 難度校準無法在現行 config 上執行**：floor/ceiling、0.5° pixel/aliasing floor、
  size × speed 交互效果全部建立在「size 與 speed 真的被操弄」之上。
- **TOT 需要重新檢視**：若目標尺寸改為真的 0.5°/2.0°，TOT 才會離開 100% 並帶資訊量；
  屆時 `acquisitionFailureRate`、`tAcquireMs`（目前全為 0）也才有變異。
- 不影響 legacy drill：`band-limited-2d-v1` 只被 WP-54 使用。

## 4. 修法選項（**待研究者決定**）

### 4.1 F-C：「size」要不要改成目標角尺寸？

| 選項 | 具體改動 | 後果 |
|---|---|---|
| **(1) 改成目標角尺寸**（與 README 風險表/FR-54-4 一致） | 每個 cell 設 `targets.hitbox`，讓目標在 4u 距離下真的橫跨 0.5°/2.0°；行程振幅改為獨立參數（由 §4.2 的速度需求決定） | 需重跑全部 core/calibration block；TOT/acquisition 開始有變異；0.5° 是否可辨識變成真的可測（正是 T7 要的） |
| (2) 維持「size = 行程振幅」 | 只需回改 README 風險表與 FR-54-4 的用語，並明確記錄「本 WP 不操弄目標角尺寸」 | 「0.5° 接近 pixel floor」的風險項與兩個 axis calibration block 失去意義，應一併刪除或改寫；T7 的 visibility check 也要重新定義 |

### 4.2 F-B：speed 要怎麼真的被交付？

| 選項 | 具體改動 | 後果 |
|---|---|---|
| **(1) 放大行程振幅到可實現速度**（若採 §4.1(1)，振幅已與 size 解耦，這是自然選擇） | 5 deg/s → 振幅 ≈ 8.3°；20 deg/s → ≈ 33°（band 不變） | 20 deg/s 的目標會橫跨約 66° 行程，在 103° FOV 內但幅度很大；需確認受測者是否需要大幅轉頭（那會混入 flick 成分而非純 pursuit） |
| (2) 同時放寬頻帶與振幅 | 例：振幅 6°＋band `[0.2, 1.2]` Hz ≈ 6.9 deg/s | 頻帶是「pursuit 可預測性」的隱含操弄變數，改它等於改刺激性質，需要重新論證 |
| (3) 降低 speed candidate 到可實現範圍 | 例改為 `1.2 / 0.3 deg/s`（現行實際交付值） | 誠實但可能太慢，難以在 25 秒內產生足夠難度變異；等於承認 OQ-54-2 的速度候選不可用 |

### 4.3 無論選哪個都要做的配套（實作端，不需研究決策）

在 `createBandLimited2dV1()` 加**建構期一致性檢查**：`speedScale > boundScale` 時 fail fast
（訊息帶上「此振幅/頻帶下可交付的最大 RMS 速度」），讓「config 宣稱值 ≠ 交付值」不可能再靜默發生。
**故意不先落地**：現行四個 cell 全部會因此在載入時 throw，守衛必須與再參數化同批進來
（與 [KI-019](KI-019-reversal-2d-v1-bound-pinned-schedule-degeneration.md) §5 同一個理由）。

## 5. DoD

- [ ] 研究者決定 §4.1 與 §4.2 的選項；決議寫入 WP-54 progress.md（新 decision row）與
      `docs/exec-plan/DECISIONS.md`（若跨 WP）。
- [ ] core/calibration config 再參數化，並在 `createBandLimited2dV1()` 加建構期一致性守衛。
- [ ] 回歸測試：每個 cell 的**交付** RMS 速度與宣稱值誤差在容許範圍內；若採 §4.1(1)，另加
      「每個 cell 的目標角尺寸符合其 size candidate」。
- [ ] 更新 `docs/operational/analysis-tracking.md`（角尺寸/速度語意）與 README（風險表、FR-54-4
      用語、OQ-54-2 狀態）。
- [ ] P01 的 core/calibration block 重跑。
