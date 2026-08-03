# T1 — hip muzzle tracer(muzzleOffset 純函式 + BulletArena.m* + SimLoop 四處切口)

> Part of [WP-27 muzzle-tracer](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0 |
| **Risk / Cplx** | **Med** / Low-Med(風險在「誤把 muzzle 套進命中權威」,非演算法) |
| **Touches** | ADD `src/render/muzzleOffset.ts` + `src/render/muzzleOffset.test.ts` + `tests/regression/muzzle-tracer-invariants.test.ts`;MODIFY `src/state/SharedState.ts`(`BulletArena` 三欄)、`src/loop/SimLoop.ts`(四處)、`src/loop/SimLoop.test.ts`(僅 1 案) |
| **狀態** | ⬜ 未開始 |

## Objective

tracer 視覺起點自畫面中心移到**槍口**(hip 右手位),涵蓋 hitscan 與 projectile 兩條路徑;
**命中判定、彈道物理、匯出資料逐位不變**(FR-MT1 / FR-MT2 / FR-MT4)。

## In scope

- **`src/render/muzzleOffset.ts`**(新):`MuzzleOffset` / `MuzzleOffsets` / `DEFAULT_MUZZLE_OFFSETS`
  (GD-18 hip 初值 `{rightU 0.15, upU −0.12, forwardU 0.60}`;ads 佔位值一併定義但 T1 不使用)
  + `computeMuzzleOrigin(origin, quat, ads, offsets, out)` 決定性純函式。
  檔頭註記:**本模組為 render-only 常數,`SimLoop` 的 import 是刻意單向引用,其值永不進入命中/彈道語意**(C-1)。
- **`src/state/SharedState.ts`**:`BulletArena` additive `mx/my/mz: Float64Array(BULLET_CAP)`
  (`createBulletArena` 預配置;`resetBulletArena` 不需清值,比照既有欄位靠 `alive` 判定)。
- **`src/loop/SimLoop.ts` 四處切口**(README §3.3 表):
  1. hitscan 分支 [:429-440](../../../../src/loop/SimLoop.ts#L429-L440):`ballisticRaycast` 後算 `muzzleScratch`,
     `pushShotRay` 的 origin 三引數改用之;**`pushImpact` 不動**。
  2. `spawnProjectile` [:234-236](../../../../src/loop/SimLoop.ts#L234-L236):`arena.o*` **維持** `ballisticOrigin`;
     **新增**寫 `arena.m*`。
  3. `advanceProjectiles` 命中 [:324](../../../../src/loop/SimLoop.ts#L324):`pushShotRay` origin → `arena.m*`。
  4. `advanceProjectiles` 消滅 [:353](../../../../src/loop/SimLoop.ts#L353):同上;
     ⚠️ [:339-343](../../../../src/loop/SimLoop.ts#L339-L343) 的 `d0/d1` **仍用 `arena.o*`**。
  模組層 scratch:`const muzzleScratch = new THREE.Vector3()`(熱路徑零配置,GC 紀律)。
  旋轉來源固定為既有 `ballisticQ`(C-4);T1 的 `ads` 引數恆傳 `false`。
- **測試**:
  - `src/render/muzzleOffset.test.ts`:identity quaternion 下 `out.z === origin.z − forwardU`(C-6 符號);
    yaw 90° / pitch ±45° 旋轉正確;同輸入逐位一致;回傳值 === 傳入的 `out`(零配置)。
  - `tests/regression/muzzle-tracer-invariants.test.ts`(新,封盲區,比照 `br-camera-anchor-invariants.test.ts`):
    ① hitscan raycast 原點逐位 == `camera.getWorldPosition()`;
    ② projectile `arena.ox/oy/oz` 與 `arena.x/y/z` 逐位 == 同上;
    ③ `shotRays.o*` == `camPos + R·hipOffset` 逐位;
    ④ capture-at-fire:開火後改 `state.aim` 再跑數 tick,ring 內已寫入的 origin 不變(C-3);
    ⑤ 跨 FPS(多組 frame sequence)同輸入 → tracer origin 逐位一致(C-4)。
  - `src/loop/SimLoop.test.ts`:**僅** [:432](../../../../src/loop/SimLoop.test.ts#L432) 一案改為顯式期望
    `camPos + R·hipOffset` 逐位值(F-5)。

## Out of scope

- ADS 分支(T2);`TracerView` 任何改動;`Controls` / `src/data/` / `src/metrics/` 任何改動;
  per-weapon 偏移;viewmodel。

## Steps

- [ ] `muzzleOffset.ts` + 單元測試(先鎖純函式,再接線——比照 WP-25 T2 → T3 模式)。
- [ ] `BulletArena.mx/my/mz` + `createBulletArena` 預配置 + `SharedState.test.ts` 既有案全綠。
- [ ] SimLoop 四處切口 + 模組層 `muzzleScratch`。
- [ ] `muzzle-tracer-invariants.test.ts` 五項斷言綠。
- [ ] **零破壞驗證**:`projectile-determinism.test.ts`、`TracerView.test.ts`、命中/彈孔/fire 事件相關既有測試
      **零修改全綠**(與 T0 基線數字對照,記 progress)。
- [ ] `SimLoop.test.ts:432` 單案更新為顯式期望值。
- [ ] export fixture diff 0 驗證(記 progress)。
- [ ] `npx tsc --noEmit` 0 + `npm run test:ci` exit 0。
- [ ] 實機截圖:tracer 自畫面右下起(記 progress)。

## Definition of Done

1. **(首項)** `muzzle-tracer-invariants.test.ts` ①② 綠:raycast 原點與 `arena.ox/oy/oz`、`arena.x/y/z`
   逐位 == `camera.getWorldPosition()`。
2. `tests/regression/projectile-determinism.test.ts` **零修改全綠**;命中/彈孔/fire 事件相關既有測試
   **零修改全綠**(T0 基線 → T1 只增不改,唯一例外為第 3 項)。
3. `SimLoop.test.ts:432` 改為**顯式期望值**(`camPos + R·hipOffset` 逐位);**未**放寬為 `toBeCloseTo`、未刪除。
4. `muzzleOffset.test.ts` 四項全綠(符號慣例 / 旋轉 / 逐位一致 / 回傳 out)。
5. `muzzle-tracer-invariants.test.ts` ③④⑤ 綠(tracer origin 值 / capture-at-fire / 跨 FPS 決定性)。
6. export fixture diff = 0 bytes;`shotRays` 與 `arena.m*` 於 `src/data/` 零引用(grep 證據)。
7. `npx tsc --noEmit` 0;`npm run test:ci` exit 0。
8. 熱路徑零配置:SimLoop 內無 `new THREE.Vector3/Quaternion`(模組層 scratch 複用)。
9. 實機截圖佐證 tracer 起點在畫面右下(記 progress)。

## Commit

`feat(wp-27): T1 hip muzzle tracer(muzzleOffset 純函式 + BulletArena.m*;命中原點逐位不變)`
