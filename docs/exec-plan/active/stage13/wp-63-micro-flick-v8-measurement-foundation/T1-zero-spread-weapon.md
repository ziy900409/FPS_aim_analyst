# T1 — v8 宣告零後座零散布武器 + 斷代標記 + 彈匣旗標契約

> WP：[WP-63](README.md) · 估時 1.5 d · Risk Med · 相依：T0

## 目的

讓 v8 的「命中與否」成為**開火瞬間角誤差的純函式**。現況 v8 無 `weaponId` ⇒ 吃 [`main.ts:392`](../../../../../src/main.ts) 的預設 `ak47`（`recoil.magnitude: 30`、`inaccuracy.stand: 0.00641`／`fire: 0.0078`、`ads.fovDeg: 40`），與 [micro-flick 指標設計](../../../../algorithm/micro-flick/README.md) 明文要求的「hitscan、零散布、零後座」直接矛盾。

沒有這一步，`shotAccuracy`、`intendedFirstShotErrorDeg → 命中` 的映射、以及 T5 的整個意圖歸屬都被 seeded 散布與 punch 污染，補槍（第 2、3 發）尤其嚴重。

## 為什麼是 `usp_s_laser`（而不是新開一把）

[`weapons.ts:82`](../../../../../src/weapon/weapons.ts) 的 `usp_s_laser` 已經滿足三個條件：

| 欄位 | 值 | 效果 |
|---|---|---|
| `recoil` | magnitude／variance／angleVariance 全 0 | 彈道表逐筆 0 ⇒ `aimPunch` 恆 0 ⇒ `ticks[].aim` 就是真實視角 |
| `inaccuracy` | 六項中 `stand`/`crouch`/`fire`/`move` 全 0 | 彈著點 = 準心；且 [`spread.ts:29`](../../../../../src/recoil/spread.ts) 早退 ⇒ **不消耗 recoil RNG** |
| `ads` | **省略** | `effectiveActive = active && adsConfig !== undefined` ⇒ 右鍵對 FOV／感度完全無效，但 `heldAds` 旗標與 `ads` event 照記（稽核不損失） |

⇒ 新開一把武器只會多一份要維護的 config，且會讓 `meta.weaponId` 多一個沒有既有語意的值。

**副作用（必須在 `progress.md` 明帳）**：`cycletimeSec: 0.17`（ak47 為 0.10）⇒ 最小發間隔 170 ms。這是 T5 `cadenceWaitMs` 存在的理由。

## 為什麼這不違反 GD-38 ②

見 [README §0.4](README.md)。兩個 blocker 逐條不適用：

- **(a) counter-strafe 因果通道** —— v8 是 `translation: 'locked'` ⇒ `residualSpeed` 恆 0 ⇒ `speedRatio` 恆 0 ⇒ `inaccuracy.move` 從不參與；且 v8 不量測任何 counter-strafe 構念。
- **(b) 彈匣靜默截斷** —— GD-38 ②(b) 的前提「全 repo 無 reload 路徑」與 [`TargetManager.ts:585`](../../../../../src/sim/TargetManager.ts) 不符：每次 `spawn()` 都補滿彈匣。v8 每殺一顆就 spawn ⇒ 只有「連續 12 發都沒殺掉任何目標」才會空倉。

殘留風險以 FR-63.13 的離線旗標處理，不擋。

## Steps

1. 在 [`micro_flick_three_target_test_v8.ts`](../../../../../src/drill/micro_flick_three_target_test_v8.ts) 的 `drill` 物件加 `weaponId: 'usp_s_laser'`。**只改這一行**，不動 `targets`／`sequence`／`timing`／`endCondition` 任何欄位。
2. 更新 `micro_flick_three_target_test_variants.test.ts`：
   - 斷言 v8 的 `weaponId === 'usp_s_laser'`
   - 斷言 v1–v7 的 config 物件**鍵集合**逐位不變（不得多出 `weaponId: undefined`）
3. 新增決定性回歸測試：同 seed（56008）、同 kill order，比對 T1 前後的 **spawn trace 逐位相同**。這證明換武器沒有擾動 spawn RNG 串流（spawn RNG 與 recoil RNG 是不同串流，且 `sampleSpread` 早退不消耗）。
4. 新增測試：以 v8 的武器 config 呼叫 `sampleSpread()`，斷言恆回 `{ x: 0, y: 0 }`，且傳入的 rng 的呼叫次數為 0。
5. 新增 `meta.weaponId` round-trip 測試：v8 匯出 → `parseExportPayload()` → `meta.weaponId === 'usp_s_laser'`。
6. 在 `progress.md` 記錄**斷代宣告**：T1 之後的 v8 匯出與之前的不可混比；區分方式 = `meta.weaponId`。
7. 為 FR-63.13 建立契約（實作落在 T3 的 `TargetWindowFlag`）：在 `progress.md` 寫明「彈匣空倉的離線判準 = 窗內存在 `fire.ammo === 0` 的事件」，並確認 `fire` 事件的 `ammo` 欄位在 v8 匯出中恆存在。

## Definition of Done

- [ ] `npx.cmd vitest run src/drill/micro_flick_three_target_test_variants.test.ts` exit 0，含上述 v8／v1–v7 兩條斷言
- [ ] spawn trace 逐位比對測試綠，且測試名明示「換武器不擾動 seeded 串流」
- [ ] `sampleSpread()` 零消耗 RNG 的斷言綠（rng 呼叫次數 === 0）
- [ ] `meta.weaponId` round-trip 測試綠
- [ ] `npm.cmd run typecheck` ×2 exit 0；全量 Vitest exit 0 且 passed 數 ≥ T0 基線
- [ ] `progress.md` 有斷代宣告與 `cycletimeSec 0.17` 副作用的明帳記錄
- [ ] `git diff --name-only` 只含 v8 fixture、其 variants test、新增的決定性測試、`progress.md`、`task-checklist.md`

## Commit

```
feat(wp-63): T1 declare zero-spread weapon for micro flick v8
```
