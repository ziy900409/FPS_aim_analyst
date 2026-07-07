# T2 — raycastWithRay:命中射線方向注入式

> Part of [WP-12 input-seams](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | 無(可與 T0/T1 並行) |
| **Risk / Cplx** | Low / Low |
| **Touches** | MODIFY `src/sim/HitDetector.ts` + `src/sim/HitDetector.test.ts` |
| **狀態** | ✅ 2026-07-06 |

## Objective

把命中判定的射線來源從「寫死 camera 正前方」(稽核 A3:
[HitDetector.ts:49](../../../../../src/sim/HitDetector.ts) `raycaster.setFromCamera(NDC_CENTER, camera)`)
改為呼叫端注入 origin/direction——WP-13 彈道合成(viewAngles + rawPunch×2 + spread)的開口。

## In scope
- 新公開函式(模組層級重用物件維持,GC 紀律):

```ts
export function raycastWithRay(
  origin: THREE.Vector3,
  dirNormalized: THREE.Vector3,
  targets: readonly TargetState[],
): RaycastResult;   // 既有 Box3 求交迴圈原樣搬入(最近命中、visible && alive)
```

- `raycastFromCenter(camera, targets)` 改薄包裝:`setFromCamera` 只用來取
  `raycaster.ray.origin/direction`,再轉呼叫 `raycastWithRay`——簽名、行為、呼叫端
  ([SimLoop.ts:76](../../../../../src/loop/SimLoop.ts))零改動。

## Out of scope
- SimLoop 改用注入方向(WP-13 T2);`targetCenterOffsetDeg` 語意(WP-16 對帳,
  稽核不確定清單 #4);Raycaster→自寫 ray-box 的去 three 化(不必要)。

## Steps

- [x] 抽出 `raycastWithRay`;`raycastFromCenter` 轉包裝。
- [x] 等價測試:同 camera 場景下,`raycastFromCenter(camera, targets)` ===
      `raycastWithRay(camOrigin, camDir, targets)`(命中/targetId/part 逐欄)。
- [x] 注入測試:偏移方向命中側目標、反向不命中、多目標取最近(移植既有 cases 到注入介面)。
- [x] 既有 `HitDetector.test.ts` / `firstShot.test.ts` / `SimLoop.test.ts` 全綠不改斷言。
- [x] `npx vitest run` 全綠。

## Definition of Done

- `raycastWithRay` 公開且有 ≥ 4 cases;等價測試綠;既有測試零斷言變更全綠;
  熱路徑無新配置(重用模組級 raycaster/Box3/Vector)。

## Commit

`feat(wp-12): T2 HitDetector 射線方向注入(raycastWithRay)+ FromCenter 薄包裝`
