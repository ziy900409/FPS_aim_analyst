# T2 — WeaponConfig.ads + CameraController zoom/gain

> Part of [WP-24 ads-optics](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1(heldAds 可用)+ T0(GD-16 公式) |
| **Risk / Cplx** | Med / Med(gain 作用點錯 = 構念/決定性風險) |
| **Touches** | MODIFY `src/weapon/WeaponConfig.ts` + `weapons.ts`(`ads?` 欄 + validateWeapon)、`src/view/CameraController.ts`(`setAds` + gain)、`src/main.ts`/render 佈線(heldAds → camera 每幀同步)+ 測試 |
| **狀態** | ⬜ |

## Objective

ADS 的視角與感度語意落地(FR-E5):`WeaponConfig.ads?: { fovDeg, sensitivityRatio }`;
`CameraController` 依 `heldAds` 切換 FOV(render 幀內插)並以 GD-16 公式縮放
`applyDelta` gain;punch 路徑與 sim **零改動**。

## In scope

- `WeaponConfig.ts`:`ads?: { fovDeg: number; sensitivityRatio: number }`;
  `validateWeapon` field-path 驗證(fovDeg ∈ (0, hipFov]、ratio 正有限);
  `weapons.ts` 增一把帶 `ads` 的示範武器檔(或 AK 加欄,依 T0 決議)。
- `CameraController`:
  - `setAds(active: boolean)`:切換 FOV 目標值(hip = 既有設定值,ads = `ads.fovDeg`),
    實際 FOV 以 render 幀內插趨近(時長 OQ-24.1,render-only);
  - `applyDelta` gain:ads 態乘 GD-16 因子(`sensitivityRatio × adsFov/hipFov`,
    以**當前目標態**而非內插中值計算——感度切換為階躍,語意可分析);
  - **punch/`aimSink` 路徑零改動**(既有「aim 不含 punch」分離註解為準)。
- render 佈線:每幀讀 `heldAds` → `setAds`(比照 `setViewPunch` 模式)。
- 測試:gain 公式 golden(hip/ads 兩態 delta → yaw/pitch 增量)、FOV 切換、
  validateWeapon 合法/非法、`aimSink` 不含 punch 回歸。

## Out of scope

- overlay(T3)、記錄(T3)、多段倍率、scoped inaccuracy。

## Steps

- [ ] WeaponConfig 擴欄 + 驗證測試。
- [ ] CameraController `setAds` + gain(GD-16 公式)+ golden 測試。
- [ ] render 佈線 + 手動 smoke(開鏡 FOV 變化、感度變化體感)記 progress。
- [ ] 既有 CameraController/決定性測試零修改全綠。
- [ ] `npx vitest run` 全綠。

## Definition of Done

- gain golden 與 GD-16 公式逐位一致;FOV 切換/內插 render-only 證據
  (sim 測試零觸動);validateWeapon 覆蓋;既有測試零修改全綠;手動 smoke 記 progress。

## Commit

`feat(wp-24): T2 WeaponConfig.ads + CameraController zoom/gain(GD-16 感度模型)`
