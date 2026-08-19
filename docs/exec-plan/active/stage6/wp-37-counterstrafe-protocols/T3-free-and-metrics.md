# T3 — counterstrafe-free-v1(Practice)+ 制動/共同指標組裝

> Part of [WP-37 counterstrafe-protocols](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T2(`cues[]` 於 cued/reversal 兩協定皆已落地) |
| **Risk / Cplx** | Med / Med(新增制動推導模組,但幾何簡單——單一速度門檻 + 逐 tick 掃描;主要風險是門檻常數第二定義,見 README Failure modes) |
| **Touches** | ADD `src/metrics/brakingDerivation.ts`、`src/metrics/counterstrafeMetrics.ts`、`src/drill/counterstrafe_free_v1.ts`;可能 MODIFY 呼叫端(`main.ts`/`ResultScreen.ts`)的 `mode` 守門斷言(依 T0 OQ-S6-21 初判) |
| **狀態** | ⬜ |

## Objective

交付 FR-F12(`counterstrafe-free-v1`,Practice only)+ FR-F13 剩餘指標:制動四量(`timeToAccuracyGateMs`/`zeroCrossingMs`/`stopDistanceU`/`overReversalUPerS`,新推導)、`fireBeforeGateRate`(既有 `residualSpeed` 的聚合)、共同指標組裝(`counterstrafeMetrics.ts`,複用 `sync-v1`/`leftRightSymmetry` 型式,C-D4)。

## In scope

1. `brakingDerivation.ts`:`deriveBrakingSamples(payload)`,對每個 `PeekWindowTs` 從 `tCounter` 起沿 `tickRange` 對應的 `ticks[]` 掃描 `vx`/`px`,計算四量(公式見 [README §2④](README.md));門檻常數 `import { CS2_PROFILE } from '../sim/MovementController.ts'`,**禁止**另訂字面數字。
2. `counterstrafeMetrics.ts`:`deriveCounterstrafeMetrics(payload)`,組裝:
   - `cueToKeyMs`(僅 `cues.length >= 1` 時計算,= `counter.t - cues[0].t`);
   - `releaseToFireMs`/`counterHoldMs`/`counterToFireMs`(複用 WP-32 `computePromotedMetrics` 的 `sync-v1` 產出,不重推);
   - 制動四量(複用①);
   - `fireBeforeGateRate`(= `firstFire.residualSpeed >= CS2_PROFILE.accuracyThreshold` 的比例);
   - `firstShotHitRate`(複用既有 `outcome==='hit'` 比例)。
   全部依 `peek.visible.side` 分兩組套用既有 `stat()`(`compute.ts`)產出 `SidedStat`,不得另創統計聚合寫法。
3. `counterstrafe_free_v1.ts`:複製 `drills/counterstrafe_ad_v1.json` 內容,`drillId` 改名,新增 `mode: 'practice'`,不設 `cue`。
4. 依 T0 OQ-S6-21 讀碼結論,若呼叫端(`main.ts`/`ResultScreen.ts`/`buildCompatibilityKey` 呼叫點)尚未依 `mode` 分流,補一個守門斷言(測試)證明 Practice 匯出不觸發 `buildCompatibilityKey()`;若已有分流,只需補測試覆蓋既有行為,不新增機制。
5. `CounterstrafeMetrics` 型別**不含**任何合成總分欄位(承 README Failure modes 表最後一列)。

## Out of scope

- `cued-v1`/`reversal-v1` 的協定本身(T1/T2 已交付)。
- 診斷規則對這些指標的解讀(WP-38)。
- 結果頁的視覺呈現細節(留給呼叫端整合;本 task 交付純函式與型別)。

## Steps

- [ ] `brakingDerivation.ts` + 合成 fixture(涵蓋:正常制動、未變號(`no_zero_crossing`)、fire 截斷窗口(`window_truncated_by_fire`)三案例)。
- [ ] 斷言 `brakingDerivation.ts` 的門檻常數為動態 `CS2_PROFILE.accuracyThreshold` 讀取(測試以修改 profile 常數驗證,非硬編字面數字比對)。
- [ ] `counterstrafeMetrics.ts` + 端到端合成 drill 測試(cued/reversal/free 三種 config 各跑一次,斷言 `cueToKeyMs` 僅 cued/reversal 有值、free 為 `undefined`)。
- [ ] `counterstrafe_free_v1.ts` + `mode:'practice'` 守門測試(依 T0 OQ-S6-21 結論)。
- [ ] 斷言 `CounterstrafeMetrics` 型別與匯出不含任何合成總分欄位(型別檢查 + 執行期 keys 集合斷言)。
- [ ] `npx vitest run` 全綠。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 制動四量在三案例(正常/未變號/fire 截斷)行為正確 | 合成 fixture 斷言 |
| ② | 門檻常數為動態讀取,非硬編第二份常數 | 測試以修改 `CS2_PROFILE` 驗證連動 |
| ③ | `cueToKeyMs` 僅 cued/reversal 有值 | 端到端測試斷言 |
| ④ | `free-v1` 匯出不觸發 `buildCompatibilityKey()` | 守門測試綠 |
| ⑤ | 無合成總分欄位 | 型別 + 執行期斷言 |
| ⑥ | `npm run test:ci` 全綠 | CI 輸出貼 progress.md |

## Commit

`feat(wp-37): T3 — counterstrafe-free-v1 + brakingDerivation + counterstrafeMetrics`
