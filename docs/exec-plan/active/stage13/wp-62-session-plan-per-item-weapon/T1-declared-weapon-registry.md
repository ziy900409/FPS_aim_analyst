# WP-62 T1 — Drill 自宣告武器的推導註冊表

## Objective

建立「這個 drill 有沒有自己宣告武器、宣告了哪一把」的單一來源，**由 `drillFamily.ts` 已 import 的 drill 模組推導**，而非第二份手寫清單（KI-016 紀律）。這是 T2 拒絕覆蓋 BR 八格（D-62-1）與 T4 顯示實名（OQ-62.1）的共同前提。

## Steps

1. `src/weapon/weapons.ts`：把既有的模組私有 `isWeaponId()`（第 212 行）改為 `export`。語意零變更、不改 `getWeapon()`。
2. `src/session/drillFamily.ts`：新增 `DECLARED_WEAPON_BY_DRILL_ID`，值**一律讀 drill 模組自己的匯出常數**，不得手打字串字面值（沿用 D-58-T0-2：WP-58 規劃表曾因手打 drill id 錯了六個）。現況恰 **8** 筆（規劃期誤記 4，見 [progress.md §T1](progress.md) D-62.T1-1），全部來自 `trackingBrVariants`：
   ```ts
   const DECLARED_WEAPON_ROSTER: readonly (readonly [string, WeaponId])[] = [
     ...trackingBrVariants.map((variant) => [variant.id, variant.drill.weaponId] as const),
   ];
   ```
   建構時驗證：值必須通過 `isWeaponId()`；同一 drillId 不得重複宣告；每個 key 必須存在於 `FAMILY_BY_DRILL_ID`（不可排程的 drill 不該出現在這張表）。
3. 撰寫**對表測試**（`drillFamily.test.ts`）：遍歷 `SCHEDULABLE_DRILL_IDS`，解析每個 drill 的實際 config，斷言 `config.weaponId` 與 `DECLARED_WEAPON_BY_DRILL_ID.get(id)` 完全一致——**包含「兩邊都是 undefined」的負向案例**。這是防 rot 的真正機制：未來任何 drill 新增 `weaponId` 而忘了進 map，這條測試會紅。
4. 依 OQ-62.3 決定覆蓋範圍：優先全覆蓋 36 個。lazy binding（`spiderShotV3Binding`／`spiderShotWideV1Binding`）與 `{ id, drill }` 包裝需要各自的解析方式；若某項解析成本過高，於 `progress.md` **具名豁免並說明理由**，不得靜默略過。
5. 補一條正向斷言：`DECLARED_WEAPON_BY_DRILL_ID.size === 8` 且 key 集合等於 `trackingBrVariants.map(v => v.id)` 的集合——讓「範圍變了」在 review 時無所遁形。另斷言值集合恰為 4 把 BR 武器，把「8 格共用 4 把」這件事也釘死。

## Invariants

- `getWeapon()` 與 `WEAPONS` 的既有語意、錯誤訊息零變更。
- `FAMILY_BY_DRILL_ID` / `SCHEDULABLE_DRILL_IDS` / `resolveFamilyDrillId()` / `resolveWarmupDrillId()` 行為零變更。
- 新 map 的每個值都經 `isWeaponId()` 驗證，不存在只在型別層成立的 id。
- 不新增任何手寫 drill id 或 weapon id 字面值。

## Definition of Done

- [x] `isWeaponId` 已匯出；`weapons.ts` 既有測試（`WeaponConfig.test.ts` 24 tests）零修改全綠
- [x] `DECLARED_WEAPON_BY_DRILL_ID` 建構時對「值非法武器 id」「drillId 重複」「drillId 不可排程」三種污染各有一條 throw 的負向測試（＋第四條：`weaponId` 為 `undefined`）
- [x] 對表測試遍歷 `SCHEDULABLE_DRILL_IDS`：**全覆蓋 36 個、零豁免**，正向 8 筆相符、負向 28 筆兩邊皆 undefined；覆蓋率記入 `progress.md §T1`
- [x] `size === 8` 且 key 集合等於 BR 八格、值集合等於 4 把 BR 武器的斷言存在（原 DoD 寫 4，見 D-62.T1-1）
- [x] `npm run typecheck` ×2 + 全量 Vitest exit 0（2,866 passed / 2 skipped），既有測試零修改

## Commit

```text
feat(session): derive a registry of drill-declared weapons
```
