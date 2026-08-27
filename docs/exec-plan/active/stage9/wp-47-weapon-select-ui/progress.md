# WP-47(暫用編號)— progress.md

> Running log。Spec:[README.md](README.md) · Checklist:[task-checklist.md](task-checklist.md)

## Progress

- **2026-08-27**:WP-47 提案建立(`/engineering-planning`)。尚未開工,T0 未啟動。
- **2026-08-27**:T0 完成。以 `codegraph_explore` 逐一覆核 README §0 四項讀碼假設(`activeWeaponConfig()` 單點收斂、`loadDrillById()` 重建序列、`sceneSelect`/`loadSceneButton` 按鈕確認語意、`WEAPONS`/`WeaponId`/`getWeapon` 7 武器 export 形狀),全數仍成立,未發現與 README 矛盾的新事實。與使用者確認 OQ-S9-4 → **reset-per-drill**(見下方 Decision Log)。T0 為無程式碼 task,DoD 三項皆達成,無需額外驗證指令。
- **2026-08-27**:T1 完成。`src/ui/Controls.ts` 新增 `WeaponControlOption`/`ControlsOptions.weapons`/`selectedWeaponId`/`onLoadWeapon`/`ControlsHandle.setSelectedWeapon`;`createControls()` 內建 `weaponSelect`(`makeSelect('weapon-select', ...)`)+ `loadWeaponButton`(`makeButton('Weapon', ...)`),排列順序 drill 組→scene 組→weapon 組;`loadWeaponButton` 點擊才呼叫 `onLoadWeapon(weaponSelect.value)`,`weaponSelect` 不監聽 `change`(比照 `sceneSelect`/`loadSceneButton`,§2④ 理由)。`src/ui/Controls.test.ts` 新增案例覆核「change 不觸發、click 才觸發、`setSelectedWeapon` 更新 value」;`FakeDocument` 補 `selects`/`buttons` 追蹤陣列(既有測試風格的最小擴充)。`src/main.ts` 的 `createControls({...})` 呼叫點依 T1 DoD④ 補最小殼(`weapons: []`、`selectedWeaponId: 'ak47'`、`onLoadWeapon: () => {}`),留給 T2 替換成真正邏輯。驗證:`npx tsc --noEmit` 全專案零錯誤、`npx vitest run src/ui/Controls.test.ts` 2/2 綠(含既有 tracer toggle 案例零回歸)。
- **2026-08-27**:T2 完成。`src/main.ts` 新增頂層狀態 `activeWeaponOverride: WeaponId | undefined`;`activeWeaponConfig()` 改為 `getWeapon(activeWeaponOverride ?? activeDrillConfig.weaponId ?? 'ak47')`(其餘 8 個既有呼叫點不改,依 README §0-1 全數間接受益);新增 `loadWeaponById()`(放在 `restartActiveDrill()` 之後),邏輯逐位比照 README §2②:設 override → `drillRunner.restart()` → `resetRunPresentation()` → `simLoop = buildSimLoop()`(重建,不熱插拔)→ `cameraController.setAdsConfig(activeWeaponConfig().ads)` → `recorder.configureMouseIntegration({ gain: currentMouseGain() })` → `drillRunner.start(activeDrillConfig)` → `controls?.setSelectedWeapon(weaponId)` → `syncControlsVisibility()`。`loadDrillById()`/`loadSceneById()` 函式體最前面各加 `activeWeaponOverride = undefined;`(reset-per-drill,§2③),並在重建完成後補 `controls?.setSelectedWeapon(...)` 讓下拉選單顯示值回到該 drill/scene 自帶的 `weaponId`(`loadDrillById` 用 `nextConfig.weaponId ?? 'ak47'`;`loadSceneById` 用 `activeDrillConfig.weaponId ?? 'ak47'`,因為 scene 切換後 `activeDrillConfig` 已被 `loadDrill()` 重新賦值為同一 drill 在新 scene 下的設定)。`createControls({...})` 呼叫點以 `Object.keys(WEAPONS).map((id) => ({ id, label: id }))` 取代 T1 佔位的 `weapons: []`,`selectedWeaponId: activeDrillConfig.weaponId ?? 'ak47'`,`onLoadWeapon: (weaponId) => loadWeaponById(weaponId as WeaponId)`(窄化為 README §2 註明的安全 runtime 不變式,選項值只可能來自 `Object.keys(WEAPONS)`)。`getWeapon` import 行補上 `WEAPONS`/`type WeaponId`。驗證:`npx tsc --noEmit` 全專案零錯誤;`npx vitest run` 137 test files / 1081 tests 全綠(含 `Controls.test.ts` 零回歸)。手動瀏覽器驗證(fire rate/ADS/換 drill 後下拉值重置/匯出 `meta.weapon.id`)留待 T-exit 執行(T2 DoD 手動驗證項目未在本次 session 內以瀏覽器操作覆核,由 T-exit 統一收斂)。

## Decision Log

- **2026-08-27 / OQ-S9-4**:Override 生命週期採 **reset-per-drill**(換 drill/scene 時清空 `activeWeaponOverride`,下拉選單顯示值同步回該 drill 自帶 `weaponId`)。Alternatives considered:sticky(跨 drill 保留手動選擇)——使用者選擇 reset-per-drill,理由同 README §2③:BR 系列 drill 的 `weaponId` 是研究條件的一部分,sticky 會有靜默用錯武器條件覆蓋 BR 專屬 drill 的研究效度風險。T2 需依此實作 `loadDrillById()`/`loadSceneById()` 開頭清空 override。

## Surprises

- （尚無;讀碼覆核與 README §0 逐位一致,未發現偏差。）

## Open Questions(狀態)

- OQ-S9-4:✅ 已於 T0(2026-08-27)與使用者確認 → reset-per-drill。
- OQ-S9-5(weaponSelect label 顯示原始 id 或友善名稱):傾向先用原始 id,不阻塞交付。
- OQ-S9-6(WP/GD 正式編號指派時機):待使用者於 T-exit 或之後決定,不阻塞本 WP 交付。
