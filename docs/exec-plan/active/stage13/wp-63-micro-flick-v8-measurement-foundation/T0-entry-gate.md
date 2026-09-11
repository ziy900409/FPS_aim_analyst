# T0 — Entry gate：編號重查、上游驗證、基線實測、OQ-63.1 收斂

> WP：[WP-63](README.md) · 估時 0.5 d · Risk Low · 相依：無

## 目的

在動任何程式碼之前，把三件會讓整個 WP 白做的事釘死：**編號是否還沒被平行 session 取用**、**上游 gate 是否真的綠**、**現況基線數字是多少**。外加收斂唯一的 owner gate（OQ-63.1）。

## Steps

1. **重查編號（GD-35 ② 紀律）**
   - 讀 `docs/exec-plan/DECISIONS.md` 取當下最大 GD 號；讀 `docs/exec-plan/README.md §2` 取當下最大 WP 號。
   - 規劃期記錄為 **WP-63 / GD-39**（寫入當下最大為 WP-62 / GD-38）。若已被取用，依 [GD-15](../../../DECISIONS.md)「先採納先得」順延，**不爭號**，並同步改本 WP 資料夾名與全部交叉連結。
   - 順帶確認 [stage14 草案](../../stage14/README.md) §3 的候選編號是否需要再順延（該檔已因 GD-38 ① 從 WP-62/63/64 改為 WP-63/64/65；本 WP 取用 WP-63 後應再順延為 WP-64/65/66）。

2. **驗上游 exit-gate**
   - [WP-56](../../stage12/wp-56-micro-flick-test-scene/README.md) T-exit ✅（三顆 population 生命週期）
   - [WP-59](../../stage12/wp-59-micro-flick-v8-replacement-spacing/README.md) —— 確認 T4／T-exit 現況；本 WP **不依賴**其完成，但若 v8 spawn 參數仍在變動中，T4 的角距分布檢查必須註明所用的 HEAD。
   - [WP-60](../wp-60-raw-mouse-sample-capture/README.md) T-exit ✅（`?rawMouse=1` 可用，R1 已過：活動期約 1005 Hz、dt p50 995 µs、零遺漏）
   - 逐條把證據連結記入 `progress.md`。

3. **實測基線（NFR-63.6）**
   ```powershell
   npm.cmd run typecheck
   npm.cmd test
   npx.cmd playwright test --workers=1
   npm.cmd run build
   ```
   四項皆須 exit 0，並把**實際數字**（Vitest passed／skipped 檔數與測試數、Playwright passed 數與耗時、build modules 數）記入 `progress.md §T0`。**不得**引用 WP-62 T0 的舊值（2,822／103）當本 WP 基線。

4. **CodeGraph impact 重跑**
   - 對 `buildPeekWindows`、`resolveEyeOrigin`、`omegaDegPerSec`、`createDataRecorder`、`microFlickThreeTargetTestV8` 各跑一次 impact。
   - 把當下 caller 數記入 `progress.md`，覆蓋 README §0.6 的規劃期值。graphify 報告若落後 HEAD，以 CodeGraph 或直接 Read 為準。

5. **驗證 README §0.4 的機制事實**（本 WP 要據此入帳 GD-39 ③，必須自己確認過）
   - 讀 [`TargetManager.ts`](../../../../../src/sim/TargetManager.ts) 的 `spawn()`，確認 `state.weapon.ammo = state.weapon.magSize` 存在且有 3 個呼叫點。
   - 讀 [`spread.ts`](../../../../../src/recoil/spread.ts) 確認 `inaccuracy === 0` 早退不消耗 RNG。
   - 讀 [`weapons.ts`](../../../../../src/weapon/weapons.ts) 確認 `usp_s_laser` 的 `recoil.magnitude === 0`、`inaccuracy` 三項為 0、無 `ads` 區塊、`cycletimeSec === 0.17`、`magSize === 12`。
   - 任一項與 README §0.4 不符 ⇒ **停止**，先更正 README 與 GD-39 草稿再繼續。

6. **收斂 OQ-63.1**（唯一的 owner gate）
   - 問研究者：既有 v8 匯出是否屬於某個已凍結的研究 cohort？
   - 「否」（預設）⇒ T1 直接改 v8 fixture。
   - 「是」⇒ **本 WP 轉向**：T1 改為建立 v9 fixture（新 drillId、新 sceneId 綁定或沿用 v8 場景），README §1.1 FR-63.12 與 §3.1 同步更新，其餘 task 不變。

7. 開立 GD-39 草稿（不入帳，T-exit 才寫入 `DECISIONS.md`），內容為 README §0.4 與 §2.2 的三條決議。

## Definition of Done

- [ ] `progress.md §T0` 記錄當下最大 WP／GD 號與是否順延的判定
- [ ] 三個上游 gate 各有可點擊的證據連結
- [ ] 四項基線指令的 exit code 與**實際數字**記入 `progress.md`（非「全綠」三個字）
- [ ] 五個符號的 CodeGraph impact 數字記入 `progress.md`，README §0.6 已更新或明示無變化
- [ ] README §0.4 的三項機制事實逐條在 `progress.md` 標記「已親自確認」並附行號
- [ ] OQ-63.1 有明確答案（研究者回覆，或明帳記錄「以預設假設推進」與推進時間）
- [ ] GD-39 草稿存在於 `progress.md`（不寫入 `DECISIONS.md`）

## Commit

```
docs(wp-63): T0 entry-gate
```
