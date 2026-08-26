# T4 — `centerExemptFromTimeout` 欄位 + `DrillRunner.ts` 邏輯

> Part of [WP-46](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1 |
| **Risk / Cplx** | Low-Med / Low(邏輯是一個條件式,風險在「必須同時證明新行為生效 + v1 不受影響」兩個方向都要測到) |
| **Touches** | MODIFY `src/drill/DrillConfig.ts`、`src/drill/schema.ts`、`src/drill/DrillRunner.ts`、`src/drill/DrillRunner.test.ts` |
| **狀態** | ✅ 2026-08-26 |

## Objective

`SpiderShotCenterPeripheralConfig`/`SpiderShotStratifiedConfig` 新增 `centerExemptFromTimeout?: boolean`(省略/false = 現行行為逐位不變)。`DrillRunner.tick()` 的 `peekTimeoutMs` 迴圈:當目標 `zone === 'center'` 且此旗標為 `true` 時跳過該目標,不對它套用逾時撤除——中心目標只靠 `timing.timeLimitMs`/`endCondition` 的整場後援閘結束。

## Steps

- [ ] `src/drill/DrillConfig.ts`:`SpiderShotCenterPeripheralConfig` 與 `SpiderShotStratifiedConfig` 都新增 `centerExemptFromTimeout?: boolean`(型別對稱,兩個 kind 都可用,即使目前只有 v2 會用到)。
- [ ] `src/drill/schema.ts`:`validateSpiderShotSchedule` 兩個分支都新增選填布林欄位讀取(`centerExemptFromTimeout` 省略時不寫入輸出物件,對齊既有選填欄位的處理慣例,如 `spawnArea`/`cue` 的模式)。
- [ ] `src/drill/DrillRunner.ts`:`tick()` 內 `peekTimeoutMs` 迴圈(現行約 136–146 行)於迴圈內對每個 target 判斷前新增:`if (target.zone === 'center' && config.spiderShot?.centerExemptFromTimeout === true) continue;`——注意要放在讀 `visibleAt`/`nowMs` 判斷**之前**,直接跳過整段邏輯,而不是只跳過 `markKilled`(否則仍會消耗迴圈但邏輯上等價,寫在前面更清楚)。
- [ ] 新增 `DrillRunner.test.ts` 測試:
  - ①`spiderShot.centerExemptFromTimeout: true`,center 目標可見超過 `peekTimeoutMs` 仍不被撤除(需靠玩家擊殺才會撤)。
  - ②同一組 config,peripheral 目標仍照常在 `peekTimeoutMs` 到期後被撤除(證明只有 center 被排除,不是整個 timeout 機制失效)。
  - ③`spiderShot.centerExemptFromTimeout` 省略(比照 `spider-shot-v1` 現行 config 形狀)時,center 目標逾時行為與現行 `spider-shot-v1` 逐位不變(regression 測試,直接用 `spiderShotV1` 的 config 或等價 fixture)。
  - ④非 spiderShot drill(`target.zone` 恆 `undefined`)的既有 `peekTimeoutMs` 行為零回歸(既有測試案例應已覆蓋,本步驟只需確認執行仍綠,不必新增)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | `centerExemptFromTimeout:true` 時 center 目標不受 `peekTimeoutMs` 撤除 | 新測試 |
| ② | 同組 config 下 peripheral 目標仍正常逾時撤除 | 新測試 |
| ③ | `spider-shot-v1`(未設此欄位)的逾時行為逐位不變 | 新增 regression 測試 + 既有 `spider_shot_v2.test.ts`「v1 逐位不變」案例維持綠燈 |
| ④ | 非 spiderShot drill 的 `peekTimeoutMs` 行為零回歸 | 既有 `DrillRunner.test.ts` 全數維持綠燈 |
| ⑤ | `npx tsc --noEmit` 全專案綠 | 執行確認 |

## Commit

`feat(wp-46): T4 — centerExemptFromTimeout 欄位 + DrillRunner 中心目標逾時排除邏輯`
