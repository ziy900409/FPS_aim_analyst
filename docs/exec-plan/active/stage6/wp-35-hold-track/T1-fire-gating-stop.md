# T1 — fire-gating + target_stop:移動期間鎖開火、原地凍結解鎖

> Part of [WP-35 hold-track](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(fire-gating 落點 + 欄位命名拍板) |
| **Risk / Cplx** | Med / Med(觸碰 `SimLoop.ts` 熱路徑,零回溯相容成本要求最高) |
| **Touches** | `src/state/types.ts`、`src/state/SharedState.ts`、`src/loop/SimLoop.ts`、`src/sim/TargetManager.ts`、`src/drill/DrillConfig.ts`、`src/drill/schema.ts` |
| **狀態** | ✅(2026-08-19) |

## Objective

交付 FR-F7 的引擎面:目標移動期間鎖住開火,達到 T0 拍板的到期時長後目標原地凍結(不撤除)、解鎖開火、記錄 `tStop`。全部新增路徑必須是 additive——省略新欄位時,既有 63+ drill 的開火與目標生命週期行為逐位不變。

## In scope

1. `src/state/types.ts`:`TargetState` 新增 T0 拍板命名的 additive 欄位(草案 `fireLocked?: boolean`)。
2. `src/state/SharedState.ts`:新增 `tStop: Map<string, number>`(比照既有 `tVisible` 的建構/reset/清除慣例)。
3. `src/loop/SimLoop.ts`:
   - `scheduleFire`(現行 while 迴圈,約 505-511 行)追加 `fireLocked` 為 true 時跳過本次開火消費的判定,依 T0 對 OQ-S6-9 的拍板結論實作(注意:輸入事件本身不得遺失,只是延後消費——沿用既有 `heldFire` 累積語意,不新增輸入緩衝機制)。
   - 若 T0 判定需要在命中判定分支(約 429-440 行)一併調整(例如凍結期間理論上不該進入判定,但 fire-gating 已阻擋在更前面,通常不需要重複判斷),依讀碼結論調整。
4. `src/sim/TargetManager.ts`:`tick()` 新增到期分支——當目標帶有 T0 拍板的修飾欄位(草案來自 `DrillConfig.timing.trackingStopMs`)且 `age` 達門檻時:停止呼叫 `motionOffset`(凍結 `pos`)、把 `fireLocked` 設為 `false`、於 `state.tStop` 記錄當前 `nowMs`。既有 `presentationMs` 到期分支(現行 `markKilled` 路徑)維持不變,新分支只在新欄位存在時進入,兩者互斥(不應同時提供,由 T1 或 `schema.ts` 驗證把關)。
5. `src/drill/DrillConfig.ts`:`timing` 新增 T0 拍板的 additive 欄位。
6. `src/drill/schema.ts`:`validateDrill` 增加新欄位的型別/範圍驗證(additive,比照既有 `presentationMs` 驗證慣例);若 T0 判定 `presentationMs` 與新欄位互斥,在此加驗證。

## Out of scope

- `hold-track-v1` drill config 本身(T2)。
- 停止轉換指標的計算(T2)。
- 掉靶次數/重新取得時間函式(T2)。

## Steps

- [x] 依 T0 拍板結論,在 `TargetState`/`SharedState`/`DrillConfig` 落地 additive 型別。
- [x] `TargetManager.tick()` 新增凍結分支,單元測試涵蓋:到期前 `fireLocked=true`/`age` 持續累加、到期瞬間 `fireLocked→false` 且 `pos` 定格、`tStop` 於同一 tick 寫入。
- [x] `SimLoop.ts` `scheduleFire` 追加判定,單元測試涵蓋:`fireLocked=true` 時 `heldFire` 輸入不消費(彈藥/`nextFireT` 不變)、解鎖後正常消費(比照既有 `fire-determinism.test.ts` 的判定式風格)。
- [x] 既有回歸測試零修改跑一遍確認全綠:`SimLoop.test.ts`、`fire-determinism.test.ts`、`recoil-wiring.test.ts`、`ballistic-compose.test.ts`,以及涉及 `tracking_br_v1`/`presentationMs` 的既有測試。
- [x] `schema.ts` 新增驗證的單元測試(含互斥案例,若 T0 判定需要互斥)。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 省略新欄位時,既有開火/目標生命週期行為逐位不變 | 既有測試(§Steps 第 4 項列出)**零修改**全綠 |
| ② | `fireLocked` 解鎖與 `tStop` 記錄同一 tick 完成 | 單元測試直接斷言 |
| ③ | 到期後目標原地凍結(`pos` 不再由 `motionOffset` 更新)且維持 `visible`/`alive` | 單元測試 |
| ④ | 新欄位型別通過 `schema.ts` 驗證(含省略、含互斥案例若適用) | 單元測試 |
| ⑤ | `npm run test:ci` 全綠 | 貼原始輸出到 progress.md |

## Commit

`feat(wp-35): T1 — fire-gating + target_stop(TargetState.fireLocked,原地凍結到期分支,FR-F7)`
