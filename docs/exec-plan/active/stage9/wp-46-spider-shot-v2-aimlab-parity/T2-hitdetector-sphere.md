# T2 — `HitDetector.ts` 新增 sphere ray-intersection 分支

> Part of [WP-46](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1 |
| **Risk / Cplx** | Med / Med(新幾何路徑無先例;若算錯不會 crash,只會產生「判定範圍與視覺不符」的靜默 bug,靠正向/負向測試把關) |
| **Touches** | MODIFY `src/sim/HitDetector.ts`、`src/sim/HitDetector.test.ts` |
| **狀態** | ⬜ |

## Objective

`raycastWithRay` 依 `t.hitbox.shape` 分派:`'sphere'` 用 `THREE.Ray.intersectSphere` 取代 `intersectBox`,球心取既有的 `cx/cy/cz`(含 subAlpha 內插邏輯,原樣重用),半徑 = `t.hitbox.width / 2`(T1 已保證 sphere 時三軸相等)。`'box'`/省略路徑逐位不變。

## Steps

- [ ] 模組層級新增重用 `const sphere = new THREE.Sphere();`(比照既有 `box`/`boxMin`/`boxMax` 的 GC 紀律,不在熱路徑 `new`)。
- [ ] 在 `raycastWithRay` 的 per-target 迴圈內,`cx/cy/cz`(含 subAlpha 內插)計算完成後,依 `t.hitbox.shape` 分派:
  - `'sphere'`:`sphere.center.set(cx, cy, cz); sphere.radius = t.hitbox.width / 2; const point = raycaster.ray.intersectSphere(sphere, hitPoint);`
  - 其餘(含省略):既有 `boxMin`/`boxMax`/`box.set`/`intersectBox` 路徑逐位不變。
- [ ] `point === null` 的 continue、`distSq`/`nearestId`/`nearestPart`/`nearestX/Y/Z` 的最近命中比較邏輯兩個分支共用,不重複寫。
- [ ] 新增 `HitDetector.test.ts` 測試案例(用一個 `widthU=heightU=depthU=2` 的球體目標 fixture):
  - ①射線穿過球心 → hit。
  - ②射線落在「外接該球的正方體」四個角附近、但在球體外(距球心 > 半徑) → **miss**(用來證明真的是球體判定,不是 box 近似——若程式碼誤用 box 分支這個案例會變成 hit,測試會抓到)。
  - ③射線落在球體邊緣內側(距球心略小於半徑) → hit。
  - ④同一組座標若 `shape:'box'`(或省略)則②的角落案例應該 hit(對照組,證明兩個分支行為確實不同、且 box 分支未被 sphere 分支污染)。
  - ⑤既有 box 相關測試案例(既有檔案內容)全數保留,零修改全綠。
- [ ] 執行既有 `HitDetector.test.ts` 全部案例 + 新增案例,確認全綠。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | sphere 分支命中球心/邊緣內側 → hit | 新測試 |
| ② | sphere 分支對外接方塊角落 → miss(區分於 box 分支) | 新測試 |
| ③ | box/省略分支既有行為逐位不變 | 既有測試零修改全綠 + 新增對照組測試 |
| ④ | 熱路徑零新配置(`sphere` 為模組層級重用物件) | code review + 既有 GC 紀律模式比對 |
| ⑤ | `npx tsc --noEmit` 全專案綠 | 執行確認 |

## Commit

`feat(wp-46): T2 — HitDetector 新增 sphere ray-intersection 分支`
