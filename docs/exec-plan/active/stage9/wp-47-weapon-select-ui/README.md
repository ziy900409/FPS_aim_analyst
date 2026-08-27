# WP-47(暫用編號)— weapon-select-ui:Controls.ts 換武器下拉選單

> stage9 提案的 WP 子資料夾。上層 spec:[../README.md](../README.md)。
> Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> 格式比照 [`wp-44-spider-shot-v2-stratified/README.md`](../wp-44-spider-shot-v2-stratified/README.md)(同 stage9 提案的小型 additive WP)。

| | |
|---|---|
| **目標** | `Controls.ts` 新增 weapon-select 下拉選單(比照既有 `sceneSelect` 寫法),讓使用者可在不切換 drill 的前提下手動換武器;`main.ts` 新增 `activeWeaponOverride` 收斂點 + `loadWeaponById()` 重建路徑 |
| **里程碑** | 無獨立里程碑(T-exit gate 即交付判定,比照 WP-27/WP-44 精神);暫定歸入階段 I(未正式指派,見 [../README.md](../README.md) OQ-S9-2 同類處置) |
| **相依** | 無(獨立;不修改任何已交付 drill/協定的凍結數值,不改 `WeaponConfig.ts`/`weapons.ts`) |
| **估時** | 0.5–1 dev-day |
| **狀態** | ✅ T-exit(GD/WP 正式編號延後) |

---

## 0. 讀碼對帳(對話中已完成的稽核結論)

關鍵讀碼結論(完整推導見對話紀錄與下方引用行號):

1. **`activeWeaponConfig()` 是唯一權威收斂點**([`src/main.ts:218-220`](../../../../../src/main.ts#L218)):`return getWeapon(activeDrillConfig.weaponId ?? 'ak47')`。目前 6 個直接呼叫點(218 定義、269、459、481、853、1071、1350)+ 2 個透過 `currentMouseGain()`(455)間接呼叫(472、1072)。**所有讀武器的路徑都經過這一個函式**,故只需在此加一層 override 判斷,不必動其餘 8 個呼叫點。
2. **`loadDrillById()`([`src/main.ts:1050-1077`](../../../../../src/main.ts#L1050))的重建序列可抽出子集**:`drillRunner.restart()` → `resetRunPresentation()` → `simLoop = buildSimLoop()` → `cameraController.setAdsConfig(activeWeaponConfig().ads)` → `recorder.configureMouseIntegration({ gain: currentMouseGain() })` → `drillRunner.start(activeDrillConfig)` → `syncControlsVisibility()`。`loadWeaponById()` 只需要這個子集(不含 scene/`targetManager`/`targetView.setShape`——武器不影響場景或 hitbox)。
3. **`Controls.ts` 的 `sceneSelect` pattern 可逐行照抄**([`src/ui/Controls.ts:71-79,111-113`](../../../../../src/ui/Controls.ts#L71)):`makeSelect()` 建下拉 + 獨立的「Scene」按鈕觸發 `onLoadScene`,**`sceneSelect` 本身不監聽 `change`**——必須按按鈕才套用。這與 `drill select` 的「選了就套用」(`select.addEventListener('change', ...)`)是兩種不同語意;使用者在本次對話中明確指定「對照 `sceneSelect` 的寫法」,故 weapon-select 採**按鈕確認**語意,不做 change 即套用。
4. **`WEAPONS`([`src/weapon/weapons.ts:125-133`](../../../../../src/weapon/weapons.ts#L125))已有 7 個 `WeaponId` 可直接當下拉選項來源**,型別已匯出(`WeaponId`/`getWeapon`/`WEAPONS`),不需新增任何武器資料。
5. **射速對照表**(供 T-exit 手動驗證基準,`cycletimeSec` 已逐位確認於 [`src/weapon/weapons.ts`](../../../../../src/weapon/weapons.ts)):

   | WeaponId | `cycletimeSec` | RPM | `ads` | `bullet` |
   |---|---|---|---|---|
   | `ak47` | 0.1 | 600 | 有(fovDeg 40) | 無(hitscan) |
   | `m4a4` | 0.09 | ≈667 | 無 | 無(hitscan) |
   | `m4a1s` | 0.1 | 600 | 無 | 無(hitscan) |
   | `ak47_br_hip_hitscan` | 0.1 | 600 | 無 | 無(hitscan) |
   | `ak47_br_ads_hitscan` | 0.1 | 600 | 有 | 無(hitscan) |
   | `ak47_br_hip_projectile` | 0.1 | 600 | 無 | 有(projectile) |
   | `ak47_br_ads_projectile` | 0.1 | 600 | 有 | 有(projectile) |

---

## 1. 範圍

**In scope**:

```
src/ui/Controls.ts                   ← MODIFY ControlsOptions 新增 weapons/selectedWeaponId/onLoadWeapon,
                                        ControlsHandle 新增 setSelectedWeapon;新增 weaponSelect + Weapon 按鈕
                                        (比照 sceneSelect + loadSceneButton,按鈕確認、不監聽 change)          [T1]
src/ui/Controls.test.ts              ← MODIFY 補 weapon-select 案例(按鈕觸發 onLoadWeapon、setSelectedWeapon
                                        更新 value)                                                          [T1]
src/main.ts                          ← MODIFY 新增 activeWeaponOverride 狀態;activeWeaponConfig() 先讀
                                        override;新增 loadWeaponById();loadDrillById()/loadSceneById() 開頭
                                        清空 override(reset-per-drill,見 §2③);createControls({...}) 接線     [T2]
```

**Out of scope**:

- `src/weapon/WeaponConfig.ts`/`src/weapon/weapons.ts`——零改動,不新增/修改任何武器數值或欄位。
- 熱鍵切槍、開局選武器畫面、per-drill 武器白名單限制——先只做研究者控制面板的下拉選單,比照現有 drill/scene select 的定位。
- `src/testharness/fpsTestHarness.ts`——測試 harness 走 `config?.weaponId` 直接指定,不需要 UI override 機制(它本來就不透過 `Controls.ts`)。
- sim 演進邏輯、`SIM_HZ`、命中判定、彈道語意——本 WP 只決定「餵給 sim 哪一組 `WeaponConfig`」,不碰 sim 內部計算。

---

## 2. 關鍵設計決策

### ① `activeWeaponConfig()` 單點加一層 override 判斷

```ts
// src/main.ts                                                                 [T2]
let activeWeaponOverride: WeaponId | undefined;

function activeWeaponConfig() {
  return getWeapon(activeWeaponOverride ?? activeDrillConfig.weaponId ?? 'ak47');
}
```

其餘 8 個呼叫點(見 §0-1)完全不用改——它們都呼叫 `activeWeaponConfig()`,不直接讀 `activeDrillConfig.weaponId`。這保住 C-D4(既有構念不得有第二定義)精神:武器解析仍然只有一個權威函式。

### ② `loadWeaponById()`:抄 `loadDrillById()` 的重建子集,不重新發明

```ts
// src/main.ts                                                                 [T2]
function loadWeaponById(weaponId: WeaponId): void {
  activeWeaponOverride = weaponId;
  drillRunner.restart();
  resetRunPresentation();
  simLoop = buildSimLoop(); // 重置 recoil rng stream + tickIndex(決定性,同 restartActiveDrill/loadDrillById 的理由)
  cameraController.setAdsConfig(activeWeaponConfig().ads);
  recorder.configureMouseIntegration({ gain: currentMouseGain() });
  drillRunner.start(activeDrillConfig);
  controls?.setSelectedWeapon(weaponId);
  syncControlsVisibility();
}
```

**不**做即時熱插拔(改 override 卻不重建 `simLoop`)——`WeaponConfig` 在 `createSimLoop()` 呼叫當下就被讀入並初始化 `recoilState`/`ammo`/bullet arena 尺寸,執行期不會重讀。熱插拔會讓「換武器」在同一組 recoil/ammo 殘留狀態上疊加,破壞 determinism 契約與匯出資料可追溯性——必須跟 `restartActiveDrill()`/`loadDrillById()` 一樣走「觸發式重建」路徑。

### ③ Override 生命週期:**reset-per-drill**(換 drill/scene 時清空,不 sticky)

```ts
// src/main.ts — loadDrillById() / loadSceneById() 開頭各加一行                 [T2]
activeWeaponOverride = undefined;
```

**Why**:BR 系列 drill(`ak47_br_ads_hitscan`/`ak47_br_ads_projectile` 等)的 `weaponId` 是該 drill 研究條件的一部分(ADS/彈道模型是否啟用)。若 override 跨 drill 保留(sticky),使用者在別的 drill 手動選了 `ak47` 之後再切換到 BR ADS 專屬 drill,會**靜默**用錯誤武器條件覆蓋掉該 drill 原本要測的 ADS/projectile 條件——這是研究效度風險,而不只是 UX 瑕疵。reset-per-drill 確保「載入哪個 drill 就用哪個 drill 定義的武器」是預設值,手動換武器只在**當前** drill 內生效,換 drill 即歸零。

**How to apply**:`loadDrillById()`/`loadSceneById()` 開頭清空 `activeWeaponOverride`,並透過既有 `controls?.setSelectedDrill()`/新增的 `controls?.setSelectedWeapon()` 把下拉選單顯示值同步回該 drill 自帶的 `weaponId`,避免下拉選單顯示與實際生效武器不一致。

此為本 WP 的**建議預設**,非對話中已拍板的決策——列入 §4 Open Questions,T0 前應與使用者確認一次(不阻塞 T1,因為 T1 只動 UI 元件本身,不涉及 override 生命週期)。

### ④ UI 觸發語意:比照 `sceneSelect`,按鈕確認而非 change 即套用

`select` 元素在部分瀏覽器用方向鍵可以在不確認(未按 Enter/未失焦)的情況下觸發 `change` 事件;換武器與換 scene 一樣是「重量級」動作(整個 `simLoop` 重建、recoil/ammo 歸零),比照 `sceneSelect` 現有處置(獨立「Scene」按鈕,不監聽 `change`)可避免使用者滑鼠滾動選單時意外觸發重建。`weaponSelect` 採同一模式:新增一顆「Weapon」按鈕,點擊才呼叫 `onLoadWeapon(weaponSelect.value)`。

---

## 3. Failure modes

| 觸發 | 影響 | 處理 |
|---|---|---|
| `loadWeaponById()` 只改 `activeWeaponOverride` 忘記呼叫 `buildSimLoop()` | 武器下拉顯示已換,但 `recoilState`/`ammo`/ADS FOV 仍是舊武器初始化的殘留值——UI 與實際手感不一致 | T2 DoD 明文要求「換武器後 `simLoop` 為新實例」的斷言/手動驗證(fire rate 實測變化) |
| `loadDrillById()`/`loadSceneById()` 忘記清空 `activeWeaponOverride` | 換 drill 後武器意外沿用舊手動選擇,BR ADS/projectile 專屬 drill 跑錯武器條件(研究效度風險,見 §2③) | T2 DoD 明文要求「換 drill 後下拉選單顯示值回到該 drill 自帶 `weaponId`」的測試/手動驗證 |
| `weaponSelect` 選項用原始 `WeaponId` 當 label(如 `ak47_br_ads_projectile`)在 260px `max-width` 下被截斷 | 可讀性差,但與現有 drill/scene select 的一致處置相同 | 不視為本 WP 需解決的新問題(見 §4 OQ-S9-5);沿用既有 `makeSelect()` 樣式,不新增樣式規則 |
| `activeWeaponConfig()` 的 override 判斷寫反優先序(`activeDrillConfig.weaponId ?? activeWeaponOverride`) | drill 自帶 `weaponId` 永遠贏過使用者手動選擇,UI 選了武器卻沒作用 | T2 DoD 明文要求單元/手動驗證「override 優先於 drill 預設」 |

---

## 4. Task 索引

| Task | 檔案 | Objective | 相依 | Risk | 估時 |
|---|---|---|---|---|---|
| **T0** | [T0-entry-gate.md](T0-entry-gate.md) | 覆核 §0 讀碼假設仍成立 + 與使用者確認 §2③ override 生命週期預設;無程式碼 | 無 | Low | 0.1d |
| **T1** | [T1-controls-weapon-select.md](T1-controls-weapon-select.md) | `Controls.ts` 新增 `weaponSelect` + `Weapon` 按鈕(比照 `sceneSelect`)+ `Controls.test.ts` 新測試 | T0 | Low | 0.25–0.3d |
| **T2** | [T2-main-override-wiring.md](T2-main-override-wiring.md) | `main.ts`:`activeWeaponOverride` + `loadWeaponById()` + `loadDrillById`/`loadSceneById` reset override + `createControls({...})` 接線 | T1 | Med(sim 重建正確性 + override 生命週期是本 WP 唯一非機械性風險) | 0.4–0.5d |
| **T-exit** | [T-exit-gate.md](T-exit-gate.md) | 驗收;`npm run test:ci` 全綠 + 瀏覽器手動驗證(fire rate/recoil/ADS 隨切換生效、匯出 `meta.weapon` 正確、換 drill 後 override 正確重置);文件對帳 | T1+T2 | — | 0.2d |

一 task = 一垂直切片 = 一原子 commit 紀律不變。

---

## 5. Concurrency model

**N/A**(沿用既有單 rAF 超級迴圈,ADR-2)。本 WP 不新增計時來源,`loadWeaponById()` 與 `restartActiveDrill()`/`loadDrillById()` 共用同一條同步重建路徑,不引入非同步競態。

---

## 6. 與既有紀律的關係

| 既有紀律 | 本提案是否遵守 | 說明 |
|---|---|---|
| D1(UI 純 TS + DOM overlay,不引框架) | ✅ 遵守 | 沿用 `Controls.ts` 既有 vanilla DOM 模式(`document.createElement`/`addEventListener`),不新增元件系統 |
| ADR-2(三迴圈只透過 `SharedState` 溝通,互不直接呼叫) | ✅ 遵守 | `weaponSelect` 的 `onLoadWeapon` 只呼叫 `main.ts` 既有的重建函式(render/UI 層決策),不直接寫 sim 內部狀態 |
| GD-6/GD-10 類推(場景/解析度切換不改 sim 演進邏輯) | ✅ 類推適用 | 換武器只決定「餵給 sim 哪組 `WeaponConfig`」,不改 `SIM_HZ`/命中判定/彈道語意本身 |
| C-D4(既有構念不得有第二定義) | ✅ 遵守 | 武器解析仍只有 `activeWeaponConfig()` 一個權威函式;override 是它內部多一層判斷,不是另開一條平行路徑 |
| Determinism(同輸入序列 tick 狀態一致) | ✅ 遵守 | `loadWeaponById()` 走與 `restartActiveDrill()`/`loadDrillById()` 相同的「重建 `simLoop` 重置 rng/tickIndex」路徑,不做熱插拔 |

---

## 7. Open Questions

| # | 問題 | 目前傾向 | Owner |
|---|---|---|---|
| OQ-S9-4 | Override 生命週期:sticky(跨 drill 保留)或 reset-per-drill(換 drill 即清空)? | reset-per-drill(§2③ 已給理由,BR 專屬武器條件的研究效度風險)——T0 前建議與使用者確認一次 | 使用者 |
| OQ-S9-5 | `weaponSelect` label 顯示原始 `WeaponId`(如 `ak47_br_ads_projectile`)或研究者友善名稱? | 先用原始 id(比照 drill/scene select 現況,一致性優先於美觀),未來若有反饋難讀再另開 task | 使用者 |
| OQ-S9-6 | WP/GD 正式編號指派時機? | 比照 WP-44/45/46(stage9)與 stage8 WP-43 先例,延後至使用者確認正式開工 | 使用者 |

---

## 8. 文件對帳清單(T-exit 執行)

- [ ] [../README.md](../README.md) §5 WP 索引新增 WP-47 一列(需先確認當下無其他並行工作正在改動該共用檔案,比照 WP-44 T-exit 的處置原則)。
- [ ] [DECISIONS.md](../../../DECISIONS.md)/[exec-plan/README.md](../../../README.md) §2/§4/§6/[docs/MAP.md](../../../../MAP.md):延後,理由同 WP-44/WP-45/WP-46(避免佔用尚未定案的 GD 編號)。
