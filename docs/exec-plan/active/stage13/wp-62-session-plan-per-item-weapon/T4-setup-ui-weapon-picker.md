# WP-62 T4 — Session Plan 表單：每列武器選單與預覽

## Objective

在自訂 program 軌的每一列加一個武器 `<select>`（含彈匣容量標示），讓預覽表顯示每個 run 步驟實際會用的武器，並把編譯錯誤定位到該列（FR-62.1／62.5／62.7、D-62-3／D-62-4）。

## Steps

1. `src/ui/SessionPlanSetup.ts`：`SessionPlanSelection` 的 **custom 分支**的 `items` 沿用 `SessionProgramItem`，因此型別自動帶到 `weaponId?`——**frozen 分支零修改**（D-62-2）。
2. 內部 `items` 狀態由 `{ drillId, reps }` 擴為 `{ drillId, reps, weaponId?: WeaponId }`；`addButton` 新增的列預設 `weaponId: undefined`。
3. `renderItems()` 每列插入一個 `<select>`：
   - 第一個 `<option>` 為 `—（drill 預設）`，`value = ''`；
   - 其餘由 `Object.entries(WEAPONS)` 產生，標籤格式 `` `${id}（${magSize} 發）` ``（彈匣數直接讀 `WEAPONS[id].magSize`，不另存常數）；
   - `aria-label` = `` `${drillId} 武器` ``（比照既有 reps 欄位的 a11y 作法）；
   - `change` handler **只更新 `item.weaponId` 並 `refreshPreview()`，不重繪該列**——重繪會在真實瀏覽器裡讓 `<select>` 失焦／關閉展開清單（同 `reps` 於 [SessionPlanSetup.ts:348-353](../../../../../src/ui/SessionPlanSetup.ts) 的既有理由）。
4. `describeStep()` 的 run 分支加上武器：指定時顯示該武器 id；未指定時依 OQ-62.1 的決議顯示（**預設假設**：顯示「預設」；BR 四格因 T1 的 `DECLARED_WEAPON_BY_DRILL_ID` 可顯示實名）。預覽 `<li>` 加 `data-step-weapon-id` 屬性供 E2E 定位。
5. `refreshPreview()` 傳給 `compileSessionProgram()` 的 items 帶上 `weaponId`；編譯失敗時既有 `setCompileFailure(error.message, error.itemIndex)` 已能標紅該列（`markInvalidItem`），**無需新機制**——只需確認 `field === 'weaponId'` 的錯誤走同一條路。
6. `submit` handler 的 custom 分支把 `weaponId` 一併送出（沿用「送出前重新編譯、編譯不過就不送出」的既有紀律）。
7. 清單下方新增固定說明文字（兩行，`descriptionCss`）：
   > 無 reload：彈匣打完該輪即停火，且受測者的「按住」意圖會被記成放開。
   > 不同武器的 run 不會併入同一條趨勢線（相容鍵含 weaponId）——逐列換武器會讓 history 趨勢分群。
   第二行對應 FM-5：行為正確但外觀像 bug，必須事前講明。
8. 測試（`SessionPlanSetup.test.ts`）：
   - 每列有一個 `<select>`，選項數 = `WEAPONS` 數量 + 1（預設項）；
   - 選項標籤含彈匣數（至少驗 `usp_s_laser（12 發）` 與 `ak47（30 發）`）；
   - 選武器 → 預覽該步的 `data-step-weapon-id` 更新；
   - 對 BR 四格選錯武器 → submit 被禁用、該列 `data-invalid="true"`、status 顯示編譯錯誤訊息；
   - 送出的 selection 含正確的逐列 `weaponId`；
   - 兩行說明文字存在（FM-5 提示的斷言）；
   - frozen 軌 DOM **零變更**（既有 frozen 案例不得修改）。

## Invariants

- UI = 純 TS + DOM overlay（D1），不引入框架。
- frozen 區塊的 DOM、行為與既有測試零修改。
- 不新增第二份武器清單或第二套錯誤分類；錯誤一律走 `SessionProgramCompileError` 的 `field` + `itemIndex`。
- 鍵盤可操作性不退化（NFR-58.7）：`<select>` 為原生元素，reorder/remove 仍為真 button。
- `change` 不重繪該列。

## Definition of Done

- [ ] 每列 `<select>` 存在，選項數 = `WEAPONS` 數 + 1，且標籤含彈匣容量（兩例具名斷言）
- [ ] 選武器 → 預覽 `data-step-weapon-id` 更新有測試
- [ ] BR 四格選錯武器 → submit 禁用 + 該列 `data-invalid` + status 訊息，三項皆有斷言
- [ ] 送出的 `SessionPlanSelection.items[].weaponId` 逐列正確有測試
- [ ] 兩行說明文字（無 reload、趨勢分群）存在有斷言
- [ ] frozen 軌既有測試**零修改**全綠
- [ ] `change` 不觸發該列重繪有測試（例如：change 後同一個 `<select>` DOM 節點仍是 `itemList` 內的同一個 reference）
- [ ] OQ-62.1／62.2 的決議（或採用預設假設）記入 `progress.md`
- [ ] `npm run typecheck` ×2 + 全量 Vitest exit 0

## Commit

```text
feat(ui): choose a weapon per session plan item
```
