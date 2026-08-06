# T2 — 匯出自我描述:`meta.fovDeg` + `meta.mouseIntegration`

> 交付 **FR-A-5 / FR-A-6** · 上游:[A README §2.3](README.md) · [KI-005 §6.2](../KI-005-omega-render-sim-aliasing.md) · 依賴:**T1 已 commit**(需要 `resolveMouseGain`)。
> 性質:**純 additive 資料模型,零語意變更**。

**In scope**:`src/data/metadata.ts`(型別 + validator + `collectMeta`)· `src/main.ts`(填入兩個新區塊)· `docs/operational/schema.md`。
**Out of scope**:`ticks[].dYaw/dPitch`(T4)· `serializeTicksCSV`(T4)· pointer-lock 閘(T3)· Python(T5)。

---

## 為什麼這一刀值得單獨做

`meta.fovDeg` 的缺席是 [KI-005 §6.2](../KI-005-omega-render-sim-aliasing.md) **在拍板之後才查出**的洞,而且它**獨立於 ω aliasing**:

> ADS gain = `sensitivityRatio × (adsFovDeg / hipFov)`。`meta` 有 `sensitivity`、有 `weapon.ads.sensitivityRatio`、有 `weapon.ads.fovDeg`,**唯獨沒有 hipFov** ⇒ 任何 ADS drill 的滑鼠增益**都不可稽核**。

現有兩份樣本全程未開鏡(hip gain ≡ 1)所以今天沒炸,但 **WP-24 的 ADS drill 會直接踩空**。[SettingsPanel.ts:47](../../../src/ui/SettingsPanel.ts#L47) 的 `fov` getter 註解自陳「(WP-7 metadata)」,卻從未接進 [metadata.ts](../../../src/data/metadata.ts)——這是一條**已經寫好但沒接上的線**。

`meta.mouseIntegration` 則是 [KI-004 T2](../KI-004-S1/T2-export-meta-additive.md) 的同一個教訓:**讓匯出自我描述**,離線消費者不必靠約定猜「這份資料的 ω 乾不乾淨」。

---

## Steps

### 1. `meta.fovDeg`(FR-A-5)

- [ ] `Meta` / `CollectMetaArgs` 新增 `fovDeg?: number`;`collectMeta` 以 `requirePositiveFiniteNumber` 驗證。
- [ ] 位置:**top-level**,與 `sensitivity` 同級——它與 `sensitivity` 同屬「使用者輸入設定」,不隸屬 weapon 或 scene。
- [ ] `main.ts` 的 `collectMeta` 呼叫傳入 **`settingsPanel.fov`**。
  - ⚠️ **不得**從 `sceneManager.camera.fov` 或 `cameraController` 讀:ADS 期間 `camera.fov` 是**內插中值**(render-only,[CameraController.setAds](../../../src/view/CameraController.ts#L144)),讀它會讓匯出依賴 render 幀率——與 [KI-004 T2](../KI-004-S1/T2-export-meta-additive.md) 的 `scene.eye` 是**同一個坑**(破壞決定性 + 違反 ADR-2)。
  - `settingsPanel` 是這兩個設定的單一真實來源(該檔檔頭明文),故取它為權威。
- [ ] 預設值:**不給**。缺席 = pre-KI-005 匯出(consumer 須 fallback 並標記);不要用 `?? 75` 之類的預設把「不知道」偽裝成「知道」。

### 2. `meta.mouseIntegration`(FR-A-6)

- [ ] `Meta` / `CollectMetaArgs` 新增 optional 區塊(型別見 [README §2.3](README.md)):
  ```
  { model: 'tick-window-integral'; radPerCount: number; hipStep: number; adsStep: number }
  ```
- [ ] 新增 `requireMouseIntegrationMeta`:`model` 必須恰為 `'tick-window-integral'`(比照 `requireWeaponBulletMeta` 對 `model === 'projectile'` 的作法);三個數值以 `requirePositiveFiniteNumber` 驗證。
- [ ] `main.ts` 以 `resolveMouseGain({ sensitivity: settingsPanel.sensitivity, hipFovDeg: settingsPanel.fov, ads: weaponConfig.ads })` 產出後填入,`radPerCount` 取自 `mouseGain.ts` 的常數。
  - ⚠️ 本 task **只填 meta**;`ticks[].dYaw` 的實際記錄在 T4。此時填入的區塊描述的是「若啟用積分,會用哪組係數」——T4 啟用後兩者必然一致(同一個 `MouseGain` 物件同時餵給 recorder 與 meta,見 T4 §2)。
  - ⚠️ 若 T4 決定把 meta 填入延到啟用時才寫,則本 task 只落型別 + validator + schema 文件,`main.ts` 的填入改在 T4——擇一,並記入 progress。**建議本 task 就填**:兩個 optional 區塊一起上,schema 文件一次寫完。

### 3. `meta.suspect` 不得變動

- [ ] 本 task **不增不減**任何 `suspect` 的 OR 項(A 與 `suspect` 無關)。
- [ ] 補一條測試釘死:對同一組輸入,`meta.suspect` 在本 task 前後**逐位相同**(比照 [KI-004 T2](../KI-004-S1/T2-export-meta-additive.md) 的 NFR-S1-2b 測試)。

### 4. schema 文件

- [ ] [schema.md](../../operational/schema.md) 新增兩處(top-level meta 表):
  - `meta.fovDeg` —— hip 基準垂直 FOV(度);**ADS gain 的分母**;來源 `SettingsPanel`;缺席 = pre-KI-005 匯出 ⇒ 該匯出的 ADS 期間感度鏈**不可稽核**。
  - `meta.mouseIntegration` —— 新小節:四個欄位語意、`model` 的封閉值域、與 `ticks[].dYaw/dPitch`(T4)的關係(**缺席 ⇔ `ticks[].dYaw` 亦缺席**)。
- [ ] 每欄註明「Additive;absence means pre-KI-005 export → 離線消費者須 fallback 並標記 source」。
- [ ] 在 `meta.mouseIntegration` 小節留一行指路:「逐 tick 欄位見 `ticks[].dYaw` / `dPitch`(T4)」。

### 5. 回歸

- [ ] `npx tsc --noEmit`
- [ ] `npm run test:ci` —— `metadata.test.ts` 補新欄位的 happy path + validator 拒絕案(`fovDeg` 非正、`model` 錯值、三個 step 非正);既有 `suspect` 相關期望值**必須零變動**。

---

## Definition of Done

- [ ] `meta.fovDeg` 與 `meta.mouseIntegration` 皆為 **optional additive**;`schemaVersion` 維持 `2`,無任何欄位被刪除或改名。
- [ ] `fovDeg` 取自 `settingsPanel.fov`,**未**從 `camera.fov` / `cameraController` 讀取(以 `git diff` 複查;違反即破壞決定性 + ADR-2)。
- [ ] `fovDeg` **沒有**預設值——缺席就是缺席,不以預設值偽裝。
- [ ] `meta.suspect` 在本 task 前後**逐位相同**,並有測試釘死。
- [ ] `requireMouseIntegrationMeta` 對 `model` 的封閉值域與三個 step 的正有限性有拒絕案測試。
- [ ] `schema.md` 記錄兩個新區塊,含「缺席 = pre-KI-005 匯出」的 fallback 說明與指向 T4 逐 tick 欄位的一行。
- [ ] `npx tsc --noEmit` exit 0;`npm run test:ci` exit 0,零既有期望值變更。
- [ ] `git diff` 不觸及 `src/sim/`、`SharedState` 演進、`SimLoop.step`。

## Commit message

```
feat(ki-005): 匯出自我描述滑鼠感度鏈 — meta.fovDeg / meta.mouseIntegration

KI-005 / A(FR-A-5/6)。meta 有 sensitivity、有 weapon.ads.sensitivityRatio、
有 weapon.ads.fovDeg,唯獨沒有 hip 基準 FOV ⇒ ADS gain =
ratio × (adsFov / hipFov) 無法離線重建,任何 ADS drill 的滑鼠增益都不可稽核
(KI-005 §6.2;獨立於 ω aliasing 的可重現性漏洞)。SettingsPanel 的 fov getter
註解自陳「WP-7 metadata」卻從未接進 metadata.ts —— 本刀把那條線接上。

fovDeg 取自 SettingsPanel(這兩個設定的單一真實來源),**不從 camera.fov 讀**:
ADS 期間 camera.fov 是 render-only 的內插中值,讀它會讓匯出依賴 render 幀率
(與 KI-004 T2 的 scene.eye 同一個坑)。

純 additive:schemaVersion 維持 2,meta.suspect 逐位不變並以測試釘死。
```
