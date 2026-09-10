# WP-62 T3 — SessionRunner 與 `activateDrill()` 接線

## Objective

把 `RunStep.weaponId` 從編譯結果送到 runtime，讓該步的 sim loop、彈匣、ADS 光學與滑鼠 gain **一次到位地**用同一把武器；並以跨 render FPS 逐位一致斷言證明決定性未被破壞（FR-62.3、NFR-62.2）。

> **本 task 是全 WP 唯一的 High risk 項**：`activateDrill()` 是全 app 唯一的 drill 啟用路徑，四個呼叫端共用（`loadDrillById`／`loadDrillConfigDirect`／`loadSceneById`／protocol 條件）。

## Steps

1. `src/session/SessionRunner.ts`：`SessionRunnerOptions.loadDrillById` 簽名擴為
   `(drillId: string, weaponId?: WeaponId) => Promise<void>`；`enterStep()` 改呼叫
   `await options.loadDrillById(step.drillId, step.weaponId)`。
   runner 其餘邏輯（游標、rest、`measuredRunOrdinal`、`runTransition` 錯誤傳播）**零修改**。
2. `src/main.ts`：`activateDrill()` 新增第五個參數 `weaponId: WeaponId | undefined`，並把第 1397 行
   ```ts
   activeWeaponOverride = undefined; // WP-47 / T2：reset-per-drill
   ```
   改為
   ```ts
   activeWeaponOverride = weaponId; // WP-62：Session Plan 指定值；其餘呼叫端傳 undefined ⇒ 逐位等同 WP-47/T2 的 reset-per-drill
   ```
   **位置不動**（仍在 `buildSimLoop()` 之前約 18 行），註解保留 WP-47/T2 的原意並標註本次擴充。
3. 更新四個呼叫端：
   - `loadDrillById(drillId, weaponId?)` → 傳遞下去（Session Plan 路徑）；
   - `loadDrillConfigDirect()` → 傳 `undefined`（tracking pilot 走自己的 `weaponId`）；
   - `loadSceneById()` 的 `activeWeaponOverride = undefined`（第 1444 行）→ **維持不變**：換場景不是換 drill，沿用 WP-47/T2 語意；
   - protocol 條件路徑 → 傳 `undefined`。
4. `controls?.setSelectedWeapon(...)`（第 1421 行）改為反映**實際生效**的武器（`activeWeaponConfig().id`），而非固定讀 `nextConfig.weaponId ?? 'ak47'`——否則 Session Plan 指定武器時研究者面板會顯示錯的值。
5. **決定性斷言**（NFR-62.2）：在 `src/loop/__tests__/` 或既有決定性測試檔新增案例——同一 program（含指定武器的 item）+ 同一輸入序列，在至少 4 種 render FPS 下跑，斷言逐 tick 的 sim 狀態（position／velocity／命中／`ammo`／recoil index）**逐位一致**。不斷言 wall-clock 時間戳（CLAUDE.md §4）。
6. **賦值順序斷言**：新增一條測試證明 `activeWeaponOverride` 在 `buildSimLoop()` 被呼叫時已是指定值——可用 dev-only 觀測縫或以「換武器後 `state.weapon.magSize` 等於新武器的 `magSize`」間接釘死（後者更貼近真實失敗模式：順序錯了彈匣就會是舊武器的）。
7. **reps 一致性**：測試 `reps: 3` 的指定武器 item，三輪 `activateDrill` 都收到同一把。
8. `SessionRunner.test.ts` / `SessionRunnerProgram.test.ts` / `SessionRunnerPoll.test.ts` 的既有 stub 需補第二參數；**斷言不得放寬**，並新增「stub 收到的 weaponId 等於 step 的值」正向斷言。

## Invariants

- `activeWeaponOverride` 的賦值點仍早於 `buildSimLoop()`／`setAdsConfig()`／`configureMouseIntegration()`。
- 非 Session Plan 的三個呼叫端傳 `undefined` ⇒ 行為與本 task 前**逐位等同**（WP-47/T2 reset-per-drill 未被削弱）。
- `loadSceneById()` 的既有 reset 語意不變。
- 不新增 `SharedState` 欄位；不新增第二條換武器路徑（`loadWeaponById()` 維持原樣）。
- 錯誤傳播路徑不變：載入失敗仍由 `runTransition` / `poll()` 的既有 catch 處理，不得讓 rest overlay 卡死。

## Definition of Done

- [x] 跨 render FPS（≥ 4 種）逐位一致斷言通過；測試檔名 + 案例名記入 `progress.md` —— `src/loop/__tests__/wp62-session-weapon-determinism.test.ts`，4 條 `<FPS>：整份 program 的逐步 sim 狀態 bit-exact 對齊 canonical` + `四種 FPS 序列彼此 bit-exact 相等` + `重播 bit-exact`
- [x] 賦值順序有測試釘死 —— magSize 版於決定性檔 `武器賦值早於 sim loop 建構…`；**敘述順序**另由 `sessionWeaponActivation.test.ts` 的 `main.ts` source 掃描 3 格釘死（magSize 版擋不住搬動，見 progress.md §T3）。突變 M2 實證
- [x] `reps: 3` 三輪皆套用同一把武器有測試 —— 決定性檔 `program 走完三條 precedence 分支…` + `SessionRunnerProgram.test.ts` `hands every rep of an item the same planned weapon…`
- [x] 三個非 Session Plan 呼叫端傳 `undefined` —— `sessionWeaponActivation.test.ts` `非 Session Plan 的呼叫端明確傳 undefined…` + `loadSceneById() 的 WP-47/T2 reset 語意未被本 task 改動`；既有場景／protocol 測試零修改全綠（全量 2,919 passed）
- [x] `controls.setSelectedWeapon` 顯示實際生效武器 —— `Controls 顯示的是實際生效武器，不是只讀 drill 自宣告`（突變 M3 實證）
- [x] 既有 `SessionRunner*.test.ts` 三檔僅補參數且 6 條斷言**加嚴**（`(id)` → `(id, undefined)`），三檔各含一條 weaponId 正向斷言 —— 逐檔對照見 progress.md §T3
- [x] `npm run typecheck` ×2 exit 0 + `npm run build` exit 0 + 全量 Vitest **2,919 passed / 2 skipped**（T2 基線 2,896 → +23，恰為新增）

## Commit

```text
feat(session): apply the planned weapon at every program step
```
