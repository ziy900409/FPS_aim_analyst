# T1 — v9 宣告 `weaponId: 'usp_s_laser'` + roster 登記 + 斷代標記

> WP：[WP-68](README.md) · 估時 1 d · 相依：T0 · Risk：Med
> **先例**：[WP-63 T1](../wp-63-micro-flick-v8-measurement-foundation/T1-zero-spread-weapon.md) 對 v8 做過同一件事，證明手法可直接沿用。本 task 的價值在**證據**，不在改那一個鍵。

## 為什麼這不是一行 config 改動

改的是**量測儀器**。pre-T1 的 v9 吃 `main.ts` 預設 `ak47`：`inaccuracy.stand 0.00641` / `fire 0.0078` 的 seeded spread、`recoil.magnitude 25` 的 aim punch、右鍵縮 FOV 的 `ads`。實測（[README §0.1](README.md)）：**33/33 發帶散布、32/33 發帶 punch**。⇒「命中與否」不是開火瞬間角誤差的純函式，而 micro-flick 指標族整個建立在那個前提上。

同時它是**效度斷代**：T1 前後的 v9 匯出不可混比。

## Steps

1. **OQ-68.2 gate**：確認 T0 的結論仍成立（既有 v9 匯出非 frozen cohort）。若研究者在此刻回覆「是」，**停止**並改走 v10 fixture，同步改 FR-68.1 與 README §3.1。
2. 在 [`micro_flick_three_target_test_v9.ts`](../../../../../src/drill/micro_flick_three_target_test_v9.ts) 的 `drill` 加 `weaponId: 'usp_s_laser'`，並比照 v8 的既有註解寫明**為什麼**（不是寫「改用 usp」，是寫「零散布零後座是本 drill 的量測前提」）。
3. 在 [`drillFamily.ts`](../../../../../src/session/drillFamily.ts) 的 `DECLARED_WEAPON_ROSTER` 加 v9 一列（v8 那列的正下方），註解指回本 task 與 [WP-62 / D-62-1](../wp-62-session-plan-per-item-weapon/README.md) 的「固定因子不可覆蓋」紀律。
4. **NFR-68.2 的兩條機械證據**（比照 WP-63 T1，不得只斷言「有改到」）：
   - **spawn trace 逐位相同**：同一個 kill order、同一個 seed，`ak47` 與 `usp_s_laser` 兩次 trace 的逐顆 `id/side/x/y/z/visible/alive` 全部 `Object.is` 相同。⚠️ 測試必須同時斷言**兩邊都真的開了槍**（`shotsFired > 0` 且相等），否則是「沒人開槍」的空對空比較。
   - **rng 零消耗**：以 counting rng 包住，對本武器呼叫 `sampleSpread()` N 次後計數 **=== 0**；對照組 `ak47` 同一 harness 計數 **> 0**（沒有對照組就證明不了掃描會咬）。
5. **`meta.weaponId` round-trip**：經 `canonicalExportJSON` → `parseExportPayload` 後仍為 `'usp_s_laser'` 且 `!== 'ak47'`。
6. **v1–v8 零影響**：`micro_flick_three_target_test_variants.test.ts` 斷言 v1–v7 的 config 鍵集合逐位不變、v8 仍為 `usp_s_laser`。
7. **roster 行為斷言**（`drillFamily.test.ts`）：v9 在 `DECLARED_WEAPON_BY_DRILL_ID` 內，且 Session Plan 的逐列指定**不能**覆蓋它（走既有的 `requireWeapon()` 路徑，與 v8 同一條）。
8. **斷代宣告**寫入 `progress.md`：pre-T1 與 post-T1 的 v9 差在哪、如何機械區分（`meta.weaponId`）、副作用（`cycletimeSec` 0.10 → **0.17**、`magSize` 30 → **12**）。
   ⚠️ 一併記錄一條 WP-63 沒有的新事實：**v8 與 v9 從此在 `meta.weaponId` 上不可分**，分析側必須以 `meta.drillId` 分池（README §3.1）。

## Definition of Done

- [ ] `npx.cmd vitest run src/drill/micro_flick_three_target_test_variants.test.ts` exit 0，含 v9 的 `weaponId` 斷言與 v1–v7 鍵集合不變
- [ ] `npx.cmd vitest run src/session/drillFamily.test.ts` exit 0，含 v9 的 roster 與不可覆蓋斷言
- [ ] spawn trace 逐位相同的測試綠，且測試本身斷言兩邊 `shotsFired > 0` 且相等（**實測發數入帳**）
- [ ] `sampleSpread()` 對 v9 武器的 rng 呼叫數 === 0，且 ak47 對照組 > 0
- [ ] `meta.weaponId` round-trip 測試綠
- [ ] `npm.cmd run typecheck` ×2、`npm.cmd test`、`npm.cmd run build` 皆 exit 0，Vitest 數字 ≥ T0 基線且差值 = 本 task 新增數
- [ ] `npm.cmd run test:e2e:fast -- --workers=1 tests/e2e/micro-flick-live.spec.ts` exit 0（該 spec 載入 v9，是唯一的 live 消費端）
- [ ] 斷代宣告與「v8／v9 在 `meta.weaponId` 上不可分」入 `progress.md`

## Commit

```
feat(wp-68): T1 declare zero-spread weapon for micro flick v9
```
