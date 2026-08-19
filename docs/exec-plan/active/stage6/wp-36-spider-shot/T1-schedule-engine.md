# T1 — center-peripheral 排程引擎(schema + TargetManager 分支 + zone/spiderShot 回顯)

> Part of [WP-36 spider-shot](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(排程落點/欄位命名拍板) |
| **Risk / Cplx** | **Med–High** / Med(唯一觸碰 `TargetManager` 熱路徑分支 + 唯一新增二維極座標幾何——零破壞不變式是主要風險所在) |
| **Touches** | MODIFY `src/drill/DrillConfig.ts`(新增 `spiderShot?: SpiderShotScheduleConfig`)、`src/drill/schema.ts`(`validateSpiderShotSchedule` + 互斥規則)、`src/sim/TargetManager.ts`(center-peripheral 分支)、`src/data/DataRecorder.ts`(`DrillEvent.visible.zone?`)、`src/data/metadata.ts`(`SpawnMeta.spiderShot?`);REUSE `src/recoil/rng.ts`(`createRan1`/`randomFloat`,不改) |
| **狀態** | ⬜ |

## Objective

交付 FR-F8 的排程核心:`DrillConfig.spiderShot` config 驅動 `TargetManager` 進入獨立的 center-peripheral 排程分支——命中中心後依 seeded 二維極座標(方位角 + 徑向角距 + 世界距離)在周邊 spawn,命中周邊後固定回中心;無 `spiderShot` config 的既有 drill 逐位不變。

## In scope

1. `DrillConfig.ts` 新增 top-level additive `spiderShot?: SpiderShotScheduleConfig`(`kind`/`seed`/`centerDistanceU`/`peripheral: SpiderPeripheralConfig`,見 [README §2①](README.md))。
2. `schema.ts` 新增 `validateSpiderShotSchedule()`:驗證 `angularRadiusDegRange`/`azimuthDegRange`(0–360°範圍)/`distanceURange` 的順序與正有限性;若 T0 拍板為互斥,加入「`spiderShot` 與 `targets.spawnArea`/`sequence.spawnDelayMsRange` 不應同時提供」的檢查。
3. `TargetManager.ts` 新增分支:`config?.spiderShot !== undefined` 時,以內部 `zone: 'center' | 'peripheral'` 狀態(初始 `'center'`)取代該分支的 `nextSide` 邏輯;`markKilled` 時翻轉 `zone`;翻入 `'peripheral'` 時用 `createRan1(seed)` 建的 stream 依序取樣 `(azimuthDeg, angularRadiusDeg, distanceU)`,以「繞中心視線的球面偏移」換算世界座標(y 分量隨方位角變化,非既有 `TARGET_Y` 水平模型);翻入 `'center'` 時位置固定為 `centerDistanceU` 正前方(x=0, y=`TARGET_Y`, z=`-centerDistanceU`)。既有 `nextSide`/`alternation`/`sampleSpawnPose` 分支**零改動**。
4. `DataRecorder.ts` 的 `visible` 事件新增 additive `zone?: 'center' | 'peripheral'`,由 `TargetManager` spawn 時提供給呼叫端蓋章(比照既有 `side` 蓋章時機)。
5. `metadata.ts` 的 `SpawnMeta` 新增 additive `spiderShot?: unknown`,由 collectMeta 呼叫端回顯 `config.spiderShot`(不透明,不解析,比照既有 `spawnArea` 慣例)。
6. **零破壞閘(DoD 首項)**:`config.spiderShot` 省略路徑程式碼不變(交替/計數/取樣邏輯原樣);先跑既有決定性回歸全綠再進新功能測試。
7. 新決定性測試:同 seed 兩次 reset+run → 周邊 spawn 序列(方位角/角距/距離)逐位一致;不同 seed → 序列不同(sanity)。
8. 四象限 + 兩斜向合成 fixture:方位角 0°/90°/180°/270°(正上/右/下/左)+ 45°/225° 斜向,逐案例斷言世界座標與獨立手算值一致(不透過待測函式重算,避免自我驗證)。

## Out of scope

- `spider-shot-v1` drill config 本身、`D_deg`/`W_deg`/象限標記推導(T2)。
- 五類指標(T3)。

## Steps

- [ ] `DrillConfig.ts`/`schema.ts` 擴欄 + 驗證測試(合法/非法/與既有 spawn 機制併用規則,依 T0 D-36.2 拍板結果)。
- [ ] **既有決定性回歸全綠**(改動前基準 → 改動後重跑,證據記 progress)。
- [ ] `TargetManager.ts` center-peripheral 分支 + 同 seed 重現測試 + `reset()` 重建 stream 測試。
- [ ] 四象限 + 兩斜向合成 fixture 世界座標斷言。
- [ ] `DataRecorder.ts`/`metadata.ts` additive 欄位 + 既有匯出決定性 baseline 零重錄的斷言。
- [ ] `npx vitest run` 全綠。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | `spiderShot` 省略:既有測試零修改全綠 | `TargetManager.test.ts`/`schema.test.ts`/`DrillLoader.test.ts` diff 為空 |
| ② | 同 seed 同序列;不同 seed 不同序列 | 新增決定性測試綠 |
| ③ | 四象限 + 兩斜向世界座標換算正確 | 合成 fixture 逐案例斷言 |
| ④ | `zone`/`Meta.spawn.spiderShot` additive,既有匯出決定性 baseline 零重錄 | 既有匯出相關測試 diff 為空 |
| ⑤ | `npm run test:ci` 全綠 | CI 輸出貼 progress.md |

## Commit

`feat(wp-36): T1 — center-peripheral 排程引擎(schema + TargetManager 分支 + zone/spiderShot 回顯)`
