# WP-47(暫用編號)— Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(覆核 §0 讀碼假設仍成立 + 與使用者確認 override 生命週期預設;無程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | 無 | Low |
| ✅ | **T1** `Controls.ts` 新增 `weaponSelect` + `Weapon` 按鈕(比照 `sceneSelect`)+ `Controls.test.ts` 新測試 | [T1-controls-weapon-select.md](T1-controls-weapon-select.md) | T0 | Low |
| ✅ | **T2** `main.ts`:`activeWeaponOverride` + `loadWeaponById()` + reset-per-drill 接線 + `createControls({...})` 接線 | [T2-main-override-wiring.md](T2-main-override-wiring.md) | T1 | Med |
| ⬜ | **T-exit** 驗收;`npm run test:ci` 全綠 + 瀏覽器手動驗證;文件對帳 | [T-exit-gate.md](T-exit-gate.md) | T1+T2 | — |

## 執行規則(沿用 [exec-plan/README.md §5](../../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §5](../README.md) 的 WP-47 狀態列翻 ✅。
- 單一閘:`npm run test:ci` 全綠。

## 本 WP 特有的紀律

1. **不得修改 `src/weapon/WeaponConfig.ts`/`src/weapon/weapons.ts`**:本 WP 只是「選哪個既有 config」的 UI/接線層,不新增或調整任何武器數值。
2. **`activeWeaponConfig()`(`src/main.ts:218`)只能加一層 override 判斷,不得複製出第二個武器解析路徑**——其餘 8 個呼叫點必須維持透過這個函式讀武器(C-D4)。
3. **`loadWeaponById()`(T2)完成後,先跑一次既有 `Controls.test.ts`/相關 e2e 全綠才能繼續**——確認新增的 override 判斷沒有讓既有 drill/scene 切換流程的武器解析(如 `loadDrillById()` 換 BR drill 後的 ADS FOV)出現回歸。
