# T2 — `main.ts`:`activeWeaponOverride` + `loadWeaponById()` + reset-per-drill 接線

> Part of [WP-47](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1 |
| **Risk / Cplx** | Med / Low-Med(邏輯是既有 `loadDrillById()` 的子集重組,風險集中在 override 生命週期是否處處一致) |
| **Touches** | MODIFY `src/main.ts` |
| **狀態** | ✅(程式碼 + 自動化驗證完成;瀏覽器手動驗證併入 T-exit,見下方 Steps 最後一項) |

## Objective

把 T1 完成的 `weaponSelect` UI 接上真正的重建邏輯:新增 `activeWeaponOverride` 狀態、改寫 `activeWeaponConfig()` 讀取優先序、新增 `loadWeaponById()`,並在 `loadDrillById()`/`loadSceneById()` 開頭清空 override(reset-per-drill,§2③)。

## Steps

- [x] 於 `activeDrillConfig` 等既有頂層狀態旁,新增:
  ```ts
  let activeWeaponOverride: WeaponId | undefined;
  ```
  （`WeaponId` 型別從 `src/weapon/weapons.ts` import,若該檔尚未匯入則補上。）
- [x] 改寫 `activeWeaponConfig()`(約 218 行):
  ```ts
  function activeWeaponConfig() {
    return getWeapon(activeWeaponOverride ?? activeDrillConfig.weaponId ?? 'ak47');
  }
  ```
  其餘 8 個既有呼叫點(269/459/481/853/1071/1072/1350,見 README §0-1)**不需要改**——它們都間接受益於這個單點修改。
- [x] 新增 `loadWeaponById()`(建議放在 `restartActiveDrill()`/`loadDrillById()` 附近,約 1015-1077 行區塊):
  ```ts
  function loadWeaponById(weaponId: WeaponId): void {
    activeWeaponOverride = weaponId;
    drillRunner.restart();
    resetRunPresentation();
    simLoop = buildSimLoop();
    cameraController.setAdsConfig(activeWeaponConfig().ads);
    recorder.configureMouseIntegration({ gain: currentMouseGain() });
    drillRunner.start(activeDrillConfig);
    controls?.setSelectedWeapon(weaponId);
    syncControlsVisibility();
  }
  ```
- [x] `loadDrillById()`(約 1050 行)函式體最前面新增 `activeWeaponOverride = undefined;`(reset-per-drill,§2③);函式尾端 `controls?.setSelectedDrill(option.id)` 之後補一行 `controls?.setSelectedWeapon(nextConfig.weaponId ?? 'ak47');`,讓下拉選單顯示值回到該 drill 自帶的武器。
- [x] `loadSceneById()`(約 1079 行)同樣在函式體最前面新增 `activeWeaponOverride = undefined;`,並在 `drillRunner.start(activeDrillConfig)` 前後補上 `controls?.setSelectedWeapon(activeDrillConfig.weaponId ?? 'ak47');`(理由同上——換 scene 也會重建 `activeDrillConfig`,武器 override 語意應與換 drill 一致)。
- [x] `createControls({...})` 呼叫處(約 1135 行)補上真正的接線,取代 T1 暫時留的空殼:
  ```ts
  weapons: Object.keys(WEAPONS).map((id) => ({ id, label: id })),
  selectedWeaponId: activeDrillConfig.weaponId ?? 'ak47',
  onLoadWeapon: (weaponId) => loadWeaponById(weaponId as WeaponId),
  ```
  （`WEAPONS` 從 `src/weapon/weapons.ts` import。`weaponId as WeaponId` 的窄化是因为 `ControlsOptions.onLoadWeapon` 签名是 `(weaponId: string) => ...`——`weaponSelect` 的選項值只可能来自 `Object.keys(WEAPONS)`,窄化在此处是安全的运行时不变式,不需要额外 runtime guard。)
- [x] `npx tsc --noEmit` 全專案型別檢查綠。
- [ ] 手動驗證(dev server)——**延後至 T-exit 統一執行**(README §4/task-checklist.md 定義 T-exit 為 T1+T2 共同的瀏覽器手動驗收關卡,本次 session 僅完成程式碼 + `tsc`/`vitest` 自動化驗證):
  - 開一個 hip 武器 drill(如 `spider-shot-v1`,`weaponId` 省略 → 預設 `ak47`),下拉選 `m4a4` → 按 Weapon → 觀察連發速度變快(0.1s→0.09s cycletime 應可感知)。
  - 選 `ak47_br_ads_hitscan` → 按 Weapon → 開鏡(ADS)應出現(該武器有 `ads` 欄位,先前武器若無 `ads` 則不會有此行為)。
  - 換一個 drill(按既有 drill-select)→ 確認 weapon-select 下拉值回到該 drill 自帶的 `weaponId`,不沿用剛才手動選的武器。
  - `forceExportJSON`(若有 dev-only 匯出入口)或匯出流程確認 `meta.weapon.id` 對應手動選擇的武器。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | `activeWeaponConfig()` 讀取優先序為 override > drill 預設 > `'ak47'` | 程式碼 diff + 手動驗證(選武器後立即生效) |
| ② | `loadWeaponById()` 每次呼叫都重建 `simLoop`(不熱插拔) | 程式碼 diff 覆核與 T2 手動驗證(fire rate/ADS 隨切換改變) |
| ③ | 換 drill/scene 後 `activeWeaponOverride` 被清空,`weaponSelect` 顯示值回到該 drill 自帶武器 | 手動驗證(換 drill 後觀察下拉選單值) |
| ④ | 匯出 `meta.weapon.id` 對應目前生效武器(override 或 drill 預設) | 手動匯出 JSON 檢查(`weapon` 區塊由既有 `collectMeta` 邏輯自動反映,無需額外改動) |
| ⑤ | 全專案型別檢查綠,`Controls.test.ts` 與既有相關測試零回歸 | `npx tsc --noEmit` + `npx vitest run` |

## Commit

`feat(wp-47): T2 — main.ts activeWeaponOverride + loadWeaponById() + reset-per-drill 接線`
