# T2 — `TargetManager.ts` 共用三角函式抽取 + 12 格洗牌佇列

> Part of [WP-44](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1 |
| **Risk / Cplx** | Med / Med(v1 回歸風險——共用三角函式抽取若順序/公式有誤,`TargetManager.test.ts` 既有精確世界座標斷言會抓到) |
| **Touches** | MODIFY `src/sim/TargetManager.ts`、`src/sim/TargetManager.test.ts` |
| **狀態** | ✅ |

## Objective

抽出 `sampleSpiderShotPose()` 內建的 azimuth/radius/distance → world pos 三角函式為共用 `peripheralPos()`(純重構,v1 輸出零改動),新增 `center-peripheral-stratified` 分支的 12 格(4 象限 × 3 距離 tier)洗牌佇列取樣路徑。

## Steps

- [x] 抽出 `peripheralPos(centerDistanceU, azimuthRad, radiusRad, distanceU): Vec3`,`sampleSpiderShotPose()` 的 `center-peripheral` 分支改呼叫它,抽樣順序(azimuth → radius → distance)不變。
- [x] 先跑一次既有 `TargetManager.test.ts`(WP-36 spider-shot 區塊)確認抽取後零回歸(四象限+兩斜向世界座標斷言逐位不變)。
- [x] 新增 `SpiderZoneCell` 型別 + `buildSpiderZoneCells(config)`(等立體角 `cos` 線性內插分層,4 象限 × 3 tier)+ `shuffleInPlace(items, rng)`(seeded Fisher–Yates)。
- [x] 新增模組層級 closure 狀態 `spiderZoneQueue: SpiderZoneCell[]`;`sampleSpiderShotPose()` 依 `spiderShot.kind` 分派:`center-peripheral-stratified` 的 peripheral 分支呼叫 `sampleStratifiedPeripheralPos()`(佇列空則重建+重洗,pop 一格,格內再均勻抽 azimuth/`cos`-radius/distance)。
- [x] `reset()` 新增 `spiderZoneQueue = []`,與 `spawnRng` 重播種同步發生。
- [x] 新增測試:同 seed 決定性(reset 後重放結果相同)、12 格在耗盡前不重複(azimuth 象限 × radius tier 組合覆蓋)、耗盡後重洗、世界座標落在宣告的 azimuth/radius 邊界內。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | v1(`center-peripheral`)世界座標斷言零回歸 | 既有 `TargetManager.test.ts` WP-36 區塊全綠 |
| ② | stratified 路徑決定性(同 seed reset 後重放一致) | 新測試 |
| ③ | 12 格在耗盡前覆蓋所有象限×tier 組合、不重複 | 新測試 |
| ④ | 耗盡後正確重洗(下一輪 12 個 spawn 依然覆蓋 12 格) | 新測試 |
| ⑤ | `npx tsc --noEmit` 全專案綠 | 執行確認 |

## Commit

`feat(wp-44): T2 — TargetManager 抽出共用三角函式 + 新增 stratified 12 格洗牌佇列`
