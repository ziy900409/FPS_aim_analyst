# WP-67 T2 — runtime 事實出口：`DrillRunner.opening` → 匯出接線

> FR-67.1／67.2／**67.7**／**67.8** · NFR-67.4 · D-67-1／D-67-3 · **FM-2** · ADR-2

## Objective

讓 `meta.opening` 的值來自**該 run 的實際事實**，而不是某個寫死的版本字串。

## 為什麼必須經由 `DrillRunner`

開場協定由兩件事決定：這個 runner 建構時有沒有拿到 `requireArm`，以及它現在載入的 config 的 `timing.countdownMs`。**只有 `DrillRunner` 同時持有這兩者**。任何在 `main.ts` 直接寫 `protocol: 'armed-countdown-v1'` 的做法都會在第一次有人改 `requireArm` 時開始說謊（FM-2），而說謊的標記比沒有標記更糟——研究者會信任它並據以分池。

## Steps

1. **`DrillRunner` 介面加唯讀 getter `opening`**（[DrillRunner.ts](../../../../../src/drill/DrillRunner.ts)）：
   - 簽名與註解見 [README §2.4](README.md)
   - 實作：`config === null` ⇒ 回 `null`；否則回 `{ protocol: requireArm ? 'armed-countdown-v1' : 'immediate-v0', countdownMs: config.timing.countdownMs }`
   - **不新增任何狀態**：`requireArm` 與 `config` 都是既有閉包變數
   - **不進 tick 路徑**：getter 只在匯出組裝期被呼叫（NFR-67.4）。若為了省配置而快取物件，必須在 `start()` 重建，否則換 drill 後 `countdownMs` 會殘留舊值
2. **ADR-2 覆核**：本 getter 是 sim→data 的唯讀導出，比照既有 `phase` / `countdownRemainingMs` 先例。**不得**新增 `SharedState` 欄位、不得回寫 sim。
3. **`main.ts` 接線**：在匯出組裝處把 `activeDrillRunner.opening ?? undefined` 餵進 `collectMeta()`。注意 `main.ts` 有**三個** `createDrillRunner()` 建構點（[:1033](../../../../../src/main.ts#L1033)／[:1492](../../../../../src/main.ts#L1492)／[:1534](../../../../../src/main.ts#L1534)）但匯出組裝只有一處——接線點是**後者**，不要在三處各接一次。
4. **測試（單元）**，至少四條：
   - **FM-2 反證**：`createDrillRunner(state, tm, { requireArm: false })` + `start(config)` ⇒ `opening.protocol === 'immediate-v0'`
   - **FM-2 反證之二**：省略 `options` ⇒ 同上（harness／測試路徑的既有行為，NFR-67.2 的來源）
   - `requireArm: true` ⇒ `'armed-countdown-v1'`，且 `countdownMs` 等於傳入 config 的 `timing.countdownMs`（**不是** 3000 這個常數——用一個刻意非 3000 的值，例如 1500，證明它真的從 config 讀）
   - `start()` 之前 ⇒ `opening === null`；`start(configA)` 後換 `start(configB)`（兩者 `countdownMs` 不同）⇒ 取到 B 的值
5. **OQ-67.2 落地**：harness／e2e 產出的匯出會帶 `immediate-v0`。確認這不會被誤讀為真人資料——在 `progress.md` 寫下該結論與依據（既有 history／檔名紀律），不新增旗標。

## Definition of Done

- [ ] `npx vitest run src/drill src/data` exit 0；四條案例名逐條列入 `progress.md`
- [ ] `countdownMs` 的測試使用**非 3000** 的值，證明來源是 config 而非常數（案例名點明）
- [ ] `git diff -- src/state/SharedState.ts` 為**空**（ADR-2：沒有新增跨迴圈欄位）
- [ ] `npx vitest run tests/regression` exit 0、fixture 零修改
- [ ] `npm run typecheck` exit 0
- [ ] `progress.md` 記載 OQ-67.2 的落地結論

## Commit

```text
feat(wp-67): derive meta.opening from the runner's actual arming contract
```
