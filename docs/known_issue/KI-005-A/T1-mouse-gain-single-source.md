# T1 — `mouseGain.ts`:counts→rad / 感度 gain / 角度累加的單一來源

> 交付 **FR-A-2 / FR-A-3** · 上游:[A README §2.3](README.md) · 依賴:**T0 已 commit**。
> 性質:**純重構,零行為變更**。積分本身在 T4;本 task 只是先把「一份實作」變成「一份共用實作」。

**In scope**:`src/input/mouseGain.ts`(新)· `src/view/CameraController.ts`(改為消費)· 對應測試。
**Out of scope**:`applyInput` 的 mouse 分支(T4)· recorder 累加器(T4)· 任何匯出欄位(T2)· `InputSampler`(T3)。

---

## 為什麼這一刀要先做

T4 要在 sim 消費端把 mouse delta 積分成角位移。如果那裡自己寫一份「`sensitivity × RAD_PER_COUNT × adsGain` + pitch 夾角」,repo 就有**兩份角度累加實作**——而 [KI-004](../KI-004-sim-world-unit-domain-mismatch.md) 的 D2a/D2b 正是「同一個幾何量在不同層各算一套,其中一套錯了兩年沒人發現」。

更關鍵的是:**守恆閘(FR-A-9)只有在兩側共用同一實作時才可能逐位成立**。若各寫一份,`Σ dYaw` 與 `Δaim.yaw` 的差就變成一個需要解釋的容差,而不是一個能抓 bug 的斷言。

> 現況:`RAD_PER_COUNT`、`MAX_PITCH`、`#adsGain` 三者全部是 [CameraController.ts](../../../src/view/CameraController.ts) 的 **private / module 私有**,sim 側取不到。這是本 task 要拆的牆。

---

## Steps

### 1. 新檔 `src/input/mouseGain.ts`

- [ ] 搬移 `RAD_PER_COUNT`(`THREE.MathUtils.degToRad(0.022)`)與 `MAX_PITCH`(`Math.PI / 2 - 0.01`)為 **exported 常數**。
  - ⚠️ 值必須**逐位相同**:沿用 `THREE.MathUtils.degToRad` 而非手寫 `0.022 * Math.PI / 180`(浮點結果可能不同位)。
- [ ] 實作 `resolveMouseGain(input: MouseGainInput): MouseGain`(簽名見 [README §2.3](README.md)):
  - `hipStep = sensitivity * RAD_PER_COUNT`
  - `adsStep = ads === undefined ? hipStep : hipStep * ads.sensitivityRatio * (ads.fovDeg / hipFovDeg)`
  - 驗證:`sensitivity` / `hipFovDeg` / `ads.fovDeg` / `ads.sensitivityRatio` 皆須正有限,否則拋錯。
  - ⚠️ **運算順序必須與現行 [CameraController.setAds](../../../src/view/CameraController.ts#L154) 逐字相同**(`ratio * (fovDeg / hipFov)`,先除後乘),否則 gain 可能差最後一位。
- [ ] 實作 `createAimIntegrator(): AimIntegrator`:
  - `applyDelta(dx, dy, step)`:`yaw -= dx * step`;`pitch = clamp(pitch - dy * step, -MAX_PITCH, MAX_PITCH)`;回傳**實際生效**的 `{ dYaw, dPitch }`(= 新值 − 舊值,故 pitch 夾角自動反映在 `dPitch`,見 [D-A2](README.md#25-語意決策三個必須明文的取捨))。
  - 回傳值以**重用物件**承載(GC 紀律,NFR-A-7);文件註明「呼叫端須同步讀取、不得保留參考」(比照 [`InputEventView`](../../../src/state/types.ts) 的既有慣例)。
  - `reset(yaw = 0, pitch = 0)`。
- [ ] 檔頭 doc comment 說明:此模組是 counts→rad 換算與角度累加的**唯一定義**,render 與量測兩條路徑共用;修改前必讀 KI-005 / KI-004。

### 2. `CameraController` 改為消費

- [ ] 刪除 module 內的 `RAD_PER_COUNT` / `MAX_PITCH` 定義,改 import。
- [ ] `#sensitivity` + `#adsGain` 的維護改走 `resolveMouseGain`:
  - `setSensitivity(s)` / `setFov(deg)` / `setAdsConfig(ads)` / `setAds(active, nowMs)` 四處更新 gain 的邏輯,統一改為「重算 `MouseGain`,依 `#adsActive` 取 `hipStep` / `adsStep`」。
  - ⚠️ **gain 階躍語意不變**(GD-16):切換 ADS 立即以**目標態**計算,不隨 FOV 內插。
  - ⚠️ `#hipFov` 仍由 `setFov` 維護;`resolveMouseGain` 的 `hipFovDeg` 傳入 `#hipFov`。
- [ ] `applyDelta(dx, dy)` 改為委派 `AimIntegrator`,再由 `#applyToCamera()` 讀 `integrator.yaw/pitch` 組 quaternion。
  - ⚠️ **`#applyToCamera` 的 quaternion 組合順序、punch 疊加位置、`aimSink` 寫入語意全部不動**(`aimSink` 仍寫**不含 punch** 的使用者視角)。
- [ ] `setCamera` / 建構子的行為不變。

### 3. 逐位不變的封裝測試(FM-3,**先寫**)

- [ ] 新增 `src/input/mouseGain.test.ts`:
  - `resolveMouseGain` 的 hip / ADS / 無 ads config 三種情形,對**手算閉式值**逐位比對。
  - `AimIntegrator`:yaw 無界遞減、pitch 在 ±`MAX_PITCH` 夾住、夾住後 `dPitch` 為 0、`Σ dPitch ≡ Δpitch`(D-A2 的性質測試)。
- [ ] 新增/擴充 `src/view/CameraController.test.ts`:
  - 給定一串固定 delta 序列,斷言 `camera.quaternion` 的四個分量與 `aimSink.yaw/pitch` **逐位**等於重構前的實測值(先跑舊碼取值寫死為 golden,再重構)。
  - ADS 切換序列下 gain 階躍的行為逐位不變。
- [ ] Playwright:四場景載入後 camera 初始 quaternion 不變(若既有 e2e 已涵蓋則不重複)。

### 4. 回歸

- [ ] `npx tsc --noEmit`
- [ ] `npm run test:ci` —— **零既有測試期望值變更**(這是本 task 的核心 DoD)。
- [ ] `git diff --stat` 只有兩個檔 + 測試檔。

---

## Definition of Done

- [ ] `grep -rn "0\.022" src/` 只在 `src/input/mouseGain.ts` 命中(作為 counts→rad 係數);`grep -rn "Math.PI / 2 - 0.01\|MAX_PITCH" src/` 的定義只有一處。
- [ ] `CameraController` **不再**自行定義 `RAD_PER_COUNT` / `MAX_PITCH`,且 `#adsGain` 由 `resolveMouseGain` 產出。
- [ ] 四場景 camera 每幀 quaternion 與 `aimSink` 逐位不變(新測試逐條斷言,含 ADS 切換序列)。
- [ ] `AimIntegrator.applyDelta` 回傳的 `dPitch` 在夾角情形下正確為 0,且 `Σ dPitch ≡ Δpitch`。
- [ ] `resolveMouseGain` 對非正有限輸入拋錯,有測試。
- [ ] `npx tsc --noEmit` exit 0;`npm run test:ci` exit 0 且**零既有期望值變更**(有任何變更 ⇒ 代表浮點運算順序被改,回頭修運算式而非改期望值)。
- [ ] `git diff` 不觸及 `src/sim/`、`SharedState`、`SimLoop`、`src/data/`。

## Commit message

```
refactor(ki-005): counts→rad / 感度 gain / 角度累加抽為 mouseGain 單一來源

KI-005 / A(FR-A-2/3)。RAD_PER_COUNT、MAX_PITCH、ADS gain 公式與 yaw/pitch
累加原本全是 CameraController 的私有實作,sim 側取不到 —— 而 T4 的 tick 窗積分
需要逐位相同的同一套換算,否則守恆閘(Σ dYaw ≡ Δaim.yaw)只能退化成容差斷言,
失去抓 bug 的能力(KI-004 D2a/D2b 即「同一幾何量各層各算一套」的實例)。

純重構:CameraController 改為消費 mouseGain 的常數與純函式,quaternion 組合
順序、punch 疊加位置、aimSink 不含 punch 的語意逐字不動。四場景 camera 每幀
quaternion 與 aimSink 逐位不變,以新測試釘死。
```
