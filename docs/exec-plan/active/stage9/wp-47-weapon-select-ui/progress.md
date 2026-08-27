# WP-47(暫用編號)— progress.md

> Running log。Spec:[README.md](README.md) · Checklist:[task-checklist.md](task-checklist.md)

## Progress

- **2026-08-27**:WP-47 提案建立(`/engineering-planning`)。尚未開工,T0 未啟動。
- **2026-08-27**:T0 完成。以 `codegraph_explore` 逐一覆核 README §0 四項讀碼假設(`activeWeaponConfig()` 單點收斂、`loadDrillById()` 重建序列、`sceneSelect`/`loadSceneButton` 按鈕確認語意、`WEAPONS`/`WeaponId`/`getWeapon` 7 武器 export 形狀),全數仍成立,未發現與 README 矛盾的新事實。與使用者確認 OQ-S9-4 → **reset-per-drill**(見下方 Decision Log)。T0 為無程式碼 task,DoD 三項皆達成,無需額外驗證指令。
- **2026-08-27**:T1 完成。`src/ui/Controls.ts` 新增 `WeaponControlOption`/`ControlsOptions.weapons`/`selectedWeaponId`/`onLoadWeapon`/`ControlsHandle.setSelectedWeapon`;`createControls()` 內建 `weaponSelect`(`makeSelect('weapon-select', ...)`)+ `loadWeaponButton`(`makeButton('Weapon', ...)`),排列順序 drill 組→scene 組→weapon 組;`loadWeaponButton` 點擊才呼叫 `onLoadWeapon(weaponSelect.value)`,`weaponSelect` 不監聽 `change`(比照 `sceneSelect`/`loadSceneButton`,§2④ 理由)。`src/ui/Controls.test.ts` 新增案例覆核「change 不觸發、click 才觸發、`setSelectedWeapon` 更新 value」;`FakeDocument` 補 `selects`/`buttons` 追蹤陣列(既有測試風格的最小擴充)。`src/main.ts` 的 `createControls({...})` 呼叫點依 T1 DoD④ 補最小殼(`weapons: []`、`selectedWeaponId: 'ak47'`、`onLoadWeapon: () => {}`),留給 T2 替換成真正邏輯。驗證:`npx tsc --noEmit` 全專案零錯誤、`npx vitest run src/ui/Controls.test.ts` 2/2 綠(含既有 tracer toggle 案例零回歸)。

## Decision Log

- **2026-08-27 / OQ-S9-4**:Override 生命週期採 **reset-per-drill**(換 drill/scene 時清空 `activeWeaponOverride`,下拉選單顯示值同步回該 drill 自帶 `weaponId`)。Alternatives considered:sticky(跨 drill 保留手動選擇)——使用者選擇 reset-per-drill,理由同 README §2③:BR 系列 drill 的 `weaponId` 是研究條件的一部分,sticky 會有靜默用錯武器條件覆蓋 BR 專屬 drill 的研究效度風險。T2 需依此實作 `loadDrillById()`/`loadSceneById()` 開頭清空 override。

## Surprises

- （尚無;讀碼覆核與 README §0 逐位一致,未發現偏差。）

## Open Questions(狀態)

- OQ-S9-4:✅ 已於 T0(2026-08-27)與使用者確認 → reset-per-drill。
- OQ-S9-5(weaponSelect label 顯示原始 id 或友善名稱):傾向先用原始 id,不阻塞交付。
- OQ-S9-6(WP/GD 正式編號指派時機):待使用者於 T-exit 或之後決定,不阻塞本 WP 交付。
