# T1 — `Controls.ts` 新增 `weaponSelect` + `Weapon` 按鈕

> Part of [WP-47](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0 |
| **Risk / Cplx** | Low / Low(純 UI 元件擴充,逐行照抄既有 `sceneSelect` pattern) |
| **Touches** | MODIFY `src/ui/Controls.ts`、`src/ui/Controls.test.ts` |
| **狀態** | ⬜ |

## Objective

在 `Controls.ts` 既有的 `drill-select`/`scene-select` 那排控制項旁邊,加一組 `weapon-select` + `Weapon` 按鈕,介面契約與既有 `sceneSelect`/`loadSceneButton` 完全對稱(按鈕確認、不監聽 `change`)。這一步**只動 UI 元件本身**,`onLoadWeapon` 回呼先接一個型別正確的空殼,實際重建邏輯留給 T2。

## Steps

- [ ] `ControlsOptions` 新增:
  ```ts
  export interface WeaponControlOption {
    id: string;
    label: string;
  }
  // ControlsOptions 新增欄位：
  weapons: WeaponControlOption[];
  selectedWeaponId: string;
  onLoadWeapon: (weaponId: string) => void | Promise<void>;
  ```
- [ ] `ControlsHandle` 新增 `setSelectedWeapon(weaponId: string): void`。
- [ ] `createControls()` 內部:
  - `const weaponSelect = makeSelect('weapon-select', 'Select weapon')`,依 `options.weapons` 建 `<option>`,`weaponSelect.value = options.selectedWeaponId`。
  - `const loadWeaponButton = makeButton('Weapon', 'Load selected weapon')`。
  - 加入 `allControls` 陣列(供 `runControl()` 統一 disable/enable)。
  - `root.append(...)` 加入 `weaponSelect, loadWeaponButton`(排列順序:drill 組 → scene 組 → weapon 組,維持既有由左到右的邏輯分組)。
  - `loadWeaponButton.addEventListener('click', () => void runControl(allControls, () => options.onLoadWeapon(weaponSelect.value)))`——**比照 `loadSceneButton`,不監聽 `weaponSelect` 的 `change` 事件**(§2④ 理由:換武器是重量級動作,避免下拉選單意外滾動觸發)。
  - 回傳物件新增 `setSelectedWeapon(weaponId) { weaponSelect.value = weaponId; }`。
- [ ] `Controls.test.ts`:比照既有測試的 `FakeElement`/`FakeDocument` 模式,新增案例:
  - 建 `createControls({ ..., weapons: [{id:'ak47',label:'ak47'}], selectedWeaponId: 'ak47', onLoadWeapon: (id) => values.push(id) })`。
  - 找到 weapon-select 對應的 `FakeElement`(依 `createElement('select')` 呼叫順序,或替 `FakeDocument` 補一個依 `id` 查詢的手段——依既有測試風格挑一個最小改動的方式)與 `Weapon` 按鈕。
  - 觸發按鈕 `dispatch('click')`,斷言 `onLoadWeapon` 收到 `weaponSelect.value`。
  - 呼叫 `controls.setSelectedWeapon('m4a4')`,斷言 select 的 `value` 更新。
- [ ] `npx tsc --noEmit` 全專案型別檢查綠。
- [ ] `npx vitest run src/ui/Controls.test.ts` 全綠(含既有既有 tracer toggle 案例零回歸)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | `ControlsOptions`/`ControlsHandle` 新增欄位型別正確,既有欄位/呼叫點零改動 | `Controls.ts` diff + `npx tsc --noEmit` |
| ② | `weaponSelect` 語意與 `sceneSelect` 對稱(按鈕確認、不監聽 `change`) | `Controls.ts` diff 覆核 |
| ③ | 新增測試案例全綠,既有測試零回歸 | `npx vitest run src/ui/Controls.test.ts` |
| ④ | `main.ts` 尚未接線也不報型別錯(`onLoadWeapon`/`weapons`/`selectedWeaponId` 為必填,T1 階段先留給 T2 補) | `npx tsc --noEmit`(若因 `main.ts` 未接線報錯属预期,留待 T2 一併解決;若 T1 想保持全專案零錯誤,可暫時在 T1 一併於 `main.ts` 傳入最小殼:`weapons:[]、selectedWeaponId:'ak47'、onLoadWeapon:()=>{}`,T2 再替換成真正邏輯) |

## Commit

`feat(wp-47): T0+T1 — Controls.ts 新增 weapon-select 下拉選單(比照 sceneSelect,按鈕確認語意)`
