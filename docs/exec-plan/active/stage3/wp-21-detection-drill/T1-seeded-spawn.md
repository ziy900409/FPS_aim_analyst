# T1 — seeded spawn(schema 擴欄 + TargetManager 注入;零破壞)

> Part of [WP-21 detection-drill](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(spawnArea/取樣次序決議) |
| **Risk / Cplx** | **High** / Med(動 sim 目標機制——零破壞不變式是全部風險所在) |
| **Touches** | MODIFY `src/drill/schema.ts`(spawnArea?/spawnDelayMsRange?/seed 語意)、`src/sim/TargetManager.ts`(seeded spawn 分支);REUSE `src/recoil/rng.ts`(不改)+ 測試 |
| **狀態** | ⬜ |

## Objective

`sequence.seed` 從「保留未讀」變成活的(FR-C10):seeded spawn 位置(yaw/distance
polar 取樣)與延遲——**同 seed 同序列**;無 seed 的既有 drill **逐位不變**。

## In scope
- `schema.ts` 擴欄(additive 選填):`targets.spawnArea?: { yawDegRange, distanceURange }`、
  `sequence.spawnDelayMsRange?: [min, max]`;驗證(range 順序、正有限、與 seed 併用
  規則——spawnArea 需 seed,缺 seed 報 field-path 錯誤)。
- `TargetManager` seeded 分支:config 帶 seed → `createRan1(seed)` 建 stream;
  spawn 時依 T0 定稿次序取樣(delay → yaw → distance);位置 = 固定世界座標 polar
  (camera 無關);`reset()` 重建 stream(同 seed 重跑 = 同序列)。
- **零破壞閘(DoD 首項)**:無 seed 路徑程式碼路徑不變(交替/計數邏輯原樣);
  **先跑既有決定性回歸全綠**再進新功能測試。
- 新決定性測試:同 seed 兩次 reset+run → spawn 序列(位置/延遲)逐位一致;
  不同 seed → 序列不同(sanity)。
- `Math.random` 禁令 grep 閘擴充:涵蓋 `TargetManager` 路徑(既有 lint 閘已含 src/sim,
  確認即可)。

## Out of scope
- 偵測 drill config(T2)、spawn 事件記錄欄(T2)、meta.spawn(WP-16 縫 + T2 填值)。

## Steps

- [ ] schema 擴欄 + 驗證測試(合法/非法/缺 seed 併用)。
- [ ] **既有決定性回歸全綠**(改動前基準 → 改動後重跑,證據記 progress)。
- [ ] TargetManager seeded 分支 + 同 seed 重現測試 + reset 重建 stream 測試。
- [ ] 取樣次序鎖定測試(golden:seed X → 前 5 個 spawn 的 (delay,yaw,dist) 逐位)。
- [ ] `npx vitest run` 全綠。

## Definition of Done

- 無 seed:既有測試**零修改**全綠(逐位不變證據);有 seed:同 seed 同序列 golden 鎖定;
  schema 驗證涵蓋併用規則;`Math.random` 閘涵蓋確認。

## Commit

`feat(wp-21): T1 seeded spawn(spawnArea/延遲 seeded 取樣;無 seed 路徑零破壞)`
