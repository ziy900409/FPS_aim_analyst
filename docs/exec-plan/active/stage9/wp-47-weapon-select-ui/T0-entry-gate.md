# T0 — entry gate:覆核讀碼假設 + 確認 override 生命週期預設,無程式碼

> Part of [WP-47](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | 無 |
| **Risk / Cplx** | Low / Low |
| **Touches** | 無程式碼;僅覆核 [README.md §0](README.md#0-讀碼對帳對話中已完成的稽核結論) |
| **狀態** | ✅ |

## Objective

在動 T1 之前,把規劃階段做過的讀碼結論(§0 五項)實際對照一次現行程式碼,確認假設仍成立;並就 §2③ 的 override 生命週期預設(reset-per-drill)與使用者確認一次,避免 T2 做完才發現方向錯了要重做。

## Steps

- [x] 確認 `src/main.ts:218-220` 的 `activeWeaponConfig()` 仍是 `getWeapon(activeDrillConfig.weaponId ?? 'ak47')` 這個單一收斂點,呼叫點數量/位置未被其他並行工作改動(用 `codegraph_explore` 或 grep 覆核)。→ 確認成立,見 `codegraph_explore` 結果:`src/main.ts:218-220` 逐位相同。
- [x] 確認 `src/main.ts` 的 `loadDrillById()`(約 1050-1077 行)重建序列仍是:`drillRunner.restart()` → `activeDrillConfig=...` → `resetRunPresentation()` → `simLoop = buildSimLoop()` → `cameraController.setAdsConfig(...)` → `recorder.configureMouseIntegration(...)` → `targetView.setShape(...)` → `drillRunner.start(...)` → `controls?.setSelectedDrill(...)` → `syncControlsVisibility()`。→ 確認成立,`src/main.ts:1050-1077` 序列逐位相同。
- [x] 確認 `src/ui/Controls.ts` 的 `sceneSelect`/`loadSceneButton` pattern(約 71-79、111-113 行)仍是「按鈕確認、不監聽 `change`」,未被改成 auto-apply。→ 確認成立:`sceneSelect` 無 `change` listener,僅 `loadSceneButton.addEventListener('click', ...)`(`Controls.ts:111-113`);對照 drill `select` 確實有 `change` listener(`Controls.ts:108-110`,選了就套用),兩者語意差異屬實。
- [x] 確認 `src/weapon/weapons.ts` 的 `WEAPONS`/`WeaponId`/`getWeapon` export 形狀未變(7 個武器 id)。→ 確認成立,`WeaponId`(`weapons.ts:3-10`)與 `WEAPONS`(`weapons.ts:125-133`)仍是原先 7 個 id。
- [x] 與使用者確認 §2③ Override 生命週期預設:**reset-per-drill**(換 drill/scene 時清空手動選擇的武器)是否為期望行為;若使用者傾向 sticky,回頭修改 README §2③ 與 T2 Steps 再繼續。→ 使用者確認採 **reset-per-drill**(2026-08-27,見 `progress.md` Decision Log)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 四項讀碼假設逐一覆核仍成立 | ✅ 本檔 Steps 勾選 + 對照現行檔案內容 |
| ② | Override 生命週期預設已與使用者確認(reset-per-drill 或改為 sticky) | ✅ reset-per-drill,記錄於 `progress.md` |
| ③ | 未發現與 [README.md §0](README.md) 矛盾的新事實 | ✅ 無矛盾 |

## Commit

無程式碼變更;本 task 可與 T1 合併 commit 訊息(entry gate 純讀碼確認,比照 wp-44/wp-40 T0 慣例),若需要獨立記錄則不強制單獨 commit。
