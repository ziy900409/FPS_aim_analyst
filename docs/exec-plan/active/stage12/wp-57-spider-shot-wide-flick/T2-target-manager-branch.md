# WP-57 T2 — TargetManager 第三分支／分層佇列／決定性

## Objective

把 T1 的純函式接進 sim：在 `TargetManager` 新增 `center-peripheral-yawpitch` 的 spawn 取樣分支與 `side × pitchBand` 分層佇列，並以決定性證據證明既有兩支 spiderShot 分支逐位不變。**這是本 WP 唯一觸碰 sim 核心的 task。**

## Steps

1. 先跑 CodeGraph impact（`createTargetManager`／`sampleSpiderShotPose`／`buildSpiderZoneCells`／`shuffleInPlace`），記 blast radius。
2. **先錄 golden 再改碼**：對 `spider-shot-v1`／`spider-shot-v2` 各錄前 200 個 spawn 的位置序列（含 `markKilled()` 推進與 seed 重置後的重跑）為 golden fixture，commit 進本 task 的測試資料。此步驟必須在任何 `TargetManager` 修改之前完成，否則 golden 沒有證明力。
3. 新增 `SpiderWideCell` 型別與 `buildSpiderWideCells(config)`：`2 (side) × grid.pitchBands` 個 cell，`pitchDegRange` 等寬切分。
4. 新增 `sampleSpiderWidePeripheralPos()`：
   - 佇列為空 → 重建 cells + `shuffleInPlace(queue, spawnRng)`（沿用 v2 慣例，**不新建 RNG**）；
   - `pop()` 一個 cell；`yaw` 在 `peripheral.yawMagDegRange` 均勻取樣後套 cell 的 `side` 符號；`pitch` 在 cell 子區間均勻取樣；
   - 呼叫 T1 的 `spiderWideEyePos()` 產生位置。
5. 在 `sampleSpiderShotPose()` 加入第三分支：`kind === 'center-peripheral-yawpitch'` 時走上述路徑，`side` 回傳真實左右（不再恆為 `'R'`），`zone: 'peripheral'`；中心分支的位置改為 `(0, PLAYER_EYE_HEIGHT_U, -distanceU)`（`yaw = pitch = 0` 的球面解），**只對新 kind 生效**，v1/v2 的 `(0, TARGET_Y, -centerDistanceU)` 不動。
6. reset 路徑（seed 重建、`spiderZoneQueue = []` 等）補上新佇列的清空，語意與 v2 一致。
7. 測試：
   - **NFR-57.2**：v1/v2 golden byte-identical（步驟 2 的 fixture）；
   - **NFR-57.1**：同 resolved config + seed，在 4 種 render FPS（含 rAF 節流）下 tick-index 對應的 target position 逐位一致；
   - **NFR-57.5**：run 進行中改變 camera aspect（模擬 resize／解析度模式切換）後，後續 spawn 序列與未 resize 對照組逐位一致 —— **本 WP 最關鍵的閘**；
   - **NFR-57.7**：spawn 分支零額外配置（以 allocation 計數或物件重用斷言，比照既有 arena 紀律測試）；
   - cell 覆蓋：≥ 10,000 spawn 下每個 cell 的出現次數差 ≤ 1 個佇列週期；
   - L/R 平衡：每個完整佇列週期內左右次數相等；
   - 中心↔周邊交替、`zone` 蓋章、`centerExemptFromTimeout` 與 v2 行為 parity；
   - 所有 spawn 皆滿足 FR-57.4 的 NDC 不等式（以 resolved config 的 `resolvedFrom` 反推 halfHFOV）。
8. 跑全量 Vitest 與既有決定性 regression 套件。

## Invariants

- 新分支不讀寫 `nextSide`；不與 v1/v2 共用 zone queue 狀態。
- 不 import 任何 render／scene／`SettingsPanel`／時鐘／`Math.random`。
- 中心目標的 y 變更**只**發生在新 kind 分支；`TARGET_Y` 常數與其既有使用者不動。
- 佇列重建只在耗盡時發生，非 per-tick。

## Definition of Done

- [ ] v1/v2 spawn 序列 golden byte-identical，且 golden 是在改碼**之前**錄的（commit 順序可證）。
- [ ] NFR-57.1 四 FPS parity 綠。
- [ ] **NFR-57.5 aspect 不變性綠**（run 內 resize 不改 spawn 序列）。
- [ ] NFR-57.7 零額外配置有客觀斷言。
- [ ] cell 覆蓋與 L/R 平衡以 ≥ 10,000 spawn 統計證明。
- [ ] 交替／`zone`／`centerExemptFromTimeout` 對 v2 parity 綠。
- [ ] 全量 Vitest exit 0；既有決定性 regression 零修改通過。
- [ ] [progress.md](progress.md) 記 CodeGraph blast radius、測試數與四條 NFR 的實際數字。

## Commit

```text
feat(sim): add spider wide flick spawn branch with stratified queue
```
