# T2 — adapter 單點轉換 + 彈道合成 + 視覺 punch compose

> Part of [WP-13 sim-camera-integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1 |
| **Risk / Cplx** | **High** / High |
| **Touches** | NEW `src/recoil/adapter.ts`;MODIFY `src/loop/SimLoop.ts`(fireOneShot 方向)、`src/view/CameraController.ts`、`src/main.ts`(render loop)+ 測試 |
| **狀態** | ⬜ |

## Objective

實現「視覺 ≠ 實際」分離(研究計畫 Phase 2 核心):渲染 = viewAngles + aimPunch,
彈道 = viewAngles + rawPunch×2 + spread。deg/rad 與 pitch 符號翻轉收斂在 adapter 單點。

## In scope
- `adapter.ts`(**唯一**允許轉換之處,稽核 A6):
  `punchToThreeRad(pitchDeg, yawDeg): { pitchRad, yawRad }`——pitch 翻轉(Source 下正 →
  three 上正:`pitchRad = -degToRad(pitchDeg)`)、yaw 同向(兩者左正);檔頭文件化慣例對照表。
- `CameraController.setViewPunch(yawRad, pitchRad)`:存 punch,`#applyToCamera` 改組
  `q(yaw + punchYaw) · q(pitch + punchPitch)`(clamp 只夾使用者 pitch,不夾 punch)。
- `main.ts` render loop:`lerp(recoil.prev, recoil.curr, alpha)` → adapter → `setViewPunch`
  →(既有)每幀 camera 更新——滑鼠靜止時 punch 衰減可見。
- `fireOneShot` 彈道:`viewAngles(sharedState.aim) + rawPunch(=aimPunch×2, adapter 轉換後)`
  → 方向向量;spread `(x,y)` 以 `forward + x·right + y·up` 疊加正規化 →
  `raycastWithRay(cameraWorldPos, dir, targets)` 取代 `raycastFromCenter`。
- `view_recoil_tracking` 開關(OQ-S2-4):視覺 punch 乘可調常數(預設 1.0)+ 常數註記。

## Out of scope
- 彈孔渲染(T3);`targetCenterOffsetDeg` 語意調整(WP-16 對帳);準星跟隨模式(cl_crosshair_recoil,列 stretch,不入 DoD)。

## Steps

- [ ] `adapter.ts` + 純函式測試(±向量對照表:pitch −10° Source → +0.1745 rad three)。
- [ ] `setViewPunch` + compose;單元測試:punch 疊加後 quaternion = 手組期望;clamp 不夾 punch。
- [ ] render loop 內插佈線(main.ts;比照 position lerp 三行)。
- [ ] `fireOneShot` 方向替換;命中測試:punch 已知時,原準心對準目標 → miss、
      補償 `−rawPunch` 對準 → hit(合成場景,決定性)。
- [ ] E2E(`__fpsTest` 擴充):fire(10) → 彈著點序列漂移方向 = 上(pitch)+ 右偏(yaw 負)
      鏡頭上跳方向斷言;10 發後 punch readout = M5 向量。
- [ ] `npx vitest run` + `npm run test:e2e` 全綠。

## Definition of Done

- 分離生效(miss/hit 補償測試綠);E2E 方向 + 向量斷言綠;
  `git grep -l degToRad src/loop src/view src/sim` 僅 `adapter.ts`(單點轉換守住)。

## Commit

`feat(wp-13): T2 視覺/彈道分離 — adapter 單點轉換 + rawPunch×2+spread 彈道合成`