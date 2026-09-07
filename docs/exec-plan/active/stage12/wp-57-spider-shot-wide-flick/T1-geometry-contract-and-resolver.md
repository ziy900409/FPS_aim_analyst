# WP-57 T1 — Config 契約／Eye-frame 投影／Arm-time Resolver

## Objective

凍結 `center-peripheral-yawpitch` 的 config 契約與 strict 驗證，並交付兩支純函式：eye-frame 球面投影與 arm-time resolver。本 task **不接 `TargetManager`**，也不接 `main.ts`——目的是先把幾何與驗證釘死在純函式層，讓 T2 的 sim 改動只剩「接線」。

## Steps

1. 在 `src/drill/DrillConfig.ts` 新增 `SpiderShotYawPitchConfig`（README §2.3 shape）並併入 `SpiderShotScheduleConfig` union。既有兩支型別**逐字不動**。
2. 在 `src/drill/schema.ts` 的 `validateSpiderShotSchedule()` 新增第三分支，逐欄位 strict 驗證：
   - `seed` 有限數；`distanceU` 正有限數；
   - `yawMagDegRange` 兩元素皆有限、下界 < 上界、下界 > 0、上界 < 90；
   - `pitchDegRange` 兩元素皆有限、對稱（`lo === -hi`）、`hi > 0`；
   - `grid.pitchBands` 正整數且 ≥ 1；
   - `resolvedFrom` 五個欄位皆存在且為有限數，`aspect > 0`、`0 <= screenMargin < 1`、`0 < kLo <= 1`；
   - 沿用既有的 `spiderShot` 互斥規則（不可與 `targets.spawnArea`／`sequence.spawnDelayMsRange`／`sequence.seed`／`targets.population` 併用）。
3. 新增 `src/sim/spiderEyeFrame.ts`：
   - `spiderWideEyePos(yawDeg, pitchDeg, distanceU): Vec3` —— README §2.2 的球面公式，`eye = (0, PLAYER_EYE_HEIGHT_U, 0)`；
   - `ndcForEyeAngles(yawDeg, pitchDeg, fovDegVertical, aspect): { x: number; y: number }` —— README §2.4 的兩條 NDC 關係；
   - 兩者皆純函式，`PLAYER_EYE_HEIGHT_U` 由 `src/scene/clearance.ts` 既有 export 取得，**不 import `SceneConfig`**。
4. 新增 `src/drill/spiderShotWide.ts`：`resolveSpiderWideYawPitch()`（README §2.4 簽章）+ 候選常數（依 T0 收斂的 OQ-57.1／57.2 值）。輸入非法時擲 typed error（FR-57.14），不回退預設值。
5. 新增 `src/drill/spider_shot_wide_v1.ts`：未解析的 drill template（`mode: 'practice'`、`playerControl: { translation: 'locked' }`、`targets.hitbox` sphere、`sequence: { alternation: 'LR' }` 相容欄位、`timing`、`endCondition`、`sceneId` 綁定），以及一支 `resolveSpiderShotWideV1(fovDegVertical, aspect): DrillConfig` 把 template + resolver 組成 resolved config。
6. 測試：
   - resolver 對 README §2.4 四列（16:9）+ T0 的 21:9／4:3 兩組輸出逐位相符；
   - `abs(spiderWideEyePos(...) − eye) === distanceU`（相對誤差 ≤ 1e-12），≥ 10,000 seeded 樣本（NFR-57.3）；
   - 12 組（4 FOV × 3 aspect）× ≥ 10,000 樣本的 NDC 不等式全通過（NFR-57.4）；
   - yaw/pitch → pos → yaw/pitch round-trip 誤差 ≤ 1e-12；
   - typed error 正負向矩陣：非有限／非正 FOV、`aspect <= 0`、`screenMargin >= 1`、退化與反轉區間、pitch 非對稱、`pitchBands` 非正整數、pitch 窗使目標埋地板；
   - schema 正負向：新 `kind` 合法 config 通過；v1/v2 既有 config 的 parse 結果**不變**（以既有 fixture 對帳）；
   - boundary scan：`spiderEyeFrame.ts`／`spiderShotWide.ts` 無 DOM／three／`node:*`／`fs`／`Date.now`／`performance.now`／`Math.random`（NFR-57.6）。
7. 跑既有 `schema.test.ts`／`DrillLoader.test.ts`／`TargetManager.test.ts`／export/metrics regression，確認零回歸。

## Invariants

- `center-peripheral` 與 `center-peripheral-stratified` 的型別、驗證路徑與 spawn 結果逐位不變。
- resolver 與投影不讀時鐘、不讀隨機、不讀 render／scene 物件。
- `PLAYER_EYE_HEIGHT_U` 是 sim 側常數的唯一來源；不得在本 WP 新增第二個眼高常數。
- 角徑只由 `targets.hitbox` + `distanceU` 決定（GD-7）；不新增尺寸常數。
- `resolvedFrom` 為必填而非 optional —— 沒有 provenance 的 resolved config 應該無法通過驗證。

## Definition of Done

- [ ] 新 union 分支與 strict 驗證全綠；typed error 正負向矩陣齊全（FR-57.1／57.14）。
- [ ] resolver 輸出與 README §2.4／T0 PoC A 逐位相符（FR-57.3）。
- [ ] NFR-57.3（角徑恆定 ≤ 1e-12）與 NFR-57.4（12 組 × 10,000 樣本、失敗數 0）成立。
- [ ] NFR-57.6 boundary scan 綠。
- [ ] v1/v2 的 schema／parse／既有 fixture 結果不變，`TargetManager` 尚未被修改（`git diff` 可證）。
- [ ] [progress.md](progress.md) 記 blast radius、測試數、resolver 實際輸出表與 OQ-57.1／57.2 落地值。

## Commit

```text
feat(drill): add spider wide flick geometry contract and resolver
```
