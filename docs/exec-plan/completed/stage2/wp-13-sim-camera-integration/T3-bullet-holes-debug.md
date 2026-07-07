# T3 — 彈孔 InstancedMesh + dev-only debug overlay

> Part of [WP-13 sim-camera-integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T2 |
| **Risk / Cplx** | Low / Med |
| **Touches** | NEW `src/render/ImpactView.ts`(+test);MODIFY `src/state/SharedState.ts`(impacts 固定格)、`src/sim/HitDetector.ts`(命中點回填)、`src/main.ts`(掛載 + overlay) |
| **狀態** | ✅ 2026-07-06 |

## Objective

彈著視覺回饋:彈孔以單一 `InstancedMesh` 渲染(單 draw call,稽核加分項建議);
dev-only overlay 顯示 punch/spread 數值,消解「視覺≠彈道」的 QA 誤判。

## In scope
- `RaycastResult` 增命中點:`raycastWithRay` 寫入呼叫端重用欄位(plain number x/y/z,
  不配置 Vector;未命中時無效旗標)——牆面彈孔階段 A 場景僅目標命中,未命中不留孔
  (牆面求交列 stretch,不入 DoD)。
- `SharedState.impacts`:preallocated 環形格(容量常數 `IMPACT_CAP = 64`:
  `x,y,z,seq` 並行陣列 + 寫入游標);sim 命中時寫入,render 唯讀(雙迴圈邊界)。
- `ImpactView`:一份小面片 geometry + `InstancedMesh(cap)`;每幀依 `seq` 增量同步
  instanceMatrix(環狀覆寫最舊);比照 [TargetView](../../../../../src/render/TargetView.ts) 唯讀紀律。
- dev-only overlay(比照急停 readout,[main.ts:243](../../../../../src/main.ts) 模式):
  `punch p/y`、`inaccuracy 半徑`、`ammo`,production 剝除。

## Out of scope
- 牆面/地板彈孔、貼花淡出動畫、命中特效;準星跟隨(cl_crosshair_recoil)。

## Steps

- [x] `raycastWithRay` 命中點回填 + 測試(命中點在 hitbox 面上)。→ `HitPointOut` 呼叫端重用欄位(不改 `RaycastResult` 形狀,既有等值測試零回歸);HitDetector.test 4 tests。
- [x] `SharedState.impacts` 固定格 + reset 原地清空 + 溢位環狀覆寫測試。→ `IMPACT_CAP=64`、`ImpactRing`(x/y/z/seq 並行陣列 + cursor)、`pushImpact`/`resetImpactRing`;SharedState.test ImpactRing 4 tests + reset 擴充。
- [x] `ImpactView` + 測試(合成 impacts → instanceMatrix 數量/位置;cap 溢位覆寫最舊)。→ 單 `InstancedMesh(64)`、seq 增量同步、`frustumCulled=false`;ImpactView.test 6 tests。
- [x] main.ts 掛載;dev overlay 三值 readout(punch p/y、inaccuracy、ammo)。
- [ ] 手動:壓 30 發 → 彈孔沿 pattern 分布可見;`renderer.info` 顯示彈孔為 1 draw call
      (dev console 證據記 progress);production build 無 overlay。→ **交 T-exit(M6)真瀏覽器驗**;`npm run build` 已綠(overlay 由 `import.meta.env.DEV` 剝除)。
- [x] `npx vitest run` 全綠。→ 38 files / 288 tests。

## Definition of Done

- 彈孔單 instancedMesh(1 draw call 證據);impacts 熱路徑零配置(並行陣列);
  overlay 僅 dev;全 suite 綠。

## Commit

`feat(wp-13): T3 彈孔 InstancedMesh(環狀覆寫)+ dev-only punch/spread overlay`