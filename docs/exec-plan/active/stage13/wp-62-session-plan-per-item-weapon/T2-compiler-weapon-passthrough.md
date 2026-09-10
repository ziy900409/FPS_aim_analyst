# WP-62 T2 — 編譯器：`weaponId` 穿透與驗證

## Objective

讓 `SessionProgramItem` 帶得動 `weaponId`，由 `compileSessionProgram()` 原樣穿透進每一個 `RunStep`（同 `warmup?` 前例），並在**編譯期**擋掉兩種非法輸入：未知武器 id、覆蓋已宣告武器的 drill（FR-62.1／62.2／62.3、D-62-1）。

## Steps

1. `src/session/sessionProgram.ts`：`SessionProgramItem` 與 `RunStep` 各加 `readonly weaponId?: WeaponId`。型別自 `../weapon/weapons.ts` 匯入。
2. `SessionProgramErrorField` union 加 `'weaponId'`。
3. 新增 `requireWeapon(drillId, weaponId, itemIndex)`，與既有 `requireFamily()` / `requireReps()` 同層、同錯誤形狀：
   - `weaponId === undefined` → 回 `undefined`（合法，代表沿用 drill 自帶／app 預設）；
   - `!isWeaponId(weaponId)` → `throw new SessionProgramCompileError('weaponId', `${weaponId} 不是已知武器`, itemIndex)`；
   - `DECLARED_WEAPON_BY_DRILL_ID.has(drillId)` 且宣告值 `!== weaponId` → `throw ... ('weaponId', `${drillId} 由實驗格固定為 ${declared}，不可指定其他武器`, itemIndex)`。
   > 指定值**等於**宣告值時放行（非錯誤）：操作員明確選了那把，意圖與協定一致，沒有理由拒絕。
4. 驗證仍全部發生在建構任何 step **之前**（沿用既有 `validated = plan.items.map(...)` 前置驗證區塊），確保 throw 不會留下半編譯的 program。
5. 穿透時**維持鍵集合最小化**（NFR-62.4）：比照 `warmup` 的寫法，`weaponId === undefined` 時**不放這個鍵**，而不是放 `weaponId: undefined`。既有測試以逐元素比對 step 物件，多一個鍵會紅——這正是要保護的行為。
6. `deriveProgramFamilyOrder()` / `summarizeProgram()` / `resolveBoundary()` **零修改**：武器不影響邊界或休息時長。
7. 測試矩陣（`sessionProgram.test.ts`）：
   - 合法：指定武器 → 該 item 的每一個 rep 的 `RunStep.weaponId` 皆為該值（`reps: 3` 驗三筆）；
   - 合法：省略 → 每個 `RunStep` **沒有** `weaponId` 鍵；
   - 合法：BR 八格指定的武器等於其宣告值 → 放行；
   - 非法：未知 id（含空字串、非字串）→ throw，`field === 'weaponId'`、`itemIndex` 正確；
   - 非法：BR 八格指定不同武器 → throw，`field`／`itemIndex` 正確；
   - 混合：多列中僅第 2 列非法 → `itemIndex === 1`，且無任何 step 產出。
8. **NFR-62.4 逐位回歸**：對一組不含 `weaponId` 的既有 plan，比對 `JSON.stringify(compileSessionProgram(plan))` 與本 task 前 HEAD 的輸出**逐字元相同**。
9. **NFR-62.1 純度不退化**：既有 source-scan 測試不得放寬任何一條。新 import 為 `weapons.ts`／`drillFamily.ts`（皆純資料 + 驗證，無 DOM／Three／`node:*`／時鐘／亂數）；若 scan 規則按模組名白名單運作，須確認新 import 合規，**不得為了讓 scan 過而放寬規則**。

## Invariants

- `compileSessionProgram()` 維持純函式：無 DOM／Three／`node:*`／時鐘／亂數／模組級可變狀態。
- 五條既有編譯規則（reps 展開、單一 rest、兩級秒數、首尾無 rest、0 秒省略）語意零變更。
- 錯誤分類只走 `field` + `itemIndex`；呼叫端不得 parse 訊息。
- 省略 `weaponId` 時輸出逐位等同本 task 前。

## Definition of Done

- [x] 測試矩陣全綠：合法 3 類（指定穿透／省略／BR 八格等值宣告）+ 非法 7 格 it.each，每格斷言 `field === 'weaponId'` 與 `itemIndex`，並斷言 throw 時無回傳值
- [x] `reps: 3` 的指定武器 item 產出三個 `RunStep`，`weaponId` 三筆皆為該值；同 program 內未指定的第二個 item 兩筆皆 undefined
- [x] 省略時 `Object.hasOwn(step, 'weaponId') === false` 有明確斷言，並加 `Object.keys()` 鍵順序斷言；突變（永遠放鍵）實測轉紅 1 條
- [x] 逐位回歸：5 個不含 `weaponId` 的 plan（含 frozen 六 family + warmup）對本 task 前 HEAD `cmp` 無差異，sha256 相同；指令與雜湊記入 `progress.md §T2`
- [x] 純度 source-scan 的 8 條 FORBIDDEN 規則**未修改**且全綠；額外擴掃新進閉包的 `weapons.ts`／`WeaponConfig.ts`（D-62.T2-1）
- [x] `npm run typecheck` ×2 + `npm run build` + 全量 Vitest exit 0（2,896 passed / 2 skipped，較 T1 基線 +30 = 本 task 新增，既有零修改）

## Commit

```text
feat(session): compile a per-item weapon into every run step
```
