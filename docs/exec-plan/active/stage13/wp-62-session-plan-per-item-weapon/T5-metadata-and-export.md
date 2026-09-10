# WP-62 T5 — 匯出稽核：計畫武器（意圖）與實際武器（事實）

## Objective

把逐列武器選擇以 additive optional 欄位寫入 `meta.sessionPlanItems[].weaponId`，使每份匯出同時帶有**意圖**（計畫指定了哪把）與**事實**（`meta.weaponId`，該 run 實際生效的那把），兩者可離線對帳（FR-62.4）。frozen 軌匯出維持逐位不變（FR-62.6）。

## Steps

1. `src/data/metadata.ts`：`SessionPlanItemMeta` 加 `readonly weaponId?: string`。
2. `requireSessionPlanItems()` 擴充驗證：`weaponId` 缺席合法；present 時必須通過 `isWeaponId()`（**沿用 T1 匯出的同一個單一來源**，不新增第二份武器清單——比照該函式已對 `FAMILY_BY_DRILL_ID` 驗 `drillId` 的既有作法與 KI-016 註解）。
3. `main.ts` 的 `sessionPlanAuditFields()`：custom 分支的 `sessionPlanItems: activeSessionPlanSelection.items` 已是同一組物件，`weaponId` 隨型別自動帶出——**確認**其確實出現在 payload，並補測試釘死（不是「應該會帶」而是「有斷言」）。
4. frozen 分支零修改：它只寫 `sessionPlanRestSeconds` + `sessionPlanFamilyOrder`，不含 `sessionPlanItems`（FR-58.10 的逐位不變前提）。
5. `src/data/exportPayloadSchema.ts`：同步 additive optional 的 parse 路徑與 `sessionPlanItems[].drillId` 同層。
6. **意圖 vs 事實對帳測試**（`sessionProgramExport.test.ts`）：
   - 指定武器的 item → 該 run 的 `meta.weaponId === sessionPlanItems[itemIndex].weaponId`；
   - 未指定的 item → `sessionPlanItems[itemIndex].weaponId` 缺席，而 `meta.weaponId` 為該 drill 自帶或 `'ak47'`；
   - BR 四格（指定值等於宣告值）→ 兩者相同。
7. **逐位回歸**：既有 golden／canonical fixture 的 parse／serialize 結果逐位不變（比照 WP-58 T5 的 8 個 canonical digest 作法），digest 與比對指令記入 `progress.md`。
8. **C-D1 相容性驗證**：以**真實** `research/` 的 `load_export()` 讀一份含新欄位的 payload，斷言 ticks／events `equals=True`、既有 meta 逐鍵不變 ⇒ Python 側零修改。若需改 Python，**停下並入帳**（屬 C-D1 邊界）。
9. 負向 validation 矩陣：`weaponId` 為空字串／非字串／未知 id 各拋出指名 `sessionPlanItems[i].weaponId` 的錯誤。

## Invariants

- 全部新欄位 optional；缺席對舊 payload 合法。
- 武器 allowlist 只有一份（T1 的 `isWeaponId` / `WEAPONS`）。
- 不新增、不修改任何既有欄位的語意；`meta.weaponId`／`meta.weaponSeed`／`meta.weapon` 三者行為不變。
- frozen 軌匯出逐位不變。
- `CompatibilityKey` 不改版（`weaponId` 已在鍵內）。

## Definition of Done

- [ ] 既有 golden／canonical fixture 的 parse／serialize 逐位不變（digest 清單記入 `progress.md`）
- [ ] 新欄位正負向 validation 矩陣全綠（合法 present／合法缺席／空字串／非字串／未知 id）
- [ ] 意圖 vs 事實對帳三案例全綠（指定／未指定／BR 四格等值）
- [ ] frozen 軌匯出逐位不變有測試，且 frozen 既有測試零修改
- [ ] `research/` 相容性有證據：真實 `load_export()` 讀新 payload，ticks／events `equals=True`、既有 meta 逐鍵不變（輸出記入 `progress.md`）
- [ ] `npm run typecheck` ×2 + 全量 Vitest exit 0

## Commit

```text
feat(data): record the planned weapon in session plan metadata
```
